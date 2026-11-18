/**
 * Browser-side stand-in for the extension runtime, used by
 * scripts/generate-screenshots.ts to render the real, built extension pages
 * (popup.html, sidepanel.html, …) as ordinary web pages with demo data.
 *
 * Injected into every frame before any page script runs. It installs itself
 * on extension pages (everything not served from /__stage/) and exposes
 * `window.__installExtensionMock(win)` so the stage can add it to demo pages
 * that need a content script.
 *
 * `window.__SCREENSHOT_MOCK__` holds the scene data:
 *   manifest  built manifest.json
 *   theme     'light' | 'dark' (written to the shared useTheme() key)
 *   tab       the "active tab" returned by tabs.query()
 *   storage   { local, sync, session } initial contents
 *   fetch     [{ method, url, status, json, text, delay }] canned responses;
 *             a url ending in * matches by prefix
 *
 * scripting.executeScript() runs the injected function inside the demo page
 * frame (iframe[data-role="page"]) the same way the browser would: by
 * serializing the function and evaluating it in that document.
 */
;(() => {
  const data = window.__SCREENSHOT_MOCK__
  if (!data) return

  const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  function createEvent() {
    const listeners = new Set()
    return {
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
      hasListener: (fn) => listeners.has(fn),
      hasListeners: () => listeners.size > 0,
      dispatch: (...args) => {
        for (const fn of listeners) {
          try {
            fn(...args)
          } catch (err) {
            console.error('[extension-mock] listener failed', err)
          }
        }
      },
    }
  }

  /** Window of the demo page that plays the "active tab". */
  function tabWindow() {
    try {
      return window.top.document.querySelector('iframe[data-role="page"]')?.contentWindow ?? null
    } catch {
      return null
    }
  }

  function matchesUrl(pattern, url) {
    return pattern.endsWith('*') ? url.startsWith(pattern.slice(0, -1)) : url === pattern
  }

  function install(win) {
    if (win.chrome?.runtime?.id === 'screenshot-mock') return win.chrome

    const storageChanged = createEvent()

    const makeArea = (areaName) => {
      const store = clone(data.storage?.[areaName] ?? {})
      const onChanged = createEvent()
      const emit = (changes) => {
        if (Object.keys(changes).length === 0) return
        onChanged.dispatch(changes)
        storageChanged.dispatch(changes, areaName)
      }
      return {
        async get(keys) {
          if (keys == null) return clone(store)
          if (typeof keys === 'string') keys = [keys]
          const out = {}
          if (Array.isArray(keys)) {
            for (const key of keys) if (key in store) out[key] = clone(store[key])
          } else {
            for (const [key, fallback] of Object.entries(keys)) {
              out[key] = key in store ? clone(store[key]) : fallback
            }
          }
          return out
        },
        async set(items) {
          const changes = {}
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: clone(store[key]), newValue: clone(value) }
            store[key] = clone(value)
          }
          emit(changes)
        },
        async remove(keys) {
          const changes = {}
          for (const key of typeof keys === 'string' ? [keys] : keys) {
            if (!(key in store)) continue
            changes[key] = { oldValue: clone(store[key]) }
            delete store[key]
          }
          emit(changes)
        },
        async clear() {
          await this.remove(Object.keys(store))
        },
        async getBytesInUse() {
          return JSON.stringify(store).length
        },
        async setAccessLevel() {},
        onChanged,
      }
    }

    const tab = {
      id: 1,
      index: 0,
      windowId: 1,
      active: true,
      highlighted: true,
      pinned: false,
      incognito: false,
      status: 'complete',
      ...data.tab,
    }

    const noop = async () => {}

    const chromeMock = {
      runtime: {
        id: 'screenshot-mock',
        lastError: undefined,
        getManifest: () => clone(data.manifest),
        getURL: (path) => `${win.location.origin}/${String(path).replace(/^\//, '')}`,
        getPlatformInfo: async () => ({ os: 'mac', arch: 'arm' }),
        sendMessage: async () => undefined,
        connect: () => ({
          name: '',
          postMessage() {},
          disconnect() {},
          onMessage: createEvent(),
          onDisconnect: createEvent(),
        }),
        openOptionsPage: noop,
        onMessage: createEvent(),
        onConnect: createEvent(),
        onInstalled: createEvent(),
        onStartup: createEvent(),
      },
      storage: {
        local: makeArea('local'),
        sync: makeArea('sync'),
        session: makeArea('session'),
        managed: makeArea('managed'),
        onChanged: storageChanged,
      },
      tabs: {
        query: async () => [clone(tab)],
        get: async () => clone(tab),
        getCurrent: async () => undefined,
        create: async (props) => ({ ...clone(tab), id: 2, ...props }),
        update: async (_id, props) => ({ ...clone(tab), ...props }),
        reload: noop,
        sendMessage: async () => undefined,
        onActivated: createEvent(),
        onUpdated: createEvent(),
        onRemoved: createEvent(),
        onCreated: createEvent(),
      },
      windows: {
        getCurrent: async () => ({ id: 1, focused: true, type: 'normal' }),
        onFocusChanged: createEvent(),
      },
      scripting: {
        async executeScript({ func, args = [], files }) {
          const page = tabWindow()
          if (!page) throw new Error('Cannot access contents of the page.')
          if (files?.length) {
            for (const file of files) {
              await new Promise((resolve, reject) => {
                const script = page.document.createElement('script')
                script.src = `/${file.replace(/^\//, '')}`
                script.onload = resolve
                script.onerror = reject
                page.document.documentElement.appendChild(script)
              })
            }
            return [{ documentId: 'mock', frameId: 0, result: undefined }]
          }
          // Evaluate the function's source inside the page, like the browser does.
          const fn = page.Function(`return (${func.toString()})`)()
          const result = await fn(...clone(args))
          return [{ documentId: 'mock', frameId: 0, result: clone(result) }]
        },
        insertCSS: noop,
        removeCSS: noop,
      },
      permissions: {
        contains: async () => true,
        request: async () => true,
        getAll: async () => ({ permissions: data.manifest?.permissions ?? [], origins: [] }),
        onAdded: createEvent(),
        onRemoved: createEvent(),
      },
      action: {
        setBadgeText: noop,
        setBadgeBackgroundColor: noop,
        setIcon: noop,
        setTitle: noop,
        openPopup: noop,
        onClicked: createEvent(),
      },
      sidePanel: {
        open: noop,
        setOptions: noop,
        setPanelBehavior: noop,
        getOptions: async () => ({ enabled: true }),
      },
      alarms: {
        create: noop,
        clear: async () => true,
        clearAll: async () => true,
        get: async () => undefined,
        getAll: async () => [],
        onAlarm: createEvent(),
      },
      declarativeNetRequest: {
        updateDynamicRules: noop,
        getDynamicRules: async () => [],
        updateSessionRules: noop,
        getSessionRules: async () => [],
      },
      i18n: {
        getMessage: () => '',
        getUILanguage: () => 'en-US',
      },
    }

    win.chrome = chromeMock

    // Canned network responses. Anything else outside this origin fails like
    // an unreachable server, so a scene never depends on the real network.
    const realFetch = win.fetch.bind(win)
    win.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = String(init.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
      const rule = (data.fetch ?? []).find(
        (r) => String(r.method ?? 'GET').toUpperCase() === method && matchesUrl(r.url, url),
      )
      if (!rule) {
        if (url.startsWith('/') || url.startsWith(win.location.origin)) return realFetch(input, init)
        console.warn('[extension-mock] no canned response for', method, url)
        throw new TypeError('Failed to fetch')
      }
      if (rule.delay) await sleep(rule.delay)
      const isJson = rule.json !== undefined
      return new Response(isJson ? JSON.stringify(rule.json) : (rule.text ?? ''), {
        status: rule.status ?? 200,
        headers: { 'Content-Type': isJson ? 'application/json' : 'text/plain' },
      })
    }

    return chromeMock
  }

  window.__installExtensionMock = install

  if (location.pathname.startsWith('/__stage/')) return

  install(window)

  try {
    // Whatever fills the browser viewport (e.g. a blocked-site page) stays
    // light so the extension UI next to it stands out; the popup and side
    // panel use the scene theme. Frames load one after the other, page first.
    const inViewport = window.frameElement?.getAttribute('data-role') === 'page'
    if (data.theme) localStorage.setItem('app-theme', inViewport ? 'light' : data.theme)
  } catch {
    // Storage can be unavailable; the page then follows prefers-color-scheme.
  }

  // Use the bundled Inter / JetBrains Mono instead of whatever system-ui
  // resolves to on the machine that renders the screenshots.
  document.addEventListener('DOMContentLoaded', () => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/__stage/fonts.css'
    document.head.appendChild(link)
    const style = document.createElement('style')
    style.textContent = `
      :root {
        --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif !important;
        --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace !important;
      }
      html { -webkit-font-smoothing: antialiased; }
    `
    document.head.appendChild(style)
  })
})()
