import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { t } from '@/lib/i18n'

interface ScanButtonProps {
  /** Button label when idle */
  label?: string
  /** Button label while scanning */
  loadingLabel?: string
  /** Icon shown when idle */
  icon?: ReactNode
  /** Whether a scan is in progress */
  loading?: boolean
  /** Whether the button is disabled */
  disabled?: boolean
  /** Click handler to trigger the scan */
  onClick: () => void
}

export default function ScanButton(props: ScanButtonProps) {
  const {
    label = t('scanPage'),
    loadingLabel = t('scanning'),
    icon,
    loading = false,
    disabled = false,
    onClick,
  } = props

  return (
    <Button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full"
    >
      {loading ? <Spinner className="size-3.5" /> : icon}
      {loading ? loadingLabel : label}
    </Button>
  )
}
