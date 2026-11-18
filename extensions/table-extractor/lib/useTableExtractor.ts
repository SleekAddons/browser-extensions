import { browser } from 'wxt/browser'
import { useCallback, useRef, useState } from 'react'
import type { ExportFormat, TableData, TableInfo } from './types'

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}

/**
 * Runs inside the page via scripting.executeScript, so it must be fully
 * self-contained (no imports or references to the outer scope).
 *
 * With `targetIndex === null` it summarizes every table on the page;
 * otherwise it returns the full contents of that table. Both modes share the
 * same table discovery and header/row logic, so previews, indices and the
 * extracted data always agree.
 */
function readTablesInPage(targetIndex: number | null): TableInfo[] | TableData | null {
  // innerText matches what the user sees: it skips hidden elements and keeps
  // <br>/block boundaries as line breaks, where textContent would glue
  // "Line 1<br>Line 2" into "Line 1Line 2".
  const cellText = (cell: HTMLTableCellElement) => cell.innerText.trim()

  const splitRows = (table: HTMLTableElement) => {
    const headerRow = table.tHead?.rows[0] ?? table.rows[0] ?? null
    // Read every <tbody>, not only the first one.
    const rows = table.tBodies.length > 0
      ? Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))
      : Array.from(table.rows)
    return { headerRow, bodyRows: rows.filter((row) => row !== headerRow) }
  }

  const tables = Array.from(document.querySelectorAll('table')).filter((t) => t.rows.length > 0)

  if (targetIndex === null) {
    return tables.map((table, index) => {
      const { headerRow, bodyRows } = splitRows(table)
      const headers = headerRow ? Array.from(headerRow.cells, cellText) : []
      const firstRow = bodyRows[0] ? Array.from(bodyRows[0].cells, cellText) : []
      return {
        index,
        rows: bodyRows.length,
        cols: bodyRows.reduce((max, row) => Math.max(max, row.cells.length), headers.length),
        headerPreview: headers.slice(0, 5),
        firstRowPreview: firstRow.slice(0, 5),
      }
    })
  }

  const table = tables[targetIndex]
  if (!table) return null
  const { headerRow, bodyRows } = splitRows(table)
  return {
    headers: headerRow ? Array.from(headerRow.cells, cellText) : [],
    rows: bodyRows.map((row) => Array.from(row.cells, cellText)),
  }
}

async function readTables<T>(tabId: number, targetIndex: number | null): Promise<T | null> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    func: readTablesInPage,
    args: [targetIndex],
  })
  return (results?.[0]?.result as T | undefined) ?? null
}

export function useTableExtractor() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [format, setFormat] = useState<ExportFormat>('json')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessBlocked, setAccessBlocked] = useState(false)

  // Only the latest scan / selection may update state, so a slow response
  // can't overwrite the result of a newer click.
  const scanRequest = useRef(0)
  const selectRequest = useRef(0)

  const scanTables = useCallback(async () => {
    const request = ++scanRequest.current
    selectRequest.current++
    setLoading(true)
    setError(null)
    setAccessBlocked(false)
    setTableData(null)
    setSelectedIndex(null)
    try {
      const tabId = await getActiveTabId()
      if (!tabId) {
        if (request === scanRequest.current) setError('No active tab found')
        return
      }
      const infos = await readTables<TableInfo[]>(tabId, null)
      if (request !== scanRequest.current) return
      if (Array.isArray(infos)) {
        setTables(infos)
      } else {
        setError('Could not scan the page for tables.')
      }
    } catch {
      if (request === scanRequest.current) setAccessBlocked(true)
    } finally {
      if (request === scanRequest.current) setLoading(false)
    }
  }, [])

  const selectTable = useCallback(async (index: number) => {
    const request = ++selectRequest.current
    setSelectedIndex(index)
    setError(null)
    try {
      const tabId = await getActiveTabId()
      if (!tabId) return
      const data = await readTables<TableData>(tabId, index)
      if (request !== selectRequest.current) return
      if (data) {
        setTableData(data)
      } else {
        setError('Could not extract table data')
      }
    } catch {
      if (request === selectRequest.current) setError('Could not extract table data')
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
