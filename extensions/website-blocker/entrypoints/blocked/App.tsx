import { useEffect } from 'react'
import { ShieldX, Timer, CalendarClock, ShieldBan } from 'lucide-react'
import { useTheme } from '@/lib/useTheme'
import { incrementStat } from '../../lib/storage'
import { t, tRich } from '../../lib/i18n'

const REASON_CONFIG: Record<string, {
  icon: React.ReactNode
  iconBg: string
  title: string
  /** Message with $1 for the domain */
  description: 'blockedDescription' | 'limitDescription' | 'scheduleDescription' | 'allowlistDescription'
}> = {
  blocked: {
    icon: <ShieldX size={40} className="text-destructive" />,
    iconBg: 'bg-destructive/10',
    title: t('blockedTitle'),
    description: 'blockedDescription',
  },
  limit: {
    icon: <Timer size={40} className="text-orange-500" />,
    iconBg: 'bg-orange-500/10',
    title: t('limitTitle'),
    description: 'limitDescription',
  },
  schedule: {
    icon: <CalendarClock size={40} className="text-blue-500" />,
    iconBg: 'bg-blue-500/10',
    title: t('scheduleTitle'),
    description: 'scheduleDescription',
  },
  allowlist: {
    icon: <ShieldBan size={40} className="text-destructive" />,
    iconBg: 'bg-destructive/10',
    title: t('allowlistTitle'),
    description: 'allowlistDescription',
  },
}

export default function App() {
  // Apply theme class so dark mode works on this page
  useTheme()

  const params = new URLSearchParams(window.location.search)
  const domain = params.get('domain')
  const reason = params.get('reason') ?? 'blocked'
  const config = REASON_CONFIG[reason] ?? REASON_CONFIG.blocked

  // Record the block in stats
  useEffect(() => {
    if (domain) {
      incrementStat(domain)
    }
  }, [domain])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <div className={`flex size-20 items-center justify-center rounded-full ${config.iconBg}`}>
          {config.icon}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {config.title}
          </h1>
          <p className="text-muted-foreground text-balance">
            {tRich(
              config.description,
              <span className="font-semibold text-foreground">{domain ?? t('unknownSite')}</span>,
            )}
          </p>
        </div>

        <p className="text-xs text-muted-foreground/60 text-balance">
          {t('manageHint')}
        </p>
      </div>
    </div>
  )
}
