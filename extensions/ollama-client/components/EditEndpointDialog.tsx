import { useState, useEffect } from 'react'
import type { OllamaEndpoint } from '../lib/types'
import ContentCard from '@/components/ContentCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'

interface EditEndpointDialogProps {
  endpoint: OllamaEndpoint
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: { name: string; baseUrl: string; authToken?: string; contextSize?: number; systemPrompt?: string }) => Promise<void>
}

export default function EditEndpointDialog(props: EditEndpointDialogProps) {
  const { endpoint, open, onOpenChange, onSave } = props

  const [name, setName] = useState(endpoint.name)
  const [baseUrl, setBaseUrl] = useState(endpoint.baseUrl)
  const [authToken, setAuthToken] = useState(endpoint.authToken ?? '')
  const [contextSize, setContextSize] = useState(endpoint.contextSize?.toString() ?? '')
  const [systemPrompt, setSystemPrompt] = useState(endpoint.systemPrompt ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(endpoint.name)
      setBaseUrl(endpoint.baseUrl)
      setAuthToken(endpoint.authToken ?? '')
      setContextSize(endpoint.contextSize?.toString() ?? '')
      setSystemPrompt(endpoint.systemPrompt ?? '')
      setError(null)
    }
  }, [open, endpoint])

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

    const parsed = contextSize.trim() ? parseInt(contextSize.trim(), 10) : undefined
    if (parsed !== undefined && (isNaN(parsed) || parsed < 256)) {
      setError('Context size must be a number ≥ 256')
      return
    }

    setSubmitting(true)
    try {
      await onSave(endpoint.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        authToken: authToken.trim() || undefined,
        contextSize: parsed,
        systemPrompt: systemPrompt.trim() || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save endpoint')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <ContentCard
      title="Edit Endpoint"
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
            <Label htmlFor="ol-edit-name">Name</Label>
            <Input
              id="ol-edit-name"
              placeholder="Local Ollama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ol-edit-url">URL</Label>
            <Input
              id="ol-edit-url"
              placeholder="http://localhost:11434"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              inputMode="url"
              autoComplete="url"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ol-edit-token">Auth Token</Label>
            <Input
              id="ol-edit-token"
              type="password"
              placeholder="Optional"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Bearer token for authenticated endpoints.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ol-edit-ctx">Context Size</Label>
            <Input
              id="ol-edit-ctx"
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
            <Label htmlFor="ol-edit-system">System Prompt</Label>
            <Textarea
              id="ol-edit-system"
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
