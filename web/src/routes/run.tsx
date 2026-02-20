import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { StatusBadge } from '../components/status-badge'
import { runDuration, useHistoryRuns } from '../lib/history'

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

  if (loading) return <Card className="m-4 p-6 text-sm text-gray-600 sm:m-6 lg:m-8">Loading history...</Card>
  if (error) return <Card className="m-4 p-6 text-sm text-rose-700 sm:m-6 lg:m-8">Failed to load history: {error}</Card>
  if (!run) return <Card className="m-4 p-6 text-sm text-gray-600 sm:m-6 lg:m-8">No runs available yet.</Card>

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="grid gap-3 p-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Run Detail</h1>
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

        <Card className="p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Metadata</p>
          <div className="grid gap-2 text-sm">
            <p className="text-gray-700 dark:text-gray-200"><span className="text-gray-500">Branch:</span> {run.branch || '-'}</p>
            <p className="text-gray-700 dark:text-gray-200"><span className="text-gray-500">PR:</span> {run.pr != null ? `#${run.pr}` : '-'}</p>
            <p className="text-gray-700 dark:text-gray-200"><span className="text-gray-500">SHA:</span> {run.sha || '-'}</p>
            <p className="text-gray-700 dark:text-gray-200"><span className="text-gray-500">Duration:</span> {runDuration(run).toFixed(1)}s</p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {(run.checks || []).map((check) => (
          <Card key={check.tool} className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{check.tool}</h2>
                <StatusBadge status={check.status} />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{(check.items || []).length} items</span>
            </div>

            {(check.items || []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No check items.</p>
            ) : (
              <div className="space-y-2">
                {(check.items || []).map((item) => (
                  <div key={`${check.tool}-${item.id}`} className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <code className="text-xs text-gray-700 dark:text-gray-200">{item.id}</code>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">{item.message || '-'}</p>
                    {(item.stdout || item.stderr) && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-gray-500 dark:text-gray-400">Logs</summary>
                        {item.stdout && (
                          <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-2 text-[11px] text-gray-100">{item.stdout}</pre>
                        )}
                        {item.stderr && (
                          <pre className="mt-2 overflow-x-auto rounded bg-rose-950/80 p-2 text-[11px] text-rose-100">{item.stderr}</pre>
                        )}
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
