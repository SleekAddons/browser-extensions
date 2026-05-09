import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import type { BlockerSettings, BlockMode, BlockRule, BlockStats, DailyUsage, Schedule, TimeLimit, TrackingState } from './types'
import { DEFAULT_SETTINGS } from './types'
import {
  loadSettings,
  saveSettings,
  loadStats,
  loadUsage,
  loadTracking,
  clearStats as clearStatsStorage,
  clearAll as clearAllStorage,
} from './storage'

/** Normalize a raw input into a plain domain string. */
function cleanPattern(raw: string, autoIdentifyWww = true): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '')
    .replace(/^www\./, autoIdentifyWww ? '' : 'www.')
    .trim()
    .toLowerCase()
}

export function useWebsiteBlocker() {
  const [settings, setSettings] = useState<BlockerSettings>(DEFAULT_SETTINGS)
  const [stats, setStats] = useState<BlockStats>({})
  const [usage, setUsage] = useState<DailyUsage>({})
  const [tracking, setTracking] = useState<TrackingState | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Init ─────────────────────────────────────────────

  useEffect(() => {
    Promise.all([loadSettings(), loadStats(), loadUsage(), loadTracking()]).then(
      ([s, st, u, t]) => {
        setSettings(s)
        setStats(st)
        setUsage(u)
        setTracking(t)
        setLoading(false)
      },
    )
  }, [])

  // ── Live storage listener for tracking & usage ───────

  useEffect(() => {
    const handler = (changes: Record<string, any>) => {
      if (changes.wb_usage?.newValue) {
        setUsage(changes.wb_usage.newValue as DailyUsage)
      }
      if ('wb_tracking' in changes) {
        setTracking((changes.wb_tracking.newValue as TrackingState | undefined) ?? null)
      }
    }
    browser.storage.onChanged.addListener(handler)
    return () => browser.storage.onChanged.removeListener(handler)
  }, [])

  // ── Global ───────────────────────────────────────────

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setSettings((prev) => {
        const next = { ...prev, enabled }
        saveSettings(next)
        return next
      })
    },
    [],
  )

  const setMode = useCallback(
    (mode: BlockMode) => {
      setSettings((prev) => {
        const next = { ...prev, mode }
        saveSettings(next)
        return next
      })
    },
    [],
  )

  // ── Rules ────────────────────────────────────────────

  const addRule = useCallback((pattern: string, autoIdentifyWww = true) => {
    const cleaned = cleanPattern(pattern, autoIdentifyWww)
    if (!cleaned) return

    setSettings((prev) => {
      if (prev.rules.some((r) => r.pattern === cleaned)) return prev
      const newRule: BlockRule = {
        id: crypto.randomUUID(),
        pattern: cleaned,
        autoIdentifyWww,
        enabled: true,
        createdAt: Date.now(),
      }
      const next = { ...prev, rules: [...prev.rules, newRule] }
      saveSettings(next)
      return next
    })
  }, [])

  const updateRule = useCallback((id: string, pattern: string, autoIdentifyWww = true) => {
    const cleaned = cleanPattern(pattern, autoIdentifyWww)
    if (!cleaned) return

    setSettings((prev) => {
      if (prev.rules.some((r) => r.id !== id && r.pattern === cleaned)) return prev

      const previousRule = prev.rules.find((rule) => rule.id === id)
      if (!previousRule) return prev
      const previousPattern = previousRule.pattern

      const next = {
        ...prev,
        rules: prev.rules.map((rule) =>
          rule.id === id ? { ...rule, pattern: cleaned, autoIdentifyWww } : rule,
        ),
        limits: prev.limits.map((limit) =>
          limit.pattern === previousPattern ? { ...limit, pattern: cleaned } : limit,
        ),
        schedules: prev.schedules.map((schedule) => ({
          ...schedule,
          patterns: (schedule.patterns ?? []).map((item) =>
            item === previousPattern ? cleaned : item,
          ),
        })),
      }
      saveSettings(next)
      return next
    })
  }, [])

  const removeRule = useCallback((id: string) => {
    setSettings((prev) => {
      const removedRule = prev.rules.find((r) => r.id === id)
      const nextRules = prev.rules.filter((r) => r.id !== id)
      // Also remove any limits / schedule patterns referencing this domain
      const nextLimits = removedRule
        ? prev.limits.filter((l) => l.pattern !== removedRule.pattern)
        : prev.limits
      const nextSchedules = removedRule
        ? prev.schedules.map((s) => ({
            ...s,
            patterns: s.patterns.filter((p) => p !== removedRule.pattern),
          }))
        : prev.schedules
      const next = { ...prev, rules: nextRules, limits: nextLimits, schedules: nextSchedules }
      saveSettings(next)
      return next
    })
  }, [])

  const toggleRule = useCallback((id: string, enabled: boolean) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        rules: prev.rules.map((r) => (r.id === id ? { ...r, enabled } : r)),
      }
      saveSettings(next)
      return next
    })
  }, [])

  const addRules = useCallback((patterns: string[]) => {
    setSettings((prev) => {
      const existingPatterns = new Set(prev.rules.map((r) => r.pattern))
      const newRules: BlockRule[] = patterns
        .map((pattern) => cleanPattern(pattern, true))
        .filter((p) => p && !existingPatterns.has(p))
        .map((p) => ({
          id: crypto.randomUUID(),
          pattern: p,
          autoIdentifyWww: true,
          enabled: true,
          createdAt: Date.now(),
        }))

      if (newRules.length === 0) return prev

      const next = { ...prev, rules: [...prev.rules, ...newRules] }
      saveSettings(next)
      return next
    })
  }, [])

  // ── Limits ───────────────────────────────────────────

  const addLimit = useCallback((pattern: string, dailyMinutes: number) => {
    setSettings((prev) => {
      if (prev.limits.some((l) => l.pattern === pattern)) return prev
      const newLimit: TimeLimit = {
        id: crypto.randomUUID(),
        pattern,
        dailyMinutes,
        enabled: true,
      }
      const next = { ...prev, limits: [...prev.limits, newLimit] }
      saveSettings(next)
      return next
    })
  }, [])

  const removeLimit = useCallback((id: string) => {
    setSettings((prev) => {
      const next = { ...prev, limits: prev.limits.filter((l) => l.id !== id) }
      saveSettings(next)
      return next
    })
  }, [])

  const toggleLimit = useCallback((id: string, enabled: boolean) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        limits: prev.limits.map((l) => (l.id === id ? { ...l, enabled } : l)),
      }
      saveSettings(next)
      return next
    })
  }, [])

  const updateLimit = useCallback((id: string, dailyMinutes: number) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        limits: prev.limits.map((l) =>
          l.id === id ? { ...l, dailyMinutes } : l,
        ),
      }
      saveSettings(next)
      return next
    })
  }, [])

  // ── Schedules ────────────────────────────────────────

  const addSchedule = useCallback((schedule: Omit<Schedule, 'id'>) => {
    setSettings((prev) => {
      const newSchedule: Schedule = { ...schedule, id: crypto.randomUUID() }
      const next = { ...prev, schedules: [...prev.schedules, newSchedule] }
      saveSettings(next)
      return next
    })
  }, [])

  const removeSchedule = useCallback((id: string) => {
    setSettings((prev) => {
      const next = { ...prev, schedules: prev.schedules.filter((s) => s.id !== id) }
      saveSettings(next)
      return next
    })
  }, [])

  const toggleSchedule = useCallback((id: string, enabled: boolean) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        schedules: prev.schedules.map((s) =>
          s.id === id ? { ...s, enabled } : s,
        ),
      }
      saveSettings(next)
      return next
    })
  }, [])

  const updateSchedule = useCallback(
    (id: string, data: Omit<Schedule, 'id' | 'enabled'>) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          schedules: prev.schedules.map((s) =>
            s.id === id ? { ...s, ...data } : s,
          ),
        }
        saveSettings(next)
        return next
      })
    },
    [],
  )

  // ── Stats & Usage ────────────────────────────────────

  const clearStatsAction = useCallback(async () => {
    await clearStatsStorage()
    setStats({})
  }, [])

  const refreshStats = useCallback(async () => {
    const [fresh, freshUsage] = await Promise.all([loadStats(), loadUsage()])
    setStats(fresh)
    setUsage(freshUsage)
  }, [])

  // ── Import / Export / Reset ──────────────────────────

  const exportSettings = useCallback((): string => {
    return JSON.stringify(settings, null, 2)
  }, [settings])

  const importSettings = useCallback(async (data: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(data) as BlockerSettings
      if (!Array.isArray(parsed.rules)) return false
      const validated: BlockerSettings = {
        enabled: Boolean(parsed.enabled),
        mode: parsed.mode === 'allowlist' ? 'allowlist' : 'blocklist',
        rules: parsed.rules.map((rule) => ({
          ...rule,
          autoIdentifyWww: rule.autoIdentifyWww ?? true,
        })),
        limits: Array.isArray(parsed.limits) ? parsed.limits : [],
        schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      }
      await saveSettings(validated)
      setSettings(validated)
      return true
    } catch {
      return false
    }
  }, [])

  const resetAll = useCallback(async () => {
    await clearAllStorage()
    setSettings(DEFAULT_SETTINGS)
    setStats({})
    setUsage({})
  }, [])

  return {
    settings,
    stats,
    usage,
    tracking,
    loading,
    setEnabled,
    setMode,
    addRule,
    updateRule,
    removeRule,
    toggleRule,
    addRules,
    addLimit,
    removeLimit,
    toggleLimit,
    updateLimit,
    addSchedule,
    removeSchedule,
    toggleSchedule,
    updateSchedule,
    clearStats: clearStatsAction,
    refreshStats,
    exportSettings,
    importSettings,
    resetAll,
  }
}
