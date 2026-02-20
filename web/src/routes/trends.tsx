import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Card } from '../components/ui/card'
import { runStatus, useHistoryRuns } from '../lib/history'

export const Route = createFileRoute('/trends')({ component: TrendsPage })

function TrendsPage() {
  const { runs, loading, error } = useHistoryRuns()

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; passed: number }>()
    for (const run of runs) {
      const day = run.timestamp.slice(0, 10)
      const current = map.get(day) ?? { total: 0, passed: 0 }
      current.total += 1
      if (runStatus(run) === 'passed') current.passed += 1
      map.set(day, current)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [runs])

  if (loading) return <Card className="p-6 text-sm text-slate-600">Loading history...</Card>
  if (error) return <Card className="p-6 text-sm text-rose-700">Failed to load history: {error}</Card>

  return (
    <Card className="p-4">
      <h2 className="text-lg font-bold">Daily Pass Rate</h2>
      <p className="text-sm text-slate-600">Simple trend view by day</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Runs</th>
              <th className="px-3 py-2">Pass Rate</th>
            </tr>
          </thead>
          <tbody>
            {byDay.map(([day, stats]) => {
              const pct = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
              return (
                <tr key={day} className="border-t border-slate-100">
                  <td className="px-3 py-2">{day}</td>
                  <td className="px-3 py-2">{stats.total}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-40 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
