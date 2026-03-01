import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { RunsPageContent } from '../components/runs-page-content'
import { useHistoryRuns } from '../lib/history'

export const Route = createFileRoute('/pr')({
  validateSearch: (search) => ({
    group: typeof search.group === 'string' ? search.group : '',
  }),
  component: PRPage,
})

function PRPage() {
  const { runs, loading, error } = useHistoryRuns()
  const search = Route.useSearch()
  const prRuns = useMemo(() => runs.filter((run) => run.pr != null), [runs])

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>

  return (
    <RunsPageContent
      title="Pull Request Runs"
      description="Execution history for PR-associated runs."
      runs={prRuns}
      group={search.group}
    />
  )
}

function InfoState({ children, tone }: { children: ReactNode; tone: 'neutral' | 'danger' }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-6 text-sm ${tone === 'danger' ? 'text-destructive' : 'text-muted-foreground'}`}>
      {children}
    </div>
  )
}
