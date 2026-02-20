import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { runStatus, useHistoryRuns } from '../lib/history'
import { useTheme } from '../lib/theme'

const navItems = [
  { to: '/', label: 'Projects', iconPath: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z' },
  { to: '/pr', label: 'Kanban', iconPath: 'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z' },
  { to: '/run', label: 'Planning', iconPath: 'M3 4.5h18M3 9.75h18M3 15h18M3 20.25h18M7.5 4.5v15.75M15 9.75V20.25' },
  { to: '/trends', label: 'Stats', iconPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' },
]

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { theme, toggle } = useTheme()
  const { runs } = useHistoryRuns()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const recentRuns = useMemo(() => runs.slice(0, 6), [runs])
  const activeThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return runs.filter((run) => {
      const ts = new Date(run.timestamp).getTime()
      return !Number.isNaN(ts) && ts >= cutoff
    }).length
  }, [runs])
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
        <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Project Dashboard</h1>
        <button
          onClick={toggle}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          )}
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
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 md:hidden dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Navigation</span>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Close navigation"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Project Dashboard</h1>
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              )}
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
          <ul className="space-y-0.5">
            <li>
              <div className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded">
                <span>Active this week</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{activeThisWeek}</span>
              </div>
            </li>
            <li>
              <div className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded">
                <span>Failed / error</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{failedCount}</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-800 pt-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">C</div>
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">Cairn</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white pt-[57px] md:pt-0 dark:bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}
