/**
 * Locales
 *
 * Builds an extension's _locales/<locale>/messages.json from flat JSON files:
 *
 *   src/locales/<locale>.json               strings of the shared components
 *   extensions/<name>/locales/<locale>.json strings of one extension
 *
 * Each file maps a key to its text. `$1`, `$2`… are filled in at runtime
 * (see src/lib/i18n.ts). Plural strings have one key per CLDR plural category
 * of the language, e.g. `rows_one`, `rows_few`, `rows_many`, `rows_other`.
 * English (the default locale) is the reference: other locales may only use
 * its keys and the same placeholders.
 *
 * Every extension defines `extName` and `extDescription`, which the manifest
 * uses as __MSG_extName__ and __MSG_extDescription__.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_LOCALE = 'en'

/**
 * Locales written to several _locales folders. The Chrome Web Store ignores a
 * plain "pt" folder, so Portuguese goes to both Brazilian and European
 * Portuguese.
 */
const LOCALE_FOLDERS: Record<string, string[]> = {
  pt: ['pt_BR', 'pt_PT'],
}

/** Added to every messages.json: the locale the messages are in (see src/lib/i18n.ts). */
const LOCALE_CODE_KEY = 'localeCode'

/** Store limits: Chrome allows 75 characters for the name and 132 for the description. */
const MAX_LENGTH: Record<string, number> = { extName: 75, extDescription: 132 }

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other']
const KEY_PATTERN = new RegExp(`^[a-z][A-Za-z0-9]*(?:_(${PLURAL_CATEGORIES.join('|')}))?$`)
const LOCALE_PATTERN = /^[a-z]{2,3}(?:_(?:[A-Z]{2}|\d{3}))?$/

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const SHARED_LOCALES_DIR = path.join(ROOT, 'src', 'locales')

export function extensionLocalesDir(ext: string): string {
  return path.join(ROOT, 'extensions', ext, 'locales')
}

type Messages = Record<string, string>

export interface LocalesResult {
  /** _locales/<folder>/messages.json files, ready for the build:publicAssets hook */
  files: { relativeDest: string; contents: string }[]
  /** Problems that make the build fail */
  errors: string[]
  /** Missing translations; the browser shows English for these */
  warnings: string[]
}

function readLocaleDir(dir: string, errors: string[]): Map<string, Messages> {
  const locales = new Map<string, Messages>()
  if (!fs.existsSync(dir)) return locales
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue
    const where = path.relative(ROOT, path.join(dir, file))
    const locale = file.slice(0, -'.json'.length)
    if (!LOCALE_PATTERN.test(locale)) {
      errors.push(`${where}: "${locale}" is not a locale code like "de" or "pt_BR"`)
      continue
    }
    let data: unknown
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    } catch (err) {
      errors.push(`${where}: invalid JSON (${(err as Error).message})`)
      continue
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push(`${where}: expected an object of "key": "text" pairs`)
      continue
    }
    const messages: Messages = {}
    const seen = new Map<string, string>()
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string' || !value.trim()) {
        errors.push(`${where}: "${key}" must be a non-empty string`)
        continue
      }
      if (!KEY_PATTERN.test(key) || key === LOCALE_CODE_KEY) {
        errors.push(`${where}: "${key}" is not a valid key (camelCase, optionally ending in _one, _other…; "${LOCALE_CODE_KEY}" is reserved)`)
        continue
      }
      // The browsers look messages up case-insensitively.
      const other = seen.get(key.toLowerCase())
      if (other) errors.push(`${where}: "${key}" and "${other}" differ only in case`)
      seen.set(key.toLowerCase(), key)
      messages[key] = value
    }
    locales.set(locale, messages)
  }
  return locales
}

/** `rows_few` → { base: 'rows', category: 'few' }; plain keys → null */
function splitPlural(key: string): { base: string; category: string } | null {
  const match = key.match(/^(.+)_([a-z]+)$/)
  return match ? { base: match[1], category: match[2] } : null
}

/** Sorted `$N` placeholders in a message, e.g. ["$1", "$2"]. */
function placeholders(text: string): string[] {
  return [...new Set(text.match(/\$[1-9]/g) ?? [])].sort()
}

/** "$" must start a $1…$9 placeholder or be escaped as "$$". */
function hasStrayDollar(text: string): boolean {
  return /\$(?![1-9$])/.test(text.replace(/\$\$/g, ''))
}

/**
 * Chrome reads `$name$` as a named placeholder and refuses to load the
 * extension when it is not defined, so "$1x$2" must not appear.
 */
function looksLikeNamedPlaceholder(text: string): boolean {
  return /\$[A-Za-z0-9_@]+\$/.test(text)
}

function intlLocale(locale: string): string {
  return locale.replace('_', '-')
}

/** Plural categories that integer counts from 0 to 999 can select in a language. */
function integerCategories(locale: string): Set<string> {
  const rules = new Intl.PluralRules(intlLocale(locale))
  const categories = new Set<string>()
  for (let n = 0; n < 1000; n++) categories.add(rules.select(n))
  return categories
}

function validate(
  locale: string,
  messages: Messages,
  reference: Messages,
  where: string,
  errors: string[],
  warnings: string[],
) {
  const isDefault = locale === DEFAULT_LOCALE
  const allowedCategories = new Set(new Intl.PluralRules(intlLocale(locale)).resolvedOptions().pluralCategories)
  const pluralBases = new Map<string, Set<string>>()

  for (const [key, text] of Object.entries(messages)) {
    if (hasStrayDollar(text)) errors.push(`${where}: "${key}" has a "$" that is not $1…$9 (write "$$" for a dollar sign)`)
    if (looksLikeNamedPlaceholder(text)) errors.push(`${where}: "${key}" has two placeholders joined by letters or digits, which Chrome reads as a named $placeholder$`)

    const plural = splitPlural(key)
    if (plural) {
      if (!allowedCategories.has(plural.category as Intl.LDMLPluralRule)) {
        errors.push(`${where}: "${key}": ${locale} has no "${plural.category}" plural form (it has ${[...allowedCategories].join(', ')})`)
      }
      if (!pluralBases.has(plural.base)) pluralBases.set(plural.base, new Set())
      pluralBases.get(plural.base)!.add(plural.category)
    }

    if (isDefault) continue
    const referenceKey = plural ? `${plural.base}_other` : key
    const referenceText = reference[referenceKey]
    if (referenceText === undefined) {
      errors.push(`${where}: "${key}" is not in the ${DEFAULT_LOCALE} file`)
      continue
    }
    const expected = placeholders(referenceText)
    const actual = placeholders(text)
    if (expected.join() !== actual.join()) {
      errors.push(`${where}: "${key}" uses ${actual.join(', ') || 'no placeholders'}, expected ${expected.join(', ') || 'none'}`)
    }
  }

  const needed = integerCategories(locale)
  for (const [base, categories] of pluralBases) {
    if (!categories.has('other')) errors.push(`${where}: "${base}_other" is missing (the fallback for every count)`)
    const missing = [...needed].filter((category) => !categories.has(category))
    if (missing.length) errors.push(`${where}: "${base}" needs ${missing.map((c) => `${base}_${c}`).join(', ')} for ${locale}`)
  }

  if (isDefault) return
  for (const key of Object.keys(reference)) {
    const plural = splitPlural(key)
    const present = plural ? pluralBases.has(plural.base) : key in messages
    // Report a plural message once, through its _other key.
    if (!present && (!plural || plural.category === 'other')) {
      warnings.push(`${where}: missing "${plural ? plural.base : key}"`)
    }
  }
}

/** Builds and checks the _locales files of one extension. */
export function buildLocales(ext: string): LocalesResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sharedDir = SHARED_LOCALES_DIR
  const ownDir = extensionLocalesDir(ext)
  const shared = readLocaleDir(sharedDir, errors)
  const own = readLocaleDir(ownDir, errors)
  const relative = (dir: string, locale: string) => path.relative(ROOT, path.join(dir, `${locale}.json`))

  for (const [dir, locales] of [[sharedDir, shared], [ownDir, own]] as const) {
    if (!locales.has(DEFAULT_LOCALE)) errors.push(`${relative(dir, DEFAULT_LOCALE)} is missing`)
  }
  if (errors.length) return { files: [], errors, warnings }

  for (const required of Object.keys(MAX_LENGTH)) {
    if (!own.get(DEFAULT_LOCALE)![required]) errors.push(`${relative(ownDir, DEFAULT_LOCALE)}: "${required}" is required`)
  }

  const files: LocalesResult['files'] = []
  const folderSources = new Map<string, string>()
  const allLocales = [...new Set([...shared.keys(), ...own.keys()])].sort()

  for (const locale of allLocales) {
    const sharedMessages = shared.get(locale) ?? {}
    const ownMessages = own.get(locale) ?? {}
    if (!shared.has(locale)) warnings.push(`${relative(sharedDir, locale)} is missing`)
    if (!own.has(locale)) warnings.push(`${relative(ownDir, locale)} is missing`)

    validate(locale, sharedMessages, shared.get(DEFAULT_LOCALE)!, relative(sharedDir, locale), errors, warnings)
    validate(locale, ownMessages, own.get(DEFAULT_LOCALE)!, relative(ownDir, locale), errors, warnings)

    const sharedKeys = new Map(Object.keys(sharedMessages).map((key) => [key.toLowerCase(), key]))
    for (const key of Object.keys(ownMessages)) {
      const clash = sharedKeys.get(key.toLowerCase())
      if (clash) errors.push(`${relative(ownDir, locale)}: "${key}" is already defined in ${relative(sharedDir, locale)} as "${clash}"`)
    }

    for (const [key, max] of Object.entries(MAX_LENGTH)) {
      const text = ownMessages[key]
      if (text && text.length > max) {
        errors.push(`${relative(ownDir, locale)}: "${key}" is ${text.length} characters, the stores allow ${max}`)
      }
    }

    for (const folder of LOCALE_FOLDERS[locale] ?? [locale]) {
      const source = folderSources.get(folder)
      if (source) errors.push(`${locale}.json and ${source}.json both write _locales/${folder}`)
      folderSources.set(folder, locale)
      const bundle: Record<string, { message: string }> = {
        [LOCALE_CODE_KEY]: { message: intlLocale(folder) },
      }
      for (const [key, message] of Object.entries({ ...sharedMessages, ...ownMessages })) {
        bundle[key] = { message }
      }
      files.push({
        relativeDest: `_locales/${folder}/messages.json`,
        contents: `${JSON.stringify(bundle, null, 2)}\n`,
      })
    }
  }

  return { files: errors.length ? [] : files, errors, warnings }
}
