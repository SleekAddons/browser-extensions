import { browser } from 'wxt/browser'

export interface BreakpointConfig {
  name: string
  minWidth: number
  color: string
}

export type PresetId = 'tailwind' | 'bootstrap' | 'bulma' | 'foundation' | 'custom'

export interface BreakpointPreset {
  id: Exclude<PresetId, 'custom'>
  label: string
  breakpoints: BreakpointConfig[]
}

export const PRESETS: BreakpointPreset[] = [
  {
    id: 'tailwind',
    label: 'Tailwind CSS',
    breakpoints: [
      { name: 'xs',  minWidth: 0,    color: '#6b7280' },
      { name: 'sm',  minWidth: 640,  color: '#22c55e' },
      { name: 'md',  minWidth: 768,  color: '#3b82f6' },
      { name: 'lg',  minWidth: 1024, color: '#a855f7' },
      { name: 'xl',  minWidth: 1280, color: '#f59e0b' },
      { name: '2xl', minWidth: 1536, color: '#ef4444' },
    ],
  },
  {
    id: 'bootstrap',
    label: 'Bootstrap',
    breakpoints: [
      { name: 'xs',  minWidth: 0,    color: '#6b7280' },
      { name: 'sm',  minWidth: 576,  color: '#22c55e' },
      { name: 'md',  minWidth: 768,  color: '#3b82f6' },
      { name: 'lg',  minWidth: 992,  color: '#a855f7' },
      { name: 'xl',  minWidth: 1200, color: '#f59e0b' },
      { name: 'xxl', minWidth: 1400, color: '#ef4444' },
    ],
  },
  {
    id: 'bulma',
    label: 'Bulma',
    breakpoints: [
      { name: 'mobile',   minWidth: 0,    color: '#6b7280' },
      { name: 'tablet',   minWidth: 769,  color: '#22c55e' },
      { name: 'desktop',  minWidth: 1024, color: '#3b82f6' },
      { name: 'widescreen', minWidth: 1216, color: '#a855f7' },
      { name: 'fullhd',   minWidth: 1408, color: '#f59e0b' },
    ],
  },
  {
    id: 'foundation',
    label: 'Foundation',
    breakpoints: [
      { name: 'small',  minWidth: 0,    color: '#6b7280' },
      { name: 'medium', minWidth: 640,  color: '#22c55e' },
      { name: 'large',  minWidth: 1024, color: '#3b82f6' },
      { name: 'xlarge', minWidth: 1200, color: '#a855f7' },
      { name: 'xxlarge', minWidth: 1440, color: '#f59e0b' },
    ],
  },
]

export const DEFAULT_BREAKPOINTS: BreakpointConfig[] = PRESETS[0].breakpoints

export type BadgePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export type SiteFilterMode = 'all' | 'allowlist' | 'blocklist'

export interface BadgeSettings {
  enabled: boolean
  position: BadgePosition
  preset: PresetId
  breakpoints: BreakpointConfig[]
  customBreakpoints: BreakpointConfig[] | null
  siteFilterMode: SiteFilterMode
  sitePatterns: string[]
}

export const DEFAULT_SETTINGS: BadgeSettings = {
  enabled: true,
  position: 'bottom-left',
  preset: 'tailwind',
  breakpoints: DEFAULT_BREAKPOINTS,
  customBreakpoints: null,
  siteFilterMode: 'all',
  sitePatterns: [],
}

export function getCurrentBreakpoint(width: number, breakpoints: BreakpointConfig[]): BreakpointConfig {
  const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth)
  return sorted.find((bp) => width >= bp.minWidth) ?? breakpoints[0]
}

export async function loadSettings(): Promise<BadgeSettings> {
  const result = await browser.storage.local.get('bpViewerSettings')
  if (!result.bpViewerSettings) {
    // Migrate from sync storage (used before Firefox fix) or old key
    try {
      const syncResult = await browser.storage.sync.get(['bpViewerSettings', 'twBreakpointSettings'])
      const legacy = syncResult.bpViewerSettings ?? syncResult.twBreakpointSettings
      if (legacy) {
        const migrated = { ...DEFAULT_SETTINGS, ...(legacy as BadgeSettings) }
        await browser.storage.local.set({ bpViewerSettings: migrated })
        await browser.storage.sync.remove(['bpViewerSettings', 'twBreakpointSettings']).catch(() => {})
        return migrated
      }
    } catch {
      // storage.sync might not be available in all Firefox configurations
    }
  }
  return { ...DEFAULT_SETTINGS, ...(result.bpViewerSettings as BadgeSettings | undefined) }
}

export async function saveSettings(settings: BadgeSettings): Promise<void> {
  await browser.storage.local.set({ bpViewerSettings: settings })
}

/**
 * Check if a URL should show the badge based on site filter settings.
 * Patterns are matched against the hostname (e.g. "example.com").
 * Supports wildcard `*` (e.g. "*.github.com", "*dev*").
 */
export function isUrlAllowed(url: string, mode: SiteFilterMode, patterns: string[]): boolean {
  if (mode === 'all') return true
  if (patterns.length === 0) return mode === 'blocklist'

  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return false
  }

  const matches = patterns.some((pattern) => {
    const regex = new RegExp(
      '^' + pattern.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      'i',
    )
    return regex.test(hostname)
  })

  return mode === 'allowlist' ? matches : !matches
}
