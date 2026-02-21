import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DataTable } from '../components/data-table'
import { runTableColumns } from '../components/run-table-columns'
import { defaultFilters, filterRuns, runStatus, useHistoryRuns, useRunOptions, type RunFilters } from '../lib/history'

export const Route = createFileRoute('/pr')({
  validateSearch: (search) => ({
    group: typeof search.group === 'string' ? search.group : '',
  }),
  component: PRPage,
})

function PRPage() {
  const { runs, loading, error } = useHistoryRuns()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [filters, setFilters] = useState(defaultFilters)
  const prRuns = useMemo(() => runs.filter((run) => run.pr != null), [runs])
  const options = useRunOptions(prRuns)
  const filtered = useMemo(() => filterRuns(prRuns, filters), [prRuns, filters])
  const summary = useMemo(() => {
    const total = filtered.length
    const passed = filtered.filter((run) => runStatus(run) === 'passed').length
    const failed = filtered.filter((run) => ['failed', 'error'].includes(runStatus(run))).length
    const skipped = filtered.filter((run) => runStatus(run) === 'skipped').length
    const prs = new Set(filtered.map((run) => String(run.pr ?? '')).filter(Boolean)).size
    return { total, passed, failed, skipped, prs }
  }, [filtered])

  const hasActiveFilters = filters.query !== '' || filters.status !== 'any' || filters.checker !== 'any' || filters.branch !== 'any' || filters.pr !== 'any'

  useEffect(() => {
    if (search.group === 'failed') {
      setFilters((prev) => ({ ...prev, status: 'failed_or_error' }))
      return
    }
    setFilters((prev) => ({ ...prev, status: 'any' }))
  }, [search.group])

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
            {summary.prs} PR{summary.prs !== 1 ? 's' : ''} with {summary.total} runs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 font-medium">
            {summary.passed} passed
          </span>
          <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 px-2.5 py-1 font-medium">
            {summary.failed} failed
          </span>
          <span className="rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-2.5 py-1 font-medium">
            {summary.skipped} skipped
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
          options={[
            { value: 'any', label: 'Status' },
            { value: 'failed_or_error', label: 'Failed / Error' },
            { value: 'passed', label: 'Passed' },
            { value: 'failed', label: 'Failed' },
            { value: 'error', label: 'Error' },
            { value: 'skipped', label: 'Skipped' },
          ]} />
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

      <DataTable
        columns={runTableColumns}
        data={filtered}
        pageSize={50}
        onRowClick={(run) => navigate({ to: '/run', search: { run: run.run_id } })}
      />
    </div>
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
