import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import ContentCard from '@/components/ContentCard'
import { useScrollable } from '@/lib/useScrollable'
import type { TableData } from '../lib/types'
import { t, tPlural } from '../lib/i18n'

interface DataPreviewProps {
  tableData: TableData | null
}

export default function DataPreview(props: DataPreviewProps) {
  const { tableData } = props
  const { ref: previewRef, needsPadding: previewPadding } = useScrollable<HTMLDivElement>()
  const disabled = tableData === null
  const totalRows = tableData?.rows.length ?? 0
  const totalCols = tableData?.headers.length ?? 0

  return (
    <ContentCard
      title={t('previewTitle')}
      description={disabled ? t('previewDisabledDescription') : t('previewDescription')}
    >
      {disabled ? (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          {t('noTableSelected')}
        </div>
      ) : (
        <div
          ref={previewRef}
          className={`max-h-50 overflow-hidden overflow-y-auto rounded-md border ${previewPadding ? 'pr-3' : ''}`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {tableData!.headers.map((h, i) => (
                  <TableHead key={i}>
                    {h || t('columnNumber', i + 1)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData!.rows.slice(0, 5).map((row, ri) => (
                <TableRow key={ri}>
                  {row.map((cell, ci) => (
                    <TableCell key={ci}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {totalRows > 5 && (
                <TableRow>
                  <TableCell
                    colSpan={totalCols}
                    className="text-center text-muted-foreground"
                  >
                    {tPlural('moreRows', totalRows - 5)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </ContentCard>
  )
}
