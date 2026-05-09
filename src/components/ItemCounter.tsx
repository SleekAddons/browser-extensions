import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ItemCounterProps {
  /** Number of items currently added */
  count: number
  /** Label describing the items, e.g. "Endpoints", "Commands", "Instances" */
  label: string
  /** Callback when the add button is clicked */
  onAdd: () => void
  /** Noun used for the add button title, e.g. "Endpoint" → "Add Endpoint". Defaults to "Add" */
  addLabel?: string
  /** Hide the add button */
  hideAdd?: boolean
  /** Additional class names */
  className?: string
}

export default function ItemCounter(props: ItemCounterProps) {
  const { count, label, onAdd, addLabel = 'Add', hideAdd = false, className } = props

  return (
    <div className={cn('flex items-center justify-between rounded-lg border bg-card px-4 py-2', className)}>
      <div className="flex items-center gap-3 text-base">
        <span className="font-semibold leading-none">{label}</span>
        <Badge variant="secondary" className="flex h-6 min-w-6 items-center justify-center rounded-md font-semibold text-sm leading-none">
          {count}
        </Badge>
      </div>
      {!hideAdd && (
        <Button variant="secondary" size="icon-sm" onClick={onAdd} title={`Add ${addLabel}`}>
          <Plus size={14} />
        </Button>
      )}
    </div>
  )
}
