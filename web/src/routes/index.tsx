import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { FilterBar } from '../components/filter-bar'
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

export const Route = createFileRoute('/')({ component: DashboardPage })

function DashboardPage() {
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

  const rows = filtered.slice(0, 120)

  if (loading) return <Card className="m-4 p-6 text-sm text-gray-600 sm:m-6 lg:m-8">Loading history...</Card>
  if (error) return <Card className="m-4 p-6 text-sm text-rose-700 sm:m-6 lg:m-8">Failed to load history: {error}</Card>

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cairn Checks Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{summary.total} runs found</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Metric label="Runs" value={String(summary.total)} />
        <Metric label="Passed" value={String(summary.passed)} tone="ok" />
        <Metric label="Failed/Error" value={String(summary.failed)} tone="bad" />
        <Metric label="Skipped" value={String(summary.skipped)} tone="warn" />
      </div>

      <div className="mb-6">
        <FilterBar
          filters={filters}
          options={options}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />
      </div>

      <Card className="overflow-hidden p-0">
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
                <tr key={`${run.run_id}-${run.timestamp}`} className="text-gray-700 dark:text-gray-300">
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
      </Card>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'bad' | 'warn' }) {
  const classes =
    tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-700 dark:text-rose-400'
        : tone === 'warn'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-gray-900 dark:text-gray-100'

  return (
    <Card className="p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-3xl font-semibold ${classes}`}>{value}</p>
    </Card>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
