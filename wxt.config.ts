import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'
import { extensions, defaultExtension } from './extensions/registry'

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
    excludeSources: Object.keys(extensions)
      .filter((name) => name !== ext)
      .map((name) => `extensions/${name}/**`),
  },
  vite: () => ({
    plugins: [
      tailwindcss(),
      react(),
    ],
  }),
})
