import { cn } from '@/lib/utils'

interface PopupContainerProps {
  children: React.ReactNode
  /** Popup width in pixels (default: 400) */
  width?: number
  /** Popup max-height in pixels (default: 600) */
  height?: number
  /**
   * When true, applies a fixed `height` (instead of `max-height`) and hides
   * overflow so that flex children with `flex-1` can fill the exact popup
   * height. Useful for extensions with internal scrollable areas (e.g. chat).
   */
  fixedHeight?: boolean
  /** Additional Tailwind classes on the container */
  className?: string
}

/**
 * Wrapper that controls the popup dimensions.
 * By default sets a fixed `width` and a `max-height` with vertical scrolling.
 * Pass `fixedHeight` for layouts where children manage their own scrolling.
 * Sidepanels should **not** use this component — they fill the viewport.
 */
export default function PopupContainer({
  children,
  width = 400,
  height = 600,
  fixedHeight = false,
  className,
}: PopupContainerProps) {
  return (
    <div
      className={cn(
        'overflow-x-hidden pl-3 pr-3 py-3',
        fixedHeight ? 'overflow-y-hidden' : 'overflow-y-auto',
        className,
      )}
      style={{ width, ...(fixedHeight ? { height } : { maxHeight: height }) }}
    >
      {children}
    </div>
  )
}
