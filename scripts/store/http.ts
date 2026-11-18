/** Small fetch helpers shared by the store clients. */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/** Pulls a readable message out of a Google or AMO error body. */
function describeErrorBody(body: string): string {
  try {
    const data = JSON.parse(body)
    if (typeof data?.error?.message === 'string') return data.error.message // Google APIs
    if (typeof data?.error === 'string') return [data.error, data.error_description].filter(Boolean).join(': ') // OAuth
    if (typeof data?.detail === 'string') return data.detail // AMO
    if (data && typeof data === 'object') {
      // AMO field errors: { "field": ["message", …] }
      return Object.entries(data)
        .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(' ') : JSON.stringify(value)}`)
        .join('; ')
    }
  } catch {
    // Not JSON.
  }
  return body.replace(/\s+/g, ' ').trim().slice(0, 300)
}

/** fetch() that throws an HttpError with the server's message for non-2xx responses. */
export async function request(url: string, init: RequestInit, what: string): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    throw new Error(`${what}: network error (${err instanceof Error ? err.message : String(err)})`)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new HttpError(res.status, `${what}: HTTP ${res.status} — ${describeErrorBody(body)}`, body)
  }
  return res
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Compares dotted version strings numerically: 1.0.10 > 1.0.9. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
