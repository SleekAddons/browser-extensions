import { useEffect } from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import ContentCard from '@/components/ContentCard'
import { useTableExtractor } from '../lib/useTableExtractor'
import { RefreshCw } from 'lucide-react'
import TableList from './TableList'
import ExportPanel from './ExportPanel'
import DataPreview from './DataPreview'

export default function TableExtractorView() {
  const {
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
  } = useTableExtractor()

  useEffect(() => {
    scanTables()
  }, [scanTables])

  return (
    <div className="flex flex-col gap-3">
      {accessBlocked && (
        <ContentCard
          title="Cannot access this page"
          description="This extension only works on regular web pages."
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}

      {/* Table list with rescan action - only shown when not access blocked */}
      {!accessBlocked && (
        <TableList
          tables={tables}
          selectedIndex={selectedIndex}
          onSelect={selectTable}
          action={
            <Button variant="ghost" size="icon-sm" disabled={loading} onClick={scanTables}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          }
        />
      )}

      {/* Export & preview - always rendered; disabled when no table selected */}
      <ExportPanel
        tableData={tableData ?? null}
        format={format}
        onFormatChange={accessBlocked ? () => {} : setFormat}
      />
      <DataPreview tableData={tableData ?? null} />
    </div>
  )
}
