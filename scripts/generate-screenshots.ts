/**
 * Store Screenshot Generator
 *
 * Renders 1280x800 store screenshots for each extension from the real, built
 * extension UI: the popup / side panel is loaded in headless Chrome with a
 * mocked extension runtime and demo data (see scripts/screenshots/), shown
 * with a headline (in a minimal browser window when the page behind it
 * matters), and saved as PNG.
 *
 * Output: extensions/<slug>/screenshots/<n>.png
 *         extensions/<slug>/screenshots/captions.json
 *
 * The images are committed to git; `npm run deploy` uploads whatever is in
 * that folder and never runs this script. Re-run it by hand after UI changes.
 *
 * Requires Google Chrome (or set CHROME_PATH to a Chromium-based browser).
 *
 * Usage:
 *   npm run generate-screenshots                       # all extensions
 *   npm run generate-screenshots -- table-extractor    # specific ones
 *   npm run generate-screenshots -- table-extractor --only 2
 *   npm run generate-screenshots -- --skip-build       # reuse .output/chrome-mv3 (single extension)
 *   npm run generate-screenshots -- --out-dir /tmp/shots
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import sharp from 'sharp'
import { chromium, type Browser, type Frame, type Page } from 'playwright-core'
import { renderStage, type Action, type FrameRole, type Scene } from './screenshots/stage'
import { SCENES } from './screenshots/scenes'

const ROOT = path.resolve(import.meta.dirname, '..')
const EXTENSIONS_DIR = path.join(ROOT, 'extensions')
const BUILD_DIR = path.join(ROOT, '.output', 'chrome-mv3')
const ASSETS_DIR = path.join(import.meta.dirname, 'screenshots', 'assets')
const MOCK_SCRIPT = path.join(import.meta.dirname, 'screenshots', 'extension-mock.js')
const FONT_DIRS: Record<string, string> = {
  inter: path.join(ROOT, 'node_modules', '@fontsource-variable', 'inter'),
  'jetbrains-mono': path.join(ROOT, 'node_modules', '@fontsource-variable', 'jetbrains-mono'),
}

const WIDTH = 1280
const HEIGHT = 800
/** Render at 2x and downsample, for smoother text and edges. */
const SUPERSAMPLE = 2

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

// ── Local web server ──────────────────────────────────────
//
// Serves the built extension at the root (its HTML uses absolute /chunks/…
// paths) and the stage, demo pages and fonts under /__stage/.

interface StageServer {
  origin: string
  setStage(html: string): void
  close(): Promise<void>
}

function resolveInside(base: string, relative: string): string | null {
  const file = path.resolve(base, `.${relative}`)
  return file.startsWith(base + path.sep) || file === base ? file : null
}

async function startServer(): Promise<StageServer> {
  let stageHtml = ''

  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    let file: string | null

    if (pathname === '/__stage/scene.html') {
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.html'], 'Cache-Control': 'no-store' })
      res.end(stageHtml)
      return
    }

    const font = pathname.match(/^\/__stage\/fonts\/([^/]+)(\/.*)$/)
    if (font && FONT_DIRS[font[1]]) file = resolveInside(FONT_DIRS[font[1]], font[2])
    else if (pathname.startsWith('/__stage/')) file = resolveInside(ASSETS_DIR, pathname.slice('/__stage'.length))
    else file = resolveInside(BUILD_DIR, pathname)

    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    fs.createReadStream(file).pipe(res)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    origin: `http://127.0.0.1:${port}`,
    setStage: (html) => {
      stageHtml = html
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

// ── Helpers ───────────────────────────────────────────────

function build(slug: string) {
  console.log(`  building ${slug}…`)
  const result = spawnSync('npx', ['wxt', 'build', '-b', 'chrome'], {
    cwd: ROOT,
    env: { ...process.env, EXT: slug },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr)
    throw new Error(`Build failed for ${slug}`)
  }
}

function readBuiltManifest(): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(BUILD_DIR, 'manifest.json'), 'utf8'))
}

async function frameFor(page: Page, role: FrameRole): Promise<Frame> {
  const element = await page.waitForSelector(`iframe[data-role="${role}"]`, { state: 'attached' })
  const frame = await element.contentFrame()
  if (!frame) throw new Error(`No ${role} frame`)
  return frame
}

async function runAction(page: Page, action: Action) {
  if ('wait' in action) {
    await page.waitForTimeout(action.wait)
    return
  }
  const frame = page.frameLocator(`iframe[data-role="${action.frame ?? 'popup'}"]`)
  if ('click' in action) await frame.locator(action.click).first().click()
  else if ('hover' in action) await frame.locator(action.hover).first().hover()
  else if ('waitFor' in action) await frame.locator(action.waitFor).first().waitFor({ state: 'visible' })
  else if ('scrollIntoView' in action) {
    await frame.locator(action.scrollIntoView).first().evaluate((el, offset) => {
      let box = el.parentElement
      while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) {
        box = box.parentElement
      }
      if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - offset
    }, action.offset ?? 0)
  }
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.CHROME_PATH
  try {
    return await chromium.launch(executablePath ? { executablePath } : { channel: 'chrome' })
  } catch (err) {
    throw new Error(
      'Could not start Google Chrome. Install it, or set CHROME_PATH to a Chromium-based browser.\n' +
        String(err),
    )
  }
}

// ── Rendering ─────────────────────────────────────────────

async function renderScene(
  browser: Browser,
  server: StageServer,
  scene: Scene,
  manifest: Record<string, any>,
): Promise<Buffer> {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SUPERSAMPLE,
    colorScheme: scene.theme,
    // Same time zone as this process, so "today" in the demo data matches the page.
    locale: 'en-US',
  })

  // Nothing may leave the machine: every request outside the local server fails.
  await context.route(
    (url) => !url.href.startsWith(server.origin),
    (route) => route.abort('blockedbyclient'),
  )

  const mock = {
    manifest,
    theme: scene.theme,
    tab: { url: scene.tab.url, title: scene.tab.title },
    storage: scene.storage ?? {},
    fetch: scene.fetch ?? [],
  }
  await context.addInitScript({ content: `window.__SCREENSHOT_MOCK__ = ${JSON.stringify(mock)};` })
  await context.addInitScript({ path: MOCK_SCRIPT })

  const page = await context.newPage()
  const problems: string[] = []
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`console ${msg.type()}: ${msg.text()}`)
  })

  try {
    server.setStage(renderStage(scene, manifest.name))
    await page.goto(`${server.origin}/__stage/scene.html`, { waitUntil: 'load' })

    if (scene.page) {
      const pageFrame = await frameFor(page, 'page')
      await pageFrame.waitForLoadState('load')
    }
    await page.evaluate(() => (window as any).__startUi())

    if (scene.ui.kind !== 'none') {
      const uiPath = scene.ui.path ?? (scene.ui.kind === 'popup' ? '/popup.html' : '/sidepanel.html')
      const uiFrame = await frameFor(page, scene.ui.kind)
      await uiFrame.waitForURL((url) => `${url.pathname}${url.search}` === uiPath)
      await uiFrame.waitForLoadState('load')
    }

    if (scene.ready) {
      await page
        .frameLocator(`iframe[data-role="${scene.ready.frame}"]`)
        .locator(scene.ready.selector)
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
    }

    for (const action of scene.actions ?? []) await runAction(page, action)

    // Let fonts, transitions and charts settle.
    for (const frame of page.frames()) {
      await frame.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {})
    }
    await page.waitForTimeout(900)

    const shot = await page.screenshot({ type: 'png' })
    return await sharp(shot)
      .resize(WIDTH, HEIGHT, { kernel: 'lanczos3' })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer()
  } catch (err) {
    if (problems.length) console.error(problems.map((p) => `      ${p}`).join('\n'))
    throw err
  } finally {
    const relevant = problems.filter((p) => !p.includes('net::ERR_BLOCKED_BY_CLIENT'))
    if (relevant.length && process.env.DEBUG_SCREENSHOTS) console.warn(relevant.map((p) => `      ${p}`).join('\n'))
    await context.close()
  }
}

// ── Main ──────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const slugs: string[] = []
  let only: Set<string> | null = null
  let skipBuild = false
  let outDir: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--skip-build') skipBuild = true
    else if (arg === '--only') only = new Set(argv[++i].split(',').map((n) => (n.endsWith('.png') ? n : `${n}.png`)))
    else if (arg === '--out-dir') outDir = path.resolve(argv[++i])
    else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`)
    else slugs.push(arg)
  }
  return { slugs: slugs.length ? slugs : Object.keys(SCENES), only, skipBuild, outDir }
}

async function main() {
  const { slugs, only, skipBuild, outDir } = parseArgs(process.argv.slice(2))
  for (const slug of slugs) {
    if (!SCENES[slug]) throw new Error(`No screenshot scenes defined for "${slug}"`)
  }
  if (skipBuild && slugs.length > 1) throw new Error('--skip-build only works for a single extension')

  console.log(`Generating store screenshots for ${slugs.length} extension(s)...\n`)

  const server = await startServer()
  const browser = await launchBrowser()

  try {
    for (const slug of slugs) {
      if (!skipBuild) build(slug)
      const manifest = readBuiltManifest()
      const expectedName = fs.readFileSync(path.join(EXTENSIONS_DIR, slug, 'manifest.config.ts'), 'utf8').match(/name:\s*'([^']+)'/)?.[1]
      if (expectedName && manifest.name !== expectedName) {
        throw new Error(`.output/chrome-mv3 contains "${manifest.name}", not ${slug}. Drop --skip-build.`)
      }

      const targetDir = outDir ? path.join(outDir, slug) : path.join(EXTENSIONS_DIR, slug, 'screenshots')
      fs.mkdirSync(targetDir, { recursive: true })

      const captionsFile = path.join(targetDir, 'captions.json')
      const captions: Record<string, string> = fs.existsSync(captionsFile)
        ? JSON.parse(fs.readFileSync(captionsFile, 'utf8'))
        : {}

      for (const scene of SCENES[slug]) {
        if (only && !only.has(scene.file)) continue
        const png = await renderScene(browser, server, scene, manifest)
        fs.writeFileSync(path.join(targetDir, scene.file), png)
        captions[scene.file] = scene.caption
        console.log(`  ✔ ${slug}/${scene.file} — ${scene.caption}`)
      }

      const sorted = Object.fromEntries(Object.entries(captions).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
      fs.writeFileSync(captionsFile, `${JSON.stringify(sorted, null, 2)}\n`)
    }
  } finally {
    await browser.close()
    await server.close()
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
