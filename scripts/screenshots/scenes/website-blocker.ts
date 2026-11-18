import { todayStr } from '../../../extensions/website-blocker/lib/usage'
import type { Scene } from '../stage'

const NEWS_TAB = {
  url: 'https://example.com/',
  title: 'Example Domain',
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
 * and a site with neither (movies.example.com) is always blocked.
 */
const STORAGE = {
  local: {
    wb_settings: {
      enabled: true,
      mode: 'blocklist',
      // The popup lists rules, limits and schedules last-added first.
      rules: [
        rule('movies.example.com', 360),
        rule('games.example.com', 340),
        rule('video.example.com', 320),
        rule('forum.example.com', 300),
        rule('clips.example.com', 60),
        rule('photos.example.com', 40),
        rule('social.example.com', 20),
      ],
      limits: [
        { id: 'l-games', pattern: 'games.example.com', dailyMinutes: 60, enabled: true },
        { id: 'l-video', pattern: 'video.example.com', dailyMinutes: 45, enabled: true },
        { id: 'l-forum', pattern: 'forum.example.com', dailyMinutes: 30, enabled: true },
      ],
      schedules: [
        {
          id: 's-weekend',
          name: 'Weekend mornings',
          days: [0, 6],
          startTime: '08:00',
          endTime: '12:00',
          patterns: ['social.example.com', 'photos.example.com'],
          enabled: true,
        },
        {
          id: 's-work',
          name: 'Work hours',
          days: [1, 2, 3, 4, 5],
          startTime: '09:00',
          endTime: '17:30',
          patterns: ['social.example.com', 'photos.example.com', 'clips.example.com'],
          enabled: true,
        },
      ],
    },
    wb_stats: {
      'social.example.com': { count: 14, lastBlocked: NOW - HOUR },
      'photos.example.com': { count: 9, lastBlocked: NOW - 3 * HOUR },
      'clips.example.com': { count: 11, lastBlocked: NOW - 5 * HOUR },
      'forum.example.com': { count: 6, lastBlocked: NOW - 2 * HOUR },
      'movies.example.com': { count: 4, lastBlocked: NOW - 20 * HOUR },
    },
    wb_usage: {
      'forum.example.com': { seconds: 30 * 60, visits: 12, date: today },
      'video.example.com': { seconds: 31 * 60, visits: 7, date: today },
      'games.example.com': { seconds: 12 * 60, visits: 2, date: today },
    },
  },
}

export const websiteBlockerScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'Blocked sites with blocked visits, allowed visits and time spent per site',
    layout: 'split-left',
    theme: 'dark',
    headline: 'Block the sites that steal your focus',
    subhead: 'Always, on a schedule, or after a daily time limit.',
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
    subhead: 'When your time is up, the site stays blocked until tomorrow.',
    tab: NEWS_TAB,
    ui: POPUP,
    storage: STORAGE,
    ready: READY,
    actions: [{ click: 'role=tab[name="Limits"]' }, { waitFor: 'text=games.example.com' }],
  },
  {
    file: '3.png',
    caption: 'Schedules block sites on chosen days and hours, with a reminder page instead of the site',
    layout: 'band',
    theme: 'dark',
    headline: 'Focus hours on your schedule',
    subhead: 'Social media stays blocked during your work hours.',
    tab: {
      url: 'chrome-extension://bfbhaeaddmhmiilkmolfjfppknmimpei/blocked.html?domain=social.example.com&reason=schedule',
      title: 'Website Blocker',
    },
    page: '/blocked.html?domain=social.example.com&reason=schedule',
    // Float the popup beside the reminder page instead of covering it, just
    // under the toolbar like an open popup.
    ui: { ...POPUP, at: { left: 806, top: 228 } },
    storage: STORAGE,
    ready: READY,
    actions: [{ click: 'role=tab[name="Schedule"]' }, { waitFor: 'text=Work hours' }],
  },
]
