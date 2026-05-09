import { Area, AreaChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { PiholeHistoryEntry } from '../lib/types'

const chartConfig = {
  blocked: {
    label: 'Blocked',
    color: 'var(--foreground)',
  },
} satisfies ChartConfig

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BlockedChart(props: { data: PiholeHistoryEntry[] }) {
  const points = props.data.map((d) => ({
    time: formatTime(d.timestamp),
    blocked: d.blocked,
  }))

  return (
    <ChartContainer config={chartConfig} className="w-full justify-end overflow-visible" style={{ aspectRatio: 'unset', height: 60 }}>
      <AreaChart data={points} margin={{ top: 2, right: 8, bottom: 2, left: 8 }}>
        <defs>
          <linearGradient id="blockedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-blocked)" stopOpacity={0.15} />
            <stop offset="100%" stopColor="var(--color-blocked)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9 }}
          interval="preserveStartEnd"
          minTickGap={50}
          height={16}
        />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="blocked"
          stroke="var(--color-blocked)"
          strokeWidth={1.5}
          fill="url(#blockedFill)"
        />
      </AreaChart>
    </ChartContainer>
  )
}
