import pkg from '../../package.json'
import type { UserManifest } from 'wxt'

export default {
  name: 'Breakpoint Viewer',
  description: 'See which CSS breakpoint is active on any website. Supports Tailwind, Bootstrap, and custom presets.',
  version: pkg.version,
  icons: {
    16: 'icon16.png',
    32: 'icon32.png',
    48: 'icon48.png',
    128: 'icon128.png',
  },
  action: {
    default_icon: {
      16: 'icon16.png',
      32: 'icon32.png',
      48: 'icon48.png',
      128: 'icon128.png',
    },
  },
  permissions: [
    'activeTab',
    'scripting',
    'storage',
  ],
} satisfies UserManifest
