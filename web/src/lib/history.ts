import { useEffect, useMemo, useState } from 'react'

export type RunItemSource = {
  file?: string
  line?: number
  column?: number
}

export type RunItem = {
  id: string
  status: string
  duration_s?: number
  message?: string
  trace?: string
  stdout?: string
  stderr?: string
  tags?: string[]
  source?: RunItemSource
  suite?: string
}

export type RunCheck = {
  tool: string
  status: string
  duration_s?: number
  items?: RunItem[]
}

export type RunCoverageMetric = {
  covered: number
  total: number
  percent: number
}

export type RunCoverageMetricsMap = {
  line?: RunCoverageMetric
  branch?: RunCoverageMetric
  function?: RunCoverageMetric
}

export type RunMetadata = {
  environment?: {
    ci?: boolean
    provider?: string
    repository?: string
    workflow?: string
    job?: string
    runner_os?: string
    runner_arch?: string
    runner_name?: string
  }
  actor?: {
    login?: string
    id?: string
    triggering_login?: string
    committer_name?: string
    committer_email?: string
  }
  reproducibility?: {
    tool_versions?: Record<string, string>
    dependency_hashes?: Record<string, string>
    config_sha256?: string
  }
  traceability?: {
    requirement_ids?: string[]
    spec_ids?: string[]
    risk_ids?: string[]
    commit_message?: string
  }
  provenance?: {
    artifacts?: Array<{
      path?: string
      role?: string
      sha256?: string
      size_bytes?: number
      mime_type?: string
    }>
  }
  coverage?: {
    overall?: RunCoverageMetricsMap
    per_check?: Record<string, RunCoverageMetricsMap>
  }
}

export type RunRecord = {
  v: number
  run_id: string
  sha: string
  sha_full?: string
  pr?: number
  branch: string
  timestamp: string
  matrix?: Record<string, string>
  metadata?: RunMetadata
  checks: RunCheck[]
}

export type RunFilters = {
  query: string
  status: string
  checker: string
  branch: string
  pr: string
}

export const defaultFilters: RunFilters = {
  query: '',
  status: 'any',
  checker: 'any',
  branch: 'any',
  pr: 'any',
}

const parseLines = (raw: string): RunRecord[] =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunRecord)

export const runStatus = (run: RunRecord): string => {
  let status = 'passed'
  for (const check of run.checks || []) {
    const s = (check.status || '').toLowerCase()
    if (s === 'error') return 'error'
    if (s === 'failed') status = 'failed'
    if (s === 'skipped' && status === 'passed') status = 'skipped'
  }
  return status
}

export const runDuration = (run: RunRecord): number =>
  (run.checks || []).reduce((sum, check) => sum + (Number(check.duration_s) || 0), 0)

export function useHistoryRuns() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('./history.ndjson', { cache: 'no-store' })
        if (!response.ok) {
          if (!cancelled) {
            setRuns([])
            setLoading(false)
          }
          return
        }
        const raw = await response.text()
        const parsed = parseLines(raw).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        if (!cancelled) {
          setRuns(parsed)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { runs, loading, error }
}

export function useRunOptions(runs: RunRecord[]) {
  return useMemo(() => {
    const checkers = new Set<string>()
    const branches = new Set<string>()
    const prs = new Set<string>()

    for (const run of runs) {
      if (run.branch) branches.add(run.branch)
      if (run.pr != null) prs.add(String(run.pr))
      for (const check of run.checks || []) {
        if (check.tool) checkers.add(check.tool)
      }
    }

    return {
      checkers: ['any', ...Array.from(checkers).sort()],
      branches: ['any', ...Array.from(branches).sort()],
      prs: ['any', ...Array.from(prs).sort((a, b) => Number(b) - Number(a))],
    }
  }, [runs])
}

export function filterRuns(runs: RunRecord[], filters: RunFilters) {
  const q = filters.query.trim().toLowerCase()

  return runs.filter((run) => {
    const status = runStatus(run)
    if (filters.status === 'failed_or_error' && status !== 'failed' && status !== 'error') return false
    if (filters.status !== 'any' && filters.status !== 'failed_or_error' && status !== filters.status) return false
    if (filters.branch !== 'any' && run.branch !== filters.branch) return false
    if (filters.pr !== 'any' && String(run.pr ?? '') !== filters.pr) return false
    if (filters.checker !== 'any' && !(run.checks || []).some((c) => c.tool === filters.checker)) {
      return false
    }

    if (!q) return true

    const haystack = [
      run.run_id,
      run.sha,
      run.sha_full,
      run.branch,
      String(run.pr ?? ''),
      ...(run.checks || []).map((c) => c.tool),
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(q)
  })
}
