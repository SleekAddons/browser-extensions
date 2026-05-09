/** A single hreflang entry extracted from the page */
export interface HreflangTag {
  /** The hreflang attribute value, e.g. "en", "en-US", "x-default" */
  hreflang: string
  /** The href URL */
  href: string
  /** Where the tag was found */
  source: 'html' | 'http-header'
}

/** A single validation issue */
export interface ValidationIssue {
  message: string
  /** The hreflang tag that triggered this issue, if applicable */
  tag?: HreflangTag
}

/** Full validation result for a page */
export interface ValidationResult {
  /** The page URL that was validated */
  url: string
  /** All hreflang tags found on the page */
  tags: HreflangTag[]
  /** Validation issues found */
  issues: ValidationIssue[]
  /** Timestamp of the validation */
  timestamp: number
}

/** Message sent from content script to popup/sidepanel */
export interface HreflangMessage {
  type: 'HREFLANG_DATA'
  payload: {
    url: string
    tags: HreflangTag[]
  }
}
