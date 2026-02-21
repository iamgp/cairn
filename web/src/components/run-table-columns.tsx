import { createColumnHelper } from '@tanstack/react-table'
import { runDuration, runStatus, type RunRecord } from '../lib/history'
import { relativeTime } from '../lib/utils'

function statusDot(status: string): string {
  if (status === 'passed') return 'bg-emerald-500'
  if (status === 'failed' || status === 'error') return 'bg-rose-500'
  if (status === 'skipped') return 'bg-amber-500'
  return 'bg-gray-400'
}

const col = createColumnHelper<RunRecord>()

export const runTableColumns = [
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
      <span className="font-mono text-gray-500 dark:text-gray-400">{getValue() || '-'}</span>
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
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(s)}`} />
          <span className="capitalize text-gray-600 dark:text-gray-400">{s}</span>
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
          <span
            key={c.tool}
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
              c.status === 'passed'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                : ['failed', 'error'].includes(c.status)
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {c.tool}
          </span>
        ))}
      </div>
    ),
  }),
  col.accessor((row) => runDuration(row), {
    id: 'duration',
    header: 'Duration',
    size: 70,
    cell: ({ getValue }) => (
      <span className="block text-right font-mono text-gray-500 dark:text-gray-400">
        {getValue().toFixed(1)}s
      </span>
    ),
  }),
  col.accessor('timestamp', {
    header: 'Time',
    size: 90,
    cell: ({ getValue }) => (
      <span className="block text-right text-gray-400 dark:text-gray-500">{relativeTime(getValue())}</span>
    ),
  }),
]
