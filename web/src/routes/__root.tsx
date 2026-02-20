import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { runStatus, useHistoryRuns } from '../lib/history'
import { useTheme } from '../lib/theme'

const navItems = [
  { to: '/', label: 'Overview', iconPath: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z' },
  { to: '/pr', label: 'Pull Requests', iconPath: 'M7.5 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm15-6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 9v6m3-3h6' },
  { to: '/run', label: 'Runs', iconPath: 'M4.5 5.25h15m-15 4.5h15m-15 4.5h15m-15 4.5h15' },
  { to: '/trends', label: 'Trends', iconPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' },
]

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { theme, toggle } = useTheme()
  const { runs } = useHistoryRuns()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const recentRuns = useMemo(() => runs.slice(0, 6), [runs])
  const failedCount = useMemo(() => runs.filter((run) => ['failed', 'error'].includes(runStatus(run))).length, [runs])

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-900/95">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          Menu
        </button>
        <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cairn Report</h1>
        <button
          onClick={toggle}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      {mobileSidebarOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/35 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-gray-200 bg-gray-50/95 dark:border-gray-800 dark:bg-gray-900/95 flex-shrink-0 overflow-y-auto transform transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Cairn Report</h1>
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium [&.active]:bg-blue-50 dark:[&.active]:bg-blue-950 [&.active]:text-blue-700 dark:[&.active]:text-blue-400 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="px-4 pb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Recent</h3>
          <ul className="space-y-0.5">
            {recentRuns.map((run) => (
              <li key={`${run.run_id}-${run.timestamp}`}>
                <Link
                  to="/run"
                  search={{ run: run.run_id }}
                  className="block px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded truncate"
                >
                  {run.run_id}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 pb-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Smart Groups</h3>
          <div className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded">
            <span>Failed / error</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{failedCount}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white pt-[57px] md:pt-0 dark:bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}
