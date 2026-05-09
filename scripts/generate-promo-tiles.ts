/**
 * Promo Tile Generator
 *
 * Generates Chrome Web Store promo tiles for each registered extension:
 *   - Small promo tile:   440x280
 *   - Marquee promo tile: 1400x560
 *
 * Design matches the icon generator: black background, rounded badge with
 * white initials, plus the extension name and a short tagline.
 *
 * Output: extensions/<slug>/public/promo-small.png
 *         extensions/<slug>/public/promo-marquee.png
 *
 * Usage:
 *   npx tsx scripts/generate-promo-tiles.ts            # all extensions
 *   npx tsx scripts/generate-promo-tiles.ts table-extractor pihole-manager
 */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const EXTENSIONS_DIR = path.join(ROOT, 'extensions')

type TileSpec = {
  file: string
  width: number
  height: number
}

const TILES: TileSpec[] = [
  { file: 'promo-small.png', width: 440, height: 280 },
  { file: 'promo-marquee.png', width: 1400, height: 560 },
]

/** Override auto-generated initials for specific extensions. */
const INITIALS_OVERRIDE: Record<string, string> = {
  'pihole-manager': 'PI',
  'ollama-client': 'LM',
}

/** Override auto-derived display name for specific extensions. */
const NAME_OVERRIDE: Record<string, string> = {
  'pihole-manager': 'Pi-hole Manager',
  'tool-hub': 'Tool Hub',
}

/** Short tagline shown under the name. Falls back to manifest description. */
const TAGLINE_OVERRIDE: Record<string, string> = {
  'breakpoint-viewer': 'See the active CSS breakpoint instantly.',
  'ollama-client': 'Chat with local AI in your browser.',
  'pihole-manager': 'Control every Pi-hole from one place.',
  'table-extractor': 'Export any web table to CSV or XLSX.',
  'tool-hub': 'Find and save the web tools you love.',
  'website-blocker': 'Block distractions. Reclaim your focus.',
}

function getInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Read name + description from an extension's manifest.config.ts (best-effort regex). */
function readManifestMeta(slug: string): { name?: string; description?: string } {
  const file = path.join(EXTENSIONS_DIR, slug, 'manifest.config.ts')
  if (!fs.existsSync(file)) return {}
  const src = fs.readFileSync(file, 'utf8')
  const nameMatch = src.match(/name:\s*['"`]([^'"`]+)['"`]/)
  const descMatch = src.match(/description:\s*['"`]([^'"`]+)['"`]/)
  return {
    name: nameMatch?.[1],
    description: descMatch?.[1],
  }
}

/** Read locale messages for tool-hub style i18n manifests. */
function readLocaleMeta(slug: string): { name?: string; description?: string } {
  const file = path.join(EXTENSIONS_DIR, slug, 'public', '_locales', 'en', 'messages.json')
  if (!fs.existsSync(file)) return {}
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'))
    return {
      name: json?.extName?.message,
      description: json?.extDescription?.message,
    }
  } catch {
    return {}
  }
}

/** XML-escape user supplied text for SVG. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Naive word-wrap into N lines that fit a max chars-per-line budget. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    if (lines.length >= maxLines) {
      current = ''
      break
    }
    current = w
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines
}

function buildTileSvg(opts: {
  width: number
  height: number
  initials: string
  name: string
  tagline: string
}): string {
  const { width, height, initials, name, tagline } = opts

  // Badge sizing.
  const badgeSize = Math.round(height * 0.45)
  const badgeRadius = Math.round(badgeSize * 0.18)
  const badgeFontSize = Math.round(badgeSize * 0.42)
  const badgeDy = Math.round(badgeFontSize * 0.35)

  // Gap between badge and text block.
  const badgeTextGap = Math.round(height * 0.1)

  // Approximate character widths (em units) for the system sans stack.
  const NAME_CHAR_EM = 0.58 // bold
  const TAGLINE_CHAR_EM = 0.5 // regular

  // Auto-shrink the name font until it fits a sensible max width.
  // Use modest side padding as a hard cap; the composition will still be
  // visually centered based on actual content width. Smaller tiles get a
  // proportionally larger padding ratio so the content doesn't feel cramped.
  const sidePaddingRatio = width < 800 ? 0.1 : 0.06
  const sidePadding = Math.round(width * sidePaddingRatio)
  const maxContentWidth = width - sidePadding * 2
  const maxTextWidth = maxContentWidth - badgeSize - badgeTextGap

  let nameFontSize = Math.round(height * 0.13)
  const nameMin = Math.round(height * 0.08)
  while (nameFontSize > nameMin && name.length * NAME_CHAR_EM * nameFontSize > maxTextWidth) {
    nameFontSize -= 1
  }

  const taglineFontSize = Math.round(height * 0.07)
  const lineGap = Math.round(taglineFontSize * 0.4)

  const taglineChars = Math.max(12, Math.floor(maxTextWidth / (taglineFontSize * TAGLINE_CHAR_EM)))
  const taglineLines = wrap(tagline, taglineChars, 2)

  // Measure the actual text block width so we can center the whole composition.
  const nameWidth = name.length * NAME_CHAR_EM * nameFontSize
  const taglineWidth = taglineLines.reduce(
    (max, line) => Math.max(max, line.length * TAGLINE_CHAR_EM * taglineFontSize),
    0,
  )
  const textBlockWidth = Math.min(maxTextWidth, Math.max(nameWidth, taglineWidth))
  const totalContentWidth = badgeSize + badgeTextGap + textBlockWidth

  // Center the badge + text composition horizontally.
  const contentX = Math.round((width - totalContentWidth) / 2)
  const badgeX = contentX
  const badgeY = Math.round((height - badgeSize) / 2)
  const textX = badgeX + badgeSize + badgeTextGap

  // Vertically center the text block (name + gap + tagline lines).
  const taglineBlockHeight =
    taglineLines.length * taglineFontSize + Math.max(0, taglineLines.length - 1) * lineGap
  const nameToTaglineGap = Math.round(nameFontSize * 0.35)
  const totalBlockHeight = nameFontSize + nameToTaglineGap + taglineBlockHeight
  const textTop = Math.round((height - totalBlockHeight) / 2)

  const nameBaselineY = textTop + nameFontSize
  const taglineStartY = nameBaselineY + nameToTaglineGap + taglineFontSize

  const taglineTspans = taglineLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : taglineFontSize + lineGap
      return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#111111"/>
  <rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeRadius}" ry="${badgeRadius}" fill="#ffffff"/>
  <text
    x="${badgeX + badgeSize / 2}" y="${badgeY + badgeSize / 2}"
    dy="${badgeDy}"
    text-anchor="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    font-size="${badgeFontSize}"
    font-weight="700"
    fill="#111111"
    letter-spacing="1"
  >${escapeXml(initials)}</text>
  <text
    x="${textX}" y="${nameBaselineY}"
    font-family="system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    font-size="${nameFontSize}"
    font-weight="700"
    fill="#ffffff"
  >${escapeXml(name)}</text>
  <text
    x="${textX}" y="${taglineStartY}"
    font-family="system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    font-size="${taglineFontSize}"
    font-weight="400"
    fill="#bbbbbb"
  >${taglineTspans}</text>
</svg>`
}

function discoverExtensions(): string[] {
  return fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        fs.existsSync(path.join(EXTENSIONS_DIR, d.name, 'manifest.config.ts')),
    )
    .map((d) => d.name)
}

async function generateTilesFor(slug: string) {
  const manifestMeta = readManifestMeta(slug)
  const localeMeta = readLocaleMeta(slug)

  const rawName = manifestMeta.name && !manifestMeta.name.startsWith('__MSG_') ? manifestMeta.name : undefined
  const name = NAME_OVERRIDE[slug] ?? rawName ?? localeMeta.name ?? slugToName(slug)

  const rawDesc = manifestMeta.description && !manifestMeta.description.startsWith('__MSG_')
    ? manifestMeta.description
    : undefined
  const tagline = TAGLINE_OVERRIDE[slug] ?? rawDesc ?? localeMeta.description ?? ''

  const initials = INITIALS_OVERRIDE[slug] ?? getInitials(name)

  const outDir = path.join(EXTENSIONS_DIR, slug, 'public')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  await Promise.all(
    TILES.map(async (tile) => {
      const svg = buildTileSvg({
        width: tile.width,
        height: tile.height,
        initials,
        name,
        tagline,
      })
      const outPath = path.join(outDir, tile.file)
      await sharp(Buffer.from(svg)).png().toFile(outPath)
    }),
  )

  console.log(`  ✔ ${slug} (${initials}) → ${TILES.map((t) => `${t.width}x${t.height}`).join(', ')}`)
}

async function main() {
  const args = process.argv.slice(2)
  const targets = args.length > 0 ? args : discoverExtensions()

  console.log(`Generating promo tiles for ${targets.length} extension(s)...\n`)

  for (const slug of targets) {
    const dir = path.join(EXTENSIONS_DIR, slug)
    if (!fs.existsSync(dir)) {
      console.error(`  ✘ "${slug}" - directory not found, skipping`)
      continue
    }
    await generateTilesFor(slug)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
