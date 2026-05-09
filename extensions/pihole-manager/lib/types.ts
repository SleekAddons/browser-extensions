/** A saved Pi-hole instance configuration */
export interface PiholeInstance {
  /** Unique identifier */
  id: string
  /** Display name for this instance */
  name: string
  /** Base URL of the Pi-hole (e.g. https://pi.hole) */
  baseUrl: string
  /** API password (stored in chrome.storage.local) */
  password: string
}

/** Session info returned after authentication */
export interface PiholeSession {
  valid: boolean
  totp: boolean
  sid: string | null
  csrf: string | null
  validity: number
  message: string | null
}

/** Summary stats from /api/stats/summary */
export interface PiholeSummary {
  queries: {
    total: number
    blocked: number
    percent_blocked: number
    unique_domains: number
    forwarded: number
    cached: number
    frequency: number
  }
  clients: {
    active: number
    total: number
  }
  gravity: {
    domains_being_blocked: number
    last_update: number
  }
}

/** Blocking status from /api/dns/blocking */
export interface PiholeBlockingStatus {
  blocking: 'enabled' | 'disabled' | 'failed' | 'unknown'
  timer: number | null
}

/** A single data point from /api/history */
export interface PiholeHistoryEntry {
  timestamp: number
  total: number
  cached: number
  blocked: number
  forwarded: number
}

/** A domain entry from /api/search/{domain} */
export interface DomainEntry {
  domain: string
  type: 'allow' | 'deny'
  kind: 'exact' | 'regex'
  enabled: boolean
  comment: string | null
}

/** A gravity (list) match from /api/search/{domain} */
export interface GravityEntry {
  domain: string
  address: string
  type: 'allow' | 'block'
  enabled: boolean
  comment: string | null
}

/** Result from searching a domain across Pi-hole's lists */
export interface DomainSearchResult {
  domains: DomainEntry[]
  gravity: GravityEntry[]
  totalMatches: number
}

/** Current domain status for the active tab */
export interface DomainStatus {
  domain: string
  search: DomainSearchResult | null
  loading: boolean
}

/** State for a connected Pi-hole instance */
export interface PiholeInstanceState {
  instance: PiholeInstance
  session: PiholeSession | null
  summary: PiholeSummary | null
  blocking: PiholeBlockingStatus | null
  history: PiholeHistoryEntry[] | null
  domainStatus: DomainStatus | null
  loading: boolean
  error: string | null
  /** Epoch ms of the last successful data fetch */
  lastRefreshedAt: number | null
  /** Epoch ms when blocking will be re-enabled (null if not on a timer) */
  disabledUntil: number | null
}
