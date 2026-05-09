import { useState, useRef, useEffect } from 'react'
import EmptyState from '@/components/EmptyState'
import type { Conversation, OllamaModel, ChatCommand, ChatOptions, PageContext, TokenUsageStats, FileAttachment } from '../lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { useScrollable } from '@/lib/useScrollable'
import MessageBubble from './MessageBubble'
import {
  ArrowUp,
  Square,
  MessageSquarePlus,
  Trash2,
  ChevronLeft,
  Zap,
  FileText,
  History,
  Info,
  TriangleAlert,
  Gauge,
  Paperclip,
  X,
  Image,
  Server,
  ChevronDown,
  // RotateCcw,
} from 'lucide-react'
import { SYSTEM_COMMANDS } from '../lib/types'
import { MAX_CONVERSATIONS } from '../lib/storage'

/** Default Ollama context window when no custom value is configured */
const DEFAULT_CONTEXT_SIZE = 4096

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return String(tokens)
}

interface ChatViewProps {
  conversation: Conversation | null
  conversations: Conversation[]
  models: OllamaModel[]
  selectedModel: string | null
  onSelectModel: (model: string) => void
  isStreaming: boolean
  streamingContent: string
  onSend: (content: string, tempCommandIds?: string[], attachments?: FileAttachment[]) => void
  onStop: () => void
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  endpointConnected: boolean
  chatOptions: ChatOptions
  commands: ChatCommand[]
  contextSize?: number
  pageContext: PageContext | null
  pageContextLoading: boolean
  onTogglePageContext: (enabled: boolean) => void
  tokenUsageStats: TokenUsageStats
  onResetUsageStats: () => void
  onGoToEndpoints?: () => void
}

export default function ChatView(props: ChatViewProps) {
  const {
    conversation,
    conversations,
    models,
    selectedModel,
    onSelectModel,
    isStreaming,
    streamingContent,
    onSend,
    onStop,
    onNewChat,
    onSelectConversation,
    onDeleteConversation,
    endpointConnected,
    chatOptions,
    commands,
    contextSize,
    pageContext,
    pageContextLoading,
    onTogglePageContext,
    // tokenUsageStats,
    // onResetUsageStats,
    onGoToEndpoints,
  } = props

  const maxContextTokens = contextSize ?? DEFAULT_CONTEXT_SIZE
  const pageTokens = pageContext ? estimateTokens(pageContext.textContent) : 0
  const pageContextExceedsLimit = pageTokens > maxContextTokens

  // Context usage: only use actual Ollama-reported tokens (no estimates)
  // After a response, total context = prompt tokens (all input) + completion tokens (generated output)
  const messages_ = conversation?.messages ?? []
  const lastAssistantWithUsage = [...messages_].reverse().find((m) => m.role === 'assistant' && m.tokenUsage)
  const lastPromptTokens = lastAssistantWithUsage?.tokenUsage?.promptTokens ?? 0
  const lastCompletionTokens = lastAssistantWithUsage?.tokenUsage?.completionTokens ?? 0
  const hasActualUsage = lastPromptTokens > 0
  const globalTokens = lastPromptTokens + lastCompletionTokens
  const globalUsagePercent = hasActualUsage ? Math.min((globalTokens / maxContextTokens) * 100, 100) : 0
  const globalExceedsLimit = hasActualUsage && globalTokens > maxContextTokens
  const remainingTokens = hasActualUsage ? Math.max(maxContextTokens - globalTokens, 0) : maxContextTokens
  const pageFitsInRemaining = pageTokens <= remainingTokens

  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [tempCommandId, setTempCommandId] = useState<string | null>(null)
  const [contextPopoverOpen, setContextPopoverOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contextPopoverTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const [globalPopoverOpen, setGlobalPopoverOpen] = useState(false)
  const globalPopoverTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)
  const { ref: modelListRef, needsPadding: modelListPadding } = useScrollable<HTMLDivElement>()
  const { ref: messagesPaddingRef, needsPadding: messagesPadding } = useScrollable<HTMLDivElement>()
  const didScrollToResponse = useRef(false)
  const [responseMinHeight, setResponseMinHeight] = useState(0)

  const openContextPopover = () => {
    if (contextPopoverTimeout.current) clearTimeout(contextPopoverTimeout.current)
    contextPopoverTimeout.current = setTimeout(() => setContextPopoverOpen(true), 250)
  }

  const closeContextPopover = () => {
    if (contextPopoverTimeout.current) clearTimeout(contextPopoverTimeout.current)
    contextPopoverTimeout.current = setTimeout(() => setContextPopoverOpen(false), 150)
  }

  const openGlobalPopover = () => {
    if (globalPopoverTimeout.current) clearTimeout(globalPopoverTimeout.current)
    globalPopoverTimeout.current = setTimeout(() => setGlobalPopoverOpen(true), 250)
  }

  const closeGlobalPopover = () => {
    if (globalPopoverTimeout.current) clearTimeout(globalPopoverTimeout.current)
    globalPopoverTimeout.current = setTimeout(() => setGlobalPopoverOpen(false), 150)
  }

  // Reset temporary command when conversation changes
  useEffect(() => {
    setTempCommandId(null)
  }, [conversation?.id])

  // Scroll to bottom when switching to an existing conversation
  useEffect(() => {
    if (!conversation?.id) return
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }, [conversation?.id])

  // Autofocus textarea once a model is selected
  useEffect(() => {
    if (!selectedModel) return
    const timer = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [selectedModel])

  // Reset the scroll-once flag when a new streaming session starts
  useEffect(() => {
    if (isStreaming) {
      didScrollToResponse.current = false
    }
  }, [isStreaming])

  // Scroll the last user message to the top of the visible area exactly
  // once when the response starts, and compute a min-height so the
  // assistant bubble fills the remaining viewport. This mirrors
  // ChatGPT / OpenWebUI / Gemini behaviour.
  useEffect(() => {
    if (!isStreaming || didScrollToResponse.current) return
    const container = scrollRef.current
    const userMsg = lastUserMsgRef.current
    if (!container) return

    setResponseMinHeight(container.clientHeight)
    didScrollToResponse.current = true

    if (!userMsg) return
    // Wait for DOM to settle (new message + streaming placeholder rendered)
    requestAnimationFrame(() => {
      const gap = 12 // px gap above the user message
      const containerRect = container.getBoundingClientRect()
      const msgRect = userMsg.getBoundingClientRect()
      const targetTop = container.scrollTop + (msgRect.top - containerRect.top) - gap
      container.scrollTo({ top: targetTop, behavior: 'smooth' })
    })
  }, [isStreaming, streamingContent])


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newAttachments: FileAttachment[] = []
    for (const file of Array.from(files)) {
      const attachment: FileAttachment = {
        name: file.name,
        type: file.type,
        size: file.size,
      }

      if (file.type.startsWith('image/')) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            // Strip the data URI prefix (e.g. "data:image/png;base64,")
            resolve(result.split(',')[1])
          }
          reader.readAsDataURL(file)
        })
        attachment.base64 = base64
      } else {
        const text = await file.text()
        attachment.textContent = text
      }

      newAttachments.push(attachment)
    }

    setAttachments((prev) => [...prev, ...newAttachments])
    // Reset file input so the same file can be re-selected
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    const content = input.trim()
    if ((!content && !tempCommandId && attachments.length === 0) || isStreaming) return
    setInput('')
    const currentAttachments = attachments.length > 0 ? attachments : undefined
    setAttachments([])
    onSend(content, tempCommandId ? [tempCommandId] : undefined, currentAttachments)
    setTempCommandId(null)
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  const activeCommand = commands.find((c) => c.id === tempCommandId) ?? null
  const chatDisabled = !endpointConnected

  // Conversation history sidebar
  if (showHistory) {
    return (
      <div className="flex flex-col gap-2">
        <Alert>
          <Info size={16} />
          <AlertTitle className="text-base font-semibold">History Limit</AlertTitle>
          <AlertDescription className="text-sm">
            Only the last {MAX_CONVERSATIONS} conversations are kept. Older chats are automatically removed.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => setShowHistory(false)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="font-semibold text-sm">Chat History</span>
        </div>
        
        {conversations.length === 0 && (
          <EmptyState
            icon={<History />}
            title="No conversations yet."
            description="Start a new chat to see it here."
          />
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer transition-colors ${
              c.id === conversation?.id
                ? 'border-primary/40 bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => { onSelectConversation(c.id); setShowHistory(false) }}
          >
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="font-medium truncate text-sm">{c.title}</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="px-1 py-0 shrink-0">
                  {c.model}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {c.messages.length} messages
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onDeleteConversation(c.id) }}
              title="Delete conversation"
            >
              <Trash2 size={11} />
            </Button>
          </div>
        ))}
        {conversations.length > 0 && <div className="pb-1" />}
      </div>
    )
  }

  const messages = conversation?.messages ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Top bar: model selector + actions */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={chatDisabled}>
            <Button variant="outline" size="sm" className="flex-1 justify-between font-normal">
              <span className="truncate">{selectedModel ?? 'Select model'}</span>
              <ChevronDown size={14} className="opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            ref={modelListRef}
            className={`max-h-60 overflow-y-auto w-(--radix-dropdown-menu-trigger-width) ${modelListPadding ? 'pr-3' : ''}`}
          >
            <DropdownMenuRadioGroup value={selectedModel ?? ''} onValueChange={onSelectModel}>
              {models.map((m) => (
                <DropdownMenuRadioItem key={m.name} value={m.name}>
                  {m.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => { onNewChat(); setTimeout(() => textareaRef.current?.focus(), 50) }}
          title="New chat"
          disabled={isStreaming || chatDisabled}
        >
          <MessageSquarePlus size={14} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setShowHistory(true)}
          title="Chat history"
        >
          <History size={14} />
        </Button>
      </div>

      {/* Messages area */}
      <div
        ref={(node) => {
          scrollRef.current = node
          messagesPaddingRef.current = node
        }}
        className={`min-h-[150px] flex-1 overflow-y-auto rounded-md border p-3 ${messagesPadding ? 'pr-3' : ''}`}
      >
        <div className="flex flex-col gap-3 pb-2">
          {messages.length === 0 && !isStreaming && (
            chatDisabled ? (
              <EmptyState
                icon={<Server />}
                title="No endpoint connected"
                description="Add an Ollama endpoint to start chatting."
              >
                <Button
                  variant="default"
                  size="sm"
                  className="mt-2"
                  onClick={onGoToEndpoints}
                >
                  Add Endpoint
                </Button>
              </EmptyState>
            ) : (
              <EmptyState
                title="Start a conversation"
                description={selectedModel ? `Using ${selectedModel}` : 'Select a model above'}
              >
                {selectedModel && chatOptions.pageContextEnabled && pageContext && (
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const summarizeCmd = SYSTEM_COMMANDS.find((c) => c.id === 'system-summarize')
                      if (summarizeCmd) {
                        onSend('', [summarizeCmd.id])
                      }
                    }}
                  >
                    Summarize page
                  </Button>
                )}
              </EmptyState>
            )
          )}

          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            // Track the last user message for scroll targeting
            const isLastUserMsg = msg.role === 'user' && (
              isLast || (i === messages.length - 2 && messages[messages.length - 1].role === 'assistant')
            )
            const isLastAssistant = msg.role === 'assistant' && isLast

            if (isLastUserMsg) {
              return (
                <div key={i} ref={lastUserMsgRef}>
                  <MessageBubble message={msg} />
                </div>
              )
            }
            if (isLastAssistant) {
              return (
                <div key={i} style={responseMinHeight ? { minHeight: responseMinHeight } : undefined}>
                  <MessageBubble message={msg} />
                </div>
              )
            }
            return <MessageBubble key={i} message={msg} />
          })}

          {/* Streaming assistant response — scrolled into view once, then left alone */}
          {isStreaming && (
            <div style={responseMinHeight ? { minHeight: responseMinHeight } : undefined}>
              {streamingContent ? (
                <MessageBubble
                  message={{ role: 'assistant', content: streamingContent }}
                  isStreaming
                />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Commands & Options dropdowns */}
      <div className="flex items-center gap-1.5">
        {/* Commands dropdown - temporary per-chat single-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={activeCommand ? 'default' : 'outline'}
              size="sm"
              className="flex-1 justify-start gap-1.5 "
              disabled={chatDisabled}
            >
              <Zap size={12} className="shrink-0" />
              <span className="truncate">
                {activeCommand ? activeCommand.name : 'Command'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {commands.length === 0 ? (
              <p className="px-2 py-1.5 text-muted-foreground">
                No commands configured.
              </p>
            ) : (
              <DropdownMenuRadioGroup
                value={tempCommandId ?? ''}
                onValueChange={(val) => setTempCommandId(val === tempCommandId ? null : val)}
              >
                {commands.map((cmd) => (
                  <DropdownMenuRadioItem
                    key={cmd.id}
                    value={cmd.id}
                  >
                    {cmd.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Global context usage button */}
        <Popover open={globalPopoverOpen}>
          <PopoverAnchor asChild>
            <Button
              variant={globalExceedsLimit ? 'warning' : 'outline'}
              size="sm"
              className="shrink-0 gap-1.5 tabular-nums"
              disabled={chatDisabled}
              onMouseEnter={openGlobalPopover}
              onMouseLeave={closeGlobalPopover}
            >
              {globalExceedsLimit ? (
                <TriangleAlert size={12} className="shrink-0" />
              ) : (
                <Gauge size={12} className="shrink-0" />
              )}
              {globalUsagePercent.toFixed(0)}%
            </Button>
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            className="pointer-events-none w-56 p-3"
            onPointerDownOutside={(e) => e.preventDefault()}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">
                {hasActualUsage
                  ? 'Actual token usage reported by Ollama for the last request.'
                  : 'Send a message to see actual token usage.'}
              </p>
              <div className="flex items-center justify-between ">
                <span className="font-medium">Context window</span>
                <span className="text-muted-foreground">
                  {formatTokenCount(globalTokens)} / {formatTokenCount(maxContextTokens)}
                </span>
              </div>
              <Progress
                value={globalUsagePercent}
                className={`h-2 ${globalExceedsLimit ? '[&>[data-slot=progress-indicator]]:bg-destructive' : ''}`}
              />
              {globalExceedsLimit && (
                <p className="text-destructive">
                  Context window exceeded, older messages may be dropped.
                </p>
              )}

              {/* Cumulative token usage stats - temporarily hidden
              <div className="border-t pt-2 mt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Total usage</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onResetUsageStats}
                    title="Reset usage stats"
                  >
                    <RotateCcw size={10} />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Prompt</span>
                  <span>{formatTokenCount(tokenUsageStats.totalPromptTokens)} tokens</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Completion</span>
                  <span>{formatTokenCount(tokenUsageStats.totalCompletionTokens)} tokens</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Requests</span>
                  <span>{tokenUsageStats.totalRequests}</span>
                </div>
              </div>
              */}
            </div>
          </PopoverContent>
        </Popover>

        {/* Page context toggle button */}
        <Popover open={contextPopoverOpen}>
          <PopoverAnchor asChild>
            <Button
              variant={chatOptions.pageContextEnabled && pageContextExceedsLimit && pageContext ? 'destructive' : chatOptions.pageContextEnabled ? 'default' : 'outline'}
              size="sm"
              className="flex-1 justify-start gap-1.5 "
              disabled={pageContextLoading || chatDisabled}
              onClick={() => onTogglePageContext(!chatOptions.pageContextEnabled)}
              onMouseEnter={openContextPopover}
              onMouseLeave={closeContextPopover}
            >
              {pageContextLoading ? (
                <Spinner className="size-3 shrink-0" />
              ) : chatOptions.pageContextEnabled && pageContextExceedsLimit && pageContext ? (
                <TriangleAlert size={12} className="shrink-0" />
              ) : (
                <FileText size={12} className="shrink-0" />
              )}
              Include page
            </Button>
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            className="pointer-events-none w-56 p-3"
            onPointerDownOutside={(e) => e.preventDefault()}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">
                Extracts the visible text from the current page and sends it as additional data with your message.
              </p>
              {pageContext && (
                <>
                  <div className="flex items-center justify-between ">
                    <span className="font-medium">Page size</span>
                    <span className="text-muted-foreground">~{formatTokenCount(pageTokens)} tokens</span>
                  </div>
                  <div className="flex items-center justify-between ">
                    <span className="font-medium">Fits in context</span>
                    <span className={pageFitsInRemaining ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                      {pageFitsInRemaining ? 'Yes' : 'No'}
                    </span>
                  </div>
                </>
              )}
              {pageContext && chatOptions.pageContextEnabled && !pageFitsInRemaining && (
                <p className="text-destructive">
                  Page content exceeds remaining context and will be automatically truncated to fit.
                </p>
              )}
              {chatOptions.pageContextEnabled && !pageContext && !pageContextLoading && (
                <p className="text-muted-foreground italic">
                  No extractable text found on this page.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 "
            >
              {file.type.startsWith('image/') ? (
                <Image size={10} className="shrink-0 opacity-60" />
              ) : (
                <FileText size={10} className="shrink-0 opacity-60" />
              )}
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                type="button"
                className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
                onClick={() => removeAttachment(i)}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.rb,.rs,.go,.java,.c,.cpp,.h,.yml,.yaml,.toml,.log,.sh,.bat,.sql,.env"
      />

      {/* Input area */}
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupButton
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedModel || isStreaming || chatDisabled}
            title="Attach files"
          >
            <Paperclip size={14} />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupTextarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={chatDisabled ? 'Connect an endpoint to chat' : selectedModel ? 'Type a message…' : 'Select a model first'}
          disabled={!selectedModel || chatDisabled}
          className="min-h-[36px] max-h-[120px] py-2"
          rows={1}
        />
        <InputGroupAddon align="inline-end">
          {isStreaming ? (
            <InputGroupButton
              variant="destructive"
              size="icon-sm"
              onClick={onStop}
              title="Stop generating"
            >
              <Square size={14} />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              variant="default"
              size="icon-sm"
              onClick={handleSubmit}
              disabled={(!input.trim() && !tempCommandId && attachments.length === 0) || !selectedModel || chatDisabled}
              title="Send message"
            >
              <ArrowUp size={14} />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
