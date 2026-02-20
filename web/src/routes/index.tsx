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
  type RunRecord,
  useHistoryRuns,
  useRunOptions,
} from '../lib/history'

export const Route = createFileRoute('/')({ component: DashboardPage })

function DashboardPage() {
  const { runs, loading, error } = useHistoryRuns()
  const [filters, setFilters] = useState(defaultFilters)
  const options = useRunOptions(runs)

  const filtered = useMemo(() => filterRuns(runs, filters), [runs, filters])

  const summary = useMemo(() => summarizeRuns(filtered), [filtered])
  const trend = useMemo(() => buildRunTrend(filtered), [filtered])
  const checkerHealth = useMemo(() => buildCheckerHealth(filtered), [filtered])
  const recentFailures = useMemo(() => buildFailureFeed(filtered), [filtered])

  return (
    <section className="grid gap-3">
      <FilterBar
        filters={filters}
        options={options}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(defaultFilters)}
      />

      {loading && <Card className="p-6 text-sm text-slate-600">Loading history...</Card>}
      {error && <Card className="p-6 text-sm text-rose-700">Failed to load history: {error}</Card>}

      {!loading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric title="Health" value={`${summary.healthScore}%`} tone={summary.healthScore > 90 ? 'good' : 'warn'} />
            <Metric title="Runs" value={String(summary.total)} />
            <Metric title="Passing" value={`${summary.passRate}%`} tone="good" />
            <Metric title="Failed/Error" value={String(summary.failed)} tone="bad" />
            <Metric title="Avg Duration" value={`${summary.avgDuration.toFixed(1)}s`} />
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
            <Card className="xl:col-span-3 overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-bold">Run Health Timeline</h3>
                <p className="text-xs text-slate-500">Latest 24 runs, color by result and height by duration</p>
              </div>
              <div className="px-4 py-4">
                {trend.length === 0 ? (
                  <p className="text-sm text-slate-500">No runs to plot.</p>
                ) : (
                  <div className="flex h-40 items-end gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {trend.map((entry) => (
                      <Link
                        key={`${entry.run.run_id}-${entry.run.timestamp}`}
                        to="/run"
                        search={{ run: entry.run.run_id }}
                        className="group relative block flex-1"
                        title={`${entry.run.run_id} • ${entry.status} • ${entry.duration.toFixed(1)}s`}
                      >
                        <span
                          className={`block w-full rounded-t-sm transition group-hover:opacity-85 ${barTone(entry.status)}`}
                          style={{ height: `${entry.height}%`, minHeight: '12%' }}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="xl:col-span-2 overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-bold">Failure Hotspots</h3>
                <p className="text-xs text-slate-500">Checks with the highest failure pressure</p>
              </div>
              <div className="grid gap-2 p-3">
                {checkerHealth.length === 0 && (
                  <p className="text-sm text-slate-500">No check data for current filters.</p>
                )}
                {checkerHealth.slice(0, 7).map((row) => (
                  <div key={row.tool} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{row.tool}</p>
                      <p className="text-sm font-bold text-rose-700">{row.failures}</p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-rose-500" style={{ width: `${row.failurePct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{row.failurePct}% failure rate across {row.total} runs</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
            <Card className="xl:col-span-3 overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-bold">Recent Runs</h3>
                <p className="text-xs text-slate-500">Click a run to inspect all checks and test items</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Run</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">PR</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 25).map((run) => (
                      <tr key={`${run.run_id}-${run.timestamp}`} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">
                          <Link to="/run" search={{ run: run.run_id }} className="text-slate-900 underline-offset-2 hover:underline">
                            {run.run_id}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatTime(run.timestamp)}</td>
                        <td className="px-4 py-3">{run.branch || '-'}</td>
                        <td className="px-4 py-3">{run.pr != null ? `#${run.pr}` : '-'}</td>
                        <td className="px-4 py-3"><StatusBadge status={runStatus(run)} /></td>
                        <td className="px-4 py-3">{runDuration(run).toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="xl:col-span-2 overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-bold">Recent Failing Items</h3>
                <p className="text-xs text-slate-500">Most recent failing checks/tests surfaced from item-level data</p>
              </div>
              <div className="grid gap-2 p-3">
                {recentFailures.length === 0 && (
                  <p className="text-sm text-emerald-700">No failing items in current filter scope.</p>
                )}
                {recentFailures.map((failure) => (
                  <div key={failure.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{failure.tool}</p>
                      <StatusBadge status={failure.status} />
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-slate-700">{failure.itemId}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{failure.message}</p>
                    <Link to="/run" search={{ run: failure.runId }} className="mt-2 inline-block text-xs font-semibold text-slate-700 underline-offset-2 hover:underline">
                      Open run {failure.runId}
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </section>
  )
}

function Metric({ title, value, tone }: { title: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900'

  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </Card>
  )
}

function summarizeRuns(runs: RunRecord[]) {
  const total = runs.length
  const passed = runs.filter((run) => runStatus(run) === 'passed').length
  const failed = runs.filter((run) => ['failed', 'error'].includes(runStatus(run))).length
  const passRate = total ? Math.round((passed / total) * 100) : 0
  const avgDuration = total ? runs.reduce((sum, run) => sum + runDuration(run), 0) / total : 0
  const healthScore = Math.max(0, Math.round(passRate - (failed > 0 ? failed / Math.max(total, 1) * 20 : 0)))
  return { total, passed, failed, passRate, avgDuration, healthScore }
}

function buildRunTrend(runs: RunRecord[]) {
  const latest = runs.slice(0, 24)
  const maxDuration = latest.reduce((max, run) => Math.max(max, runDuration(run)), 0)

  return latest
    .map((run) => {
      const duration = runDuration(run)
      const height = maxDuration ? Math.round((duration / maxDuration) * 100) : 50
      return { run, duration, status: runStatus(run), height }
    })
    .reverse()
}

function barTone(status: string) {
  if (status === 'passed') return 'bg-emerald-600'
  if (status === 'skipped') return 'bg-amber-400'
  if (status === 'error') return 'bg-rose-700'
  return 'bg-rose-600'
}

function buildCheckerHealth(runs: RunRecord[]) {
  const totals = new Map<string, { total: number; failures: number }>()

  for (const run of runs) {
    for (const check of run.checks || []) {
      const entry = totals.get(check.tool) ?? { total: 0, failures: 0 }
      entry.total += 1
      const status = (check.status || '').toLowerCase()
      if (status === 'failed' || status === 'error') entry.failures += 1
      totals.set(check.tool, entry)
    }
  }

  return Array.from(totals.entries())
    .map(([tool, stats]) => ({
      tool,
      total: stats.total,
      failures: stats.failures,
      failurePct: stats.total ? Math.round((stats.failures / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.failures - a.failures || b.failurePct - a.failurePct)
}

function buildFailureFeed(runs: RunRecord[]) {
  const items: Array<{ key: string; runId: string; tool: string; status: string; itemId: string; message: string }> = []

  for (const run of runs.slice(0, 20)) {
    for (const check of run.checks || []) {
      const failingItems = (check.items || []).filter((item) => isFailure(item.status))
      for (const item of failingItems) {
        items.push({
          key: `${run.run_id}-${check.tool}-${item.id}`,
          runId: run.run_id,
          tool: check.tool,
          status: item.status,
          itemId: item.id,
          message: item.message || 'No failure message provided',
        })
      }

      if (failingItems.length === 0 && isFailure(check.status)) {
        items.push({
          key: `${run.run_id}-${check.tool}-check`,
          runId: run.run_id,
          tool: check.tool,
          status: check.status,
          itemId: '(check-level)',
          message: 'Check failed without item-level diagnostics',
        })
      }
    }
  }

  return items.slice(0, 10)
}

function isFailure(status: string | undefined) {
  const value = (status || '').toLowerCase()
  return value === 'failed' || value === 'error'
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
