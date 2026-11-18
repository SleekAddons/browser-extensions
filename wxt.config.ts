import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'
import { extensions, defaultExtension } from './extensions/registry'
import { buildLocales } from './extensions/locales'

const ext = process.env.EXT ?? defaultExtension
const manifest = extensions[ext]
if (!manifest) {
  const available = Object.keys(extensions).join(', ')
  throw new Error(`Unknown extension "${ext}". Available: ${available}`)
}

console.log(`\n  Building extension: ${ext}\n`)

const root = import.meta.dirname

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: path.resolve(root, 'extensions', ext, 'entrypoints'),
  publicDir: `extensions/${ext}/public`,
  outDir: '.output',
  imports: false,
  manifest: (env) => {
    // sidePanel is a Chrome-only permission; WXT handles the
    // side_panel → sidebar_action entry conversion for Firefox,
    // but does not strip the permission string.
    const CHROME_ONLY_PERMISSIONS = ['sidePanel']

    if (env.browser === 'firefox') {
      return {
        ...manifest,
        ...(manifest.permissions && {
          permissions: manifest.permissions.filter(
            (p: string) => !CHROME_ONLY_PERMISSIONS.includes(p),
          ),
        }),
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      }
    }
    return manifest
  },
  hooks: {
    'build:publicAssets'(wxt, files) {
      // Store-listing promo tiles live next to the icons in public/ but are
      // never used at runtime, so keep them out of the extension package.
      for (let i = files.length - 1; i >= 0; i--) {
        if (/^promo-[^/]*\.png$/.test(files[i].relativeDest)) files.splice(i, 1)
      }

      // Translations: _locales/<locale>/messages.json, merged from
      // src/locales and extensions/<name>/locales (see extensions/locales.ts).
      const locales = buildLocales(ext)
      for (const warning of locales.warnings) wxt.logger.warn(`Translation: ${warning}`)
      if (locales.errors.length) {
        throw new Error(`Invalid translations:\n  ${locales.errors.join('\n  ')}`)
      }
      files.push(...locales.files)
    },
    'build:manifestGenerated'(_wxt, manifest) {
      // Prevent Firefox from injecting its extension.css into the sidebar.
      // The injected stylesheet uses an anonymous @layer that outranks
      // Tailwind CSS v4's named layers, overriding body background/color
      // and breaking dark-mode toggling.
      const sidebar = (manifest as Record<string, any>).sidebar_action
      if (sidebar) {
        sidebar.browser_style = false
      }
    },
  },
  zip: {
    name: ext,
    artifactTemplate: `${ext}-{{version}}-{{browser}}.zip`,
    excludeSources: [
      ...Object.keys(extensions)
        .filter((name) => name !== ext)
        .map((name) => `extensions/${name}/**`),
      // Repo tooling and store screenshots are not needed to build the
      // extension, and deploy credentials must never be uploaded (.env* is
      // already excluded by WXT).
      'scripts/**',
      'extensions/*/screenshots/**',
      'secrets/**',
    ],
  },
  vite: () => ({
    plugins: [
      tailwindcss(),
      react(),
    ],
  }),
})
