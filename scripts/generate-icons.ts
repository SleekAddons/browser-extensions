/**
 * Icon Generator
 *
 * Generates extension icons (16, 32, 48, 128 px) for each registered extension
 * using the extension name initials. Design: black background, rounded corners,
 * white centered text.
 *
 * Usage:
 *   npx tsx scripts/generate-icons.ts            # all extensions
 *   npx tsx scripts/generate-icons.ts table-extractor tech-detector  # specific ones
 */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SIZES = [16, 32, 48, 128] as const
const ROOT = path.resolve(import.meta.dirname, '..')
const EXTENSIONS_DIR = path.join(ROOT, 'extensions')

/** Override auto-generated initials for specific extensions. */
const INITIALS_OVERRIDE: Record<string, string> = {
  'pihole-manager': 'PI',
  'ollama-client': 'LM',
}

/** Extract initials from an extension display name (up to 2 chars). */
function getInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/** Derive the display name from the directory slug (e.g. "table-extractor" → "Table Extractor"). */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Build an SVG string for the icon. */
function buildSvg(size: number, initials: string): string {
  const radius = Math.round(size * 0.18)
  // Font size scales with icon; smaller icons get proportionally larger text for legibility
  const fontSize = size <= 32 ? Math.round(size * 0.45) : Math.round(size * 0.42)
  const fontWeight = size <= 32 ? 700 : 600
  // dy shifts text down by ~35% of font size to visually center (accounts for cap-height)
  const dy = Math.round(fontSize * 0.35)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#111111"/>
  <text
    x="50%" y="50%"
    dy="${dy}"
    text-anchor="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    fill="#ffffff"
    letter-spacing="${size >= 48 ? 1 : 0}"
  >${initials}</text>
</svg>`
}

/** Discover extension directory names from the extensions/ folder. */
function discoverExtensions(): string[] {
  return fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(EXTENSIONS_DIR, d.name, 'manifest.config.ts')))
    .map((d) => d.name)
}

async function generateIcons(extensionSlug: string) {
  const displayName = slugToName(extensionSlug)
  const initials = INITIALS_OVERRIDE[extensionSlug] ?? getInitials(displayName)
  const iconsDir = path.join(EXTENSIONS_DIR, extensionSlug, 'public')

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true })
  }

  await Promise.all(
    SIZES.map(async (size) => {
      const svg = buildSvg(size, initials)
      const outPath = path.join(iconsDir, `icon${size}.png`)
      await sharp(Buffer.from(svg)).png().toFile(outPath)
    }),
  )

  console.log(`  ✔ ${extensionSlug} (${initials}) → ${SIZES.map((s) => `${s}px`).join(', ')}`)
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2)
  const targets = args.length > 0 ? args : discoverExtensions()

  console.log(`Generating icons for ${targets.length} extension(s)...\n`)

  for (const slug of targets) {
    const dir = path.join(EXTENSIONS_DIR, slug)
    if (!fs.existsSync(dir)) {
      console.error(`  ✘ "${slug}" - directory not found, skipping`)
      continue
    }
    await generateIcons(slug)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
