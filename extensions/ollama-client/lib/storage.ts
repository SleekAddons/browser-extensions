import { browser } from 'wxt/browser'
import type { OllamaEndpoint, Conversation, ChatCommand, ChatOptions, TokenUsageStats } from './types'
import { SYSTEM_COMMANDS } from './types'

const ENDPOINTS_KEY = 'ollama_endpoints'
const CONVERSATIONS_KEY = 'ollama_conversations'
const COMMANDS_KEY = 'ollama_commands'
const CHAT_OPTIONS_KEY = 'ollama_chat_options'
const SELECTED_MODEL_KEY = 'ollama_selected_model'
const TOKEN_USAGE_KEY = 'ollama_token_usage'

/** Maximum number of conversations kept in storage. Oldest are pruned on save. */
export const MAX_CONVERSATIONS = 100

const DEFAULT_CHAT_OPTIONS: ChatOptions = {
  pageContextEnabled: false,
  pageContextAutoDisabled: false,
  activeCommandIds: [],
}

/** Load all saved Ollama endpoints from storage. */
export async function loadEndpoints(): Promise<OllamaEndpoint[]> {
  const result = await browser.storage.local.get(ENDPOINTS_KEY)
  return (result[ENDPOINTS_KEY] as OllamaEndpoint[] | undefined) ?? []
}

/** Save all endpoints to storage. */
export async function saveEndpoints(endpoints: OllamaEndpoint[]): Promise<void> {
  await browser.storage.local.set({ [ENDPOINTS_KEY]: endpoints })
}

/** Add a new endpoint and persist. */
export async function addEndpoint(endpoint: OllamaEndpoint): Promise<OllamaEndpoint[]> {
  const endpoints = await loadEndpoints()
  endpoints.push(endpoint)
  await saveEndpoints(endpoints)
  return endpoints
}

/** Update an existing endpoint by ID and persist. */
export async function updateEndpoint(
  id: string,
  data: Partial<Omit<OllamaEndpoint, 'id'>>,
): Promise<OllamaEndpoint[]> {
  const endpoints = await loadEndpoints()
  const idx = endpoints.findIndex((e) => e.id === id)
  if (idx === -1) throw new Error('Endpoint not found')
  endpoints[idx] = { ...endpoints[idx], ...data }
  await saveEndpoints(endpoints)
  return endpoints
}

/** Remove an endpoint by ID and persist. */
export async function removeEndpoint(id: string): Promise<OllamaEndpoint[]> {
  const endpoints = (await loadEndpoints()).filter((e) => e.id !== id)
  await saveEndpoints(endpoints)
  return endpoints
}

/** Load all conversations from storage. */
export async function loadConversations(): Promise<Conversation[]> {
  const result = await browser.storage.local.get(CONVERSATIONS_KEY)
  return (result[CONVERSATIONS_KEY] as Conversation[] | undefined) ?? []
}

/** Save all conversations to storage, keeping only the most recent ones. */
export async function saveConversations(conversations: Conversation[]): Promise<void> {
  const trimmed = conversations.slice(0, MAX_CONVERSATIONS)
  await browser.storage.local.set({ [CONVERSATIONS_KEY]: trimmed })
}

/** Save or update a single conversation. */
export async function upsertConversation(conversation: Conversation): Promise<Conversation[]> {
  const conversations = await loadConversations()
  const idx = conversations.findIndex((c) => c.id === conversation.id)
  if (idx === -1) {
    conversations.unshift(conversation)
  } else {
    conversations[idx] = conversation
  }
  await saveConversations(conversations)
  return conversations
}

/** Remove a conversation by ID. */
export async function removeConversation(id: string): Promise<Conversation[]> {
  const conversations = (await loadConversations()).filter((c) => c.id !== id)
  await saveConversations(conversations)
  return conversations
}

/** Remove all conversations for a specific endpoint. */
export async function removeConversationsByEndpoint(endpointId: string): Promise<Conversation[]> {
  const conversations = (await loadConversations()).filter((c) => c.endpointId !== endpointId)
  await saveConversations(conversations)
  return conversations
}

// ── Chat Commands ──────────────────────────────────────────

/** Load all saved commands, always including built-in system commands. */
export async function loadCommands(): Promise<ChatCommand[]> {
  const result = await browser.storage.local.get(COMMANDS_KEY)
  const userCommands = (result[COMMANDS_KEY] as ChatCommand[] | undefined) ?? []
  // Merge system commands (always first, never duplicated)
  const systemIds = new Set(SYSTEM_COMMANDS.map((c) => c.id))
  const filtered = userCommands.filter((c) => !systemIds.has(c.id))
  return [...SYSTEM_COMMANDS, ...filtered]
}

/** Save all commands. */
export async function saveCommands(commands: ChatCommand[]): Promise<void> {
  await browser.storage.local.set({ [COMMANDS_KEY]: commands })
}

/** Add a new command and persist. */
export async function addCommand(command: ChatCommand): Promise<ChatCommand[]> {
  const commands = await loadCommands()
  commands.push(command)
  await saveCommands(commands)
  return commands
}

/** Update an existing command by ID and persist. */
export async function updateCommand(
  id: string,
  data: Partial<Omit<ChatCommand, 'id'>>,
): Promise<ChatCommand[]> {
  const commands = await loadCommands()
  const idx = commands.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error('Command not found')
  commands[idx] = { ...commands[idx], ...data }
  await saveCommands(commands)
  return commands
}

/** Remove a command by ID and persist. System commands cannot be removed. */
export async function removeCommand(id: string): Promise<ChatCommand[]> {
  if (SYSTEM_COMMANDS.some((c) => c.id === id)) return loadCommands()
  const commands = (await loadCommands()).filter((c) => c.id !== id)
  await saveCommands(commands)
  return commands
}

// ── Chat Options ───────────────────────────────────────────

/** Load chat options from storage. */
export async function loadChatOptions(): Promise<ChatOptions> {
  const result = await browser.storage.local.get(CHAT_OPTIONS_KEY)
  return (result[CHAT_OPTIONS_KEY] as ChatOptions | undefined) ?? { ...DEFAULT_CHAT_OPTIONS }
}

/** Save chat options to storage. */
export async function saveChatOptions(options: ChatOptions): Promise<void> {
  await browser.storage.local.set({ [CHAT_OPTIONS_KEY]: options })
}

// ── Selected Model ─────────────────────────────────────────

/** Load the persisted selected model name. */
export async function loadSelectedModel(): Promise<string | null> {
  const result = await browser.storage.local.get(SELECTED_MODEL_KEY)
  return (result[SELECTED_MODEL_KEY] as string | undefined) ?? null
}

/** Save the selected model name. */
export async function saveSelectedModel(model: string | null): Promise<void> {
  await browser.storage.local.set({ [SELECTED_MODEL_KEY]: model })
}

// ── Active Conversation / Endpoint ─────────────────────────

const ACTIVE_CONVERSATION_KEY = 'ollama_active_conversation_id'
const ACTIVE_ENDPOINT_KEY = 'ollama_active_endpoint_id'

/** Load the persisted active conversation ID. */
export async function loadActiveConversationId(): Promise<string | null> {
  const result = await browser.storage.local.get(ACTIVE_CONVERSATION_KEY)
  return (result[ACTIVE_CONVERSATION_KEY] as string | undefined) ?? null
}

/** Save the active conversation ID. */
export async function saveActiveConversationId(id: string | null): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_CONVERSATION_KEY]: id })
}

/** Load the persisted active endpoint ID. */
export async function loadActiveEndpointId(): Promise<string | null> {
  const result = await browser.storage.local.get(ACTIVE_ENDPOINT_KEY)
  return (result[ACTIVE_ENDPOINT_KEY] as string | undefined) ?? null
}

/** Save the active endpoint ID. */
export async function saveActiveEndpointId(id: string | null): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_ENDPOINT_KEY]: id })
}

// ── Token Usage ────────────────────────────────────────────

const DEFAULT_TOKEN_USAGE: TokenUsageStats = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalRequests: 0,
}

/** Load cumulative token usage stats. */
export async function loadTokenUsage(): Promise<TokenUsageStats> {
  const result = await browser.storage.local.get(TOKEN_USAGE_KEY)
  return (result[TOKEN_USAGE_KEY] as TokenUsageStats | undefined) ?? { ...DEFAULT_TOKEN_USAGE }
}

/** Save cumulative token usage stats. */
export async function saveTokenUsage(stats: TokenUsageStats): Promise<void> {
  await browser.storage.local.set({ [TOKEN_USAGE_KEY]: stats })
}

/** Add token usage from a single request to the cumulative stats. */
export async function addTokenUsage(promptTokens: number, completionTokens: number): Promise<TokenUsageStats> {
  const current = await loadTokenUsage()
  const updated: TokenUsageStats = {
    totalPromptTokens: current.totalPromptTokens + promptTokens,
    totalCompletionTokens: current.totalCompletionTokens + completionTokens,
    totalRequests: current.totalRequests + 1,
  }
  await saveTokenUsage(updated)
  return updated
}

/** Reset token usage stats to zero. */
export async function resetTokenUsage(): Promise<TokenUsageStats> {
  const fresh = { ...DEFAULT_TOKEN_USAGE }
  await saveTokenUsage(fresh)
  return fresh
}
