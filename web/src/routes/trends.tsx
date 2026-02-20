import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Card } from '../components/ui/card'
import { runStatus, useHistoryRuns } from '../lib/history'

export const Route = createFileRoute('/trends')({ component: TrendsPage })

function TrendsPage() {
  const { runs, loading, error } = useHistoryRuns()

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; passed: number; failed: number }>()
    for (const run of runs) {
      const day = run.timestamp.slice(0, 10)
      const current = map.get(day) ?? { total: 0, passed: 0, failed: 0 }
      current.total += 1
      if (runStatus(run) === 'passed') {
        current.passed += 1
      } else {
        current.failed += 1
      }
      map.set(day, current)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 30)
  }, [runs])

  const rolling = useMemo(() => {
    if (byDay.length === 0) return { passRate: 0, total: 0 }
    const total = byDay.reduce((acc, [, d]) => acc + d.total, 0)
    const passed = byDay.reduce((acc, [, d]) => acc + d.passed, 0)
    return { passRate: total ? Math.round((passed / total) * 100) : 0, total }
  }, [byDay])

  if (loading) return <Card className="m-4 p-6 text-sm text-gray-600 sm:m-6 lg:m-8">Loading history...</Card>
  if (error) return <Card className="m-4 p-6 text-sm text-rose-700 sm:m-6 lg:m-8">Failed to load history: {error}</Card>

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Run Trends</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Last 30 days summary and daily performance timeline</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Window" value={`${byDay.length} days`} />
        <Metric label="Runs" value={`${rolling.total}`} />
        <Metric label="Pass Rate" value={`${rolling.passRate}%`} tone={rolling.passRate >= 80 ? 'ok' : 'warn'} />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Daily Timeline</h2>
        {byDay.length === 0 ? (
          <p className="text-sm text-gray-600">No trend data available.</p>
        ) : (
          <div className="space-y-2">
            {byDay.map(([day, stats]) => {
              const pct = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
              return (
                <div key={day} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{day}</span>
                    <span>{stats.passed}/{stats.total} passed</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className={`h-2 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{pct}%</p>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const color =
    tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-gray-900 dark:text-gray-100'

  return (
    <Card className="p-4">
      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </Card>
  )
}
