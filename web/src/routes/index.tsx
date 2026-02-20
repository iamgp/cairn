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
    const avgDuration = total
      ? filtered.reduce((acc, run) => acc + runDuration(run), 0) / total
      : 0
    return { total, passed, failed, skipped, avgDuration }
  }, [filtered])

  const recentRuns = filtered.slice(0, 18)

  if (loading) {
    return <Card className="m-4 p-6 text-sm text-gray-600 sm:m-6 lg:m-8">Loading history...</Card>
  }

  if (error) {
    return <Card className="m-4 p-6 text-sm text-rose-700 sm:m-6 lg:m-8">Failed to load history: {error}</Card>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cairn Checks Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{summary.total} runs in current view</p>
      </div>

      <div className="mb-6">
        <FilterBar
          filters={filters}
          options={options}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Runs" value={String(summary.total)} />
        <StatCard label="Passed" value={String(summary.passed)} tone="ok" />
        <StatCard label="Failed/Error" value={String(summary.failed)} tone="bad" />
        <StatCard label="Skipped" value={String(summary.skipped)} tone="warn" />
        <StatCard label="Avg Duration" value={`${summary.avgDuration.toFixed(1)}s`} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Recent Runs</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">Showing {recentRuns.length} of {summary.total}</span>
        </div>

        {recentRuns.length === 0 ? (
          <Card className="p-6 text-sm text-gray-600">No runs match these filters.</Card>
        ) : (
          <div className="space-y-3">
            {recentRuns.map((run) => {
              const status = runStatus(run)
              const checkers = (run.checks || []).slice(0, 4)
              return (
                <Link key={`${run.run_id}-${run.timestamp}`} to="/run" search={{ run: run.run_id }}>
                  <Card className="p-4 transition-all hover:border-blue-300 hover:shadow-md dark:hover:border-blue-700">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{run.run_id}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(run.timestamp)}</p>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2 text-xs">
                      <Pill>{run.branch || 'no branch'}</Pill>
                      <Pill>{run.pr != null ? `PR #${run.pr}` : 'no PR'}</Pill>
                      <Pill>{run.sha ? run.sha.slice(0, 8) : 'no sha'}</Pill>
                      <Pill>{run.checks?.length ?? 0} checks</Pill>
                      <Pill>{runDuration(run).toFixed(1)}s</Pill>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {checkers.map((check) => (
                        <span
                          key={`${run.run_id}-${check.tool}`}
                          className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          {check.tool}: {check.status}
                        </span>
                      ))}
                      {(run.checks?.length ?? 0) > checkers.length && (
                        <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                          +{(run.checks?.length ?? 0) - checkers.length} more
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'ok' | 'bad' | 'warn'
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-700 dark:text-rose-400'
        : tone === 'warn'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-gray-900 dark:text-gray-100'

  return (
    <Card className="p-4">
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
    </Card>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
      {children}
    </span>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
