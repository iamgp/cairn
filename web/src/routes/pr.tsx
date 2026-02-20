import { Link, createFileRoute } from '@tanstack/react-router'
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

  if (loading) {
    return <Card className="m-4 p-6 text-sm text-gray-600 sm:m-6 lg:m-8">Loading history...</Card>
  }

  if (error) {
    return <Card className="m-4 p-6 text-sm text-rose-700 sm:m-6 lg:m-8">Failed to load history: {error}</Card>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pull Request Runs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{groups.length} PR groups in current view</p>
      </div>

      <div className="mb-6">
        <FilterBar
          filters={filters}
          options={options}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters(defaultFilters)}
        />
      </div>

      {groups.length === 0 ? (
        <Card className="p-6 text-sm text-gray-600">No PR runs found with current filters.</Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([pr, prRuns]) => (
            <Card key={pr} className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">PR #{pr}</h2>
                  <StatusBadge status={runStatus(prRuns[0])} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{prRuns.length} run{prRuns.length === 1 ? '' : 's'}</p>
              </div>

              <div className="space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
                {prRuns.map((run) => (
                  <Link
                    key={`${pr}-${run.run_id}-${run.timestamp}`}
                    to="/run"
                    search={{ run: run.run_id }}
                    className="block rounded-md border border-gray-200 bg-gray-50 p-3 transition hover:border-blue-300 hover:bg-white dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{run.run_id}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(run.timestamp)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">{run.branch || 'no branch'}</span>
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">{run.sha ? run.sha.slice(0, 8) : 'no sha'}</span>
                      <StatusBadge status={runStatus(run)} />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
