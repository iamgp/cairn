import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '../components/data-table'
import {
  defaultFilters,
  filterRuns,
  runDuration,
  runStatus,
  useHistoryRuns,
  useRunOptions,
  type RunFilters,
  type RunRecord,
} from '../lib/history'
import { relativeTime } from '../lib/utils'

function statusDot(status: string): string {
  if (status === 'passed') return 'bg-emerald-500'
  if (status === 'failed' || status === 'error') return 'bg-rose-500'
  if (status === 'skipped') return 'bg-amber-500'
  return 'bg-gray-400'
}

const col = createColumnHelper<RunRecord>()

const columns = [
  col.accessor('run_id', {
    header: 'Run',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900 dark:text-gray-100">{row.original.run_id}</span>
        {row.original.pr != null && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">PR #{row.original.pr}</span>
        )}
      </div>
    ),
  }),
  col.accessor('branch', {
    header: 'Branch',
    size: 90,
    cell: ({ getValue }) => (
      <span className="text-gray-500 dark:text-gray-400 font-mono">{getValue() || '-'}</span>
    ),
  }),
  col.accessor((row) => runStatus(row), {
    id: 'status',
    header: 'Status',
    size: 80,
    cell: ({ getValue }) => {
      const s = getValue()
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot(s)}`} />
          <span className="text-gray-600 dark:text-gray-400 capitalize">{s}</span>
        </span>
      )
    },
  }),
  col.display({
    id: 'checkers',
    header: 'Checkers',
    size: 120,
    cell: ({ row }) => (
      <div className="flex gap-1">
        {(row.original.checks || []).map((c) => (
          <span key={c.tool} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            c.status === 'passed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
            : ['failed','error'].includes(c.status) ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}>{c.tool}</span>
        ))}
      </div>
    ),
  }),
  col.accessor((row) => runDuration(row), {
    id: 'duration',
    header: 'Duration',
    size: 70,
    cell: ({ getValue }) => (
      <span className="text-gray-500 dark:text-gray-400 font-mono text-right block">{getValue().toFixed(1)}s</span>
    ),
  }),
  col.accessor('timestamp', {
    header: 'Time',
    size: 90,
    cell: ({ getValue }) => (
      <span className="text-gray-400 dark:text-gray-500 text-right block">{relativeTime(getValue())}</span>
    ),
  }),
]

export const Route = createFileRoute('/')({ component: OverviewPage })

function OverviewPage() {
  const { runs, loading, error } = useHistoryRuns()
  const navigate = useNavigate()
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

  const needsAttention = useMemo(
    () => filtered.filter((run) => ['failed', 'error'].includes(runStatus(run))).slice(0, 6),
    [filtered],
  )

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{summary.total} runs found</p>
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

      {/* Metric Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Runs" value={summary.total} />
        <MetricCard label="Passed" value={summary.passed} tone="emerald" />
        <MetricCard label="Failed / Error" value={summary.failed} tone="rose" />
        <MetricCard label="Skipped" value={summary.skipped} tone="amber" />
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <span className="text-amber-500">⚠</span> Needs Attention ({needsAttention.length} runs with failures)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsAttention.map((run) => (
              <NeedsAttentionCard key={`${run.run_id}-${run.timestamp}`} run={run} />
            ))}
          </div>
        </div>
      )}

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

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        pageSize={50}
        onRowClick={(run) => navigate({ to: '/run', search: { run: run.run_id } })}
      />
    </div>
  )
}

function NeedsAttentionCard({ run }: { run: RunRecord }) {
  const status = runStatus(run)
  const failedChecks = (run.checks || []).filter((c) => ['failed', 'error'].includes(c.status?.toLowerCase()))

  return (
    <Link
      to="/run"
      search={{ run: run.run_id }}
      className="block border border-rose-200 dark:border-rose-800/50 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 p-4 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{run.run_id}</span>
        <span className="text-xs px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 rounded-full flex-shrink-0 ml-2">
          {status}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {failedChecks.map((check) => (
          <span key={check.tool} className="text-[10px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 rounded">
            {check.tool}: {check.status}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {run.branch || 'No branch'} · {run.checks?.length ?? 0} checks
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(run.timestamp)}</p>
    </Link>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'rose' | 'amber' }) {
  const borderColor =
    tone === 'emerald' ? 'border-emerald-200 dark:border-emerald-900' :
    tone === 'rose' ? 'border-rose-200 dark:border-rose-900' :
    tone === 'amber' ? 'border-amber-200 dark:border-amber-900' :
    'border-gray-200 dark:border-gray-800'

  return (
    <div className={`rounded-lg border ${borderColor} bg-white dark:bg-gray-900 p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
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
