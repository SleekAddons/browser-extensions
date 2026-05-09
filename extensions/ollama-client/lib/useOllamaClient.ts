import { browser } from 'wxt/browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  OllamaEndpoint,
  OllamaEndpointState,
  OllamaModel,
  Conversation,
  ChatMessage,
  ChatCommand,
  ChatOptions,
  PageContext,
  TokenUsageStats,
  FileAttachment,
} from './types'
import { extractPageContent } from './extract-page-content'
import { listModels, streamChat, checkConnection } from './api'
import {
  loadEndpoints,
  addEndpoint,
  updateEndpoint,
  removeEndpoint,
  loadConversations,
  upsertConversation,
  removeConversation,
  removeConversationsByEndpoint,
  loadCommands,
  addCommand as addCommandToStorage,
  updateCommand as updateCommandInStorage,
  removeCommand as removeCommandFromStorage,
  loadChatOptions,
  saveChatOptions,
  loadSelectedModel,
  saveSelectedModel,
  loadActiveConversationId,
  saveActiveConversationId,
  loadActiveEndpointId,
  saveActiveEndpointId,
  loadTokenUsage,
  addTokenUsage,
  resetTokenUsage,
} from './storage'

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}

/**
 * Extracts the page HTML and URL from the active tab.
 * This function runs inside the page context via chrome.scripting.executeScript.
 * Must be self-contained (no closures).
 */
function extractPageHtml(): { html: string; url: string } {
  return {
    html: document.documentElement.outerHTML,
    url: document.URL,
  }
}

export function useOllamaClient() {
  const [endpoints, setEndpoints] = useState<OllamaEndpoint[]>([])
  const [states, setStates] = useState<Map<string, OllamaEndpointState>>(new Map())
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pageContext, setPageContext] = useState<PageContext | null>(null)
  const [pageContextLoading, setPageContextLoading] = useState(false)
  const [chatOptions, setChatOptions] = useState<ChatOptions>({
    pageContextEnabled: false,
    pageContextAutoDisabled: false,
    activeCommandIds: [],
  })
  const [commands, setCommands] = useState<ChatCommand[]>([])
  const [tokenUsageStats, setTokenUsageStats] = useState<TokenUsageStats>({
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalRequests: 0,
  })
  const abortControllerRef = useRef<AbortController | null>(null)

  /** Update the state for a specific endpoint. */
  const updateState = useCallback(
    (id: string, patch: Partial<OllamaEndpointState>) => {
      setStates((prev) => {
        const next = new Map(prev)
        const existing = next.get(id)
        if (existing) {
          next.set(id, { ...existing, ...patch })
        }
        return next
      })
    },
    [],
  )

  /** Connect to a single endpoint: check connection, fetch models. */
  const connectEndpoint = useCallback(
    async (endpoint: OllamaEndpoint) => {
      const id = endpoint.id

      setStates((prev) => {
        const next = new Map(prev)
        next.set(id, {
          endpoint,
          models: [],
          connected: false,
          loading: true,
          error: null,
        })
        return next
      })

      try {
        const reachable = await checkConnection(endpoint.baseUrl, endpoint.authToken)
        if (!reachable) {
          updateState(id, {
            loading: false,
            error: 'Cannot reach Ollama server',
          })
          return
        }

        const models = await listModels(endpoint.baseUrl, endpoint.authToken)
        updateState(id, {
          models,
          connected: true,
          loading: false,
        })
      } catch (err) {
        updateState(id, {
          loading: false,
          error: err instanceof Error ? err.message : 'Connection failed',
        })
      }
    },
    [updateState],
  )

  /** Refresh models for a connected endpoint. */
  const refreshEndpoint = useCallback(
    async (id: string) => {
      const state = states.get(id)
      if (!state) return

      updateState(id, { loading: true, error: null })

      try {
        const models = await listModels(state.endpoint.baseUrl, state.endpoint.authToken)
        updateState(id, { models, connected: true, loading: false })
      } catch (err) {
        updateState(id, {
          loading: false,
          error: err instanceof Error ? err.message : 'Refresh failed',
        })
      }
    },
    [states, updateState],
  )

  /** Save a new endpoint and connect to it. */
  const addNewEndpoint = useCallback(
    async (data: Omit<OllamaEndpoint, 'id'>) => {
      const endpoint: OllamaEndpoint = {
        ...data,
        id: crypto.randomUUID(),
      }
      const updated = await addEndpoint(endpoint)
      setEndpoints(updated)
      await connectEndpoint(endpoint)

      // Auto-select the first endpoint if none selected
      setActiveEndpointId((prev) => {
        if (prev) return prev
        saveActiveEndpointId(endpoint.id)
        return endpoint.id
      })
    },
    [connectEndpoint],
  )

  /** Edit an existing endpoint and reconnect. */
  const editEndpoint = useCallback(
    async (id: string, data: Partial<Omit<OllamaEndpoint, 'id'>>) => {
      const updated = await updateEndpoint(id, data)
      setEndpoints(updated)
      const ep = updated.find((e) => e.id === id)
      if (ep) {
        await connectEndpoint(ep)
      }
    },
    [connectEndpoint],
  )

  /** Remove an endpoint and its conversations. */
  const deleteEndpoint = useCallback(
    async (id: string) => {
      const updated = await removeEndpoint(id)
      setEndpoints(updated)
      setStates((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })

      const updatedConvos = await removeConversationsByEndpoint(id)
      setConversations(updatedConvos)

      // If the active endpoint was deleted, switch to another
      setActiveEndpointId((prev) => {
        if (prev === id) {
          const next = updated[0]?.id ?? null
          saveActiveEndpointId(next)
          return next
        }
        return prev
      })

      // If the active conversation belonged to the deleted endpoint, clear it
      setActiveConversationId((prev) => {
        if (prev && updatedConvos.every((c) => c.id !== prev)) {
          saveActiveConversationId(null)
          return null
        }
        return prev
      })
    },
    [],
  )

  /** Create a new conversation. */
  const createConversation = useCallback(
    async (endpointId: string, model: string): Promise<Conversation> => {
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        endpointId,
        model,
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const updated = await upsertConversation(conversation)
      setConversations(updated)
      setActiveConversationId(conversation.id)
      saveActiveConversationId(conversation.id)
      return conversation
    },
    [],
  )

  /** Delete a conversation. */
  const deleteConversation = useCallback(
    async (id: string) => {
      const updated = await removeConversation(id)
      setConversations(updated)
      setActiveConversationId((prev) => {
        const next = prev === id ? null : prev
        saveActiveConversationId(next)
        return next
      })
    },
    [],
  )

  /** Extract page content from the active tab. Returns the context or null. */
  const getPageContext = useCallback(async (): Promise<PageContext | null> => {
    try {
      const tabId = await getActiveTabId()
      if (!tabId) return null

      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: extractPageHtml,
      })
      const raw = results?.[0]?.result as { html: string; url: string } | undefined
      if (!raw?.html) return null

      return extractPageContent(raw.html, raw.url)
    } catch {
      return null
    }
  }, [])

  /** Fetch page content from the active tab and update state for the UI. */
  const fetchPageContext = useCallback(async () => {
    setPageContextLoading(true)
    try {
      const ctx = await getPageContext()
      setPageContext(ctx)
      return ctx
    } finally {
      setPageContextLoading(false)
    }
  }, [getPageContext])

  /** Update chat options and persist. */
  const updateChatOptions = useCallback(
    async (patch: Partial<ChatOptions>) => {
      const next = { ...chatOptions, ...patch }
      setChatOptions(next)
      await saveChatOptions(next)

      // If page context was just enabled, fetch it
      if (patch.pageContextEnabled && !chatOptions.pageContextEnabled) {
        await fetchPageContext()
      }
    },
    [chatOptions, fetchPageContext, states, activeEndpointId],
  )

  /** Toggle a command's active state in chat options. */
  const toggleCommand = useCallback(
    async (commandId: string, enabled: boolean) => {
      const activeCommandIds = enabled
        ? [...chatOptions.activeCommandIds, commandId]
        : chatOptions.activeCommandIds.filter((id) => id !== commandId)
      await updateChatOptions({ activeCommandIds })
    },
    [chatOptions.activeCommandIds, updateChatOptions],
  )

  // ── Commands CRUD ──────────────────────────────────────────

  const addNewCommand = useCallback(
    async (data: Omit<ChatCommand, 'id'>) => {
      const command: ChatCommand = { ...data, id: crypto.randomUUID() }
      const updated = await addCommandToStorage(command)
      setCommands(updated)
    },
    [],
  )

  const editCommand = useCallback(
    async (id: string, data: Partial<Omit<ChatCommand, 'id'>>) => {
      const updated = await updateCommandInStorage(id, data)
      setCommands(updated)
    },
    [],
  )

  const deleteCommand = useCallback(
    async (id: string) => {
      const updated = await removeCommandFromStorage(id)
      setCommands(updated)
      // Remove from active list if it was active
      if (chatOptions.activeCommandIds.includes(id)) {
        const activeCommandIds = chatOptions.activeCommandIds.filter((cid) => cid !== id)
        await updateChatOptions({ activeCommandIds })
      }
    },
    [chatOptions.activeCommandIds, updateChatOptions],
  )

  /** Send a message and stream the response. */
  const sendMessage = useCallback(
    async (content: string, tempCommandIds?: string[], attachments?: FileAttachment[]) => {
      if (!activeEndpointId || !selectedModel) return
      if (isStreaming) return

      const state = states.get(activeEndpointId)
      if (!state?.connected) return

      // Get or create a conversation
      let conversation: Conversation
      if (activeConversationId) {
        const existing = conversations.find((c) => c.id === activeConversationId)
        if (!existing) return
        conversation = existing
      } else {
        conversation = await createConversation(activeEndpointId, selectedModel)
      }

      // Add the user message (skip empty messages sent via command-only or attachment-only)
      const hasContent = content.trim().length > 0
      const hasAttachments = attachments && attachments.length > 0

      // Build API content - append text file contents (not persisted)
      let apiContent = content
      if (hasAttachments) {
        const textAttachments = attachments.filter((a) => a.textContent)
        for (const file of textAttachments) {
          apiContent += `${apiContent ? '\n\n' : ''}[File: ${file.name}]\n${file.textContent}`
        }
      }

      // Collect base64 images for Ollama's images field
      const imageBase64 = hasAttachments
        ? attachments.filter((a) => a.base64).map((a) => a.base64!)
        : undefined

      // Build the user message for storage (without file content or base64 data)
      const userMessageForStorage: ChatMessage = {
        role: 'user',
        content,
        ...(hasAttachments ? { attachments: attachments.map(({ base64, textContent, ...meta }) => meta) } : {}),
      }

      // Build the user message for the API (with file text inlined and images)
      const userMessageForApi: ChatMessage = {
        role: 'user',
        content: apiContent,
        ...(hasAttachments ? { attachments: attachments.map(({ base64, textContent, ...meta }) => meta) } : {}),
        ...(imageBase64 && imageBase64.length > 0 ? { images: imageBase64 } : {}),
      }

      const updatedMessages = (hasContent || hasAttachments)
        ? [...conversation.messages, userMessageForStorage]
        : [...conversation.messages]

      const title = conversation.messages.length === 0
        ? hasContent
          ? content.slice(0, 50) + (content.length > 50 ? '…' : '')
          : hasAttachments
            ? attachments.map((a) => a.name).join(', ').slice(0, 50)
            : (commands.find((c) => c.id === (tempCommandIds ?? chatOptions.activeCommandIds)[0])?.name ?? 'Command')
        : conversation.title

      conversation = {
        ...conversation,
        messages: updatedMessages,
        title,
        updatedAt: Date.now(),
      }

      const savedConvos = await upsertConversation(conversation)
      setConversations(savedConvos)

      // Start streaming
      setIsStreaming(true)
      setStreamingContent('')

      const controller = new AbortController()
      abortControllerRef.current = controller

      let assistantContent = ''

      // Build messages for API - prepend system messages for active options
      const apiMessages: ChatMessage[] = []

      // Endpoint-level system prompt (always first)
      if (state.endpoint.systemPrompt) {
        apiMessages.push({ role: 'system', content: state.endpoint.systemPrompt })
      }

      // Active commands → system messages (use temp IDs if provided)
      const commandIds = tempCommandIds ?? chatOptions.activeCommandIds
      for (const cmdId of commandIds) {
        const cmd = commands.find((c) => c.id === cmdId)
        if (cmd) {
          apiMessages.push({ role: 'system', content: cmd.prompt })
        }
      }

      // Page context - fetch fresh content to avoid stale/null state
      if (chatOptions.pageContextEnabled) {
        const freshContext = await getPageContext()
        setPageContext(freshContext)

        if (freshContext) {
          const maxTokens = state.endpoint.contextSize ?? 4096
          const maxChars = maxTokens * 4
          let pageText = freshContext.textContent
          let truncated = false
          let truncatedNotice = ''

          if (pageText.length > maxChars) {
            pageText = pageText.slice(0, maxChars)
            truncated = true
            truncatedNotice = '\n\n[WARNING: Page content was truncated to fit the context window.]'
          }

          const meta = [
            freshContext.title && `Title: ${freshContext.title}`,
            freshContext.byline && `Author: ${freshContext.byline}`,
            freshContext.siteName && `Site: ${freshContext.siteName}`,
            `URL: ${freshContext.url}`,
          ].filter(Boolean).join('\n')

          apiMessages.push({
            role: 'system',
            content: `The user is viewing a web page. The raw page content is provided below. Focus on the main article or primary textual content — this is the most valuable information. Ignore boilerplate such as navigation menus, headers, footers, sidebars, cookie banners, ads, and other repetitive or non-essential elements.\n\n${meta}\n\nPage content:\n\n${pageText}${truncatedNotice}`,
          })

          // Attach page context metadata to the last user message for display
          const pageTokens = Math.ceil(freshContext.textContent.length / 4)
          const lastUserIdx = conversation.messages.length - 1
          if (lastUserIdx >= 0 && conversation.messages[lastUserIdx].role === 'user') {
            conversation = {
              ...conversation,
              messages: conversation.messages.map((m, i) =>
                i === lastUserIdx
                  ? { ...m, pageContext: { title: freshContext.title, url: freshContext.url, tokens: pageTokens, truncated } }
                  : m,
              ),
            }
            const refreshedConvos = await upsertConversation(conversation)
            setConversations(refreshedConvos)
          }
        }

        // Auto-disable page context after it's been included in the first message
        updateChatOptions({ pageContextEnabled: false, pageContextAutoDisabled: true })
      }

      // Push conversation history - swap the last user message with the API version (includes images)
      for (const msg of updatedMessages) {
        if (msg === userMessageForStorage && userMessageForApi !== userMessageForStorage) {
          apiMessages.push(userMessageForApi)
        } else {
          apiMessages.push(msg)
        }
      }

      // If no user message in the conversation (command-only), add a trigger for the API
      if (!hasContent && !hasAttachments && updatedMessages.every((m) => m.role !== 'user')) {
        apiMessages.push({
          role: 'user',
          content: 'Please follow the system instructions above.',
        })
      }

      try {
        const tokenUsage = await streamChat(
          state.endpoint.baseUrl,
          selectedModel,
          apiMessages,
          (chunk) => {
            if (chunk.message?.content) {
              assistantContent += chunk.message.content
              setStreamingContent(assistantContent)
            }
          },
          controller.signal,
          { contextSize: state.endpoint.contextSize, authToken: state.endpoint.authToken },
        )

        // Save the complete assistant message
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: assistantContent,
          tokenUsage: tokenUsage ?? undefined,
        }

        conversation = {
          ...conversation,
          messages: [...conversation.messages, assistantMessage],
          updatedAt: Date.now(),
        }

        const finalConvos = await upsertConversation(conversation)
        setConversations(finalConvos)

        // Accumulate global token usage stats
        if (tokenUsage) {
          const updated = await addTokenUsage(tokenUsage.promptTokens, tokenUsage.completionTokens)
          setTokenUsageStats(updated)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Save whatever was streamed so far
          if (assistantContent) {
            const partialMessage: ChatMessage = {
              role: 'assistant',
              content: assistantContent,
            }
            conversation = {
              ...conversation,
              messages: [...conversation.messages, partialMessage],
              updatedAt: Date.now(),
            }
            const partialConvos = await upsertConversation(conversation)
            setConversations(partialConvos)
          }
        } else {
          // Add error as a system-level message for display
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Request failed'}`,
          }
          conversation = {
            ...conversation,
            messages: [...conversation.messages, errorMessage],
            updatedAt: Date.now(),
          }
          const errorConvos = await upsertConversation(conversation)
          setConversations(errorConvos)
        }
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
        abortControllerRef.current = null
      }
    },
    [activeEndpointId, selectedModel, isStreaming, states, activeConversationId, conversations, createConversation, chatOptions, commands, getPageContext],
  )

  /** Stop the current streaming response. */
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  /** Get the active conversation object. */
  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId) ?? null
    : null

  /** Get models for the active endpoint. */
  const activeEndpointState = activeEndpointId
    ? states.get(activeEndpointId) ?? null
    : null

  const activeModels: OllamaModel[] = activeEndpointState?.models ?? []

  /** Load endpoints and conversations on mount. */
  useEffect(() => {
    let cancelled = false
    async function init() {
      const [savedEndpoints, savedConversations, savedCommands, savedOptions, savedModel, savedActiveConvoId, savedActiveEndpointId, savedTokenUsage] = await Promise.all([
        loadEndpoints(),
        loadConversations(),
        loadCommands(),
        loadChatOptions(),
        loadSelectedModel(),
        loadActiveConversationId(),
        loadActiveEndpointId(),
        loadTokenUsage(),
      ])
      if (cancelled) return

      setEndpoints(savedEndpoints)
      setConversations(savedConversations)
      setCommands(savedCommands)
      setChatOptions(savedOptions)
      setTokenUsageStats(savedTokenUsage)
      if (savedModel) setSelectedModel(savedModel)
      setLoading(false)

      // Fetch page content if the persisted option had it enabled
      if (savedOptions.pageContextEnabled) {
        fetchPageContext()
      }

      // Restore active endpoint (fall back to first available)
      const restoredEndpointId = savedActiveEndpointId && savedEndpoints.some((e) => e.id === savedActiveEndpointId)
        ? savedActiveEndpointId
        : savedEndpoints[0]?.id ?? null
      if (restoredEndpointId) {
        setActiveEndpointId(restoredEndpointId)
      }

      // Restore active conversation (only if it still exists and belongs to the active endpoint)
      if (savedActiveConvoId && savedConversations.some((c) => c.id === savedActiveConvoId && c.endpointId === restoredEndpointId)) {
        setActiveConversationId(savedActiveConvoId)
      }

      for (const endpoint of savedEndpoints) {
        if (!cancelled) {
          connectEndpoint(endpoint)
        }
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [connectEndpoint, fetchPageContext])

  /** Re-fetch page context when the user switches browser tabs (sidepanel use-case). */
  useEffect(() => {
    if (!browser.tabs?.onActivated) return

    const listener = () => {
      if (chatOptions.pageContextEnabled) {
        fetchPageContext()
      }
    }

    browser.tabs.onActivated.addListener(listener)
    return () => {
      browser.tabs.onActivated.removeListener(listener)
    }
  }, [chatOptions.pageContextEnabled, fetchPageContext])

  /** Auto-select first model when active endpoint changes or models load. */
  useEffect(() => {
    if (activeModels.length > 0 && !selectedModel) {
      setSelectedModel(activeModels[0].name)
      saveSelectedModel(activeModels[0].name)
    }
    // Reset model selection if switching endpoints
    if (activeEndpointId && activeModels.length > 0) {
      const modelExists = activeModels.some((m) => m.name === selectedModel)
      if (!modelExists) {
        setSelectedModel(activeModels[0].name)
        saveSelectedModel(activeModels[0].name)
      }
    }
  }, [activeEndpointId, activeModels, selectedModel])

  /** Filter conversations for the active endpoint. */
  const endpointConversations = conversations.filter(
    (c) => c.endpointId === activeEndpointId,
  )

  /** Reset cumulative token usage stats. */
  const resetUsageStats = useCallback(async () => {
    const fresh = await resetTokenUsage()
    setTokenUsageStats(fresh)
  }, [])

  return {
    // Endpoint management
    endpoints,
    states,
    loading,
    activeEndpointId,
    activeEndpointState,
    setActiveEndpointId: (id: string | null) => {
      setActiveEndpointId(id)
      saveActiveEndpointId(id)
    },
    addNewEndpoint,
    editEndpoint,
    deleteEndpoint,
    refreshEndpoint,

    // Model selection
    activeModels,
    selectedModel,
    setSelectedModel: (model: string | null) => {
      setSelectedModel(model)
      saveSelectedModel(model)
    },

    // Conversation management
    conversations: endpointConversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId: (id: string | null) => {
      setActiveConversationId(id)
      saveActiveConversationId(id)
    },
    createConversation,
    deleteConversation,

    // Chat
    sendMessage,
    stopStreaming,
    isStreaming,
    streamingContent,

    // Page context
    pageContext,
    pageContextLoading,
    fetchPageContext,

    // Chat options
    chatOptions,
    updateChatOptions,
    toggleCommand,

    // Commands
    commands,
    addNewCommand,
    editCommand,
    deleteCommand,

    // Token usage
    tokenUsageStats,
    resetUsageStats,
  }
}
