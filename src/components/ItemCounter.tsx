import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

interface ItemCounterProps {
  /** Number of items currently added */
  count: number
  /** Label describing the items, e.g. "Endpoints", "Commands", "Instances" */
  label: string
  /** Callback when the add button is clicked */
  onAdd: () => void
  /** Tooltip of the add button, e.g. "Add Endpoint". Defaults to "Add" */
  addTitle?: string
  /** Hide the add button */
  hideAdd?: boolean
  /** Additional class names */
  className?: string
}

export default function ItemCounter(props: ItemCounterProps) {
  const { count, label, onAdd, addTitle = t('add'), hideAdd = false, className } = props

  return (
    <div className={cn('flex items-center justify-between rounded-lg border bg-card px-4 py-2', className)}>
      <div className="flex items-center gap-3 text-base">
        <span className="font-semibold leading-none">{label}</span>
        <Badge variant="secondary" className="flex h-6 min-w-6 items-center justify-center rounded-md font-semibold text-sm leading-none">
          {count}
        </Badge>
      </div>
      {!hideAdd && (
        <Button variant="secondary" size="icon-sm" onClick={onAdd} title={addTitle}>
          <Plus size={14} />
        </Button>
      )}
    </div>
  )
}
