/**
 * addons.mozilla.org (AMO) API v5 client: upload a new version with its
 * source code, and manage the listing screenshots ("previews").
 * https://mozilla.github.io/addons-server/topics/api/addons.html
 *
 * Auth: JWT signed with the AMO API key + secret
 * (https://addons.mozilla.org/developers/addon/api/key/).
 * FIREFOX_API_BASE_URL overrides the API endpoint, for testing against a mock.
 */

import crypto from 'node:crypto'
import { env } from './env'
import { HttpError, request, sleep } from './http'

export interface AmoPreview {
  id: number
  caption: Record<string, string> | null
  image_url: string
  image_size: [number, number]
  position: number
}

export interface AmoAddon {
  id: number
  guid: string
  slug: string
  default_locale: string
  current_version: { version: string } | null
  previews: AmoPreview[]
}

export interface AmoVersion {
  id: number
  version: string
  file?: { status?: string }
}

interface AmoUpload {
  uuid: string
  processed: boolean
  valid: boolean
  version: string | null
  validation: {
    messages?: { type: string; message: string; description?: string[] | string; file?: string; line?: number }[]
  } | null
}

export interface FileInput {
  data: Buffer
  filename: string
  type: string
}

function fileBlob(file: FileInput): Blob {
  return new Blob([new Uint8Array(file.data)], { type: file.type })
}

export class FirefoxAddons {
  private readonly apiBase: string

  constructor(
    private readonly issuer: string,
    private readonly secret: string,
  ) {
    this.apiBase = (env('FIREFOX_API_BASE_URL') ?? 'https://addons.mozilla.org/api/v5').replace(/\/+$/, '')
  }

  /** A fresh short-lived JWT per request, as AMO requires a unique jti. */
  private authHeader(): string {
    const now = Math.floor(Date.now() / 1000)
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      iss: this.issuer,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 60,
    })}`
    const signature = crypto.createHmac('sha256', this.secret).update(unsigned).digest('base64url')
    return `JWT ${unsigned}.${signature}`
  }

  private addonPath(addonId: string) {
    return `${this.apiBase}/addons/addon/${encodeURIComponent(addonId)}`
  }

  private async json<T>(url: string, init: RequestInit, what: string): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', this.authHeader())
    const res = await request(url, { ...init, headers }, what)
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  getAddon(addonId: string): Promise<AmoAddon> {
    return this.json(`${this.addonPath(addonId)}/`, {}, 'AMO add-on details')
  }

  /** The version with this version string, or null if it was never uploaded. */
  async getVersion(addonId: string, version: string): Promise<AmoVersion | null> {
    try {
      // The "v" prefix makes AMO look the version up by its version string.
      return await this.json<AmoVersion>(
        `${this.addonPath(addonId)}/versions/v${encodeURIComponent(version)}/`,
        {},
        'AMO version lookup',
      )
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null
      throw err
    }
  }

  /** Uploads a package and waits for AMO's automatic validation. */
  async uploadPackage(file: FileInput, channel: 'listed' | 'unlisted' = 'listed'): Promise<AmoUpload> {
    const form = new FormData()
    form.append('upload', fileBlob(file), file.filename)
    form.append('channel', channel)
    let upload = await this.json<AmoUpload>(`${this.apiBase}/addons/upload/`, { method: 'POST', body: form }, 'AMO upload')

    for (let waited = 0; !upload.processed; waited += 5000) {
      if (waited > 600_000) throw new Error('AMO validation did not finish within 10 minutes')
      await sleep(5000)
      upload = await this.json<AmoUpload>(`${this.apiBase}/addons/upload/${upload.uuid}/`, {}, 'AMO validation status')
    }

    if (!upload.valid) {
      const errors = (upload.validation?.messages ?? [])
        .filter((m) => m.type === 'error')
        .map((m) => `  - ${m.message}${m.file ? ` (${m.file}${m.line ? `:${m.line}` : ''})` : ''}`)
      throw new Error(`AMO validation failed:\n${errors.join('\n') || '  (no details)'}`)
    }
    return upload
  }

  /** Creates the new version from a validated upload, attaching the source code archive. */
  createVersion(addonId: string, uploadUuid: string, source: FileInput, approvalNotes: string): Promise<AmoVersion> {
    const form = new FormData()
    form.append('upload', uploadUuid)
    form.append('source', fileBlob(source), source.filename)
    form.append('approval_notes', approvalNotes)
    return this.json(`${this.addonPath(addonId)}/versions/`, { method: 'POST', body: form }, 'AMO create version')
  }

  async setReleaseNotes(addonId: string, versionId: number, locale: string, notes: string): Promise<void> {
    await this.json(
      `${this.addonPath(addonId)}/versions/${versionId}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_notes: { [locale]: notes } }),
      },
      'AMO release notes',
    )
  }

  addPreview(addonId: string, image: FileInput, position: number): Promise<AmoPreview> {
    const form = new FormData()
    form.append('image', fileBlob(image), image.filename)
    form.append('position', String(position))
    return this.json(`${this.addonPath(addonId)}/previews/`, { method: 'POST', body: form }, 'AMO add screenshot')
  }

  async setPreviewCaption(addonId: string, previewId: number, locale: string, caption: string): Promise<void> {
    await this.json(
      `${this.addonPath(addonId)}/previews/${previewId}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: { [locale]: caption } }),
      },
      'AMO screenshot caption',
    )
  }

  async deletePreview(addonId: string, previewId: number): Promise<void> {
    await this.json(`${this.addonPath(addonId)}/previews/${previewId}/`, { method: 'DELETE' }, 'AMO delete screenshot')
  }
}
