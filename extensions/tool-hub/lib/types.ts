/** Active search tab */
export type SearchTab = 'online' | 'bookmarks'

/** A single tool returned from the search API */
export interface Tool {
  name: string
  description: string
  url: string
}

/** Response shape from GET /api/tools/search */
export interface ToolSearchResponse {
  locale: string
  total: number
  tools: Tool[]
}
