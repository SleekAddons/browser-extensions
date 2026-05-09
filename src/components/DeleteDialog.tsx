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
import { TriangleAlert } from 'lucide-react'

interface DeleteDialogProps {
  /** The trigger element that opens the dialog */
  trigger: ReactNode
  /** Dialog title - defaults to "Delete {entityName}?" */
  title?: string
  /** Dialog description - defaults to a generic warning */
  description?: string
  /** Human-readable entity name used in default title/description (e.g. "instance") */
  entityName?: string
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
    title,
    description,
    entityName = 'item',
    confirmLabel = 'Delete',
    onConfirm,
    open,
    onOpenChange,
  } = props

  const resolvedTitle = title ?? `Delete ${entityName}?`
  const resolvedDescription =
    description ??
    `This will permanently delete this ${entityName}. This action cannot be undone.`

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <div className="mb-1 flex items-center gap-2 text-destructive">
            {/* <TriangleAlert size={18} /> */}
            <AlertDialogTitle className="break-all">
              {resolvedTitle}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="break-all text-balance">
            {resolvedDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
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
