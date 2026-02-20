import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { FilterBar } from '../components/filter-bar'
import { ReportEmptyState, ReportSection, ReportShell } from '../components/report'
import { StatusBadge } from '../components/status-badge'
import { Card } from '../components/ui/card'
import { defaultFilters, filterRuns, runStatus, useHistoryRuns, useRunOptions, type RunRecord } from '../lib/history'

export const Route = createFileRoute('/pr')({ component: PRPage })

function PRPage() {
  const { runs, loading, error } = useHistoryRuns()
  const [filters, setFilters] = useState(defaultFilters)
  const options = useRunOptions(runs)
  const filtered = useMemo(() => filterRuns(runs, filters), [runs, filters])

  const groups = useMemo(() => {
    const map = new Map<number, RunRecord[]>()
    for (const run of filtered) {
      if (run.pr == null) continue
      const bucket = map.get(run.pr) ?? []
      bucket.push(run)
      map.set(run.pr, bucket)
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([pr, prRuns]) => ({
        pr,
        runs: prRuns,
        failed: prRuns.filter((run) => ['failed', 'error'].includes(runStatus(run))).length,
      }))
  }, [filtered])

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ReportShell
        title="Pull Requests"
        description="Grouped execution history by PR number with timeline cards."
        actions={
          <p className="rounded-md border border-zinc-200/80 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {groups.length} grouped PR{groups.length === 1 ? '' : 's'}
          </p>
        }
      >
        <FilterBar
          filters={filters}
          options={options}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />
        {groups.length === 0 ? (
          <ReportSection title="PR Timeline" description="No grouped runs were found for the current filters.">
            <ReportEmptyState title="No PR runs found" message="Try widening branch or status filters to include more runs." />
          </ReportSection>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <ReportSection
                key={group.pr}
                title={`PR #${group.pr}`}
                description={`${group.runs.length} run${group.runs.length === 1 ? '' : 's'} • ${group.failed} failing`}
              >
                <div className="space-y-2">
                  {group.runs.map((run) => (
                    <PRRunRow key={`${group.pr}-${run.run_id}-${run.timestamp}`} run={run} />
                  ))}
                </div>
              </ReportSection>
            ))}
          </div>
        )}
      </ReportShell>

    </div>
  )
}

function PRRunRow({ run }: { run: RunRecord }) {
  const status = runStatus(run)

  return (
    <Link
      to="/run"
      search={{ run: run.run_id }}
      className="block rounded-lg border border-zinc-200/80 bg-zinc-50/90 p-3 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{run.run_id}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatDateTime(run.timestamp)}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <InfoPill label={`Branch ${run.branch || '-'}`} />
        <InfoPill label={run.sha ? run.sha.slice(0, 10) : 'No SHA'} />
      </div>
    </Link>
  )
}

function InfoPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
      {label}
    </span>
  )
}

function InfoState({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <Card
      className={`m-4 p-6 text-sm sm:m-6 lg:m-8 ${
        tone === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-600 dark:text-zinc-300'
      }`}
    >
      {children}
    </Card>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
