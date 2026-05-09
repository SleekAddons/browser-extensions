export interface TableInfo {
  index: number
  rows: number
  cols: number
  headerPreview: string[]
  firstRowPreview: string[]
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export type ExportFormat = 'json' | 'xml' | 'html' | 'csv' | 'xlsx'

export interface ExtractTablesRequest {
  type: 'EXTRACT_TABLES'
}

export interface GetTableDataRequest {
  type: 'GET_TABLE_DATA'
  tableIndex: number
}

export type ContentMessage = ExtractTablesRequest | GetTableDataRequest
