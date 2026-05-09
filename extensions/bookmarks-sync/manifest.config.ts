import pkg from '../../package.json'
import type { UserManifest } from 'wxt'

export default {
  name: 'Bookmarks Sync',
  description: 'Sync your browser bookmarks with a remote server',
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
    'bookmarks',
    'storage',
    'alarms',
  ],
  host_permissions: [
    'https://*/*',
    'http://*/*',
  ],
} satisfies UserManifest
