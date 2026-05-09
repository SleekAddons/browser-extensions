import { XMLBuilder } from 'fast-xml-parser'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ExportFormat, TableData } from './types'

function toObjects(data: TableData): Record<string, string>[] {
  return data.rows.map((row) => {
    const obj: Record<string, string> = {}
    data.headers.forEach((header, i) => {
      obj[header || `column_${i + 1}`] = row[i] ?? ''
    })
    return obj
  })
}

export function toJson(data: TableData): string {
  return JSON.stringify(toObjects(data), null, 2)
}

export function toXml(data: TableData): string {
  const builder = new XMLBuilder({
    format: true,
    indentBy: '  ',
    arrayNodeName: 'row',
  })
  return builder.build({ table: { row: toObjects(data) } })
}

export function toHtml(data: TableData): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines: string[] = ['<table>', '  <thead>', '    <tr>']
  for (const header of data.headers) {
    lines.push(`      <th>${escape(header)}</th>`)
  }
  lines.push('    </tr>', '  </thead>', '  <tbody>')
  for (const row of data.rows) {
    lines.push('    <tr>')
    for (const cell of row) {
      lines.push(`      <td>${escape(cell)}</td>`)
    }
    lines.push('    </tr>')
  }
  lines.push('  </tbody>', '</table>')
  return lines.join('\n')
}

export function toCsv(data: TableData): string {
  return Papa.unparse(toObjects(data))
}

export function toXlsx(data: TableData): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Uint8Array(out)
}

export function exportTable(data: TableData, format: ExportFormat): string {
  switch (format) {
    case 'json': return toJson(data)
    case 'xml': return toXml(data)
    case 'html': return toHtml(data)
    case 'csv': return toCsv(data)
    case 'xlsx': return '' // binary format – use toXlsx() instead
  }
}

export function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'json': return 'application/json'
    case 'xml': return 'application/xml'
    case 'html': return 'text/html'
    case 'csv': return 'text/csv'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
}

export function downloadExport(data: TableData, format: ExportFormat, filename?: string) {
  if (format === 'xlsx') {
    const bytes = toXlsx(data)
    const blob = new Blob([bytes], { type: getMimeType(format) })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? 'table-export.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  const content = exportTable(data, format)
  const blob = new Blob([content], { type: getMimeType(format) })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `table-export.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
