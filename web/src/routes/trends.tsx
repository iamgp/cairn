import { createFileRoute } from '@tanstack/react-router'
import { useMemo, type ReactNode } from 'react'
import {
  ReportEmptyState,
  ReportMetricCard,
  ReportMetricGrid,
  ReportSection,
  ReportShell,
} from '../components/report'
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
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 30)
  }, [runs])

  const rolling = useMemo(() => {
    if (byDay.length === 0) return { passRate: 0, total: 0, maxRunsInDay: 0 }
    const total = byDay.reduce((acc, [, d]) => acc + d.total, 0)
    const passed = byDay.reduce((acc, [, d]) => acc + d.passed, 0)
    const maxRunsInDay = byDay.reduce((acc, [, d]) => Math.max(acc, d.total), 0)
    return { passRate: total ? Math.round((passed / total) * 100) : 0, total, maxRunsInDay }
  }, [byDay])

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ReportShell
        title="Trends"
        description="Daily pass-rate movement and run volume over the latest 30-day window."
        actions={
          <p className="rounded-md border border-zinc-200/80 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {byDay.length} day{byDay.length === 1 ? '' : 's'} sampled
          </p>
        }
      >
        <ReportMetricGrid className="xl:grid-cols-4">
          <ReportMetricCard label="Window" value={`${byDay.length} days`} />
          <ReportMetricCard label="Runs" value={`${rolling.total}`} />
          <ReportMetricCard
            label="Pass Rate"
            value={`${rolling.passRate}%`}
            trend={rolling.passRate >= 80 ? 'healthy' : 'watch'}
            trendVariant={rolling.passRate >= 80 ? 'success' : 'warning'}
          />
          <ReportMetricCard label="Peak Day Volume" value={`${rolling.maxRunsInDay}`} />
        </ReportMetricGrid>

        <ReportSection title="Daily Timeline" description="Each row shows pass ratio and total run count for a date.">
          {byDay.length === 0 ? (
            <ReportEmptyState title="No trend data available." />
          ) : (
            <div className="space-y-2">
              {byDay.map(([day, stats]) => (
                <TimelineRow key={day} day={day} stats={stats} />
              ))}
            </div>
          )}
        </ReportSection>
      </ReportShell>
    </div>
  )
}

function TimelineRow({ day, stats }: { day: string; stats: { total: number; passed: number; failed: number } }) {
  const pct = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
  const toneClass = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/90 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{day}</span>
        <span>
          {stats.passed}/{stats.total} passed
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-2 rounded-full transition-all ${toneClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">{stats.failed} failing</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pct}%</span>
      </div>
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
