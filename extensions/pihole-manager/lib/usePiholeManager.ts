import { browser } from 'wxt/browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DomainEntry,
  PiholeBlockingStatus,
  PiholeInstance,
  PiholeInstanceState,
} from './types'
import {
  SessionExpiredError,
  authenticate,
  logout,
  getSummary,
  getBlockingStatus,
  setBlocking,
  addDomain,
  searchDomain,
  removeDomain,
} from './api'
import {
  loadInstances,
  addInstance,
  updateInstance,
  removeInstance,
  loadSessionId,
  saveSessionId,
  clearSessionId,
} from './storage'
import { t } from './i18n'

/** Minimum ms between manual refreshes for a single instance. */
const REFRESH_COOLDOWN = 5_000

/** A list entry that can be removed: an exact domain or a regex. */
export type DomainRef = Pick<DomainEntry, 'domain' | 'type' | 'kind'>

async function getActiveTabDomain(): Promise<string | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return null
  try {
    const url = new URL(tab.url)
    // Only web pages have a domain Pi-hole could resolve (not chrome://newtab etc.)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : null
  } catch {
    return null
  }
}

/** Convert Pi-hole's remaining timer (seconds) into an absolute deadline. */
function disabledUntilFrom(blocking: PiholeBlockingStatus): number | null {
  return blocking.timer != null && blocking.timer > 0 ? Date.now() + blocking.timer * 1000 : null
}

async function fetchStatus(baseUrl: string, sid: string) {
  const [summary, blocking] = await Promise.all([
    getSummary(baseUrl, sid),
    getBlockingStatus(baseUrl, sid),
  ])
  return { summary, blocking, disabledUntil: disabledUntilFrom(blocking) }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export function usePiholeManager() {
  const [instances, setInstances] = useState<PiholeInstance[]>([])
  const [states, setStates] = useState<Map<string, PiholeInstanceState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentDomain, setCurrentDomain] = useState<string | null>(null)

  // Keep a ref to states so effects/callbacks don't depend on the states value
  const statesRef = useRef(states)
  statesRef.current = states

  /** Update the state for a specific instance. */
  const updateState = useCallback(
    (id: string, patch: Partial<PiholeInstanceState>) => {
      setStates((prev) => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          next.set(id, { ...existing, ...patch })
        }
        return next
      })
    },
    [],
  )

  /**
   * Connect to a single instance and fetch summary + blocking status.
   * Reuses the cached API session when there is one and only logs in again
   * when Pi-hole has expired it, so opening the popup doesn't burn a new
   * session seat every time.
   */
  const connectInstance = useCallback(
    async (instance: PiholeInstance, reuseSession = true) => {
      const id = instance.id

      // Initialize state entry
      setStates((prev) => {
        const next = new Map(prev)
        next.set(id, {
          instance,
          sid: null,
          summary: null,
          blocking: null,
          history: null,
          domainStatus: null,
          loading: true,
          error: null,
          lastRefreshedAt: null,
          disabledUntil: null,
        })
        return next
      })

      try {
        let sid = reuseSession ? await loadSessionId(instance) : null
        let status: Awaited<ReturnType<typeof fetchStatus>> | null = null

        if (sid) {
          try {
            status = await fetchStatus(instance.baseUrl, sid)
          } catch (err) {
            // The cached session expired: log in again below.
            if (!(err instanceof SessionExpiredError)) throw err
          }
        }

        if (!status) {
          const session = await authenticate(instance.baseUrl, instance.password)
          if (!session.valid || !session.sid) {
            await clearSessionId(id)
            updateState(id, { loading: false, error: t('authFailed') })
            return
          }
          sid = session.sid
          await saveSessionId(instance, sid)
          status = await fetchStatus(instance.baseUrl, sid)
        }

        updateState(id, { sid, ...status, loading: false, lastRefreshedAt: Date.now() })
      } catch (err) {
        updateState(id, { loading: false, error: errorMessage(err, t('connectionFailed')) })
      }
    },
    [updateState],
  )

  /**
   * Refresh data for an instance. Retries the connection if it isn't
   * connected yet. `force` skips the cooldown (used by the re-enable timer).
   */
  const refreshInstance = useCallback(
    async (id: string, force = false) => {
      const state = statesRef.current.get(id)
      if (!state) return

      if (!state.sid) {
        if (!state.loading) await connectInstance(state.instance)
        return
      }

      // Cooldown: skip if last refresh was too recent
      if (!force && state.lastRefreshedAt && Date.now() - state.lastRefreshedAt < REFRESH_COOLDOWN) return

      updateState(id, { loading: true, error: null })

      try {
        const status = await fetchStatus(state.instance.baseUrl, state.sid)
        updateState(id, { ...status, loading: false, lastRefreshedAt: Date.now() })
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          await connectInstance(state.instance, false)
        } else {
          updateState(id, { loading: false, error: errorMessage(err, t('refreshFailed')) })
        }
      }
    },
    [updateState, connectInstance],
  )

  /** Toggle Pi-hole blocking on/off, optionally for a duration in seconds. */
  const toggleBlocking = useCallback(
    async (id: string, timer?: number) => {
      const state = statesRef.current.get(id)
      if (!state?.sid || !state.blocking) return

      const currentlyEnabled = state.blocking.blocking === 'enabled'
      updateState(id, { loading: true, error: null })

      try {
        const result = await setBlocking(
          state.instance.baseUrl,
          state.sid,
          !currentlyEnabled,
          !currentlyEnabled ? undefined : timer ?? null,
        )
        updateState(id, { blocking: result, loading: false, disabledUntil: disabledUntilFrom(result) })
      } catch (err) {
        updateState(id, { loading: false, error: errorMessage(err, t('toggleFailed')) })
      }
    },
    [updateState],
  )

  /** Toggle blocking on/off across all connected instances at once. */
  const toggleAllBlocking = useCallback(
    async (enable: boolean, timer?: number) => {
      const entries = Array.from(statesRef.current.entries()).filter(
        ([, s]) => s.sid && s.blocking,
      )
      if (entries.length === 0) return

      // Mark all as loading up-front
      setStates((prev) => {
        const next = new Map(prev)
        for (const [id] of entries) {
          const existing = next.get(id)
          if (existing) next.set(id, { ...existing, loading: true, error: null })
        }
        return next
      })

      await Promise.all(entries.map(async ([id, state]) => {
        try {
          const result = await setBlocking(
            state.instance.baseUrl,
            state.sid!,
            enable,
            enable ? undefined : timer ?? null,
          )
          updateState(id, { blocking: result, loading: false, disabledUntil: disabledUntilFrom(result) })
        } catch (err) {
          updateState(id, { loading: false, error: errorMessage(err, t('toggleFailed')) })
        }
      }))
    },
    [updateState],
  )

  /** Look up the current tab's domain status on a specific instance. */
  const lookupDomainStatus = useCallback(
    async (id: string) => {
      const state = statesRef.current.get(id)
      if (!state?.sid) return

      const domain = currentDomain
      if (!domain) return

      updateState(id, {
        domainStatus: { domain, search: null, loading: true },
      })

      try {
        const result = await searchDomain(state.instance.baseUrl, state.sid, domain)
        updateState(id, {
          domainStatus: { domain, search: result, loading: false },
        })
      } catch {
        updateState(id, {
          domainStatus: { domain, search: null, loading: false },
        })
      }
    },
    [currentDomain, updateState],
  )

  /** Add the current tab's domain to the allow or deny list. */
  const addCurrentDomain = useCallback(
    async (id: string, type: 'allow' | 'deny'): Promise<string> => {
      const state = statesRef.current.get(id)
      if (!state?.sid) throw new Error(t('notConnected'))
      if (!currentDomain) throw new Error(t('noActiveTab'))

      await addDomain(state.instance.baseUrl, state.sid, currentDomain, type)
      // Refresh domain status after adding
      await lookupDomainStatus(id)
      return currentDomain
    },
    [currentDomain, lookupDomainStatus],
  )

  /** Remove an exact domain or regex entry from the allow or deny list. */
  const removeDomainEntry = useCallback(
    async (id: string, entry: DomainRef): Promise<void> => {
      const state = statesRef.current.get(id)
      if (!state?.sid) throw new Error(t('notConnected'))

      await removeDomain(state.instance.baseUrl, state.sid, entry.domain, entry.type, entry.kind)
      // Refresh domain status after removing
      await lookupDomainStatus(id)
    },
    [lookupDomainStatus],
  )

  /** Save a new instance and connect to it. */
  const addNewInstance = useCallback(
    async (instance: Omit<PiholeInstance, 'id'>) => {
      const newInstance: PiholeInstance = {
        ...instance,
        id: crypto.randomUUID(),
      }
      const updated = await addInstance(newInstance)
      setInstances(updated)
      await connectInstance(newInstance)
    },
    [connectInstance],
  )

  /** Edit an existing instance; reconnect when the address or password changed. */
  const editInstance = useCallback(
    async (id: string, data: Partial<Omit<PiholeInstance, 'id'>>) => {
      const previous = statesRef.current.get(id)
      const updated = await updateInstance(id, data)
      setInstances(updated)
      const inst = updated.find((i) => i.id === id)
      if (!inst) return

      const sameServer =
        previous?.sid &&
        previous.instance.baseUrl === inst.baseUrl &&
        previous.instance.password === inst.password
      if (sameServer) {
        // e.g. only renamed: keep the current session and data
        updateState(id, { instance: inst })
        return
      }

      if (previous?.sid) {
        logout(previous.instance.baseUrl, previous.sid).catch(() => {})
      }
      await clearSessionId(id)
      await connectInstance(inst, false)
    },
    [connectInstance, updateState],
  )

  /** Remove an instance and end its API session. */
  const deleteInstance = useCallback(async (id: string) => {
    const state = statesRef.current.get(id)
    const updated = await removeInstance(id)
    setInstances(updated)
    setStates((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    if (state?.sid) {
      logout(state.instance.baseUrl, state.sid).catch(() => {})
    }
    await clearSessionId(id)
  }, [])

  /** Auto-refresh instances shortly after their disable timer expires. */
  const timerKey = Array.from(states, ([id, s]) => `${id}:${s.sid ? s.disabledUntil ?? '' : ''}`).join('|')
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [id, state] of statesRef.current) {
      if (!state.disabledUntil || !state.sid) continue
      const remaining = Math.max(state.disabledUntil - Date.now(), 0)
      timers.push(setTimeout(() => refreshInstance(id, true), remaining + 1000))
    }
    return () => timers.forEach(clearTimeout)
  }, [timerKey, refreshInstance])

  /** Load instances on mount and connect to all. */
  useEffect(() => {
    let cancelled = false
    async function init() {
      const [saved, domain] = await Promise.all([
        loadInstances(),
        getActiveTabDomain(),
      ])
      if (cancelled) return
      setInstances(saved)
      setCurrentDomain(domain)
      setLoading(false)

      for (const instance of saved) {
        if (!cancelled) {
          connectInstance(instance)
        }
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [connectInstance])

  /** Once an instance is connected and we know the domain, look up its status. */
  const sidKey = instances.map((i) => states.get(i.id)?.sid ?? '').join('|')
  useEffect(() => {
    if (!currentDomain) return
    for (const [id, state] of statesRef.current) {
      // Only once per connection (domainStatus goes from null → loading)
      if (state.sid && !state.domainStatus && !state.loading) {
        lookupDomainStatus(id)
      }
    }
  }, [currentDomain, sidKey, lookupDomainStatus])

  return {
    instances,
    states,
    loading,
    currentDomain,
    addNewInstance,
    editInstance,
    deleteInstance,
    refreshInstance,
    toggleBlocking,
    toggleAllBlocking,
    addCurrentDomain,
    removeDomainEntry,
    lookupDomainStatus,
  }
}
