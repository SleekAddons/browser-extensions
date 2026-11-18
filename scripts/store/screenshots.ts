/**
 * Store screenshots committed in extensions/<slug>/screenshots/: image files
 * in file-name order, plus optional captions in captions.json
 * ({ "1.png": "caption", … }).
 */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { ROOT } from './env'

export interface LocalScreenshot {
  file: string
  path: string
  type: string
  caption?: string
}

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export function screenshotsDir(slug: string): string {
  return path.join(ROOT, 'extensions', slug, 'screenshots')
}

export function readLocalScreenshots(slug: string): LocalScreenshot[] {
  const dir = screenshotsDir(slug)
  if (!fs.existsSync(dir)) return []
  const captionsFile = path.join(dir, 'captions.json')
  const captions: Record<string, string> = fs.existsSync(captionsFile)
    ? JSON.parse(fs.readFileSync(captionsFile, 'utf8'))
    : {}
  return fs
    .readdirSync(dir)
    .filter((file) => IMAGE_TYPES[path.extname(file).toLowerCase()])
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((file) => ({
      file,
      path: path.join(dir, file),
      type: IMAGE_TYPES[path.extname(file).toLowerCase()],
      caption: captions[file]?.trim() || undefined,
    }))
}

/**
 * Whether two images show the same picture. Stores re-encode uploads, so the
 * bytes differ; compare downscaled pixels with a small tolerance instead.
 */
export async function sameImage(a: Buffer, b: Buffer): Promise<boolean> {
  const [metaA, metaB] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()])
  const ratio = (m: sharp.Metadata) => (m.width ?? 1) / (m.height ?? 1)
  if (Math.abs(ratio(metaA) - ratio(metaB)) > 0.01) return false

  const width = 320
  const height = Math.round(width / ratio(metaA))
  const pixels = (input: Buffer) =>
    sharp(input).resize(width, height, { fit: 'fill' }).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer()
  const [pa, pb] = await Promise.all([pixels(a), pixels(b)])

  let differing = 0
  for (let i = 0; i < pa.length; i += 3) {
    const delta = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]))
    if (delta > 24) differing++
  }
  return differing / (width * height) < 0.001
}
