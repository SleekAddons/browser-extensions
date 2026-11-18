/**
 * Chrome Web Store API v2 client: upload a package, submit it for review,
 * read the item status. https://developer.chrome.com/docs/webstore/using-api
 *
 * The API cannot change store listing content (description, screenshots,
 * promo images); those are edited in the Developer Dashboard.
 *
 * Auth: a service account JSON key (recommended, does not expire) or an
 * OAuth client + refresh token. CHROME_API_BASE_URL / CHROME_TOKEN_URL
 * override the Google endpoints, for testing against a local mock.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import { env, resolveFromRoot } from './env'
import { request, sleep } from './http'

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
const DEFAULT_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export type ChromeCredentials =
  | { kind: 'service-account'; clientEmail: string; privateKey: string; tokenUrl: string }
  | { kind: 'oauth'; clientId: string; clientSecret: string; refreshToken: string; tokenUrl: string }

export type PublishType = 'DEFAULT_PUBLISH' | 'STAGED_PUBLISH'

export type ItemState =
  | 'PENDING_REVIEW'
  | 'STAGED'
  | 'PUBLISHED'
  | 'PUBLISHED_TO_TESTERS'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ITEM_STATE_UNSPECIFIED'

export type UploadState = 'SUCCEEDED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_FOUND' | 'UPLOAD_STATE_UNSPECIFIED'

export interface RevisionStatus {
  state: ItemState
  distributionChannels?: { deployPercentage?: number; crxVersion?: string }[]
}

export interface ItemStatus {
  name: string
  itemId: string
  publishedItemRevisionStatus?: RevisionStatus
  submittedItemRevisionStatus?: RevisionStatus
  lastAsyncUploadState?: UploadState
  takenDown?: boolean
  warned?: boolean
}

/** Versions of a revision (one per distribution channel). */
export function revisionVersions(revision: RevisionStatus | undefined): string[] {
  return (revision?.distributionChannels ?? []).map((c) => c.crxVersion).filter((v): v is string => !!v)
}

/** Reads Chrome credentials from the environment; null when none are configured. */
export function chromeCredentialsFromEnv(): ChromeCredentials | null {
  const tokenOverride = env('CHROME_TOKEN_URL')
  const keyFile = env('CHROME_SERVICE_ACCOUNT_KEY_FILE')
  if (keyFile) {
    const file = resolveFromRoot(keyFile)
    if (!fs.existsSync(file)) throw new Error(`CHROME_SERVICE_ACCOUNT_KEY_FILE points to ${file}, which does not exist.`)
    const key = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!key.client_email || !key.private_key) {
      throw new Error(`${file} is not a service account key (client_email / private_key missing).`)
    }
    return {
      kind: 'service-account',
      clientEmail: key.client_email,
      privateKey: key.private_key,
      tokenUrl: tokenOverride ?? key.token_uri ?? DEFAULT_TOKEN_URL,
    }
  }

  const clientId = env('CHROME_CLIENT_ID')
  const clientSecret = env('CHROME_CLIENT_SECRET')
  const refreshToken = env('CHROME_REFRESH_TOKEN')
  if (clientId || clientSecret || refreshToken) {
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Set all of CHROME_CLIENT_ID, CHROME_CLIENT_SECRET and CHROME_REFRESH_TOKEN in .env.')
    }
    return { kind: 'oauth', clientId, clientSecret, refreshToken, tokenUrl: tokenOverride ?? DEFAULT_TOKEN_URL }
  }
  return null
}

async function fetchAccessToken(credentials: ChromeCredentials): Promise<{ token: string; expiresIn: number }> {
  let body: URLSearchParams
  if (credentials.kind === 'service-account') {
    // JWT bearer grant: https://developers.google.com/identity/protocols/oauth2/service-account#httprest
    const now = Math.floor(Date.now() / 1000)
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: credentials.clientEmail,
      scope: SCOPE,
      aud: credentials.tokenUrl,
      iat: now,
      exp: now + 3600,
    })}`
    const signature = crypto.sign('sha256', Buffer.from(unsigned), credentials.privateKey).toString('base64url')
    body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    })
  } else {
    body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    })
  }

  try {
    const res = await request(credentials.tokenUrl, { method: 'POST', body }, 'Chrome Web Store sign-in')
    const data = (await res.json()) as { access_token: string; expires_in?: number }
    return { token: data.access_token, expiresIn: data.expires_in ?? 3600 }
  } catch (err) {
    if (credentials.kind === 'oauth' && err instanceof Error && err.message.includes('invalid_grant')) {
      throw new Error(
        `${err.message}\nThe refresh token was rejected. Tokens of OAuth apps in "Testing" status expire after 7 days; ` +
          'create a new one, publish the OAuth consent screen, or switch to a service account.',
      )
    }
    throw err
  }
}

export class ChromeWebStore {
  private readonly apiBase: string
  private accessToken: { value: string; expiresAt: number } | null = null

  constructor(
    private readonly publisherId: string,
    private readonly credentials: ChromeCredentials,
  ) {
    this.apiBase = (env('CHROME_API_BASE_URL') ?? 'https://chromewebstore.googleapis.com').replace(/\/+$/, '')
  }

  private async authHeader(): Promise<string> {
    if (!this.accessToken || Date.now() > this.accessToken.expiresAt) {
      const { token, expiresIn } = await fetchAccessToken(this.credentials)
      this.accessToken = { value: token, expiresAt: Date.now() + (expiresIn - 60) * 1000 }
    }
    return `Bearer ${this.accessToken.value}`
  }

  private itemPath(itemId: string) {
    return `publishers/${encodeURIComponent(this.publisherId)}/items/${encodeURIComponent(itemId)}`
  }

  async fetchStatus(itemId: string): Promise<ItemStatus> {
    const res = await request(
      `${this.apiBase}/v2/${this.itemPath(itemId)}:fetchStatus`,
      { headers: { Authorization: await this.authHeader() } },
      'Chrome Web Store status',
    )
    return (await res.json()) as ItemStatus
  }

  /** Uploads a new package and waits until the store has processed it. */
  async upload(itemId: string, zip: Buffer): Promise<{ crxVersion?: string }> {
    const res = await request(
      `${this.apiBase}/upload/v2/${this.itemPath(itemId)}:upload`,
      {
        method: 'POST',
        headers: { Authorization: await this.authHeader(), 'Content-Type': 'application/zip' },
        body: new Uint8Array(zip),
      },
      'Chrome Web Store upload',
    )
    const data = (await res.json()) as { uploadState?: UploadState; crxVersion?: string }
    let state = data.uploadState

    // Large packages are processed asynchronously; poll the item status.
    for (let waited = 0; state === 'IN_PROGRESS' && waited < 180_000; waited += 3000) {
      await sleep(3000)
      state = (await this.fetchStatus(itemId)).lastAsyncUploadState
    }
    if (state !== 'SUCCEEDED') throw new Error(`Chrome Web Store upload did not succeed (state: ${state ?? 'unknown'})`)
    return { crxVersion: data.crxVersion }
  }

  /** Submits the current draft for review. */
  async publish(itemId: string, publishType: PublishType): Promise<{ state?: ItemState; warnings: string[] }> {
    const res = await request(
      `${this.apiBase}/v2/${this.itemPath(itemId)}:publish`,
      {
        method: 'POST',
        headers: { Authorization: await this.authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishType }),
      },
      'Chrome Web Store publish',
    )
    const data = (await res.json()) as {
      state?: ItemState
      warningInfo?: { warnings?: { reason?: string; description?: string }[] }
    }
    const warnings = (data.warningInfo?.warnings ?? []).map((w) => [w.reason, w.description].filter(Boolean).join(': '))
    return { state: data.state, warnings }
  }

  /** Withdraws the submission that is waiting for review. */
  async cancelSubmission(itemId: string): Promise<void> {
    await request(
      `${this.apiBase}/v2/${this.itemPath(itemId)}:cancelSubmission`,
      {
        method: 'POST',
        headers: { Authorization: await this.authHeader(), 'Content-Type': 'application/json' },
        body: '{}',
      },
      'Chrome Web Store cancel submission',
    )
  }
}
