import { useState } from 'react'
import type { ChatCommand } from '../lib/types'
import ContentCard from '@/components/ContentCard'
import DeleteDialog from '@/components/DeleteDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { X, Pencil, Trash2, Zap } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import { useScrollable } from '@/lib/useScrollable'

interface CommandsViewProps {
  commands: ChatCommand[]
  onAdd: (data: Omit<ChatCommand, 'id'>) => Promise<void>
  onEdit: (id: string, data: Partial<Omit<ChatCommand, 'id'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  renderCounter?: (count: number, onAdd: () => void) => React.ReactNode
}

export default function CommandsView(props: CommandsViewProps) {
  const { commands, onAdd, onEdit, onDelete, renderCounter } = props

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { ref: commandsRef, needsPadding: commandsPadding } = useScrollable()

  const reset = () => {
    setName('')
    setPrompt('')
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return
    setSubmitting(true)
    try {
      await onAdd({ name: name.trim(), prompt: prompt.trim() })
      reset()
      setShowAdd(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !name.trim() || !prompt.trim()) return
    setSubmitting(true)
    try {
      await onEdit(editingId, { name: name.trim(), prompt: prompt.trim() })
      reset()
      setEditingId(null)
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (cmd: ChatCommand) => {
    setEditingId(cmd.id)
    setName(cmd.name)
    setPrompt(cmd.prompt)
    setShowAdd(false)
  }

  const cancelEditing = () => {
    setEditingId(null)
    reset()
  }

  const userCommands = commands.filter((c) => !c.system)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {renderCounter?.(userCommands.length, () => { setShowAdd(true); setEditingId(null); reset() })}

      <div ref={commandsRef} className={`min-h-0 flex-1 overflow-y-scroll ${commandsPadding ? 'pr-3' : ''}`}>
        <div className="flex flex-col gap-3">
          {showAdd ? (
            <ContentCard
              title="New Command"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setShowAdd(false); reset() }}
                >
                  <X size={14} />
                </Button>
              }
            >
              <form onSubmit={handleAdd} className="flex flex-col gap-3">

                  <div className="flex flex-col gap-1.5">
                    <Label className="">Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Explain"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="">System Prompt</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Explain the following in simple terms."
                      className="min-h-[60px]"
                      rows={3}
                    />
                  </div>

                  <Separator className="my-1" />

                  <Button
                    type="submit"
                    disabled={!name.trim() || !prompt.trim() || submitting}
                    className="w-full"
                  >
                    Add Command
                  </Button>
                </form>
            </ContentCard>
          ) : null}

          {userCommands.length === 0 && !showAdd && (
            <EmptyState
              icon={<Zap />}
              title="No commands configured."
              description="Add reusable prompt instructions."
            />
          )}

          {userCommands.map((cmd) => {
            if (editingId === cmd.id) {
              return (
                <ContentCard
                  key={cmd.id}
                  title="Edit Command"
                  action={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={cancelEditing}
                    >
                      <X size={14} />
                    </Button>
                  }
                >
                  <form onSubmit={handleEdit} className="flex flex-col gap-3">

                      <div className="flex flex-col gap-1.5">
                        <Label className="">Name</Label>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Explain"
                          autoFocus
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="">System Prompt</Label>
                        <Textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="e.g. Explain the following in simple terms."
                          className="min-h-[60px]"
                          rows={3}
                        />
                      </div>

                      <Separator className="my-1" />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim() || !prompt.trim() || submitting} className="flex-1">
                          {submitting ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </form>
                </ContentCard>
              )
            }

            return (
              <ContentCard
                key={cmd.id}
                title={cmd.name}
                action={
                  cmd.system ? (
                    <span className="text-muted-foreground italic">System</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditing(cmd)}
                        title="Edit command"
                      >
                        <Pencil size={12} />
                      </Button>
                      <DeleteDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Delete command">
                            <Trash2 size={12} />
                          </Button>
                        }
                        entityName="command"
                        description={`This will permanently delete the "${cmd.name}" command.`}
                        onConfirm={() => onDelete(cmd.id)}
                      />
                    </div>
                  )
                }
              >
                <CardDescription>{cmd.prompt}</CardDescription>
              </ContentCard>
            )
          })}
        </div>
      </div>

    </div>
  )
}
