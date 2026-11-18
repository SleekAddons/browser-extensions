/**
 * Client for Ollama's native API (/api/tags, /api/chat).
 */

import type { Endpoint, ModelInfo, RequestMessage, TokenUsage } from './types'
import { apiUrl, authHeaders, readJson, readLines, requestError } from './http'

/** Streaming chunk from /api/chat */
interface ChatChunk {
  message?: { content?: string }
  done?: boolean
  /** Set instead of a message when generation fails mid-stream */
  error?: string
  /** Present only on the final chunk (done === true) */
  prompt_eval_count?: number
  eval_count?: number
  total_duration?: number
  prompt_eval_duration?: number
  eval_duration?: number
}

/** Fetch all models installed on an Ollama server. */
export async function listModels(endpoint: Endpoint, signal?: AbortSignal): Promise<ModelInfo[]> {
  const res = await fetch(apiUrl(endpoint.baseUrl, '/api/tags'), {
    headers: authHeaders(endpoint.authToken),
    signal,
  })

  if (!res.ok) {
    throw requestError('Failed to fetch models', res.status, await res.text().catch(() => ''))
  }

  const data = (await readJson(res)) as { models?: { name: string; size?: number }[] | null }
  const models = Array.isArray(data?.models) ? data.models : []
  return models.map((m) => ({ name: m.name, size: m.size }))
}

/** Send a streaming chat request. Calls `onDelta` with each piece of generated text. */
export async function streamChat(
  endpoint: Endpoint,
  model: string,
  messages: RequestMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<TokenUsage | null> {
  const apiMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.images?.length ? { images: m.images.map((img) => img.data) } : {}),
  }))

  const body: Record<string, unknown> = {
    model,
    messages: apiMessages,
    stream: true,
  }

  if (endpoint.contextSize) {
    body.options = { num_ctx: endpoint.contextSize }
  }

  const res = await fetch(apiUrl(endpoint.baseUrl, '/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(endpoint.authToken) },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    throw requestError('Chat request failed', res.status, await res.text().catch(() => ''))
  }

  if (!res.body) {
    throw new Error('No response body - streaming not supported')
  }

  let tokenUsage: TokenUsage | null = null

  // Ollama sends newline-delimited JSON. Errors that happen after streaming
  // has started (e.g. the model runs out of memory) arrive as {"error": ...}.
  await readLines(res.body, (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let chunk: ChatChunk
    try {
      chunk = JSON.parse(trimmed) as ChatChunk
    } catch {
      return // Skip malformed lines
    }
    if (chunk.error) throw new Error(chunk.error)
    if (chunk.message?.content) onDelta(chunk.message.content)

    // Capture token usage from the final chunk
    if (chunk.done && chunk.prompt_eval_count != null) {
      tokenUsage = {
        promptTokens: chunk.prompt_eval_count,
        completionTokens: chunk.eval_count ?? 0,
        totalDuration: chunk.total_duration ?? 0,
        promptEvalDuration: chunk.prompt_eval_duration ?? 0,
        evalDuration: chunk.eval_duration ?? 0,
      }
    }
  })

  return tokenUsage
}
