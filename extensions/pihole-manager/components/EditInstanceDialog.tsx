import { useState, useEffect } from 'react'
import type { PiholeInstance } from '../lib/types'
import ContentCard from '@/components/ContentCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'
import { t } from '../lib/i18n'

interface EditInstanceDialogProps {
  instance: PiholeInstance
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: { name: string; baseUrl: string; password: string }) => Promise<void>
}

export default function EditInstanceDialog(props: EditInstanceDialogProps) {
  const { instance, open, onOpenChange, onSave } = props

  const [name, setName] = useState(instance.name)
  const [baseUrl, setBaseUrl] = useState(instance.baseUrl)
  const [password, setPassword] = useState(instance.password)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(instance.name)
      setBaseUrl(instance.baseUrl)
      setPassword(instance.password)
      setError(null)
    }
  }, [open, instance])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError(t('nameRequired'))
      return
    }
    if (!baseUrl.trim() || (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://'))) {
      setError(t('urlInvalid'))
      return
    }
    if (!password.trim()) {
      setError(t('passwordRequired'))
      return
    }

    setSubmitting(true)
    try {
      await onSave(instance.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        password: password.trim(),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveInstanceFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <ContentCard
      title={t('editInstanceTitle')}
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
        >
          <X size={14} />
        </Button>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-edit-name">{t('name')}</Label>
            <Input
              id="ph-edit-name"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-edit-url">{t('url')}</Label>
            <Input
              id="ph-edit-url"
              placeholder="https://pi.hole"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              inputMode="url"
              autoComplete="url"
            />
            <p className="text-xs text-muted-foreground">{t('urlHint')}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ph-edit-password">{t('apiPassword')}</Label>
            <Input
              id="ph-edit-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}

          <Separator className="my-1" />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
    </ContentCard>
  )
}
