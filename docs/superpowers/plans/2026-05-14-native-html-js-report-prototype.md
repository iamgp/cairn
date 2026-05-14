# Native HTML JS Report Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native static HTML/JS Cairn report prototype that can replace the React/TanStack/Vite report if it preserves the essential workflows with less release and maintenance overhead.

**Architecture:** Add a parallel static report implementation under `report/` that reads the same `history.ndjson` contract as the current `web/` app. Keep it framework-free, asset-light, and build-free: one HTML file, one CSS file, and focused ES module files for loading, routing, filtering, and rendering.

**Tech Stack:** Native HTML, CSS, browser ES modules, Fetch API, History/hash routing, Go tests for release packaging checks, Playwright or browser smoke checks for rendered behavior.

---

## File Structure

- Create `report/index.html`
  - Static report shell.
  - Loads `assets/styles.css` and `assets/app.js`.
  - Contains only stable landmarks: header, nav, main region, loading/error containers.

- Create `report/assets/styles.css`
  - Cairn report styling without Tailwind, Primer, or generated CSS.
  - Defines layout, table, badges, metadata grid, detail panels, mobile behavior, and print basics.

- Create `report/assets/app.js`
  - Browser entrypoint.
  - Loads history data and delegates to router/render functions.

- Create `report/assets/history.js`
  - Owns `history.ndjson` fetching, parsing, sorting, and derived helpers.

- Create `report/assets/router.js`
  - Owns hash routes:
    - `#/`
    - `#/pr`
    - `#/run?run=<id>&sha=<sha>`
    - `#/trends`

- Create `report/assets/render.js`
  - Owns DOM rendering for main runs, PR runs, run detail, and trends.

- Create `report/assets/format.js`
  - Owns date/time, duration, status, and text escaping helpers.

- Create `report/assets/report.test.mjs`
  - Node-based unit tests for pure parsing/filtering/render helper behavior.
  - Uses only built-in `node:test` and `node:assert`.

- Create `report/testdata/history.ndjson`
  - Small representative fixture with:
    - one main branch passing run
    - one PR failing run
    - repeated test IDs across runs for history/trends

- Modify `package.json` only if the repo root already has one.
  - If not, do not add package management for the prototype.
  - Run tests with `node --test report/assets/report.test.mjs`.

- Modify `README.md`
  - Add a short note that the native report prototype exists and is not yet the default.

---

### Task 1: Create Fixture and Pure History Helpers

**Files:**
- Create: `report/testdata/history.ndjson`
- Create: `report/assets/history.js`
- Create: `report/assets/report.test.mjs`

- [ ] **Step 1: Create representative history fixture**

Create `report/testdata/history.ndjson`:

```json
{"v":1,"run_id":"1001","sha":"abc1234","sha_full":"abc123456789","branch":"main","timestamp":"2026-05-12T10:00:00Z","checks":[{"tool":"pytest","status":"passed","duration_s":12.5,"items":[{"id":"tests/test_math.py::test_add","status":"passed","duration_s":0.2},{"id":"tests/test_math.py::test_subtract","status":"passed","duration_s":0.1}]},{"tool":"ruff","status":"passed","duration_s":2.1,"items":[]}]}
{"v":1,"run_id":"1002","sha":"def5678","sha_full":"def567890123","pr":42,"branch":"feature/report","timestamp":"2026-05-13T11:00:00Z","checks":[{"tool":"pytest","status":"failed","duration_s":15.25,"items":[{"id":"tests/test_math.py::test_add","status":"failed","duration_s":0.3,"message":"expected 4, got 5","trace":"AssertionError: expected 4, got 5"},{"id":"tests/test_math.py::test_subtract","status":"passed","duration_s":0.1}]},{"tool":"ruff","status":"passed","duration_s":1.9,"items":[]}]}
{"v":1,"run_id":"1003","sha":"fed9999","sha_full":"fed999900000","branch":"main","timestamp":"2026-05-14T12:00:00Z","checks":[{"tool":"pytest","status":"passed","duration_s":10,"items":[{"id":"tests/test_math.py::test_add","status":"passed","duration_s":0.2},{"id":"tests/test_math.py::test_subtract","status":"passed","duration_s":0.1}]}]}
```

- [ ] **Step 2: Write failing tests for history helpers**

Create `report/assets/report.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  filterRuns,
  parseHistoryLines,
  runDuration,
  runStatus,
  summarizeRuns,
} from './history.js'

const fixture = await readFile(new URL('../testdata/history.ndjson', import.meta.url), 'utf8')

test('parseHistoryLines parses and sorts newest first', () => {
  const runs = parseHistoryLines(fixture)
  assert.equal(runs.length, 3)
  assert.equal(runs[0].run_id, '1003')
  assert.equal(runs[1].run_id, '1002')
  assert.equal(runs[2].run_id, '1001')
})

test('runStatus derives worst check status', () => {
  const runs = parseHistoryLines(fixture)
  assert.equal(runStatus(runs.find((run) => run.run_id === '1002')), 'failed')
  assert.equal(runStatus(runs.find((run) => run.run_id === '1001')), 'passed')
})

test('runDuration sums checker durations', () => {
  const runs = parseHistoryLines(fixture)
  assert.equal(runDuration(runs.find((run) => run.run_id === '1002')), 17.15)
})

test('filterRuns filters by PR and status', () => {
  const runs = parseHistoryLines(fixture)
  const filtered = filterRuns(runs, { mode: 'pr', status: 'failed_or_error', query: '', checker: 'any', branch: 'any', pr: 'any' })
  assert.deepEqual(filtered.map((run) => run.run_id), ['1002'])
})

test('summarizeRuns counts derived statuses', () => {
  const runs = parseHistoryLines(fixture)
  assert.deepEqual(summarizeRuns(runs), { total: 3, passed: 2, failed: 1, skipped: 0 })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: FAIL with module not found for `history.js`.

- [ ] **Step 4: Implement history helpers**

Create `report/assets/history.js`:

```js
export function parseHistoryLines(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export async function loadHistory() {
  const response = await fetch('./history.ndjson', { cache: 'no-store' })
  if (!response.ok) {
    if (response.status === 404) return []
    throw new Error(`Failed to load history.ndjson: HTTP ${response.status}`)
  }
  return parseHistoryLines(await response.text())
}

export function runStatus(run) {
  let status = 'passed'
  for (const check of run?.checks || []) {
    const current = String(check.status || '').toLowerCase()
    if (current === 'error') return 'error'
    if (current === 'failed') status = 'failed'
    if (current === 'skipped' && status === 'passed') status = 'skipped'
  }
  return status
}

export function runDuration(run) {
  const total = (run?.checks || []).reduce((sum, check) => sum + (Number(check.duration_s) || 0), 0)
  return Math.round(total * 1000) / 1000
}

export function summarizeRuns(runs) {
  const summary = { total: runs.length, passed: 0, failed: 0, skipped: 0 }
  for (const run of runs) {
    const status = runStatus(run)
    if (status === 'passed') summary.passed += 1
    else if (status === 'skipped') summary.skipped += 1
    else summary.failed += 1
  }
  return summary
}

export function runOptions(runs) {
  const checkers = new Set()
  const branches = new Set()
  const prs = new Set()

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
}

export function filterRuns(runs, filters) {
  const query = String(filters.query || '').trim().toLowerCase()

  return runs.filter((run) => {
    if (filters.mode === 'main' && run.pr != null) return false
    if (filters.mode === 'pr' && run.pr == null) return false

    const status = runStatus(run)
    if (filters.status === 'failed_or_error' && status !== 'failed' && status !== 'error') return false
    if (filters.status !== 'any' && filters.status !== 'failed_or_error' && status !== filters.status) return false
    if (filters.branch !== 'any' && run.branch !== filters.branch) return false
    if (filters.pr !== 'any' && String(run.pr ?? '') !== filters.pr) return false
    if (filters.checker !== 'any' && !(run.checks || []).some((check) => check.tool === filters.checker)) return false

    if (!query) return true

    const haystack = [
      run.run_id,
      run.sha,
      run.sha_full,
      run.branch,
      String(run.pr ?? ''),
      ...(run.checks || []).map((check) => check.tool),
    ]

    return haystack.some((value) => String(value || '').toLowerCase().includes(query))
  })
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add report/testdata/history.ndjson report/assets/history.js report/assets/report.test.mjs
git commit -m "feat: prototype native report history helpers"
```

---

### Task 2: Add Static Shell and Styling

**Files:**
- Create: `report/index.html`
- Create: `report/assets/styles.css`

- [ ] **Step 1: Create static HTML shell**

Create `report/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cairn Report</title>
    <link rel="stylesheet" href="./assets/styles.css">
  </head>
  <body>
    <header class="app-header">
      <a class="brand" href="#/" aria-label="Cairn main branch report">
        <span class="brand-mark" aria-hidden="true">C</span>
        <span>Cairn Report</span>
      </a>
      <nav class="nav" aria-label="Report views">
        <a href="#/" data-nav="main">Main Branch</a>
        <a href="#/pr" data-nav="pr">Pull Requests</a>
        <a href="#/trends" data-nav="trends">Trends</a>
      </nav>
    </header>
    <main id="app" class="app-main" tabindex="-1">
      <section class="state-panel">Loading history...</section>
    </main>
    <script type="module" src="./assets/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create CSS**

Create `report/assets/styles.css`:

```css
:root {
  color-scheme: light dark;
  --bg: #f6f8fa;
  --panel: #ffffff;
  --text: #1f2328;
  --muted: #636c76;
  --border: #d0d7de;
  --accent: #0969da;
  --success: #1a7f37;
  --danger: #cf222e;
  --warning: #9a6700;
  --shadow: 0 1px 2px rgba(31, 35, 40, 0.06);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117;
    --panel: #161b22;
    --text: #e6edf3;
    --muted: #8b949e;
    --border: #30363d;
    --accent: #58a6ff;
    --success: #3fb950;
    --danger: #ff7b72;
    --warning: #d29922;
    --shadow: none;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

a {
  color: var(--accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.app-header {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  padding: 12px 24px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-weight: 700;
}

.brand-mark {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  font-size: 14px;
}

.nav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}

.nav a {
  border-radius: 6px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  padding: 6px 10px;
  white-space: nowrap;
}

.nav a[aria-current="page"] {
  background: var(--bg);
  color: var(--text);
}

.app-main {
  margin: 0 auto;
  max-width: 1440px;
  padding: 24px;
}

.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}

.page-description {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.metric {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
  padding: 14px;
}

.metric-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.metric-value {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 700;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.filters input,
.filters select,
.filters button {
  min-height: 34px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--text);
  padding: 6px 10px;
}

.filters input {
  flex: 1 1 260px;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  border-bottom: 1px solid var(--border);
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

tr:last-child td {
  border-bottom: 0;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace;
}

.muted {
  color: var(--muted);
}

.badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 4px 8px;
}

.badge.passed {
  border-color: color-mix(in srgb, var(--success), transparent 65%);
  color: var(--success);
}

.badge.failed,
.badge.error {
  border-color: color-mix(in srgb, var(--danger), transparent 65%);
  color: var(--danger);
}

.badge.skipped {
  border-color: color-mix(in srgb, var(--warning), transparent 65%);
  color: var(--warning);
}

.state-panel,
.section {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
}

.section + .section {
  margin-top: 16px;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 18px;
}

.metadata-cell {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 12px;
  min-width: 0;
}

.metadata-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.metadata-value {
  margin-top: 4px;
  overflow-wrap: anywhere;
}

details {
  margin-top: 8px;
}

pre {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  padding: 12px;
  white-space: pre-wrap;
}

@media (max-width: 760px) {
  .app-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px 16px;
  }

  .app-main {
    padding: 16px;
  }

  .summary-grid,
  .metadata-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media print {
  .app-header,
  .filters {
    display: none;
  }

  .app-main {
    max-width: none;
    padding: 0;
  }
}
```

- [ ] **Step 3: Smoke-open the static shell**

Run:

```bash
test -f report/index.html
test -f report/assets/styles.css
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add report/index.html report/assets/styles.css
git commit -m "feat: add native report static shell"
```

---

### Task 3: Add Routing and Run List Rendering

**Files:**
- Create: `report/assets/format.js`
- Create: `report/assets/router.js`
- Create: `report/assets/render.js`
- Create: `report/assets/app.js`
- Modify: `report/assets/report.test.mjs`

- [ ] **Step 1: Add tests for formatting**

Append to `report/assets/report.test.mjs`:

```js
import { escapeHTML, formatDuration } from './format.js'

test('escapeHTML escapes unsafe text', () => {
  assert.equal(escapeHTML('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;')
})

test('formatDuration formats seconds', () => {
  assert.equal(formatDuration(0.25), '0.25s')
  assert.equal(formatDuration(75), '1m 15.0s')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: FAIL because `format.js` does not exist.

- [ ] **Step 3: Implement format helpers**

Create `report/assets/format.js`:

```js
export function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatDuration(seconds) {
  const value = Number(seconds) || 0
  if (value < 60) return `${value.toFixed(value < 10 ? 2 : 1)}s`
  const minutes = Math.floor(value / 60)
  const remaining = value - minutes * 60
  return `${minutes}m ${remaining.toFixed(1)}s`
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString()
}

export function relativeTime(timestamp) {
  if (!timestamp) return ''
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

export function statusBadge(status) {
  const normalized = String(status || 'unknown').toLowerCase()
  return `<span class="badge ${escapeHTML(normalized)}">${escapeHTML(normalized)}</span>`
}
```

- [ ] **Step 4: Implement hash router**

Create `report/assets/router.js`:

```js
export function currentRoute() {
  const rawHash = window.location.hash || '#/'
  const withoutHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash
  const [pathPart, queryPart = ''] = withoutHash.split('?')
  const params = new URLSearchParams(queryPart)
  const path = pathPart || '/'

  if (path === '/pr') return { name: 'pr', params }
  if (path === '/run') return { name: 'run', params }
  if (path === '/trends') return { name: 'trends', params }
  return { name: 'main', params }
}

export function setActiveNav(routeName) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    const active = link.getAttribute('data-nav') === routeName
    link.setAttribute('aria-current', active ? 'page' : 'false')
  }
}
```

- [ ] **Step 5: Implement run-list rendering**

Create `report/assets/render.js`:

```js
import { filterRuns, runDuration, runOptions, runStatus, summarizeRuns } from './history.js'
import { escapeHTML, formatDateTime, formatDuration, relativeTime, statusBadge } from './format.js'

const defaultFilters = {
  query: '',
  status: 'any',
  checker: 'any',
  branch: 'any',
  pr: 'any',
}

export function renderState(message) {
  return `<section class="state-panel">${escapeHTML(message)}</section>`
}

export function renderRunListPage({ runs, mode, title, description }) {
  const options = runOptions(runs)
  const filters = { ...defaultFilters, mode }
  const visible = filterRuns(runs, filters)
  const summary = summarizeRuns(visible)

  return `
    <header class="page-header">
      <div>
        <h1 class="page-title">${escapeHTML(title)}</h1>
        <p class="page-description">${escapeHTML(description)}</p>
      </div>
    </header>
    ${renderSummary(summary)}
    ${renderFilters(options)}
    <div id="runs-table">${renderRunsTable(visible)}</div>
  `
}

export function attachRunListHandlers({ root, runs, mode }) {
  const form = root.querySelector('[data-filters]')
  const tableTarget = root.querySelector('#runs-table')
  if (!form || !tableTarget) return

  const update = () => {
    const filters = {
      mode,
      query: form.querySelector('[name="query"]').value,
      status: form.querySelector('[name="status"]').value,
      checker: form.querySelector('[name="checker"]').value,
      branch: form.querySelector('[name="branch"]').value,
      pr: form.querySelector('[name="pr"]').value,
    }
    tableTarget.innerHTML = renderRunsTable(filterRuns(runs, filters))
  }

  form.addEventListener('input', update)
  form.addEventListener('change', update)
  form.addEventListener('reset', () => {
    window.setTimeout(update, 0)
  })
}

function renderSummary(summary) {
  return `
    <section class="summary-grid" aria-label="Run summary">
      ${metric('Runs', summary.total)}
      ${metric('Passed', summary.passed)}
      ${metric('Failed', summary.failed)}
      ${metric('Skipped', summary.skipped)}
    </section>
  `
}

function metric(label, value) {
  return `
    <div class="metric">
      <div class="metric-label">${escapeHTML(label)}</div>
      <div class="metric-value">${Number(value).toLocaleString()}</div>
    </div>
  `
}

function renderFilters(options) {
  return `
    <form class="filters" data-filters>
      <input name="query" type="search" placeholder="Search run ID, SHA, branch, checker" aria-label="Search runs">
      ${select('status', 'Status', [
        ['any', 'Any status'],
        ['failed_or_error', 'Failed / Error'],
        ['passed', 'Passed'],
        ['failed', 'Failed'],
        ['error', 'Error'],
        ['skipped', 'Skipped'],
      ])}
      ${select('checker', 'Checker', options.checkers.map((value) => [value, value === 'any' ? 'Any checker' : value]))}
      ${select('branch', 'Branch', options.branches.map((value) => [value, value === 'any' ? 'Any branch' : value]))}
      ${select('pr', 'PR', options.prs.map((value) => [value, value === 'any' ? 'Any PR' : `PR #${value}`]))}
      <button type="reset">Clear</button>
    </form>
  `
}

function select(name, label, options) {
  return `
    <select name="${escapeHTML(name)}" aria-label="${escapeHTML(label)}">
      ${options.map(([value, text]) => `<option value="${escapeHTML(value)}">${escapeHTML(text)}</option>`).join('')}
    </select>
  `
}

function renderRunsTable(runs) {
  if (runs.length === 0) return renderState('No runs match the current filters.')
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Run</th>
            <th>Branch</th>
            <th>Status</th>
            <th>Checks</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${runs.map(renderRunRow).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderRunRow(run) {
  const checks = (run.checks || []).map((check) => `<span class="badge">${escapeHTML(check.tool)}</span>`).join(' ')
  return `
    <tr>
      <td><div>${escapeHTML(formatDateTime(run.timestamp))}</div><div class="muted">${escapeHTML(relativeTime(run.timestamp))}</div></td>
      <td><a class="mono" href="#/run?run=${encodeURIComponent(run.run_id)}">${escapeHTML(run.run_id)}</a>${run.pr != null ? ` <span class="badge">PR #${escapeHTML(run.pr)}</span>` : ''}</td>
      <td class="mono">${escapeHTML(run.branch || '-')}</td>
      <td>${statusBadge(runStatus(run))}</td>
      <td>${checks}</td>
      <td class="mono">${escapeHTML(formatDuration(runDuration(run)))}</td>
    </tr>
  `
}
```

- [ ] **Step 6: Implement app entrypoint**

Create `report/assets/app.js`:

```js
import { loadHistory } from './history.js'
import { currentRoute, setActiveNav } from './router.js'
import { attachRunListHandlers, renderRunListPage, renderState } from './render.js'

const app = document.querySelector('#app')
let runs = []

async function boot() {
  try {
    runs = await loadHistory()
    render()
  } catch (error) {
    app.innerHTML = renderState(error instanceof Error ? error.message : String(error))
  }
}

function render() {
  const route = currentRoute()
  setActiveNav(route.name)

  if (route.name === 'pr') {
    app.innerHTML = renderRunListPage({
      runs,
      mode: 'pr',
      title: 'Pull Request Runs',
      description: 'Execution history for pull request runs.',
    })
    attachRunListHandlers({ root: app, runs, mode: 'pr' })
    return
  }

  app.innerHTML = renderRunListPage({
    runs,
    mode: 'main',
    title: 'Main Branch Runs',
    description: 'Execution history for non-PR runs.',
  })
  attachRunListHandlers({ root: app, runs, mode: 'main' })
}

window.addEventListener('hashchange', render)
boot()
```

- [ ] **Step 7: Run unit tests**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Smoke-test with a local static server**

Run:

```bash
tmpdir="$(mktemp -d)"
cp -R report/. "${tmpdir}/"
cp report/testdata/history.ndjson "${tmpdir}/history.ndjson"
python3 -m http.server 8765 --directory "${tmpdir}"
```

Expected: server starts. In another terminal or browser, open `http://localhost:8765/#/` and confirm the main branch table renders. Stop the server after verification.

- [ ] **Step 9: Commit**

```bash
git add report/assets/app.js report/assets/format.js report/assets/router.js report/assets/render.js report/assets/report.test.mjs
git commit -m "feat: render native report run lists"
```

---

### Task 4: Add Run Detail Page

**Files:**
- Modify: `report/assets/render.js`
- Modify: `report/assets/app.js`
- Modify: `report/assets/report.test.mjs`

- [ ] **Step 1: Add test history helper test**

Append to `report/assets/report.test.mjs`:

```js
import { buildTestHistory } from './render.js'

test('buildTestHistory groups item status history by checker and item id', () => {
  const runs = parseHistoryLines(fixture)
  const history = buildTestHistory(runs)
  assert.equal(history.get('pytest::tests/test_math.py::test_add').length, 3)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: FAIL because `buildTestHistory` is not exported.

- [ ] **Step 3: Add run detail rendering exports**

Append these exports to `report/assets/render.js`:

```js
export function findRun(runs, params) {
  const runID = params.get('run') || ''
  const sha = params.get('sha') || ''
  return runs.find((run) => {
    if (run.run_id !== runID) return false
    if (!sha) return true
    return (run.sha_full || run.sha) === sha
  })
}

export function buildTestHistory(runs) {
  const history = new Map()
  for (const run of runs) {
    for (const check of run.checks || []) {
      for (const item of check.items || []) {
        const key = `${check.tool}::${item.id}`
        const entries = history.get(key) || []
        entries.push({
          status: item.status,
          duration_s: Number(item.duration_s) || 0,
          timestamp: run.timestamp,
          run_id: run.run_id,
        })
        history.set(key, entries)
      }
    }
  }
  return history
}

export function renderRunDetailPage({ run, allRuns }) {
  const status = runStatus(run)
  const checks = run.checks || []
  const history = buildTestHistory(allRuns)
  const items = checks.flatMap((check) => (check.items || []).map((item) => ({ check, item })))
  const passed = items.filter(({ item }) => item.status === 'passed').length
  const failed = items.filter(({ item }) => ['failed', 'error'].includes(item.status)).length
  const skipped = items.filter(({ item }) => item.status === 'skipped').length

  return `
    <header class="page-header">
      <div>
        <h1 class="page-title">Test Report ${statusBadge(status)}</h1>
        <p class="page-description mono">${escapeHTML(run.run_id)}</p>
      </div>
    </header>
    <section class="metadata-grid" aria-label="Run metadata">
      ${metadataCell('Total', items.length)}
      ${metadataCell('Passed', passed)}
      ${metadataCell('Failed', failed)}
      ${metadataCell('Skipped', skipped)}
      ${metadataCell('Branch', run.branch || '-')}
      ${metadataCell('Duration', formatDuration(runDuration(run)))}
      ${run.pr != null ? metadataCell('PR', `#${run.pr}`) : ''}
      ${metadataCell('Date', formatDateTime(run.timestamp))}
      ${metadataCell('Commit', run.sha_full || run.sha || '-')}
    </section>
    <form class="filters" data-item-filter>
      <input name="query" type="search" placeholder="Filter tests..." aria-label="Filter tests">
    </form>
    <div id="run-detail-items">${renderCheckSections(checks, history, '')}</div>
  `
}

export function attachRunDetailHandlers({ root, run, allRuns }) {
  const form = root.querySelector('[data-item-filter]')
  const target = root.querySelector('#run-detail-items')
  if (!form || !target) return
  const history = buildTestHistory(allRuns)
  form.addEventListener('input', () => {
    const query = form.querySelector('[name="query"]').value
    target.innerHTML = renderCheckSections(run.checks || [], history, query)
  })
}

function metadataCell(label, value) {
  return `
    <div class="metadata-cell">
      <div class="metadata-label">${escapeHTML(label)}</div>
      <div class="metadata-value">${escapeHTML(value)}</div>
    </div>
  `
}

function renderCheckSections(checks, history, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  return checks.map((check) => {
    const items = (check.items || []).filter((item) => {
      if (!normalizedQuery) return true
      return [item.id, item.message, item.trace].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
    })
    return renderCheckSection(check, items, history)
  }).join('')
}

function renderCheckSection(check, items, history) {
  return `
    <section class="section">
      <h2>${escapeHTML(check.tool)} ${statusBadge(check.status)}</h2>
      ${items.length === 0 ? '<p class="muted">No items match the current filter.</p>' : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Item</th>
                <th>Duration</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => renderItemRow(check, item, history.get(`${check.tool}::${item.id}`) || [])).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `
}

function renderItemRow(check, item, history) {
  const detail = [item.message, item.trace, item.stdout, item.stderr].filter(Boolean).join('\n\n')
  return `
    <tr>
      <td>${statusBadge(item.status)}</td>
      <td class="mono">${escapeHTML(item.id)}</td>
      <td class="mono">${escapeHTML(formatDuration(item.duration_s || 0))}</td>
      <td>
        <details>
          <summary>Details</summary>
          <p class="muted">${history.length} recorded appearance${history.length === 1 ? '' : 's'}</p>
          ${detail ? `<pre>${escapeHTML(detail)}</pre>` : '<p class="muted">No item details recorded.</p>'}
        </details>
      </td>
    </tr>
  `
}
```

- [ ] **Step 4: Wire run route in app entrypoint**

Modify `report/assets/app.js` imports:

```js
import {
  attachRunDetailHandlers,
  attachRunListHandlers,
  findRun,
  renderRunDetailPage,
  renderRunListPage,
  renderState,
} from './render.js'
```

Add this route before the PR route:

```js
  if (route.name === 'run') {
    const run = findRun(runs, route.params)
    if (!run) {
      app.innerHTML = renderState('Run not found.')
      return
    }
    app.innerHTML = renderRunDetailPage({ run, allRuns: runs })
    attachRunDetailHandlers({ root: app, run, allRuns: runs })
    return
  }
```

- [ ] **Step 5: Run unit tests**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Smoke-test the run detail page**

Run the local static server from Task 3, then open:

```text
http://localhost:8765/#/run?run=1002
```

Expected: the failing PR run renders, the filter input filters item rows, and the failing item details show message/trace text.

- [ ] **Step 7: Commit**

```bash
git add report/assets/app.js report/assets/render.js report/assets/report.test.mjs
git commit -m "feat: render native report run detail"
```

---

### Task 5: Add Trends Page

**Files:**
- Modify: `report/assets/render.js`
- Modify: `report/assets/app.js`
- Modify: `report/assets/report.test.mjs`

- [ ] **Step 1: Add trends summary test**

Append to `report/assets/report.test.mjs`:

```js
import { buildTrendSummary } from './render.js'

test('buildTrendSummary groups runs by day and checker', () => {
  const runs = parseHistoryLines(fixture)
  const summary = buildTrendSummary(runs)
  assert.equal(summary.byDay.length, 3)
  assert.equal(summary.checkers.find(([name]) => name === 'pytest')[1].total, 3)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: FAIL because `buildTrendSummary` is not exported.

- [ ] **Step 3: Implement trends rendering**

Append to `report/assets/render.js`:

```js
export function buildTrendSummary(runs) {
  const days = new Map()
  const checkers = new Map()

  for (const run of runs) {
    const day = String(run.timestamp || '').slice(0, 10) || 'unknown'
    const dayStats = days.get(day) || { total: 0, passed: 0, failed: 0 }
    dayStats.total += 1
    if (runStatus(run) === 'passed') dayStats.passed += 1
    else dayStats.failed += 1
    days.set(day, dayStats)

    for (const check of run.checks || []) {
      const stats = checkers.get(check.tool) || { total: 0, passed: 0, failed: 0 }
      stats.total += 1
      if (check.status === 'passed') stats.passed += 1
      else stats.failed += 1
      checkers.set(check.tool, stats)
    }
  }

  return {
    byDay: Array.from(days.entries()).sort((a, b) => b[0].localeCompare(a[0])),
    checkers: Array.from(checkers.entries()).sort((a, b) => b[1].total - a[1].total),
  }
}

export function renderTrendsPage(runs) {
  const summary = buildTrendSummary(runs)
  const total = runs.length
  const passed = runs.filter((run) => runStatus(run) === 'passed').length
  const passRate = total ? Math.round((passed / total) * 100) : 0

  return `
    <header class="page-header">
      <div>
        <h1 class="page-title">Trends</h1>
        <p class="page-description">${summary.byDay.length} days sampled · ${total} runs</p>
      </div>
    </header>
    <section class="summary-grid">
      ${metric('Days', summary.byDay.length)}
      ${metric('Runs', total)}
      ${metric('Pass Rate', `${passRate}%`)}
      ${metric('Checkers', summary.checkers.length)}
    </section>
    <section class="section">
      <h2>Daily Pass Rate</h2>
      ${summary.byDay.length === 0 ? '<p class="muted">No trend data available.</p>' : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Day</th><th>Passed</th><th>Failed</th><th>Pass Rate</th></tr></thead>
            <tbody>
              ${summary.byDay.map(([day, stats]) => {
                const rate = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
                return `<tr><td>${escapeHTML(day)}</td><td>${stats.passed}</td><td>${stats.failed}</td><td>${rate}%</td></tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>
    <section class="section">
      <h2>Checker Breakdown</h2>
      ${summary.checkers.length === 0 ? '<p class="muted">No checker data available.</p>' : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Checker</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th></tr></thead>
            <tbody>
              ${summary.checkers.map(([checker, stats]) => {
                const rate = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
                return `<tr><td class="mono">${escapeHTML(checker)}</td><td>${stats.total}</td><td>${stats.passed}</td><td>${stats.failed}</td><td>${rate}%</td></tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `
}
```

- [ ] **Step 4: Wire trends route**

Modify `report/assets/app.js` imports to include `renderTrendsPage`:

```js
import {
  attachRunDetailHandlers,
  attachRunListHandlers,
  findRun,
  renderRunDetailPage,
  renderRunListPage,
  renderState,
  renderTrendsPage,
} from './render.js'
```

Add this route before the default main route:

```js
  if (route.name === 'trends') {
    app.innerHTML = renderTrendsPage(runs)
    return
  }
```

- [ ] **Step 5: Run unit tests**

Run:

```bash
node --test report/assets/report.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Smoke-test trends page**

Run the local static server from Task 3, then open:

```text
http://localhost:8765/#/trends
```

Expected: daily and checker trend tables render from fixture data.

- [ ] **Step 7: Commit**

```bash
git add report/assets/app.js report/assets/render.js report/assets/report.test.mjs
git commit -m "feat: render native report trends"
```

---

### Task 6: Compare Native Prototype Against Current React Report

**Files:**
- Create: `docs/report-prototype-comparison.md`
- Modify: `README.md`

- [ ] **Step 1: Generate asset size numbers**

Run:

```bash
find report -type f -not -path '*/testdata/*' -print0 | xargs -0 wc -c
find web/.output/public -type f -print0 2>/dev/null | xargs -0 wc -c | tail -n 1
```

Expected: first command shows native prototype byte total. Second command shows current Vite output total if `web/.output/public` exists.

- [ ] **Step 2: Create comparison document**

Create `docs/report-prototype-comparison.md`:

```markdown
# Native Report Prototype Comparison

## Current React Report

- Build required for release assets: yes
- Build required in consuming repos after Node-free publishing: no
- Runtime framework: React, TanStack Router, TanStack Table, Primer, React PDF
- Key workflows:
  - Main branch run list
  - PR run list
  - Run detail
  - Trends
  - PDF download

## Native Prototype

- Build required: no
- Runtime framework: none
- Key workflows:
  - Main branch run list
  - PR run list
  - Run detail
  - Trends
- Missing from prototype:
  - PDF download
  - Advanced table sorting/pagination
  - Exact visual parity with React report

## Recommendation Criteria

Replace the React report only if:

- Native report covers the workflows users rely on most.
- Static asset size is meaningfully smaller.
- Future report changes are easier to make without framework churn.
- The loss of PDF export is acceptable or can be restored without adding a heavy dependency.

Keep the React report if:

- PDF export is a core requirement.
- The prototype becomes a hand-rolled framework.
- Visual or accessibility quality regresses enough to cost more than the build simplification saves.
```

- [ ] **Step 3: Update README prototype note**

Add this under the report assets documentation:

```markdown
## Native Report Prototype

`report/` contains a framework-free prototype that reads the same `history.ndjson`
contract as the current web report. It is not the default report until it has been
compared against the React implementation and accepted.
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --test report/assets/report.test.mjs
go test ./...
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/report-prototype-comparison.md README.md
git commit -m "docs: compare native report prototype"
```

---

### Task 7: Optional Switch Point After Review

**Files:**
- Modify only after human review approves replacing the React report.
- Likely modify: `scripts/sync-web-assets.sh`
- Likely modify: `scripts/release.sh`
- Likely modify: `internal/cli/report_assets.go`

- [ ] **Step 1: Do not execute this task without explicit approval**

Stop and ask:

```text
The native report prototype is complete. Do you want Cairn releases to package `report/` instead of `web/.output/public`?
```

Expected: wait for a clear yes before continuing.

- [ ] **Step 2: If approved, update asset sync to copy native report**

Change release/sync scripts from copying:

```bash
cp -R web/.output/public/. internal/cli/web-assets/
```

to:

```bash
cp -R report/. internal/cli/web-assets/
```

- [ ] **Step 3: Remove web build from release packaging**

Remove release-time `npm ci` and `npm run build:pages` only after the native report becomes the accepted default.

- [ ] **Step 4: Run final verification**

Run:

```bash
node --test report/assets/report.test.mjs
go test ./...
tmpdir="$(mktemp -d)"
go run . render --pages-dir "${tmpdir}"
test -f "${tmpdir}/index.html"
```

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-web-assets.sh scripts/release.sh internal/cli/report_assets.go
git commit -m "feat: package native report assets"
```

---

## Self-Review

**Spec coverage:** The plan covers the next phase after Node-free publishing: framework-free static report prototype, workflow parity checks, size/maintenance comparison, and a gated switch point.

**Placeholder scan:** No steps contain placeholder instructions. Code, commands, and expected outcomes are concrete.

**Type consistency:** Helper names are consistent across tasks: `parseHistoryLines`, `runStatus`, `runDuration`, `filterRuns`, `summarizeRuns`, `buildTestHistory`, `buildTrendSummary`, `renderRunListPage`, `renderRunDetailPage`, and `renderTrendsPage`.
