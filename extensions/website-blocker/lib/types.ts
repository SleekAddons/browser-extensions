/** Blocking mode: block listed sites, or allow only listed sites */
export type BlockMode = 'blocklist' | 'allowlist'

/** A single blocked/allowed domain rule */
export interface BlockRule {
  id: string
  /** Domain pattern, e.g. "reddit.com" */
  pattern: string
  /** When true, rule matches both www and non-www hostnames */
  autoIdentifyWww: boolean
  enabled: boolean
  createdAt: number
}

/** A daily time limit for a specific domain */
export interface TimeLimit {
  id: string
  /** Domain this limit applies to (must match a rule pattern) */
  pattern: string
  /** Allowed minutes per day */
  dailyMinutes: number
  enabled: boolean
}

/** A time-based schedule for when blocking is active, optionally per-site */
export interface Schedule {
  id: string
  name: string
  /** Days of the week: 0=Sun, 1=Mon … 6=Sat */
  days: number[]
  /** Start time in "HH:mm" format */
  startTime: string
  /** End time in "HH:mm" format */
  endTime: string
  /** If set, schedule only applies to these domains. Empty/undefined = all sites. */
  patterns: string[]
  enabled: boolean
}

/** Aggregated block stats for a single domain */
export interface BlockStatEntry {
  count: number
  lastBlocked: number
}

/** Domain → stats mapping */
export type BlockStats = Record<string, BlockStatEntry>

/** Per-domain daily usage tracking (seconds spent today) */
export interface UsageEntry {
  /** Seconds accumulated today */
  seconds: number
  /** Number of visits tracked today */
  visits: number
  /** Date string "YYYY-MM-DD" for the current tracking day */
  date: string
}

/** Domain → usage mapping */
export type DailyUsage = Record<string, UsageEntry>

/** Real-time tracking state persisted by the background script */
export interface TrackingState {
  /** Domain currently being tracked */
  domain: string
  /** Timestamp (ms) when tracking started for the current interval */
  startedAt: number
  /** Active tab id currently owning this tracking interval */
  tabId?: number
}

/** Persisted blocker settings (excluding stats) */
export interface BlockerSettings {
  enabled: boolean
  mode: BlockMode
  rules: BlockRule[]
  limits: TimeLimit[]
  schedules: Schedule[]
}

export const DEFAULT_SETTINGS: BlockerSettings = {
  enabled: true,
  mode: 'blocklist',
  rules: [],
  limits: [],
  schedules: [],
}
