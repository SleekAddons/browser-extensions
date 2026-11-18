import { toJson } from '../../../extensions/table-extractor/lib/exporters'
import { escapeHtml, type Scene } from '../stage'

const TAB = { url: 'https://atlas.example.com/highest-mountains', title: 'Highest mountains' }
const PAGE = '/__stage/pages/table.html'
const POPUP = { kind: 'popup', width: 400, height: 600 } as const
const READY = { frame: 'popup', selector: 'text=1 table detected on this page' } as const
const SELECT_TABLE = [{ click: 'button:has-text("Table 1")' }, { waitFor: 'text=…5 more rows' }] as const
const SHOW_EXPORT = { scrollIntoView: '[data-slot="card"]:has-text("Choose a format")', offset: 0 } as const

/** The table on the demo page (assets/pages/table.html), as the extension reads it. */
const TABLE = {
  headers: ['Mountain', 'Height (m)', 'Range', 'First ascent'],
  rows: [
    ['Mount Everest', '8,849', 'Mahalangur Himalaya', '1953'],
    ['K2', '8,611', 'Baltoro Karakoram', '1954'],
    ['Kangchenjunga', '8,586', 'Kangchenjunga Himalaya', '1955'],
    ['Lhotse', '8,516', 'Mahalangur Himalaya', '1956'],
    ['Makalu', '8,485', 'Mahalangur Himalaya', '1955'],
    ['Cho Oyu', '8,188', 'Mahalangur Himalaya', '1954'],
    ['Dhaulagiri I', '8,167', 'Dhaulagiri Himalaya', '1960'],
    ['Manaslu', '8,163', 'Manaslu Himalaya', '1956'],
    ['Nanga Parbat', '8,126', 'Nanga Parbat Himalaya', '1953'],
    ['Annapurna I', '8,091', 'Annapurna Himalaya', '1950'],
  ],
}

/** The first two records of what the extension's JSON export produces for that table. */
function jsonExcerpt(): string {
  const lines = toJson(TABLE).split('\n')
  const recordLines = TABLE.headers.length + 2
  return [
    ...lines.slice(0, 1 + 2 * recordLines).map((line) =>
      escapeHtml(line).replace(
        /^(\s*)(&quot;.*?&quot;)(: )(&quot;.*&quot;)(,?)$/,
        '$1<span class="tok-key">$2</span>$3<span class="tok-str">$4</span>$5',
      ),
    ),
    '  <span class="tok-dim">…</span>',
    ']',
  ].join('\n')
}

export const tableExtractorScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'Table Extractor finds the tables on the page — pick one to export',
    layout: 'band',
    theme: 'light',
    headline: 'Extract any web table in one click',
    subhead: 'Table Extractor finds the tables on a page so you can preview them and save them as a file.',
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
    subhead: 'Pick a format, then download the file or copy the data to your clipboard.',
    chips: ['JSON', 'XML', 'HTML', 'CSV', 'XLSX'],
    tab: TAB,
    page: PAGE,
    showPage: false,
    ui: { ...POPUP, at: { left: 512, top: 115 }, scale: 0.95 },
    ready: READY,
    actions: [...SELECT_TABLE, SHOW_EXPORT],
    extras: `<div class="card" style="left:846px;top:262px;width:372px">
      <div class="card-title">table-export.json</div>
      <pre>${jsonExcerpt()}</pre>
    </div>`,
  },
  {
    file: '3.png',
    caption: 'Preview the rows of the selected table before saving it as CSV',
    layout: 'split-left',
    theme: 'light',
    headline: 'Preview first, then save',
    subhead: 'Check the rows and columns before you export. Everything runs locally in your browser.',
    chips: ['No sign-up', 'No tracking', 'Free'],
    tab: TAB,
    page: PAGE,
    ui: POPUP,
    ready: READY,
    actions: [...SELECT_TABLE, { click: 'text=CSV' }, SHOW_EXPORT],
  },
]
