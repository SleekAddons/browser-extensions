# Browser Extensions Monorepo

A collection of browser extensions for Chrome and Firefox, built with [WXT](https://wxt.dev/), React 19, TypeScript, and Tailwind CSS v4. All extensions live in a single repo and share UI components from [src/](src/).

## Extensions

| Folder | Name | Description |
| --- | --- | --- |
| [extensions/breakpoint-viewer](extensions/breakpoint-viewer/README.md) | Breakpoint Viewer | Show the active CSS breakpoint on any page (Tailwind, Bootstrap, custom). |
| [extensions/ollama-client](extensions/ollama-client/README.md) | Ollama Client | Chat with local Ollama AI models from a side panel. |
| [extensions/pihole-manager](extensions/pihole-manager/README.md) | Pi-hole Manager | Monitor and control Pi-hole instances from the toolbar. |
| [extensions/table-extractor](extensions/table-extractor/README.md) | Table Extractor | Extract HTML tables and export to CSV, JSON, XML, HTML, XLSX. |
| [extensions/tool-hub](extensions/tool-hub/README.md) | Tool Hub | Discover and launch web tools, with i18n support. |
| [extensions/website-blocker](extensions/website-blocker/README.md) | Website Blocker | Block sites with schedules, time limits, and usage stats. |

## Requirements

- Node.js 20+
- npm 10+

## Getting started

```bash
npm install
```

`postinstall` runs `wxt prepare` automatically to generate type stubs.

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

The generic `npm run build` builds the default extension; `npm run zip` zips the build.

## Repository layout

```
extensions/         one folder per extension
  <name>/
    manifest.config.ts   extension manifest (name, permissions, icons)
    entrypoints/         popup, sidepanel, content scripts, background
    components/          extension-specific React components
    lib/                 hooks, storage, API helpers, types
    public/              static assets (icons, locales, html)
src/
  components/        shared React + shadcn UI components
  lib/               shared hooks and utilities
  index.css          shared Tailwind entry
scripts/
  generate-icons.ts        regenerate icons from extension name initials
  generate-promo-tiles.ts  regenerate store promo images
extensions/registry.ts     auto-discovers extensions with manifest.config.ts
wxt.config.ts              WXT build config; reads EXT env var
```

## How extension selection works

[wxt.config.ts](wxt.config.ts) reads the `EXT` environment variable and picks the matching manifest from [extensions/registry.ts](extensions/registry.ts). The registry auto-discovers any subfolder of `extensions/` that contains a `manifest.config.ts`. To add a new extension, create a new folder and a `manifest.config.ts`; no manual registration needed.

The config also strips Chrome-only permissions (e.g. `sidePanel`) when building for Firefox, and adds `browser_specific_settings` for Mozilla store compliance.

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
- [lucide-react](https://lucide.dev/) icons
- [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) for forms and validation
- [recharts](https://recharts.org/) for charts
- [next-themes](https://github.com/pacocoursey/next-themes) for dark mode
- [sonner](https://sonner.emilkowal.ski/) for toasts
- [streamdown](https://streamdown.ai/) for streaming Markdown (Ollama Client)
- [papaparse](https://www.papaparse.com/), [xlsx](https://sheetjs.com/), [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for exports
- [sharp](https://sharp.pixelplumbing.com/) for icon generation

## Contributing

1. Fork and clone the repo.
2. `npm install`.
3. Pick an extension and run its `dev:` script.
4. Make changes; keep shared code in [src/](src/) and extension-specific code under `extensions/<name>/`.
5. Build with the matching `build:` script and verify the produced zip in `.output/`.

## License

GPL-3.0. See [LICENSE](LICENSE).
