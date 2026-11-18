/**
 * Translation Checker
 *
 * Checks the locale files of every extension without building: keys that are
 * not in English, placeholders ($1, $2…) that differ from English, missing
 * plural forms, store length limits and missing translations. The build runs
 * the same checks but only fails on errors; this script also fails on missing
 * translations.
 *
 * Usage:
 *   npm run check-locales                        # all extensions, all locales
 *   npm run check-locales -- website-blocker     # specific extensions
 *   npm run check-locales -- --locale de         # only report de.json files
 */

import fs from 'node:fs'
import path from 'node:path'
import { buildLocales, DEFAULT_LOCALE } from '../extensions/locales'

const EXTENSIONS_DIR = path.resolve(import.meta.dirname, '..', 'extensions')

function discoverExtensions(): string[] {
  return fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(EXTENSIONS_DIR, d.name, 'manifest.config.ts')))
    .map((d) => d.name)
}

function parseArgs(argv: string[]) {
  const slugs: string[] = []
  const locales = new Set<string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--locale') locales.add(argv[++i])
    else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`)
    else slugs.push(arg)
  }
  return { slugs: slugs.length ? slugs : discoverExtensions(), locales }
}

function main() {
  const { slugs, locales } = parseArgs(process.argv.slice(2))
  const mentionsLocale = (problem: string) =>
    locales.size === 0 || [...locales].some((locale) => problem.includes(`/${locale}.json`))

  // src/locales is checked with every extension: report each problem once.
  const reported = new Set<string>()
  let problems = 0

  for (const slug of slugs) {
    if (!fs.existsSync(path.join(EXTENSIONS_DIR, slug, 'manifest.config.ts'))) {
      throw new Error(`Unknown extension "${slug}"`)
    }
    const { files, errors, warnings } = buildLocales(slug)
    const fresh = (list: string[]) => list.filter((p) => mentionsLocale(p) && !reported.has(p))
    const newErrors = fresh(errors)
    const newWarnings = fresh(warnings)
    for (const p of [...newErrors, ...newWarnings]) reported.add(p)
    problems += newErrors.length + newWarnings.length

    const folders = files.map((f) => f.relativeDest.split('/')[1]).filter((l) => l !== DEFAULT_LOCALE)
    if (newErrors.length === 0 && newWarnings.length === 0) {
      console.log(`  ✔ ${slug}${errors.length ? '' : ` (${DEFAULT_LOCALE} + ${folders.join(', ') || 'no translations'})`}`)
      continue
    }
    console.log(`  ✘ ${slug}`)
    for (const e of newErrors) console.log(`      error: ${e}`)
    for (const w of newWarnings) console.log(`      missing: ${w}`)
  }

  if (problems) {
    console.log(`\n${problems} problem(s) found.`)
    process.exit(1)
  }
  console.log('\nAll translations are complete.')
}

main()
