/** A saved Ollama endpoint configuration */
export interface OllamaEndpoint {
  /** Unique identifier */
  id: string
  /** Display name for this endpoint */
  name: string
  /** Base URL of the Ollama server (e.g. http://localhost:11434) */
  baseUrl: string
  /** Optional Bearer token for authenticated Ollama endpoints */
  authToken?: string
  /** Context window size (num_ctx) - defaults to model's built-in value when omitted */
  contextSize?: number
  /** Optional system prompt prepended to every conversation on this endpoint */
  systemPrompt?: string
}

/** Model info returned by Ollama /api/tags */
export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
}

/** A single chat message */
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

/** A single chat message */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Base64-encoded images for Ollama vision models */
  images?: string[]
  /** File attachment metadata for display purposes */
  attachments?: FileAttachment[]
  /** Present on user messages that included page context */
  pageContext?: MessagePageContext
  /** Actual token usage reported by Ollama (present on assistant messages) */
  tokenUsage?: OllamaTokenUsage
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

/** Token usage reported by Ollama in the final streaming chunk */
export interface OllamaTokenUsage {
  /** Number of tokens evaluated in the prompt */
  promptTokens: number
  /** Number of tokens generated in the response */
  completionTokens: number
  /** Total duration in nanoseconds */
  totalDuration: number
  /** Time spent evaluating the prompt in nanoseconds */
  promptEvalDuration: number
  /** Time spent generating the response in nanoseconds */
  evalDuration: number
}

/** Streaming chunk from Ollama chat API */
export interface OllamaChatChunk {
  model: string
  message: ChatMessage
  done: boolean
  /** Present only on the final chunk (done === true) */
  prompt_eval_count?: number
  eval_count?: number
  total_duration?: number
  prompt_eval_duration?: number
  eval_duration?: number
}

/** State for a connected Ollama endpoint */
export interface OllamaEndpointState {
  endpoint: OllamaEndpoint
  models: OllamaModel[]
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
