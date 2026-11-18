import { type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { t } from '@/lib/i18n'

interface DeleteDialogProps {
  /** The trigger element that opens the dialog */
  trigger: ReactNode
  /** Dialog title, e.g. "Delete schedule?" (defaults to "Delete item?") */
  title?: string
  /** Dialog description - defaults to a generic warning */
  description?: string
  /** Label for the confirm button - defaults to "Delete" */
  confirmLabel?: string
  /** Called when the user confirms deletion */
  onConfirm: () => void
  /** Controlled open state (optional) */
  open?: boolean
  /** Callback when the open state changes (optional) */
  onOpenChange?: (open: boolean) => void
}

export default function DeleteDialog(props: DeleteDialogProps) {
  const {
    trigger,
    title = t('deleteItemTitle'),
    description = t('deleteItemDescription'),
    confirmLabel = t('delete'),
    onConfirm,
    open,
    onOpenChange,
  } = props

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <div className="mb-1 flex items-center gap-2 text-destructive">
            <AlertDialogTitle className="break-all">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="break-all text-balance">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm">{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
