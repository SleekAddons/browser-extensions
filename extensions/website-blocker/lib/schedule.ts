import type { Schedule } from './types'

/**
 * Whether a schedule's time window covers `now`. The end time is exclusive
 * (09:00–17:00 ends at 17:00) and equal start/end times mean the whole day.
 */
export function isScheduleActive(
  schedule: Pick<Schedule, 'days' | 'startTime' | 'endTime'>,
  now: Date,
): boolean {
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = schedule.startTime.split(':').map(Number)
  const [eh, em] = schedule.endTime.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  const days = schedule.days ?? []

  if (start === end) return days.includes(day)
  if (start < end) return days.includes(day) && mins >= start && mins < end
  // Overnight window (e.g. 22:00 → 06:00): the part after midnight belongs to
  // the window that started the previous evening, so check yesterday's day.
  return (days.includes(day) && mins >= start) || (days.includes((day + 6) % 7) && mins < end)
}
