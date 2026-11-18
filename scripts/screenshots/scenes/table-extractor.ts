import type { Scene } from '../stage'

const TAB = { url: 'https://example.com/highest-mountains', title: 'Highest mountains' }
const PAGE = '/__stage/pages/table.html'
const POPUP = { kind: 'popup', width: 400, height: 600 } as const
const READY = { frame: 'popup', selector: 'text=1 table detected on this page' } as const
const SELECT_TABLE = [{ click: 'button:has-text("Table 1")' }, { waitFor: 'text=…5 more rows' }] as const
const SHOW_EXPORT = { scrollIntoView: '[data-slot="card"]:has-text("Choose a format")', offset: 0 } as const

export const tableExtractorScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'Table Extractor finds every table on the page so you can pick one to export',
    layout: 'band',
    theme: 'dark',
    headline: 'Extract any web table in one click',
    subhead: 'Preview any table on a page and save it as a file.',
    tab: TAB,
    page: PAGE,
    ui: POPUP,
    ready: READY,
    actions: [...SELECT_TABLE],
  },
  {
    file: '2.png',
    caption: 'Export to JSON, XML, HTML, CSV or XLSX, then download or copy it',
    layout: 'split-left',
    theme: 'dark',
    headline: 'Export to JSON, CSV, Excel and more',
    subhead: 'Download a file or copy the data to your clipboard.',
    tab: TAB,
    page: PAGE,
    showPage: false,
    ui: POPUP,
    ready: READY,
    actions: [...SELECT_TABLE, SHOW_EXPORT],
  },
  {
    file: '3.png',
    caption: 'Preview the rows of the selected table before saving it as CSV',
    layout: 'split-left',
    theme: 'dark',
    headline: 'Preview first, then save',
    subhead: 'Everything runs locally in your browser.',
    tab: TAB,
    page: PAGE,
    ui: POPUP,
    ready: READY,
    actions: [...SELECT_TABLE, { click: 'text=CSV' }, SHOW_EXPORT],
  },
]
