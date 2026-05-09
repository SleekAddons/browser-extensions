import { browser } from 'wxt/browser'
import type { BlockerSettings, BlockStats, DailyUsage, TrackingState } from './types'
import { DEFAULT_SETTINGS } from './types'

const SETTINGS_KEY = 'wb_settings'
const STATS_KEY = 'wb_stats'
const USAGE_KEY = 'wb_usage'
const TRACKING_KEY = 'wb_tracking'

// ── Settings ─────────────────────────────────────────────

export async function loadSettings(): Promise<BlockerSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY)
  const stored = result[SETTINGS_KEY] as BlockerSettings | undefined
  const normalizedRules = (stored?.rules ?? []).map((rule) => ({
    ...rule,
    autoIdentifyWww: rule.autoIdentifyWww ?? true,
  }))
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    rules: normalizedRules,
    limits: stored?.limits ?? [],
  }
}

export async function saveSettings(settings: BlockerSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings })
}

// ── Stats ────────────────────────────────────────────────

export async function loadStats(): Promise<BlockStats> {
  const result = await browser.storage.local.get(STATS_KEY)
  return (result[STATS_KEY] as BlockStats | undefined) ?? {}
}

export async function saveStats(stats: BlockStats): Promise<void> {
  await browser.storage.local.set({ [STATS_KEY]: stats })
}

export async function incrementStat(domain: string): Promise<void> {
  const stats = await loadStats()
  const existing = stats[domain]
  stats[domain] = {
    count: (existing?.count ?? 0) + 1,
    lastBlocked: Date.now(),
  }
  await saveStats(stats)
}

export async function clearStats(): Promise<void> {
  await browser.storage.local.remove(STATS_KEY)
}

// ── Daily Usage ──────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function loadUsage(): Promise<DailyUsage> {
  const result = await browser.storage.local.get(USAGE_KEY)
  return (result[USAGE_KEY] as DailyUsage | undefined) ?? {}
}

export async function saveUsage(usage: DailyUsage): Promise<void> {
  await browser.storage.local.set({ [USAGE_KEY]: usage })
}

/** Add seconds to a domain's daily usage, resetting if day changed. */
export async function addUsage(domain: string, seconds: number): Promise<DailyUsage> {
  const usage = await loadUsage()
  const today = todayStr()
  const existing = usage[domain]

  if (existing && existing.date === today) {
    usage[domain] = {
      seconds: existing.seconds + seconds,
      visits: existing.visits ?? 0,
      date: today,
    }
  } else {
    usage[domain] = { seconds, visits: 0, date: today }
  }

  await saveUsage(usage)
  return usage
}

export async function clearUsage(): Promise<void> {
  await browser.storage.local.remove(USAGE_KEY)
}

// ── Tracking State ───────────────────────────────────────

export async function loadTracking(): Promise<TrackingState | null> {
  const result = await browser.storage.local.get(TRACKING_KEY)
  return (result[TRACKING_KEY] as TrackingState | undefined) ?? null
}

export async function saveTracking(state: TrackingState | null): Promise<void> {
  if (state) {
    await browser.storage.local.set({ [TRACKING_KEY]: state })
  } else {
    await browser.storage.local.remove(TRACKING_KEY)
  }
}

// ── Reset All ────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  await browser.storage.local.remove([SETTINGS_KEY, STATS_KEY, USAGE_KEY, TRACKING_KEY])
}
