import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DataTable } from './data-table'
import { runTableColumns } from './run-table-columns'
import {
  defaultFilters,
  filterRuns,
  runStatus,
  useRunOptions,
  type RunFilters,
  type RunRecord,
} from '../lib/history'

type RunsPageContentProps = {
  title: string
  description: string
  runs: RunRecord[]
  group?: string
}

export function RunsPageContent({ title, description, runs, group }: RunsPageContentProps) {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(defaultFilters)
  const options = useRunOptions(runs)

  useEffect(() => {
    if (group === 'failed') {
      setFilters((prev) => ({ ...prev, status: 'failed_or_error' }))
      return
    }
    setFilters((prev) => ({ ...prev, status: 'any' }))
  }, [group])

  const filtered = useMemo(() => filterRuns(runs, filters), [runs, filters])

  const summary = useMemo(() => {
    const total = filtered.length
    const passed = filtered.filter((run) => runStatus(run) === 'passed').length
    const failed = filtered.filter((run) => ['failed', 'error'].includes(runStatus(run))).length
    const skipped = filtered.filter((run) => runStatus(run) === 'skipped').length
    return { total, passed, failed, skipped }
  }, [filtered])

  const hasActiveFilters =
    filters.query !== '' ||
    filters.status !== 'any' ||
    filters.checker !== 'any' ||
    filters.branch !== 'any' ||
    filters.pr !== 'any'

  const updateFilter = (key: keyof RunFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Runs" value={summary.total} />
        <SummaryCard label="Passed" value={summary.passed} tone="success" />
        <SummaryCard label="Failed" value={summary.failed} tone="destructive" />
        <SummaryCard label="Skipped" value={summary.skipped} tone="warning" />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            placeholder="Search run ID, SHA, branch, checker"
            className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />

          <FilterSelect
            value={filters.status}
            onChange={(v) => updateFilter('status', v)}
            options={[
              { value: 'any', label: 'Any status' },
              { value: 'failed_or_error', label: 'Failed / Error' },
              { value: 'passed', label: 'Passed' },
              { value: 'failed', label: 'Failed' },
              { value: 'error', label: 'Error' },
              { value: 'skipped', label: 'Skipped' },
            ]}
          />

          <FilterSelect
            value={filters.checker}
            onChange={(v) => updateFilter('checker', v)}
            options={options.checkers.map((value) => ({
              value,
              label: value === 'any' ? 'Any checker' : value,
            }))}
          />

          <FilterSelect
            value={filters.branch}
            onChange={(v) => updateFilter('branch', v)}
            options={options.branches.map((value) => ({
              value,
              label: value === 'any' ? 'Any branch' : value,
            }))}
          />

          <FilterSelect
            value={filters.pr}
            onChange={(v) => updateFilter('pr', v)}
            options={options.prs.map((value) => ({
              value,
              label: value === 'any' ? 'Any PR' : `PR #${value}`,
            }))}
          />

          {hasActiveFilters ? (
            <button
              onClick={() => setFilters(defaultFilters)}
              className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
            >
              Clear
            </button>
          ) : null}
        </div>

        <DataTable
          columns={runTableColumns}
          data={filtered}
          pageSize={50}
          onRowClick={(run) => navigate({ to: '/run', search: { run: run.run_id } })}
        />
      </section>
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'destructive' | 'warning'
}) {
  const valueClassName =
    tone === 'success'
      ? 'text-success'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-foreground'

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClassName}`}>{value}</p>
    </div>
  )
}
