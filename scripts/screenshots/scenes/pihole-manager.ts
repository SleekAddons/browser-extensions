import type { FetchMock, Scene } from '../stage'

const NEWS_TAB = {
  url: 'https://news.example.com/',
  title: 'The Morning Ledger — Local news',
}

const POPUP = { kind: 'popup', width: 400, height: 600 } as const
const READY = { frame: 'popup', selector: 'text=All 2 instances enabled' } as const

const INSTANCES = [
  { id: 'home', name: 'Home Pi-hole', baseUrl: 'http://192.168.1.2', password: 'demo-password' },
  { id: 'backup', name: 'Backup Pi-hole', baseUrl: 'http://192.168.1.3', password: 'demo-password' },
]

const STATS: Record<string, { total: number; blocked: number }> = {
  home: { total: 48_213, blocked: 9_127 },
  backup: { total: 21_544, blocked: 3_876 },
}

type DomainRule = { domain: string; type: 'allow' | 'deny'; kind: 'exact' | 'regex'; enabled: boolean; comment: string | null }

/** Canned Pi-hole v6 API responses for both instances. */
function piholeApi(domainRules: DomainRule[] = []): FetchMock[] {
  return INSTANCES.flatMap((instance) => {
    const api = `${instance.baseUrl}/api`
    const { total, blocked } = STATS[instance.id]
    return [
      {
        method: 'POST',
        url: `${api}/auth`,
        json: { session: { valid: true, totp: false, sid: `sid-${instance.id}`, csrf: 'csrf', validity: 1800, message: 'password correct' } },
      },
      {
        url: `${api}/stats/summary`,
        json: {
          queries: {
            total,
            blocked,
            percent_blocked: (blocked / total) * 100,
            unique_domains: 3_412,
            forwarded: total - blocked - 8_000,
            cached: 8_000,
            frequency: 1.2,
          },
          clients: { active: 14, total: 19 },
          gravity: { domains_being_blocked: 182_461, last_update: 1_763_452_800 },
        },
      },
      { url: `${api}/dns/blocking`, json: { blocking: 'enabled', timer: null } },
      {
        url: `${api}/search/*`,
        json: { search: { domains: domainRules, gravity: [], results: { total: domainRules.length } } },
      },
    ]
  })
}

export const piholeManagerScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'Status, query stats and blocking switches for all your Pi-hole instances',
    layout: 'split-left',
    theme: 'light',
    headline: 'Every Pi-hole, one click away',
    subhead: 'See query stats and switch ad blocking on or off for all your Pi-hole instances at once.',
    chips: ['Pi-hole v6', 'Multiple instances'],
    tab: NEWS_TAB,
    ui: POPUP,
    storage: { local: { pihole_instances: INSTANCES } },
    fetch: piholeApi(),
    ready: READY,
    actions: [{ waitFor: 'text=No rules found for this domain.' }],
  },
  {
    file: '2.png',
    caption: 'Disable blocking for 10 seconds, 30 seconds, 5 minutes or indefinitely',
    layout: 'split-right',
    theme: 'dark',
    headline: 'Pause blocking when a site breaks',
    subhead: 'Turn blocking off for a few seconds or minutes. It switches back on by itself.',
    chips: ['10 s', '30 s', '5 min', 'Indefinitely'],
    tab: NEWS_TAB,
    ui: POPUP,
    storage: { local: { pihole_instances: INSTANCES } },
    fetch: piholeApi(),
    ready: READY,
    actions: [
      { waitFor: 'text=No rules found for this domain.' },
      { click: 'button:has-text("Disable blocking for")' },
      { waitFor: 'role=menuitem[name="5 minutes"]' },
    ],
  },
  {
    file: '3.png',
    caption: 'Check the current site against your lists and allow or block it',
    layout: 'split-left',
    theme: 'light',
    headline: 'Allow or block the site you’re on',
    subhead: 'See whether the current domain is on your allow or deny list, and change it in one click.',
    tab: NEWS_TAB,
    ui: POPUP,
    storage: { local: { pihole_instances: INSTANCES } },
    fetch: piholeApi([{ domain: 'news.example.com', type: 'deny', kind: 'exact', enabled: true, comment: null }]),
    ready: READY,
    actions: [
      { waitFor: 'text=Remove Block' },
      { scrollIntoView: 'button:has-text("Disable blocking for")', offset: 0 },
    ],
  },
]
