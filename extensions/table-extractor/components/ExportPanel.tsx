import { useState } from 'react'
import { Button } from '@/components/ui/button'
import ContentCard from '@/components/ContentCard'
import OptionPicker from '@/components/OptionPicker'
import type { ExportFormat, TableData } from '../lib/types'
import { downloadExport, exportTable } from '../lib/exporters'
import { Download, Copy, Check } from 'lucide-react'

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'html', label: 'HTML' },
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'XLSX' },
]

interface ExportPanelProps {
  tableData: TableData | null
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
}

export default function ExportPanel(props: ExportPanelProps) {
  const { tableData, format, onFormatChange } = props
  const [copied, setCopied] = useState(false)
  const disabled = tableData === null

  const handleCopy = () => {
    if (!tableData) return
    const text = exportTable(tableData, format)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    if (!tableData) return
    downloadExport(tableData, format)
  }

  return (
    <ContentCard
      title="Export"
      description={disabled ? 'Select a table to enable export' : 'Choose a format and download or copy'}
    >
      <div className={`flex flex-col gap-3${disabled ? ' pointer-events-none opacity-40' : ''}`}>
        <OptionPicker
          options={FORMAT_OPTIONS}
          value={format}
          onChange={onFormatChange}
        />
        <div className="flex gap-2 border-t pt-3 -mx-4 px-4">
          <Button size="sm" disabled={disabled} onClick={handleDownload} className="flex-1">
            <Download size={14} /> Download .{format}
          </Button>
          <Button size="sm" variant="outline" disabled={disabled || format === 'xlsx'} onClick={handleCopy} className="flex-1">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
    </ContentCard>
  )
}
