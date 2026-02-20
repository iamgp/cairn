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

  const rows = filtered.slice(0, 120)

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
          {rows.length === 0 ? (
            <ReportEmptyState title="No runs match the active filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                    <th className="px-4 py-3">Run</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Checks</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((run) => (
                    <tr
                      key={`${run.run_id}-${run.timestamp}`}
                      className="text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        <Link to="/run" search={{ run: run.run_id }} className="hover:underline">
                          {run.run_id}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{run.pr != null ? `PR #${run.pr}` : 'No PR'}</div>
                      </td>
                      <td className="px-4 py-3">{run.branch || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={runStatus(run)} /></td>
                      <td className="px-4 py-3">{run.checks?.length ?? 0}</td>
                      <td className="px-4 py-3">{runDuration(run).toFixed(1)}s</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDateTime(run.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>
      </ReportShell>
    </div>
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
