import { useState } from 'react'
import ContentCard from '@/components/ContentCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'

interface AddInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: { name: string; baseUrl: string; password: string }) => Promise<void>
}

export default function AddInstanceDialog(props: AddInstanceDialogProps) {
  const { open } = props
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setBaseUrl('https://')
    setPassword('')
    setError(null)
  }

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
      await props.onAdd({
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        password: password.trim(),
      })
      props.onOpenChange(false)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add instance')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <ContentCard
      title="Add Pi-hole Instance"
      description="Connect to a Pi-hole 6+ instance."
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => { props.onOpenChange(false); reset() }}
        >
          <X size={14} />
        </Button>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-name">Name</Label>
            <Input
              id="ph-name"
              placeholder="Home Pi-hole"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-url">URL</Label>
            <Input
              id="ph-url"
              placeholder="https://pi.hole"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              inputMode="url"
              autoComplete="url"
            />
            <p className="text-xs text-muted-foreground">Use the base address of your Pi-hole instance.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-password">API Password</Label>
            <Input
              id="ph-password"
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
              onClick={() => {
                props.onOpenChange(false)
                reset()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
        </form>
    </ContentCard>
  )
}
