import type { OllamaEndpointState } from '../lib/types'
import ContentCard from '@/components/ContentCard'
import DeleteDialog from '@/components/DeleteDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { formatModelSize } from '../lib/api'
import {
  RefreshCw,
  Trash2,
  Pencil,
  Server,
  CheckCircle,
} from 'lucide-react'

interface EndpointCardProps {
  state: OllamaEndpointState
  isActive: boolean
  onSelect: () => void
  onRefresh: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function EndpointCard(props: EndpointCardProps) {
  const { state, isActive, onSelect, onRefresh, onEdit, onDelete } = props
  const { endpoint, models, connected, loading } = state

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
      {/* Model list */}
      {!connected && !loading && (
        <Alert variant="destructive">
          <AlertDescription>
            Unable to connect. Check that Ollama is running at {endpoint.baseUrl}.
          </AlertDescription>
        </Alert>
      )}

      {connected && models.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {models.map((model) => (
            <Badge key={model.name} variant="outline" className="py-0.5 px-2 font-normal">
              {model.name} ({formatModelSize(model.size)})
            </Badge>
          ))}
        </div>
      )}

      {connected && models.length === 0 && !loading && (
        <Alert>
          <AlertDescription>
            No models found. Pull a model with <code>ollama pull</code>.
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
