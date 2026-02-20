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
    const passRate = total ? Math.round((passed / total) * 100) : 0
    return { total, passed, failed, passRate }
  }, [filtered])

  return (
    <section className="grid gap-3">
      <div className="border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-slate-900">{summary.total} runs</span>
            <span className="text-slate-600">Pass rate: {summary.passRate}%</span>
            <span className="text-emerald-700">Passed: {summary.passed}</span>
            <span className="text-rose-700">Failed/Error: {summary.failed}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setFilters(defaultFilters)}>
            Reset filters
          </Button>
        </div>
      </div>

      <div className="border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="any">Status: any</option>
            <option value="passed">Status: passed</option>
            <option value="failed">Status: failed</option>
            <option value="error">Status: error</option>
            <option value="skipped">Status: skipped</option>
          </Select>

          <Select value={filters.checker} onChange={(e) => setFilters((prev) => ({ ...prev, checker: e.target.value }))}>
            {options.checkers.map((checker) => (
              <option key={checker} value={checker}>
                Checker: {checker}
              </option>
            ))}
          </Select>

          <Select value={filters.branch} onChange={(e) => setFilters((prev) => ({ ...prev, branch: e.target.value }))}>
            {options.branches.map((branch) => (
              <option key={branch} value={branch}>
                Branch: {branch}
              </option>
            ))}
          </Select>

          <Select value={filters.pr} onChange={(e) => setFilters((prev) => ({ ...prev, pr: e.target.value }))}>
            {options.prs.map((pr) => (
              <option key={pr} value={pr}>
                PR: {pr}
              </option>
            ))}
          </Select>

          <div className="ml-auto min-w-[260px] flex-1 sm:flex-none">
            <Input
              placeholder="Search run / sha / branch"
              value={filters.query}
              onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
            />
          </div>
        </div>

        {loading && <p className="px-4 py-6 text-sm text-slate-600">Loading history...</p>}
        {error && <p className="px-4 py-6 text-sm text-rose-700">Failed to load history: {error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
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
                {filtered.slice(0, 100).map((run) => (
                  <tr key={`${run.run_id}-${run.timestamp}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(run.timestamp)}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to="/run" search={{ run: run.run_id }} className="text-slate-900 underline-offset-2 hover:underline">
                        {run.run_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{run.branch || '-'}</td>
                    <td className="px-4 py-3">{run.pr != null ? `#${run.pr}` : '-'}</td>
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
      </div>
    </section>
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
