import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { StatusBadge } from '../components/status-badge'
import { runDuration, runStatus, useHistoryRuns, type RunCheck, type RunItem, type RunRecord } from '../lib/history'
import { cn, formatDayLabel, relativeTime } from '../lib/utils'

export const Route = createFileRoute('/run')({
  validateSearch: (search) => ({
    run: typeof search.run === 'string' ? search.run : '',
    sha: typeof search.sha === 'string' ? search.sha : '',
  }),
  component: RunsPage,
})

function RunsPage() {
  const { runs, loading, error } = useHistoryRuns()
  const search = Route.useSearch()

  if (loading) return <InfoState tone="neutral">Loading history...</InfoState>
  if (error) return <InfoState tone="danger">Failed to load history: {error}</InfoState>
  if (!runs.length) return <InfoState tone="neutral">No runs available yet.</InfoState>

  if (search.run) {
    const run = runs.find((r) => {
      if (r.run_id !== search.run) return false
      if (!search.sha) return true
      return (r.sha_full || r.sha) === search.sha
    })
    if (run) return <RunDetailPage run={run} allRuns={runs} />
  }

  return <RunListPage runs={runs} />
}

// ─── Run List (timeline) ────────────────────────────────────────────────────

const checkerColors = [
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400',
]

function checkerColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return checkerColors[Math.abs(hash) % checkerColors.length]
}

function groupByDate(runs: RunRecord[]): Map<string, RunRecord[]> {
  const groups = new Map<string, RunRecord[]>()
  for (const run of runs) {
    const day = run.timestamp.split('T')[0]
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(run)
  }
  return groups
}

function RunListPage({ runs }: { runs: RunRecord[] }) {
  const grouped = groupByDate(runs)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Run Timeline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{runs.length} runs</p>
      </div>

      <div className="ml-2 border-l-2 border-gray-200 dark:border-gray-800 sm:ml-4">
        {Array.from(grouped.entries()).map(([dateStr, dayRuns]) => (
          <div key={dateStr}>
            <div className="relative flex items-center -ml-3 mb-4 mt-6 first:mt-0">
              <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 border-2 border-white dark:border-gray-950 flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                {formatDayLabel(dateStr)}
              </span>
            </div>

            {dayRuns.map((run, i) => {
              const status = runStatus(run)
              return (
                <div key={`${run.run_id}-${run.timestamp}-${i}`} className="pl-8 relative mb-4">
                  <span className={cn(
                    'absolute left-[-5px] top-2 w-2 h-2 rounded-full',
                    status === 'passed' ? 'bg-emerald-500' :
                    status === 'failed' || status === 'error' ? 'bg-rose-500' :
                    status === 'skipped' ? 'bg-amber-500' : 'bg-gray-400',
                  )} />
                  <Link
                    to="/run"
                    search={{ run: run.run_id }}
                    className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <StatusBadge status={status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{run.run_id}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(run.checks || []).map((check) => (
                            <span key={check.tool} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${checkerColor(check.tool)}`}>
                              {check.tool}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {run.branch || 'no branch'} · {run.checks?.length ?? 0} checks · {runDuration(run).toFixed(1)}s · {relativeTime(run.timestamp)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Run Detail Page (Allure-style) ─────────────────────────────────────────

type SelectedItem = { checker: string; index: number }

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'passed', label: 'Passed', dot: 'bg-emerald-500' },
  { value: 'failed', label: 'Failed', dot: 'bg-rose-500' },
  { value: 'skipped', label: 'Skipped', dot: 'bg-amber-500' },
] as const

function statusDot(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'passed') return 'bg-emerald-500'
  if (s === 'failed' || s === 'error') return 'bg-rose-500'
  if (s === 'skipped') return 'bg-amber-500'
  return 'bg-gray-400'
}

function statusIcon(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'passed') return (
    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
  if (s === 'failed' || s === 'error') return (
    <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
  if (s === 'skipped') return (
    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
    </svg>
  )
  return <span className="w-3.5 h-3.5 rounded-full bg-gray-400 inline-block" />
}

function formatDuration(seconds?: number): string {
  if (seconds == null || seconds <= 0) return '-'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${seconds.toFixed(2)}s`
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(0)
  return `${m}m ${s}s`
}

function formatCoverageMetric(metric?: { covered: number; total: number; percent: number }): string {
  if (!metric) return '-'
  return `${metric.covered}/${metric.total} (${metric.percent.toFixed(1)}%)`
}

function RunDetailPage({ run, allRuns }: { run: RunRecord; allRuns: RunRecord[] }) {
  const status = runStatus(run)
  const checks = run.checks || []
  const environment = run.metadata?.environment
  const actor = run.metadata?.actor
  const reproducibility = run.metadata?.reproducibility
  const traceability = run.metadata?.traceability
  const artifacts = run.metadata?.provenance?.artifacts || []
  const overallCoverage = run.metadata?.coverage?.overall
  const perCheckCoverage = run.metadata?.coverage?.per_check || {}
  const perCheckCoverageRows = Object.entries(perCheckCoverage).sort(([a], [b]) => a.localeCompare(b))
  const toolVersions = Object.entries(reproducibility?.tool_versions || {}).sort(([a], [b]) => a.localeCompare(b))
  const dependencyHashes = Object.entries(reproducibility?.dependency_hashes || {}).sort(([a], [b]) => a.localeCompare(b))
  const hasEnvironment = Boolean(
    environment?.provider ||
    environment?.repository ||
    environment?.workflow ||
    environment?.job ||
    environment?.runner_os ||
    environment?.runner_arch ||
    environment?.runner_name,
  )
  const hasActor = Boolean(
    actor?.login ||
    actor?.triggering_login ||
    actor?.committer_name ||
    actor?.committer_email,
  )
  const hasReproducibility = Boolean(toolVersions.length > 0 || dependencyHashes.length > 0 || reproducibility?.config_sha256)
  const hasTraceability = Boolean(
    traceability?.commit_message ||
    (traceability?.requirement_ids && traceability.requirement_ids.length > 0) ||
    (traceability?.spec_ids && traceability.spec_ids.length > 0) ||
    (traceability?.risk_ids && traceability.risk_ids.length > 0),
  )
  const hasProvenance = artifacts.length > 0
  const hasCoverage = Boolean(overallCoverage || perCheckCoverageRows.length > 0)

  const allItems = useMemo(() => {
    const items: { checker: string; item: RunItem; index: number }[] = []
    for (const check of checks) {
      for (let i = 0; i < (check.items || []).length; i++) {
        items.push({ checker: check.tool, item: check.items![i], index: i })
      }
    }
    return items
  }, [checks])

  const counts = useMemo(() => {
    let passed = 0, failed = 0, skipped = 0
    for (const { item } of allItems) {
      const s = (item.status || '').toLowerCase()
      if (s === 'passed') passed++
      else if (s === 'failed' || s === 'error') failed++
      else if (s === 'skipped') skipped++
    }
    return { passed, failed, skipped, total: allItems.length }
  }, [allItems])

  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (selected || checks.length === 0) return
    for (const check of checks) {
      const failIndex = (check.items || []).findIndex((item) => ['failed', 'error'].includes((item.status || '').toLowerCase()))
      if (failIndex >= 0) {
        setSelected({ checker: check.tool, index: failIndex })
        return
      }
    }
    const firstWithItems = checks.find((check) => (check.items || []).length > 0)
    if (firstWithItems) setSelected({ checker: firstWithItems.tool, index: 0 })
  }, [selected, checks])

  const selectedItem = useMemo(() => {
    if (!selected) return null
    const check = checks.find((c) => c.tool === selected.checker)
    if (!check) return null
    const item = check.items?.[selected.index]
    if (!item) return null
    return { checker: selected.checker, item, check }
  }, [selected, checks])

  const matrixGrid = useMemo(() => {
    if (!run.matrix || Object.keys(run.matrix).length === 0) return null
    const sha = run.sha_full || run.sha
    const siblings = allRuns.filter((r) => {
      if ((r.sha_full || r.sha) !== sha) return false
      return r.matrix && Object.keys(r.matrix).length > 0
    })
    if (siblings.length <= 1) return null
    const allCheckers = new Set<string>()
    for (const r of siblings) {
      for (const c of r.checks || []) allCheckers.add(c.tool)
    }
    const dimensionKeys = Object.keys(run.matrix)
    const matrixLabel = dimensionKeys.join(', ')
    const rows = siblings.map((r) => {
      const configLabel = dimensionKeys.map((k) => r.matrix?.[k] ?? '-').join(', ')
      const checkerStatuses = new Map<string, string>()
      for (const c of r.checks || []) checkerStatuses.set(c.tool, (c.status || '').toLowerCase())
      return { configLabel, checkerStatuses, isCurrent: r.run_id === run.run_id }
    })
    return { matrixLabel, checkers: Array.from(allCheckers).sort(), rows }
  }, [run, allRuns])

  const toggleCollapse = (tool: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(tool)) next.delete(tool)
      else next.add(tool)
      return next
    })
  }

  const matchesFilter = (item: RunItem) => {
    if (statusFilter !== 'all') {
      const s = (item.status || '').toLowerCase()
      if (statusFilter === 'failed' && s !== 'failed' && s !== 'error') return false
      if (statusFilter === 'passed' && s !== 'passed') return false
      if (statusFilter === 'skipped' && s !== 'skipped') return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!item.id.toLowerCase().includes(q) && !(item.message || '').toLowerCase().includes(q)) return false
    }
    return true
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Back link */}
      {run.pr != null ? (
        <Link
          to="/pr"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Pull Requests
        </Link>
      ) : (
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Main Branch
        </Link>
      )}

      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{run.run_id}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {checks.length} check{checks.length !== 1 ? 's' : ''} · {runDuration(run).toFixed(1)}s total · {relativeTime(run.timestamp)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{counts.passed}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" />{counts.failed}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />{counts.skipped}</span>
        </div>
      </div>

      {/* Run metadata strip */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 pb-4">
        <span>Branch: <span className="font-medium text-gray-700 dark:text-gray-300">{run.branch || '-'}</span></span>
        {run.pr != null && <span>PR: <span className="font-medium text-gray-700 dark:text-gray-300">#{run.pr}</span></span>}
        <span>SHA: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{run.sha || '-'}</span></span>
        <span>{new Date(run.timestamp).toLocaleString()}</span>
        {run.matrix && Object.keys(run.matrix).length > 0 && Object.entries(run.matrix).map(([k, v]) => (
          <span key={k} className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-mono">
            {k}: {v}
          </span>
        ))}
      </div>

      {(hasTraceability || hasProvenance || hasCoverage || hasEnvironment || hasActor || hasReproducibility) && (
        <div className="mb-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {hasEnvironment && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Environment</h2>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <p>Provider: <span className="font-medium">{environment?.provider || '-'}</span></p>
                <p>Repository: <span className="font-medium">{environment?.repository || '-'}</span></p>
                <p>Workflow: <span className="font-medium">{environment?.workflow || '-'}</span></p>
                <p>Job: <span className="font-medium">{environment?.job || '-'}</span></p>
                <p>Runner: <span className="font-medium">{environment?.runner_os || '-'} / {environment?.runner_arch || '-'}</span></p>
                {environment?.runner_name && <p>Name: <span className="font-medium">{environment.runner_name}</span></p>}
              </div>
            </section>
          )}

          {hasActor && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Actor</h2>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <p>Triggered by: <span className="font-medium">{actor?.triggering_login || actor?.login || '-'}</span></p>
                <p>Actor: <span className="font-medium">{actor?.login || '-'}</span></p>
                {actor?.id && <p>Actor ID: <span className="font-mono">{actor.id}</span></p>}
                {actor?.committer_name && <p>Committer: <span className="font-medium">{actor.committer_name}</span></p>}
                {actor?.committer_email && <p>Email: <span className="font-mono">{actor.committer_email}</span></p>}
              </div>
            </section>
          )}

          {hasReproducibility && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Reproducibility</h2>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                {toolVersions.length > 0 && (
                  <div>
                    <p className="mb-1 text-gray-500 dark:text-gray-400">Tool Versions</p>
                    <div className="flex flex-wrap gap-1">
                      {toolVersions.map(([tool, version]) => (
                        <span key={`tool-${tool}`} className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {tool}={version}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {dependencyHashes.length > 0 && (
                  <div>
                    <p className="mb-1 text-gray-500 dark:text-gray-400">Dependency Hashes</p>
                    <div className="space-y-1">
                      {dependencyHashes.slice(0, 3).map(([name, hash]) => (
                        <p key={`dep-${name}`} className="font-mono text-gray-500 dark:text-gray-400 truncate">{name}: {hash}</p>
                      ))}
                      {dependencyHashes.length > 3 && <p className="text-gray-500 dark:text-gray-400">+{dependencyHashes.length - 3} more</p>}
                    </div>
                  </div>
                )}
                {reproducibility?.config_sha256 && (
                  <p className="font-mono text-gray-500 dark:text-gray-400 truncate">config_sha256: {reproducibility.config_sha256}</p>
                )}
              </div>
            </section>
          )}

          {hasTraceability && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Traceability</h2>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                {traceability?.commit_message && (
                  <p className="break-words">
                    <span className="text-gray-500 dark:text-gray-400">Commit:</span>{' '}
                    <span className="font-medium">{traceability.commit_message}</span>
                  </p>
                )}
                {(traceability?.requirement_ids || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {(traceability?.requirement_ids || []).map((id) => (
                      <span key={`req-${id}`} className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-blue-700 dark:bg-blue-950 dark:text-blue-300">{id}</span>
                    ))}
                  </div>
                )}
                {(traceability?.spec_ids || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {(traceability?.spec_ids || []).map((id) => (
                      <span key={`spec-${id}`} className="rounded-full bg-indigo-100 px-2 py-0.5 font-mono text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{id}</span>
                    ))}
                  </div>
                )}
                {(traceability?.risk_ids || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {(traceability?.risk_ids || []).map((id) => (
                      <span key={`risk-${id}`} className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-rose-700 dark:bg-rose-950 dark:text-rose-300">{id}</span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {hasProvenance && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Provenance</h2>
              <div className="space-y-2">
                {artifacts.slice(0, 4).map((artifact, index) => (
                  <div key={`${artifact.path || 'artifact'}-${index}`} className="rounded border border-gray-200 dark:border-gray-800 p-2 text-xs">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{artifact.role || 'artifact'}</p>
                    <p className="font-mono text-gray-500 dark:text-gray-400 truncate">{artifact.path || '-'}</p>
                    <p className="text-gray-500 dark:text-gray-400">
                      {(artifact.size_bytes ?? 0).toLocaleString()} bytes
                      {artifact.mime_type ? ` · ${artifact.mime_type}` : ''}
                    </p>
                    {artifact.sha256 && (
                      <p className="font-mono text-gray-500 dark:text-gray-400 truncate">sha256:{artifact.sha256}</p>
                    )}
                  </div>
                ))}
                {artifacts.length > 4 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">+{artifacts.length - 4} more artifacts</p>
                )}
              </div>
            </section>
          )}

          {hasCoverage && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Coverage</h2>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <p>Line: <span className="font-medium">{formatCoverageMetric(overallCoverage?.line)}</span></p>
                <p>Branch: <span className="font-medium">{formatCoverageMetric(overallCoverage?.branch)}</span></p>
                <p>Function: <span className="font-medium">{formatCoverageMetric(overallCoverage?.function)}</span></p>
                {perCheckCoverageRows.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
                    {perCheckCoverageRows.slice(0, 4).map(([checkID, metrics]) => (
                      <p key={checkID}>
                        <span className="font-mono text-gray-500 dark:text-gray-400">{checkID}</span>: {formatCoverageMetric(metrics.line || metrics.branch || metrics.function)}
                      </p>
                    ))}
                    {perCheckCoverageRows.length > 4 && (
                      <p className="text-gray-500 dark:text-gray-400">+{perCheckCoverageRows.length - 4} more checks</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Matrix Grid */}
      {matrixGrid && (
        <div className="mb-4">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{matrixGrid.matrixLabel}</th>
                  {matrixGrid.checkers.map((checker) => (
                    <th key={checker} className="text-center px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 font-mono">{checker}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixGrid.rows.map((row) => (
                  <tr key={row.configLabel} className={cn('border-b border-gray-100 dark:border-gray-800/50 last:border-0', row.isCurrent && 'bg-blue-50/50 dark:bg-blue-950/20')}>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {row.configLabel}{row.isCurrent && <span className="ml-2 text-[10px] text-blue-500">current</span>}
                    </td>
                    {matrixGrid.checkers.map((checker) => {
                      const s = row.checkerStatuses.get(checker)
                      return (
                        <td key={checker} className="px-3 py-1.5 text-center">
                          {s == null ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                            <span className={cn('inline-block w-2.5 h-2.5 rounded-full', statusDot(s))} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allure-style two-panel layout */}
      {checks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No checks reported for this run.</p>
        </div>
      ) : (
        <div className="flex gap-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
          {/* Left panel — Suites list */}
          <div className="w-[420px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            {/* Left panel header */}
            <div className="border-b border-gray-200 dark:border-gray-800 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter tests..."
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((sf) => {
                  const count = sf.value === 'all' ? counts.total
                    : sf.value === 'passed' ? counts.passed
                    : sf.value === 'failed' ? counts.failed
                    : counts.skipped
                  return (
                    <button
                      key={sf.value}
                      onClick={() => setStatusFilter(sf.value)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors',
                        statusFilter === sf.value
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      )}
                    >
                      {'dot' in sf && <span className={`w-1.5 h-1.5 rounded-full ${sf.dot}`} />}
                      {count}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Scrollable suites */}
            <div className="flex-1 overflow-y-auto">
              {checks.map((check) => {
                const items = check.items || []
                const filteredItems = items.map((item, idx) => ({ item, idx })).filter(({ item }) => matchesFilter(item))
                const isCollapsed = collapsed.has(check.tool)
                const checkPassed = items.filter((i) => i.status === 'passed').length
                const checkFailed = items.filter((i) => ['failed', 'error'].includes((i.status || '').toLowerCase())).length

                return (
                  <div key={check.tool}>
                    {/* Suite header */}
                    <button
                      onClick={() => toggleCollapse(check.tool)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors text-left"
                    >
                      <svg className={cn('w-3 h-3 text-gray-400 transition-transform', !isCollapsed && 'rotate-90')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(check.status)}`} />
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">{check.tool}</span>
                      <span className="flex items-center gap-2 text-[10px] flex-shrink-0">
                        {checkPassed > 0 && <span className="text-emerald-600 dark:text-emerald-400">{checkPassed}</span>}
                        {checkFailed > 0 && <span className="text-rose-600 dark:text-rose-400">{checkFailed}</span>}
                        <span className="text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5 min-w-[1.5rem] text-center">
                          {filteredItems.length}
                        </span>
                      </span>
                    </button>

                    {/* Suite items */}
                    {!isCollapsed && (
                      <div>
                        {filteredItems.length === 0 ? (
                          <div className="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500 italic">No matching items.</div>
                        ) : (
                          filteredItems.map(({ item, idx }) => {
                            const isSelected = selected?.checker === check.tool && selected?.index === idx
                            const isFailing = ['failed', 'error'].includes((item.status || '').toLowerCase())
                            return (
                              <button
                                key={`${check.tool}-${idx}`}
                                onClick={() => setSelected({ checker: check.tool, index: idx })}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors border-b border-gray-100 dark:border-gray-800/30 last:border-0',
                                  isSelected
                                    ? isFailing
                                      ? 'bg-rose-50 dark:bg-rose-950/30 border-l-2 border-l-rose-500'
                                      : 'bg-emerald-50 dark:bg-emerald-950/20 border-l-2 border-l-emerald-500'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/30 border-l-2 border-l-transparent',
                                )}
                              >
                                <span className="flex-shrink-0">{statusIcon(item.status)}</span>
                                <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1 font-mono">{item.id}</span>
                                {item.duration_s != null && item.duration_s > 0 && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono flex-shrink-0 flex items-center gap-1">
                                    {isFailing && item.status === 'passed' ? null : null}
                                    {formatDuration(item.duration_s)}
                                  </span>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right panel — Item detail */}
          <div className="flex-1 overflow-y-auto">
            {!selectedItem ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Select a test to view details</p>
                </div>
              </div>
            ) : (
              <ItemDetailPanel
                checker={selectedItem.checker}
                item={selectedItem.item}
                check={selectedItem.check}
                allRuns={allRuns}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item Detail Panel ──────────────────────────────────────────────────────

type DetailTab = 'overview' | 'history' | 'output'

function ItemDetailPanel({ checker, item, check, allRuns }: { checker: string; item: RunItem; check: RunCheck; allRuns: RunRecord[] }) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const isFailing = ['failed', 'error'].includes((item.status || '').toLowerCase())
  const hasOutput = !!(item.stdout || item.stderr)

  const history = useMemo(() => {
    const entries: { runId: string; timestamp: string; branch: string; sha: string; status: string; duration_s?: number; message?: string }[] = []
    for (const run of allRuns) {
      for (const c of run.checks || []) {
        if (c.tool !== checker) continue
        for (const it of c.items || []) {
          if (it.id !== item.id) continue
          entries.push({
            runId: run.run_id,
            timestamp: run.timestamp,
            branch: run.branch,
            sha: run.sha || '',
            status: it.status,
            duration_s: it.duration_s,
            message: it.message,
          })
        }
      }
    }
    return entries
  }, [allRuns, checker, item.id])

  const historyStats = useMemo(() => {
    if (history.length === 0) return null
    const passed = history.filter((h) => h.status === 'passed').length
    const failed = history.filter((h) => ['failed', 'error'].includes((h.status || '').toLowerCase())).length
    const durations = history.filter((h) => h.duration_s != null && h.duration_s > 0).map((h) => h.duration_s!)
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    let flips = 0
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].status === 'passed' ? 'pass' : 'fail'
      const curr = history[i].status === 'passed' ? 'pass' : 'fail'
      if (prev !== curr) flips++
    }
    return { total: history.length, passed, failed, avgDuration, flips, passRate: history.length > 0 ? Math.round((passed / history.length) * 100) : 0 }
  }, [history])

  const tabClass = (tab: DetailTab) => cn(
    'px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
    activeTab === tab
      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
  )

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate">
        {checker} › {item.id}
      </div>

      {/* Title */}
      <div className="px-4 pb-3 flex items-start gap-3">
        <StatusBadge status={item.status} />
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 break-all leading-snug">{item.id}</h2>
      </div>

      {/* Tabs */}
      <div className="px-4 border-b border-gray-200 dark:border-gray-800 flex gap-0">
        <button onClick={() => setActiveTab('overview')} className={tabClass('overview')}>Overview</button>
        <button onClick={() => setActiveTab('history')} className={tabClass('history')}>
          History
          {history.length > 0 && (
            <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-gray-500">{history.length}</span>
          )}
        </button>
        {hasOutput && (
          <button onClick={() => setActiveTab('output')} className={tabClass('output')}>Output</button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Properties */}
            <div>
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-xs">
                <span className="font-medium text-gray-500 dark:text-gray-400">Status</span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${statusDot(item.status)}`} />
                  <span className="capitalize text-gray-900 dark:text-gray-100">{(item.status || 'unknown').toLowerCase()}</span>
                </span>
                <span className="font-medium text-gray-500 dark:text-gray-400">Checker</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono">{checker}</span>
                <span className="font-medium text-gray-500 dark:text-gray-400">Duration</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono">{formatDuration(item.duration_s)}</span>
                {check.duration_s != null && check.duration_s > 0 && (
                  <>
                    <span className="font-medium text-gray-500 dark:text-gray-400">Check Duration</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">{formatDuration(check.duration_s)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Failure message */}
            {item.message && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {isFailing ? 'Failure Message' : 'Message'}
                </h3>
                <pre className={cn(
                  'text-[11px] font-mono whitespace-pre-wrap p-3 rounded-lg border overflow-x-auto',
                  isFailing
                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-200'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200',
                )}>
                  {item.message}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-5">
            {/* Stats summary */}
            {historyStats && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <HistoryStatCard label="Appearances" value={`${historyStats.total}`} />
                <HistoryStatCard
                  label="Pass Rate"
                  value={`${historyStats.passRate}%`}
                  tone={historyStats.passRate >= 80 ? 'emerald' : historyStats.passRate >= 50 ? 'amber' : 'rose'}
                />
                <HistoryStatCard label="Avg Duration" value={formatDuration(historyStats.avgDuration)} />
                <HistoryStatCard
                  label="Flips"
                  value={`${historyStats.flips}`}
                  tone={historyStats.flips >= 3 ? 'rose' : historyStats.flips >= 1 ? 'amber' : 'emerald'}
                />
              </div>
            )}

            {/* Status timeline bar */}
            {history.length > 1 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Status Timeline</h3>
                <div className="flex gap-px rounded overflow-hidden">
                  {[...history].reverse().map((h, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-6 flex-1 min-w-[4px] transition-colors',
                        h.status === 'passed' ? 'bg-emerald-400 dark:bg-emerald-500' :
                        ['failed', 'error'].includes((h.status || '').toLowerCase()) ? 'bg-rose-400 dark:bg-rose-500' :
                        h.status === 'skipped' ? 'bg-amber-400 dark:bg-amber-500' :
                        'bg-gray-300 dark:bg-gray-600',
                      )}
                      title={`${h.timestamp.split('T')[0]} — ${h.status} — ${h.branch}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <span>{history[history.length - 1]?.timestamp.split('T')[0]}</span>
                  <span>{history[0]?.timestamp.split('T')[0]}</span>
                </div>
              </div>
            )}

            {/* Duration sparkline */}
            {history.filter((h) => h.duration_s != null && h.duration_s > 0).length > 1 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Duration Over Time</h3>
                <DurationSparkline history={history} />
              </div>
            )}

            {/* Run-by-run list */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">All Runs</h3>
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                {history.map((h, i) => {
                  const isCurrent = h.runId === allRuns.find((r) => r.checks?.some((c) => c.tool === checker && c.items?.some((it) => it === item)))?.run_id
                  return (
                    <Link
                      key={`${h.runId}-${i}`}
                      to="/run"
                      search={{ run: h.runId }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 text-xs border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors',
                        isCurrent && 'bg-blue-50/50 dark:bg-blue-950/20',
                      )}
                    >
                      <span className="flex-shrink-0">{statusIcon(h.status)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-700 dark:text-gray-300 truncate">{h.runId}</span>
                          {isCurrent && <span className="text-[9px] text-blue-500 font-medium flex-shrink-0">CURRENT</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {h.branch} · {h.sha.slice(0, 7)} · {relativeTime(h.timestamp)}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {formatDuration(h.duration_s)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="space-y-4">
            {item.stdout && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">stdout</h3>
                <pre className="text-[11px] font-mono whitespace-pre-wrap p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 overflow-x-auto max-h-[400px] overflow-y-auto">
                  {item.stdout}
                </pre>
              </div>
            )}
            {item.stderr && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">stderr</h3>
                <pre className="text-[11px] font-mono whitespace-pre-wrap p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-200 overflow-x-auto max-h-[400px] overflow-y-auto">
                  {item.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryStatCard({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'rose' | 'amber' }) {
  return (
    <div className={cn(
      'rounded-lg border p-2.5',
      tone === 'emerald' ? 'border-emerald-200 dark:border-emerald-900/50' :
      tone === 'rose' ? 'border-rose-200 dark:border-rose-900/50' :
      tone === 'amber' ? 'border-amber-200 dark:border-amber-900/50' :
      'border-gray-200 dark:border-gray-800',
    )}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}

function DurationSparkline({ history }: { history: { duration_s?: number; timestamp: string }[] }) {
  const points = useMemo(() => {
    return [...history]
      .reverse()
      .map((h) => ({ duration: h.duration_s ?? 0, ts: h.timestamp }))
      .filter((p) => p.duration > 0)
  }, [history])

  if (points.length < 2) return null

  const max = Math.max(...points.map((p) => p.duration))
  const height = 48
  const width = points.length * 12
  const barWidth = Math.max(4, Math.min(10, width / points.length - 1))

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(width, 100)} height={height + 16} className="block">
        {points.map((p, i) => {
          const barHeight = max > 0 ? (p.duration / max) * height : 0
          const x = i * (barWidth + 2)
          return (
            <g key={i}>
              <title>{`${p.ts.split('T')[0]}: ${formatDuration(p.duration)}`}</title>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={1.5}
                className="fill-blue-400 dark:fill-blue-500"
              />
            </g>
          )
        })}
        {/* baseline */}
        <line x1={0} y1={height} x2={Math.max(width, 100)} y2={height} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
      </svg>
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
