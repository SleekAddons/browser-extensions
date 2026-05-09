import pkg from '../../package.json'
import type { UserManifest } from 'wxt'

export default {
  name: 'Website Blocker',
  description: 'Block distracting websites with scheduled rules and usage stats',
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
    'declarativeNetRequest',
    'storage',
    'alarms',
    'tabs',
  ],
  host_permissions: [
    'http://*/*',
    'https://*/*',
  ],
  web_accessible_resources: [
    {
      resources: ['blocked.html'],
      matches: ['<all_urls>'],
    },
  ],
} satisfies UserManifest
