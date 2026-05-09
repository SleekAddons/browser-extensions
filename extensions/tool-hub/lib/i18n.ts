import { browser } from 'wxt/browser'

type MessageKey = Parameters<typeof browser.i18n.getMessage>[0]

/** Thin wrapper around browser.i18n.getMessage with English fallback. */
export function t(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions) || key
}
