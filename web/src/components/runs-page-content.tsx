import { Button, Heading, Select, Text, TextInput } from '@primer/react'
import {
  CheckCircleIcon,
  CircleSlashIcon,
  IssueOpenedIcon,
  XCircleIcon,
} from '@primer/octicons-react'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from './data-table'
import { runTableColumns } from './run-table-columns'
import { Card } from './ui/card'
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
        <Heading as="h1" sx={{ fontSize: 4 }}>
          {title}
        </Heading>
        <Text sx={{ color: 'fg.muted' }}>{description}</Text>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Runs" value={summary.total} />
        <SummaryCard label="Passed" value={summary.passed} tone="success" />
        <SummaryCard label="Failed" value={summary.failed} tone="destructive" />
        <SummaryCard label="Skipped" value={summary.skipped} tone="warning" />
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <TextInput
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            placeholder="Search run ID, SHA, branch, checker"
            block
            sx={{ flex: '1 1 220px' }}
          />

          <FilterSelect
            aria-label="Filter by status"
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
            aria-label="Filter by checker"
            value={filters.checker}
            onChange={(v) => updateFilter('checker', v)}
            options={options.checkers.map((value) => ({
              value,
              label: value === 'any' ? 'Any checker' : value,
            }))}
          />

          <FilterSelect
            aria-label="Filter by branch"
            value={filters.branch}
            onChange={(v) => updateFilter('branch', v)}
            options={options.branches.map((value) => ({
              value,
              label: value === 'any' ? 'Any branch' : value,
            }))}
          />

          <FilterSelect
            aria-label="Filter by PR"
            value={filters.pr}
            onChange={(v) => updateFilter('pr', v)}
            options={options.prs.map((value) => ({
              value,
              label: value === 'any' ? 'Any PR' : `PR #${value}`,
            }))}
          />

          {hasActiveFilters ? (
            <Button
              onClick={() => setFilters(defaultFilters)}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={runTableColumns}
          data={filtered}
          pageSize={50}
          onRowClick={(run) => {
            window.location.hash = `/run?run=${encodeURIComponent(String(run.run_id))}`
          }}
        />
      </section>
    </div>
  )
}

function FilterSelect({
  'aria-label': ariaLabel,
  value,
  onChange,
  options,
}: {
  'aria-label': string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <Select.Option key={option.value} value={option.value}>
          {option.label}
        </Select.Option>
      ))}
    </Select>
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
  const Icon =
    tone === 'success'
      ? CheckCircleIcon
      : tone === 'destructive'
        ? XCircleIcon
        : tone === 'warning'
          ? CircleSlashIcon
          : IssueOpenedIcon

  const valueColor =
    tone === 'success'
      ? 'success.fg'
      : tone === 'destructive'
        ? 'danger.fg'
        : tone === 'warning'
          ? 'attention.fg'
          : 'fg.default'
  const iconColor =
    tone === 'success'
      ? 'var(--fgColor-success)'
      : tone === 'destructive'
        ? 'var(--fgColor-danger)'
        : tone === 'warning'
          ? 'var(--fgColor-attention)'
          : 'var(--fgColor-muted)'

  return (
    <Card padding="normal" className="min-h-[88px]">
      <div className="flex items-start justify-between gap-3">
        <Text
          as="p"
          sx={{ color: 'fg.muted', fontSize: 0, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}
        >
          {label}
        </Text>
        <Icon aria-hidden fill={iconColor} size={16} />
      </div>
      <Text as="p" sx={{ color: valueColor, fontSize: 5, fontWeight: 600, lineHeight: 'condensed', mt: 2 }}>
        {value.toLocaleString()}
      </Text>
    </Card>
  )
}
