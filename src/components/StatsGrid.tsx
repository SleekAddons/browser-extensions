import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface StatItem {
  label: string
  value: ReactNode
}

interface StatsGridProps {
  items: StatItem[]
  columns?: 1 | 2 | 3
  className?: string
}

export default function StatsGrid({
  items,
  columns = 3,
  className,
}: StatsGridProps) {
  const colsClass =
    columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <div className={cn('grid gap-2', colsClass, className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center rounded-md border p-2">
          <span className="font-bold tabular-nums">{item.value}</span>
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  )
}