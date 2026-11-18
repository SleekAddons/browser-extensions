/**
 * Chat API client. Each endpoint speaks either Ollama's native API or the
 * OpenAI Chat Completions API; calls are routed to the matching client.
 */

import type { Endpoint, EndpointProvider, ModelInfo, RequestMessage, TokenUsage } from './types'
import * as ollama from './ollama'
import * as openai from './openai'

const clients = { ollama, openai } satisfies Record<EndpointProvider, unknown>

/** Display name and default URL for each provider */
export const PROVIDERS: Record<EndpointProvider, { label: string; defaultUrl: string }> = {
  ollama: { label: 'Ollama', defaultUrl: 'http://localhost:11434' },
  openai: { label: 'OpenAI-compatible', defaultUrl: 'https://api.openai.com/v1' },
}

/** Context window assumed when neither the endpoint settings nor the server give one */
export const DEFAULT_CONTEXT_SIZE = 4096

/** Context window for a chat: the endpoint's setting, else what the server reports for the model, else the default. */
export function contextWindow(endpoint?: Endpoint, model?: ModelInfo): number {
  return endpoint?.contextSize ?? model?.contextLength ?? DEFAULT_CONTEXT_SIZE
}

/** Fetch the chat models available on an endpoint. */
export function listModels(endpoint: Endpoint, signal?: AbortSignal): Promise<ModelInfo[]> {
  return clients[endpoint.provider].listModels(endpoint, signal)
}

/**
 * Send a streaming chat request. Calls `onDelta` with each piece of generated
 * text. Returns the token usage when the server reports it.
 */
export function streamChat(
  endpoint: Endpoint,
  model: string,
  messages: RequestMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<TokenUsage | null> {
  return clients[endpoint.provider].streamChat(endpoint, model, messages, onDelta, signal)
}

/** Format model size in human-readable form. */
export function formatModelSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
