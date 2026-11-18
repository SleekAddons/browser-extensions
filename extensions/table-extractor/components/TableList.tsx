import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import ContentCard from '@/components/ContentCard'
import type { TableInfo } from '../lib/types'
import { cn } from '@/lib/utils'
import { t, tPlural } from '../lib/i18n'

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
        title={t('noTablesTitle')}
        description={t('noTablesDescription')}
        action={action}
      />
    )
  }

  return (
    <ContentCard
      title={t('tablesTitle')}
      description={tPlural('tablesDetected', tables.length)}
      action={action}
    >
      <div className="divide-y -mx-4">
        {tables.map((table) => (
          <button
            key={table.index}
            onClick={() => onSelect(table.index)}
            className={cn(
              'flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors',
              selectedIndex === table.index
                ? 'bg-accent'
                : 'hover:bg-muted/50',
            )}
          >
            <div className="mr-2 min-w-0">
              <div className="font-medium">{t('tableNumber', table.index + 1)}</div>
              <div className="max-w-48 truncate text-muted-foreground">
                {table.headerPreview.length > 0
                  ? table.headerPreview.join(' · ')
                  : table.firstRowPreview.join(' · ') || t('emptyTable')}
              </div>
            </div>
            <Badge
              variant={selectedIndex === table.index ? 'default' : 'outline'}
              className="shrink-0"
            >
              {table.rows}×{table.cols}
            </Badge>
          </button>
        ))}
      </div>
    </ContentCard>
  )
}
