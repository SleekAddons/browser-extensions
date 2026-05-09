import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight, ChevronDown } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ContentCard from '@/components/ContentCard'
import BreakpointList from './BreakpointList'
import SiteFilterPanel from './SiteFilterPanel'
import ExtensionToggle from '@/components/ExtensionToggle'
import { useBreakpointSettings } from '../lib/useBreakpointSettings'
import { PRESETS } from '../lib/breakpoints'
import type { BadgePosition, PresetId } from '../lib/breakpoints'

const ICON = 15
const POSITIONS: { value: BadgePosition; label: React.ReactNode }[] = [
  { value: 'top-left',     label: <ArrowUpLeft size={ICON} /> },
  { value: 'top-right',    label: <ArrowUpRight size={ICON} /> },
  { value: 'bottom-left',  label: <ArrowDownLeft size={ICON} /> },
  { value: 'bottom-right', label: <ArrowDownRight size={ICON} /> },
]

export default function BreakpointSettingsView() {
  const {
    settings,
    loaded,
    update,
    selectPreset,
    updateBreakpoint,
    addBreakpoint,
    removeBreakpoint,
    resetBreakpoints,
    addSitePattern,
    updateSitePattern,
    removeSitePattern,
  } = useBreakpointSettings()

  if (!loaded) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Global enable/disable */}
      <ExtensionToggle
        enabled={settings.enabled}
        onToggle={(checked) => update({ enabled: checked })}
        description="Display breakpoint badge"
      />

      {/* Position */}
      <ContentCard title="Badge position" description="Where the breakpoint indicator appears on the page">
        <Tabs
          value={settings.position}
          onValueChange={(value) => update({ position: value as BadgePosition })}
        >
          <TabsList className="w-full">
            {POSITIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value} className="flex-1">
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </ContentCard>

      {/* Preset selector */}
      <ContentCard title="Preset" description="Load breakpoints from a CSS framework">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between font-normal">
              <span className="truncate">
                {settings.preset === 'custom'
                  ? 'Custom'
                  : PRESETS.find((p) => p.id === settings.preset)?.label ?? settings.preset}
              </span>
              <ChevronDown size={14} className="opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            <DropdownMenuRadioGroup
              value={settings.preset}
              onValueChange={(value) => selectPreset(value as PresetId)}
            >
              {PRESETS.map((preset) => (
                <DropdownMenuRadioItem key={preset.id} value={preset.id}>
                  {preset.label}
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value="custom">Custom</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ContentCard>

      {/* Breakpoints editor */}
      <BreakpointList
        breakpoints={settings.breakpoints}
        isPreset={settings.preset !== 'custom'}
        onUpdate={updateBreakpoint}
        onAdd={addBreakpoint}
        onRemove={removeBreakpoint}
        onReset={resetBreakpoints}
      />

      {/* Site filter */}
      <SiteFilterPanel
        filterMode={settings.siteFilterMode}
        patterns={settings.sitePatterns}
        onFilterModeChange={(mode) => update({ siteFilterMode: mode })}
        onAddPattern={addSitePattern}
        onUpdatePattern={updateSitePattern}
        onRemovePattern={removeSitePattern}
      />
    </div>
  )
}
