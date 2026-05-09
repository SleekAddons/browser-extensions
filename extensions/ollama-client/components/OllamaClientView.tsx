import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import EmptyState from '@/components/EmptyState'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOllamaClient } from '../lib/useOllamaClient'
import AddEndpointDialog from './AddEndpointDialog'
import EditEndpointDialog from './EditEndpointDialog'
import EndpointCard from './EndpointCard'
import ChatView from './ChatView'
import CommandsView from './CommandsView'
import ItemCounter from '@/components/ItemCounter'
import { BotMessageSquare, Info, Server, Zap } from 'lucide-react'
import { useState } from 'react'
import { useScrollable } from '@/lib/useScrollable'

export default function OllamaClientView(props: { className?: string }) {
  const {
    endpoints,
    states,
    loading,
    activeEndpointId,
    activeEndpointState,
    setActiveEndpointId,
    addNewEndpoint,
    editEndpoint,
    deleteEndpoint,
    refreshEndpoint,
    activeModels,
    selectedModel,
    setSelectedModel,
    conversations,
    activeConversation,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    sendMessage,
    stopStreaming,
    isStreaming,
    streamingContent,
    pageContext,
    pageContextLoading,
    chatOptions,
    updateChatOptions,
    commands,
    addNewCommand,
    editCommand,
    deleteCommand,
    tokenUsageStats,
    resetUsageStats,
  } = useOllamaClient()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [showAddEndpoint, setShowAddEndpoint] = useState(false)
  const { ref: endpointsRef, needsPadding: endpointsPadding } = useScrollable()

  const handleNewChat = async () => {
    if (!activeEndpointId || !selectedModel) return

    // Re-enable page context if it was auto-disabled after the previous first message
    if (chatOptions.pageContextAutoDisabled) {
      await updateChatOptions({ pageContextEnabled: true, pageContextAutoDisabled: false })
    }

    // Reuse any existing empty conversation instead of creating a duplicate
    const emptyConversation = conversations.find(
      (c) => c.endpointId === activeEndpointId && c.messages.length === 0,
    )
    if (emptyConversation) {
      setActiveConversationId(emptyConversation.id)
      return
    }

    await createConversation(activeEndpointId, selectedModel)
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={`flex w-full flex-col gap-3 ${props.className ?? ''}`}>
      <TabsList className="w-full shrink-0">
        <TabsTrigger value="chat" className="flex-1 gap-1.5 ">
          <BotMessageSquare size={14} />
          Chat
        </TabsTrigger>
        <TabsTrigger value="commands" className="flex-1 gap-1.5 ">
          <Zap size={14} />
          Commands
        </TabsTrigger>
        <TabsTrigger value="endpoints" className="flex-1 gap-1.5 ">
          <Server size={14} />
          Endpoints
        </TabsTrigger>
      </TabsList>

      <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
        <ChatView
          conversation={activeConversation}
          conversations={conversations}
          models={activeModels}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          onSend={sendMessage}
          onStop={stopStreaming}
          onNewChat={handleNewChat}
          onSelectConversation={setActiveConversationId}
          onDeleteConversation={deleteConversation}
          endpointConnected={activeEndpointState?.connected ?? false}
          chatOptions={chatOptions}
          commands={commands}
          contextSize={activeEndpointState?.endpoint.contextSize}
          pageContext={pageContext}
          pageContextLoading={pageContextLoading}
          onTogglePageContext={(enabled) => updateChatOptions({ pageContextEnabled: enabled, pageContextAutoDisabled: false })}
          tokenUsageStats={tokenUsageStats}
          onResetUsageStats={resetUsageStats}
          onGoToEndpoints={() => setActiveTab('endpoints')}
        />
      </TabsContent>

      <TabsContent value="commands" className="flex min-h-0 flex-1 flex-col">
        <CommandsView
          commands={commands}
          onAdd={addNewCommand}
          onEdit={editCommand}
          onDelete={deleteCommand}
          renderCounter={(count, onAdd) => (
            <ItemCounter
              count={count}
              label="Commands"
              onAdd={onAdd}
              addLabel="Command"
            />
          )}
        />
      </TabsContent>

      <TabsContent value="endpoints" className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <Alert>
            <Info size={16} />
            <AlertTitle className="text-base font-semibold">Cross-Origin Configuration</AlertTitle>
            <AlertDescription className='text-balance'>
              Allow additional web origins so this extension can reach Ollama.{' '}
              <a
                href="https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Learn how to configure CORS
              </a>
            </AlertDescription>
          </Alert>

          <ItemCounter
            count={endpoints.length}
            label="Endpoints"
            onAdd={() => setShowAddEndpoint(true)}
            addLabel="Endpoint"
          />

          <div ref={endpointsRef} className={`min-h-0 flex-1 overflow-y-scroll ${endpointsPadding ? 'pr-3' : ''}`}>
            <div className="flex flex-col gap-3">
              <AddEndpointDialog open={showAddEndpoint} onOpenChange={setShowAddEndpoint} onAdd={addNewEndpoint} />

              {loading && (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Loading endpoints…
                </div>
              )}

              {!loading && endpoints.length === 0 && !showAddEndpoint && (
                <EmptyState
                  icon={<Server />}
                  title="No Ollama endpoints configured."
                  description="Add one to get started."
                />
              )}

              {endpoints.map((endpoint) => {
                const state = states.get(endpoint.id)
                if (!state) return null
                return editingId === endpoint.id ? (
                  <EditEndpointDialog
                    key={endpoint.id}
                    endpoint={endpoint}
                    open
                    onOpenChange={(open) => { if (!open) setEditingId(null) }}
                    onSave={async (id, data) => {
                      await editEndpoint(id, data)
                      setEditingId(null)
                    }}
                  />
                ) : (
                  <EndpointCard
                    key={endpoint.id}
                    state={state}
                    isActive={endpoint.id === activeEndpointId}
                    onSelect={() => setActiveEndpointId(endpoint.id)}
                    onRefresh={() => refreshEndpoint(endpoint.id)}
                    onEdit={() => setEditingId(endpoint.id)}
                    onDelete={() => deleteEndpoint(endpoint.id)}
                  />
                )
              })}
            </div>
          </div>

        </div>
      </TabsContent>
    </Tabs>
  )
}
