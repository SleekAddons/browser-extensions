import { useEffect } from 'react'
import { ShieldX, Timer, CalendarClock, ShieldBan } from 'lucide-react'
import { useTheme } from '@/lib/useTheme'
import { incrementStat } from '../../lib/storage'

const REASON_CONFIG: Record<string, {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: (domain: string) => React.ReactNode
}> = {
  blocked: {
    icon: <ShieldX size={40} className="text-destructive" />,
    iconBg: 'bg-destructive/10',
    title: 'Site Blocked',
    description: (domain) => <><span className="font-semibold text-foreground">{domain}</span> is on your block list.</>,
  },
  limit: {
    icon: <Timer size={40} className="text-orange-500" />,
    iconBg: 'bg-orange-500/10',
    title: 'Time Limit Reached',
    description: (domain) => <>Your daily time limit for <span className="font-semibold text-foreground">{domain}</span> has been reached.</>,
  },
  schedule: {
    icon: <CalendarClock size={40} className="text-blue-500" />,
    iconBg: 'bg-blue-500/10',
    title: 'Blocked by Schedule',
    description: (domain) => <><span className="font-semibold text-foreground">{domain}</span> is blocked during the current scheduled period.</>,
  },
  allowlist: {
    icon: <ShieldBan size={40} className="text-destructive" />,
    iconBg: 'bg-destructive/10',
    title: 'Site Not Allowed',
    description: (domain) => <><span className="font-semibold text-foreground">{domain}</span> is not on your allow list.</>,
  },
}

export default function App() {
  // Apply theme class so dark mode works on this page
  useTheme()

  const params = new URLSearchParams(window.location.search)
  const domain = params.get('domain') ?? 'Unknown'
  const reason = params.get('reason') ?? 'blocked'
  const config = REASON_CONFIG[reason] ?? REASON_CONFIG.blocked

  // Record the block in stats
  useEffect(() => {
    if (domain && domain !== 'Unknown') {
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
            {config.description(domain)}
          </p>
        </div>

        <p className="text-xs text-muted-foreground/60 text-balance">
          You can manage blocked sites in the extension popup.
        </p>
      </div>
    </div>
  )
}
