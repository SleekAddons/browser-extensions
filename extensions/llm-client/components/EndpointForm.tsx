import { useId, useState } from 'react'
import type { Endpoint, EndpointProvider } from '../lib/types'
import { DEFAULT_CONTEXT_SIZE, PROVIDERS } from '../lib/api'
import ContentCard from '@/components/ContentCard'
import OptionPicker from '@/components/OptionPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'

/** Form text that depends on the API the endpoint speaks */
const PROVIDER_TEXT: Record<EndpointProvider, {
  description: string
  namePlaceholder: string
  urlHint?: string
  tokenLabel: string
  tokenHint: string
  contextPlaceholder: string
  contextHint: string
}> = {
  ollama: {
    description: 'Connect to an Ollama server. Default port is 11434.',
    namePlaceholder: 'Local Ollama',
    tokenLabel: 'Auth Token',
    tokenHint: 'Bearer token for authenticated endpoints.',
    contextPlaceholder: `Default (${DEFAULT_CONTEXT_SIZE})`,
    contextHint: 'Number of tokens for the context window (num_ctx).',
  },
  openai: {
    description: 'Connect to OpenAI or any server with an OpenAI-compatible API, such as OpenRouter, LM Studio, llama.cpp or vLLM.',
    namePlaceholder: 'OpenAI',
    urlHint: 'API base URL, usually ending in /v1.',
    tokenLabel: 'API Key',
    tokenHint: 'Sent as a Bearer token. Local servers usually need none.',
    contextPlaceholder: 'Auto',
    contextHint: `Model context window in tokens, for the usage meter and page trimming. Defaults to what the server reports, or ${DEFAULT_CONTEXT_SIZE}.`,
  },
}

const PROVIDER_OPTIONS = (Object.keys(PROVIDERS) as EndpointProvider[]).map((value) => ({
  value,
  label: PROVIDERS[value].label,
}))

/** Trim the URL and drop trailing slashes, plus an API path pasted along with an OpenAI-compatible base URL. */
function cleanBaseUrl(url: string, provider: EndpointProvider): string {
  const cleaned = url.trim().replace(/\/+$/, '')
  return provider === 'openai' ? cleaned.replace(/\/(chat\/completions|models)$/, '') : cleaned
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

interface EndpointFormProps {
  /** Endpoint to edit; leave out to add a new one */
  endpoint?: Endpoint
  onSubmit: (data: Omit<Endpoint, 'id'>) => Promise<void>
  onClose: () => void
}

export default function EndpointForm(props: EndpointFormProps) {
  const { endpoint, onSubmit, onClose } = props
  const isEdit = endpoint !== undefined
  const id = useId()

  const [provider, setProvider] = useState<EndpointProvider>(endpoint?.provider ?? 'ollama')
  const [name, setName] = useState(endpoint?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(endpoint?.baseUrl ?? PROVIDERS.ollama.defaultUrl)
  const [authToken, setAuthToken] = useState(endpoint?.authToken ?? '')
  const [contextSize, setContextSize] = useState(endpoint?.contextSize?.toString() ?? '')
  const [systemPrompt, setSystemPrompt] = useState(endpoint?.systemPrompt ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const text = PROVIDER_TEXT[provider]

  const handleProviderChange = (next: EndpointProvider) => {
    // When adding, swap the prefilled URL for the new provider's default
    // (unless the user already typed their own)
    const url = baseUrl.trim()
    if (!isEdit && (!url || url === PROVIDERS[provider].defaultUrl)) {
      setBaseUrl(PROVIDERS[next].defaultUrl)
    }
    setProvider(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const url = cleanBaseUrl(baseUrl, provider)
    if (!isHttpUrl(url)) {
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
      await onSubmit({
        name: name.trim(),
        provider,
        baseUrl: url,
        authToken: authToken.trim() || undefined,
        contextSize: parsed,
        systemPrompt: systemPrompt.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save endpoint')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ContentCard
      title={isEdit ? 'Edit Endpoint' : 'Add Endpoint'}
      description={text.description}
      action={
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
          <X size={14} />
        </Button>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div role="group" aria-labelledby={`${id}-provider`} className="flex flex-col gap-1.5">
          <Label id={`${id}-provider`}>API</Label>
          <OptionPicker options={PROVIDER_OPTIONS} value={provider} onChange={handleProviderChange} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input
            id={`${id}-name`}
            placeholder={text.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-url`}>URL</Label>
          <Input
            id={`${id}-url`}
            placeholder={PROVIDERS[provider].defaultUrl}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            inputMode="url"
            autoComplete="url"
          />
          {text.urlHint && <p className="text-xs text-muted-foreground">{text.urlHint}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-token`}>{text.tokenLabel}</Label>
          <Input
            id={`${id}-token`}
            type="password"
            placeholder="Optional"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">{text.tokenHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-ctx`}>Context Size</Label>
          <Input
            id={`${id}-ctx`}
            type="number"
            min={256}
            step={256}
            placeholder={text.contextPlaceholder}
            value={contextSize}
            onChange={(e) => setContextSize(e.target.value)}
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">{text.contextHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-system`}>System Prompt</Label>
          <Textarea
            id={`${id}-system`}
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
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1">
            {isEdit
              ? submitting ? 'Saving…' : 'Save'
              : submitting ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </form>
    </ContentCard>
  )
}
