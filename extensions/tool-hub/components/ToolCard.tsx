import { useCallback, useEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '../lib/i18n'
import type { Tool } from '../lib/types'

interface Props {
  tool: Tool
  bookmarked: boolean
  onToggleBookmark: (tool: Tool) => void
}

export default function ToolCard(props: Props) {
  const { tool, bookmarked, onToggleBookmark } = props
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)

  const checkClamp = useCallback(() => {
    const el = descRef.current
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1)
  }, [])

  useEffect(() => {
    checkClamp()
  }, [tool.description, checkClamp])

  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xs transition-colors hover:bg-accent/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium leading-snug hover:underline"
          >
            {tool.name}
          </a>
        </div>
        <p
          ref={descRef}
          className={`mt-0.5 leading-snug text-muted-foreground transition-all duration-200 ${expanded ? '' : 'line-clamp-2'}`}
        >
          {tool.description}
        </p>
        {(clamped || expanded) && (
          <button
            type="button"
            className="mt-0.5 font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t('showLess') : t('showMore')}
          </button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        aria-label={bookmarked ? t('removeBookmark') : t('addBookmark')}
        onClick={() => onToggleBookmark(tool)}
      >
        {bookmarked ? (
          <BookmarkCheck size={20} className="text-black dark:text-white" />
        ) : (
          <Bookmark size={20} className="text-muted-foreground/50" />
        )}
      </Button>
    </div>
  )
}
