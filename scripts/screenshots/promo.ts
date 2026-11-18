/**
 * Chrome Web Store promo tiles, rendered on the same dark stage as the store
 * screenshots: the extension's name and tagline next to its popup (taken from
 * one of its screenshot scenes). On the marquee the popup runs off the bottom
 * edge; on the small tile it is shrunk and runs off the right and bottom edges.
 *
 * Output (npm run generate-promo-tiles):
 *   extensions/<slug>/public/promo-small.png    440x280
 *   extensions/<slug>/public/promo-marquee.png  1400x560
 */

import type { Action, Scene } from './stage'
import { SCENES } from './scenes'

const SMALL = { width: 440, height: 280 }
const MARQUEE = { width: 1400, height: 560 }

/** Space between the marquee's popup and its right edge, and above the popup. */
const MARQUEE_INSET = { right: 96, top: 64 }

/** The small tile's popup: shrunk, right of the text, cut off by the right and bottom edges. */
const SMALL_POPUP = { left: 246, top: 40, scale: 0.56 }

/**
 * The two tiles for one extension. `from` is the screenshot scene whose popup
 * (with its demo data) the tiles show; `actions` default to that scene's.
 */
function promoTiles(tagline: string, from: Scene, actions: Action[] | undefined = from.actions): Scene[] {
  if (from.ui.kind !== 'popup') throw new Error(`Promo tiles need a popup scene, ${from.file} is not one`)
  const base = {
    caption: '',
    headline: '',
    subhead: tagline,
    layout: 'promo',
    theme: 'dark',
    tab: from.tab,
    storage: from.storage,
    fetch: from.fetch,
  } as const

  // The popup may read the active tab (tables, the breakpoint badge): load the page off-canvas.
  const withPopup = { page: from.page, showPage: false, ready: from.ready, actions }

  return [
    {
      ...base,
      ...withPopup,
      file: 'promo-small.png',
      size: SMALL,
      ui: { ...from.ui, at: { left: SMALL_POPUP.left, top: SMALL_POPUP.top }, scale: SMALL_POPUP.scale },
    },
    {
      ...base,
      ...withPopup,
      file: 'promo-marquee.png',
      size: MARQUEE,
      ui: {
        ...from.ui,
        at: { left: MARQUEE.width - MARQUEE_INSET.right - from.ui.width, top: MARQUEE_INSET.top },
        scale: 1,
      },
    },
  ]
}

export const PROMO_SCENES: Record<string, Scene[]> = {
  'breakpoint-viewer': promoTiles('See the active CSS breakpoint instantly.', SCENES['breakpoint-viewer'][0]),
  // The chat without the open model menu of its screenshot
  'llm-client': promoTiles('Chat with local or cloud AI in your browser.', SCENES['llm-client'][1], []),
  'pihole-manager': promoTiles('Control every Pi-hole from one place.', SCENES['pihole-manager'][0]),
  'table-extractor': promoTiles('Export any web table to CSV or XLSX.', SCENES['table-extractor'][0]),
  'website-blocker': promoTiles('Block distractions. Reclaim your focus.', SCENES['website-blocker'][0]),
}
