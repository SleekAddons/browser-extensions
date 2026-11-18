import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ExportFormat, TableData } from './types'

/**
 * Pads the header and every row to the widest row, so cells beyond the
 * header row (e.g. under a colspan header) are exported instead of dropped.
 */
function normalize(data: TableData): TableData {
  const width = data.rows.reduce((max, row) => Math.max(max, row.length), data.headers.length)
  const pad = (cells: string[]) =>
    cells.length >= width ? cells : [...cells, ...Array<string>(width - cells.length).fill('')]
  return { headers: pad(data.headers), rows: data.rows.map(pad) }
}

/**
 * Turns header labels into unique field names: empty labels become
 * `column_N` and repeated labels get a `_2`, `_3`… suffix, so no column can
 * overwrite another one.
 */
function uniqueKeys(headers: string[], toKey: (label: string) => string = (label) => label): string[] {
  const used = new Set<string>()
  return headers.map((header, i) => {
    const base = toKey(header.trim()) || `column_${i + 1}`
    let key = base
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`
    used.add(key)
    return key
  })
}

function toObjects(data: TableData): Record<string, string>[] {
  const { headers, rows } = normalize(data)
  const keys = uniqueKeys(headers)
  return rows.map((row) => Object.fromEntries(keys.map((key, i) => [key, row[i]])))
}

// Characters that are not allowed anywhere in an XML 1.0 document.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

function escapeMarkup(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Converts a header label into a valid XML element name, e.g.
 * "First Name" → "First_Name" and "2024" → "_2024".
 */
function toXmlName(label: string): string {
  const name = Array.from(label, (ch) =>
    /[\w.-]/.test(ch) || (ch.codePointAt(0)! >= 0xc0 && /[\p{L}\p{Nd}\p{M}]/u.test(ch)) ? ch : '_',
  )
    .join('')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
  if (!name) return ''
  // Names must start with a letter or "_" and must not start with "xml".
  return /^[\p{L}_]/u.test(name) && !/^xml/i.test(name) ? name : `_${name}`
}

export function toJson(data: TableData): string {
  return JSON.stringify(toObjects(data), null, 2)
}

export function toXml(data: TableData): string {
  const { headers, rows } = normalize(data)
  const names = uniqueKeys(headers, toXmlName)
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<table>']
  for (const row of rows) {
    lines.push('  <row>')
    names.forEach((name, i) => lines.push(`    <${name}>${escapeMarkup(row[i])}</${name}>`))
    lines.push('  </row>')
  }
  lines.push('</table>')
  return lines.join('\n')
}

export function toHtml(data: TableData): string {
  const { headers, rows } = normalize(data)
  const lines: string[] = ['<table>', '  <thead>', '    <tr>']
  for (const header of headers) {
    lines.push(`      <th>${escapeMarkup(header)}</th>`)
  }
  lines.push('    </tr>', '  </thead>', '  <tbody>')
  for (const row of rows) {
    lines.push('    <tr>')
    for (const cell of row) {
      lines.push(`      <td>${escapeMarkup(cell)}</td>`)
    }
    lines.push('    </tr>')
  }
  lines.push('  </tbody>', '</table>')
  return lines.join('\n')
}

export function toCsv(data: TableData): string {
  const { headers, rows } = normalize(data)
  // Pass the fields explicitly: going through objects would move numeric
  // headers such as "2024" in front of the other columns.
  return Papa.unparse({ fields: uniqueKeys(headers), data: rows })
}

export function toXlsx(data: TableData): Uint8Array {
  const { headers, rows } = normalize(data)
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
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
  const content = format === 'xlsx' ? toXlsx(data) : exportTable(data, format)
  const url = URL.createObjectURL(new Blob([content], { type: getMimeType(format) }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `table-export.${format}`
  // Firefox needs the link in the document, and revoking the object URL
  // right after click() can cancel the download before it has started.
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
