import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { runStatus, useHistoryRuns, type RunRecord } from '../lib/history'
import { cn } from '../lib/utils'

const RANGE_OPTIONS = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 0, label: 'All' },
]

export const Route = createFileRoute('/trends')({ component: TrendsPage })

function TrendsPage() {
  const { runs, loading, error } = useHistoryRuns()
  const [days, setDays] = useState(30)

  const windowedRuns = useMemo(() => {
    if (days === 0) return runs
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return runs.filter((run) => new Date(run.timestamp) >= cutoff)
  }, [runs, days])

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; passed: number; failed: number; runs: RunRecord[] }>()
    for (const run of windowedRuns) {
      const day = run.timestamp.slice(0, 10)
      const current = map.get(day) ?? { total: 0, passed: 0, failed: 0, runs: [] }
      current.total += 1
      current.runs.push(run)
      if (runStatus(run) === 'passed') {
        current.passed += 1
      } else {
        current.failed += 1
      }
      map.set(day, current)
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [windowedRuns])

  const rolling = useMemo(() => {
    if (byDay.length === 0) return { passRate: 0, total: 0, maxRunsInDay: 0, avgPerDay: 0 }
    const total = byDay.reduce((acc, [, d]) => acc + d.total, 0)
    const passed = byDay.reduce((acc, [, d]) => acc + d.passed, 0)
    const maxRunsInDay = byDay.reduce((acc, [, d]) => Math.max(acc, d.total), 0)
    const avgPerDay = byDay.length ? Math.round(total / byDay.length * 10) / 10 : 0
    return { passRate: total ? Math.round((passed / total) * 100) : 0, total, maxRunsInDay, avgPerDay }
  }, [byDay])

  const checkerBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; passed: number; failed: number }>()
    for (const run of windowedRuns) {
      for (const check of run.checks || []) {
        const current = map.get(check.tool) ?? { total: 0, passed: 0, failed: 0 }
        current.total += 1
        if (check.status === 'passed') current.passed += 1
        else current.failed += 1
        map.set(check.tool, current)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
  }, [windowedRuns])

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trends</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {byDay.length} day{byDay.length !== 1 ? 's' : ''} sampled · {rolling.total} runs
          </p>
        </div>
        <div className="flex flex-wrap text-xs border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={cn(
                'px-3 py-1.5',
                days === opt.value
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Window" value={`${byDay.length} days`} />
        <MetricCard label="Total Runs" value={`${rolling.total}`} />
        <MetricCard
          label="Pass Rate"
          value={`${rolling.passRate}%`}
          tone={rolling.passRate >= 80 ? 'emerald' : rolling.passRate >= 50 ? 'amber' : 'rose'}
        />
        <MetricCard label="Peak Day Volume" value={`${rolling.maxRunsInDay}`} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Daily Timeline */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Daily Pass Rate</h2>
          {byDay.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No trend data available.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {byDay.map(([day, stats]) => (
                <DayRow key={day} day={day} stats={stats} />
              ))}
            </div>
          )}
        </section>

        {/* Checker Breakdown */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Checker Breakdown</h2>
          {checkerBreakdown.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No checker data available.</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900 space-y-2">
              {checkerBreakdown.map(([tool, stats]) => {
                const maxCount = checkerBreakdown[0]?.[1]?.total || 1
                const passRate = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
                return (
                  <div key={tool} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-gray-700 dark:text-gray-300 truncate font-mono">{tool}</span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded',
                          passRate >= 80 ? 'bg-emerald-500/70 dark:bg-emerald-400/60' :
                          passRate >= 50 ? 'bg-amber-500/70 dark:bg-amber-400/60' :
                          'bg-rose-500/70 dark:bg-rose-400/60'
                        )}
                        style={{ width: `${(stats.total / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right">
                      {passRate}% · {stats.total}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6">
        <MetricCard label="Avg Runs / Day" value={`${rolling.avgPerDay}`} />
        <MetricCard label="Active Checkers" value={`${checkerBreakdown.length}`} />
        <MetricCard
          label="Failing Checkers"
          value={`${checkerBreakdown.filter(([, s]) => s.failed > 0).length}`}
          tone={checkerBreakdown.filter(([, s]) => s.failed > 0).length > 0 ? 'rose' : 'emerald'}
        />
      </div>
    </div>
  )
}

function DayRow({ day, stats }: { day: string; stats: { total: number; passed: number; failed: number } }) {
  const pct = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
  const toneClass = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className="rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{day}</span>
        <span>{stats.passed}/{stats.total} passed</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div className={`h-2 rounded-full transition-all ${toneClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">{stats.failed} failing</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'rose' | 'amber' }) {
  const borderColor =
    tone === 'emerald' ? 'border-emerald-200 dark:border-emerald-900' :
    tone === 'rose' ? 'border-rose-200 dark:border-rose-900' :
    tone === 'amber' ? 'border-amber-200 dark:border-amber-900' :
    'border-gray-200 dark:border-gray-800'

  return (
    <div className={`rounded-lg border ${borderColor} bg-white dark:bg-gray-900 p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}

function InfoState({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <div className={`m-4 sm:m-6 lg:m-8 rounded-xl border border-gray-200/80 bg-white/95 p-6 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900/90 ${
      tone === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300'
    }`}>
      {children}
    </div>
  )
}
