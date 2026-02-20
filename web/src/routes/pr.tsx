import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { FilterBar } from '../components/filter-bar'
import { StatusBadge } from '../components/status-badge'
import { Card } from '../components/ui/card'
import { defaultFilters, filterRuns, runStatus, useHistoryRuns, useRunOptions } from '../lib/history'

export const Route = createFileRoute('/pr')({ component: PRPage })

function PRPage() {
  const { runs, loading, error } = useHistoryRuns()
  const [filters, setFilters] = useState(defaultFilters)
  const options = useRunOptions(runs)
  const filtered = useMemo(() => filterRuns(runs, filters), [runs, filters])

  const groups = useMemo(() => {
    const map = new Map<number, typeof filtered>()
    for (const run of filtered) {
      if (run.pr == null) continue
      if (!map.has(run.pr)) map.set(run.pr, [])
      map.get(run.pr)!.push(run)
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [filtered])

  return (
    <section className="grid gap-4">
      <FilterBar
        filters={filters}
        options={options}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(defaultFilters)}
      />

      {loading && <Card className="p-6 text-sm text-gray-600">Loading history...</Card>}
      {error && <Card className="p-6 text-sm text-rose-700">Failed to load history: {error}</Card>}

      {!loading && !error && groups.length === 0 && (
        <Card className="p-6 text-sm text-gray-600">No PR runs found with current filters.</Card>
      )}

      {!loading && !error && groups.map(([pr, prRuns]) => (
        <Card key={pr} className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-black">PR #{pr}</h3>
            <StatusBadge status={runStatus(prRuns[0])} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2">Run</th>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">SHA</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {prRuns.map((run) => (
                  <tr key={run.run_id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{run.run_id}</td>
                    <td className="px-3 py-2">{run.timestamp}</td>
                    <td className="px-3 py-2 font-mono text-xs">{run.sha}</td>
                    <td className="px-3 py-2"><StatusBadge status={runStatus(run)} /></td>
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
