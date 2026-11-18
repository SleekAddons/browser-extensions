import { browser } from 'wxt/browser'
import type { PiholeInstance } from './types'

const STORAGE_KEY = 'pihole_instances'

/** Load all saved Pi-hole instances from storage. */
export async function loadInstances(): Promise<PiholeInstance[]> {
  const result = await browser.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as PiholeInstance[] | undefined) ?? []
}

/** Save all Pi-hole instances to storage. */
export async function saveInstances(instances: PiholeInstance[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: instances })
}

/** Add a new instance and persist. */
export async function addInstance(instance: PiholeInstance): Promise<PiholeInstance[]> {
  const instances = await loadInstances()
  instances.push(instance)
  await saveInstances(instances)
  return instances
}

/** Update an existing instance by ID and persist. */
export async function updateInstance(id: string, data: Partial<Omit<PiholeInstance, 'id'>>): Promise<PiholeInstance[]> {
  const instances = await loadInstances()
  const idx = instances.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error('Instance not found')
  instances[idx] = { ...instances[idx], ...data }
  await saveInstances(instances)
  return instances
}

/** Remove an instance by ID and persist. */
export async function removeInstance(id: string): Promise<PiholeInstance[]> {
  const instances = (await loadInstances()).filter((i) => i.id !== id)
  await saveInstances(instances)
  return instances
}

// ── API session cache ──────────────────────────────────────
//
// Pi-hole only allows a limited number of concurrent API sessions
// (webserver.api.max_sessions, 16 by default) and each one stays alive for
// webserver.session.timeout seconds. Logging in on every popup open would
// use those seats up, so the session ID is kept in storage.session (memory
// only, cleared when the browser exits) and reused until Pi-hole rejects it.

interface CachedSession {
  sid: string
  baseUrl: string
}

const sessionKey = (instanceId: string) => `pihole_session_${instanceId}`

/** Return a cached session ID for this instance, if one is available. */
export async function loadSessionId(instance: PiholeInstance): Promise<string | null> {
  const area = browser.storage.session
  if (!area) return null // storage.session needs Chrome 102+ / Firefox 115+
  try {
    const key = sessionKey(instance.id)
    const cached = (await area.get(key))[key] as CachedSession | undefined
    return cached?.baseUrl === instance.baseUrl ? cached.sid : null
  } catch {
    return null
  }
}

/** Remember the session ID for an instance. */
export async function saveSessionId(instance: PiholeInstance, sid: string): Promise<void> {
  try {
    const cached: CachedSession = { sid, baseUrl: instance.baseUrl }
    await browser.storage.session?.set({ [sessionKey(instance.id)]: cached })
  } catch {
    // Caching is an optimization only.
  }
}

/** Forget the cached session ID for an instance. */
export async function clearSessionId(instanceId: string): Promise<void> {
  try {
    await browser.storage.session?.remove(sessionKey(instanceId))
  } catch {
    // Caching is an optimization only.
  }
}
