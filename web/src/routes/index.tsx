import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { FilterBar } from '../components/filter-bar'
import {
  ReportEmptyState,
  ReportMetricCard,
  ReportMetricGrid,
  ReportSection,
  ReportShell,
} from '../components/report'
import { StatusBadge } from '../components/status-badge'
import { Card } from '../components/ui/card'
import {
  defaultFilters,
  filterRuns,
  runDuration,
  runStatus,
  useHistoryRuns,
  useRunOptions,
  type RunRecord,
} from '../lib/history'

export const Route = createFileRoute('/')({ component: OverviewPage })

function OverviewPage() {
  const { runs, loading, error } = useHistoryRuns()
  const [filters, setFilters] = useState(defaultFilters)
  const options = useRunOptions(runs)
  const filtered = useMemo(() => filterRuns(runs, filters), [runs, filters])

  const summary = useMemo(() => {
    const total = filtered.length
    const passed = filtered.filter((run) => runStatus(run) === 'passed').length
    const failed = filtered.filter((run) => ['failed', 'error'].includes(runStatus(run))).length
    const skipped = filtered.filter((run) => runStatus(run) === 'skipped').length
    return { total, passed, failed, skipped }
  }, [filtered])

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>

  const recent = filtered.slice(0, 18)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ReportShell
        title="Overview"
        description="Run health and recent execution history for Cairn checks."
        actions={
          <p className="rounded-md border border-gray-200/80 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {summary.total} run{summary.total === 1 ? '' : 's'} in current scope
          </p>
        }
      >
        <ReportMetricGrid className="xl:grid-cols-4">
          <ReportMetricCard label="Runs" value={summary.total} />
          <ReportMetricCard label="Passed" value={summary.passed} trendVariant="success" />
          <ReportMetricCard label="Failed / Error" value={summary.failed} trendVariant="destructive" />
          <ReportMetricCard label="Skipped" value={summary.skipped} trendVariant="warning" />
        </ReportMetricGrid>

        <FilterBar
          filters={filters}
          options={options}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />

        <ReportSection title="Recent Runs" description="Ordered by latest timestamp and styled for quick triage.">
          {recent.length === 0 ? (
            <ReportEmptyState title="No runs match the active filters." />
          ) : (
            <div className="space-y-2">
              {recent.map((run) => (
                <RunTimelineRow key={`${run.run_id}-${run.timestamp}`} run={run} />
              ))}
            </div>
          )}
        </ReportSection>
      </ReportShell>
    </div>
  )
}

function RunTimelineRow({ run }: { run: RunRecord }) {
  const status = runStatus(run)

  return (
    <Link
      to="/run"
      search={{ run: run.run_id }}
      className="block rounded-lg border border-gray-200/80 bg-gray-50/90 p-3 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{run.run_id}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(run.timestamp)}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <InfoPill label={`Branch ${run.branch || '-'}`} />
        <InfoPill label={run.pr != null ? `PR #${run.pr}` : 'No PR'} />
        <InfoPill label={`${run.checks?.length ?? 0} checks`} />
        <InfoPill label={`${runDuration(run).toFixed(1)}s`} />
      </div>
    </Link>
  )
}

function InfoPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
      {label}
    </span>
  )
}

function InfoState({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <Card
      className={`m-4 p-6 text-sm sm:m-6 lg:m-8 ${
        tone === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300'
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
