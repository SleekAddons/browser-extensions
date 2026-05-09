import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RemoveButtonProps {
  onClick: () => void
  disabled?: boolean
  title?: string
}

export default function RemoveButton(props: RemoveButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title ?? 'Remove'}
    >
      <X size={13} />
    </Button>
  )
}
