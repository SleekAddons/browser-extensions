import ExtensionToggle from '@/components/ExtensionToggle'

interface SettingsTabProps {
  enabled: boolean
  onSetEnabled: (enabled: boolean) => void
}

export default function SettingsTab({
  enabled,
  onSetEnabled,
}: SettingsTabProps) {
  return (
    <div>
      <ExtensionToggle
        enabled={enabled}
        onToggle={onSetEnabled}
        description={enabled ? 'Website blocking is active' : 'Website blocking is paused'}
      />
    </div>
  )
}
