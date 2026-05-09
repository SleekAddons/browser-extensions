import type { HreflangTag, ValidationIssue, ValidationResult } from './types'

/**
 * Validates an hreflang code against BCP 47 structure.
 * Valid formats: "x-default", "en", "en-US", "zh-Hans", "pt-BR", etc.
 */
function isValidHreflangCode(code: string): boolean {
  if (code === 'x-default') return true
  // BCP 47: language(-script)(-region)(-variant)
  // language: 2-3 alpha, script: 4 alpha, region: 2 alpha or 3 digits, variant: 2-8 alphanum
  return /^[a-zA-Z]{2,3}(-[a-zA-Z]{4})?(-([a-zA-Z]{2}|\d{3}))?(-[a-zA-Z0-9]{2,8})?$/.test(code)
}

/**
 * Checks if a URL is absolute.
 */
function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * Validate a set of hreflang tags and return issues.
 */
export function validateHreflangTags(pageUrl: string, tags: HreflangTag[]): ValidationResult {
  const issues: ValidationIssue[] = []

  // --- No tags found ---
  if (tags.length === 0) {
    return { url: pageUrl, tags, issues, timestamp: Date.now() }
  }

  const seenCodes = new Map<string, HreflangTag[]>()
  let hasXDefault = false
  let hasSelfReferencing = false

  const normalizedPageUrl = normalizeUrl(pageUrl)

  for (const tag of tags) {
    const code = tag.hreflang.toLowerCase()

    // Track duplicates
    if (!seenCodes.has(code)) {
      seenCodes.set(code, [])
    }
    seenCodes.get(code)!.push(tag)

    // Check x-default
    if (code === 'x-default') {
      hasXDefault = true
    }

    // --- Validate hreflang code ---
    if (!isValidHreflangCode(tag.hreflang)) {
      issues.push({
        message: `Invalid hreflang code "${tag.hreflang}". Must be a valid BCP 47 language tag or "x-default".`,
        tag,
      })
    }

    // --- Validate URL ---
    if (!tag.href || tag.href.trim() === '') {
      issues.push({
        message: `Hreflang "${tag.hreflang}" has an empty href attribute.`,
        tag,
      })
    } else if (!isAbsoluteUrl(tag.href)) {
      issues.push({
        message: `Hreflang "${tag.hreflang}" uses a relative URL "${tag.href}". URLs must be absolute.`,
        tag,
      })
    }

    // --- Check self-referencing ---
    if (normalizeUrl(tag.href) === normalizedPageUrl) {
      hasSelfReferencing = true
    }
  }

  // --- Missing self-referencing tag ---
  if (!hasSelfReferencing) {
    issues.push({
      message: 'Missing self-referencing hreflang tag. The current page URL must be included in the hreflang set.',
    })
  }

  // --- Missing x-default ---
  if (!hasXDefault) {
    issues.push({
      message: 'No x-default hreflang tag found. It is recommended to include an x-default for users that don\'t match any language.',
    })
  }

  // --- Duplicate hreflang codes ---
  for (const [code, dupes] of seenCodes) {
    if (dupes.length > 1) {
      issues.push({
        message: `Duplicate hreflang code "${code}" found ${dupes.length} times. Each language-region should appear only once.`,
        tag: dupes[0],
      })
    }
  }

  // --- Mixed http/https ---
  const protocols = new Set(
    tags
      .filter((t) => isAbsoluteUrl(t.href))
      .map((t) => new URL(t.href).protocol),
  )
  if (protocols.size > 1) {
    issues.push({
      message: 'Mixed HTTP and HTTPS protocols in hreflang URLs. All URLs should use the same protocol.',
    })
  }

  // --- Trailing slash consistency ---
  const hasTrailingSlash = tags.filter((t) => isAbsoluteUrl(t.href))
  const withSlash = hasTrailingSlash.filter((t) => {
    try { return new URL(t.href).pathname.endsWith('/') } catch { return false }
  })
  const withoutSlash = hasTrailingSlash.filter((t) => {
    try { return !new URL(t.href).pathname.endsWith('/') } catch { return false }
  })
  if (withSlash.length > 0 && withoutSlash.length > 0) {
    issues.push({
      message: 'Inconsistent trailing slashes in hreflang URLs. Use a consistent URL format.',
    })
  }

  return { url: pageUrl, tags, issues, timestamp: Date.now() }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname.replace(/\/+$/, '') + u.search
  } catch {
    return url.replace(/\/+$/, '')
  }
}
