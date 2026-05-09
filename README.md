# Browser Extensions Monorepo

A collection of browser extensions for Chrome and Firefox, built with [WXT](https://wxt.dev/), React 19, TypeScript, and Tailwind CSS v4. All extensions live in a single repo and share UI components from [src/](src/).

## Extensions

| Folder | Name | Description | Chrome | Firefox |
| --- | --- | --- | --- | --- |
| [extensions/breakpoint-viewer](extensions/breakpoint-viewer/README.md) | Breakpoint Viewer | Show the active CSS breakpoint on any page (Tailwind, Bootstrap, custom). | [Chrome](https://chromewebstore.google.com/detail/tailwind-breakpoint-viewe/opoganallbaahcdakchbmnlmimemobid) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/breakpoint-viewer/) |
| [extensions/ollama-client](extensions/ollama-client/README.md) | Ollama Client | Chat with local Ollama AI models from a side panel. | [Chrome](https://chromewebstore.google.com/detail/ollama-client/chjmddjaldiindjecpdpfdpojeamfdgb) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/ollama-client-by-sleek-addons/) |
| [extensions/pihole-manager](extensions/pihole-manager/README.md) | Pi-hole Manager | Monitor and control Pi-hole instances from the toolbar. | [Chrome](https://chromewebstore.google.com/detail/pi-hole-manager/lknjhhcjbaahogmgnjfkdpkenebfcjb) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/pi-hole-manager/) |
| [extensions/table-extractor](extensions/table-extractor/README.md) | Table Extractor | Extract HTML tables and export to CSV, JSON, XML, HTML, XLSX. | [Chrome](https://chromewebstore.google.com/detail/table-extractor/poheddickmdclbcjkhfkeccfnolplnoi) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/table-extractor/) |
| [extensions/tool-hub](extensions/tool-hub/README.md) | Tool Hub | Discover and launch web tools, with i18n support. | [Chrome](https://chromewebstore.google.com/detail/tool-hub/njmnbhbdgnbkjknnmfhinhbbpjpcclld) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tool-hub/) |
| [extensions/website-blocker](extensions/website-blocker/README.md) | Website Blocker | Block sites with schedules, time limits, and usage stats. | [Chrome](https://chromewebstore.google.com/detail/website-blocker/bfbhaeaddmhmiilkmolfjfppknmimpei) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/website-blocker-by-sleekaddons/) |

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
npm run dev:ollama-client
npm run dev:tool-hub
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

## Key libraries

- [WXT](https://wxt.dev/) — extension framework (manifest, entrypoints, dev server, cross-browser)
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`
- [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Base UI](https://base-ui.com/)

## License

GPL-3.0. See [LICENSE](LICENSE).
