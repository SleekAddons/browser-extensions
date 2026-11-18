/**
 * Translation helpers on top of browser.i18n.
 *
 * Strings live in flat JSON files (src/locales/<locale>.json for the shared
 * components, extensions/<name>/locales/<locale>.json for each extension) and
 * are turned into _locales/<locale>/messages.json at build time, see
 * extensions/locales.ts. A message fills `$1`, `$2`… with the substitutions
 * passed to t(). Plural messages have one key per CLDR plural category of the
 * language (`tables_one`, `tables_few`, `tables_other`…); `_other` is always
 * there and is the fallback.
 *
 * Each extension gets typed helpers for its own keys from its lib/i18n.ts.
 */
import { createElement, Fragment, type ReactNode } from 'react'
import { browser } from 'wxt/browser'
import type sharedMessages from '@/locales/en.json'

/** Keys every extension defines in its own locale files (used by the manifest). */
type ExtensionKey = 'extName' | 'extDescription'

export type SharedKey = keyof typeof sharedMessages | ExtensionKey

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

/** Keys of ordinary messages (plural variants are left out). */
type PlainKey<K extends string> = K extends `${string}_${PluralCategory}` ? never : K

/** Base names of plural messages: `tables` for `tables_one` / `tables_other`. */
type PluralKey<K extends string> = K extends `${infer Base}_other` ? Base : never

export type Substitution = string | number

const i18n = browser.i18n as unknown as {
  getMessage(name: string, substitutions?: string[]): string
  getUILanguage(): string
}

function message(key: string, substitutions: Substitution[] = []): string {
  return i18n.getMessage(key, substitutions.map(String)) ?? ''
}

/**
 * Locale for number, date and plural formatting: the browser UI language when
 * its messages are in use, otherwise the language the messages fell back to
 * (e.g. English for a Ukrainian browser), so plural forms match the text.
 */
function resolveLocale(): string {
  // Written into every messages.json by the build, e.g. "pt-BR".
  const bundle = message('localeCode') || 'en'
  const ui = i18n.getUILanguage() || bundle
  const language = (tag: string) => tag.split(/[-_]/)[0].toLowerCase()
  return language(ui) === language(bundle) ? ui : bundle
}

export const locale = resolveLocale()

const pluralRules = new Intl.PluralRules(locale)
const numberFormats = new Map<string, Intl.NumberFormat>()

/** Formats a number for the current locale, e.g. 1234.5 → "1,234.5" or "1 234,5". */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const cacheKey = JSON.stringify(options ?? {})
  let format = numberFormats.get(cacheKey)
  if (!format) {
    format = new Intl.NumberFormat(locale, options)
    numberFormats.set(cacheKey, format)
  }
  return format.format(value)
}

/** A value with a spelled-out unit, e.g. "10 seconds", "2 hours", "15 min". */
export function formatUnit(
  value: number,
  unit: 'second' | 'minute' | 'hour' | 'day',
  unitDisplay: 'long' | 'short' | 'narrow' = 'long',
): string {
  return formatNumber(value, { style: 'unit', unit, unitDisplay })
}

const DURATION_PARTS = [
  ['durationDays', 86_400],
  ['durationHours', 3_600],
  ['durationMinutes', 60],
  ['durationSeconds', 1],
] as const

/**
 * Compact duration such as "1h 5m 3s". Units that are zero are left out;
 * `maxUnits` keeps only the largest ones ("1h 5m" for 2).
 */
export function formatDuration(totalSeconds: number, maxUnits: number = DURATION_PARTS.length): string {
  let rest = Math.max(0, Math.floor(totalSeconds))
  const parts: string[] = []
  for (const [key, size] of DURATION_PARTS) {
    const value = Math.floor(rest / size)
    rest -= value * size
    if (value > 0) parts.push(message(key, [formatNumber(value)]))
  }
  if (parts.length === 0) return message('durationSeconds', [formatNumber(0)])
  return parts.slice(0, Math.max(1, maxUnits)).join(' ')
}

/** Sets the lang attribute of an extension page to the language of its text. */
export function applyDocumentLocale() {
  document.documentElement.lang = locale
}

/**
 * Translation functions typed for the keys of one extension (`Key`) plus the
 * shared ones.
 */
export function createTranslator<Key extends string>() {
  type AnyKey = Key | SharedKey

  /** A message with `$1`, `$2`… replaced by `substitutions`. */
  function t(key: PlainKey<AnyKey>, ...substitutions: Substitution[]): string {
    return message(key, substitutions) || key
  }

  /**
   * A plural message picked by `count`. `$1` is the formatted count and
   * `$2`, `$3`… are the extra substitutions.
   */
  function tPlural(key: PluralKey<AnyKey>, count: number, ...substitutions: Substitution[]): string {
    const values = [formatNumber(count), ...substitutions]
    return message(`${key}_${pluralRules.select(count)}`, values) || message(`${key}_other`, values) || key
  }

  /** A message with `$1`, `$2`… replaced by React nodes, e.g. a link or <code>. */
  function tRich(key: PlainKey<AnyKey>, ...nodes: ReactNode[]): ReactNode {
    // Private-use characters mark where each node goes, so a translation can
    // put them in any order.
    const text = t(key, ...nodes.map((_, i) => `${i}`))
    const parts = text.split(/(\d+)/)
    return createElement(
      Fragment,
      null,
      ...parts.map((part, i) => (i % 2 === 1 ? nodes[Number(part)] : part)),
    )
  }

  return { t, tPlural, tRich }
}

/** Translation functions for the shared components in src/. */
export const { t, tPlural, tRich } = createTranslator<SharedKey>()
