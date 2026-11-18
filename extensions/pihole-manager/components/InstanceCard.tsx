import { useState, useEffect } from 'react'
import type { PiholeInstanceState } from '../lib/types'
import type { DomainRef } from '../lib/usePiholeManager'
import ContentCard from '@/components/ContentCard'
import ExtensionToggle from '@/components/ExtensionToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import DeleteDialog from '@/components/DeleteDialog'
import StatsGrid from '@/components/StatsGrid'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  RefreshCw,
  Trash2,
  Pencil,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  ShieldMinus,
  ShieldX,
  ShieldAlert,
  Server,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react'
import { formatDuration, formatNumber, formatUnit } from '@/lib/i18n'
import { t } from '../lib/i18n'

interface InstanceCardProps {
  state: PiholeInstanceState
  currentDomain: string | null
  onRefresh: () => void
  onToggleBlocking: (timer?: number) => void
  onAddDomain: (type: 'allow' | 'deny') => Promise<string>
  onRemoveDomain: (entry: DomainRef) => Promise<void>
  onEdit: () => void
  onDelete: () => void
}

/** Returns a human-readable relative time string that updates every second. */
function useRelativeTime(timestamp: number | null): string | null {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (timestamp == null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timestamp])

  if (timestamp == null) return null

  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSec < 5) return t('justNow')
  return t('timeAgo', formatDuration(diffSec, 1))
}

/** Returns a human-readable countdown string (e.g. "2m 30s") that updates every second. */
function useCountdown(targetTimestamp: number | null): string | null {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (targetTimestamp == null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [targetTimestamp])

  if (targetTimestamp == null) return null

  const remainingSec = Math.max(0, Math.ceil((targetTimestamp - now) / 1000))
  if (remainingSec <= 0) return null
  return formatDuration(remainingSec)
}

const DISABLE_DURATIONS = [
  { label: formatUnit(10, 'second'), seconds: 10 },
  { label: formatUnit(30, 'second'), seconds: 30 },
  { label: formatUnit(5, 'minute'), seconds: 300 },
]

export default function InstanceCard(props: InstanceCardProps) {
  const {
    state,
    currentDomain,
    onRefresh,
    onToggleBlocking,
    onAddDomain,
    onRemoveDomain,
    onEdit,
    onDelete,
  } = props
  const { instance, summary, blocking, domainStatus, loading, error, lastRefreshedAt, disabledUntil } = state

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [refreshHovered, setRefreshHovered] = useState(false)

  const isEnabled = blocking?.blocking === 'enabled'
  const timeAgo = useRelativeTime(lastRefreshedAt)
  const countdown = useCountdown(disabledUntil)
  // After countdown expires, the auto-refresh takes ~1s — show loading during that gap
  const timerExpired = !isEnabled && !countdown && disabledUntil != null

  const runDomainAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true)
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('actionFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  /** Add the current domain to a list, or remove its exact entry from it. */
  const toggleListEntry = (type: 'allow' | 'deny', listed: boolean) =>
    runDomainAction(() =>
      listed && currentDomain
        ? onRemoveDomain({ domain: currentDomain, type, kind: 'exact' })
        : onAddDomain(type),
    )

  const handleCopy = async () => {
    if (!currentDomain) return
    try {
      await navigator.clipboard.writeText(currentDomain)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied; leave the button unchanged.
    }
  }

  // Derive domain status: is it on the allow list, deny list, gravity, or unlisted?
  const domainEntries = domainStatus?.search?.domains ?? []
  const gravityEntries = domainStatus?.search?.gravity ?? []

  // The Allow / Block buttons manage the exact entry for this domain. Regex
  // matches are listed separately and removed through their own entry.
  const hasExactEntry = (type: 'allow' | 'deny') =>
    domainEntries.some((d) => d.type === type && d.kind === 'exact' && d.domain.toLowerCase() === currentDomain)
  const isOnAllowList = hasExactEntry('allow')
  const isOnDenyList = hasExactEntry('deny')

  return (
    <ContentCard
      title={instance.name}
      icon={<Server size={14} />}
      action={
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip open={refreshHovered}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRefresh}
                  onMouseEnter={() => setRefreshHovered(true)}
                  onMouseLeave={() => setRefreshHovered(false)}
                  disabled={loading}
                >
                  {loading ? <Spinner className="size-3" /> : <RefreshCw size={12} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                {timeAgo ? t('lastRefreshed', timeAgo) : t('refresh')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            title={t('editInstance')}
          >
            <Pencil size={12} />
          </Button>
          <DeleteDialog
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                title={t('removeInstance')}
              >
                <Trash2 size={12} />
              </Button>
            }
            title={t('deleteInstanceTitle')}
            description={t('deleteInstanceDescription', instance.name)}
            onConfirm={onDelete}
          />
        </div>
      }
    >

        {/* Blocking toggle */}
        {blocking && (
          <ExtensionToggle
            size="mini"
            framed={false}
            items={[
              {
                icon: timerExpired
                  ? <Spinner className="size-3.5" />
                  : !isEnabled && countdown
                    ? <ShieldAlert size={14} />
                    : isEnabled
                      ? <ShieldCheck size={14} />
                      : <ShieldOff size={14} />,
                label: timerExpired
                  ? t('reenablingBlocking')
                  : !isEnabled && countdown
                    ? t('temporarilyDisabled')
                    : isEnabled
                      ? t('blockingEnabled')
                      : t('blockingDisabled'),
                checked: isEnabled,
                onChange: () => onToggleBlocking(),
                disabled: loading || timerExpired,
              },
            ]}
          />
        )}

        {/* Timed disable */}
        {blocking && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={loading || !isEnabled || timerExpired}
                size="lg"
              >
                {timerExpired ? t('reenabling') : !isEnabled && countdown ? t('enablesIn', countdown) : t('disableBlockingFor')}
                <ChevronDown size={14} className="opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
              {DISABLE_DURATIONS.map((d) => (
                <DropdownMenuItem
                  key={d.seconds}
                  onClick={() => onToggleBlocking(d.seconds)}
                >
                  {d.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => onToggleBlocking()}>
                {t('indefinitely')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t('error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats grid */}
        {summary && (
          <StatsGrid
            items={[
              { label: t('statQueries'), value: formatNumber(summary.queries.total) },
              { label: t('statBlocked'), value: formatNumber(summary.queries.blocked) },
              {
                label: t('statPercentBlocked'),
                value: formatNumber(summary.queries.percent_blocked / 100, {
                  style: 'percent',
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              },
            ]}
          />
        )}

        {/* Blocked queries chart */}
        {/* TODO: temporarily hidden – restore when ready
        {history && history.length > 0 && (
          <div className="flex flex-col gap-0.5 rounded-md border px-3 py-1.5">
            <span className="font-medium text-muted-foreground">
              Blocked Queries (24 h)
            </span>
            <BlockedChart data={history} />
          </div>
        )}
        */}

        {/* Domain status section */}
        {currentDomain && state.sid && (
          <div className="flex flex-col gap-2.5 rounded-lg border bg-muted/30 p-4">
            {/* Domain input with copy */}
            <div className="flex">
              <Input
                readOnly
                value={currentDomain}
                className="h-8 rounded-r-none border-r-0 font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 rounded-l-none px-2"
                onClick={handleCopy}
                title={t('copyDomain')}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>

            {/* List matches */}
            {domainStatus?.loading && (
              <div className="flex items-center justify-center gap-1.5 py-2 text-muted-foreground">
                <Spinner className="size-3" />
                {t('checkingRules')}
              </div>
            )}

            {domainStatus?.search && !domainStatus.loading && domainEntries.length === 0 && gravityEntries.length === 0 && (
              <Alert>
                <AlertDescription>
                  {t('noRules')}
                </AlertDescription>
              </Alert>
            )}

            {domainStatus?.search && (domainEntries.length > 0 || gravityEntries.length > 0) && (
              <div className="flex flex-col gap-1">
                {domainEntries.map((d, i) => (
                  <div key={`d-${i}`} className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/40 px-2 py-1">
                    <div className="flex min-w-0 items-center gap-1.5 text-foreground/80">
                      <span className="shrink-0 font-medium">
                        {t(d.type === 'allow'
                          ? d.kind === 'regex' ? 'allowRegex' : 'allowList'
                          : d.kind === 'regex' ? 'denyRegex' : 'denyList')}
                      </span>
                      {d.kind === 'regex' && (
                        <span className="truncate font-mono text-muted-foreground" title={d.domain}>{d.domain}</span>
                      )}
                      {!d.enabled && <Badge variant="outline" className="px-1 py-0">{t('entryDisabled')}</Badge>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 shrink-0 px-1.5"
                      disabled={actionLoading}
                      onClick={() => runDomainAction(() => onRemoveDomain(d))}
                    >
                      {t('remove')}
                    </Button>
                  </div>
                ))}
                {gravityEntries.map((g, i) => (
                  <div key={`g-${i}`} className="flex items-center gap-1.5 rounded border border-border/60 bg-muted/40 px-2 py-1 text-foreground/80">
                    <span className="truncate">
                      {t(g.type === 'allow' ? 'gravityAllow' : 'gravityBlock', g.address)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Always show both Allow and Block buttons in fixed positions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={isOnAllowList ? 'secondary' : 'outline'}
                size="sm"
                disabled={actionLoading || domainStatus?.loading}
                onClick={() => toggleListEntry('allow', isOnAllowList)}
              >
                {isOnAllowList ? <ShieldX size={12} /> : <ShieldMinus size={12} />}
                {isOnAllowList ? t('removeAllow') : t('allow')}
              </Button>
              <Button
                variant={isOnDenyList ? 'destructive' : 'outline'}
                size="sm"
                disabled={actionLoading || domainStatus?.loading}
                onClick={() => toggleListEntry('deny', isOnDenyList)}
              >
                {isOnDenyList ? <ShieldX size={12} /> : <ShieldPlus size={12} />}
                {isOnDenyList ? t('removeBlock') : t('block')}
              </Button>
            </div>

            {actionError && (
              <p className="text-sm text-destructive" role="alert">{actionError}</p>
            )}
          </div>
        )}
    </ContentCard>
  )
}
