import { useState, useEffect, useRef } from 'react'
import { Timer, Pencil, Trash2, Globe, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
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
import type { BlockRule, DailyUsage, TimeLimit, TrackingState } from '../lib/types'
import { elapsedTrackingSeconds, todayStr } from '../lib/usage'
import { formatDuration, formatUnit } from '@/lib/i18n'
import { t } from '../lib/i18n'

interface LimitsTabProps {
  limits: TimeLimit[]
  rules: BlockRule[]
  usage: DailyUsage
  tracking: TrackingState | null
  onAddLimit: (pattern: string, dailyMinutes: number) => void
  onRemoveLimit: (id: string) => void
  onUpdateLimit: (id: string, dailyMinutes: number) => void
  prefillDomain?: string | null
  prefillTrigger?: number
}

const PRESET_MINUTES = [
  { label: formatUnit(15, 'minute', 'short'), value: 15 },
  { label: formatUnit(30, 'minute', 'short'), value: 30 },
  { label: formatUnit(1, 'hour'), value: 60 },
  { label: formatUnit(2, 'hour'), value: 120 },
  { label: formatUnit(3, 'hour'), value: 180 },
  { label: t('customLimit'), value: -1 },
]

function splitMinutes(totalMinutes: number): { hours: string; minutes: string } {
  const safe = Math.max(0, Math.floor(totalMinutes))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return {
    hours: hours > 0 ? String(hours) : '',
    minutes: minutes > 0 ? String(minutes) : '',
  }
}

function combineHoursMinutes(hours: string, minutes: string): number {
  const h = Math.max(0, Number(hours || '0'))
  const m = Math.max(0, Number(minutes || '0'))
  return h * 60 + m
}

/** A daily limit such as "30m" or "1h 30m". */
function formatMinutes(m: number): string {
  return formatDuration(Math.max(0, Math.floor(m)) * 60, 2)
}

export default function LimitsTab({
  limits,
  rules,
  usage,
  tracking,
  onAddLimit,
  onRemoveLimit,
  onUpdateLimit,
  prefillDomain,
  prefillTrigger,
}: LimitsTabProps) {
  const { ref: limitsRef, needsPadding: limitsPadding } = useScrollable()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const lastHandledPrefillTrigger = useRef<number | null>(null)

  // Tick every second to update live counters
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Add form state
  const [selectedDomain, setSelectedDomain] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('30')
  const [customHours, setCustomHours] = useState('')
  const [customMinutes, setCustomMinutes] = useState('')

  // Edit form state
  const [editPreset, setEditPreset] = useState('30')
  const [editCustomHours, setEditCustomHours] = useState('')
  const [editCustom, setEditCustom] = useState('')

  const existingLimitPatterns = new Set(limits.map((l) => l.pattern))
  const availableDomains = rules
    .map((r) => r.pattern)
    .filter((p) => !existingLimitPatterns.has(p))
  const hasAvailableDomains = availableDomains.length > 0
  const orderedLimits = [...limits].reverse()

  const resetAdd = () => {
    setSelectedDomain('')
    setSelectedPreset('30')
    setCustomHours('')
    setCustomMinutes('')
  }

  useEffect(() => {
    if (!prefillDomain || prefillTrigger == null) return
    if (lastHandledPrefillTrigger.current === prefillTrigger) return
    lastHandledPrefillTrigger.current = prefillTrigger

    const existing = limits.find((l) => l.pattern === prefillDomain)
    if (existing) {
      startEditing(existing)
      return
    }
    if (!availableDomains.includes(prefillDomain)) return
    resetAdd()
    setSelectedDomain(prefillDomain)
    setEditingId(null)
    setShowAdd(true)
  }, [prefillTrigger, prefillDomain, limits, availableDomains])

  const handleAdd = () => {
    if (!selectedDomain) return
    const preset = Number(selectedPreset)
    const minutes = preset === -1 ? combineHoursMinutes(customHours, customMinutes) : preset
    if (!minutes || minutes <= 0) return
    onAddLimit(selectedDomain, minutes)
    resetAdd()
    setShowAdd(false)
  }

  const startEditing = (limit: TimeLimit) => {
    setEditingId(limit.id)
    const matchingPreset = PRESET_MINUTES.find((p) => p.value === limit.dailyMinutes)
    if (matchingPreset) {
      setEditPreset(String(matchingPreset.value))
      setEditCustomHours('')
      setEditCustom('')
    } else {
      const split = splitMinutes(limit.dailyMinutes)
      setEditPreset('-1')
      setEditCustomHours(split.hours)
      setEditCustom(split.minutes)
    }
    setShowAdd(false)
  }

  const handleEdit = () => {
    if (!editingId) return
    const preset = Number(editPreset)
    const minutes = preset === -1 ? combineHoursMinutes(editCustomHours, editCustom) : preset
    if (!minutes || minutes <= 0) return
    onUpdateLimit(editingId, minutes)
    setEditingId(null)
  }

  const today = todayStr()

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ItemCounter
        count={limits.length}
        label={t('timeLimits')}
        onAdd={() => { setShowAdd(true); setEditingId(null); resetAdd() }}
        addTitle={t('addLimit')}
      />

      <div className="min-h-0 flex-1">
        <div
          ref={limitsRef}
          className={`flex h-full min-h-0 flex-col gap-3 overflow-y-scroll ${limitsPadding ? 'pr-3' : ''}`}
        >
          {showAdd && (
            <ContentCard
              title={t('newTimeLimit')}
              description={t('newTimeLimitDescription')}
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
                  <Label>{t('site')}</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                        disabled={!hasAvailableDomains}
                      >
                        <span className="truncate">{hasAvailableDomains ? (selectedDomain || t('selectSite')) : t('noSites')}</span>
                        <ChevronDown size={14} className="shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                      {availableDomains.map((domain) => (
                        <DropdownMenuItem key={domain} onClick={() => setSelectedDomain(domain)}>
                          {domain}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-xs text-muted-foreground">{t('limitSiteHint')}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{t('dailyLimit')}</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">{PRESET_MINUTES.find((p) => String(p.value) === selectedPreset)?.label ?? t('select')}</span>
                        <ChevronDown size={14} className="shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                      {PRESET_MINUTES.map((p) => (
                        <DropdownMenuItem key={p.value} onClick={() => setSelectedPreset(String(p.value))}>
                          {p.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {selectedPreset === '-1' && (
                  <div className="flex flex-col gap-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label>{t('hours')}</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={customHours}
                          onChange={(e) => setCustomHours(e.target.value)}
                          min={0}
                          className="w-full"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label>{t('minutes')}</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(e.target.value)}
                          min={0}
                          max={59}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

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
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={
                      !selectedDomain ||
                      (selectedPreset === '-1' && combineHoursMinutes(customHours, customMinutes) <= 0)
                    }
                  >
                    {t('addLimit')}
                  </Button>
                </div>
              </form>
            </ContentCard>
          )}

          {limits.length === 0 && !showAdd ? (
            <EmptyState
              icon={<Timer />}
              title={t('noLimitsTitle')}
              description={t('noLimitsDescription')}
            />
          ) : (
            orderedLimits.map((limit) => {
              const usageEntry = usage[limit.pattern]
              const storedSeconds =
                usageEntry && usageEntry.date === today ? usageEntry.seconds : 0
              // Add un-flushed live tracking seconds
              const liveExtra =
                tracking && tracking.domain === limit.pattern
                  ? elapsedTrackingSeconds(tracking.startedAt)
                  : 0
              const totalSeconds = storedSeconds + liveExtra
              const limitSeconds = limit.dailyMinutes * 60
              const pct = Math.min(100, (totalSeconds / limitSeconds) * 100)
              const exceeded = totalSeconds >= limitSeconds
              const remainingSeconds = Math.max(0, limitSeconds - totalSeconds)
              // Reference tick to prevent unused variable warning
              void tick

              if (editingId === limit.id) {
                return (
                  <ContentCard
                    key={limit.id}
                    title={t('editLimit')}
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
                        <Label>{t('site')}</Label>
                        <Button variant="outline" className="w-full justify-between font-normal" disabled>
                          <span className="truncate">{limit.pattern || t('selectSite')}</span>
                          <ChevronDown size={14} className="shrink-0 opacity-50" />
                        </Button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>{t('dailyLimit')}</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal">
                              <span className="truncate">{PRESET_MINUTES.find((p) => String(p.value) === editPreset)?.label ?? t('select')}</span>
                              <ChevronDown size={14} className="shrink-0 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                            {PRESET_MINUTES.map((p) => (
                              <DropdownMenuItem key={p.value} onClick={() => setEditPreset(String(p.value))}>
                                {p.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {editPreset === '-1' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <Label>{t('hours')}</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={editCustomHours}
                                onChange={(e) => setEditCustomHours(e.target.value)}
                                min={0}
                                className="w-full"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label>{t('minutes')}</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={editCustom}
                                onChange={(e) => setEditCustom(e.target.value)}
                                min={0}
                                max={59}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <Separator className="my-1" />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setEditingId(null)}
                        >
                          {t('cancel')}
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={editPreset === '-1' && combineHoursMinutes(editCustomHours, editCustom) <= 0}
                        >
                          {t('save')}
                        </Button>
                      </div>
                    </form>
                  </ContentCard>
                )
              }

              return (
                <ContentCard
                  key={limit.id}
                  title={limit.pattern}
                  icon={<Globe size={14} />}
                  action={
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditing(limit)}
                        title={t('editLimitTooltip')}
                      >
                        <Pencil size={12} />
                      </Button>
                      <DeleteDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" title={t('removeLimitTooltip')}>
                            <Trash2 size={12} />
                          </Button>
                        }
                        title={t('deleteLimitTitle')}
                        description={t('deleteLimitDescription', limit.pattern)}
                        onConfirm={() => onRemoveLimit(limit.id)}
                      />
                    </div>
                  }
                >
                  <div className="space-y-1.5">
                    <Progress
                      value={pct}
                      className={`h-2.5 ${exceeded ? '*:data-[slot=progress-indicator]:bg-destructive' : ''}`}
                    />
                    <div className="flex items-end justify-between gap-3 text-sm tabular-nums">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs text-muted-foreground">{t('usage')}</p>
                        <p className={`leading-none ${tracking?.domain === limit.pattern ? 'text-foreground' : 'text-foreground/90'}`}>
                          {t('usageOf', formatDuration(totalSeconds), formatMinutes(limit.dailyMinutes))}
                        </p>
                      </div>
                      <div className="ml-auto flex flex-col items-end gap-0.5 text-right">
                        <p className="text-xs text-muted-foreground">{t('timeLeft')}</p>
                        <p className="leading-none text-foreground/90">
                          {exceeded ? t('limitReached') : formatDuration(remainingSeconds)}
                        </p>
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
