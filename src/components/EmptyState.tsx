import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Icon element (size and color are standardized by EmptyState) */
  icon?: ReactNode
  /** Primary message */
  title: ReactNode
  /** Secondary / descriptive message */
  description?: ReactNode
  /** Extra content such as action buttons */
  children?: ReactNode
  /** Additional class names applied to the container */
  className?: string
}

export default function EmptyState({ icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-8 py-6 text-center text-muted-foreground', className)}>
      {icon && <span className="mb-1 text-muted-foreground opacity-25 [&_svg]:size-8 [&_svg]:shrink-0">{icon}</span>}
      <p className="text-sm font-medium text-balance">{title}</p>
      {description && <p className="text-sm text-balance">{description}</p>}
      {children}
    </div>
  )
}
