import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ReportEmptyState, ReportKeyValueList, ReportSection, ReportShell } from '../components/report'
import { Card } from '../components/ui/card'
import { StatusBadge } from '../components/status-badge'
import { runDuration, runStatus, useHistoryRuns, type RunCheck, type RunItem, type RunRecord } from '../lib/history'

export const Route = createFileRoute('/run')({
  validateSearch: (search) => ({
    run: typeof search.run === 'string' ? search.run : '',
  }),
  component: RunsPage,
})

function RunsPage() {
  const { runs, loading, error } = useHistoryRuns()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [selectedRun, setSelectedRun] = useState('')

  useEffect(() => {
    if (!runs.length) return
    const next = search.run || runs[0].run_id
    setSelectedRun(next)
  }, [runs, search.run])

  const current = useMemo(() => {
    if (!runs.length) return undefined
    return runs.find((entry) => entry.run_id === selectedRun) ?? runs[0]
  }, [runs, selectedRun])

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>
  if (!current) return <InfoState tone="neutral">No runs available yet.</InfoState>

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ReportShell
        title="Runs"
        description="Run listing and per-run checker details."
        actions={
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {runs.length} runs found
          </p>
        }
      >
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Checks</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {runs.slice(0, 200).map((run) => {
                  const isActive = run.run_id === current.run_id
                  return (
                    <tr
                      key={`${run.run_id}-${run.timestamp}`}
                      className={`cursor-pointer text-gray-700 transition-colors dark:text-gray-300 ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                      onClick={() => {
                        setSelectedRun(run.run_id)
                        navigate({ to: '/run', search: { run: run.run_id }, replace: true })
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {run.run_id}
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{run.pr != null ? `PR #${run.pr}` : 'No PR'}</div>
                      </td>
                      <td className="px-4 py-3">{run.branch || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={runStatus(run)} /></td>
                      <td className="px-4 py-3">{run.checks?.length ?? 0}</td>
                      <td className="px-4 py-3">{runDuration(run).toFixed(1)}s</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDateTime(run.timestamp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <ReportSection title="Selected Run" description={current.run_id}>
            <ReportKeyValueList
              items={[
                { keyLabel: 'Status', value: <StatusBadge status={runStatus(current)} /> },
                { keyLabel: 'Branch', value: current.branch || '-' },
                { keyLabel: 'PR', value: current.pr != null ? `#${current.pr}` : '-' },
                { keyLabel: 'SHA', value: <code className="text-xs">{current.sha || '-'}</code> },
                { keyLabel: 'Duration', value: `${runDuration(current).toFixed(1)}s` },
                { keyLabel: 'Timestamp', value: formatDateTime(current.timestamp) },
              ]}
            />
          </ReportSection>
          <ReportSection
            title="Summary"
            description={`${current.checks?.length ?? 0} checker${(current.checks?.length ?? 0) === 1 ? '' : 's'}`}
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Click a run row above to inspect full checker output below.
            </p>
          </ReportSection>
        </div>

        {(current.checks || []).length === 0 ? (
          <ReportSection title="Checks" description="No checks were reported for this run.">
            <ReportEmptyState title="No checker timeline to display." />
          </ReportSection>
        ) : (
          <div className="space-y-4">
            {(current.checks || []).map((check) => (
              <CheckSection key={check.tool} check={check} run={current} />
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
        <p className="text-sm text-gray-500 dark:text-gray-400">No check items.</p>
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
    <div className="rounded-lg border border-gray-200/80 bg-gray-50/90 p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <code className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">{item.id}</code>
        <StatusBadge status={item.status} />
      </div>
      <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">{item.message || '-'}</p>

      {(item.stdout || item.stderr) && (
        <details className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          <summary className="cursor-pointer">Logs</summary>
          {item.stdout && (
            <pre className="mt-2 overflow-x-auto rounded-md border border-gray-300 bg-gray-100 p-2 text-[11px] text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
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
        tone === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300'
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
