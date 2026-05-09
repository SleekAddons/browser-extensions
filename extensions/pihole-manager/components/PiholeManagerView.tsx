import { Spinner } from '@/components/ui/spinner'
import { usePiholeManager } from '../lib/usePiholeManager'
import AddInstanceDialog from './AddInstanceDialog'
import EditInstanceDialog from './EditInstanceDialog'
import InstanceCard from './InstanceCard'
import ItemCounter from '@/components/ItemCounter'
import { ShieldAlert } from 'lucide-react'
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
    addCurrentDomain,
    removeCurrentDomain,
  } = usePiholeManager()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddInstance, setShowAddInstance] = useState(false)
  const { ref: instancesRef, needsPadding: instancesPadding } = useScrollable()

  return (
    <div className={`flex min-h-0 flex-col gap-3 ${props.className ?? ''}`}>
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
