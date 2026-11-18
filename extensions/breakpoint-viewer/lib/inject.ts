import { browser } from 'wxt/browser'
import type { BadgeSettings, BreakpointConfig } from './breakpoints'
import { isUrlAllowed } from './breakpoints'

/**
 * Programmatically inject/update the breakpoint badge on the active tab.
 * This ensures the badge appears even on tabs that were open before
 * the extension was installed or where the content script hasn't loaded.
 */
export async function injectBadge(settings: BadgeSettings) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url?.match(/^https?:\/\//)) return

  // Check site filter - if blocked, inject with enabled=false to remove any existing badge
  const allowed = isUrlAllowed(tab.url, settings.siteFilterMode, settings.sitePatterns)
  const effectiveEnabled = settings.enabled && allowed

  try {
    if (browser.scripting?.executeScript) {
      // MV3 / Firefox 102+
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: applyBadge,
        args: [effectiveEnabled, settings.position, settings.breakpoints],
      })
    } else if (browser.tabs?.executeScript) {
      // MV2 fallback
      const code = `(${applyBadge.toString()})(${JSON.stringify(effectiveEnabled)},${JSON.stringify(settings.position)},${JSON.stringify(settings.breakpoints)})`
      await browser.tabs.executeScript(tab.id, { code })
    }
  } catch {
    // Tab may not be scriptable (e.g. chrome:// or about: pages)
  }
}

/**
 * Creates, updates or removes the breakpoint badge.
 *
 * Used by the content script and injected by the popup through
 * scripting.executeScript, so it must be self-contained: no imports and no
 * references to the outer scope. Both callers run in the same isolated
 * world, so the current breakpoints live on `window` and a single resize
 * listener renders from there. That keeps the badge in sync after settings
 * change and avoids stacking a new listener every time it is re-created.
 */
export function applyBadge(
  enabled: boolean,
  position: string,
  breakpoints: BreakpointConfig[],
) {
  const BADGE_ID = '__bp-viewer-badge__'
  const scope = window as unknown as {
    __bpViewer?: { breakpoints: BreakpointConfig[]; listening: boolean }
  }
  const state = scope.__bpViewer ?? (scope.__bpViewer = { breakpoints, listening: false })
  state.breakpoints = breakpoints

  const existing = document.getElementById(BADGE_ID)

  if (!enabled) {
    existing?.remove()
    return
  }

  const posMap: Record<string, string> = {
    'top-left':     'top:0!important;left:0!important;bottom:auto!important;right:auto!important;',
    'top-right':    'top:0!important;right:0!important;bottom:auto!important;left:auto!important;',
    'bottom-left':  'bottom:0!important;left:0!important;top:auto!important;right:auto!important;',
    'bottom-right': 'bottom:0!important;right:0!important;top:auto!important;left:auto!important;',
  }

  const baseStyle =
    `position:fixed!important;z-index:2147483647!important;margin:12px!important;${posMap[position] ?? posMap['bottom-left']}` +
    'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;' +
    'font-size:11px!important;font-weight:600!important;' +
    'height:22px!important;line-height:22px!important;' +
    'padding:0 8px!important;border-radius:8px!important;' +
    'pointer-events:none!important;' +
    'border:1px solid rgba(255,255,255,0.25)!important;' +
    'backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important;' +
    'transition:none!important;' +
    'display:block!important;visibility:visible!important;opacity:1!important;' +
    'box-sizing:border-box!important;transform:none!important;' +
    'float:none!important;clear:none!important;'

  const render = (el: HTMLElement) => {
    const width = window.innerWidth
    const sorted = [...state.breakpoints].sort((a, b) => b.minWidth - a.minWidth)
    // Below the smallest min-width, fall back to the smallest breakpoint.
    const bp = sorted.find((b) => width >= b.minWidth) ?? sorted[sorted.length - 1]
    if (!bp) return
    const r = parseInt(bp.color.slice(1, 3), 16)
    const g = parseInt(bp.color.slice(3, 5), 16)
    const b = parseInt(bp.color.slice(5, 7), 16)
    const textColor = (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff'
    el.textContent = `${bp.name} ≥${bp.minWidth}px | ${width}px`
    el.style.setProperty('background-color', bp.color + 'e6', 'important')
    el.style.setProperty('color', textColor, 'important')
    el.style.setProperty('border-color', textColor === '#fff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)', 'important')
  }

  const badge = existing ?? document.createElement('div')
  badge.id = BADGE_ID
  badge.setAttribute('style', baseStyle)
  render(badge)

  if (!existing) {
    // XML/SVG documents have no <body>.
    ;(document.body ?? document.documentElement).appendChild(badge)
  }

  if (!state.listening) {
    state.listening = true
    window.addEventListener('resize', () => {
      const el = document.getElementById(BADGE_ID)
      if (el) render(el)
    })
  }
}
