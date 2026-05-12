import { createColumnHelper } from '@tanstack/react-table'
import { Check, Clock, X } from 'lucide-react'
import { runDuration, runStatus, type RunRecord } from '../lib/history'
import { relativeTime } from '../lib/utils'
import { Badge } from './ui/badge'

const col = createColumnHelper<RunRecord>()

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const label = status || 'Unknown'

  if (s === 'passed') {
    return (
      <Badge variant="success" className="inline-flex items-center gap-1.5">
        <Check className="size-3.5" strokeWidth={2.5} />
        Passed
      </Badge>
    )
  }

  if (s === 'failed' || s === 'error') {
    return (
      <Badge variant="destructive" className="inline-flex items-center gap-1.5">
        <X className="size-3.5" strokeWidth={2.5} />
        {s === 'error' ? 'Error' : 'Failed'}
      </Badge>
    )
  }

  return (
    <Badge variant="warning" className="inline-flex items-center gap-1.5">
      <Clock className="size-3.5" strokeWidth={2.5} />
      {label}
    </Badge>
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
        <a
          href={`/#/run?run=${encodeURIComponent(String(row.original.run_id))}`}
          className="font-medium text-[var(--fgColor-accent,#0969da)] no-underline hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.original.run_id}
        </a>
        {row.original.pr != null ? (
          <Badge variant="outline">PR #{row.original.pr}</Badge>
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
          <Badge key={check.tool} variant="outline">
            {check.tool}
          </Badge>
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
