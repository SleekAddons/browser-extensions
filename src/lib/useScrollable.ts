import { useEffect, useRef, useState } from 'react'

const isFirefox = typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent)

/**
 * Detects whether an element's content overflows vertically (is scrollable).
 * Uses ResizeObserver + MutationObserver to stay in sync when content changes.
 *
 * `needsPadding` is true when the content overflows AND the browser uses
 * layout-consuming (non-overlay) scrollbars. Firefox uses overlay scrollbars
 * so extra padding is not needed there.
 */
export function useScrollable<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [isScrollable, setIsScrollable] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const check = () => {
      setIsScrollable(el.scrollHeight > el.clientHeight)
    }

    check()

    const resizeObserver = new ResizeObserver(check)
    resizeObserver.observe(el)

    // Content additions/removals may change scrollHeight without resizing the container
    const mutationObserver = new MutationObserver(check)
    mutationObserver.observe(el, { childList: true, subtree: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  const needsPadding = !isFirefox

  return { ref, isScrollable, needsPadding }
}
