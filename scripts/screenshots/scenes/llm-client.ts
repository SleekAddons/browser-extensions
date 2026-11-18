import type { Conversation } from '../../../extensions/ollama-client/lib/types'
import type { FetchMock, Scene } from '../stage'

const ARTICLE_TAB = {
  url: 'https://blog.example.com/heat-pumps',
  title: 'How heat pumps keep a home warm',
}

const ENDPOINTS = [
  { id: 'local', name: 'This computer', baseUrl: 'http://localhost:11434' },
  { id: 'server', name: 'Home server', baseUrl: 'http://192.168.1.20:11434' },
]

const MODELS = [
  ['gemma3:12b', 8.1e9],
  ['llama3.2:3b', 2.0e9],
  ['qwen3:8b', 5.2e9],
  ['qwen2.5-coder:7b', 4.7e9],
  ['mistral:7b', 4.1e9],
  ['deepseek-r1:8b', 4.9e9],
].map(([name, size]) => ({ name, model: name, modified_at: '2026-10-02T09:12:00Z', size, digest: `sha256:${name}` }))

const ollamaApi: FetchMock[] = ENDPOINTS.map((endpoint) => ({
  url: `${endpoint.baseUrl}/api/tags`,
  json: { models: MODELS },
}))

const NOW = Date.now()

const SUMMARY: Conversation = {
  id: 'summary',
  endpointId: 'local',
  model: 'gemma3:12b',
  title: 'Summarize this article',
  createdAt: NOW - 120_000,
  updatedAt: NOW - 60_000,
  messages: [
    {
      role: 'user',
      content: 'Summarize this article in a few bullet points.',
      pageContext: {
        title: 'How heat pumps keep a home warm',
        url: ARTICLE_TAB.url,
        tokens: 512,
        truncated: false,
      },
    },
    {
      role: 'assistant',
      content: [
        '**Heat pumps move heat instead of making it.**',
        '',
        '- They pull warmth from outdoor air, the ground or water and bring it inside, using the same cycle as a fridge.',
        '- A compressor heats the refrigerant, which then releases that heat indoors.',
        '- One unit of electricity delivers **3–4 units of heat**; a typical seasonal COP is around 3.',
        '- They work best in well-insulated homes with large radiators or underfloor heating.',
        '',
        '**Before you buy:** check your insulation and ask for a room-by-room heat-loss calculation.',
      ].join('\n'),
      tokenUsage: { promptTokens: 604, completionTokens: 112, totalDuration: 4.1e9, promptEvalDuration: 0.6e9, evalDuration: 3.3e9 },
    },
  ],
}

const CODE: Conversation = {
  id: 'code',
  endpointId: 'local',
  model: 'qwen2.5-coder:7b',
  title: 'Debounce in TypeScript',
  createdAt: NOW - 300_000,
  updatedAt: NOW - 240_000,
  messages: [
    { role: 'user', content: 'Write a small debounce helper in TypeScript.' },
    {
      role: 'assistant',
      content: [
        'Here is a typed `debounce` that delays calls until the input settles:',
        '',
        '```ts',
        'function debounce<A extends any[]>(',
        '  fn: (...a: A) => void,',
        '  ms = 300,',
        ') {',
        '  let t: number | undefined',
        '  return (...a: A) => {',
        '    clearTimeout(t)',
        '    t = setTimeout(fn, ms, ...a)',
        '  }',
        '}',
        '```',
        '',
        'Use it for search boxes or resize handlers, e.g. `debounce(search, 250)`.',
      ].join('\n'),
      tokenUsage: { promptTokens: 38, completionTokens: 141, totalDuration: 3.2e9, promptEvalDuration: 0.2e9, evalDuration: 2.9e9 },
    },
  ],
}

function storage(conversation: Conversation, pageContextEnabled: boolean) {
  return {
    local: {
      ollama_endpoints: ENDPOINTS,
      ollama_active_endpoint_id: 'local',
      ollama_selected_model: conversation.model,
      ollama_conversations: [conversation, conversation === SUMMARY ? CODE : SUMMARY],
      ollama_active_conversation_id: conversation.id,
      ollama_chat_options: { pageContextEnabled, pageContextAutoDisabled: false, activeCommandIds: [] },
      ollama_token_usage: { totalPromptTokens: 18_240, totalCompletionTokens: 6_120, totalRequests: 42 },
    },
  }
}

export const ollamaClientScenes: Scene[] = [
  {
    file: '1.png',
    caption: 'Ask your local Ollama models about the page you are reading, in the side panel',
    layout: 'band',
    theme: 'light',
    headline: 'Chat with local AI next to any page',
    subhead: 'Summarize or ask questions about what you’re reading, answered by your own Ollama models.',
    tab: ARTICLE_TAB,
    page: '/__stage/pages/text.html',
    ui: { kind: 'sidepanel', width: 420 },
    storage: storage(SUMMARY, true),
    fetch: ollamaApi,
    ready: { frame: 'sidepanel', selector: 'text=Heat pumps move heat instead of making it.' },
    actions: [{ scrollIntoView: 'text=Summarize this article in a few bullet points.', frame: 'sidepanel', offset: 12 }],
  },
  {
    file: '2.png',
    caption: 'Pick any model installed on your Ollama server',
    layout: 'split-left',
    theme: 'light',
    headline: 'Switch between all your models',
    subhead: 'Every model you have pulled with Ollama is one click away, on this computer or a server at home.',
    chips: ['Multiple servers', 'Chat history', 'Custom commands'],
    tab: ARTICLE_TAB,
    ui: { kind: 'popup', width: 600, height: 600 },
    storage: storage(SUMMARY, false),
    fetch: ollamaApi,
    ready: { frame: 'popup', selector: 'text=Heat pumps move heat instead of making it.' },
    actions: [{ click: 'button:has-text("gemma3:12b")' }, { waitFor: 'role=menuitemradio[name="deepseek-r1:8b"]' }],
  },
  {
    file: '3.png',
    caption: 'Code answers with syntax highlighting, sent only to your own Ollama server',
    layout: 'split-right',
    theme: 'dark',
    headline: 'Private by design',
    subhead: 'Chats go only to the Ollama server you choose and are saved in your browser.',
    chips: ['No account', 'Saved locally', 'Markdown & code'],
    tab: ARTICLE_TAB,
    ui: { kind: 'popup', width: 600, height: 600 },
    storage: storage(CODE, false),
    fetch: ollamaApi,
    ready: { frame: 'popup', selector: 'text=Use it for search boxes' },
  },
]
