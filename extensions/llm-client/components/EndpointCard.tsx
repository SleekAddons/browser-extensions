import { useState } from 'react'
import type { EndpointState } from '../lib/types'
import ContentCard from '@/components/ContentCard'
import DeleteDialog from '@/components/DeleteDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { PROVIDERS, formatModelSize } from '../lib/api'
import {
  RefreshCw,
  Trash2,
  Pencil,
  Server,
  CheckCircle,
} from 'lucide-react'

/** Models listed before a "+N more" button, so long cloud model lists stay compact */
const MAX_VISIBLE_MODELS = 12

interface EndpointCardProps {
  state: EndpointState
  isActive: boolean
  onSelect: () => void
  onRefresh: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function EndpointCard(props: EndpointCardProps) {
  const { state, isActive, onSelect, onRefresh, onEdit, onDelete } = props
  const { endpoint, models, connected, loading, error } = state
  const [showAllModels, setShowAllModels] = useState(false)
  const visibleModels = showAllModels ? models : models.slice(0, MAX_VISIBLE_MODELS)
  const hiddenModelCount = models.length - visibleModels.length
  const isOllama = endpoint.provider === 'ollama'

  return (
    <ContentCard
      title={endpoint.name}
      icon={<Server size={14} />}
      action={
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh models"
          >
            {loading ? <Spinner className="size-3" /> : <RefreshCw size={12} />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            title="Edit endpoint"
          >
            <Pencil size={12} />
          </Button>
          <DeleteDialog
            trigger={
              <Button variant="ghost" size="icon-sm" title="Remove endpoint">
                <Trash2 size={12} />
              </Button>
            }
            entityName="endpoint"
            description={`This will remove "${endpoint.name}" and all its conversations.`}
            onConfirm={onDelete}
          />
        </div>
      }
    >
      <p className="truncate text-muted-foreground" title={endpoint.baseUrl}>
        {PROVIDERS[endpoint.provider].label} · {endpoint.baseUrl}
      </p>

      {/* Model list */}
      {!connected && !loading && (
        <Alert variant="destructive">
          <AlertDescription>
            {isOllama
              ? `Unable to connect. Check that Ollama is running at ${endpoint.baseUrl}.`
              : 'Unable to connect. Check the URL and API key.'}
            {error && <span className="mt-1 block font-mono text-xs opacity-80">{error}</span>}
          </AlertDescription>
        </Alert>
      )}

      {connected && models.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleModels.map((model) => (
            <Badge key={model.name} variant="outline" className="py-0.5 px-2 font-normal">
              {model.size ? `${model.name} (${formatModelSize(model.size)})` : model.name}
            </Badge>
          ))}
          {hiddenModelCount > 0 && (
            <Badge asChild variant="secondary" className="py-0.5 px-2 font-normal">
              <button type="button" onClick={() => setShowAllModels(true)}>
                +{hiddenModelCount} more
              </button>
            </Badge>
          )}
        </div>
      )}

      {connected && models.length === 0 && !loading && (
        <Alert>
          <AlertDescription>
            {isOllama
              ? <>No models found. Pull a model with <code>ollama pull</code>.</>
              : 'No chat models found on this server.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Use this endpoint */}
      {connected && (
        <>
          <Separator className="my-1" />
          <Button
            variant={isActive ? 'default' : 'outline'}
            className="w-full"
            size="sm"
            onClick={onSelect}
          >
            <CheckCircle size={14} />
            {isActive ? 'Active endpoint' : 'Use this endpoint'}
          </Button>
        </>
      )}
    </ContentCard>
  )
}
