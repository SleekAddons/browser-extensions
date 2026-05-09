/**
 * Ollama API client.
 *
 * Handles model listing, connection testing, and streaming chat completions.
 */

import type { OllamaModel, ChatMessage, OllamaChatChunk, OllamaTokenUsage } from './types'

function apiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}${path}`
}

/** Build request headers, optionally including an Authorization bearer token. */
function authHeaders(authToken?: string): Record<string, string> {
  if (!authToken) return {}
  return { Authorization: `Bearer ${authToken}` }
}

/** Check if an Ollama server is reachable. */
export async function checkConnection(baseUrl: string, authToken?: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(baseUrl, '/api/tags'), {
      headers: authHeaders(authToken),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Fetch all available models from an Ollama endpoint. */
export async function listModels(baseUrl: string, authToken?: string): Promise<OllamaModel[]> {
  const res = await fetch(apiUrl(baseUrl, '/api/tags'), {
    headers: authHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch models (${res.status})`)
  }

  const data = await res.json()
  return (data.models ?? []) as OllamaModel[]
}

/** Options for a chat request. */
export interface ChatRequestOptions {
  /** Context window size (num_ctx). Omit to use the model default. */
  contextSize?: number
  /** Optional Bearer token for authenticated endpoints. */
  authToken?: string
}

/** Send a streaming chat request. Calls `onChunk` for each streamed token. Returns token usage from the final chunk. */
export async function streamChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: OllamaChatChunk) => void,
  signal?: AbortSignal,
  options?: ChatRequestOptions,
): Promise<OllamaTokenUsage | null> {
  // Build messages for the API - include images when present
  const apiMessages = messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role, content: m.content }
    if (m.images && m.images.length > 0) {
      msg.images = m.images
    }
    return msg
  })

  const body: Record<string, unknown> = {
    model,
    messages: apiMessages,
    stream: true,
  }

  if (options?.contextSize) {
    body.options = { num_ctx: options.contextSize }
  }

  const res = await fetch(apiUrl(baseUrl, '/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(options?.authToken) },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Chat request failed (${res.status}): ${text}`)
  }

  if (!res.body) {
    throw new Error('No response body - streaming not supported')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let tokenUsage: OllamaTokenUsage | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Ollama sends newline-delimited JSON
      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const chunk = JSON.parse(trimmed) as OllamaChatChunk
          onChunk(chunk)

          // Capture token usage from the final chunk
          if (chunk.done && chunk.prompt_eval_count != null) {
            tokenUsage = {
              promptTokens: chunk.prompt_eval_count ?? 0,
              completionTokens: chunk.eval_count ?? 0,
              totalDuration: chunk.total_duration ?? 0,
              promptEvalDuration: chunk.prompt_eval_duration ?? 0,
              evalDuration: chunk.eval_duration ?? 0,
            }
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer.trim()) as OllamaChatChunk
        onChunk(chunk)

        if (chunk.done && chunk.prompt_eval_count != null) {
          tokenUsage = {
            promptTokens: chunk.prompt_eval_count ?? 0,
            completionTokens: chunk.eval_count ?? 0,
            totalDuration: chunk.total_duration ?? 0,
            promptEvalDuration: chunk.prompt_eval_duration ?? 0,
            evalDuration: chunk.eval_duration ?? 0,
          }
        }
      } catch {
        // Ignore
      }
    }
  } finally {
    reader.releaseLock()
  }

  return tokenUsage
}

/** Send a non-streaming chat request. */
export async function chat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  authToken?: string,
): Promise<ChatMessage> {
  const res = await fetch(apiUrl(baseUrl, '/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(authToken) },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  })

  if (!res.ok) {
    throw new Error(`Chat request failed (${res.status})`)
  }

  const data = await res.json()
  return data.message as ChatMessage
}

/** Format model size in human-readable form. */
export function formatModelSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
