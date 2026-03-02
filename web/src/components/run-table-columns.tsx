import { createColumnHelper } from '@tanstack/react-table'
import { Check, Clock, X } from 'lucide-react'
import { runDuration, runStatus, type RunRecord } from '../lib/history'
import { relativeTime } from '../lib/utils'

const col = createColumnHelper<RunRecord>()

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()

  if (s === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-1 text-xs font-medium text-success-foreground">
        <Check className="size-3.5" strokeWidth={2.5} />
        Passed
      </span>
    )
  }

  if (s === 'failed' || s === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive-muted px-2.5 py-1 text-xs font-medium text-destructive">
        <X className="size-3.5" strokeWidth={2.5} />
        {s === 'error' ? 'Error' : 'Failed'}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-muted px-2.5 py-1 text-xs font-medium text-warning-foreground">
      <Clock className="size-3.5" strokeWidth={2.5} />
      Skipped
    </span>
  )
}

export const runTableColumns = [
  col.accessor('timestamp', {
    header: 'Time',
    size: 180,
    cell: ({ getValue }) => {
      const ts = getValue()
      return (
        <div className="flex flex-col">
          <span className="text-xs text-foreground">{new Date(ts).toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">{relativeTime(ts)}</span>
        </div>
      )
    },
  }),
  col.accessor('run_id', {
    header: 'Run',
    size: 200,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">{row.original.run_id}</span>
        {row.original.pr != null ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">PR #{row.original.pr}</span>
        ) : null}
      </div>
    ),
  }),
  col.accessor('branch', {
    header: 'Branch',
    size: 180,
    cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() || '-'}</span>,
  }),
  col.accessor((row) => runStatus(row), {
    id: 'status',
    header: 'Status',
    size: 140,
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
  col.display({
    id: 'checkers',
    header: 'Checks',
    size: 260,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        {(row.original.checks || []).map((check) => (
          <span key={check.tool} className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
            {check.tool}
          </span>
        ))}
      </div>
    ),
  }),
  col.accessor((row) => runDuration(row), {
    id: 'duration',
    header: 'Duration',
    size: 100,
    cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue().toFixed(1)}s</span>,
  }),
]
