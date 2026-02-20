import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { StatusBadge } from '../components/status-badge'
import { Card } from '../components/ui/card'
import { runStatus, useHistoryRuns } from '../lib/history'
import { useTheme } from '../lib/theme'

const navItems = [
  {
    to: '/',
    label: 'Overview',
    iconPath:
      'M3.75 3.75h16.5v7.5H3.75v-7.5Zm0 9h7.5v7.5h-7.5v-7.5Zm9 0h7.5v7.5h-7.5v-7.5Z',
  },
  {
    to: '/pr',
    label: 'Pull Requests',
    iconPath:
      'M6 4.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5ZM6 15a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5ZM18 9.75a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5ZM8.25 6.75h7.5M8.25 17.25h4.5m0 0V12',
  },
  {
    to: '/run',
    label: 'Runs',
    iconPath:
      'M4.5 6.75h15m-15 5.25h15m-15 5.25h9.75',
  },
  {
    to: '/trends',
    label: 'Trends',
    iconPath:
      'M4.5 18.75h15M6.75 15l3.75-3.75 2.25 2.25L17.25 9',
  },
]

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { theme, toggle } = useTheme()
  const { runs } = useHistoryRuns()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const recentRuns = useMemo(() => runs.slice(0, 6), [runs])

  const counts = useMemo(() => {
    const failed = runs.filter((run) => ['failed', 'error'].includes(runStatus(run))).length
    const passed = runs.filter((run) => runStatus(run) === 'passed').length
    return { failed, passed }
  }, [runs])

  return (
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-zinc-200/80 bg-zinc-100/95 px-4 py-3 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Menu
        </button>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cairn Report</p>
        <button
          onClick={toggle}
          className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      {mobileSidebarOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-zinc-950/60 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 shrink-0 border-r border-zinc-200/80 bg-zinc-100/95 px-4 py-5 backdrop-blur transition-transform duration-200 md:static md:z-auto md:w-72 md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-950/90 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-center justify-between px-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Workspace</p>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Cairn Report</h1>
          </div>
          <button
            onClick={toggle}
            className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        <SidebarSection title="Navigation">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-50 [&.active]:bg-zinc-900 [&.active]:text-zinc-50 dark:[&.active]:bg-zinc-100 dark:[&.active]:text-zinc-900"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>
        </SidebarSection>

        <SidebarSection title="Recent Runs">
          <div className="space-y-2">
            {recentRuns.length === 0 ? (
              <p className="px-2 text-xs text-zinc-500 dark:text-zinc-400">No runs yet.</p>
            ) : (
              recentRuns.map((run) => (
                <Link
                  key={`${run.run_id}-${run.timestamp}`}
                  to="/run"
                  search={{ run: run.run_id }}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-2 text-xs text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-zinc-700"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <span className="truncate font-medium">{run.run_id}</span>
                  <StatusBadge status={runStatus(run)} />
                </Link>
              ))
            )}
          </div>
        </SidebarSection>

        <SidebarSection title="Smart Groups">
          <div className="space-y-2">
            <StatTile label="Passing" value={counts.passed} tone="passed" />
            <StatTile label="Failed / Error" value={counts.failed} tone="failed" />
          </div>
        </SidebarSection>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-100 to-zinc-50 pt-[58px] md:pt-0 dark:from-zinc-950 dark:to-zinc-900">
        <Outlet />
      </main>
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-3 border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{title}</p>
      {children}
    </Card>
  )
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: 'passed' | 'failed' }) {
  const toneClass = tone === 'passed' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'

  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200/80 bg-zinc-100/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  )
}
