/**
 * Normalize user input such as "HTTPS://www.Example.com/path?q=1" into a
 * bare host pattern ("example.com"). Shared by the popup (when saving rules)
 * and the background script (when matching them), so both agree.
 */
export function cleanPattern(raw: string, autoIdentifyWww = true): string {
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/^\*\./, '')
  return autoIdentifyWww ? host.replace(/^www\./, '') : host
}
