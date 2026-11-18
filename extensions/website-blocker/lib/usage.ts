/**
 * Helpers shared by the background script and the popup so both agree on
 * what "today" is and how much un-flushed tracking time to count.
 */

/** Local calendar date as "YYYY-MM-DD", so daily usage resets at local midnight. */
export function todayStr(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Upper bound for a single tracking interval. The background flushes the
 * tracked time at least once a minute, so a longer gap means the browser was
 * closed, the computer slept or the service worker was suspended, and that
 * time must not be counted as time spent on the site.
 */
export const MAX_TRACKING_INTERVAL_SECONDS = 120

/** Seconds elapsed since a tracking interval started, capped to a sane maximum. */
export function elapsedTrackingSeconds(startedAt: number, now = Date.now()): number {
  const seconds = Math.floor((now - startedAt) / 1000)
  return Math.min(Math.max(seconds, 0), MAX_TRACKING_INTERVAL_SECONDS)
}
