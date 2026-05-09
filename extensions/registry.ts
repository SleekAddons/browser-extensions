/**
 * Extension Registry
 *
 * Extensions are auto-discovered by scanning for subdirectories that contain
 * a `manifest.config.ts` file. No manual registration needed - just create a
 * new folder under `extensions/<name>/` with a `manifest.config.ts`.
 *
 * To build a specific extension:
 *   EXT=table-extractor npm run build
 *   EXT=table-extractor npm run dev
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserManifest } from 'wxt'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const extDirs = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      fs.existsSync(path.join(__dirname, entry.name, 'manifest.config.ts')),
  )
  .map((entry) => entry.name)

const entries = await Promise.all(
  extDirs.map(async (name) => {
    const mod = await import(`./${name}/manifest.config.js`)
    return [name, mod.default as UserManifest] as const
  }),
)

export const extensions: Record<string, UserManifest> =
  Object.fromEntries(entries)

/** Default extension to build when EXT is not specified */
export const defaultExtension = 'table-extractor'
