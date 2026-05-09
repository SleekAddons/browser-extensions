import { useState } from 'react'
import { Calendar, Shield, Timer } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { useWebsiteBlocker } from '../lib/useWebsiteBlocker'
import BlockListTab from './BlockListTab'
import LimitsTab from './LimitsTab'
import ScheduleTab from './ScheduleTab'

export default function WebsiteBlockerView() {
  const [activeTab, setActiveTab] = useState('blocklist')
  const [limitPrefillDomain, setLimitPrefillDomain] = useState<string | null>(null)
  const [schedulePrefillDomain, setSchedulePrefillDomain] = useState<string | null>(null)
  const [limitPrefillTrigger, setLimitPrefillTrigger] = useState(0)
  const [schedulePrefillTrigger, setSchedulePrefillTrigger] = useState(0)

  const {
    settings,
    stats,
    usage,
    tracking,
    loading,
    addRule,
    updateRule,
    removeRule,
    toggleRule,
    addLimit,
    removeLimit,
    updateLimit,
    addSchedule,
    removeSchedule,
    updateSchedule,
    refreshStats,
  } = useWebsiteBlocker()

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading…
      </div>
    )
  }

  const openLimitForm = (domain: string) => {
    setLimitPrefillDomain(domain)
    setLimitPrefillTrigger((t) => t + 1)
    setActiveTab('limits')
  }

  const openScheduleForm = (domain: string) => {
    setSchedulePrefillDomain(domain)
    setSchedulePrefillTrigger((t) => t + 1)
    setActiveTab('schedule')
  }

  return (
    <Tabs
      value={activeTab}
      className="flex min-h-0 flex-1 flex-col gap-3"
      onValueChange={(v) => {
        setActiveTab(v)
        if (v === 'blocklist' || v === 'limits') refreshStats()
      }}
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="blocklist">
          <Shield size={14} />
          Sites
        </TabsTrigger>
        <TabsTrigger value="limits">
          <Timer size={14} />
          Limits
        </TabsTrigger>
        <TabsTrigger value="schedule">
          <Calendar size={14} />
          Schedule
        </TabsTrigger>
      </TabsList>

      <TabsContent value="blocklist" className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
        <BlockListTab
          rules={settings.rules}
          mode={settings.mode}
          stats={stats}
          usage={usage}
          tracking={tracking}
          limits={settings.limits}
          schedules={settings.schedules}
          onAddRule={addRule}
          onUpdateRule={updateRule}
          onRemoveRule={removeRule}
          onToggleRule={toggleRule}
          onAddLimit={openLimitForm}
          onAddSchedule={openScheduleForm}
        />
      </TabsContent>

      <TabsContent value="limits" className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
        <LimitsTab
          limits={settings.limits}
          rules={settings.rules}
          usage={usage}
          tracking={tracking}
          onAddLimit={addLimit}
          onRemoveLimit={removeLimit}
          onUpdateLimit={updateLimit}
          prefillDomain={limitPrefillDomain}
          prefillTrigger={limitPrefillTrigger}
        />
      </TabsContent>

      <TabsContent value="schedule" className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
        <ScheduleTab
          schedules={settings.schedules}
          rules={settings.rules}
          onAddSchedule={addSchedule}
          onRemoveSchedule={removeSchedule}
          onUpdateSchedule={updateSchedule}
          prefillDomain={schedulePrefillDomain}
          prefillTrigger={schedulePrefillTrigger}
        />
      </TabsContent>

    </Tabs>
  )
}
