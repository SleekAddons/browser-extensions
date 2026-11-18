import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ContentCard from '@/components/ContentCard'
import type { SiteFilterMode } from '../lib/breakpoints'
import { t } from '../lib/i18n'

const FILTER_MODES: { value: SiteFilterMode; label: string }[] = [
  { value: 'all', label: t('sitesAll') },
  { value: 'allowlist', label: t('sitesOnly') },
  { value: 'blocklist', label: t('sitesExcept') },
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
    <ContentCard title={t('sitesTitle')} description={t('sitesDescription')}>
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
                title={t('removePattern')}
                disabled={listDisabled}
                className="text-muted-foreground hover:text-destructive"
              >
                <X size={13} />
              </Button>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <span>{t('noPatterns')}</span>
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
        <Plus size={14} /> {t('addPattern')}
      </Button>
    </ContentCard>
  )
}
