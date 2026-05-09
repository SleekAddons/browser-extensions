import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ContentCard from '@/components/ContentCard'
import type { SiteFilterMode } from '../lib/breakpoints'

const FILTER_MODES: { value: SiteFilterMode; label: string }[] = [
  { value: 'all', label: 'All sites' },
  { value: 'allowlist', label: 'Only these' },
  { value: 'blocklist', label: 'Except these' },
]

interface SiteFilterPanelProps {
  filterMode: SiteFilterMode
  patterns: string[]
  onFilterModeChange: (mode: SiteFilterMode) => void
  onAddPattern: () => void
  onUpdatePattern: (index: number, value: string) => void
  onRemovePattern: (index: number) => void
}

export default function SiteFilterPanel(props: SiteFilterPanelProps) {
  const listDisabled = props.filterMode === 'all'

  return (
    <ContentCard title="Show on websites" description="Control which sites display the breakpoint badge">
      <Tabs
        value={props.filterMode}
        onValueChange={(value) => props.onFilterModeChange(value as SiteFilterMode)}
      >
        <TabsList className="w-full">
          {FILTER_MODES.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value} className="flex-1">
              {opt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="divide-y rounded-md border">
        {props.patterns.length > 0 ? (
          props.patterns.map((pattern, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <Input
                value={pattern}
                onChange={(e) => props.onUpdatePattern(i, e.target.value)}
                placeholder="example.com"
                className="h-7 flex-1"
                disabled={listDisabled}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => props.onRemovePattern(i)}
                title="Remove pattern"
                disabled={listDisabled}
                className="text-muted-foreground hover:text-destructive"
              >
                <X size={13} />
              </Button>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <span>No patterns added</span>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={props.onAddPattern}
        disabled={listDisabled}
      >
        <Plus size={14} /> Add site pattern
      </Button>
    </ContentCard>
  )
}
