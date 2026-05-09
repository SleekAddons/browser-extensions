import { Bookmark, BookmarkPlus, Globe, Loader2, Search, SearchX, Telescope, TriangleAlert } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScrollable } from '@/lib/useScrollable'
import ToolCard from './ToolCard'
import { useToolHub } from '../lib/useToolHub'
import { t } from '../lib/i18n'
import type { SearchTab } from '../lib/types'

export default function ToolHubView() {
  const {
    bookmarks,
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
  } = useToolHub()
  const { ref: onlineRef, needsPadding: onlinePadding } = useScrollable<HTMLDivElement>()
  const { ref: bookmarksRef, needsPadding: bookmarksPadding } = useScrollable<HTMLDivElement>()

  const count = tab === 'online' ? searchResults.length : bookmarks.length
  const label = (() => {
    if (tab === 'online') {
      if (isSearching) return t('statusSearching')
      if (!isSearchMode) return t('statusSearchToDiscover')
      if (!hasSearched) return t('statusSearching')
      if (searchResults.length === 0) return t('statusNoResults')
      return searchResults.length === 1
        ? t('statusResultFound', String(searchResults.length))
        : t('statusResultsFound', String(searchResults.length))
    }
    if (loadingBookmarks) return t('statusLoading')
    return `${count} ${count === 1 ? t('statusSavedBookmark') : t('statusSavedBookmarks')}`
  })()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SearchTab)} className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Fixed header: tabs + search + status */}
        <div className="flex shrink-0 flex-col gap-3">
          <TabsList className="w-full">
            <TabsTrigger value="online" className="flex-1 gap-1.5 ">
              <Globe size={12} />
              {t('tabOnline')}
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="flex-1 gap-1.5 ">
              <Bookmark size={12} />
              {t('tabBookmarks')}
            </TabsTrigger>
          </TabsList>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              autoFocus
              spellCheck={false}
              className="pl-9 pr-2 h-10"
              placeholder={tab === 'online' ? t('searchPlaceholderOnline') : t('searchPlaceholderBookmarks')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('searchAriaLabel')}
            />
          </div>

          {/* Error banner */}
          {searchError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-destructive">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Status bar - always visible */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            {isSearching && (
              <Loader2 size={12} className="shrink-0 animate-spin text-primary" />
            )}
            <span className="text-muted-foreground">{label}</span>
          </div>
        </div>

        {/* Online tab - scrollable */}
        <TabsContent
          value="online"
          ref={onlineRef}
          className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-scroll ${onlinePadding ? 'pr-3' : ''}`}
        >
          {!isSearchMode && !isSearching && (
            <EmptyState
              icon={<Telescope />}
              title={t('emptyOnlinePrompt')}
              className="flex-1"
            />
          )}

          {isSearchMode && !isSearching && !searchError && hasSearched && searchResults.length === 0 && (
            <EmptyState
              icon={<SearchX />}
              title={t('emptyNoToolsFound')}
              className="flex-1"
            />
          )}

          {searchResults.map((tool) => (
            <ToolCard
              key={tool.url}
              tool={tool}
              bookmarked={isBookmarked(tool.url)}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </TabsContent>

        {/* Bookmarks tab - scrollable */}
        <TabsContent
          value="bookmarks"
          ref={bookmarksRef}
          className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-scroll ${bookmarksPadding ? 'pr-3' : ''}`}
        >
          {loadingBookmarks && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Spinner className="size-3.5" />
              {t('statusLoading')}
            </div>
          )}

          {!loadingBookmarks && bookmarks.length === 0 && (
            <EmptyState
              icon={<BookmarkPlus />}
              title={query.trim() ? t('emptyBookmarksNoMatch') : t('emptyBookmarksNone')}
              description={!query.trim() ? t('emptyBookmarksCta') : undefined}
              className="flex-1"
            />
          )}

          {!loadingBookmarks && bookmarks.map((tool) => (
            <ToolCard
              key={tool.url}
              tool={tool}
              bookmarked={isBookmarked(tool.url)}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
