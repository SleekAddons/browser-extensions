import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import ContentCard from '@/components/ContentCard'
import type { TableInfo } from '../lib/types'
import { cn } from '@/lib/utils'

interface TableListProps {
  tables: TableInfo[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  action?: ReactNode
}

export default function TableList(props: TableListProps) {
  const { tables, selectedIndex, onSelect, action } = props

  if (tables.length === 0) {
    return (
      <ContentCard
        title="No tables found"
        description="This page doesn't contain any HTML tables. Try scanning a different page."
        action={action}
      />
    )
  }

  return (
    <ContentCard
      title="Tables"
      description={`${tables.length} table${tables.length > 1 ? 's' : ''} detected on this page`}
      action={action}
    >
      <div className="divide-y -mx-4">
        {tables.map((t) => (
          <button
            key={t.index}
            onClick={() => onSelect(t.index)}
            className={cn(
              'flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors',
              selectedIndex === t.index
                ? 'bg-accent'
                : 'hover:bg-muted/50',
            )}
          >
            <div className="mr-2 min-w-0">
              <div className="font-medium">Table {t.index + 1}</div>
              <div className="max-w-48 truncate text-muted-foreground">
                {t.headerPreview.length > 0
                  ? t.headerPreview.join(' · ')
                  : t.firstRowPreview.join(' · ') || 'Empty table'}
              </div>
            </div>
            <Badge
              variant={selectedIndex === t.index ? 'default' : 'outline'}
              className="shrink-0"
            >
              {t.rows}×{t.cols}
            </Badge>
          </button>
        ))}
      </div>
    </ContentCard>
  )
}
