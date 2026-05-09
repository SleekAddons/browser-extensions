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
 * Runs in the page context via chrome.scripting.executeScript.
 * Must be self-contained - no imports or closures.
 */
function applyBadge(
  enabled: boolean,
  position: string,
  breakpoints: BreakpointConfig[],
) {
  const BADGE_ID = '__bp-viewer-badge__'
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

  const badge = existing ?? document.createElement('div')
  badge.id = BADGE_ID
  badge.setAttribute('style', baseStyle)

  const width = window.innerWidth
  const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth)
  const bp = sorted.find((b) => width >= b.minWidth) ?? breakpoints[0]
  badge.textContent = `${bp.name} ≥${bp.minWidth}px | ${width}px`
  badge.style.setProperty('background-color', bp.color + 'e6', 'important')
  const txtColor = (r: number, g: number, b: number) => (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff'
  const toRgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const
  const [r, g, b] = toRgb(bp.color)
  badge.style.setProperty('color', txtColor(r, g, b), 'important')
  badge.style.setProperty('border-color', txtColor(r, g, b) === '#fff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)', 'important')

  if (!existing) {
    document.body.appendChild(badge)

    // Tag the resize listener so we don't add duplicates
    if (!(window as unknown as Record<string, boolean>).__bpViewerResize) {
      (window as unknown as Record<string, boolean>).__bpViewerResize = true
      window.addEventListener('resize', () => {
        const el = document.getElementById(BADGE_ID)
        if (!el) return
        const w = window.innerWidth
        const s = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth)
        const b = s.find((x) => w >= x.minWidth) ?? breakpoints[0]
        el.textContent = `${b.name} ≥${b.minWidth}px | ${w}px`
        el.style.setProperty('background-color', b.color + 'e6', 'important')
        const [cr, cg, cb] = [parseInt(b.color.slice(1, 3), 16), parseInt(b.color.slice(3, 5), 16), parseInt(b.color.slice(5, 7), 16)]
        const tc = (cr * 299 + cg * 587 + cb * 114) / 1000 > 150 ? '#000' : '#fff'
        el.style.setProperty('color', tc, 'important')
        el.style.setProperty('border-color', tc === '#fff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)', 'important')
      })
    }
  }
}
