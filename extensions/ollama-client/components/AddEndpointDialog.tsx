import { useState } from 'react'
import ContentCard from '@/components/ContentCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'

interface AddEndpointDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: { name: string; baseUrl: string; authToken?: string; contextSize?: number; systemPrompt?: string }) => Promise<void>
}

export default function AddEndpointDialog(props: AddEndpointDialogProps) {
  const { open } = props
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [authToken, setAuthToken] = useState('')
  const [contextSize, setContextSize] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setBaseUrl('http://localhost:11434')
    setAuthToken('')
    setContextSize('')
    setSystemPrompt('')
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

    setSubmitting(true)
    try {
      const parsed = contextSize.trim() ? parseInt(contextSize.trim(), 10) : undefined
      if (parsed !== undefined && (isNaN(parsed) || parsed < 256)) {
        setError('Context size must be a number ≥ 256')
        setSubmitting(false)
        return
      }

      await props.onAdd({
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        authToken: authToken.trim() || undefined,
        contextSize: parsed,
        systemPrompt: systemPrompt.trim() || undefined,
      })
      props.onOpenChange(false)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add endpoint')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <ContentCard
      title="Add Ollama Endpoint"
      description="Connect to an Ollama server. Default port is 11434."
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
            <Label htmlFor="ol-name">Name</Label>
            <Input
              id="ol-name"
              placeholder="Local Ollama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ol-url">URL</Label>
            <Input
              id="ol-url"
              placeholder="http://localhost:11434"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              inputMode="url"
              autoComplete="url"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ol-token">Auth Token</Label>
            <Input
              id="ol-token"
              type="password"
              placeholder="Optional"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Bearer token for authenticated endpoints.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ol-ctx">Context Size</Label>
            <Input
              id="ol-ctx"
              type="number"
              min={256}
              step={256}
              placeholder="Default (4096)"
              value={contextSize}
              onChange={(e) => setContextSize(e.target.value)}
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">Number of tokens for the context window (num_ctx).</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ol-system">System Prompt</Label>
            <Textarea
              id="ol-system"
              placeholder="Optional"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">Prepended as a system message to every conversation.</p>
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
