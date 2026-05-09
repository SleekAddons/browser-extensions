/**
 * Remote bookmarks-sync API client.
 *
 * Authentication is cookie-based. Every fetch includes `credentials: 'include'`
 * so the browser automatically attaches the session cookie obtained via login().
 * On a 401 response the client re-authenticates and retries once.
 */

import type { BrowserKind, RemoteBookmark, SyncSettings } from './types'

function apiUrl(settings: SyncSettings, path: string): string {
  return `${settings.serverUrl.replace(/\/$/, '')}${path}`
}

/** Authenticate with the server and obtain a session cookie (valid for 7 days). */
export async function login(settings: SyncSettings): Promise<void> {
  const res = await fetch(apiUrl(settings, '/api/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: settings.email, password: settings.password }),
  })
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${res.statusText}`)
  }
}

/** Return true if the server is reachable, false on network error. */
export async function pingServer(settings: SyncSettings): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(settings, '/api/bookmarks'), {
      credentials: 'include',
    })
    // Any HTTP response (including 401) means the server is reachable.
    return res.status > 0
  } catch {
    return false
  }
}

/** Check whether the current session cookie is still valid (non-401 response = authenticated). */
export async function verifyAuth(settings: SyncSettings): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(settings, '/api/bookmarks'), {
      credentials: 'include',
    })
    return res.status !== 401
  } catch {
    return false
  }
}

/** Invalidate the current session on the server. */
export async function logoutApi(settings: SyncSettings): Promise<void> {
  try {
    await fetch(apiUrl(settings, '/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Ignore network errors on logout — session will expire naturally.
  }
}

/** Fetch all bookmarks for the logged-in user, newest first. */
export async function fetchRemoteBookmarks(
  settings: SyncSettings,
): Promise<RemoteBookmark[]> {
  const get = () =>
    fetch(apiUrl(settings, '/api/bookmarks'), { credentials: 'include' })

  let res = await get()
  if (res.status === 401) {
    await login(settings)
    res = await get()
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch bookmarks: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<RemoteBookmark[]>
}

export interface CreateBookmarkPayload {
  url: string
  title?: string
  browserKind: BrowserKind
  browserId: string
}

/** Notify the server that a single bookmark was created locally. */
export async function notifyBookmarkCreated(
  settings: SyncSettings,
  payload: CreateBookmarkPayload,
): Promise<void> {
  const body: Record<string, string> = {
    url: payload.url,
    browserKind: payload.browserKind,
    browserId: payload.browserId,
  }
  if (payload.title) body.title = payload.title

  const post = () =>
    fetch(apiUrl(settings, '/api/bookmarks'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  let res = await post()
  if (res.status === 401) {
    await login(settings)
    res = await post()
  }
  if (!res.ok) {
    throw new Error(`Failed to create bookmark: ${res.status} ${res.statusText}`)
  }
}

/** Notify the server that a single bookmark was removed locally. */
export async function notifyBookmarkRemoved(
  _settings: SyncSettings,
  _bookmarkId: string,
): Promise<void> {
  // The current API does not expose a DELETE endpoint; this is a no-op.
}
