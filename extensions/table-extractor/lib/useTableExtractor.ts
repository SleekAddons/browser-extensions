import { browser } from 'wxt/browser'
import { useCallback, useState } from 'react'
import type { ExportFormat, TableData, TableInfo } from './types'

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}

function scanTablesInPage(): TableInfo[] {
  const tables = Array.from(document.querySelectorAll('table')).filter(
    (t) => t.rows.length > 0,
  )
  return tables.map((table, index) => {
    const getCellText = (cell: HTMLTableCellElement) => (cell.textContent ?? '').trim()
    const headerRow = (table.querySelector('thead tr') as HTMLTableRowElement | null) ?? table.rows[0]
    const headers = headerRow ? Array.from(headerRow.cells).map(getCellText) : []
    const allRows = table.querySelector('tbody')
      ? Array.from(table.tBodies[0].rows)
      : Array.from(table.rows)
    const bodyRows = allRows.filter((row) => row !== headerRow)
    const firstRow = bodyRows[0] ? Array.from(bodyRows[0].cells).map(getCellText) : []
    return {
      index,
      rows: bodyRows.length,
      cols: headers.length || firstRow.length,
      headerPreview: headers.slice(0, 5),
      firstRowPreview: firstRow.slice(0, 5),
    }
  })
}

function extractTableInPage(tableIndex: number): TableData | null {
  const tables = Array.from(document.querySelectorAll('table')).filter(
    (t) => t.rows.length > 0,
  )
  const table = tables[tableIndex]
  if (!table) return null

  const getCellText = (cell: HTMLTableCellElement) => (cell.textContent ?? '').trim()
  const headerRow = (table.querySelector('thead tr') as HTMLTableRowElement | null) ?? table.rows[0]
  const headers = headerRow ? Array.from(headerRow.cells).map(getCellText) : []
  const allRows = table.querySelector('tbody')
    ? Array.from(table.tBodies[0].rows)
    : Array.from(table.rows)
  const bodyRows = allRows.filter((row) => row !== headerRow)
  const rows = bodyRows.map((row) => Array.from(row.cells).map(getCellText))
  return { headers, rows }
}

export function useTableExtractor() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [format, setFormat] = useState<ExportFormat>('json')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessBlocked, setAccessBlocked] = useState(false)

  const scanTables = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAccessBlocked(false)
    setTableData(null)
    setSelectedIndex(null)
    try {
      const tabId = await getActiveTabId()
      if (!tabId) {
        setError('No active tab found')
        return
      }
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: scanTablesInPage,
      })
      const infos = results?.[0]?.result
      if (Array.isArray(infos)) {
        setTables(infos)
      } else {
        setError('Could not scan the page for tables.')
      }
    } catch {
      setAccessBlocked(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const selectTable = useCallback(async (index: number) => {
    setSelectedIndex(index)
    setError(null)
    try {
      const tabId = await getActiveTabId()
      if (!tabId) return
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: extractTableInPage,
        args: [index],
      })
      const data = results?.[0]?.result
      if (data) {
        setTableData(data)
      } else {
        setError('Could not extract table data')
      }
    } catch {
      setError('Could not extract table data')
    }
  }, [])

  return {
    tables,
    selectedIndex,
    tableData,
    format,
    setFormat,
    loading,
    error,
    accessBlocked,
    scanTables,
    selectTable,
  }
}
