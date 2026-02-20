import { Link, createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '../components/data-table'
import { StatusBadge } from '../components/status-badge'
import { runDuration, runStatus, useHistoryRuns, type RunCheck, type RunItem, type RunRecord } from '../lib/history'
import { cn, formatDayLabel, relativeTime } from '../lib/utils'

export const Route = createFileRoute('/run')({
  validateSearch: (search) => ({
    run: typeof search.run === 'string' ? search.run : '',
  }),
  component: RunsPage,
})

function RunsPage() {
  const { runs, loading, error } = useHistoryRuns()
  const search = Route.useSearch()

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>
  if (!runs.length) return <InfoState tone="neutral">No runs available yet.</InfoState>

  if (search.run) {
    const run = runs.find((r) => r.run_id === search.run)
    if (run) return <RunDetailPage run={run} />
  }

  return <RunListPage runs={runs} />
}

// ─── Run List (timeline) ────────────────────────────────────────────────────

const checkerColors = [
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400',
]

function checkerColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return checkerColors[Math.abs(hash) % checkerColors.length]
}

function groupByDate(runs: RunRecord[]): Map<string, RunRecord[]> {
  const groups = new Map<string, RunRecord[]>()
  for (const run of runs) {
    const day = run.timestamp.split('T')[0]
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(run)
  }
  return groups
}

function RunListPage({ runs }: { runs: RunRecord[] }) {
  const grouped = groupByDate(runs)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Run Timeline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{runs.length} runs</p>
      </div>

      <div className="ml-2 border-l-2 border-gray-200 dark:border-gray-800 sm:ml-4">
        {Array.from(grouped.entries()).map(([dateStr, dayRuns]) => (
          <div key={dateStr}>
            <div className="relative flex items-center -ml-3 mb-4 mt-6 first:mt-0">
              <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 border-2 border-white dark:border-gray-950 flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                {formatDayLabel(dateStr)}
              </span>
            </div>

            {dayRuns.map((run, i) => {
              const status = runStatus(run)
              return (
                <div key={`${run.run_id}-${run.timestamp}-${i}`} className="pl-8 relative mb-4">
                  <span className={cn(
                    'absolute left-[-5px] top-2 w-2 h-2 rounded-full',
                    status === 'passed' ? 'bg-emerald-500' :
                    status === 'failed' || status === 'error' ? 'bg-rose-500' :
                    status === 'skipped' ? 'bg-amber-500' : 'bg-gray-400',
                  )} />
                  <Link
                    to="/run"
                    search={{ run: run.run_id }}
                    className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <StatusBadge status={status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{run.run_id}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(run.checks || []).map((check) => (
                            <span key={check.tool} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${checkerColor(check.tool)}`}>
                              {check.tool}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {run.branch || 'no branch'} · {run.checks?.length ?? 0} checks · {runDuration(run).toFixed(1)}s · {relativeTime(run.timestamp)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Run Detail Page ────────────────────────────────────────────────────────

function RunDetailPage({ run }: { run: RunRecord }) {
  const status = runStatus(run)
  const checks = run.checks || []
  const passedChecks = checks.filter((c) => c.status === 'passed').length
  const failedChecks = checks.filter((c) => ['failed', 'error'].includes(c.status?.toLowerCase())).length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Back link */}
      <Link
        to="/run"
        search={{ run: '' }}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        All Runs
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{run.run_id}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {checks.length} check{checks.length !== 1 ? 's' : ''} · {runDuration(run).toFixed(1)}s total · {relativeTime(run.timestamp)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 font-medium">
            {passedChecks} passed
          </span>
          <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 px-2.5 py-1 font-medium">
            {failedChecks} failed
          </span>
        </div>
      </div>

      {/* Run metadata */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetaCard label="Status" value={status} />
        <MetaCard label="Branch" value={run.branch || '-'} />
        <MetaCard label="PR" value={run.pr != null ? `#${run.pr}` : '-'} />
        <MetaCard label="SHA" value={run.sha || '-'} mono />
        <MetaCard label="Duration" value={`${runDuration(run).toFixed(1)}s`} />
        <MetaCard label="Timestamp" value={new Date(run.timestamp).toLocaleString()} />
      </div>

      {/* Checks */}
      {checks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No checks reported for this run.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {checks.map((check) => (
            <CheckCard key={check.tool} check={check} />
          ))}
        </div>
      )}
    </div>
  )
}

function MetaCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn(
        'mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate',
        mono && 'font-mono text-xs',
      )}>
        {value}
      </div>
    </div>
  )
}

function statusDot(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'passed') return 'bg-emerald-500'
  if (s === 'failed' || s === 'error') return 'bg-rose-500'
  if (s === 'skipped') return 'bg-amber-500'
  return 'bg-gray-400'
}

const itemCol = createColumnHelper<RunItem>()

const itemColumns = [
  itemCol.display({
    id: 'dot',
    size: 24,
    enableSorting: false,
    cell: ({ row }) => (
      <span className={`block w-1.5 h-1.5 rounded-full ${statusDot(row.original.status)}`} />
    ),
  }),
  itemCol.accessor('id', {
    header: 'Test',
    cell: ({ getValue }) => (
      <span className="font-mono text-gray-700 dark:text-gray-300">{getValue()}</span>
    ),
  }),
  itemCol.accessor('status', {
    header: 'Status',
    size: 70,
    cell: ({ getValue }) => (
      <span className="text-gray-500 dark:text-gray-400 capitalize">{(getValue() || 'unknown').toLowerCase()}</span>
    ),
  }),
  itemCol.accessor('duration_s', {
    header: 'Duration',
    size: 70,
    cell: ({ getValue }) => {
      const v = getValue()
      return (
        <span className="text-gray-400 dark:text-gray-500 font-mono text-right block">
          {v != null && v > 0 ? `${v.toFixed(3)}s` : '-'}
        </span>
      )
    },
  }),
  itemCol.accessor('message', {
    header: 'Message',
    enableSorting: false,
    cell: ({ getValue }) => {
      const msg = getValue()
      return (
        <span className="text-gray-500 dark:text-gray-400 truncate block max-w-[400px]">
          {msg ? msg.split('\n')[0] : '-'}
        </span>
      )
    },
  }),
]

function CheckCard({ check }: { check: RunCheck }) {
  const items = check.items || []
  const passed = items.filter((i) => i.status === 'passed').length
  const failed = items.filter((i) => ['failed', 'error'].includes(i.status?.toLowerCase())).length

  return (
    <div>
      {/* Check header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusDot(check.status)}`} />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{check.tool}</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {check.duration_s ? ` · ${check.duration_s.toFixed(1)}s` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {items.length > 0 && (
            <>
              <span className="text-emerald-600 dark:text-emerald-400">{passed} passed</span>
              <span className="text-rose-600 dark:text-rose-400">{failed} failed</span>
            </>
          )}
        </div>
      </div>

      {/* Items table */}
      {items.length === 0 ? (
        <div className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">No check items.</div>
      ) : (
        <DataTable
          columns={itemColumns}
          data={items}
          pageSize={100}
          getRowClassName={(row) =>
            ['failed', 'error'].includes(row.original.status?.toLowerCase())
              ? 'bg-rose-50/40 dark:bg-rose-950/10'
              : ''
          }
          renderSubRow={(row) => {
            const item = row.original
            const isFailure = ['failed', 'error'].includes(item.status?.toLowerCase())
            if (!isFailure || !item.message) return null
            return (
              <tr key={`${row.id}-msg`} className="bg-rose-50/40 dark:bg-rose-950/10">
                <td />
                <td colSpan={4} className="px-3 pb-2 pt-0">
                  <pre className="whitespace-pre-wrap text-[11px] text-rose-700 dark:text-rose-300 font-mono">{item.message}</pre>
                </td>
              </tr>
            )
          }}
        />
      )}
    </div>
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
