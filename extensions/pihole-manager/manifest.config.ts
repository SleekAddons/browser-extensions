import pkg from '../../package.json'
import type { UserManifest } from 'wxt'

export default {
  name: 'Pi-hole Manager',
  description: 'Monitor and control your Pi-hole instances from the browser',
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
    'storage',
  ],
  host_permissions: [
    'https://*/*',
    'http://*/*',
  ],
} satisfies UserManifest
