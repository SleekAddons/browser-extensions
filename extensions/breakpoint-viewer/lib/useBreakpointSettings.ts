import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_BREAKPOINTS, DEFAULT_SETTINGS, PRESETS, loadSettings, saveSettings } from './breakpoints'
import type { BadgeSettings, BadgePosition, BreakpointConfig, PresetId, SiteFilterMode } from './breakpoints'
import { injectBadge } from './inject'

export function useBreakpointSettings() {
  const [settings, setSettings] = useState<BadgeSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setSettings(s)
        setLoaded(true)
      })
      .catch(() => {
        // Fall back to defaults if storage fails
        setLoaded(true)
      })
  }, [])

  // Push badge to active tab whenever settings change
  useEffect(() => {
    if (!loaded) return
    injectBadge(settings)
  }, [loaded, settings])

  const update = useCallback((patch: Partial<BadgeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const updateBreakpoint = useCallback((index: number, patch: Partial<BreakpointConfig>) => {
    setSettings((prev) => {
      const breakpoints = prev.breakpoints.map((bp, i) =>
        i === index ? { ...bp, ...patch } : bp
      )
      const next = { ...prev, preset: 'custom' as PresetId, breakpoints, customBreakpoints: breakpoints }
      saveSettings(next)
      return next
    })
  }, [])

  const addBreakpoint = useCallback(() => {
    setSettings((prev) => {
      const maxWidth = Math.max(...prev.breakpoints.map((b) => b.minWidth))
      const breakpoints = [...prev.breakpoints, { name: 'new', minWidth: maxWidth + 100, color: '#000000' }]
      const next = { ...prev, preset: 'custom' as PresetId, breakpoints, customBreakpoints: breakpoints }
      saveSettings(next)
      return next
    })
  }, [])

  const removeBreakpoint = useCallback((index: number) => {
    setSettings((prev) => {
      const breakpoints = prev.breakpoints.filter((_, i) => i !== index)
      const next = { ...prev, preset: 'custom' as PresetId, breakpoints, customBreakpoints: breakpoints }
      saveSettings(next)
      return next
    })
  }, [])

  const resetBreakpoints = useCallback(() => {
    setSettings((prev) => {
      const preset = PRESETS.find((p) => p.id === prev.preset)
      const breakpoints = preset ? preset.breakpoints : DEFAULT_BREAKPOINTS
      const next = { ...prev, breakpoints }
      saveSettings(next)
      return next
    })
  }, [])

  const selectPreset = useCallback((presetId: PresetId) => {
    setSettings((prev) => {
      if (presetId === 'custom') {
        // Restore saved custom breakpoints, or keep current ones
        const breakpoints = prev.customBreakpoints ?? prev.breakpoints
        const next = { ...prev, preset: presetId, breakpoints, customBreakpoints: breakpoints }
        saveSettings(next)
        return next
      }
      const preset = PRESETS.find((p) => p.id === presetId)
      if (!preset) return prev
      const next = { ...prev, preset: presetId, breakpoints: preset.breakpoints }
      saveSettings(next)
      return next
    })
  }, [])

  const addSitePattern = useCallback(() => {
    setSettings((prev) => {
      const sitePatterns = [...prev.sitePatterns, '']
      const next = { ...prev, sitePatterns }
      saveSettings(next)
      return next
    })
  }, [])

  const updateSitePattern = useCallback((index: number, value: string) => {
    setSettings((prev) => {
      const sitePatterns = prev.sitePatterns.map((p, i) => i === index ? value : p)
      const next = { ...prev, sitePatterns }
      saveSettings(next)
      return next
    })
  }, [])

  const removeSitePattern = useCallback((index: number) => {
    setSettings((prev) => {
      const sitePatterns = prev.sitePatterns.filter((_, i) => i !== index)
      const next = { ...prev, sitePatterns }
      saveSettings(next)
      return next
    })
  }, [])

  return {
    settings,
    loaded,
    update,
    selectPreset,
    updateBreakpoint,
    addBreakpoint,
    removeBreakpoint,
    resetBreakpoints,
    addSitePattern,
    updateSitePattern,
    removeSitePattern,
  } as const
}

export type { BadgeSettings, BadgePosition, BreakpointConfig, PresetId, SiteFilterMode }
