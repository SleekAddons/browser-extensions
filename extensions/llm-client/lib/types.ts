/** API an endpoint speaks */
export type EndpointProvider = 'ollama' | 'openai'

/** A saved endpoint configuration */
export interface Endpoint {
  /** Unique identifier */
  id: string
  /** Display name for this endpoint */
  name: string
  /** API the server speaks: Ollama's own API, or the OpenAI Chat Completions API */
  provider: EndpointProvider
  /**
   * Base URL of the server. Ollama: the server root (e.g. http://localhost:11434).
   * OpenAI-compatible: the API root including its version (e.g. https://api.openai.com/v1).
   */
  baseUrl: string
  /** Optional Bearer token (API key) for authenticated endpoints */
  authToken?: string
  /**
   * Context window size in tokens. Ollama receives it as num_ctx; for OpenAI-compatible
   * servers it only sizes the usage meter and page-content trimming.
   */
  contextSize?: number
  /** Optional system prompt prepended to every conversation on this endpoint */
  systemPrompt?: string
}

/**
 * An endpoint as found in storage. Endpoints saved before OpenAI-compatible
 * support was added have no provider: they are all Ollama endpoints.
 */
export type StoredEndpoint = Omit<Endpoint, 'provider'> & { provider?: string }

/** A model offered by an endpoint */
export interface ModelInfo {
  /** Model identifier sent with chat requests */
  name: string
  /** Size on disk in bytes (reported by Ollama only) */
  size?: number
  /** Context window in tokens, when the server reports it */
  contextLength?: number
}

/** Metadata stored on a user message when page context was included */
export interface MessagePageContext {
  /** Page title */
  title: string
  /** Source URL */
  url: string
  /** Approximate token count of the included text */
  tokens: number
  /** Whether the content was truncated to fit */
  truncated: boolean
}

/** Metadata for a file attached to a chat message */
export interface FileAttachment {
  /** Original file name */
  name: string
  /** MIME type */
  type: string
  /** File size in bytes */
  size: number
  /** For images: base64-encoded data (without the data URI prefix) */
  base64?: string
  /** For text files: the file's text content */
  textContent?: string
}

/** A single chat message, as stored in a conversation */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** File attachment metadata for display purposes */
  attachments?: FileAttachment[]
  /** Present on user messages that included page context */
  pageContext?: MessagePageContext
  /** Actual token usage reported by the server (present on assistant messages) */
  tokenUsage?: TokenUsage
}

/** An image sent to a vision model */
export interface ImageInput {
  /** MIME type, e.g. image/png */
  mimeType: string
  /** Base64-encoded data (without the data URI prefix) */
  data: string
}

/** A message as sent to the model with a chat request (never stored) */
export interface RequestMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Images attached to this message */
  images?: ImageInput[]
}

/** A saved conversation */
export interface Conversation {
  /** Unique identifier */
  id: string
  /** Endpoint ID this conversation belongs to */
  endpointId: string
  /** Model used for this conversation */
  model: string
  /** Display title (first user message or auto-generated) */
  title: string
  /** Chat messages */
  messages: ChatMessage[]
  /** Timestamp when conversation was created */
  createdAt: number
  /** Timestamp of last activity */
  updatedAt: number
}

/** Token usage reported by the server at the end of a response */
export interface TokenUsage {
  /** Number of tokens evaluated in the prompt */
  promptTokens: number
  /** Number of tokens generated in the response */
  completionTokens: number
  /** Total duration in nanoseconds (Ollama only) */
  totalDuration?: number
  /** Time spent evaluating the prompt in nanoseconds (Ollama only) */
  promptEvalDuration?: number
  /** Time spent generating the response in nanoseconds (Ollama only) */
  evalDuration?: number
}

/** State for a connected endpoint */
export interface EndpointState {
  endpoint: Endpoint
  models: ModelInfo[]
  connected: boolean
  loading: boolean
  error: string | null
}

/** A user-defined reusable command / prompt template */
export interface ChatCommand {
  /** Unique identifier */
  id: string
  /** Short display name shown in the options menu (e.g. "Explain") */
  name: string
  /** System prompt that gets prepended when this command is active */
  prompt: string
  /** Whether this is a built-in system command (cannot be deleted or edited) */
  system?: boolean
}

/** Built-in system commands that are always available */
export const SYSTEM_COMMANDS: ChatCommand[] = [
  {
    id: 'system-explain',
    name: 'Explain',
    prompt:
      'Explain the following content in simple, clear terms. ' +
      'You MUST respond in the same language as the content provided by the user. ' +
      'If the content is in French, respond in French. If in Spanish, respond in Spanish. ' +
      'Always match the language of the source content.',
    system: true,
  },
  {
    id: 'system-summarize',
    name: 'Summarize',
    prompt:
      'Summarize the following content concisely, highlighting the key points. ' +
      'You MUST respond in the same language as the content provided by the user. ' +
      'If the content is in French, respond in French. If in Spanish, respond in Spanish. ' +
      'Always match the language of the source content.',
    system: true,
  },
]

/** Extracted page content from the active tab */
export interface PageContext {
  /** Article title */
  title: string
  /** Cleaned HTML content */
  content: string
  /** Plain-text content */
  textContent: string
  /** Short excerpt / description */
  excerpt: string
  /** Author byline (if detected) */
  byline: string | null
  /** Site name (if detected) */
  siteName: string | null
  /** Text content length in characters */
  length: number
  /** Source page URL */
  url: string
}

/** Persisted chat option flags */
export interface ChatOptions {
  /** Include the active tab's page content in requests */
  pageContextEnabled: boolean
  /** True when pageContext was auto-disabled after the first message send (not by the user) */
  pageContextAutoDisabled: boolean
  /** IDs of currently active commands */
  activeCommandIds: string[]
}

/** Cumulative token usage statistics */
export interface TokenUsageStats {
  /** Total prompt tokens across all requests */
  totalPromptTokens: number
  /** Total completion tokens across all requests */
  totalCompletionTokens: number
  /** Total number of requests made */
  totalRequests: number
}
