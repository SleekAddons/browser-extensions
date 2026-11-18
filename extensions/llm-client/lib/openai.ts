/**
 * Client for OpenAI-compatible APIs (/models, /chat/completions): OpenAI itself
 * and the many servers that copy its API, such as OpenRouter, LM Studio,
 * llama.cpp, vLLM or Ollama's /v1.
 */

import type { Endpoint, ModelInfo, RequestMessage, TokenUsage } from './types'
import { apiUrl, authHeaders, errorMessage, readJson, readLines, requestError } from './http'
import { t } from './i18n'

/** Model ids that cannot chat (embeddings, speech, images, moderation…); hidden from the model list. */
const NON_CHAT_MODEL = /embed|whisper|tts|dall-e|gpt-image|moderation|transcribe|realtime|rerank/i

/** Fields that servers use to report a model's context window (OpenRouter, Groq, vLLM, Mistral…). */
const CONTEXT_FIELDS = ['context_length', 'context_window', 'max_model_len', 'max_context_length']

/** First line of a server-sent event stream: a comment or a field. */
const SSE_LINE = /^(:|data:|event:|id:|retry:)/

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface ApiMessage {
  role: RequestMessage['role']
  content: string | ContentPart[]
}

interface Usage {
  prompt_tokens?: number
  completion_tokens?: number
}

/** A streamed chunk ("data:" line), or the whole body when the server does not stream */
interface Completion {
  choices?: { delta?: { content?: unknown }; message?: { content?: unknown } }[]
  usage?: Usage | null
  error?: unknown
  object?: string
}

/** Fetch the chat models offered by an OpenAI-compatible server. */
export async function listModels(endpoint: Endpoint, signal?: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch(apiUrl(endpoint.baseUrl, '/models'), {
    headers: authHeaders(endpoint.authToken),
    signal,
  })

  if (!res.ok) {
    const error = requestError(t('fetchModelsFailed'), res.status, await res.text().catch(() => ''))
    if (res.status === 404) error.message += versionHint(endpoint.baseUrl)
    throw error
  }

  // Most servers wrap the list in {"data": [...]}, some return a bare array
  const body = await readJson(res)
  const list = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data
  if (!Array.isArray(list)) {
    throw new Error((errorMessage(body) ?? t('noModelList')) + versionHint(endpoint.baseUrl))
  }

  return list
    .map(toModelInfo)
    .filter((m): m is ModelInfo => m !== null && !NON_CHAT_MODEL.test(m.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

/** Send a streaming chat request. Calls `onDelta` with each piece of generated text. */
export async function streamChat(
  endpoint: Endpoint,
  model: string,
  messages: RequestMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<TokenUsage | null> {
  const body = { model, messages: toApiMessages(messages), stream: true }

  const post = (payload: object) =>
    fetch(apiUrl(endpoint.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(endpoint.authToken) },
      body: JSON.stringify(payload),
      signal,
    })

  // Ask for token usage in the last chunk. A few servers reject the option:
  // retry without it, the reply then just comes without usage numbers.
  let res = await post({ ...body, stream_options: { include_usage: true } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (!/stream_options/i.test(text)) throw requestError(t('chatRequestFailed'), res.status, text)
    res = await post(body)
    if (!res.ok) throw requestError(t('chatRequestFailed'), res.status, await res.text().catch(() => ''))
  }

  if (!res.body) {
    throw new Error(t('noResponseBody'))
  }

  let usage = null as TokenUsage | null
  // Decided by the first non-empty line: an event stream, or (from servers
  // that ignore stream: true) the whole completion as one JSON body.
  let format: 'sse' | 'json' | null = null
  let jsonBody = ''

  const handle = (completion: Completion, field: 'delta' | 'message') => {
    if (completion.error || completion.object === 'error') {
      throw new Error(errorMessage(completion) ?? t('serverError'))
    }
    const text = completion.choices?.[0]?.[field]?.content
    if (typeof text === 'string' && text) onDelta(text)
    if (completion.usage) usage = toTokenUsage(completion.usage)
  }

  await readLines(res.body, (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    format ??= SSE_LINE.test(trimmed) ? 'sse' : 'json'
    if (format === 'json') {
      jsonBody += `${line}\n`
      return
    }

    // One JSON chunk per "data:" line, ending with "data: [DONE]". Other
    // lines are comments (keep-alives) or event names.
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') return true
    let chunk: Completion
    try {
      chunk = JSON.parse(payload) as Completion
    } catch {
      return // Skip malformed lines
    }
    handle(chunk, 'delta')
  })

  if (format === 'json') {
    let completion: Completion
    try {
      completion = JSON.parse(jsonBody) as Completion
    } catch {
      throw new Error(t('unexpectedResponse'))
    }
    handle(completion, 'message')
  }

  return usage
}

function toModelInfo(entry: unknown): ModelInfo | null {
  if (!entry || typeof entry !== 'object') return null
  const fields = entry as Record<string, unknown>
  if (typeof fields.id !== 'string' || !fields.id) return null
  const contextLength = CONTEXT_FIELDS.map((key) => fields[key]).find(
    (value): value is number => typeof value === 'number' && value > 0,
  )
  return contextLength ? { name: fields.id, contextLength } : { name: fields.id }
}

function toTokenUsage(usage: Usage): TokenUsage {
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
  }
}

/** Hint for a base URL that is probably missing its version, e.g. http://localhost:1234 instead of …/v1 */
function versionHint(baseUrl: string): string {
  return /\/v\d/.test(new URL(baseUrl).pathname) ? '' : ` ${t('versionHint')}`
}

/** Convert messages to the Chat Completions format, smoothing over what strict servers reject. */
function toApiMessages(messages: RequestMessage[]): ApiMessage[] {
  const result: ApiMessage[] = []
  for (const m of messages) {
    // Some servers reject empty assistant messages (e.g. a reply that came back empty)
    if (m.role === 'assistant' && !m.content) continue

    // Many chat templates accept a single system message: merge consecutive ones
    const prev = result[result.length - 1]
    if (m.role === 'system' && prev?.role === 'system' && typeof prev.content === 'string') {
      prev.content += `\n\n${m.content}`
      continue
    }

    if (m.images?.length) {
      result.push({
        role: m.role,
        content: [
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
          ...m.images.map((img) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          })),
        ],
      })
    } else {
      result.push({ role: m.role, content: m.content })
    }
  }
  return result
}
