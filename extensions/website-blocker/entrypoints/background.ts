import { browser } from 'wxt/browser'

const SETTINGS_KEY = 'wb_settings'
const USAGE_KEY = 'wb_usage'
const TRACKING_KEY = 'wb_tracking'

interface StoredRule {
  id: string
  pattern: string
  autoIdentifyWww?: boolean
  enabled: boolean
}

interface StoredLimit {
  id: string
  pattern: string
  dailyMinutes: number
  enabled: boolean
}

interface StoredSchedule {
  id: string
  days: number[]
  startTime: string
  endTime: string
  patterns: string[]
  enabled: boolean
}

interface StoredSettings {
  enabled: boolean
  mode: 'blocklist' | 'allowlist'
  rules: StoredRule[]
  limits: StoredLimit[]
  schedules: StoredSchedule[]
}

interface UsageEntry {
  seconds: number
  visits: number
  date: string
}

type DailyUsage = Record<string, UsageEntry>

interface TrackingState {
  domain: string
  startedAt: number
  tabId?: number
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function cleanPattern(raw: string, autoIdentifyWww = true): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '')
    .replace(/^www\./i, autoIdentifyWww ? '' : 'www.')
    .trim()
    .toLowerCase()
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRuleRegex(rule: StoredRule): string | null {
  const autoIdentifyWww = rule.autoIdentifyWww ?? true
  const cleaned = cleanPattern(rule.pattern, autoIdentifyWww)
  if (!cleaned) return null
  const escapedPattern = escapeRegex(cleaned)
  const hostPart = autoIdentifyWww ? `(?:www\\.)?${escapedPattern}` : escapedPattern
  return `^https?://${hostPart}(?::\\d+)?(?:[/?#]|$)`
}

type ScheduleResult = { active: true; reason: 'blocked' | 'schedule' } | { active: false }

/** Check whether a specific domain is within any applicable schedule window. */
function isDomainInSchedule(domain: string, schedules: StoredSchedule[]): ScheduleResult {
  const active = schedules.filter((s) => s.enabled)
  if (active.length === 0) return { active: true, reason: 'blocked' } // no schedules → always active

  const now = new Date()
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()

  // Schedules that apply to this domain (either no patterns = global, or pattern matches)
  const applicable = active.filter(
    (s) => !s.patterns || s.patterns.length === 0 || s.patterns.includes(domain),
  )

  if (applicable.length === 0) return { active: true, reason: 'blocked' } // no applicable schedules → always active

  const inWindow = applicable.some((s) => {
    if (!s.days.includes(day)) return false
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    const start = sh * 60 + sm
    const end = eh * 60 + em
    // Handle overnight schedules (e.g. 22:00 → 06:00)
    if (start > end) {
      return mins >= start || mins <= end
    }
    return mins >= start && mins <= end
  })

  return inWindow ? { active: true, reason: 'schedule' } : { active: false }
}

/** Check whether a domain has exceeded its daily time limit. */
function isDomainOverLimit(
  domain: string,
  limits: StoredLimit[],
  usage: DailyUsage,
  tracking: TrackingState | null,
): boolean {
  const today = todayStr()
  const limit = limits.find((l) => l.enabled && l.pattern === domain)
  if (!limit) return false // no limit → not over

  const entry = usage[domain]
  let totalSeconds = entry && entry.date === today ? entry.seconds : 0

  // Include un-flushed tracking time for the currently tracked domain
  if (tracking && tracking.domain === domain) {
    totalSeconds += Math.floor((Date.now() - tracking.startedAt) / 1000)
  }

  return totalSeconds >= limit.dailyMinutes * 60
}

/** Build the set of declarativeNetRequest rules from current settings & usage. */
function buildDynamicRules(
  settings: StoredSettings,
  usage: DailyUsage,
  tracking: TrackingState | null,
): any[] {
  const activeRules = settings.rules.filter((r) => r.enabled)
  const limits = settings.limits ?? []
  const schedules = settings.schedules ?? []
  const addRules: any[] = []
  let ruleId = 1

  if (settings.mode === 'blocklist') {
    for (const rule of activeRules) {
      const regexFilter = buildRuleRegex(rule)
      if (!regexFilter) continue

      const scheduleResult = isDomainInSchedule(rule.pattern, schedules)
      const overLimit = isDomainOverLimit(rule.pattern, limits, usage, tracking)
      const hasActiveLimit = limits.some((l) => l.enabled && l.pattern === rule.pattern)

      // Sites with a time limit: block only when the daily limit is exceeded
      // Sites without a time limit: block based on schedule (always if no schedules)
      if ((scheduleResult.active && !hasActiveLimit) || overLimit) {
        const reason = overLimit ? 'limit' : scheduleResult.active ? scheduleResult.reason : 'blocked'
        addRules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              url: browser.runtime.getURL(`/blocked.html?domain=${encodeURIComponent(rule.pattern)}&reason=${reason}`),
            },
          },
          condition: {
            regexFilter,
            resourceTypes: ['main_frame'],
          },
        })
      }
    }
  } else {
    // Allowlist mode: block everything, then allow listed domains.
    // Schedules control WHEN the allowlist restriction is enforced.
    // Outside all schedule windows everything is accessible.
    // Enforce the allowlist when there are no schedules (always) or during a schedule window
    const enforceAllowlist = getAllowlistEnforcementState(schedules)

    if (enforceAllowlist) {
      addRules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { url: browser.runtime.getURL('/blocked.html?domain=not-allowed&reason=allowlist') },
        },
        condition: {
          urlFilter: '*',
          resourceTypes: ['main_frame'],
        },
      })

      for (const rule of activeRules) {
        const regexFilter = buildRuleRegex(rule)
        if (!regexFilter) continue

        const overLimit = isDomainOverLimit(rule.pattern, limits, usage, tracking)
        if (!overLimit) {
          addRules.push({
            id: ruleId++,
            priority: 2,
            action: { type: 'allow' },
            condition: {
              regexFilter,
              resourceTypes: ['main_frame'],
            },
          })
        }
      }
    } else {
      // Outside all schedule windows — don't enforce allowlist.
      // Still block any domain that's over its time limit.
      for (const rule of activeRules) {
        const regexFilter = buildRuleRegex(rule)
        if (!regexFilter) continue

        const overLimit = isDomainOverLimit(rule.pattern, limits, usage, tracking)
        if (overLimit) {
          addRules.push({
            id: ruleId++,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: {
                url: browser.runtime.getURL(`/blocked.html?domain=${encodeURIComponent(rule.pattern)}&reason=limit`),
              },
            },
            condition: {
              regexFilter,
              resourceTypes: ['main_frame'],
            },
          })
        }
      }
    }
  }

  return addRules
}

let blockingQueue: Promise<void> = Promise.resolve()

function queueBlockingUpdate(task: () => Promise<void>): Promise<void> {
  blockingQueue = blockingQueue.then(task, task)
  return blockingQueue
}

/** Rebuild all declarativeNetRequest dynamic rules from current settings. */
async function updateBlockingRules() {
  await queueBlockingUpdate(async () => {
    const result = await browser.storage.local.get([SETTINGS_KEY, USAGE_KEY, TRACKING_KEY])
    const settings = result[SETTINGS_KEY] as StoredSettings | undefined
    const usage = (result[USAGE_KEY] as DailyUsage | undefined) ?? {}
    const tracking = (result[TRACKING_KEY] as TrackingState | undefined) ?? null

    const addRules = settings?.enabled ? buildDynamicRules(settings, usage, tracking) : []

    // Apply declarativeNetRequest rules (best-effort).
    // Firefox MV2 may not fully support the redirect action type depending on
    // browser version; failures here must not prevent tab-based enforcement.
    try {
      const existing = await browser.declarativeNetRequest.getDynamicRules()
      const removeRuleIds = existing.map((r) => r.id)
      await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules })
    } catch {
      // declarativeNetRequest unavailable or unsupported action — continue
    }

    // Always enforce blocking on currently open tabs regardless of
    // whether declarativeNetRequest succeeded. This is the primary
    // enforcement mechanism for already-loaded pages and acts as a
    // fallback for browsers where declarativeNetRequest redirect is
    // not fully supported (e.g. older Firefox versions).
    if (settings?.enabled) {
      await enforceBlockingOnOpenTabs(settings, usage, tracking)
    }
  })
}

// ── Usage tracking ─────────────────────────────────────────

/** Extract a domain from a URL, returning null for non-http(s) URLs. */
function extractDomain(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

function normalizeDomain(input: string, autoIdentifyWww: boolean): string {
  const trimmed = input.trim().toLowerCase()
  return autoIdentifyWww ? trimmed.replace(/^www\./, '') : trimmed
}

/** Check whether a domain matches any rule (exact host, optional www auto-match). */
function domainMatchesRule(domain: string, rules: StoredRule[]): StoredRule | undefined {
  const normalizedDomain = domain.trim().toLowerCase()

  return rules.find((rule) => {
    if (!rule.enabled) return false
    const autoIdentifyWww = rule.autoIdentifyWww ?? true
    const normalizedPattern = cleanPattern(rule.pattern, autoIdentifyWww)
    if (!normalizedPattern) return false
    return normalizeDomain(normalizedDomain, autoIdentifyWww) === normalizeDomain(normalizedPattern, autoIdentifyWww)
  })
}

function getAllowlistEnforcementState(schedules: StoredSchedule[]): boolean {
  const activeSchedules = schedules.filter((s) => s.enabled)
  const hasSchedules = activeSchedules.length > 0

  if (!hasSchedules) return true

  const now = new Date()
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()

  return activeSchedules.some((s) => {
    if (!s.days.includes(day)) return false
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    const start = sh * 60 + sm
    const end = eh * 60 + em
    if (start > end) return mins >= start || mins <= end
    return mins >= start && mins <= end
  })
}

interface BlockDecision {
  blocked: boolean
  domain?: string
  reason?: 'blocked' | 'schedule' | 'limit' | 'allowlist'
}

function evaluateTabBlocking(
  domain: string,
  settings: StoredSettings,
  usage: DailyUsage,
  tracking: TrackingState | null,
): BlockDecision {
  const activeRules = settings.rules.filter((r) => r.enabled)
  const limits = settings.limits ?? []
  const schedules = settings.schedules ?? []

  if (settings.mode === 'blocklist') {
    const matchedRule = domainMatchesRule(domain, activeRules)
    if (!matchedRule) return { blocked: false }

    const scheduleResult = isDomainInSchedule(matchedRule.pattern, schedules)
    const overLimit = isDomainOverLimit(matchedRule.pattern, limits, usage, tracking)
    const hasActiveLimit = limits.some((l) => l.enabled && l.pattern === matchedRule.pattern)

    if ((scheduleResult.active && !hasActiveLimit) || overLimit) {
      return {
        blocked: true,
        domain: matchedRule.pattern,
        reason: overLimit ? 'limit' : scheduleResult.active ? scheduleResult.reason : 'blocked',
      }
    }

    return { blocked: false }
  }

  const enforceAllowlist = getAllowlistEnforcementState(schedules)
  const matchedRule = domainMatchesRule(domain, activeRules)

  if (enforceAllowlist) {
    if (!matchedRule) {
      return {
        blocked: true,
        domain: 'not-allowed',
        reason: 'allowlist',
      }
    }

    const overLimit = isDomainOverLimit(matchedRule.pattern, limits, usage, tracking)
    if (overLimit) {
      return {
        blocked: true,
        domain: matchedRule.pattern,
        reason: 'limit',
      }
    }

    return { blocked: false }
  }

  if (matchedRule && isDomainOverLimit(matchedRule.pattern, limits, usage, tracking)) {
    return {
      blocked: true,
      domain: matchedRule.pattern,
      reason: 'limit',
    }
  }

  return { blocked: false }
}

async function enforceBlockingOnOpenTabs(
  settings: StoredSettings,
  usage: DailyUsage,
  tracking: TrackingState | null,
): Promise<void> {
  const tabs = await browser.tabs.query({})
  const blockedPrefix = browser.runtime.getURL('/blocked.html')

  await Promise.all(
    tabs.map(async (tab) => {
      if (typeof tab.id !== 'number' || !tab.url) return
      if (tab.url.startsWith(blockedPrefix)) return

      const domain = extractDomain(tab.url)
      if (!domain) return

      const decision = evaluateTabBlocking(domain, settings, usage, tracking)
      if (!decision.blocked || !decision.reason || !decision.domain) return

      const target = browser.runtime.getURL(
        `/blocked.html?domain=${encodeURIComponent(decision.domain)}&reason=${decision.reason}`,
      )

      try {
        await browser.tabs.update(tab.id, { url: target })
      } catch {
        // Some tabs cannot be updated (e.g. browser internal pages).
      }
    }),
  )
}

interface NextTrackingTarget {
  domain: string
  tabId: number
}

/**
 * Resolve a raw domain into a trackable rule pattern.
 * Returns null when the domain should not be tracked.
 */
function resolveTrackableDomain(domain: string, settings?: StoredSettings): string | null {
  if (!settings?.enabled) return null
  const matchedRule = domainMatchesRule(domain, settings.rules)
  if (!matchedRule) return null
  return matchedRule.pattern
}

/**
 * Flush elapsed tracking time and set the next tracking state.
 * Serialized via queueTrackingUpdate to prevent concurrent storage races.
 */
async function flushAndTrackTarget(next: NextTrackingTarget | null): Promise<void> {
  const res = await browser.storage.local.get([SETTINGS_KEY, USAGE_KEY, TRACKING_KEY])
  const settings = res[SETTINGS_KEY] as StoredSettings | undefined
  const usage = (res[USAGE_KEY] as DailyUsage | undefined) ?? {}
  const rawTracking = (res[TRACKING_KEY] as TrackingState | undefined) ?? null
  const tracking = rawTracking
    ? {
        ...rawTracking,
        tabId: typeof rawTracking.tabId === 'number' ? rawTracking.tabId : undefined,
      }
    : null

  const today = todayStr()

  if (tracking && settings?.enabled) {
    const elapsed = Math.floor((Date.now() - tracking.startedAt) / 1000)
    if (elapsed > 0) {
      const existing = usage[tracking.domain]
      if (existing && existing.date === today) {
        usage[tracking.domain] = {
          seconds: existing.seconds + elapsed,
          visits: existing.visits ?? 0,
          date: today,
        }
      } else {
        usage[tracking.domain] = { seconds: elapsed, visits: 0, date: today }
      }
    }
  }

  const isNewVisit = Boolean(
    next &&
      (!tracking ||
        tracking.domain !== next.domain ||
        tracking.tabId !== next.tabId),
  )

  if (next && isNewVisit) {
    const existing = usage[next.domain]
    if (existing && existing.date === today) {
      usage[next.domain] = {
        seconds: existing.seconds,
        visits: (existing.visits ?? 0) + 1,
        date: today,
      }
    } else {
      usage[next.domain] = {
        seconds: existing?.date === today ? existing.seconds : 0,
        visits: 1,
        date: today,
      }
    }
  }

  const updates: Record<string, any> = {
    [USAGE_KEY]: usage,
    [TRACKING_KEY]: next
      ? {
          domain: next.domain,
          startedAt: Date.now(),
          tabId: next.tabId,
        }
      : null,
  }

  await browser.storage.local.set(updates)

  // Schedule a precise timer for the tracked domain's limit expiry
  scheduleLimitCheck(next?.domain ?? null, settings, usage)
}

let trackingQueue: Promise<void> = Promise.resolve()

function queueTrackingUpdate(task: () => Promise<void>): Promise<void> {
  trackingQueue = trackingQueue.then(task, task)
  return trackingQueue
}

// ── Precise limit-expiry scheduling ────────────────────────

let limitCheckTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Schedule a precise check for when the currently-tracked domain's time
 * limit will be exceeded. Uses setTimeout for sub-minute precision while
 * the service worker is alive, plus a browser alarm as a fallback that
 * survives worker restarts.
 */
function scheduleLimitCheck(
  nextDomain: string | null,
  settings: StoredSettings | undefined,
  usage: DailyUsage,
): void {
  // Clear any existing timer / one-shot alarm
  if (limitCheckTimer) {
    clearTimeout(limitCheckTimer)
    limitCheckTimer = null
  }
  browser.alarms.clear('wb-limit-expiry').catch(() => {})

  if (!nextDomain || !settings?.enabled) return

  const limits = settings.limits?.filter((l) => l.enabled) ?? []
  const activeLimit = limits.find((l) => l.pattern === nextDomain)
  if (!activeLimit) return

  const today = todayStr()
  const entry = usage[nextDomain]
  const usedSeconds = entry && entry.date === today ? entry.seconds : 0
  const limitSeconds = activeLimit.dailyMinutes * 60
  const remainingSeconds = limitSeconds - usedSeconds

  if (remainingSeconds <= 0) {
    // Already exceeded — trigger enforcement immediately
    updateBlockingRules()
    return
  }

  // Add a small buffer so the check fires just after the threshold
  const delayMs = remainingSeconds * 1000 + 500

  // setTimeout is precise but lost if the service worker restarts
  limitCheckTimer = setTimeout(async () => {
    limitCheckTimer = null
    await updateTracking()
    updateBlockingRules()
  }, delayMs)

  // browser.alarms survive restarts (min ~30 s in Chrome)
  if (delayMs > 30_000) {
    browser.alarms.create('wb-limit-expiry', { when: Date.now() + delayMs }).catch(() => {})
  }
}

/** Check the active tab and update tracking accordingly. */
async function updateTracking(): Promise<void> {
  await queueTrackingUpdate(async () => {
    try {
      const [activeTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
      const activeTabId = typeof activeTab?.id === 'number' ? activeTab.id : null
      const activeDomain = activeTab?.url ? extractDomain(activeTab.url) : null

      const res = await browser.storage.local.get([SETTINGS_KEY, TRACKING_KEY])
      const settings = res[SETTINGS_KEY] as StoredSettings | undefined
      const rawCurrent = (res[TRACKING_KEY] as TrackingState | undefined) ?? null
      const current = rawCurrent
        ? {
            ...rawCurrent,
            tabId: typeof rawCurrent.tabId === 'number' ? rawCurrent.tabId : undefined,
          }
        : null

      let next: NextTrackingTarget | null = null
      if (activeDomain && activeTabId !== null) {
        const trackableDomain = resolveTrackableDomain(activeDomain, settings)
        if (trackableDomain) {
          next = { domain: trackableDomain, tabId: activeTabId }
        }
      }

      if (!current && !next) return

      // Always flush current interval before setting the next target, even when
      // staying on the same domain. This guarantees persisted usage keeps moving.
      await flushAndTrackTarget(next)
    } catch {
      await flushAndTrackTarget(null)
    }
  })
}

export default defineBackground(() => {
  // Apply rules on service worker startup
  updateBlockingRules()
  updateTracking()

  // Re-apply whenever settings, usage, or tracking state change.
  // Including TRACKING_KEY guarantees enforcement runs after every
  // tracking flush, even when the serialised usage value is identical.
  browser.storage.onChanged.addListener((changes) => {
    if (changes[SETTINGS_KEY] || changes[USAGE_KEY] || changes[TRACKING_KEY]) {
      updateBlockingRules()
    }
    // Start/stop tracking immediately when limits are added or removed
    if (changes[SETTINGS_KEY]) {
      updateTracking()
    }
  })

  // Periodic flush & rule check (every minute)
  browser.alarms.create('wb-schedule-check', { periodInMinutes: 1 })
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'wb-schedule-check' || alarm.name === 'wb-limit-expiry') {
      await updateTracking()
      updateBlockingRules()
    }
  })

  // Track tab switches — also run enforcement so schedule / limit
  // changes that occurred while the tab was in the background are
  // applied immediately when the user returns to it.
  browser.tabs.onActivated.addListener(() => {
    updateTracking().then(() => updateBlockingRules())
  })

  // Track window focus changes
  browser.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      // All windows lost focus — flush tracking
      updateTracking()
    } else {
      updateTracking().then(() => updateBlockingRules())
    }
  })

  // Track navigation within a tab (user navigates to a different site)
  browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) {
      updateTracking().then(() => updateBlockingRules())
    }
  })

  // Handle closing tabs (including active tab) so tracking is flushed promptly.
  browser.tabs.onRemoved.addListener(() => {
    updateTracking().then(() => updateBlockingRules())
  })
})
