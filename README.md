# Browser Extensions Monorepo

A collection of browser extensions for Chrome and Firefox, built with [WXT](https://wxt.dev/), React 19, TypeScript, and Tailwind CSS v4. All extensions live in a single repo and share UI components from [src/](src/).

## Extensions

| Folder | Name | Description | Chrome | Firefox |
| --- | --- | --- | --- | --- |
| [extensions/breakpoint-viewer](extensions/breakpoint-viewer/) | Breakpoint Viewer | Show the active CSS breakpoint on any page (Tailwind, Bootstrap, custom). | [Chrome](https://chromewebstore.google.com/detail/tailwind-breakpoint-viewe/opoganallbaahcdakchbmnlmimemobid) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/breakpoint-viewer/) |
| [extensions/llm-client](extensions/llm-client/) | LLM Client | Chat with Ollama or any OpenAI-compatible AI model from a side panel. | [Chrome](https://chromewebstore.google.com/detail/ollama-client/chjmddjaldiindjecpdpfdpojeamfdgb) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/ollama-client-by-sleek-addons/) |
| [extensions/pihole-manager](extensions/pihole-manager/) | Pi-hole Manager | Monitor and control Pi-hole instances from the toolbar. | [Chrome](https://chromewebstore.google.com/detail/pi-hole-manager/lknjhhcjbaahogmgnjfbkdpkenebfcjb) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/pi-hole-manager/) |
| [extensions/table-extractor](extensions/table-extractor/) | Table Extractor | Extract HTML tables and export to CSV, JSON, XML, HTML, XLSX. | [Chrome](https://chromewebstore.google.com/detail/table-extractor/poheddickmdclbcjkhfkeccfnolplnoi) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/table-extractor/) |
| [extensions/website-blocker](extensions/website-blocker/) | Website Blocker | Block sites with schedules, time limits, and usage stats. | [Chrome](https://chromewebstore.google.com/detail/website-blocker/bfbhaeaddmhmiilkmolfjfppknmimpei) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/website-blocker-by-sleekaddons/) |

## Requirements

- Node.js 20+
- npm 10+

## Getting started

```bash
npm install
```

## Running an extension in dev mode

Each extension has its own dev script. The browser launches automatically with the extension loaded and hot-reload enabled.

```bash
npm run dev:table-extractor
npm run dev:breakpoint-viewer
npm run dev:pihole-manager
npm run dev:llm-client
npm run dev:website-blocker
```

To target a specific browser, pass it through WXT:

```bash
npm run dev:table-extractor -- -b firefox
```

`npm run dev` (no suffix) builds the default extension defined in [extensions/registry.ts](extensions/registry.ts).

## Building for production

Each extension produces a zip under `.output/`:

```bash
npm run build:table-extractor
```

## Shared components

UI primitives (buttons, dialogs, dropdowns, etc.) come from [shadcn/ui](https://ui.shadcn.com/) and live in [src/components/ui/](src/components/ui/). Higher-level shared widgets like `ExtensionHeader`, `PopupContainer`, `EmptyState`, and `StatsGrid` live in [src/components/](src/components/) and are reused across extensions.

## Icons

Extension icons (16, 32, 48, 128 px) are auto-generated from each extension's name initials with a black rounded background and white centered text. Output goes to `extensions/<name>/public/`.

```bash
npm run generate-icons              # regenerate for all extensions
npx tsx scripts/generate-icons.ts table-extractor   # regenerate for one
```

Override initials in [scripts/generate-icons.ts](scripts/generate-icons.ts) via `INITIALS_OVERRIDE`. Promo tiles for store listings are generated similarly with `npm run generate-promo-tiles`.

## Store screenshots

Each extension keeps its store screenshots (1280×800) in `extensions/<name>/screenshots/`, committed to git, with optional captions in `captions.json` next to them. Deploying uploads whatever is in that folder, so you can also drop in your own images.

To regenerate them after UI changes (needs Google Chrome, or `CHROME_PATH` pointing to a Chromium-based browser):

```bash
npm run generate-screenshots                                 # all extensions
npm run generate-screenshots -- table-extractor --only 2     # one screenshot
```

The generator builds the extension and renders its real popup or side panel with demo data. Scenes (headline, demo data, clicks) live in [scripts/screenshots/scenes/](scripts/screenshots/scenes/).

## Publishing to the stores

`npm run deploy` builds the extensions with the version from `package.json` and publishes them:

- **Chrome Web Store**: uploads the package and submits it for review.
- **Firefox Add-ons**: uploads the package with its source code archive, then replaces the listing screenshots with the ones in `extensions/<name>/screenshots/` if they differ.

The Chrome Web Store API cannot change listing screenshots, so upload those by hand in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) when they change.

One-time setup: copy `.env.example` to `.env` and fill in the credentials (the comments explain where to get them). `.env` is git-ignored and never included in uploaded archives. Store IDs live in `extensions/<name>/store.json`.

```bash
npm run deploy -- table-extractor            # one extension, both stores
npm run deploy -- --all                      # every extension
npm run deploy -- --all --dry-run            # show what would happen, change nothing
npm run deploy -- pihole-manager --store firefox
npm run deploy -- --all --screenshots-only   # only sync Firefox screenshots
```

Re-running is safe: versions that are already uploaded and screenshots that already match are skipped. A new version must be higher than the published one, so bump `version` in `package.json` first. If an earlier version is still in Chrome review, pass `--cancel-pending` to withdraw it. Run `npm run deploy -- --help` for all options.

## Key libraries

- [WXT](https://wxt.dev/) — extension framework (manifest, entrypoints, dev server, cross-browser)
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`
- [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Base UI](https://base-ui.com/)

## License

GPL-3.0. See [LICENSE](LICENSE).
