import type { ReactNode } from 'react'
import { CircleCheck, CircleMinus, TriangleAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type ToggleVariant = 'enabled' | 'disabled' | 'warning'

interface ExtensionToggleProps {
  /** Whether the extension is currently enabled */
  enabled: boolean
  /** Called when the toggle changes */
  onToggle: (enabled: boolean) => void
  /** Optional description shown below the status */
  description?: string
  /** Whether the toggle is disabled */
  disabled?: boolean
  /** Override the visual variant (defaults to enabled/disabled based on `enabled`) */
  variant?: ToggleVariant
  /** Custom label for the status text (defaults to variant name) */
  statusLabel?: string
  /** Custom icon shown when enabled (defaults to CircleCheck) */
  enabledIcon?: ReactNode
  /** Custom icon shown when disabled (defaults to CircleMinus) */
  disabledIcon?: ReactNode
  /** Custom icon shown for warning state (defaults to TriangleAlert) */
  warningIcon?: ReactNode
}

interface ExtensionToggleItem {
  icon?: ReactNode
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

interface ExtensionToggleListProps {
  items: ExtensionToggleItem[]
  size?: 'default' | 'mini'
  framed?: boolean
}

type ExtensionToggleComponentProps = ExtensionToggleProps | ExtensionToggleListProps

const variantStyles = {
  enabled: {
    container: 'dark:bg-primary/5',
    icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-500',
    label: 'text-emerald-600 dark:text-emerald-500',
    defaultLabel: 'Enabled',
  },
  disabled: {
    container: 'bg-muted/50 dark:bg-muted/40',
    icon: 'bg-muted text-muted-foreground',
    label: 'text-muted-foreground',
    defaultLabel: 'Disabled',
  },
  warning: {
    container: 'bg-muted/50 dark:bg-muted/40',
    icon: 'bg-yellow-500/15 text-yellow-500 dark:text-yellow-600',
    label: 'text-yellow-500 dark:text-yellow-600',
    defaultLabel: 'Warning',
  },
} as const

export default function ExtensionToggle(props: ExtensionToggleComponentProps) {
  if ('items' in props) {
    const isMini = props.size === 'mini'
    const framed = props.framed ?? true
    const containerClassName = framed
      ? isMini
        ? 'flex flex-col gap-2 p-3'
        : 'flex flex-col gap-4'
      : isMini
        ? 'flex flex-col gap-2'
        : 'flex flex-col gap-4'

    const rows = props.items.map((item, index) => (
      <div
        key={`${item.label}-${index}`}
        className={cn(
          isMini
            ? 'flex items-center justify-between gap-3 rounded-md border px-4 py-2 transition-colors duration-200'
            : 'flex items-center justify-between',
          isMini && (item.checked ? 'bg-transparent dark:bg-input/30 dark:border-input' : 'bg-muted/40'),
        )}
      >
        {isMini ? (
          <div className="flex min-w-0 items-center gap-2">
            {item.icon && (
              <span
                className={
                  item.checked
                    ? 'flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 transition-colors duration-200 dark:text-emerald-500'
                    : 'flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors duration-200'
                }
              >
                {item.icon}
              </span>
            )}
            <div className="min-w-0">
              <Label className="text-sm font-medium leading-none">{item.label}</Label>
            </div>
          </div>
        ) : (
          <Label className="gap-2">
            {item.icon}
            {item.label}
          </Label>
        )}
        <Switch
          checked={item.checked}
          onCheckedChange={item.onChange}
          disabled={item.disabled}
        />
      </div>
    ))

    if (!framed) return <div className={containerClassName}>{rows}</div>

    return (
      <Card>
        <CardContent className={containerClassName}>{rows}</CardContent>
      </Card>
    )
  }

  const {
    enabled,
    onToggle,
    description,
    disabled,
    variant = enabled ? 'enabled' : 'disabled',
    statusLabel,
    enabledIcon = <CircleCheck size={18} />,
    disabledIcon = <CircleMinus size={18} />,
    warningIcon = <TriangleAlert size={18} />,
  } = props

  const styles = variantStyles[variant]
  const icon = variant === 'warning' ? warningIcon : enabled ? enabledIcon : disabledIcon

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border px-4 py-4 transition-colors duration-200',
        styles.container,
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
          styles.icon,
        )}
      >
        {icon}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className={cn(
          'text-base font-semibold leading-none',
          styles.label,
        )}>
          {statusLabel ?? styles.defaultLabel}
        </span>
        {description && (
          <span className="leading-tight text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </div>

      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  )
}
