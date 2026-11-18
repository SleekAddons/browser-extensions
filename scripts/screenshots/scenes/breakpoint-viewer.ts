import type { Scene } from '../stage'

const LOCALHOST_TAB = {
  url: 'http://localhost:3000/',
  title: 'Lumen — Analytics your whole team can read',
}

const POPUP = { kind: 'popup', width: 400, height: 600 } as const
const READY = { frame: 'popup', selector: 'text=Badge position' } as const

const CUSTOM_BREAKPOINTS = [
  { name: 'mobile', minWidth: 0, color: '#a3a3a3' },
  { name: 'tablet', minWidth: 600, color: '#171717' },
  { name: 'laptop', minWidth: 1024, color: '#525252' },
  { name: 'desktop', minWidth: 1440, color: '#737373' },
]

export const breakpointViewerScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'A badge on the page shows the active CSS breakpoint and viewport width',
    layout: 'band',
    theme: 'light',
    headline: 'See the active breakpoint on any website',
    subhead: 'A color-coded badge shows the current breakpoint and viewport width while you resize.',
    tab: LOCALHOST_TAB,
    page: '/__stage/pages/landing.html',
    ui: POPUP,
    ready: READY,
  },
  {
    file: '2.png',
    caption: 'Presets for Tailwind CSS, Bootstrap, Bulma and Foundation, or custom breakpoints',
    layout: 'split-right',
    theme: 'dark',
    headline: 'Tailwind, Bootstrap, Bulma or Foundation',
    subhead: 'Load your framework’s breakpoints with one click, or define your own.',
    chips: ['4 framework presets', 'Custom breakpoints', 'Any corner'],
    tab: LOCALHOST_TAB,
    page: '/__stage/pages/landing.html',
    ui: POPUP,
    ready: READY,
    actions: [
      { scrollIntoView: '[data-slot="card"]:has-text("Load breakpoints")', offset: 196 },
      { click: 'button:has-text("Tailwind CSS")' },
      { waitFor: 'role=menuitemradio[name="Bootstrap"]' },
    ],
  },
  {
    file: '3.png',
    caption: 'Custom breakpoint names and colors, shown only on the sites you choose',
    layout: 'split-left',
    theme: 'light',
    headline: 'Your breakpoints, on your sites',
    subhead: 'Name and color your own breakpoints and pick exactly which sites show the badge.',
    chips: ['Wildcard patterns', 'Allow or exclude sites'],
    tab: LOCALHOST_TAB,
    page: '/__stage/pages/landing.html',
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
          sitePatterns: ['localhost', '*.vercel.app', 'staging.example.com'],
        },
      },
    },
    ready: READY,
    actions: [{ scrollIntoView: '[data-slot="card"]:has-text("Define the widths")', offset: 0 }],
  },
]
