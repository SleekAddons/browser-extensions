import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useSyncExternalStore,
  isValidElement,
  cloneElement,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { code as codePlugin } from '@streamdown/code'
import type { BundledLanguage, TokensResult } from 'shiki'
import { Check, Copy } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Shared theme observer – single MutationObserver for all instances */
/* ------------------------------------------------------------------ */

const themeListeners = new Set<() => void>()

const themeObserver = new MutationObserver(() => {
  themeListeners.forEach((l) => l())
})
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class'],
})

function getThemeSnapshot(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback)
  return () => {
    themeListeners.delete(callback)
  }
}

/** Returns `'light'` or `'dark'` and re-renders when the theme changes. */
function useCurrentTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot)
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const LANG_RE = /language-([^\s]+)/
const TRAILING_NEWLINES = /\n+$/

/**
 * Shiki's dual-theme mode packs both values into a single CSS string,
 * e.g.  `"#fff;--shiki-dark-bg:#24292e"` or `"#24292e;--shiki-dark:#e1e4e8"`.
 *
 * This helper extracts the light value and the dark CSS-variable value.
 */
function parseDualValue(raw: string | undefined): { light: string; dark: string } {
  if (!raw) return { light: 'inherit', dark: 'inherit' }
  const idx = raw.indexOf(';--shiki-dark')
  if (idx === -1) return { light: raw, dark: raw }

  const light = raw.slice(0, idx)
  const colonIdx = raw.indexOf(':', idx + 1)
  const dark = colonIdx !== -1 ? raw.slice(colonIdx + 1).trim() : light
  return { light, dark }
}

function extractText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (
    isValidElement(children) &&
    children.props &&
    typeof children.props === 'object' &&
    'children' in children.props &&
    typeof children.props.children === 'string'
  ) {
    return children.props.children
  }
  return ''
}

/* ------------------------------------------------------------------ */
/*  Copy button                                                        */
/* ------------------------------------------------------------------ */

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may be unavailable */
    }
  }, [code])

  return (
    <button
      onClick={handleCopy}
      className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground"
      title="Copy code"
      type="button"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Syntax-highlighted token renderer                                  */
/* ------------------------------------------------------------------ */

interface TokensViewProps {
  code: string
  language: string
  theme: 'light' | 'dark'
}

/**
 * Renders Shiki-highlighted tokens, selecting the light or dark colour
 * from each token depending on the active theme.
 */
const TokensView = memo(function TokensView({ code, language, theme }: TokensViewProps) {
  const cleanCode = useMemo(() => code.replace(TRAILING_NEWLINES, ''), [code])
  const themes = codePlugin.getThemes()

  const plainTokens = useMemo<TokensResult>(
    () => ({
      tokens: cleanCode.split('\n').map((line) => [
        { content: line, color: 'inherit', offset: 0 },
      ]),
      bg: 'transparent',
      fg: 'inherit',
      rootStyle: '',
    }),
    [cleanCode],
  )

  const [result, setResult] = useState<TokensResult>(plainTokens)

  useEffect(() => {
    if (!language || !codePlugin.supportsLanguage(language as BundledLanguage)) {
      setResult(plainTokens)
      return
    }

    const syncResult = codePlugin.highlight(
      { code: cleanCode, language: language as BundledLanguage, themes: [themes[0], themes[1]] },
      (asyncResult) => setResult(asyncResult),
    )
    if (syncResult) {
      setResult(syncResult)
    }
  }, [cleanCode, language, themes, plainTokens])

  // Shiki dual-theme packs "light;--shiki-dark-bg:dark" into `bg` / `fg`.
  const { light: lightBg, dark: darkBg } = useMemo(() => parseDualValue(result.bg), [result.bg])
  const bg = theme === 'dark' ? darkBg : lightBg

  return (
    <pre
      className="overflow-x-auto border-t border-border p-4 text-sm"
      style={{ backgroundColor: bg }}
      data-language={language}
      data-streamdown="code-block-body"
    >
      <code className="[counter-increment:line_0] [counter-reset:line]">
        {result.tokens.map((line, i) => (
          <span
            key={i}
            className="block before:mr-4 before:inline-block before:w-6 before:select-none before:text-right before:font-mono before:text-[13px] before:text-muted-foreground/50 before:content-[counter(line)] before:[counter-increment:line]"
          >
            {line.map((token, j) => {
              // Shiki dual-theme: htmlStyle.color holds the light colour,
              // htmlStyle['--shiki-dark'] holds the dark colour.
              // token.color may hold a combined "light;--shiki-dark:dark" string.
              let color: string
              let tokenBg: string | undefined

              if (token.htmlStyle) {
                color =
                  theme === 'dark'
                    ? (token.htmlStyle['--shiki-dark'] ?? token.htmlStyle.color ?? 'inherit')
                    : (token.htmlStyle.color ?? 'inherit')
                tokenBg =
                  theme === 'dark'
                    ? (token.htmlStyle['--shiki-dark-bg'] ?? undefined)
                    : undefined
              } else {
                // Fallback: parse combined string from token.color
                const parsed = parseDualValue(token.color)
                color = theme === 'dark' ? parsed.dark : parsed.light
                tokenBg = undefined
              }

              return (
                <span
                  key={j}
                  style={{
                    color,
                    ...(tokenBg ? { backgroundColor: tokenBg } : {}),
                  }}
                >
                  {token.content}
                </span>
              )
            })}
          </span>
        ))}
      </code>
    </pre>
  )
})

/* ------------------------------------------------------------------ */
/*  Custom `code` component for Streamdown                             */
/* ------------------------------------------------------------------ */

/**
 * Replaces Streamdown's built-in code renderer so that fenced code
 * blocks always use the correct Shiki theme (light _or_ dark) based
 * on the extension's current theme setting.
 *
 * Inline code is rendered with a simple `bg-muted` class (already
 * theme-aware via CSS variables).
 */
export const CustomCodeBlock = memo(function CustomCodeBlock({
  className,
  children,
  node: _node,
  ...props
}: any) {
  const theme = useCurrentTheme()
  const isInline = !('data-block' in props)

  // ── Inline code ──────────────────────────────────────────────────
  if (isInline) {
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
        data-streamdown="inline-code"
      >
        {children}
      </code>
    )
  }

  // ── Fenced code block ────────────────────────────────────────────
  const langMatch = className?.match(LANG_RE)
  const language = langMatch?.[1] ?? ''
  const rawCode = extractText(children)

  return (
    <div
      className="my-4 w-full overflow-hidden rounded-xl border border-border"
      data-language={language}
      data-streamdown="code-block"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between bg-muted/80 p-3 text-xs text-muted-foreground"
        data-streamdown="code-block-header"
      >
        <span className="ml-1 font-mono lowercase">{language}</span>
        <div className="flex items-center gap-2">
          <CopyButton code={rawCode} />
        </div>
      </div>

      {/* Highlighted body */}
      <TokensView code={rawCode} language={language} theme={theme} />
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  Streamdown `components` override map                               */
/* ------------------------------------------------------------------ */

/**
 * Pass this object to `<Streamdown components={codeBlockComponents}>`.
 *
 * - `pre` preserves the `data-block` flag Streamdown requires to
 *   distinguish inline from fenced code.
 * - `code` is replaced by {@link CustomCodeBlock} for theme-aware
 *   syntax highlighting.
 */
export const codeBlockComponents = {
  pre: ({ children, ...props }: PropsWithChildren) => {
    if (isValidElement(children)) {
      return cloneElement(children, { 'data-block': 'true' } as any)
    }
    return <pre {...props}>{children}</pre>
  },
  code: CustomCodeBlock,
}
