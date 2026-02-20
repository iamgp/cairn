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
  type RunRecord,
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

    const branches = new Set(filtered.map((run) => run.branch).filter(Boolean))
    const prs = new Set(filtered.map((run) => run.pr).filter((pr): pr is number => pr != null))

    return {
      total,
      passed,
      failed,
      skipped,
      avgDuration,
      branches: branches.size,
      prs: prs.size,
    }
  }, [filtered])

  const attentionRuns = useMemo(
    () => filtered.filter((run) => ['failed', 'error'].includes(runStatus(run))).slice(0, 6),
    [filtered],
  )

  const recentRuns = filtered.slice(0, 20)

  if (loading) {
    return <Card className="m-4 p-6 text-sm text-gray-600 sm:m-6 lg:m-8">Loading history...</Card>
  }

  if (error) {
    return <Card className="m-4 p-6 text-sm text-rose-700 sm:m-6 lg:m-8">Failed to load history: {error}</Card>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Project Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{summary.total} runs found</p>
      </div>

      <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        Run status: {summary.failed > 0 ? `${summary.failed} failing` : 'all clear'}, {summary.passed} passed, {summary.skipped} skipped.
      </div>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Run Health</h2>
          <Link to="/trends" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Open stats</Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <HealthCard label="Runs" value={String(summary.total)} />
          <HealthCard label="Failed" value={String(summary.failed)} tone="bad" />
          <HealthCard label="Passed" value={String(summary.passed)} tone="ok" />
          <HealthCard label="Branches" value={String(summary.branches)} tone="info" />
          <HealthCard label="PRs" value={String(summary.prs)} tone="warn" />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Needs Attention ({attentionRuns.length} failing run{attentionRuns.length === 1 ? '' : 's'})
        </h2>

        {attentionRuns.length === 0 ? (
          <Card className="p-5 text-sm text-gray-600">No failing runs in this window.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {attentionRuns.map((run) => (
              <AttentionCard key={`${run.run_id}-${run.timestamp}`} run={run} />
            ))}
          </div>
        )}
      </section>

      <div className="mb-6">
        <FilterBar
          filters={filters}
          options={options}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />
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
            {recentRuns.map((run) => (
              <RunFeedCard key={`${run.run_id}-${run.timestamp}`} run={run} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function HealthCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'ok' | 'bad' | 'warn' | 'info'
}) {
  const toneClasses =
    tone === 'ok'
      ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400'
      : tone === 'bad'
        ? 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-400'
        : tone === 'warn'
          ? 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400'
          : tone === 'info'
            ? 'border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-400'
            : 'border-gray-200 text-gray-900 dark:border-gray-700 dark:text-gray-100'

  return (
    <div className={`rounded-md border p-3 ${toneClasses}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-3xl font-semibold leading-tight">{value}</p>
    </div>
  )
}

function AttentionCard({ run }: { run: RunRecord }) {
  const failingChecks = (run.checks || []).filter((check) => ['failed', 'error'].includes((check.status || '').toLowerCase()))
  return (
    <Link to="/run" search={{ run: run.run_id }}>
      <Card className="border-amber-300 bg-amber-50/30 p-4 transition hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:border-amber-800">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="truncate text-xl font-semibold text-gray-900 dark:text-gray-100">{run.run_id}</p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            {run.branch || 'no branch'}
          </span>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5">
          {failingChecks.slice(0, 3).map((check) => (
            <span key={`${run.run_id}-${check.tool}`} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {check.tool}: {check.status}
            </span>
          ))}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(run.timestamp)}</p>
      </Card>
    </Link>
  )
}

function RunFeedCard({ run }: { run: RunRecord }) {
  const status = runStatus(run)
  const checkers = (run.checks || []).slice(0, 4)
  return (
    <Link to="/run" search={{ run: run.run_id }}>
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
