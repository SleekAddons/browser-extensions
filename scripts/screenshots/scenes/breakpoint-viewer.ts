import type { Scene } from '../stage'

const SITE_TAB = {
  url: 'https://example.com/',
  title: 'Example Domain',
}

/** An empty white page, so the badge is the only thing on it. */
const PAGE = '/__stage/pages/blank.html'

const POPUP = { kind: 'popup', width: 400, height: 600 } as const
const READY = { frame: 'popup', selector: 'text=Badge position' } as const

const CUSTOM_BREAKPOINTS = [
  { name: 'mobile', minWidth: 0, color: '#a3a3a3' },
  { name: 'tablet', minWidth: 600, color: '#525252' },
  { name: 'laptop', minWidth: 1024, color: '#d4d4d4' },
  { name: 'desktop', minWidth: 1440, color: '#737373' },
]

/**
 * Stage script that draws a red arrow pointing at the breakpoint badge on the
 * page. The tip sits just beside the badge, on the side the arrow comes from;
 * the tail is `dx`/`dy` canvas pixels away from the tip. It follows the
 * badge's real position, so layout changes cannot leave it pointing elsewhere.
 */
function pointAtBadge(dx: number, dy: number): string {
  return `(() => {
    const canvas = document.querySelector('.canvas')
    const frame = document.querySelector('iframe[data-role="page"]')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '1280')
    svg.setAttribute('height', '800')
    svg.style.cssText = 'position:absolute;left:0;top:0;z-index:5;pointer-events:none;overflow:visible'
    canvas.appendChild(svg)
    const draw = () => {
      const badge = frame.contentDocument && frame.contentDocument.getElementById('__bp-viewer-badge__')
      if (!badge || !badge.offsetWidth) return
      const c = canvas.getBoundingClientRect()
      const f = frame.getBoundingClientRect()
      const scale = f.width / frame.offsetWidth
      const b = badge.getBoundingClientRect()
      const tipX = f.left - c.left + (${dx} > 0 ? b.right * scale + 8 : b.left * scale - 8)
      const tipY = f.top - c.top + (b.top + b.height / 2) * scale
      const tailX = tipX + ${dx}
      const tailY = tipY + ${dy}
      // Gentle curve: control point pushed sideways from the middle
      const cx = (tipX + tailX) / 2 + ${dy} * 0.3
      const cy = (tipY + tailY) / 2 - ${dx} * 0.3
      const angle = Math.atan2(tipY - cy, tipX - cx)
      const at = (len, turn) => (tipX - len * Math.cos(angle + turn)) + ',' + (tipY - len * Math.sin(angle + turn))
      svg.innerHTML =
        '<path d="M' + tailX + ',' + tailY + ' Q' + cx + ',' + cy + ' ' + at(12, 0) + '" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>' +
        '<polygon points="' + tipX + ',' + tipY + ' ' + at(20, 0.5) + ' ' + at(20, -0.5) + '" fill="#ef4444" stroke="#ef4444" stroke-width="3" stroke-linejoin="round"/>'
    }
    setInterval(draw, 100)
  })()`
}

export const breakpointViewerScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'A badge on the page shows the active CSS breakpoint and viewport width',
    layout: 'band',
    theme: 'dark',
    headline: 'See the active breakpoint on any website',
    subhead: 'A color-coded badge shows the current breakpoint and viewport width while you resize.',
    tab: SITE_TAB,
    page: PAGE,
    ui: POPUP,
    ready: READY,
    stageScript: pointAtBadge(130, -30),
  },
  {
    file: '2.png',
    caption: 'Presets for Tailwind CSS, Bootstrap, Bulma and Foundation, or custom breakpoints',
    layout: 'split-right',
    theme: 'dark',
    headline: 'Tailwind, Bootstrap, Bulma or Foundation',
    subhead: 'Load your framework’s breakpoints with one click, or define your own.',
    chips: ['4 framework presets', 'Custom breakpoints', 'Any corner'],
    tab: SITE_TAB,
    page: PAGE,
    ui: POPUP,
    ready: READY,
    actions: [
      { scrollIntoView: '[data-slot="card"]:has-text("Load breakpoints")', offset: 196 },
      { click: 'button:has-text("Tailwind CSS")' },
      { waitFor: 'role=menuitemradio[name="Bootstrap"]' },
    ],
    stageScript: pointAtBadge(110, 52),
  },
  {
    file: '3.png',
    caption: 'Custom breakpoint names and colors, shown only on the sites you choose',
    layout: 'split-left',
    theme: 'dark',
    headline: 'Your breakpoints, on your sites',
    subhead: 'Name and color your own breakpoints and pick exactly which sites show the badge.',
    chips: ['Wildcard patterns', 'Allow or exclude sites'],
    tab: SITE_TAB,
    page: PAGE,
    ui: POPUP,
    storage: {
      local: {
        bpViewerSettings: {
          enabled: true,
          position: 'bottom-left',
          preset: 'custom',
          breakpoints: CUSTOM_BREAKPOINTS,
          customBreakpoints: CUSTOM_BREAKPOINTS,
          siteFilterMode: 'allowlist',
          sitePatterns: ['example.com', '*.example.com', 'localhost'],
        },
      },
    },
    ready: READY,
    actions: [{ scrollIntoView: '[data-slot="card"]:has-text("Define the widths")', offset: 0 }],
    stageScript: pointAtBadge(-120, -40),
  },
]
