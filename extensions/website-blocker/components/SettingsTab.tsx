import ExtensionToggle from '@/components/ExtensionToggle'
import { t } from '../lib/i18n'

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
        description={enabled ? t('blockingActive') : t('blockingPaused')}
      />
    </div>
  )
}
