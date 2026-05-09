import { browser } from 'wxt/browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PiholeInstance,
  PiholeInstanceState,
  PiholeSession,
} from './types'
import {
  authenticate,
  getSummary,
  getBlockingStatus,
  setBlocking,
  addDomain,
  searchDomain,
  removeDomain,
} from './api'
import { loadInstances, addInstance, updateInstance, removeInstance } from './storage'

async function getActiveTabDomain(): Promise<string | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return null
  try {
    return new URL(tab.url).hostname
  } catch {
    return null
  }
}

export function usePiholeManager() {
  const [instances, setInstances] = useState<PiholeInstance[]>([])
  const [states, setStates] = useState<Map<string, PiholeInstanceState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [currentDomain, setCurrentDomain] = useState<string | null>(null)

  // Keep a ref to states so effects/callbacks don't depend on the states value
  const statesRef = useRef(states)
  statesRef.current = states

  /** Minimum ms between refreshes for a single instance. */
  const REFRESH_COOLDOWN = 5_000

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

  /** Connect to a single instance: authenticate, fetch summary + blocking. */
  const connectInstance = useCallback(
    async (instance: PiholeInstance) => {
      const id = instance.id

      // Initialize state entry
      setStates((prev) => {
        const next = new Map(prev)
        next.set(id, {
          instance,
          session: null,
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
        const session = await authenticate(instance.baseUrl, instance.password)
        if (!session.valid || !session.sid) {
          updateState(id, { loading: false, error: 'Authentication failed' })
          return
        }

        const [summary, blocking] = await Promise.all([
          getSummary(instance.baseUrl, session.sid),
          getBlockingStatus(instance.baseUrl, session.sid),
        ])

        const disabledUntil = blocking.timer != null && blocking.timer > 0
          ? Date.now() + blocking.timer * 1000
          : null
        updateState(id, { session, summary, blocking, loading: false, lastRefreshedAt: Date.now(), disabledUntil })
      } catch (err) {
        updateState(id, {
          loading: false,
          error: err instanceof Error ? err.message : 'Connection failed',
        })
      }
    },
    [updateState],
  )

  /** Refresh data for an already-connected instance. */
  const refreshInstance = useCallback(
    async (id: string) => {
      const state = statesRef.current.get(id)
      if (!state?.session?.sid) return

      // Cooldown: skip if last refresh was too recent
      if (state.lastRefreshedAt && Date.now() - state.lastRefreshedAt < REFRESH_COOLDOWN) return

      updateState(id, { loading: true, error: null })

      try {
        const [summary, blocking] = await Promise.all([
          getSummary(state.instance.baseUrl, state.session.sid),
          getBlockingStatus(state.instance.baseUrl, state.session.sid),
        ])
        const disabledUntil = blocking.timer != null && blocking.timer > 0
          ? Date.now() + blocking.timer * 1000
          : null
        updateState(id, { summary, blocking, loading: false, lastRefreshedAt: Date.now(), disabledUntil })
      } catch (err) {
        // If session expired, try re-authenticating
        if (err instanceof Error && err.message === 'Session expired') {
          await connectInstance(state.instance)
        } else {
          updateState(id, {
            loading: false,
            error: err instanceof Error ? err.message : 'Refresh failed',
          })
        }
      }
    },
    [updateState, connectInstance],
  )

  /** Toggle Pi-hole blocking on/off, optionally for a duration in seconds. */
  const toggleBlocking = useCallback(
    async (id: string, timer?: number) => {
      const state = statesRef.current.get(id)
      if (!state?.session?.sid || !state.blocking) return

      const currentlyEnabled = state.blocking.blocking === 'enabled'
      updateState(id, { loading: true, error: null })

      try {
        const result = await setBlocking(
          state.instance.baseUrl,
          state.session.sid,
          !currentlyEnabled,
          !currentlyEnabled ? undefined : timer ?? null,
        )
        const disabledUntil = result.timer != null && result.timer > 0
          ? Date.now() + result.timer * 1000
          : null
        updateState(id, { blocking: result, loading: false, disabledUntil })
      } catch (err) {
        updateState(id, {
          loading: false,
          error: err instanceof Error ? err.message : 'Toggle failed',
        })
      }
    },
    [updateState],
  )

  /** Auto-refresh instances when their disable timer expires. */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [id, state] of states) {
      if (state.disabledUntil && state.session?.sid) {
        const remaining = state.disabledUntil - Date.now()
        if (remaining > 0) {
          timers.push(setTimeout(() => {
            // Use ref to get fresh state when timer fires
            const current = statesRef.current.get(id)
            if (current?.session?.sid) refreshInstance(id)
          }, remaining + 1000))
        }
      }
    }
    return () => timers.forEach(clearTimeout)
  // Only re-run when disabledUntil values actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...[...states.values()].map(s => s.disabledUntil)])

  /** Look up the current tab's domain status on a specific instance. */
  const lookupDomainStatus = useCallback(
    async (id: string) => {
      const state = statesRef.current.get(id)
      if (!state?.session?.sid) return

      const domain = currentDomain
      if (!domain) return

      updateState(id, {
        domainStatus: { domain, search: null, loading: true },
      })

      try {
        const result = await searchDomain(state.instance.baseUrl, state.session.sid, domain)
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
      if (!state?.session?.sid) throw new Error('Not connected')
      if (!currentDomain) throw new Error('No active tab')

      await addDomain(state.instance.baseUrl, state.session.sid, currentDomain, type)
      // Refresh domain status after adding
      await lookupDomainStatus(id)
      return currentDomain
    },
    [currentDomain, lookupDomainStatus],
  )

  /** Remove the current tab's domain from the allow or deny list. */
  const removeCurrentDomain = useCallback(
    async (id: string, type: 'allow' | 'deny'): Promise<string> => {
      const state = statesRef.current.get(id)
      if (!state?.session?.sid) throw new Error('Not connected')
      if (!currentDomain) throw new Error('No active tab')

      await removeDomain(state.instance.baseUrl, state.session.sid, currentDomain, type)
      // Refresh domain status after removing
      await lookupDomainStatus(id)
      return currentDomain
    },
    [currentDomain, lookupDomainStatus],
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

  /** Edit an existing instance and reconnect. */
  const editInstance = useCallback(
    async (id: string, data: Partial<Omit<PiholeInstance, 'id'>>) => {
      const updated = await updateInstance(id, data)
      setInstances(updated)
      const inst = updated.find((i) => i.id === id)
      if (inst) {
        await connectInstance(inst)
      }
    },
    [connectInstance],
  )

  /** Remove an instance. */
  const deleteInstance = useCallback(async (id: string) => {
    const updated = await removeInstance(id)
    setInstances(updated)
    setStates((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

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

  /** After instances connect and we have a domain, look up domain status. */
  useEffect(() => {
    if (!currentDomain) return
    const idsToLookup: string[] = []
    for (const [id, state] of states) {
      if (state.session?.sid && !state.domainStatus && !state.loading) {
        idsToLookup.push(id)
      }
    }
    // Only look up once per instance (domainStatus goes from null → loading)
    for (const id of idsToLookup) {
      lookupDomainStatus(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDomain, ...instances.map(i => states.get(i.id)?.session?.sid)])

  /** Helper to get the session for re-auth on the fly. */
  const getSession = useCallback(
    (id: string): PiholeSession | null => {
      return states.get(id)?.session ?? null
    },
    [states],
  )

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
    addCurrentDomain,
    removeCurrentDomain,
    lookupDomainStatus,
    getSession,
  }
}
