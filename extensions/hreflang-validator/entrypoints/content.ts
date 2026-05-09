export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_idle',
  main() {
    // Placeholder - extraction happens via executeScript in useHreflangValidator
    console.debug('[Hreflang Validator] Content script loaded.')
  },
})
