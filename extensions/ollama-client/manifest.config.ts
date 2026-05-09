import pkg from '../../package.json'
import type { UserManifest } from 'wxt'

export default {
  name: 'Ollama Client',
  description: 'Chat with your local Ollama AI models right from the browser',
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
    'sidePanel',
    'activeTab',
    'scripting',
    'storage',
  ],
  host_permissions: [
    'http://localhost/*',
    'http://127.0.0.1/*',
    'https://*/*',
    'http://*/*',
  ],
} satisfies UserManifest
