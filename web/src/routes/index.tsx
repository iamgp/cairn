import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { StatusBadge } from '../components/status-badge'
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

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Run Records</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setFilters(defaultFilters)}>
              Reset
            </Button>
            <Button size="sm">Export</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Select className="w-auto min-w-[130px]" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="any">Status</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="error">Error</option>
          <option value="skipped">Skipped</option>
        </Select>

        <Select className="w-auto min-w-[140px]" value={filters.checker} onChange={(e) => setFilters((prev) => ({ ...prev, checker: e.target.value }))}>
          {options.checkers.map((checker) => (
            <option key={checker} value={checker}>
              Checker: {checker}
            </option>
          ))}
        </Select>

        <Select className="w-auto min-w-[130px]" value={filters.branch} onChange={(e) => setFilters((prev) => ({ ...prev, branch: e.target.value }))}>
          {options.branches.map((branch) => (
            <option key={branch} value={branch}>
              Branch: {branch}
            </option>
          ))}
        </Select>

        <Select className="w-auto min-w-[110px]" value={filters.pr} onChange={(e) => setFilters((prev) => ({ ...prev, pr: e.target.value }))}>
          {options.prs.map((pr) => (
            <option key={pr} value={pr}>
              PR: {pr}
            </option>
          ))}
        </Select>

        <div className="ml-auto w-full sm:w-[280px]">
          <Input
            placeholder="Search runs"
            value={filters.query}
            onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center gap-5 border-b border-slate-200 px-4 py-2 text-xs">
        <span className="font-semibold text-slate-900">All {summary.total}</span>
        <span className="text-emerald-700">Passed {summary.passed}</span>
        <span className="text-rose-700">Failed/Error {summary.failed}</span>
        <span className="text-amber-700">Skipped {summary.skipped}</span>
      </div>

      {loading && <p className="px-4 py-6 text-sm text-slate-600">Loading history...</p>}
      {error && <p className="px-4 py-6 text-sm text-rose-700">Failed to load history: {error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">PR</th>
                <th className="px-4 py-3">SHA</th>
                <th className="px-4 py-3">Checks</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 120).map((run) => (
                <tr key={`${run.run_id}-${run.timestamp}`} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(run.timestamp)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link to="/run" search={{ run: run.run_id }} className="hover:underline">
                      {run.run_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{run.branch || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{run.pr != null ? `#${run.pr}` : '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{run.sha || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{run.checks?.length ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={runStatus(run)} /></td>
                  <td className="px-4 py-3 text-slate-700">{runDuration(run).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
