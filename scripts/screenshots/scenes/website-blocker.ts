import { todayStr } from '../../../extensions/website-blocker/lib/usage'
import type { Scene } from '../stage'

const NEWS_TAB = {
  url: 'https://news.example.com/',
  title: 'The Morning Ledger — Local news',
}

const POPUP = { kind: 'popup', width: 500, height: 600 } as const
const READY = { frame: 'popup', selector: 'text=Blocked Sites' } as const

const NOW = Date.now()
const HOUR = 3_600_000
const today = todayStr()

/** Rules are listed newest first, so `ageHours` sets their order in the popup. */
const rule = (pattern: string, ageHours: number) => ({
  id: pattern,
  pattern,
  autoIdentifyWww: true,
  enabled: true,
  createdAt: NOW - ageHours * HOUR,
})

/**
 * Consistent with the background rules: sites with a time limit are blocked
 * once the limit is used up, the others follow the schedules that list them,
 * and a site with neither (netflix.com) is always blocked.
 */
const STORAGE = {
  local: {
    wb_settings: {
      enabled: true,
      mode: 'blocklist',
      // The popup lists rules, limits and schedules last-added first.
      rules: [
        rule('netflix.com', 360),
        rule('twitch.tv', 340),
        rule('youtube.com', 320),
        rule('reddit.com', 300),
        rule('tiktok.com', 60),
        rule('instagram.com', 40),
        rule('x.com', 20),
      ],
      limits: [
        { id: 'l-twitch', pattern: 'twitch.tv', dailyMinutes: 60, enabled: true },
        { id: 'l-youtube', pattern: 'youtube.com', dailyMinutes: 45, enabled: true },
        { id: 'l-reddit', pattern: 'reddit.com', dailyMinutes: 30, enabled: true },
      ],
      schedules: [
        {
          id: 's-weekend',
          name: 'Weekend mornings',
          days: [0, 6],
          startTime: '08:00',
          endTime: '12:00',
          patterns: ['x.com', 'instagram.com'],
          enabled: true,
        },
        {
          id: 's-work',
          name: 'Work hours',
          days: [1, 2, 3, 4, 5],
          startTime: '09:00',
          endTime: '17:30',
          patterns: ['x.com', 'instagram.com', 'tiktok.com'],
          enabled: true,
        },
      ],
    },
    wb_stats: {
      'x.com': { count: 14, lastBlocked: NOW - HOUR },
      'instagram.com': { count: 9, lastBlocked: NOW - 3 * HOUR },
      'tiktok.com': { count: 11, lastBlocked: NOW - 5 * HOUR },
      'reddit.com': { count: 6, lastBlocked: NOW - 2 * HOUR },
      'netflix.com': { count: 4, lastBlocked: NOW - 20 * HOUR },
    },
    wb_usage: {
      'reddit.com': { seconds: 30 * 60, visits: 12, date: today },
      'youtube.com': { seconds: 31 * 60, visits: 7, date: today },
      'twitch.tv': { seconds: 12 * 60, visits: 2, date: today },
    },
  },
}

export const websiteBlockerScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'Blocked sites with blocked visits, allowed visits and time spent per site',
    layout: 'split-left',
    theme: 'light',
    headline: 'Block the sites that steal your focus',
    subhead: 'Block a site all the time, only during set hours, or once its daily time limit is used up.',
    chips: ['Per-site stats', 'Pause any rule'],
    tab: NEWS_TAB,
    ui: POPUP,
    storage: STORAGE,
    ready: READY,
  },
  {
    file: '2.png',
    caption: 'Daily time limits with the time used today on each site',
    layout: 'split-right',
    theme: 'dark',
    headline: 'Daily time limits that hold',
    subhead: 'Give yourself 30 minutes of Reddit a day. When the time is up, the site stays blocked until tomorrow.',
    chips: ['Per-site limits', 'Resets daily'],
    tab: NEWS_TAB,
    ui: POPUP,
    storage: STORAGE,
    ready: READY,
    actions: [{ click: 'role=tab[name="Limits"]' }, { waitFor: 'text=twitch.tv' }],
  },
  {
    file: '3.png',
    caption: 'Schedules block sites on chosen days and hours, with a reminder page instead of the site',
    layout: 'band',
    theme: 'light',
    headline: 'Focus hours on your schedule',
    subhead: 'Block social media during work hours and let it back in when you’re done for the day.',
    tab: {
      url: 'chrome-extension://bfbhaeaddmhmiilkmolfjfppknmimpei/blocked.html?domain=x.com&reason=schedule',
      title: 'Website Blocker',
    },
    page: '/blocked.html?domain=x.com&reason=schedule',
    // Float the popup beside the reminder page instead of covering it.
    ui: { ...POPUP, at: { left: 806, top: 262 } },
    storage: STORAGE,
    ready: READY,
    actions: [{ click: 'role=tab[name="Schedule"]' }, { waitFor: 'text=Work hours' }],
  },
]
