import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { fetchRemoteBookmarks, login, logoutApi, notifyBookmarkCreated, verifyAuth } from './api'
import { DEFAULT_SETTINGS, DEFAULT_STATUS, SETTINGS_KEY, STATUS_KEY, loadSettings, loadStatus, saveSettings, saveStatus } from './storage'
import type { BrowserKind, SyncSettings, SyncStatus } from './types'

export function useBookmarksSync() {
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<SyncStatus>(DEFAULT_STATUS)
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([loadSettings(), loadStatus()]).then(async ([s, st]) => {
      if (!mounted) return
      setSettings(s)
      setStatus(st)
      setLoading(false)

      // Verify credentials by attempting a fresh login with stored credentials.
      setAuthChecking(true)
      try {
        await login(s)
        const authenticated = await verifyAuth(s)
        if (!mounted) return
        const next = { ...st, authenticated }
        setStatus(next)
        await saveStatus(next)
      } catch {
        if (!mounted) return
        const next = { ...st, authenticated: false }
        setStatus(next)
        await saveStatus(next)
      } finally {
        if (mounted) setAuthChecking(false)
      }
    })

    const onChanged = (changes: Record<string, { newValue?: unknown }>) => {
      if (changes[SETTINGS_KEY]?.newValue) {
        setSettings({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as Partial<SyncSettings>) })
      }
      if (changes[STATUS_KEY]?.newValue) {
        setStatus({ ...DEFAULT_STATUS, ...(changes[STATUS_KEY].newValue as Partial<SyncStatus>) })
      }
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => {
      mounted = false
      browser.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  const updateSettings = useCallback(async (patch: Partial<SyncSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    await saveSettings(next)
  }, [settings])

  /** Login with current settings and verify the session. Updates authenticated state. */
  const connect = useCallback(async () => {
    setAuthChecking(true)
    try {
      await login(settings)
      const authenticated = await verifyAuth(settings)
      const next = { ...status, authenticated }
      setStatus(next)
      await saveStatus(next)
    } catch {
      const next = { ...status, authenticated: false }
      setStatus(next)
      await saveStatus(next)
    } finally {
      setAuthChecking(false)
    }
  }, [settings, status])

  /** Logout from the server and clear the authenticated state. */
  const logout = useCallback(async () => {
    await logoutApi(settings)
    const next = { ...status, authenticated: false }
    setStatus(next)
    await saveStatus(next)
  }, [settings, status])

  const forceSync = useCallback(async () => {
    const browserKind: BrowserKind = navigator.userAgent.includes('Firefox') ? 'FIREFOX' : 'CHROME'

    // Flatten the bookmark tree into leaf nodes (actual bookmarks, not folders)
    function collectBookmarks(nodes: browser.bookmarks.BookmarkTreeNode[]): browser.bookmarks.BookmarkTreeNode[] {
      const result: browser.bookmarks.BookmarkTreeNode[] = []
      for (const node of nodes) {
        if (node.url) {
          result.push(node)
        }
        if (node.children) {
          result.push(...collectBookmarks(node.children))
        }
      }
      return result
    }

    try {
      const [tree, remote] = await Promise.all([
        browser.bookmarks.getTree(),
        fetchRemoteBookmarks(settings),
      ])

      const localBookmarks = collectBookmarks(tree)
      const remoteIds = new Set(remote.map((b) => b.browserId))
      const toSync = localBookmarks.filter((b) => b.id && !remoteIds.has(b.id))

      await Promise.all(
        toSync.map((b) =>
          notifyBookmarkCreated(settings, {
            url: b.url!,
            title: b.title,
            browserKind,
            browserId: b.id!,
          }),
        ),
      )

      const nextStatus: SyncStatus = {
        lastSyncedAt: Date.now(),
        lastError: null,
        lastCount: toSync.length,
      }
      setStatus(nextStatus)
      await saveStatus(nextStatus)
    } catch (err) {
      const nextStatus: SyncStatus = {
        lastSyncedAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
        lastCount: 0,
      }
      setStatus(nextStatus)
      await saveStatus(nextStatus)
    }
  }, [settings])

  return { settings, status, loading, authChecking, updateSettings, connect, logout, forceSync }
}
