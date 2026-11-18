/**
 * Reads deploy credentials from <repo>/.env (git-ignored; see .env.example).
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'

export const ROOT = path.resolve(import.meta.dirname, '..', '..')
export const ENV_FILE = path.join(ROOT, '.env')

/** Loads .env into process.env. Variables that are already set win. */
export function loadDotEnv(): boolean {
  if (!fs.existsSync(ENV_FILE)) return false
  const parsed = parseEnv(fs.readFileSync(ENV_FILE, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
  return true
}

/** A trimmed environment variable, or undefined when it is missing or empty. */
export function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function requireEnv(name: string): string {
  const value = env(name)
  if (!value) throw new Error(`${name} is not set. Add it to .env (see .env.example).`)
  return value
}

/** Resolves a path from .env relative to the repository root. */
export function resolveFromRoot(file: string): string {
  return path.resolve(ROOT, file)
}
