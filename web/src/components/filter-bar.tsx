import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type { RunFilters } from '../lib/history'

type FilterOptions = {
  checkers: string[]
  branches: string[]
  prs: string[]
}

export function FilterBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: RunFilters
  options: FilterOptions
  onChange: (patch: Partial<RunFilters>) => void
  onReset: () => void
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Filters</h2>
        <Button variant="secondary" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Input
          placeholder="Search run / sha / branch / checker"
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
        />
        <Select value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="any">Status: any</option>
          <option value="passed">Status: passed</option>
          <option value="failed">Status: failed</option>
          <option value="error">Status: error</option>
          <option value="skipped">Status: skipped</option>
        </Select>
        <Select value={filters.checker} onChange={(e) => onChange({ checker: e.target.value })}>
          {options.checkers.map((checker) => (
            <option key={checker} value={checker}>
              Checker: {checker}
            </option>
          ))}
        </Select>
        <Select value={filters.branch} onChange={(e) => onChange({ branch: e.target.value })}>
          {options.branches.map((branch) => (
            <option key={branch} value={branch}>
              Branch: {branch}
            </option>
          ))}
        </Select>
        <Select value={filters.pr} onChange={(e) => onChange({ pr: e.target.value })}>
          {options.prs.map((pr) => (
            <option key={pr} value={pr}>
              PR: {pr}
            </option>
          ))}
        </Select>
      </div>
    </section>
  )
}
