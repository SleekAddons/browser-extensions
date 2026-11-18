# LLM Client: store listing

Paste into the Chrome Web Store dashboard (Store listing > Description) and
AMO Developer Hub (Edit Product Page > Summary, Description). The short
summary is the manifest description (`extDescription` in `locales/*.json`) and
ships with the next version; on AMO it also has to be pasted into Summary.

## Summary (132 characters max)

```text
Chat with Ollama, OpenAI, OpenRouter or LM Studio models in a side panel. Summarize pages, ask about any site, attach files.
```

## Description

```text
LLM Client is an AI chat side panel for your browser. Talk to local models on Ollama, or to any OpenAI-compatible API. Summarize the page you are reading, ask questions about it, explain code and attach files, all without switching tabs.

WORKS WITH
• Ollama, local or remote, with an optional auth token
• OpenAI API with your own API key
• OpenRouter, LM Studio, llama.cpp server, vLLM and any other server with an OpenAI-compatible /v1 API
• Every chat model your server offers, listed automatically

FEATURES
• Side panel chat that stays open while you browse, or a quick popup
• Include page: send the text of the current tab with your message, trimmed automatically to fit the model's context window
• One-click Summarize and Explain, plus your own reusable prompt commands
• Attach images for vision models, and text, CSV, JSON, Markdown or code files
• Streaming replies with Markdown and syntax-highlighted code blocks you can copy
• Several endpoints side by side
• Custom system prompt and context size for each endpoint
• Token meter that shows how much of the context window you have used
• Chat history kept in your browser (last 100 conversations)

HOW TO USE
1. Click the toolbar icon or open the side panel.
2. Add an endpoint: your Ollama address (default http://localhost:11434), or an OpenAI-compatible base URL and API key.
3. Pick a model and start chatting. Turn on Include page to ask about the site you are on.

PRIVACY
No account, no tracking, no analytics. Messages and page text go only to the endpoint you choose, and your chats and API keys are stored locally in your browser. With Ollama or another local server, nothing leaves your computer.

OPEN SOURCE
The full source code is on GitHub: https://github.com/SleekAddons/browser-extensions
Bug reports and feature requests are welcome.
```
