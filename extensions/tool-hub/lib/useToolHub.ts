import { browser } from 'wxt/browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SearchTab, Tool, ToolSearchResponse } from './types'
import { addBookmark, loadBookmarks, loadQuery, loadTab, removeBookmark, saveQuery, saveTab } from './storage'

const API_BASE = 'https://sleekaddons.com/api/tools/search'
const DEBOUNCE_MS = 400
const SUPPORTED_LOCALES = ['en', 'ru'] as const

function getSearchLocale(): string {
  const uiLang = browser.i18n.getUILanguage().split('-')[0].toLowerCase()
  return SUPPORTED_LOCALES.includes(uiLang as typeof SUPPORTED_LOCALES[number]) ? uiLang : 'en'
}

export function useToolHub() {
  const [bookmarks, setBookmarks] = useState<Tool[]>([])
  const [searchResults, setSearchResults] = useState<Tool[]>([])
  const [query, _setQuery] = useState('')
  const [tab, _setTab] = useState<SearchTab>('online')

  const setQuery = useCallback((q: string) => {
    _setQuery(q)
    saveQuery(q)
  }, [])

  const setTab = useCallback((t: SearchTab) => {
    _setTab(t)
    saveTab(t)
  }, [])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [loadingBookmarks, setLoadingBookmarks] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortController = useRef<AbortController | null>(null)

  // Load persisted tab + bookmarks on mount
  useEffect(() => {
    loadTab().then(_setTab)
    loadQuery().then(_setQuery)
    loadBookmarks()
      .then(setBookmarks)
      .finally(() => setLoadingBookmarks(false))
  }, [])

  // Debounced API search (only when online tab is active)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    if (tab !== 'online' || !query.trim()) {
      abortController.current?.abort()
      abortController.current = null
      setSearchResults([])
      setSearchError(null)
      setHasSearched(false)
      setIsSearching(false)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      abortController.current?.abort()
      abortController.current = new AbortController()

      setIsSearching(true)
      setSearchError(null)

      try {
        const params = new URLSearchParams()
        params.set('q', query.trim())
        params.set('locale', getSearchLocale())

        const url = `${API_BASE}?${params.toString()}`
        const res = await fetch(url, { signal: abortController.current.signal })

        if (!res.ok) throw new Error(`Request failed: ${res.status}`)

        const data: ToolSearchResponse = await res.json()
        setSearchResults(data.tools)
        setHasSearched(true)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setSearchError(err instanceof Error ? err.message : 'Something went wrong')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query, tab])

  // Filter bookmarks locally when on bookmarks tab
  const filteredBookmarks = tab === 'bookmarks' && query.trim()
    ? bookmarks.filter((b) => {
        const q = query.trim().toLowerCase()
        return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
      })
    : bookmarks

  const isBookmarked = useCallback(
    (url: string) => bookmarks.some((b) => b.url === url),
    [bookmarks],
  )

  const toggleBookmark = useCallback(async (tool: Tool) => {
    if (isBookmarked(tool.url)) {
      const updated = await removeBookmark(tool.url)
      setBookmarks(updated)
    } else {
      const updated = await addBookmark(tool)
      setBookmarks(updated)
    }
  }, [isBookmarked])

  const isSearchMode = tab === 'online' && query.trim().length > 0

  return {
    bookmarks: filteredBookmarks,
    searchResults,
    query,
    tab,
    isSearching,
    isSearchMode,
    hasSearched,
    searchError,
    loadingBookmarks,
    setQuery,
    setTab,
    isBookmarked,
    toggleBookmark,
  }
}
