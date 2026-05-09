export type BrowserKind = 'CHROME' | 'FIREFOX'

export interface BrowserBookmarkEntry {
  browserKind: BrowserKind
  browserId: string
}

/** Persisted user-facing settings for bookmarks sync. */
export interface SyncSettings {
  /** Remote server base URL used for syncing. */
  serverUrl: string
  /** Email address for cookie-based authentication. */
  email: string
  /** Password for cookie-based authentication. */
  password: string
}

/** Last-known sync state shown in the popup UI. */
export interface SyncStatus {
  /** Epoch ms of the most recent sync attempt (success or failure). */
  lastSyncedAt: number | null
  /** Last sync error message, if any. */
  lastError: string | null
  /** Number of bookmarks pushed/pulled in the last successful sync. */
  lastCount: number
  /** Whether the current session cookie is valid. null = not yet checked. */
  authenticated: boolean | null
}

/** A bookmark record as returned by GET /api/bookmarks. */
export interface RemoteBookmark {
  id: string
  url: string
  title: string
  createdAt: string
  browserBookmarks: BrowserBookmarkEntry[]
}
