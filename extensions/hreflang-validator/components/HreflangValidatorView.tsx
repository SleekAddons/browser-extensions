import { useEffect } from 'react'
import { Search, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import ScanButton from '@/components/ScanButton'
import SectionHeading from '@/components/SectionHeading'
import { useHreflangValidator } from '../lib/useHreflangValidator'
import type { ValidationIssue, HreflangTag } from '../lib/types'

function IssueRow(props: { issue: ValidationIssue }) {
  const { issue } = props
  return (
    <div className="flex items-start gap-2 border-b py-2 last:border-b-0">
      <span className="mt-0.5 shrink-0 text-amber-500">
        <AlertTriangle size={14} />
      </span>
      <div className="min-w-0 ">
        <div>{issue.message}</div>
        {issue.tag && (
          <code className="text-muted-foreground break-all">
            hreflang="{issue.tag.hreflang}" href="{issue.tag.href}"
          </code>
        )}
      </div>
    </div>
  )
}

function TagRow(props: { tag: HreflangTag; index: number; hasIssue: boolean }) {
  const { tag, index, hasIssue } = props
  return (
    <TableRow>
      <TableCell className="">{index + 1}</TableCell>
      <TableCell>
        <code className="">{tag.hreflang}</code>
      </TableCell>
      <TableCell className="max-w-[200px] break-all ">
        <a
          href={tag.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground no-underline hover:underline"
        >
          {tag.href} <ExternalLink size={10} className="ml-0.5 inline" />
        </a>
      </TableCell>
      <TableCell className="text-center">
        {hasIssue
          ? <AlertTriangle size={14} className="text-amber-500" />
          : <CheckCircle size={14} className="text-green-500" />
        }
      </TableCell>
    </TableRow>
  )
}

export default function HreflangValidatorView() {
  const { result, loading, error, validate } = useHreflangValidator()

  useEffect(() => {
    validate()
  }, [validate])

  const issueCount = result?.issues.length ?? 0
  const hasProblems = issueCount > 0
  const allGood = result && !hasProblems && result.tags.length > 0

  // Build a set of hreflang codes that have issues
  const problemCodes = new Set(
    result?.issues
      .filter((i) => i.tag)
      .map((i) => i.tag!.hreflang.toLowerCase()) ?? [],
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Scan button */}
      <ScanButton
        label="Scan Page"
        loadingLabel="Scanning…"
        icon={<Search size={14} />}
        loading={loading}
        onClick={validate}
      />

      {/* Status alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && result.tags.length === 0 && (
        <Alert>
          <AlertTriangle className="text-amber-500" />
          <AlertTitle>No Tags Found</AlertTitle>
          <AlertDescription>No hreflang tags found on this page.</AlertDescription>
        </Alert>
      )}
      {allGood && (
        <Alert>
          <CheckCircle className="text-green-500" />
          <AlertTitle>All Good</AlertTitle>
          <AlertDescription>All hreflang checks passed - no issues found.</AlertDescription>
        </Alert>
      )}
      {result && hasProblems && result.tags.length > 0 && (
        <Alert>
          <AlertTriangle className="text-amber-500" />
          <AlertTitle>Issues Found</AlertTitle>
          <AlertDescription>Found {issueCount} issue{issueCount !== 1 && 's'}.</AlertDescription>
        </Alert>
      )}

      {/* Issues */}
      {result && result.issues.length > 0 && (
        <div>
          <SectionHeading>Issues</SectionHeading>
          <div>
            {result.issues.map((issue, i) => (
              <IssueRow key={i} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Tags table */}
      {result && result.tags.length > 0 && (
        <>
          <Separator />

          <div>
            <SectionHeading>Hreflang Tags</SectionHeading>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.tags.map((tag, i) => (
                  <TagRow key={i} tag={tag} index={i} hasIssue={problemCodes.has(tag.hreflang.toLowerCase())} />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
