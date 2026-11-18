/**
 * Pi-hole 6+ API client.
 *
 * Handles authentication, stats retrieval, blocking toggle,
 * and domain allow/deny list management.
 */

import type {
  PiholeSession,
  PiholeSummary,
  PiholeBlockingStatus,
  PiholeHistoryEntry,
  DomainSearchResult,
} from './types'

/** Thrown when the Pi-hole rejects the session ID (HTTP 401). */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired')
    this.name = 'SessionExpiredError'
  }
}

function apiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/api${path}`
}

/** Authenticate with a Pi-hole instance and return the session. */
export async function authenticate(
  baseUrl: string,
  password: string,
): Promise<PiholeSession> {
  const res = await fetch(apiUrl(baseUrl, '/auth'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid password')
    if (res.status === 429) {
      throw new Error('Too many active API sessions on this Pi-hole. Wait for old sessions to expire, then refresh.')
    }
    throw new Error(`Authentication failed (${res.status})`)
  }

  const data = await res.json()
  return data.session as PiholeSession
}

/** Delete / log out of an active session. */
export async function logout(baseUrl: string, sid: string): Promise<void> {
  await fetch(apiUrl(baseUrl, '/auth'), {
    method: 'DELETE',
    headers: { 'X-FTL-SID': sid },
  })
}

/** Fetch the summary statistics. */
export async function getSummary(
  baseUrl: string,
  sid: string,
): Promise<PiholeSummary> {
  const res = await fetch(apiUrl(baseUrl, '/stats/summary'), {
    headers: { 'X-FTL-SID': sid },
  })

  if (res.status === 401) throw new SessionExpiredError()
  if (!res.ok) throw new Error(`Failed to fetch summary (${res.status})`)

  return (await res.json()) as PiholeSummary
}

/** Get the current blocking status. */
export async function getBlockingStatus(
  baseUrl: string,
  sid: string,
): Promise<PiholeBlockingStatus> {
  const res = await fetch(apiUrl(baseUrl, '/dns/blocking'), {
    headers: { 'X-FTL-SID': sid },
  })

  if (res.status === 401) throw new SessionExpiredError()
  if (!res.ok) throw new Error(`Failed to fetch blocking status (${res.status})`)

  return (await res.json()) as PiholeBlockingStatus
}

/** Fetch query history (last 24 h by default). */
export async function getHistory(
  baseUrl: string,
  sid: string,
): Promise<PiholeHistoryEntry[]> {
  const res = await fetch(apiUrl(baseUrl, '/history'), {
    headers: { 'X-FTL-SID': sid },
  })

  if (res.status === 401) throw new SessionExpiredError()
  if (!res.ok) throw new Error(`Failed to fetch history (${res.status})`)

  const data = await res.json()
  return (data.history ?? []) as PiholeHistoryEntry[]
}

/** Enable or disable blocking. Optional timer in seconds. */
export async function setBlocking(
  baseUrl: string,
  sid: string,
  blocking: boolean,
  timer?: number | null,
): Promise<PiholeBlockingStatus> {
  const body: Record<string, unknown> = { blocking }
  if (timer !== undefined) body.timer = timer

  const res = await fetch(apiUrl(baseUrl, '/dns/blocking'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-FTL-SID': sid,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 401) throw new SessionExpiredError()
  if (!res.ok) throw new Error(`Failed to set blocking (${res.status})`)

  return (await res.json()) as PiholeBlockingStatus
}

/** Add a domain to the allow or deny list. */
export async function addDomain(
  baseUrl: string,
  sid: string,
  domain: string,
  type: 'allow' | 'deny',
): Promise<void> {
  const res = await fetch(apiUrl(baseUrl, `/domains/${type}/exact`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-FTL-SID': sid,
    },
    body: JSON.stringify({ domain }),
  })

  if (res.status === 401) throw new SessionExpiredError()
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const msg = data?.error?.message ?? `Failed to add domain (${res.status})`
    throw new Error(msg)
  }
}

/** Search for a domain across Pi-hole's domain lists and gravity. */
export async function searchDomain(
  baseUrl: string,
  sid: string,
  domain: string,
): Promise<DomainSearchResult> {
  const res = await fetch(apiUrl(baseUrl, `/search/${encodeURIComponent(domain)}`), {
    headers: { 'X-FTL-SID': sid },
  })

  if (res.status === 401) throw new SessionExpiredError()
  if (!res.ok) throw new Error(`Failed to search domain (${res.status})`)

  const data = await res.json()
  const search = data.search ?? {}

  return {
    domains: (search.domains ?? []).map((d: Record<string, unknown>) => ({
      domain: d.domain as string,
      type: d.type as 'allow' | 'deny',
      kind: d.kind as 'exact' | 'regex',
      enabled: d.enabled as boolean,
      comment: (d.comment as string | null) ?? null,
    })),
    gravity: (search.gravity ?? []).map((g: Record<string, unknown>) => ({
      domain: g.domain as string,
      address: g.address as string,
      type: g.type as 'allow' | 'block',
      enabled: g.enabled as boolean,
      comment: (g.comment as string | null) ?? null,
    })),
    totalMatches: search.results?.total ?? 0,
  }
}

/** Remove an exact domain or a regex from the allow or deny list. */
export async function removeDomain(
  baseUrl: string,
  sid: string,
  domain: string,
  type: 'allow' | 'deny',
  kind: 'exact' | 'regex' = 'exact',
): Promise<void> {
  const res = await fetch(apiUrl(baseUrl, `/domains/${type}/${kind}/${encodeURIComponent(domain)}`), {
    method: 'DELETE',
    headers: { 'X-FTL-SID': sid },
  })

  if (res.status === 401) throw new SessionExpiredError()
  if (res.status === 404) throw new Error('Domain not found in list')
  if (!res.ok) throw new Error(`Failed to remove domain (${res.status})`)
}
