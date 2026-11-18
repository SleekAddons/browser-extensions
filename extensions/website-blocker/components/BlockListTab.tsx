import { useEffect, useState } from 'react'
import { Globe, Pencil, Trash2, X } from 'lucide-react'
import ContentCard from '@/components/ContentCard'
import StatsGrid from '@/components/StatsGrid'
import ExtensionToggle from '@/components/ExtensionToggle'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import EmptyState from '@/components/EmptyState'
import ItemCounter from '@/components/ItemCounter'
import { useScrollable } from '@/lib/useScrollable'
import type {
  BlockMode,
  BlockRule,
  BlockStats,
  DailyUsage,
  TimeLimit,
  Schedule,
  TrackingState,
} from '../lib/types'
import { elapsedTrackingSeconds, todayStr } from '../lib/usage'
import { formatDuration } from '@/lib/i18n'
import { t } from '../lib/i18n'

interface BlockListTabProps {
  rules: BlockRule[]
  mode: BlockMode
  stats: BlockStats
  usage: DailyUsage
  tracking: TrackingState | null
  limits: TimeLimit[]
  schedules: Schedule[]
  onAddRule: (pattern: string, autoIdentifyWww: boolean) => void
  onUpdateRule: (id: string, pattern: string, autoIdentifyWww: boolean) => void
  onRemoveRule: (id: string) => void
  onToggleRule: (id: string, enabled: boolean) => void
  onAddLimit: (domain: string) => void
  onAddSchedule: (domain: string) => void
}

export default function BlockListTab({
  rules,
  mode,
  stats,
  usage,
  tracking,
  limits,
  schedules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onToggleRule,
  onAddLimit,
  onAddSchedule,
}: BlockListTabProps) {
  const { ref: listRef, needsPadding: listPadding } = useScrollable()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [autoIdentifyWww, setAutoIdentifyWww] = useState(true)
  const [editInput, setEditInput] = useState('')
  const [editAutoIdentifyWww, setEditAutoIdentifyWww] = useState(true)
  const [tick, setTick] = useState(0)
  const orderedRules = [...rules].reverse()

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const resetAdd = () => {
    setInput('')
    setAutoIdentifyWww(true)
  }

  const handleAdd = () => {
    if (input.trim()) {
      onAddRule(input.trim(), autoIdentifyWww)
      resetAdd()
      setShowAdd(false)
    }
  }

  const startEditing = (rule: BlockRule) => {
    setEditingId(rule.id)
    setEditInput(rule.pattern)
    setEditAutoIdentifyWww(rule.autoIdentifyWww ?? true)
    setShowAdd(false)
  }

  const handleEdit = () => {
    if (!editingId || !editInput.trim()) return
    onUpdateRule(editingId, editInput.trim(), editAutoIdentifyWww)
    setEditingId(null)
  }

  const closeEdit = () => {
    setEditingId(null)
    setEditInput('')
    setEditAutoIdentifyWww(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ItemCounter
        count={rules.length}
        label={mode === 'blocklist' ? t('blockedSites') : t('allowedSites')}
        onAdd={() => {
          setShowAdd(true)
          setEditingId(null)
          resetAdd()
        }}
        addTitle={t('addSite')}
      />

      <div className="min-h-0 flex-1">
        <div
          ref={listRef}
          className={`flex h-full min-h-0 flex-col gap-3 overflow-y-scroll ${listPadding ? 'pr-3' : ''}`}
        >
          {showAdd && (
            <ContentCard
              title={t('newSiteRule')}
              description={mode === 'blocklist' ? t('addSiteToBlock') : t('addSiteToAllow')}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setShowAdd(false)
                    resetAdd()
                  }}
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
                  <Label htmlFor="site-rule-domain-add">{t('domain')}</Label>
                  <Input
                    id="site-rule-domain-add"
                    placeholder="example.com"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoComplete="off"
                    inputMode="url"
                  />
                  <p className="text-xs text-muted-foreground">{t('domainHint')}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="site-auto-www-add"
                    checked={autoIdentifyWww}
                    onCheckedChange={(checked) => setAutoIdentifyWww(Boolean(checked))}
                  />
                  <Label htmlFor="site-auto-www-add" className="leading-5">
                    {t('autoWww')}
                  </Label>
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
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={!input.trim()} className="flex-1">
                    {t('addSite')}
                  </Button>
                </div>
              </form>
            </ContentCard>
          )}

          {rules.length === 0 && !showAdd ? (
            <EmptyState
              icon={<Globe />}
              title={mode === 'blocklist' ? t('noBlockedSites') : t('noAllowedSites')}
              description={t('noSitesDescription')}
            />
          ) : (
            orderedRules.map((rule) => {
              const blockedCount = stats[rule.pattern]?.count ?? 0
              const usageEntry = usage[rule.pattern]
              const todayEntry = usageEntry && usageEntry.date === todayStr() ? usageEntry : null
              const storedSeconds = todayEntry?.seconds ?? 0
              const liveExtra =
                tracking && tracking.domain === rule.pattern
                  ? elapsedTrackingSeconds(tracking.startedAt)
                  : 0
              const secondsSpent = storedSeconds + liveExtra
              const visits = todayEntry?.visits ?? 0
              const hasLimit = limits.some((limit) => limit.pattern === rule.pattern)
              const hasSchedule = schedules.some((schedule) =>
                schedule.patterns?.includes(rule.pattern),
              )
              void tick

              if (editingId === rule.id) {
                return (
                  <ContentCard
                    key={rule.id}
                    title={t('editSiteRule')}
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={closeEdit}
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
                        <Label htmlFor={`site-rule-domain-edit-${rule.id}`}>{t('domain')}</Label>
                        <Input
                          id={`site-rule-domain-edit-${rule.id}`}
                          placeholder="example.com"
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          autoComplete="off"
                          inputMode="url"
                        />
                        <p className="text-xs text-muted-foreground">{t('domainHint')}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`site-auto-www-edit-${rule.id}`}
                          checked={editAutoIdentifyWww}
                          onCheckedChange={(checked) => setEditAutoIdentifyWww(Boolean(checked))}
                        />
                        <Label htmlFor={`site-auto-www-edit-${rule.id}`} className="leading-5">
                          {t('autoWww')}
                        </Label>
                      </div>

                      <Separator className="my-1" />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={closeEdit}
                        >
                          {t('cancel')}
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={!editInput.trim()}
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
                  key={rule.id}
                  title={rule.pattern}
                  action={
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditing(rule)}
                        title={t('editRule')}
                      >
                        <Pencil size={12} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onRemoveRule(rule.id)}
                        title={t('removeRule')}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  }
                >
                  <ExtensionToggle
                    size="mini"
                    framed={false}
                    items={[
                      {
                        icon: <Globe size={14} />,
                        label: rule.enabled ? t('ruleEnabled') : t('ruleDisabled'),
                        description: rule.enabled ? t('ruleActive') : t('rulePaused'),
                        checked: rule.enabled,
                        onChange: (checked) => onToggleRule(rule.id, checked),
                      },
                    ]}
                  />
                  <StatsGrid
                    columns={3}
                    items={[
                      { label: t('statBlockedVisits'), value: blockedCount.toLocaleString() },
                      { label: t('statAllowedVisits'), value: visits.toLocaleString() },
                      { label: t('statTimeSpent'), value: formatDuration(secondsSpent) },
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddLimit(rule.pattern)}
                    >
                      {hasLimit && (
                        <span className="mr-1 size-1.5 rounded-full bg-current" aria-hidden="true" />
                      )}
                      {hasLimit ? t('editLimit') : t('addLimit')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddSchedule(rule.pattern)}
                    >
                      {hasSchedule && (
                        <span className="mr-0.5 size-1.5 rounded-full bg-current" aria-hidden="true" />
                      )}
                      {hasSchedule ? t('editSchedule') : t('addSchedule')}
                    </Button>
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
