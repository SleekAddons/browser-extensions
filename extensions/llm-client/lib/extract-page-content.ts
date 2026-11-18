import type { PageContext } from './types'

/**
 * Tags whose content is never useful readable text.
 * Only includes elements that are **unambiguously** non-content.
 */
const STRIP_TAGS = [
  // Code / styling — not visible prose
  'script', 'style', 'noscript',
  // Media & graphical — no readable text
  'svg', 'img', 'picture', 'source', 'video', 'audio', 'canvas', 'figure',
  // Embedded / plugin content
  'iframe', 'object', 'embed',
  // Image maps
  'map', 'area',
  // Never rendered
  'template', 'slot',
  // Form controls — UI chrome, not page text
  'input', 'select', 'textarea', 'option', 'optgroup', 'datalist', 'button',
  // Navigation — site-wide menus / breadcrumbs, not article content
  'nav',
  // Footer — boilerplate copyright / legal links
  'footer',
].join(', ')

/**
 * Selector for elements that are explicitly hidden and should be stripped.
 */
const HIDDEN_SELECTOR = [
  '[hidden]',
  '[aria-hidden="true"]',
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="position:fixed"]',
  '[style*="position: fixed"]',
  '[style*="position:sticky"]',
  '[style*="position: sticky"]',
  '[role="alert"]',         // toast / notification banners
  '[role="dialog"]',        // modals
  '[role="complementary"]', // sidebars / ads
  '[role="banner"]',        // sticky headers / top bars
].join(', ')

/** Minimum z-index value considered "overlay-level" */
const HIGH_ZINDEX_THRESHOLD = 900

/**
 * Returns the integer z-index from an element's inline style, or null.
 */
function getInlineZIndex(el: Element): number | null {
  const style = el.getAttribute('style')
  if (!style) return null
  const match = style.match(/z-index\s*:\s*(-?\d+)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Remove all elements whose inline style sets a z-index >= threshold.
 * These are almost always overlays, modals, sticky bars, or cookie banners.
 */
function stripHighZIndex(root: HTMLElement): void {
  // querySelectorAll('[style*="z-index"]') narrows the scan to only styled elements
  root.querySelectorAll('[style*="z-index"]').forEach((el) => {
    const z = getInlineZIndex(el)
    if (z !== null && z >= HIGH_ZINDEX_THRESHOLD) {
      el.remove()
    }
  })
}

/**
 * Returns true if the element has no meaningful text content
 * (only whitespace or completely empty).
 */
function isEmpty(el: Element): boolean {
  return !el.textContent?.trim()
}

/**
 * Recursively strip all attributes except `id` from an element and its children.
 * Also removes elements that are empty after processing.
 */
function cleanElement(el: Element): void {
  // Remove all attributes except id
  const id = el.getAttribute('id')
  while (el.attributes.length > 0) {
    el.removeAttribute(el.attributes[0].name)
  }
  if (id) el.setAttribute('id', id)

  // Process children in reverse so removals don't shift indices
  for (let i = el.children.length - 1; i >= 0; i--) {
    const child = el.children[i]

    // Skip elements that have no textContent
    if (isEmpty(child)) {
      child.remove()
      continue
    }

    cleanElement(child)

    // Remove child if it became empty after cleaning
    if (isEmpty(child)) {
      child.remove()
    }
  }
}

/**
 * Extract readable text content from an HTML string.
 *
 * Strips tags that are unambiguously non-content (media, form controls,
 * navigation, embeds, hidden elements), cleans remaining attributes
 * (keeping only `id`), removes empty nested elements, and returns
 * cleaned HTML along with plain-text content.
 */
export function extractPageContent(html: string, url: string): PageContext | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Grab page title
  const title = doc.title?.trim() ?? ''

  // Try to detect meta description for excerpt
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''

  // Try to detect author
  const byline =
    doc.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() ??
    doc.querySelector('[rel="author"]')?.textContent?.trim() ??
    null

  // Try to detect site name
  const siteName =
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim() ??
    null

  // Build a clean document fragment from text-bearing elements
  const body = doc.body
  if (!body) return null

  // Work on a clone so we can mutate freely
  const clone = body.cloneNode(true) as HTMLElement

  // 1. Remove tags that never carry readable text
  clone.querySelectorAll(STRIP_TAGS).forEach((el) => el.remove())

  // 2. Remove explicitly hidden / fixed / sticky elements
  clone.querySelectorAll(HIDDEN_SELECTOR).forEach((el) => el.remove())

  // 3. Remove overlay-level elements (high z-index)
  stripHighZIndex(clone)

  // 4. Clean the remaining tree (strip attributes, prune empties)
  cleanElement(clone)

  // Remove empty top-level children
  for (let i = clone.children.length - 1; i >= 0; i--) {
    if (isEmpty(clone.children[i])) {
      clone.children[i].remove()
    }
  }

  const content = clone.innerHTML.trim()
  const textContent = clone.textContent?.trim() ?? ''

  if (!textContent) return null

  return {
    title,
    content,
    textContent,
    excerpt: metaDesc,
    byline,
    siteName,
    length: textContent.length,
    url,
  }
}
