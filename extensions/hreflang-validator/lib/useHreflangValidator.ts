import { browser } from 'wxt/browser'
import { useState, useCallback } from 'react'
import type { HreflangTag, ValidationResult } from './types'
import { validateHreflangTags } from './validator'

interface UseHreflangValidatorReturn {
  result: ValidationResult | null
  loading: boolean
  error: string | null
  validate: () => void
}

/**
 * Hook that triggers hreflang extraction from the active tab
 * and validates the results.
 */
export function useHreflangValidator(): UseHreflangValidatorReturn {
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        setError('No active tab found.')
        setLoading(false)
        return
      }

      // Inject content script to extract hreflang tags
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractHreflangFromPage,
      })

      const data = results?.[0]?.result as { url: string; tags: HreflangTag[] } | undefined
      if (!data) {
        setError('Could not extract hreflang data from the page.')
        setLoading(false)
        return
      }

      const validationResult = validateHreflangTags(data.url, data.tags)
      setResult(validationResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, error, validate }
}

/**
 * This function runs inside the page context via chrome.scripting.executeScript.
 * It extracts all hreflang link tags from the current page.
 */
function extractHreflangFromPage(): { url: string; tags: { hreflang: string; href: string; source: string }[] } {
  const tags: { hreflang: string; href: string; source: string }[] = []

  // Extract from <link rel="alternate" hreflang="...">
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
  for (const link of links) {
    const hreflang = link.getAttribute('hreflang')
    const href = link.getAttribute('href')
    if (hreflang) {
      tags.push({
        hreflang: hreflang.trim(),
        href: href ? href.trim() : '',
        source: 'html',
      })
    }
  }

  return { url: window.location.href, tags }
}
