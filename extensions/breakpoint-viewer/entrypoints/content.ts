import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { DEFAULT_SETTINGS, isUrlAllowed } from '../lib/breakpoints'
import type { BadgeSettings } from '../lib/breakpoints'
import { applyBadge } from '../lib/inject'

const STORAGE_KEY = 'bpViewerSettings'

function render(stored: Partial<BadgeSettings> | undefined) {
  const settings: BadgeSettings = { ...DEFAULT_SETTINGS, ...stored }
  const visible =
    settings.enabled && isUrlAllowed(location.href, settings.siteFilterMode, settings.sitePatterns)
  applyBadge(visible, settings.position, settings.breakpoints)
}

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_idle',
  async main() {
    // Try local first (primary), fall back to sync (legacy, migrated by the popup)
    let result = await browser.storage.local.get(STORAGE_KEY)
    if (!result[STORAGE_KEY]) {
      try { result = await browser.storage.sync.get(STORAGE_KEY) } catch { /* sync may not be available */ }
    }
    render(result[STORAGE_KEY] as Partial<BadgeSettings> | undefined)

    // Settings live in storage.local. Changes in other areas are ignored: the
    // one-time migration deletes the legacy copy from storage.sync, which
    // would otherwise look like a reset to the default settings.
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) return
      render(changes[STORAGE_KEY].newValue as Partial<BadgeSettings> | undefined)
    })
  },
})
