import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ReportEmptyState, ReportKeyValueList, ReportSection, ReportShell } from '../components/report'
import { Card } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { StatusBadge } from '../components/status-badge'
import { runDuration, runStatus, useHistoryRuns, type RunCheck, type RunItem, type RunRecord } from '../lib/history'

export const Route = createFileRoute('/run')({
  validateSearch: (search) => ({
    run: typeof search.run === 'string' ? search.run : '',
  }),
  component: RunPage,
})

function RunPage() {
  const { runs, loading, error } = useHistoryRuns()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const initialRunId = useMemo(() => search.run || runs[0]?.run_id || '', [search.run, runs])
  const [selectedRun, setSelectedRun] = useState(initialRunId)

  useEffect(() => {
    setSelectedRun(initialRunId)
  }, [initialRunId])

  const run = runs.find((entry) => entry.run_id === selectedRun) ?? runs[0]

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>
  if (!run) return <InfoState tone="neutral">No runs available yet.</InfoState>

  const status = runStatus(run)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ReportShell
        title="Runs"
        description="Inspect one run with checker and item timelines."
        actions={
          <p className="rounded-md border border-zinc-200/80 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {run.checks?.length ?? 0} checker{(run.checks?.length ?? 0) === 1 ? '' : 's'} on selected run
          </p>
        }
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Select Run</p>
            <Select
              value={run.run_id}
              onChange={(e) => {
                const next = e.target.value
                setSelectedRun(next)
                navigate({ to: '/run', search: { run: next }, replace: true })
              }}
            >
              {runs.map((entry) => (
                <option key={`${entry.run_id}-${entry.timestamp}`} value={entry.run_id}>
                  {entry.run_id} · {entry.timestamp}
                </option>
              ))}
            </Select>
          </Card>

          <ReportSection title="Metadata" contentClassName="pt-2">
            <ReportKeyValueList
              items={[
                { keyLabel: 'Status', value: <StatusBadge status={status} /> },
                { keyLabel: 'Branch', value: run.branch || '-' },
                { keyLabel: 'PR', value: run.pr != null ? `#${run.pr}` : '-' },
                { keyLabel: 'SHA', value: <code className="text-xs">{run.sha || '-'}</code> },
                { keyLabel: 'Duration', value: `${runDuration(run).toFixed(1)}s` },
                { keyLabel: 'Timestamp', value: formatDateTime(run.timestamp) },
              ]}
            />
          </ReportSection>
        </div>

        {(run.checks || []).length === 0 ? (
          <ReportSection title="Checks" description="No checks were reported for this run.">
            <ReportEmptyState title="No checker timeline to display." />
          </ReportSection>
        ) : (
          <div className="space-y-4">
            {(run.checks || []).map((check) => (
              <CheckSection key={check.tool} check={check} run={run} />
            ))}
          </div>
        )}
      </ReportShell>
    </div>
  )
}

function CheckSection({ check, run }: { check: RunCheck; run: RunRecord }) {
  const items = check.items || []

  return (
    <ReportSection
      title={check.tool}
      description={`${items.length} item${items.length === 1 ? '' : 's'} • Run ${run.run_id}`}
      actions={<StatusBadge status={check.status} />}
    >
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No check items.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemTimelineCard key={`${check.tool}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </ReportSection>
  )
}

function ItemTimelineCard({ item }: { item: RunItem }) {
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/90 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <code className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{item.id}</code>
        <StatusBadge status={item.status} />
      </div>
      <p className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">{item.message || '-'}</p>

      {(item.stdout || item.stderr) && (
        <details className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer">Logs</summary>
          {item.stdout && (
            <pre className="mt-2 overflow-x-auto rounded-md border border-zinc-300 bg-zinc-100 p-2 text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              {item.stdout}
            </pre>
          )}
          {item.stderr && (
            <pre className="mt-2 overflow-x-auto rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-100">
              {item.stderr}
            </pre>
          )}
        </details>
      )}
    </div>
  )
}

function InfoState({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <Card
      className={`m-4 p-6 text-sm sm:m-6 lg:m-8 ${
        tone === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-600 dark:text-zinc-300'
      }`}
    >
      {children}
    </Card>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
