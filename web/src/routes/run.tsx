import { Link, createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Check, X, Clock } from 'lucide-react'
import { runDuration, runStatus, useHistoryRuns, type RunCheck, type RunRecord } from '../lib/history'
import { cn, formatDayLabel, relativeTime } from '../lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'

export const Route = createFileRoute('/run')({
  validateSearch: (search) => ({
    run: typeof search.run === 'string' ? search.run : '',
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
    if (run) return <ReportPage run={run} />
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

function ReportPage({ run }: { run: RunRecord }) {
  const status = runStatus(run)
  const checks = run.checks || []

  const counts = useMemo(() => {
    let passed = 0, failed = 0, skipped = 0
    for (const check of checks) {
      for (const item of check.items || []) {
        const s = (item.status || '').toLowerCase()
        if (s === 'passed') passed++
        else if (s === 'failed' || s === 'error') failed++
        else if (s === 'skipped') skipped++
      }
    }
    return { passed, failed, skipped, total: passed + failed + skipped }
  }, [checks])

  return (
    <div className="py-4">
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold text-foreground">Test Report</h1>
        <p className="text-muted-foreground">{run.run_id}</p>
      </div>

      <div className="overflow-hidden rounded-[26px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Field</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="w-32 font-medium text-muted-foreground">Branch</TableCell>
              <TableCell className="text-foreground">{run.branch || '-'}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Commit</TableCell>
              <TableCell className="font-mono text-foreground">{run.sha?.slice(0, 7) || '-'}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Date</TableCell>
              <TableCell className="text-foreground">{new Date(run.timestamp).toLocaleDateString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Duration</TableCell>
              <TableCell className="text-foreground">{runDuration(run).toFixed(2)}s</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Status</TableCell>
              <TableCell>
                <StatusBadge status={status} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Summary</h2>
        <div className="overflow-hidden rounded-[26px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold text-foreground">Total</TableHead>
                <TableHead className="font-semibold text-foreground">Passed</TableHead>
                <TableHead className="font-semibold text-foreground">Failed</TableHead>
                <TableHead className="font-semibold text-foreground">Skipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-foreground">{counts.total}</TableCell>
                <TableCell className="font-medium text-success">{counts.passed}</TableCell>
                <TableCell className="font-medium text-destructive">{counts.failed}</TableCell>
                <TableCell className="font-medium text-warning">{counts.skipped}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {checks.map((check) => (
        <CheckReportSection key={check.tool} check={check} />
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  if (s === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-3 py-1 text-sm font-medium text-success-foreground">
        <Check className="size-3.5" strokeWidth={2.5} />
        Passed
      </span>
    )
  }
  if (s === 'failed' || s === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive-muted px-3 py-1 text-sm font-medium text-destructive">
        <X className="size-3.5" strokeWidth={2.5} />
        {s === 'error' ? 'Error' : 'Failed'}
      </span>
    )
  }
  if (s === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-muted px-3 py-1 text-sm font-medium text-warning-foreground">
        <Clock className="size-3.5" strokeWidth={2.5} />
        Skipped
      </span>
    )
  }
  return <span className="text-muted-foreground">{status}</span>
}

function CheckReportSection({ check }: { check: RunCheck }) {
  const items = check.items || []
  const passedCount = items.filter(i => (i.status || '').toLowerCase() === 'passed').length
  const failedCount = items.filter(i => ['failed', 'error'].includes((i.status || '').toLowerCase())).length
  const skippedCount = items.filter(i => (i.status || '').toLowerCase() === 'skipped').length
  const durationLabel =
    typeof check.duration_s === 'number' ? ` (${check.duration_s.toFixed(3)}s)` : ''

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-foreground mb-2">{check.tool}</h2>
      <p className="text-sm text-muted-foreground mb-3">
        {passedCount} passed, {failedCount} failed, {skippedCount} skipped{durationLabel}
      </p>

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-[26px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Test</TableHead>
                <TableHead className="w-24 font-semibold text-foreground">Duration</TableHead>
                <TableHead className="font-semibold text-foreground">Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => {
                const s = (item.status || '').toLowerCase()
                const isPassed = s === 'passed'
                const isFailed = s === 'failed' || s === 'error'
                const isSkipped = s === 'skipped'

                return (
                  <TableRow key={idx}>
                    <TableCell>
                      {isPassed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success-foreground">
                          <Check className="size-3" strokeWidth={2.5} />
                          Pass
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive-muted px-2 py-0.5 text-xs font-medium text-destructive">
                          <X className="size-3" strokeWidth={2.5} />
                          Fail
                        </span>
                      )}
                      {isSkipped && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning-foreground">
                          <Clock className="size-3" strokeWidth={2.5} />
                          Skip
                        </span>
                      )}
                      {!isPassed && !isFailed && !isSkipped && <span className="text-muted-foreground">{s}</span>}
                    </TableCell>
                    <TableCell className="font-mono text-foreground">{item.id}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {item.duration_s != null ? `${(item.duration_s * 1000).toFixed(1)}ms` : '-'}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">{item.message || '-'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No test items reported</p>
      )}
    </div>
  )
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Run Timeline</h1>
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
                    search={{ run: run.run_id }}
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
