import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Card } from '../components/ui/card'
import { FilterBar } from '../components/filter-bar'
import { defaultFilters, filterRuns, runDuration, runStatus, useHistoryRuns, useRunOptions } from '../lib/history'
import { StatusBadge } from '../components/status-badge'

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
    const avgDuration = total ? filtered.reduce((sum, run) => sum + runDuration(run), 0) / total : 0
    return { total, passed, failed, avgDuration }
  }, [filtered])

  return (
    <section className="grid gap-4">
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Runs" value={String(summary.total)} />
            <Metric title="Passed" value={String(summary.passed)} accent="emerald" />
            <Metric title="Failed/Error" value={String(summary.failed)} accent="rose" />
            <Metric title="Avg Duration" value={`${summary.avgDuration.toFixed(1)}s`} />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 p-4">
              <h3 className="text-lg font-bold">Recent Runs</h3>
              <p className="text-sm text-slate-600">Latest executions matching active filters</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Run</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">PR</th>
                    <th className="px-4 py-3">SHA</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 30).map((run) => (
                    <tr key={run.run_id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{run.timestamp}</td>
                      <td className="px-4 py-3 font-medium">{run.run_id}</td>
                      <td className="px-4 py-3">{run.branch || '-'}</td>
                      <td className="px-4 py-3">{run.pr != null ? `#${run.pr}` : '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{run.sha || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={runStatus(run)} /></td>
                      <td className="px-4 py-3">{runDuration(run).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </section>
  )
}

function Metric({ title, value, accent }: { title: string; value: string; accent?: 'emerald' | 'rose' }) {
  const accentClass =
    accent === 'emerald' ? 'text-emerald-700' : accent === 'rose' ? 'text-rose-700' : 'text-slate-900'

  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-1 text-2xl font-black ${accentClass}`}>{value}</p>
    </Card>
  )
}
