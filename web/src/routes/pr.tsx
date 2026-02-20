import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { StatusBadge } from '../components/status-badge'
import { defaultFilters, filterRuns, runDuration, runStatus, useHistoryRuns, useRunOptions, type RunFilters, type RunRecord } from '../lib/history'
import { relativeTime } from '../lib/utils'

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
        passed: prRuns.filter((run) => runStatus(run) === 'passed').length,
        failed: prRuns.filter((run) => ['failed', 'error'].includes(runStatus(run))).length,
      }))
  }, [filtered])

  const hasActiveFilters = filters.query !== '' || filters.status !== 'any' || filters.checker !== 'any' || filters.branch !== 'any' || filters.pr !== 'any'

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>

  const updateFilter = (key: keyof RunFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pull Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {groups.length} PR{groups.length !== 1 ? 's' : ''} with {filtered.filter((r) => r.pr != null).length} runs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 font-medium">
            {groups.reduce((acc, g) => acc + g.passed, 0)} passed
          </span>
          <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 px-2.5 py-1 font-medium">
            {groups.reduce((acc, g) => acc + g.failed, 0)} failed
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            placeholder="Search by run ID / SHA / branch / checker"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>
        <FilterSelect value={filters.status} onChange={(v) => updateFilter('status', v)}
          options={[{ value: 'any', label: 'Status' }, { value: 'passed', label: 'Passed' }, { value: 'failed', label: 'Failed' }, { value: 'error', label: 'Error' }, { value: 'skipped', label: 'Skipped' }]} />
        <FilterSelect value={filters.checker} onChange={(v) => updateFilter('checker', v)}
          options={options.checkers.map((c) => ({ value: c, label: c === 'any' ? 'Checker' : c }))} />
        <FilterSelect value={filters.branch} onChange={(v) => updateFilter('branch', v)}
          options={options.branches.map((b) => ({ value: b, label: b === 'any' ? 'Branch' : b }))} />
        <FilterSelect value={filters.pr} onChange={(v) => updateFilter('pr', v)}
          options={options.prs.map((p) => ({ value: p, label: p === 'any' ? 'PR' : `#${p}` }))} />
        {hasActiveFilters && (
          <button
            onClick={() => setFilters(defaultFilters)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Clear All
          </button>
        )}
      </div>

      {/* PR Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No PR runs found. Try widening filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.pr}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 rounded-full bg-blue-500 dark:bg-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  PR #{group.pr}
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {group.runs.length} run{group.runs.length !== 1 ? 's' : ''} · {group.failed} failing
                </span>
              </div>
              <div className="ml-2 border-l border-gray-200 pl-3 dark:border-gray-800 space-y-3 sm:ml-4 sm:pl-4">
                {group.runs.map((run) => (
                  <PRRunCard key={`${group.pr}-${run.run_id}-${run.timestamp}`} run={run} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PRRunCard({ run }: { run: RunRecord }) {
  const status = runStatus(run)

  return (
    <Link
      to="/run"
      search={{ run: run.run_id }}
      className="block rounded-lg border border-gray-200/80 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{run.run_id}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {run.branch || 'no branch'} · {relativeTime(run.timestamp)}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(run.checks || []).map((check) => (
            <span
              key={check.tool}
              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {check.tool}: {check.status}
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-shrink-0 ml-4">
          {runDuration(run).toFixed(1)}s
        </span>
      </div>
      {run.sha && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-[10px] rounded-full border border-gray-200 bg-white px-2 py-0.5 text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 font-mono">
            {run.sha.slice(0, 10)}
          </span>
        </div>
      )}
    </Link>
  )
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500"
    >
      {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  )
}

function InfoState({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <div className={`m-4 sm:m-6 lg:m-8 rounded-xl border border-gray-200/80 bg-white/95 p-6 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900/90 ${
      tone === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300'
    }`}>
      {children}
    </div>
  )
}
