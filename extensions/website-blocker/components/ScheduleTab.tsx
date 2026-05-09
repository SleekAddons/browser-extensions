import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronDown, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ContentCard from '@/components/ContentCard'
import DeleteDialog from '@/components/DeleteDialog'
import EmptyState from '@/components/EmptyState'
import ItemCounter from '@/components/ItemCounter'
import { useScrollable } from '@/lib/useScrollable'
import type { BlockRule, Schedule } from '../lib/types'

function getLocaleFirstDayOfWeek(): number {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      weekInfo?: { firstDay?: number }
    }
    const firstDay = locale.weekInfo?.firstDay
    if (typeof firstDay === 'number') {
      return firstDay % 7
    }
  }
  catch {
    // Fallback to Sunday when locale week metadata is unavailable.
  }

  return 0
}

function getWeekdayNarrowLabel(dayIndex: number): string {
  const sunday = new Date(Date.UTC(2024, 0, 7))
  const date = new Date(sunday)
  date.setUTCDate(sunday.getUTCDate() + dayIndex)

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'narrow',
    timeZone: 'UTC',
  }).format(date)
}

function formatTimeForLocale(time: string): string {
  const [hourString, minuteString] = time.split(':')
  const hour = Number(hourString)
  const minute = Number(minuteString)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time

  const date = new Date()
  date.setHours(hour, minute, 0, 0)

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function parseTimeInput(value: string): string | null {
  const trimmed = value.trim()

  const twentyFourHourMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (twentyFourHourMatch) {
    const hour = twentyFourHourMatch[1].padStart(2, '0')
    const minute = twentyFourHourMatch[2]
    return `${hour}:${minute}`
  }

  const normalized = trimmed.replace(/\./g, '').toUpperCase()
  const twelveHourMatch = normalized.match(/^(1[0-2]|0?[1-9]):([0-5]\d)\s*([AP]M)$/)
  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1])
    const minute = twelveHourMatch[2]
    const period = twelveHourMatch[3]

    if (period === 'PM' && hour < 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0

    return `${String(hour).padStart(2, '0')}:${minute}`
  }

  return null
}

interface ScheduleTabProps {
  schedules: Schedule[]
  rules: BlockRule[]
  onAddSchedule: (schedule: Omit<Schedule, 'id'>) => void
  onRemoveSchedule: (id: string) => void
  onUpdateSchedule: (id: string, data: Omit<Schedule, 'id' | 'enabled'>) => void
  prefillDomain?: string | null
  prefillTrigger?: number
}

function DayPicker({
  days,
  onToggle,
  firstDayOfWeek,
  disabled = false,
}: {
  days: number[]
  onToggle: (d: number) => void
  firstDayOfWeek: number
  disabled?: boolean
}) {
  const orderedDayIndices = useMemo(
    () => Array.from({ length: 7 }, (_, offset) => (firstDayOfWeek + offset) % 7),
    [firstDayOfWeek],
  )

  return (
    <div className="flex gap-1">
      {orderedDayIndices.map((dayIndex) => (
        <Button
          key={dayIndex}
          type="button"
          variant={days.includes(dayIndex) ? 'default' : 'outline'}
          size="sm"
          className="h-7 w-9 px-0 text-xs"
          disabled={disabled}
          onClick={() => onToggle(dayIndex)}
        >
          {getWeekdayNarrowLabel(dayIndex)}
        </Button>
      ))}
    </div>
  )
}

export default function ScheduleTab({
  schedules,
  rules,
  onAddSchedule,
  onRemoveSchedule,
  onUpdateSchedule,
  prefillDomain,
  prefillTrigger,
}: ScheduleTabProps) {
  const { ref: schedulesRef, needsPadding: schedulesPadding } = useScrollable()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const lastHandledPrefillTrigger = useRef<number | null>(null)

  // Add form state
  const [name, setName] = useState('')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [startTimeInput, setStartTimeInput] = useState(() => formatTimeForLocale('09:00'))
  const [endTimeInput, setEndTimeInput] = useState(() => formatTimeForLocale('17:00'))
  const [pattern, setPattern] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDays, setEditDays] = useState<number[]>([])
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editStartTimeInput, setEditStartTimeInput] = useState('')
  const [editEndTimeInput, setEditEndTimeInput] = useState('')
  const [editPattern, setEditPattern] = useState('')

  const allDomains = rules.map((r) => r.pattern)
  const hasDomains = allDomains.length > 0
  const orderedSchedules = [...schedules].reverse()
  const firstDayOfWeek = useMemo(() => getLocaleFirstDayOfWeek(), [])
  const localeTimeExample = useMemo(() => formatTimeForLocale('13:05'), [])

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  const toggleEditDay = (day: number) => {
    setEditDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  const resetAdd = () => {
    setName('')
    setDays([1, 2, 3, 4, 5])
    setStartTime('09:00')
    setEndTime('17:00')
    setStartTimeInput(formatTimeForLocale('09:00'))
    setEndTimeInput(formatTimeForLocale('17:00'))
    setPattern('')
  }

  const openPrefilledAdd = (domain: string) => {
    resetAdd()
    setName(`${domain} schedule`)
    setPattern(domain)
    setEditingId(null)
    setShowAdd(true)
  }

  const handleAdd = () => {
    if (!name.trim() || days.length === 0 || !pattern) return
    onAddSchedule({
      name: name.trim(),
      days,
      startTime,
      endTime,
      patterns: [pattern],
      enabled: true,
    })
    resetAdd()
    setShowAdd(false)
  }

  const startEditing = (schedule: Schedule) => {
    setEditingId(schedule.id)
    setEditName(schedule.name)
    setEditDays([...schedule.days])
    setEditStartTime(schedule.startTime)
    setEditEndTime(schedule.endTime)
    setEditStartTimeInput(formatTimeForLocale(schedule.startTime))
    setEditEndTimeInput(formatTimeForLocale(schedule.endTime))
    setEditPattern(schedule.patterns?.[0] ?? '')
    setShowAdd(false)
  }

  const handleEdit = () => {
    if (!editingId || !editName.trim() || editDays.length === 0 || !editPattern) return
    onUpdateSchedule(editingId, {
      name: editName.trim(),
      days: editDays,
      startTime: editStartTime,
      endTime: editEndTime,
      patterns: [editPattern],
    })
    setEditingId(null)
  }

  useEffect(() => {
    if (!prefillDomain || prefillTrigger == null) return
    if (lastHandledPrefillTrigger.current === prefillTrigger) return
    lastHandledPrefillTrigger.current = prefillTrigger

    const existing = schedules.find((s) => s.patterns?.includes(prefillDomain))
    if (existing) {
      startEditing(existing)
      return
    }

    if (!allDomains.includes(prefillDomain)) return
    openPrefilledAdd(prefillDomain)
  }, [prefillTrigger, prefillDomain, schedules, allDomains])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ItemCounter
        count={schedules.length}
        label="Schedules"
        onAdd={() => { setShowAdd(true); setEditingId(null); resetAdd() }}
        addLabel="Schedule"
      />

      <div className="min-h-0 flex-1">
        <div
          ref={schedulesRef}
          className={`flex h-full min-h-0 flex-col gap-3 overflow-y-scroll ${schedulesPadding ? 'pr-3' : ''}`}
        >
          {showAdd && (
            <ContentCard
              title="New Schedule"
              description="Set when blocking is active for a site."
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setShowAdd(false); resetAdd() }}
                >
                  <X size={14} />
                </Button>
              }
            >
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleAdd()
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label>Site</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                        disabled={!hasDomains}
                      >
                        <span className="truncate">{hasDomains ? (pattern || 'Select site…') : 'No sites'}</span>
                        <ChevronDown size={14} className="shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                      {allDomains.map((domain) => (
                        <DropdownMenuItem key={domain} onClick={() => setPattern(domain)}>
                          {domain}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-xs text-muted-foreground">Choose the site this schedule should apply to.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g. Work hours"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    className="w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Active days</Label>
                  <DayPicker days={days} onToggle={toggleDay} firstDayOfWeek={firstDayOfWeek} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label>Start Time</Label>
                      <Input
                        value={startTimeInput}
                        onChange={(e) => {
                          const value = e.target.value
                          setStartTimeInput(value)
                          const parsed = parseTimeInput(value)
                          if (parsed) setStartTime(parsed)
                        }}
                        onBlur={() => setStartTimeInput(formatTimeForLocale(startTime))}
                        placeholder={localeTimeExample}
                        className="time-input-no-icon h-8 w-full text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>End Time</Label>
                      <Input
                        value={endTimeInput}
                        onChange={(e) => {
                          const value = e.target.value
                          setEndTimeInput(value)
                          const parsed = parseTimeInput(value)
                          if (parsed) setEndTime(parsed)
                        }}
                        onBlur={() => setEndTimeInput(formatTimeForLocale(endTime))}
                        placeholder={localeTimeExample}
                        className="time-input-no-icon h-8 w-full text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Use local time format (e.g. {localeTimeExample}).</p>
                </div>

                <Separator className="my-1" />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAdd(false)
                      resetAdd()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!name.trim() || days.length === 0 || !pattern}
                  >
                    Add Schedule
                  </Button>
                </div>
              </form>
            </ContentCard>
          )}

          {schedules.length === 0 && !showAdd ? (
            <EmptyState
              icon={<CalendarClock />}
              title="No schedules configured."
              description="Without schedules, blocking rules are always active when enabled."
            />
          ) : (
            orderedSchedules.map((schedule) => {
              if (editingId === schedule.id) {
                return (
                  <ContentCard
                    key={schedule.id}
                    title="Edit Schedule"
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingId(null)}
                      >
                        <X size={14} />
                      </Button>
                    }
                  >
                    <form
                      noValidate
                      className="flex flex-col gap-4"
                      onSubmit={(event) => {
                        event.preventDefault()
                        handleEdit()
                      }}
                    >
                      <div className="flex flex-col gap-1.5">
                        <Label>Site</Label>
                        <Button variant="outline" className="w-full justify-between font-normal" disabled>
                          <span className="truncate">{editPattern || 'Select site…'}</span>
                          <ChevronDown size={14} className="shrink-0 opacity-50" />
                        </Button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>Name</Label>
                        <Input
                          placeholder="e.g. Work hours"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          className="w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>Active days</Label>
                        <DayPicker days={editDays} onToggle={toggleEditDay} firstDayOfWeek={firstDayOfWeek} />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <Label>Start Time</Label>
                            <Input
                              value={editStartTimeInput}
                              onChange={(e) => {
                                const value = e.target.value
                                setEditStartTimeInput(value)
                                const parsed = parseTimeInput(value)
                                if (parsed) setEditStartTime(parsed)
                              }}
                              onBlur={() => setEditStartTimeInput(formatTimeForLocale(editStartTime))}
                              placeholder={localeTimeExample}
                              className="time-input-no-icon h-8 w-full text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label>End Time</Label>
                            <Input
                              value={editEndTimeInput}
                              onChange={(e) => {
                                const value = e.target.value
                                setEditEndTimeInput(value)
                                const parsed = parseTimeInput(value)
                                if (parsed) setEditEndTime(parsed)
                              }}
                              onBlur={() => setEditEndTimeInput(formatTimeForLocale(editEndTime))}
                              placeholder={localeTimeExample}
                              className="time-input-no-icon h-8 w-full text-sm"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Use local time format (e.g. {localeTimeExample}).</p>
                      </div>

                      <Separator className="my-1" />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={!editName.trim() || editDays.length === 0 || !editPattern}
                        >
                          Save
                        </Button>
                      </div>
                    </form>
                  </ContentCard>
                )
              }

              return (
                <ContentCard
                  key={schedule.id}
                  title={schedule.name}
                  action={
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditing(schedule)}
                        title="Edit schedule"
                      >
                        <Pencil size={12} />
                      </Button>
                      <DeleteDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Remove schedule">
                            <Trash2 size={12} />
                          </Button>
                        }
                        entityName="schedule"
                        description={`This will permanently delete the "${schedule.name}" schedule.`}
                        onConfirm={() => onRemoveSchedule(schedule.id)}
                      />
                    </div>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Site</Label>
                      <Button variant="outline" className="h-8 w-full justify-between text-sm font-normal" disabled>
                        <span className="truncate">{schedule.patterns?.[0] || 'No site selected'}</span>
                        <ChevronDown size={14} className="shrink-0 opacity-50" />
                      </Button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Name</Label>
                      <Input value={schedule.name} disabled className="w-full" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Days</Label>
                      <DayPicker days={schedule.days} onToggle={() => {}} firstDayOfWeek={firstDayOfWeek} disabled />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <Label>Start Time</Label>
                          <Input
                            value={formatTimeForLocale(schedule.startTime)}
                            disabled
                            className="time-input-no-icon h-8 w-full text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>End Time</Label>
                          <Input
                            value={formatTimeForLocale(schedule.endTime)}
                            disabled
                            className="time-input-no-icon h-8 w-full text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </ContentCard>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
