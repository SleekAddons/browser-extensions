import { browser } from 'wxt/browser'
import { DEFAULT_SETTINGS, getCurrentBreakpoint, isUrlAllowed } from '../lib/breakpoints'
import type { BadgePosition, BadgeSettings, BreakpointConfig } from '../lib/breakpoints'

const BADGE_ID = '__bp-viewer-badge__'

function positionStyles(position: BadgePosition): string {
  const base = 'position:fixed!important;z-index:2147483647!important;margin:12px!important;'
  switch (position) {
    case 'top-left':     return `${base}top:0!important;left:0!important;bottom:auto!important;right:auto!important;`
    case 'top-right':    return `${base}top:0!important;right:0!important;bottom:auto!important;left:auto!important;`
    case 'bottom-left':  return `${base}bottom:0!important;left:0!important;top:auto!important;right:auto!important;`
    case 'bottom-right': return `${base}bottom:0!important;right:0!important;top:auto!important;left:auto!important;`
  }
}

function createBadge(settings: BadgeSettings): HTMLElement {
  const badge = document.createElement('div')
  badge.id = BADGE_ID
  badge.setAttribute('style',
    positionStyles(settings.position) +
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
  )
  return badge
}

let activeBreakpoints: BreakpointConfig[] = DEFAULT_SETTINGS.breakpoints

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff'
}

function updateBadge(badge: HTMLElement) {
  const width = window.innerWidth
  const bp = getCurrentBreakpoint(width, activeBreakpoints)
  badge.textContent = `${bp.name} ≥${bp.minWidth}px | ${width}px`
  badge.style.setProperty('background-color', bp.color + 'e6', 'important')
  badge.style.setProperty('color', contrastColor(bp.color), 'important')
  badge.style.setProperty('border-color', contrastColor(bp.color) === '#fff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)', 'important')
}

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_idle',
  async main() {
    // Try local first (primary), fall back to sync (legacy migration)
    let result = await browser.storage.local.get('bpViewerSettings')
    if (!result.bpViewerSettings) {
      try { result = await browser.storage.sync.get('bpViewerSettings') } catch { /* sync may not be available */ }
    }
    const settings: BadgeSettings = { ...DEFAULT_SETTINGS, ...(result.bpViewerSettings as BadgeSettings | undefined) }

    if (settings.enabled && isUrlAllowed(location.href, settings.siteFilterMode ?? 'all', settings.sitePatterns ?? [])) {
      activeBreakpoints = settings.breakpoints ?? DEFAULT_SETTINGS.breakpoints

      // Don't double-insert
      if (!document.getElementById(BADGE_ID)) {
        const badge = createBadge(settings)
        document.body.appendChild(badge)
        updateBadge(badge)

        window.addEventListener('resize', () => updateBadge(badge))
      }
    }

    // Listen for settings changes from the popup (fires for both local & sync)
    browser.storage.onChanged.addListener((changes) => {
      if (!changes.bpViewerSettings) return
      const settings: BadgeSettings = (changes.bpViewerSettings.newValue as BadgeSettings) ?? DEFAULT_SETTINGS

      const existing = document.getElementById(BADGE_ID)

      if (!settings.enabled) {
        existing?.remove()
        return
      }

      if (!isUrlAllowed(location.href, settings.siteFilterMode ?? 'all', settings.sitePatterns ?? [])) {
        existing?.remove()
        return
      }

      activeBreakpoints = settings.breakpoints ?? DEFAULT_SETTINGS.breakpoints

      if (existing) {
        // Update position
        existing.setAttribute('style',
          positionStyles(settings.position) +
          existing.style.cssText.replace(/position:fixed.*?;(top|bottom|left|right):[^;]+;/g, '')
        )
        // Re-apply full styles
        const fresh = createBadge(settings)
        existing.setAttribute('style', fresh.getAttribute('style')!)
        updateBadge(existing)
      } else {
        const badge = createBadge(settings)
        document.body.appendChild(badge)
        updateBadge(badge)
        window.addEventListener('resize', () => updateBadge(badge))
      }
    })
  },
})
