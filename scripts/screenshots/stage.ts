/**
 * Builds the HTML "stage" for one store screenshot: dark canvas, headline,
 * and the real extension UI (popup or side panel), either on its own or in a
 * minimal browser window when the page behind it matters (the table that gets
 * extracted, the page a badge sits on, …). See ../generate-screenshots.ts.
 */

import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArrowLeft, ArrowRight, EllipsisVertical, Globe, Plus, RotateCw, SlidersHorizontal, Star, X } from 'lucide-react'

export type Theme = 'light' | 'dark'
export type FrameRole = 'page' | 'popup' | 'sidepanel'

/** Canned response for a fetch() made by the extension page. */
export interface FetchMock {
  method?: string
  /** Exact URL, or a prefix when it ends with `*`. */
  url: string
  status?: number
  json?: unknown
  text?: string
  delay?: number
}

/** Interaction performed before the screenshot is taken. */
export type Action =
  | { click: string; frame?: FrameRole }
  | { hover: string; frame?: FrameRole }
  | { waitFor: string; frame?: FrameRole }
  /** Scrolls the nearest scrollable ancestor so the element sits `offset` px below its top. */
  | { scrollIntoView: string; frame?: FrameRole; offset?: number }
  | { wait: number }

export type SceneUi =
  /**
   * In a browser window the popup opens under the toolbar, or floats at `at`
   * (canvas coordinates) when it would hide the part of the page that matters.
   * Without a browser window it is centred beside the copy, unless `at` and
   * `scale` place it.
   */
  | { kind: 'popup'; path?: string; width: number; height: number; at?: { left: number; top: number }; scale?: number }
  | { kind: 'sidepanel'; path?: string; width: number }
  | { kind: 'none' }

export interface Scene {
  /** Output file name inside extensions/<slug>/screenshots/ (promo tiles: public/). */
  file: string
  /** Short description, uploaded as the screenshot caption where supported. */
  caption: string
  /** Large headline; trusted HTML (may contain <br>). Promo tiles show the extension name instead. */
  headline: string
  subhead?: string
  /**
   * Where the copy goes: beside the UI, or as a band above it. `promo` is for
   * promo tiles: the extension's name and subhead on the left, and the popup
   * (if any) placed with `ui.at` / `ui.scale`.
   */
  layout: 'split-left' | 'split-right' | 'band' | 'promo'
  /** Canvas size; defaults to the 1280x800 store screenshot. */
  size?: { width: number; height: number }
  /** Theme of the extension UI and the browser chrome. */
  theme: Theme
  /** What tabs.query() returns as the active tab, and what the browser window shows. */
  tab: { url: string; title: string }
  /**
   * Page shown in a browser window behind the UI. Leave it out when the page
   * adds nothing: the UI is then shown on its own.
   */
  page?: string
  /**
   * false: load `page` off-canvas only, for UIs that read the active tab (via
   * scripting.executeScript) when the page itself is not worth showing.
   */
  showPage?: boolean
  ui: SceneUi
  /** Initial chrome.storage contents. */
  storage?: { local?: Record<string, unknown>; sync?: Record<string, unknown>; session?: Record<string, unknown> }
  fetch?: FetchMock[]
  /** Selector that must be visible before the actions run. */
  ready?: { frame: FrameRole; selector: string }
  actions?: Action[]
  /** Extra HTML placed on the canvas. */
  extras?: string
  /** Extra JS run in the stage once it has loaded. */
  stageScript?: string
}

// Vertically centred on the 800px canvas.
const SPLIT_WINDOW = { width: 728, height: 700, top: 50, scale: 1 }
// Below the headline band (.copy.band in stage.css): the space above the
// headline, between the subhead and the window, and below the window is even.
const BAND_WINDOW = { width: 1180, height: 692, top: 152, scale: 0.88 }
const TOOLBAR_HEIGHT = 84

function icon(component: ComponentType<{ size?: number; strokeWidth?: number }>, size = 16, strokeWidth = 2) {
  return renderToStaticMarkup(createElement(component, { size, strokeWidth }))
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Browser window geometry on the 1280x800 canvas. */
export function windowGeometry(scene: Scene) {
  const base = scene.layout === 'band' ? BAND_WINDOW : SPLIT_WINDOW
  const scaledWidth = base.width * base.scale
  const left =
    scene.layout === 'band'
      ? Math.round((1280 - scaledWidth) / 2)
      : scene.layout === 'split-left'
        ? 1280 - 40 - scaledWidth
        : 40
  return { ...base, left }
}

function renderOmnibox(scene: Scene): string {
  const url = new URL(scene.tab.url)
  const star = `<span class="star">${icon(Star, 15)}</span>`
  if (url.protocol === 'chrome-extension:') {
    return `<span class="ext-chip">${escapeHtml(scene.tab.title)}</span>
      <span class="path">chrome-extension://${escapeHtml(url.host)}${escapeHtml(url.pathname)}</span>${star}`
  }
  const rest = `${url.port ? `:${url.port}` : ''}${url.pathname === '/' ? '' : url.pathname}${url.search}`
  return `${icon(SlidersHorizontal, 15)}<span><span class="host">${escapeHtml(url.hostname)}</span><span class="path">${escapeHtml(rest)}</span></span>${star}`
}

function renderFavicon(scene: Scene): string {
  const url = new URL(scene.tab.url)
  if (url.protocol === 'chrome-extension:') return `<span class="favicon generic">${icon(Globe, 14)}</span>`
  return `<span class="favicon">${escapeHtml(url.hostname.replace(/^www\./, '').charAt(0).toUpperCase())}</span>`
}

function renderBrowser(scene: Scene, name: string): string {
  const geo = windowGeometry(scene)
  const ui = scene.ui
  const sidepanel =
    ui.kind === 'sidepanel'
      ? `<div class="sidepanel" style="width:${ui.width}px">
          <div class="sidepanel-header">${escapeHtml(name)}<span class="spacer"></span><span class="tb-btn">${icon(X, 15)}</span></div>
          <iframe data-role="sidepanel" data-src="${ui.path ?? '/sidepanel.html'}" title="side panel"></iframe>
        </div>`
      : ''

  return `<div class="browser ${scene.theme}" style="left:${geo.left}px;top:${geo.top}px;width:${geo.width}px;height:${geo.height}px;transform:scale(${geo.scale})">
    <div class="tabstrip">
      <div class="tab">${renderFavicon(scene)}<span class="title">${escapeHtml(scene.tab.title)}</span><span class="close">${icon(X, 13)}</span></div>
      <div class="newtab">${icon(Plus, 16)}</div>
    </div>
    <div class="toolbar">
      <span class="tb-btn">${icon(ArrowLeft, 17)}</span>
      <span class="tb-btn dim">${icon(ArrowRight, 17)}</span>
      <span class="tb-btn">${icon(RotateCw, 15)}</span>
      <div class="omnibox">${renderOmnibox(scene)}</div>
      <span class="tb-btn">${icon(EllipsisVertical, 17)}</span>
    </div>
    <div class="viewport">
      <iframe data-role="page" src="${escapeHtml(scene.page ?? 'about:blank')}" title="page"></iframe>
      ${sidepanel}
    </div>
  </div>`
}

function showsBrowser(scene: Scene): boolean {
  return !!scene.page && scene.showPage !== false
}

/** The popup lives on the canvas, not inside the window, so it is never clipped by it. */
function renderPopup(scene: Scene): string {
  const ui = scene.ui
  if (ui.kind !== 'popup') return ''
  let left: number
  let top: number
  let scale: number

  if (showsBrowser(scene)) {
    const geo = windowGeometry(scene)
    scale = geo.scale
    left = ui.at?.left ?? geo.left + (geo.width - 56 - ui.width) * scale
    top = ui.at?.top ?? geo.top + (TOOLBAR_HEIGHT + 2) * scale
  } else {
    // On its own: as large as fits, centred in the space beside the copy.
    const area =
      scene.layout === 'split-left'
        ? { left: 500, width: 740, top: 0, height: 800 }
        : scene.layout === 'split-right'
          ? { left: 40, width: 740, top: 0, height: 800 }
          : { left: 0, width: 1280, top: BAND_WINDOW.top, height: BAND_WINDOW.height * BAND_WINDOW.scale }
    scale = ui.scale ?? Math.min(1.12, (area.height - 64) / ui.height, (area.width - 64) / ui.width)
    left = ui.at?.left ?? area.left + (area.width - ui.width * scale) / 2
    top = ui.at?.top ?? area.top + (area.height - ui.height * scale) / 2
  }

  return `<div class="popup ${scene.theme}${showsBrowser(scene) ? '' : ' standalone'}" style="left:${left}px;top:${top}px;width:${ui.width}px;height:${ui.height}px;transform:scale(${scale})">
    <iframe data-role="popup" data-src="${ui.path ?? '/popup.html'}" width="${ui.width}" height="${ui.height}" title="popup"></iframe>
  </div>`
}

/** Keep hyphenated words (OpenAI-compatible, Pi-hole) on one line. Tags are left alone. */
function keepHyphenatedWords(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[^\s-]+(?:-[^\s-]+)+/g, (word) => `<span class="nowrap">${word}</span>`)))
    .join('')
}

/** Escape copy text and keep its hyphenated words together. */
function copyText(text: string): string {
  return keepHyphenatedWords(escapeHtml(text))
}

/** Canvas size of a scene in CSS pixels. */
export function canvasSize(scene: Scene): { width: number; height: number } {
  return scene.size ?? { width: 1280, height: 800 }
}

/** Promo tile copy: the extension name over its tagline, sized to the tile. */
function renderPromoCopy(scene: Scene, name: string): string {
  const { width } = canvasSize(scene)
  const small = width < 800
  const margin = small ? 30 : 96
  // The text stops well before the popup
  const right = scene.ui.kind === 'popup' && scene.ui.at ? width - scene.ui.at.left + margin * 0.6 : margin
  const sizes = small ? '--name:27px;--tagline:14px' : '--name:72px;--tagline:28px'
  return `<div class="copy promo" style="${sizes};left:${margin}px;right:${right}px">
    <h1 class="headline">${copyText(name)}</h1>
    ${scene.subhead ? `<p class="subhead">${copyText(scene.subhead)}</p>` : ''}
  </div>`
}

function renderCopy(scene: Scene, name: string): string {
  if (scene.layout === 'promo') return renderPromoCopy(scene, name)
  const side = scene.layout === 'band' ? 'band' : `split ${scene.layout === 'split-left' ? 'left' : 'right'}`
  return `<div class="copy ${side}">
    <h1 class="headline">${keepHyphenatedWords(scene.headline)}</h1>
    ${scene.subhead ? `<p class="subhead">${copyText(scene.subhead)}</p>` : ''}
  </div>`
}

function glowPosition(scene: Scene): string {
  if (scene.layout === 'promo') return canvasSize(scene).width < 800 ? 'left:-60px;top:-460px' : 'left:640px;top:-260px'
  if (scene.layout === 'band') return 'left:260px;top:240px'
  return scene.layout === 'split-left' ? 'left:620px;top:120px' : 'left:-40px;top:120px'
}

/** `name` is the extension name, shown in the side panel header. */
export function renderStage(scene: Scene, name: string): string {
  if (scene.ui.kind === 'sidepanel' && !showsBrowser(scene)) throw new Error(`${scene.file}: a side panel needs a page next to it`)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(name)} — ${escapeHtml(scene.file)}</title>
  <link rel="stylesheet" href="/__stage/fonts.css">
  <link rel="stylesheet" href="/__stage/stage.css">
</head>
<body>
  <div class="canvas" style="width:${canvasSize(scene).width}px;height:${canvasSize(scene).height}px">
    <div class="glow" style="${glowPosition(scene)}"></div>
    ${renderCopy(scene, name)}
    ${showsBrowser(scene) ? renderBrowser(scene, name) : ''}
    ${scene.page && !showsBrowser(scene) ? `<iframe class="offscreen-page" data-role="page" src="${escapeHtml(scene.page)}" title="page"></iframe>` : ''}
    ${renderPopup(scene)}
    ${scene.extras ?? ''}
  </div>
  <script>
    // The generator calls this once the demo page has loaded, so that
    // scripting.executeScript() calls made on startup find its content.
    window.__startUi = () => {
      for (const frame of document.querySelectorAll('iframe[data-src]')) frame.src = frame.dataset.src
    }
    ${scene.stageScript ?? ''}
  </script>
</body>
</html>`
}
