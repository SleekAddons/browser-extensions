import { useState, useEffect } from 'react'
import type { PiholeInstance } from '../lib/types'
import ContentCard from '@/components/ContentCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'

interface EditInstanceDialogProps {
  instance: PiholeInstance
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: { name: string; baseUrl: string; password: string }) => Promise<void>
}

export default function EditInstanceDialog(props: EditInstanceDialogProps) {
  const { instance, open, onOpenChange, onSave } = props

  const [name, setName] = useState(instance.name)
  const [baseUrl, setBaseUrl] = useState(instance.baseUrl)
  const [password, setPassword] = useState(instance.password)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(instance.name)
      setBaseUrl(instance.baseUrl)
      setPassword(instance.password)
      setError(null)
    }
  }, [open, instance])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!baseUrl.trim() || (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://'))) {
      setError('Enter a valid URL (http:// or https://)')
      return
    }
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setSubmitting(true)
    try {
      await onSave(instance.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        password: password.trim(),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save instance')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <ContentCard
      title="Edit Pi-hole Instance"
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
        >
          <X size={14} />
        </Button>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-edit-name">Name</Label>
            <Input
              id="ph-edit-name"
              placeholder="Home Pi-hole"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-edit-url">URL</Label>
            <Input
              id="ph-edit-url"
              placeholder="https://pi.hole"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              inputMode="url"
              autoComplete="url"
            />
            <p className="text-xs text-muted-foreground">Use the base address of your Pi-hole instance.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-edit-password">API Password</Label>
            <Input
              id="ph-edit-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}

          <Separator className="my-1" />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
    </ContentCard>
  )
}
