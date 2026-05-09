import { Spinner } from '@/components/ui/spinner'
import { usePiholeManager } from '../lib/usePiholeManager'
import AddInstanceDialog from './AddInstanceDialog'
import EditInstanceDialog from './EditInstanceDialog'
import InstanceCard from './InstanceCard'
import ItemCounter from '@/components/ItemCounter'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import { useState } from 'react'
import { useScrollable } from '@/lib/useScrollable'

export default function PiholeManagerView(props: { className?: string }) {
  const {
    instances,
    states,
    loading,
    currentDomain,
    addNewInstance,
    editInstance,
    deleteInstance,
    refreshInstance,
    toggleBlocking,
    toggleAllBlocking,
    addCurrentDomain,
    removeCurrentDomain,
  } = usePiholeManager()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddInstance, setShowAddInstance] = useState(false)
  const { ref: instancesRef, needsPadding: instancesPadding } = useScrollable()

  const connectedStates = Array.from(states.values()).filter(
    (s) => s.session?.sid && s.blocking,
  )
  const hasConnected = connectedStates.length > 0
  const allEnabled = hasConnected && connectedStates.every((s) => s.blocking?.blocking === 'enabled')
  const allDisabled = hasConnected && connectedStates.every((s) => s.blocking?.blocking !== 'enabled')
  const anyLoading = connectedStates.some((s) => s.loading)

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${props.className ?? ''}`}>
      {hasConnected && (
        <Card className="flex-row items-center justify-between gap-3 rounded-lg px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={
                allEnabled
                  ? 'flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 transition-colors duration-200 dark:text-emerald-500'
                  : 'flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors duration-200'
              }
            >
              {allEnabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
            </span>
            <Label className="text-sm font-medium leading-none">
              {allEnabled
                ? `All ${connectedStates.length} instance${connectedStates.length === 1 ? '' : 's'} enabled`
                : allDisabled
                  ? `All ${connectedStates.length} instance${connectedStates.length === 1 ? '' : 's'} disabled`
                  : 'Some instances disabled'}
            </Label>
          </div>
          <Switch
            checked={allEnabled}
            onCheckedChange={(checked) => toggleAllBlocking(checked)}
            disabled={anyLoading}
          />
        </Card>
      )}

      <ItemCounter
        count={instances.length}
        label="Instances"
        onAdd={() => setShowAddInstance(true)}
        addLabel="Instance"
      />

      <div
        ref={instancesRef}
        className={`min-h-0 flex-1 overflow-y-scroll ${instancesPadding ? 'pr-3' : ''}`}
      >
        <div className="flex flex-col gap-3">
          <AddInstanceDialog open={showAddInstance} onOpenChange={setShowAddInstance} onAdd={addNewInstance} />

          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading instances…
            </div>
          )}

          {!loading && instances.length === 0 && !showAddInstance && (
            <EmptyState
              icon={<ShieldAlert />}
              title="No Pi-hole instances configured."
              description="Add one to get started."
            />
          )}

          {instances.map((instance) => {
            const state = states.get(instance.id)
            if (!state) return null
            return editingId === instance.id ? (
              <EditInstanceDialog
                key={instance.id}
                instance={instance}
                open
                onOpenChange={(open) => { if (!open) setEditingId(null) }}
                onSave={async (id, data) => {
                  await editInstance(id, data)
                  setEditingId(null)
                }}
              />
            ) : (
              <InstanceCard
                key={instance.id}
                state={state}
                currentDomain={currentDomain}
                onRefresh={() => refreshInstance(instance.id)}
                onToggleBlocking={(timer) => toggleBlocking(instance.id, timer)}
                onAddDomain={(type) => addCurrentDomain(instance.id, type)}
                onRemoveDomain={(type) => removeCurrentDomain(instance.id, type)}
                onEdit={() => setEditingId(instance.id)}
                onDelete={() => deleteInstance(instance.id)}
              />
            )
          })}
        </div>
      </div>

    </div>
  )
}
