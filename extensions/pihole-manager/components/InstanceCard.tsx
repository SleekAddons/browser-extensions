import { useState, useEffect } from 'react'
import prettyMilliseconds from 'pretty-ms'
import type { PiholeInstanceState } from '../lib/types'
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

interface InstanceCardProps {
  state: PiholeInstanceState
  currentDomain: string | null
  onRefresh: () => void
  onToggleBlocking: (timer?: number) => void
  onAddDomain: (type: 'allow' | 'deny') => Promise<string>
  onRemoveDomain: (type: 'allow' | 'deny') => Promise<string>
  onEdit: () => void
  onDelete: () => void
}

function formatNumber(n: number): string {
  return n.toLocaleString()
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
  if (diffSec < 5) return 'just now'
  return `${prettyMilliseconds(diffSec * 1000, { unitCount: 1, secondsDecimalDigits: 0 })} ago`
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
  return prettyMilliseconds(remainingSec * 1000, {
    secondsDecimalDigits: 0,
  })
}

const DISABLE_DURATIONS = [
  { label: '10 seconds', seconds: 10 },
  { label: '30 seconds', seconds: 30 },
  { label: '5 minutes', seconds: 300 },
] as const

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
  const [copied, setCopied] = useState(false)
  const [refreshHovered, setRefreshHovered] = useState(false)

  const isEnabled = blocking?.blocking === 'enabled'
  const timeAgo = useRelativeTime(lastRefreshedAt)
  const countdown = useCountdown(disabledUntil)
  // After countdown expires, the auto-refresh takes ~1s — show loading during that gap
  const timerExpired = !isEnabled && !countdown && disabledUntil != null

  const handleDomainAction = async (
    action: 'add' | 'remove',
    type: 'allow' | 'deny',
  ) => {
    setActionLoading(true)
    try {
      const fn = action === 'add' ? onAddDomain : onRemoveDomain
      await fn(type)
    } catch {
      // errors handled upstream
    } finally {
      setActionLoading(false)
    }
  }

  const handleCopy = () => {
    if (!currentDomain) return
    navigator.clipboard.writeText(currentDomain)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Derive domain status: is it on the allow list, deny list, gravity, or unlisted?
  const domainEntries = domainStatus?.search?.domains ?? []
  const gravityEntries = domainStatus?.search?.gravity ?? []

  const isOnAllowList = domainEntries.some((d) => d.type === 'allow')
  const isOnDenyList = domainEntries.some((d) => d.type === 'deny')

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
                {timeAgo ? `Last refreshed ${timeAgo}` : 'Refresh'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            title="Edit instance"
          >
            <Pencil size={12} />
          </Button>
          <DeleteDialog
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                title="Remove instance"
              >
                <Trash2 size={12} />
              </Button>
            }
            entityName="instance"
            description={`This will permanently remove "${instance.name}" and its saved credentials.`}
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
                  ? 'Re-enabling blocking…'
                  : !isEnabled && countdown
                    ? 'Temporarily Disabled'
                    : isEnabled
                      ? 'Blocking ads and trackers'
                      : 'All queries allowed through',
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
                {timerExpired ? 'Re-enabling…' : !isEnabled && countdown ? `Enables in ${countdown}` : 'Disable blocking for…'}
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
                Indefinitely
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats grid */}
        {summary && (
          <StatsGrid
            items={[
              { label: 'Queries', value: formatNumber(summary.queries.total) },
              { label: 'Blocked', value: formatNumber(summary.queries.blocked) },
              { label: '% Blocked', value: `${summary.queries.percent_blocked.toFixed(1)}%` },
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
        {currentDomain && state.session?.sid && (
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
                title="Copy domain"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>

            {/* List matches */}
            {domainStatus?.loading && (
              <div className="flex items-center justify-center gap-1.5 py-2 text-muted-foreground">
                <Spinner className="size-3" />
                Checking rules…
              </div>
            )}

            {domainStatus?.search && !domainStatus.loading && domainEntries.length === 0 && gravityEntries.length === 0 && (
              <Alert>
                <AlertDescription>
                  No rules found for this domain.
                </AlertDescription>
              </Alert>
            )}

            {domainStatus?.search && (domainEntries.length > 0 || gravityEntries.length > 0) && (
              <div className="flex flex-col gap-1">
                {domainEntries.map((d, i) => (
                  <div key={`d-${i}`} className="flex items-center justify-between rounded border border-border/60 bg-muted/40 px-2 py-1">
                    <div className="flex items-center gap-1.5 text-foreground/80">
                      <span className="font-medium">{d.type === 'allow' ? 'Allow' : 'Deny'} list</span>
                      {!d.enabled && <Badge variant="outline" className="px-1 py-0">disabled</Badge>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5"
                      disabled={actionLoading}
                      onClick={() => handleDomainAction('remove', d.type)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {gravityEntries.map((g, i) => (
                  <div key={`g-${i}`} className="flex items-center gap-1.5 rounded border border-border/60 bg-muted/40 px-2 py-1 text-foreground/80">
                    <span className="truncate">
                      Gravity {g.type}: {g.address}
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
                onClick={() => handleDomainAction(isOnAllowList ? 'remove' : 'add', 'allow')}
              >
                {isOnAllowList ? <ShieldX size={12} /> : <ShieldMinus size={12} />}
                {isOnAllowList ? 'Remove Allow' : 'Allow'}
              </Button>
              <Button
                variant={isOnDenyList ? 'destructive' : 'outline'}
                size="sm"
                disabled={actionLoading || domainStatus?.loading}
                onClick={() => handleDomainAction(isOnDenyList ? 'remove' : 'add', 'deny')}
              >
                {isOnDenyList ? <ShieldX size={12} /> : <ShieldPlus size={12} />}
                {isOnDenyList ? 'Remove Block' : 'Block'}
              </Button>
            </div>
          </div>
        )}
    </ContentCard>
  )
}
