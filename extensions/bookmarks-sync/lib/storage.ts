import { browser } from 'wxt/browser'
import type { SyncSettings, SyncStatus } from './types'

const SETTINGS_KEY = 'bookmarks_sync_settings'
const STATUS_KEY = 'bookmarks_sync_status'

export const DEFAULT_SETTINGS: SyncSettings = {
  serverUrl: 'http://localhost:3000',
  email: 'test@test.com',
  password: 'test1test',
}

export const DEFAULT_STATUS: SyncStatus = {
  lastSyncedAt: null,
  lastError: null,
  lastCount: 0,
  authenticated: null,
}

export async function loadSettings(): Promise<SyncSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<SyncSettings> | undefined) }
}

export async function saveSettings(settings: SyncSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings })
}

export async function loadStatus(): Promise<SyncStatus> {
  const result = await browser.storage.local.get(STATUS_KEY)
  return { ...DEFAULT_STATUS, ...(result[STATUS_KEY] as Partial<SyncStatus> | undefined) }
}

export async function saveStatus(status: SyncStatus): Promise<void> {
  await browser.storage.local.set({ [STATUS_KEY]: status })
}

export { SETTINGS_KEY, STATUS_KEY }
