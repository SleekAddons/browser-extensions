import { useState } from 'react'
import ContentCard from '@/components/ContentCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { CloudUpload, RefreshCw, AlertCircle, CheckCircle2, XCircle, LogOut } from 'lucide-react'
import { useBookmarksSync } from '../lib/useBookmarksSync'

function formatTime(ms: number | null): string {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 5_000) return 'just now'
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return new Date(ms).toLocaleString()
}

export default function BookmarksSyncView(props: { className?: string }) {
  const { settings, status, loading, authChecking, updateSettings, connect, logout, forceSync } = useBookmarksSync()
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const onForceSync = async () => {
    setSyncing(true)
    try {
      await forceSync()
    } finally {
      setSyncing(false)
    }
  }

  const currentUrl = serverUrl ?? settings.serverUrl
  const currentEmail = email ?? settings.email
  const currentPassword = password ?? settings.password
  const dirty = serverUrl !== null || email !== null || password !== null

  const onSave = async () => {
    setSaving(true)
    try {
      await updateSettings({ serverUrl: currentUrl, email: currentEmail, password: currentPassword })
      setServerUrl(null)
      setEmail(null)
      setPassword(null)
      await connect()
    } finally {
      setSaving(false)
    }
  }

  const onLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 text-muted-foreground ${props.className ?? ''}`}>
        <Spinner className="size-3.5" />
        Loading…
      </div>
    )
  }

  return (
    <div className={`flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 ${props.className ?? ''}`}>
      <ContentCard
        title="Sync Status"
        description="Latest activity from the background sync worker."
      >
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">Last sync:</span>
          <span className="font-medium">{formatTime(status.lastSyncedAt)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CloudUpload size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">Operations:</span>
          <span className="font-medium">{status.lastCount}</span>
        </div>
        {status.lastError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{status.lastError}</span>
          </div>
        )}
        <Button variant="outline" onClick={onForceSync} disabled={syncing} className="w-full">
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Force Sync'}
        </Button>
      </ContentCard>

      <ContentCard
        title="Remote Server"
        description="Configure the endpoint your bookmarks sync to."
      >
        {/* Auth status banner */}
        {authChecking ? (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            <Spinner className="size-3.5" />
            Checking connection…
          </div>
        ) : status.authenticated === true ? (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
            <CheckCircle2 size={14} className="shrink-0 text-green-600 dark:text-green-400" />
            <span className="flex-1 font-medium text-green-700 dark:text-green-300">All good — session active</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={onLogout}
              disabled={loggingOut}
            >
              <LogOut size={12} />
              {loggingOut ? 'Logging out…' : 'Logout'}
            </Button>
          </div>
        ) : status.authenticated === false ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <XCircle size={14} className="shrink-0" />
            Not authenticated — save credentials to connect
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-url">Server URL</Label>
          <Input
            id="bs-url"
            placeholder="https://sync.example.com"
            value={currentUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            inputMode="url"
            autoComplete="url"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-email">Email</Label>
          <Input
            id="bs-email"
            type="email"
            placeholder="user@example.com"
            value={currentEmail}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-password">Password</Label>
          <Input
            id="bs-password"
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <Separator className="my-1" />

        <Button onClick={onSave} disabled={!dirty || saving} className="w-full">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ContentCard>
    </div>
  )
}
