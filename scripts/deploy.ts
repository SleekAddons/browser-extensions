/**
 * Store Deploy
 *
 * Builds extensions and publishes them to the Chrome Web Store (API v2) and
 * Firefox Add-ons (AMO API v5), using the version in package.json:
 *
 *   Chrome   upload the package and submit it for review.
 *   Firefox  upload the package with its source code archive, then make the
 *            listing screenshots match extensions/<slug>/screenshots/.
 *
 * Screenshots are committed to git (`npm run generate-screenshots` makes
 * them); this script only uploads them. The Chrome Web Store API has no way
 * to change listing screenshots, so those are uploaded in its dashboard.
 *
 * Store IDs live in extensions/<slug>/store.json; credentials in .env
 * (git-ignored, see .env.example). Re-running is safe: versions that are
 * already uploaded and screenshots that already match are skipped.
 *
 * Usage:
 *   npm run deploy -- <extension…> | --all [options]
 *
 * Options:
 *   --all                  every extension with a store.json
 *   --store <chrome|firefox>  only this store (default: both)
 *   --dry-run              build and check against the stores, change nothing
 *   --skip-build           use the zips already in .output/
 *   --screenshots-only     only sync screenshots, no new version
 *   --no-screenshots       only publish the new version
 *   --cancel-pending       Chrome: withdraw a submission still in review first
 *   --release-notes <text> Firefox: release notes for the new version
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import pkg from '../package.json'
import { ChromeWebStore, chromeCredentialsFromEnv, revisionVersions, type PublishType } from './store/chrome-web-store'
import { ROOT, env, loadDotEnv, requireEnv, resolveFromRoot } from './store/env'
import { FirefoxAddons, type AmoAddon } from './store/firefox-addons'
import { compareVersions } from './store/http'
import { readLocalScreenshots, sameImage, type LocalScreenshot } from './store/screenshots'

type Store = 'chrome' | 'firefox'

interface StoreConfig {
  chrome?: { itemId: string }
  firefox?: { addonId: string }
}

interface Options {
  slugs: string[]
  stores: Set<Store>
  dryRun: boolean
  skipBuild: boolean
  screenshots: 'sync' | 'skip' | 'only'
  cancelPending: boolean
  releaseNotes?: string
}

interface Packages {
  chrome: string
  firefox: string
  sources: string
}

const EXTENSIONS_DIR = path.join(ROOT, 'extensions')
const OUTPUT_DIR = path.join(ROOT, '.output')
const WXT_BIN = path.join(ROOT, 'node_modules', 'wxt', 'bin', 'wxt.mjs')
const version: string = pkg.version

const USAGE = `Usage: npm run deploy -- <extension…> | --all [options]

Options:
  --all                     every extension with a store.json
  --store <chrome|firefox>  only this store (default: both)
  --dry-run                 build and check against the stores, change nothing
  --skip-build              use the zips already in .output/
  --screenshots-only        only sync screenshots, no new version
  --no-screenshots          only publish the new version
  --cancel-pending          Chrome: withdraw a submission still in review first
  --release-notes <text>    Firefox: release notes for the new version`

// ── Setup ─────────────────────────────────────────────────

function storeConfigPath(slug: string) {
  return path.join(EXTENSIONS_DIR, slug, 'store.json')
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    slugs: [],
    stores: new Set(['chrome', 'firefox']),
    dryRun: false,
    skipBuild: false,
    screenshots: 'sync',
    cancelPending: false,
  }
  let all = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => {
      const next = argv[++i]
      if (next === undefined) throw new Error(`${arg} needs a value`)
      return next
    }
    if (arg === '--all') all = true
    else if (arg === '--store') {
      const store = value()
      if (store !== 'chrome' && store !== 'firefox') throw new Error(`--store must be chrome or firefox, not "${store}"`)
      opts.stores = new Set([store])
    } else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--skip-build') opts.skipBuild = true
    else if (arg === '--screenshots-only') opts.screenshots = 'only'
    else if (arg === '--no-screenshots') opts.screenshots = 'skip'
    else if (arg === '--cancel-pending') opts.cancelPending = true
    else if (arg === '--release-notes') opts.releaseNotes = value()
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}\n\n${USAGE}`)
    else opts.slugs.push(arg)
  }

  const deployable = fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(storeConfigPath(d.name)))
    .map((d) => d.name)
  if (all) opts.slugs = deployable
  if (opts.slugs.length === 0) throw new Error(`Name the extensions to deploy, or pass --all.\n\n${USAGE}`)
  for (const slug of opts.slugs) {
    if (!deployable.includes(slug)) {
      throw new Error(`"${slug}" has no extensions/${slug}/store.json. Deployable: ${deployable.join(', ')}`)
    }
  }
  return opts
}

let chromeClient: ChromeWebStore | undefined
function chromeStore(): ChromeWebStore {
  if (!chromeClient) {
    const credentials = chromeCredentialsFromEnv()
    if (!credentials) {
      throw new Error(
        'No Chrome Web Store credentials. Set CHROME_SERVICE_ACCOUNT_KEY_FILE, or CHROME_CLIENT_ID, ' +
          'CHROME_CLIENT_SECRET and CHROME_REFRESH_TOKEN in .env.',
      )
    }
    chromeClient = new ChromeWebStore(requireEnv('CHROME_PUBLISHER_ID'), credentials)
  }
  return chromeClient
}

let firefoxClient: FirefoxAddons | undefined
function firefoxStore(): FirefoxAddons {
  firefoxClient ??= new FirefoxAddons(requireEnv('FIREFOX_JWT_ISSUER'), requireEnv('FIREFOX_JWT_SECRET'))
  return firefoxClient
}

function publishType(): PublishType {
  const value = env('CHROME_PUBLISH_TYPE') ?? 'DEFAULT_PUBLISH'
  if (value !== 'DEFAULT_PUBLISH' && value !== 'STAGED_PUBLISH') {
    throw new Error(`CHROME_PUBLISH_TYPE must be DEFAULT_PUBLISH or STAGED_PUBLISH, not "${value}"`)
  }
  return value
}

// ── Packages ──────────────────────────────────────────────

function runWxtZip(slug: string, browser: Store) {
  const result = spawnSync(process.execPath, [WXT_BIN, 'zip', '-b', browser], {
    cwd: ROOT,
    env: { ...process.env, EXT: slug },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) throw new Error(`wxt zip -b ${browser} failed:\n${result.stdout}\n${result.stderr}`)
}

/** Values that must never end up inside an uploaded archive. */
function secretValues(): string[] {
  const values = ['CHROME_CLIENT_SECRET', 'CHROME_REFRESH_TOKEN', 'FIREFOX_JWT_SECRET'].map((name) => env(name))
  const keyFile = env('CHROME_SERVICE_ACCOUNT_KEY_FILE')
  if (keyFile && fs.existsSync(resolveFromRoot(keyFile))) {
    const key: string = JSON.parse(fs.readFileSync(resolveFromRoot(keyFile), 'utf8')).private_key ?? ''
    // A slice of the key body is enough to recognise it.
    values.push(key.replace(/-----[^-]+-----|\s/g, '').slice(40, 104))
  }
  return values.filter((v): v is string => !!v && v.length >= 8)
}

/** Refuses archives that contain .env files, key files or any configured secret value. */
async function assertNoSecrets(file: string) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file))
  const keyFile = env('CHROME_SERVICE_ACCOUNT_KEY_FILE')
  const keyName = keyFile ? path.basename(keyFile) : null
  const secrets = secretValues()
  const problems: string[] = []

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const name = entry.name
    if (/(^|\/)\.env($|\.)/.test(name) || /(^|\/)secrets\//.test(name) || /\.(pem|p12|key)$/i.test(name) || path.basename(name) === keyName) {
      problems.push(name)
      continue
    }
    if (secrets.length) {
      const content = await entry.async('string')
      if (secrets.some((secret) => content.includes(secret))) problems.push(`${name} (contains a secret from .env)`)
    }
  }
  if (problems.length) {
    throw new Error(`Refusing to upload ${path.basename(file)}, it contains secrets:\n  ${problems.join('\n  ')}`)
  }
}

async function preparePackages(slug: string, opts: Options): Promise<Packages> {
  const packages: Packages = {
    chrome: path.join(OUTPUT_DIR, `${slug}-${version}-chrome.zip`),
    firefox: path.join(OUTPUT_DIR, `${slug}-${version}-firefox.zip`),
    sources: path.join(OUTPUT_DIR, `${slug}-${version}-sources.zip`),
  }
  const needed: string[] = []
  for (const store of opts.stores) {
    if (!opts.skipBuild) {
      console.log(`  building ${store} package…`)
      runWxtZip(slug, store)
    }
    needed.push(...(store === 'chrome' ? [packages.chrome] : [packages.firefox, packages.sources]))
  }
  for (const file of needed) {
    if (!fs.existsSync(file)) throw new Error(`${path.relative(ROOT, file)} not found${opts.skipBuild ? ' (drop --skip-build)' : ''}`)
    await assertNoSecrets(file)
  }
  return packages
}

// ── Chrome Web Store ──────────────────────────────────────

async function deployChrome(itemId: string, packages: Packages, opts: Options): Promise<string[]> {
  const store = chromeStore()
  const type = publishType()
  const status = await store.fetchStatus(itemId)
  const lines: string[] = []
  if (status.takenDown) lines.push('⚠ the item is taken down for a policy violation')
  if (status.warned) lines.push('⚠ the item has a policy warning in the dashboard')

  const published = revisionVersions(status.publishedItemRevisionStatus).sort(compareVersions)
  const submitted = status.submittedItemRevisionStatus
  const submittedVersions = revisionVersions(submitted)

  if (published.includes(version)) return [...lines, `v${version} is already published`]
  if (submitted?.state === 'STAGED' && submittedVersions.includes(version)) {
    return [...lines, `v${version} passed review and is staged; publish it in the dashboard`]
  }
  if (submitted?.state === 'PENDING_REVIEW' && submittedVersions.includes(version)) {
    return [...lines, `v${version} is already waiting for review`]
  }

  const newest = published.at(-1)
  if (newest && compareVersions(version, newest) <= 0) {
    throw new Error(`v${version} is not newer than the published v${newest}; bump "version" in package.json`)
  }

  if (submitted?.state === 'PENDING_REVIEW') {
    const pending = submittedVersions.join(', ') || 'an earlier version'
    if (!opts.cancelPending) {
      throw new Error(`v${pending} is still in review. Re-run with --cancel-pending to withdraw it and submit v${version}.`)
    }
    if (opts.dryRun) lines.push(`would withdraw v${pending} from review`)
    else {
      await store.cancelSubmission(itemId)
      lines.push(`withdrew v${pending} from review`)
    }
  }

  if (opts.dryRun) return [...lines, `would upload ${path.basename(packages.chrome)} and submit v${version} (${type})`]

  const uploaded = await store.upload(itemId, fs.readFileSync(packages.chrome))
  if (uploaded.crxVersion && uploaded.crxVersion !== version) {
    throw new Error(`the store read version ${uploaded.crxVersion} from the package, expected ${version}`)
  }
  const result = await store.publish(itemId, type)
  lines.push(`uploaded and submitted v${version} for review${result.state ? ` (${result.state})` : ''}`)
  for (const warning of result.warnings) lines.push(`⚠ ${warning}`)
  return lines
}

// ── Firefox Add-ons ───────────────────────────────────────

function approvalNotes(slug: string): string {
  return [
    `Built with WXT from the attached source code. The repository holds several extensions; the archive contains the shared code and the "${slug}" extension.`,
    '',
    'To rebuild the package (Node.js 20+, npm 10+):',
    '  npm ci',
    `  EXT=${slug} npx wxt zip -b firefox`,
    '',
    `Output: .output/${slug}-${version}-firefox.zip`,
  ].join('\n')
}

async function publishFirefoxVersion(
  slug: string,
  addon: AmoAddon,
  addonId: string,
  packages: Packages,
  opts: Options,
): Promise<string> {
  const store = firefoxStore()
  const existing = await store.getVersion(addonId, version)
  if (existing) return `v${version} is already on AMO${existing.file?.status ? ` (${existing.file.status})` : ''}`

  const current = addon.current_version?.version
  if (current && compareVersions(version, current) <= 0) {
    throw new Error(`v${version} is not newer than the listed v${current}; bump "version" in package.json`)
  }
  if (opts.dryRun) {
    return `would upload ${path.basename(packages.firefox)} with ${path.basename(packages.sources)} as v${version}`
  }

  const zip = (file: string) => ({ data: fs.readFileSync(file), filename: path.basename(file), type: 'application/zip' })
  const upload = await store.uploadPackage(zip(packages.firefox))
  const created = await store.createVersion(addonId, upload.uuid, zip(packages.sources), approvalNotes(slug))
  if (opts.releaseNotes) await store.setReleaseNotes(addonId, created.id, addon.default_locale || 'en-US', opts.releaseNotes)
  return `uploaded v${version} with source code (${created.file?.status ?? 'awaiting review'})`
}

async function screenshotsMatch(local: LocalScreenshot[], addon: AmoAddon, locale: string): Promise<boolean> {
  const remote = [...addon.previews].sort((a, b) => a.position - b.position)
  if (remote.length !== local.length) return false
  for (const [i, shot] of local.entries()) {
    if ((remote[i].caption?.[locale] ?? '') !== (shot.caption ?? '')) return false
    const res = await fetch(remote[i].image_url)
    if (!res.ok) return false
    if (!(await sameImage(fs.readFileSync(shot.path), Buffer.from(await res.arrayBuffer())))) return false
  }
  return true
}

async function syncFirefoxScreenshots(slug: string, addon: AmoAddon, addonId: string, opts: Options): Promise<string> {
  const local = readLocalScreenshots(slug)
  if (local.length === 0) return `no screenshots in extensions/${slug}/screenshots/, left the listing as is`

  const locale = addon.default_locale || 'en-US'
  if (await screenshotsMatch(local, addon, locale)) return `screenshots are up to date (${local.length})`

  const old = addon.previews
  if (opts.dryRun) return `would replace ${old.length} screenshot(s) with the ${local.length} in extensions/${slug}/screenshots/`

  // Add the new screenshots before removing the old ones, so the listing is never empty.
  const store = firefoxStore()
  for (const [position, shot] of local.entries()) {
    const preview = await store.addPreview(addonId, { data: fs.readFileSync(shot.path), filename: shot.file, type: shot.type }, position)
    if (shot.caption) await store.setPreviewCaption(addonId, preview.id, locale, shot.caption)
  }
  for (const preview of old) await store.deletePreview(addonId, preview.id)
  return `uploaded ${local.length} screenshot(s)${old.length ? `, removed ${old.length} old` : ''}`
}

async function deployFirefox(slug: string, addonId: string, packages: Packages | null, opts: Options): Promise<string[]> {
  const addon = await firefoxStore().getAddon(addonId)
  const lines: string[] = []
  if (packages) lines.push(await publishFirefoxVersion(slug, addon, addonId, packages, opts))
  if (opts.screenshots !== 'skip') lines.push(await syncFirefoxScreenshots(slug, addon, addonId, opts))
  return lines
}

// ── Main ──────────────────────────────────────────────────

interface Outcome {
  slug: string
  store: string
  ok: boolean
  lines: string[]
}

async function attempt(slug: string, store: string, task: () => Promise<string[]>): Promise<Outcome> {
  try {
    const lines = await task()
    for (const line of lines) console.log(`  ✔ ${store}: ${line}`)
    return { slug, store, ok: true, lines }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`  ✘ ${store}: ${message}`)
    return { slug, store, ok: false, lines: [message] }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!loadDotEnv()) console.warn('No .env file found; using the environment only. Copy .env.example to .env.\n')

  const targets = [...opts.stores].join(' + ')
  console.log(`Deploying v${version} to ${targets}${opts.dryRun ? ' (dry run, nothing will change)' : ''}\n`)

  const outcomes: Outcome[] = []
  for (const slug of opts.slugs) {
    console.log(`▸ ${slug}`)
    const config: StoreConfig = JSON.parse(fs.readFileSync(storeConfigPath(slug), 'utf8'))

    let packages: Packages | null = null
    if (opts.screenshots !== 'only') {
      try {
        packages = await preparePackages(slug, opts)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`  ✘ build: ${message}`)
        outcomes.push({ slug, store: 'build', ok: false, lines: [message] })
        continue
      }
    }

    if (opts.stores.has('chrome') && packages) {
      const itemId = config.chrome?.itemId
      outcomes.push(
        await attempt(slug, 'Chrome', async () => {
          if (!itemId) throw new Error(`no chrome.itemId in extensions/${slug}/store.json`)
          return deployChrome(itemId, packages, opts)
        }),
      )
    }
    if (opts.stores.has('firefox')) {
      const addonId = config.firefox?.addonId
      outcomes.push(
        await attempt(slug, 'Firefox', async () => {
          if (!addonId) throw new Error(`no firefox.addonId in extensions/${slug}/store.json`)
          return deployFirefox(slug, addonId, packages, opts)
        }),
      )
    }
    console.log()
  }

  if (opts.stores.has('chrome') && opts.screenshots !== 'skip') {
    console.log(
      'Note: the Chrome Web Store API cannot change listing screenshots. When extensions/<name>/screenshots/ ' +
        'changes, upload them under Store listing in https://chrome.google.com/webstore/devconsole\n',
    )
  }

  const failed = outcomes.filter((o) => !o.ok)
  if (failed.length) {
    console.error(`${failed.length} step(s) failed: ${failed.map((o) => `${o.slug} (${o.store})`).join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('Done.')
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
