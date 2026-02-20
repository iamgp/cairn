import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { StatusBadge } from '../components/status-badge'
import { useHistoryRuns } from '../lib/history'

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

  if (loading) return <Card className="p-6 text-sm text-gray-600">Loading history...</Card>
  if (error) return <Card className="p-6 text-sm text-rose-700">Failed to load history: {error}</Card>
  if (!run) return <Card className="p-6 text-sm text-gray-600">No runs available yet.</Card>

  return (
    <section className="grid gap-4">
      <Card className="grid gap-3 p-4">
        <h2 className="text-lg font-bold">Run Detail</h2>
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

      {(run.checks || []).map((check) => (
        <Card key={check.tool} className="grid gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{check.tool}</h3>
            <StatusBadge status={check.status} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {(check.items || []).map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{item.id}</td>
                    <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                    <td className="px-3 py-2 whitespace-pre-wrap text-xs text-gray-700">{item.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </section>
  )
}
