export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  main() {
    // Content script placeholder
    // Table extraction is handled via chrome.scripting.executeScript from the popup/sidepanel
  },
})
