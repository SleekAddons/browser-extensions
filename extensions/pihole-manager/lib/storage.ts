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
