/**
 * Fetch helpers shared by the Ollama and OpenAI-compatible API clients.
 */

import { t } from './i18n'

/** Join a base URL and an API path, keeping any query string on the base URL. */
export function apiUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl)
  url.pathname = url.pathname.replace(/\/+$/, '') + path
  return url.href
}

/** Build request headers, optionally including an Authorization bearer token. */
export function authHeaders(authToken?: string): Record<string, string> {
  if (!authToken) return {}
  return { Authorization: `Bearer ${authToken}` }
}

/**
 * Pull the message out of an error body. Ollama sends {"error": "..."},
 * OpenAI-compatible servers {"error": {"message": "..."}}, some others
 * {"message": "..."} or {"detail": "..."}.
 */
export function errorMessage(body: unknown): string | null {
  if (Array.isArray(body)) return errorMessage(body[0])
  if (!body || typeof body !== 'object') return null
  const { error, message, detail } = body as Record<string, unknown>
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const nested = (error as Record<string, unknown>).message
    if (typeof nested === 'string') return nested
  }
  if (typeof message === 'string') return message
  if (typeof detail === 'string') return detail
  return null
}

/** Error for a failed request, with the server's own message when it sent one. */
export function requestError(action: string, status: number, body: string): Error {
  let detail: string | null = null
  try {
    detail = errorMessage(JSON.parse(body))
  } catch {
    // Not JSON: fall back to the raw text (e.g. a proxy's error page)
  }
  detail ??= body.trim().replace(/\s+/g, ' ').slice(0, 300)
  return new Error(detail ? t('httpErrorDetail', action, status, detail) : t('httpError', action, status))
}

/** Parse a JSON response body, with a readable error when it is something else. */
export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(t('notJson'))
  }
}

/**
 * Read a streamed response body line by line. Returning true from `onLine`
 * stops reading. The download is cancelled whenever reading stops before the
 * end of the body (stop requested, error thrown by `onLine`, abort).
 */
export async function readLines(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => boolean | void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        finished = true
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (onLine(line) === true) return
      }
    }

    // Process any remaining buffer
    onLine(buffer + decoder.decode())
  } finally {
    if (!finished) await reader.cancel().catch(() => {})
  }
}
