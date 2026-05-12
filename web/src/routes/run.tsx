import { Link, createFileRoute } from '@tanstack/react-router'
import { Heading, Stack, Text, TextInput, Truncate } from '@primer/react'
import type { ReactNode } from 'react'
import { useMemo, useState, useCallback } from 'react'
import { Check, X, Clock, Search, Download, ChevronRight, Tag, Terminal, AlertTriangle } from 'lucide-react'
import { runDuration, runStatus, useHistoryRuns, type RunCheck, type RunItem, type RunRecord } from '../lib/history'
import { cn, formatDayLabel, relativeTime } from '../lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Badge } from '../components/ui/badge'

import { PDFDownloadLink } from '@react-pdf/renderer'
import { ReportPdfDocument } from '../components/report-pdf'

export const Route = createFileRoute('/run')({
  validateSearch: (search) => ({
    run:
      typeof search.run === 'string'
        ? search.run
        : typeof search.run === 'number'
          ? String(search.run)
          : '',
    sha: typeof search.sha === 'string' ? search.sha : '',
  }),
  component: RunsPage,
})

function RunsPage() {
  const { runs, loading, error } = useHistoryRuns()
  const search = Route.useSearch()

  if (loading) return <InfoState>Loading history...</InfoState>
  if (error) return <InfoState>Failed to load history: {error}</InfoState>
  if (!runs.length) return <InfoState>No runs available yet.</InfoState>

  if (search.run) {
    const run = runs.find((r) => {
      if (r.run_id !== search.run) return false
      if (!search.sha) return true
      return (r.sha_full || r.sha) === search.sha
    })
    if (run) return <ReportPage run={run} allRuns={runs} />
  }

  return <RunListPage runs={runs} />
}

function InfoState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

type TestHistoryEntry = {
  status: string
  duration_s: number
  timestamp: string
  runId: string
}

type TestHistoryMap = Map<string, TestHistoryEntry[]>

function buildTestHistory(allRuns: RunRecord[], currentRunId: string): TestHistoryMap {
  const map: TestHistoryMap = new Map()
  for (const run of allRuns) {
    for (const check of run.checks || []) {
      for (const item of check.items || []) {
        const key = `${check.tool}::${item.id}`
        let entries = map.get(key)
        if (!entries) {
          entries = []
          map.set(key, entries)
        }
        entries.push({
          status: item.status,
          duration_s: item.duration_s ?? 0,
          timestamp: run.timestamp,
          runId: run.run_id,
        })
      }
    }
  }
  return map
}

function ReportPage({ run, allRuns }: { run: RunRecord; allRuns: RunRecord[] }) {
  const status = runStatus(run)
  const checks = run.checks || []
  const [filter, setFilter] = useState('')

  const testHistory = useMemo(() => buildTestHistory(allRuns, run.run_id), [allRuns, run.run_id])

  const filteredChecks = useMemo(() => {
    if (!filter.trim()) return checks
    const term = filter.toLowerCase()
    return checks
      .map((check) => ({
        ...check,
        items: (check.items || []).filter(
          (item) =>
            item.id.toLowerCase().includes(term) ||
            (item.message || '').toLowerCase().includes(term)
        ),
      }))
      .filter((check) => (check.items || []).length > 0)
  }, [checks, filter])

  const counts = useMemo(() => {
    let passed = 0, failed = 0, skipped = 0
    for (const check of filteredChecks) {
      for (const item of check.items || []) {
        const s = (item.status || '').toLowerCase()
        if (s === 'passed') passed++
        else if (s === 'failed' || s === 'error') failed++
        else if (s === 'skipped') skipped++
      }
    }
    return { passed, failed, skipped, total: passed + failed + skipped }
  }, [filteredChecks])

  const metadata = useMemo(() => {
    const env = run.metadata?.environment
    const actor = run.metadata?.actor
    const repro = run.metadata?.reproducibility
    const cov = run.metadata?.coverage?.overall

    const toolVersions = repro?.tool_versions
      ? Object.entries(repro.tool_versions).map(([k, v]) => `${k}: ${v}`).join(', ')
      : null

    const matrix = run.matrix
      ? Object.entries(run.matrix).map(([k, v]) => `${k}: ${v}`).join(', ')
      : null

    const coverage = cov
      ? {
          line: `${cov.line?.percent?.toFixed(1) || 0}% (${cov.line?.covered}/${cov.line?.total})`,
          branch: cov.branch ? `${cov.branch.percent?.toFixed(1) || 0}% (${cov.branch.covered}/${cov.branch.total})` : null,
          function: cov.function ? `${cov.function.percent?.toFixed(1) || 0}% (${cov.function.covered}/${cov.function.total})` : null,
        }
      : null

    return {
      pr: run.pr,
      branch: run.branch,
      sha: run.sha?.slice(0, 7),
      shaFull: run.sha_full,
      timestamp: new Date(run.timestamp).toLocaleString(),
      duration: runDuration(run).toFixed(2) + 's',
      status,
      triggeredBy: actor?.login || actor?.triggering_login || null,
      provider: env?.provider || null,
      runnerOs: env?.runner_os || null,
      repository: env?.repository || null,
      workflow: env?.workflow || null,
      matrix,
      toolVersions,
      coverage,
    }
  }, [run])

  const pdfFilename = `cairn-report-${run.run_id}.pdf`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading as="h1" sx={{ fontSize: 3 }}>
              Test Report
            </Heading>
            <StatusBadge status={status} />
          </div>
          <Text as="p" sx={{ color: 'fg.muted', fontFamily: 'mono', fontSize: 1 }}>
            {run.run_id}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <PDFDownloadLink
            document={<ReportPdfDocument run={run} />}
            fileName={pdfFilename}
            className="primer-pdf-link no-print"
          >
            {({ loading }) => (
              <>
                <Download className="size-4" />
                {loading ? 'Generating...' : 'PDF'}
              </>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <MetadataGrid>
        <MetadataCell label="Total" value={String(counts.total)} />
        <MetadataCell label="Passed" value={String(counts.passed)} valueClassName="text-success" />
        <MetadataCell label="Failed" value={String(counts.failed)} valueClassName="text-destructive" />
        <MetadataCell label="Skipped" value={String(counts.skipped)} valueClassName="text-warning" />
        <MetadataCell label="Branch" value={metadata.branch || '-'} />
        <MetadataCell label="Duration" value={metadata.duration} />
        {metadata.pr && <MetadataCell label="PR" value={`#${metadata.pr}`} />}
        <MetadataCell label="Date" value={metadata.timestamp} />
        {metadata.shaFull && <MetadataCell label="Commit" value={metadata.shaFull} mono truncate />}
        {metadata.repository && <MetadataCell label="Repository" value={metadata.repository} />}
        {metadata.workflow && <MetadataCell label="Workflow" value={metadata.workflow} />}
        {metadata.triggeredBy && <MetadataCell label="Triggered By" value={metadata.triggeredBy} />}
        {metadata.provider && <MetadataCell label="CI Provider" value={metadata.provider} />}
        {metadata.runnerOs && <MetadataCell label="Runner" value={metadata.runnerOs} />}
        {metadata.matrix && <MetadataCell label="Matrix" value={metadata.matrix} />}
        {metadata.toolVersions && <MetadataCell label="Tools" value={metadata.toolVersions} />}
        {metadata.coverage?.line && <MetadataCell label="Line Coverage" value={metadata.coverage.line} />}
        {metadata.coverage?.branch && <MetadataCell label="Branch Coverage" value={metadata.coverage.branch} />}
        {metadata.coverage?.function && <MetadataCell label="Function Coverage" value={metadata.coverage.function} />}
      </MetadataGrid>

      <div className="border-t border-[var(--borderColor-default,#d0d7de)] pt-4">
        <TextInput
          aria-label="Filter tests"
          block
          leadingVisual={Search}
          placeholder="Filter tests..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filteredChecks.map((check) => (
        <CheckReportSection key={check.tool} check={check} testHistory={testHistory} />
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  if (s === 'passed') {
    return (
      <Badge variant="success" className="inline-flex items-center gap-1.5">
        <Check className="size-3.5" strokeWidth={2.5} />
        Passed
      </Badge>
    )
  }
  if (s === 'failed' || s === 'error') {
    return (
      <Badge variant="destructive" className="inline-flex items-center gap-1.5">
        <X className="size-3.5" strokeWidth={2.5} />
        {s === 'error' ? 'Error' : 'Failed'}
      </Badge>
    )
  }
  if (s === 'skipped') {
    return (
      <Badge variant="warning" className="inline-flex items-center gap-1.5">
        <Clock className="size-3.5" strokeWidth={2.5} />
        Skipped
      </Badge>
    )
  }
  return <Badge variant="secondary">{status}</Badge>
}

function CheckReportSection({ check, testHistory }: { check: RunCheck; testHistory: TestHistoryMap }) {
  const items = check.items || []
  const passedCount = items.filter(i => (i.status || '').toLowerCase() === 'passed').length
  const failedCount = items.filter(i => ['failed', 'error'].includes((i.status || '').toLowerCase())).length
  const skippedCount = items.filter(i => (i.status || '').toLowerCase() === 'skipped').length
  const durationLabel =
    typeof check.duration_s === 'number' ? ` (${check.duration_s.toFixed(3)}s)` : ''
  const grouped = groupCheckItems(check.tool, items)
  const showGrouped = grouped.length > 1
  const hasItems = items.length > 0

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const toggleItem = useCallback((key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const displayItems = showGrouped ? grouped.flatMap(g => g.items) : items

  if (!hasItems) {
    return (
      <section className="space-y-3">
        <div>
          <Heading as="h2" sx={{ fontSize: 2 }}>
            {check.tool}
          </Heading>
          <Text as="p" sx={{ color: 'fg.muted', fontSize: 1 }}>
            No issues{durationLabel}
          </Text>
        </div>
        <div className="rounded-md border border-[var(--borderColor-default,#d0d7de)] bg-[var(--bgColor-default,#ffffff)] px-4 py-3">
          <Text sx={{ color: 'fg.muted', fontSize: 1 }}>No issues found</Text>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <Heading as="h2" sx={{ fontSize: 2 }}>
          {check.tool}
        </Heading>
      <Text as="p" sx={{ color: 'fg.muted', fontSize: 1 }}>
        {hasItems 
          ? `${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped${durationLabel}`
          : `No issues${durationLabel}`
        }
      </Text>
      </div>

      <div className="overflow-x-auto report-check-table">
        <Table gridTemplateColumns="40px 120px minmax(0, 1.6fr) 96px minmax(0, 1fr)">
          <TableHeader>
            <TableRow>
              <TableHead aria-label="Expand" />
              <TableHead>Status</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item, idx) => {
              const itemKey = `${item.id}-${idx}`
              const isExpanded = expandedItems.has(itemKey)
              const s = (item.status || '').toLowerCase()
              const isPassed = s === 'passed'
              const isFailed = s === 'failed' || s === 'error'
              const isSkipped = s === 'skipped'
              const hasDetails = true
              const history = testHistory.get(`${check.tool}::${item.id}`)
              return (
                <ItemRow
                  key={itemKey}
                  item={item}
                  itemKey={itemKey}
                  isExpanded={isExpanded}
                  isPassed={isPassed}
                  isFailed={isFailed}
                  isSkipped={isSkipped}
                  hasDetails={hasDetails}
                  statusLabel={s}
                  onToggle={toggleItem}
                  history={history}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function ItemRow({
  item,
  itemKey,
  isExpanded,
  isPassed,
  isFailed,
  isSkipped,
  hasDetails,
  statusLabel,
  onToggle,
  history,
}: {
  item: RunItem
  itemKey: string
  isExpanded: boolean
  isPassed: boolean
  isFailed: boolean
  isSkipped: boolean
  hasDetails: boolean
  statusLabel: string
  onToggle: (key: string) => void
  history?: TestHistoryEntry[]
}) {
  return (
    <>
      <TableRow
        className={cn(
          hasDetails && 'cursor-pointer hover:bg-accent/50',
          isExpanded && 'bg-accent/30',
        )}
        onClick={() => hasDetails && onToggle(itemKey)}
      >
        <TableCell className="flex items-center justify-center">
          {hasDetails && (
            <ChevronRight
              className={cn(
                'size-4 shrink-0 text-[var(--fgColor-muted,#57606a)] transition-transform duration-150',
                isExpanded && 'rotate-90',
              )}
            />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center">
            {isPassed && (
              <Badge variant="success" className="inline-flex items-center gap-1">
                <Check className="size-3" strokeWidth={2.5} />
                Passed
              </Badge>
            )}
            {isFailed && (
              <Badge variant="destructive" className="inline-flex items-center gap-1">
                <X className="size-3" strokeWidth={2.5} />
                Failed
              </Badge>
            )}
            {isSkipped && (
              <Badge variant="warning" className="inline-flex items-center gap-1">
                <Clock className="size-3" strokeWidth={2.5} />
                Skipped
              </Badge>
            )}
            {!isPassed && !isFailed && !isSkipped && <span className="text-muted-foreground">{statusLabel}</span>}
          </div>
        </TableCell>
        <TableCell className="font-mono text-foreground">{item.id}</TableCell>
        <TableCell className="font-mono text-muted-foreground">
          {item.duration_s != null ? `${(item.duration_s * 1000).toFixed(1)}ms` : '-'}
        </TableCell>
        <TableCell className="max-w-md truncate text-muted-foreground">{item.message || '-'}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow
          className="report-item-detail-row"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}
        >
          <div
            role="cell"
            className="report-item-detail-cell"
            style={{ gridColumn: '1' }}
          >
            <ItemDetailPanel item={item} history={history} />
          </div>
        </TableRow>
      )}
    </>
  )
}

function ItemDetailPanel({ item, history }: { item: RunItem; history?: TestHistoryEntry[] }) {
  const sourceLabel = item.source
    ? [
        item.source.file,
        item.source.line ? `L${item.source.line}` : null,
        item.source.column ? `C${item.source.column}` : null,
      ]
        .filter(Boolean)
        .join(':')
    : null

  const historyStats = useMemo(() => {
    if (!history || history.length === 0) return null
    const total = history.length
    const passed = history.filter(h => h.status === 'passed').length
    const failed = history.filter(h => ['failed', 'error'].includes(h.status)).length
    const skipped = history.filter(h => h.status === 'skipped').length
    const durations = history.filter(h => h.duration_s > 0).map(h => h.duration_s)
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    const passRate = total > 0 ? (passed / total) * 100 : 0
    const recent = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return { total, passed, failed, skipped, avgDuration, passRate, recent }
  }, [history])

  return (
    <div className="border-x border-b border-[var(--borderColor-default,#d0d7de)] bg-[var(--bgColor-muted,#f6f8fa)]">
      <div className="grid grid-cols-[40px_120px_minmax(0,1.6fr)_96px_minmax(0,1fr)] gap-0 py-3">
        <span aria-hidden="true" />
        <DetailField label="Status" value={item.status} />
        <DetailField label="Test ID" value={item.id} mono />
        <DetailField
          label="Duration"
          value={item.duration_s != null ? formatDuration(item.duration_s) : '-'}
        />
        {item.suite && <DetailField label="Suite" value={item.suite} mono />}
        {sourceLabel && <DetailField label="Source" value={sourceLabel} mono />}
        {item.tags && item.tags.length > 0 && (
          <div className="px-3">
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Tag className="size-3" />
              Tags
            </p>
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {historyStats && (
        <section>
          <div className="grid grid-cols-[40px_120px_minmax(0,1.6fr)_96px_minmax(0,1fr)] items-center border-t border-[var(--borderColor-default,#d0d7de)] py-2">
            <span aria-hidden="true" />
            <div className="flex items-center gap-2 px-3">
              <Text as="h3" sx={{ fontSize: 1, fontWeight: 600 }}>
                History
              </Text>
              <Badge variant="outline">{historyStats.total} runs</Badge>
            </div>
            <Text as="p" sx={{ color: 'fg.muted', fontSize: 0, gridColumn: '3 / -1', textAlign: 'right', paddingInline: 12 }}>
              {historyStats.passRate.toFixed(0)}% pass rate · {historyStats.passed} passed · {historyStats.failed} failed · {historyStats.skipped} skipped · avg {formatDuration(historyStats.avgDuration)}
            </Text>
          </div>
          <div className="max-h-72 overflow-y-auto border-y border-[var(--borderColor-default,#d0d7de)] bg-[var(--bgColor-default,#ffffff)]">
            {historyStats.recent.map((entry) => (
              <a
                key={`${entry.runId}-${entry.timestamp}`}
                href={`/#/run?run=${encodeURIComponent(entry.runId)}`}
                className="grid grid-cols-[40px_120px_minmax(0,1.6fr)_96px_minmax(0,1fr)] items-center gap-0 border-t border-[var(--borderColor-default,#d0d7de)] py-1.5 text-[var(--fgColor-default,#24292f)] no-underline first:border-t-0 hover:bg-[var(--control-transparent-bgColor-hover,#f6f8fa)]"
              >
                <span aria-hidden="true" />
                <span className="justify-self-start px-3">
                  <StatusBadge status={entry.status} />
                </span>
                <span className="min-w-0 px-3">
                  <span className="truncate font-mono text-sm">{entry.runId}</span>
                  <span className="ml-3 truncate text-xs text-[var(--fgColor-muted,#57606a)]">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </span>
                <span className="px-3 text-right font-mono text-xs text-[var(--fgColor-muted,#57606a)]">
                  {formatDuration(entry.duration_s)}
                </span>
                <span aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      )}

      {item.message && (
        <div className="px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            Message
          </p>
          <pre className="rounded-lg bg-card border border-border p-3 text-sm font-mono text-foreground whitespace-pre-wrap break-words overflow-x-auto max-h-60 overflow-y-auto">
            {item.message}
          </pre>
        </div>
      )}

      {item.trace && (
        <div className="px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            Stack Trace
          </p>
          <pre className="rounded-lg bg-destructive-muted border border-destructive/20 p-3 text-sm font-mono text-destructive-foreground whitespace-pre-wrap break-words overflow-x-auto max-h-80 overflow-y-auto">
            {item.trace}
          </pre>
        </div>
      )}

      {item.stdout && (
        <div className="px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Terminal className="size-3" />
            Standard Output
          </p>
          <pre className="rounded-lg bg-card border border-border p-3 text-sm font-mono text-foreground whitespace-pre-wrap break-words overflow-x-auto max-h-60 overflow-y-auto">
            {item.stdout}
          </pre>
        </div>
      )}

      {item.stderr && (
        <div className="px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Terminal className="size-3" />
            Standard Error
          </p>
          <pre className="rounded-lg bg-destructive-muted border border-destructive/20 p-3 text-sm font-mono text-destructive-foreground whitespace-pre-wrap break-words overflow-x-auto max-h-60 overflow-y-auto">
            {item.stderr}
          </pre>
        </div>
      )}
    </div>
  )
}

function MetadataGrid({ children }: { children: ReactNode }) {
  const childArray = useMemo(() => {
    const arr: ReactNode[] = []
    const flatten = (node: ReactNode) => {
      if (Array.isArray(node)) {
        node.forEach(flatten)
      } else if (node != null && node !== false && node !== true) {
        arr.push(node)
      }
    }
    flatten(children)
    return arr
  }, [children])

  return (
    <Stack
      as="dl"
      direction="horizontal"
      gap="normal"
      wrap="wrap"
      paddingBlock="condensed"
      className="metadata-summary"
    >
      {childArray}
    </Stack>
  )
}

function MetadataCell({ label, value, mono, truncate: shouldTruncate, valueClassName }: { label: string; value: string; mono?: boolean; truncate?: boolean; valueClassName?: string }) {
  return (
    <div className="metadata-summary-item">
      <Text as="dt" sx={{ color: 'fg.subtle', fontSize: 0, fontWeight: 500, lineHeight: '16px' }}>
        {label}
      </Text>
      <Text
        as="dd"
        className={cn(
          'metadata-summary-value',
          mono && 'font-mono',
          shouldTruncate && 'metadata-summary-value-truncate',
          valueClassName,
        )}
        sx={{ color: 'fg.default', fontSize: 1, lineHeight: '20px', margin: 0 }}
      >
        {shouldTruncate ? (
          <Truncate
            inline
            maxWidth="100%"
            title={value}
            className={cn('metadata-summary-truncate', mono && 'font-mono')}
          >
            {value}
          </Truncate>
        ) : (
          <span
            className={cn(
              'metadata-summary-value-text',
              mono && 'font-mono',
            )}
          >
            {value}
          </span>
        )}
      </Text>
    </div>
  )
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 px-3">
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className={cn('text-sm text-foreground', mono && 'font-mono break-all')}>{value}</p>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1_000_000).toFixed(0)}µs`
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)}ms`
  if (seconds < 60) return `${seconds.toFixed(2)}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs.toFixed(1)}s`
}

function groupCheckItems(tool: string, items: RunCheck['items']) {
  const allItems = items || []
  const groups = new Map<string, typeof allItems>()

  for (const item of allItems) {
    const key = resolveItemGroupKey(tool, item.id)
    const list = groups.get(key) || []
    list.push(item)
    groups.set(key, list)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, groupItems]) => {
      const passed = groupItems.filter((i) => (i.status || '').toLowerCase() === 'passed').length
      const failed = groupItems.filter((i) => ['failed', 'error'].includes((i.status || '').toLowerCase())).length
      const skipped = groupItems.filter((i) => (i.status || '').toLowerCase() === 'skipped').length
      return { name, items: groupItems, passed, failed, skipped }
    })
}

function resolveItemGroupKey(tool: string, itemId: string): string {
  if (!itemId) return '(unscoped)'
  if (tool.toLowerCase() === 'pytest') {
    const split = itemId.split('::')
    if (split.length > 1) return split[0]
  }
  const slash = itemId.lastIndexOf('/')
  if (slash > 0) return itemId.slice(0, slash)
  return '(misc)'
}

const checkerColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
]

function checkerColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return checkerColors[Math.abs(hash) % checkerColors.length]
}

function groupByDate(runs: RunRecord[]): Map<string, RunRecord[]> {
  const groups = new Map<string, RunRecord[]>()
  for (const run of runs) {
    const day = run.timestamp.split('T')[0]
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(run)
  }
  return groups
}

function RunListPage({ runs }: { runs: RunRecord[] }) {
  const grouped = groupByDate(runs)

  return (
    <div className="py-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Run Timeline</h1>
        <p className="text-sm text-muted-foreground mt-1">{runs.length} runs</p>
      </div>

      <div className="ml-2 border-l-2 border-border sm:ml-4">
        {Array.from(grouped.entries()).map(([dateStr, dayRuns]) => (
          <div key={dateStr}>
            <div className="relative flex items-center -ml-3 mb-4 mt-6 first:mt-0">
              <span className="w-4 h-4 rounded-full bg-border border-2 border-background flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                {formatDayLabel(dateStr)}
              </span>
            </div>

            {dayRuns.map((run, i) => {
              const status = runStatus(run)
              return (
                <div key={`${run.run_id}-${run.timestamp}-${i}`} className="pl-8 relative mb-4">
                  <span className={cn(
                    'absolute left-[-5px] top-2 w-2 h-2 rounded-full',
                    status === 'passed' ? 'bg-success' :
                    status === 'failed' || status === 'error' ? 'bg-destructive' :
                    status === 'skipped' ? 'bg-warning' : 'bg-muted-foreground',
                  )} />
                  <Link
                    to="/run"
                    search={{ run: String(run.run_id) }}
                    href={`/#/run?run=${encodeURIComponent(String(run.run_id))}`}
                    className="block rounded-lg border border-border bg-card p-3 hover:border-input hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <StatusBadgeInline status={status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{run.run_id}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(run.checks || []).map((check) => (
                            <span key={check.tool} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${checkerColor(check.tool)}`}>
                              {check.tool}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {run.branch || 'no branch'} · {run.checks?.length ?? 0} checks · {runDuration(run).toFixed(1)}s · {relativeTime(run.timestamp)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadgeInline({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  if (s === 'passed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success-foreground">
        <Check className="size-3" strokeWidth={2.5} />
        Passed
      </span>
    )
  }
  if (s === 'failed' || s === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive-muted px-2 py-0.5 text-xs font-medium text-destructive">
        <X className="size-3" strokeWidth={2.5} />
        {s === 'error' ? 'Error' : 'Failed'}
      </span>
    )
  }
  if (s === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning-foreground">
        <Clock className="size-3" strokeWidth={2.5} />
        Skipped
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{status}</span>
}
