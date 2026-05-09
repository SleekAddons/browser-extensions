import { browser } from 'wxt/browser'
import type { SearchTab, Tool } from './types'

const BOOKMARKS_KEY = 'tool_hub_bookmarks'
const TAB_KEY = 'tool_hub_tab'
const QUERY_KEY = 'tool_hub_query'

/** Load the last selected tab from storage. */
export async function loadTab(): Promise<SearchTab> {
  const result = await browser.storage.local.get(TAB_KEY)
  const val = result[TAB_KEY]
  return val === 'online' || val === 'bookmarks' ? val : 'online'
}

/** Persist the selected tab. */
export async function saveTab(tab: SearchTab): Promise<void> {
  await browser.storage.local.set({ [TAB_KEY]: tab })
}

/** Load the last search query from storage. */
export async function loadQuery(): Promise<string> {
  const result = await browser.storage.local.get(QUERY_KEY)
  return typeof result[QUERY_KEY] === 'string' ? result[QUERY_KEY] : ''
}

/** Persist the search query. */
export async function saveQuery(query: string): Promise<void> {
  await browser.storage.local.set({ [QUERY_KEY]: query })
}

/** Load all bookmarked tools from storage. */
export async function loadBookmarks(): Promise<Tool[]> {
  const result = await browser.storage.local.get(BOOKMARKS_KEY)
  return (result[BOOKMARKS_KEY] as Tool[] | undefined) ?? []
}

/** Persist the full bookmarks list. */
async function saveBookmarks(bookmarks: Tool[]): Promise<void> {
  await browser.storage.local.set({ [BOOKMARKS_KEY]: bookmarks })
}

/** Add a tool to bookmarks. No-op if already bookmarked (matched by url). */
export async function addBookmark(tool: Tool): Promise<Tool[]> {
  const bookmarks = await loadBookmarks()
  if (bookmarks.some((b) => b.url === tool.url)) return bookmarks
  bookmarks.push(tool)
  await saveBookmarks(bookmarks)
  return bookmarks
}

/** Remove a tool from bookmarks by url. */
export async function removeBookmark(url: string): Promise<Tool[]> {
  const bookmarks = (await loadBookmarks()).filter((b) => b.url !== url)
  await saveBookmarks(bookmarks)
  return bookmarks
}
