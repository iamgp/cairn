import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

const navGroups = [
  {
    label: 'General',
    items: [
      { to: '/', label: 'Overview' },
      { to: '/pr', label: 'Pull Requests' },
      { to: '/run', label: 'Runs' },
      { to: '/trends', label: 'Analytics' },
    ],
  },
]

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <main className="grid min-h-screen w-full grid-cols-1 bg-[#f7f8fa] lg:grid-cols-[240px_1fr]">
      <aside className="border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cairn</p>
          <h1 className="text-base font-semibold text-slate-900">Planner</h1>
        </div>

        <div className="px-3 py-4">
          {navGroups.map((group) => (
            <section key={group.label} className="mb-5">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
              <nav className="grid gap-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeProps={{ className: 'bg-slate-900 text-white' }}
                    className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </section>
          ))}
        </div>
      </aside>

      <section className="grid grid-rows-[56px_1fr]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4">
          <p className="text-sm font-medium text-slate-800">Runs / Overview</p>
          <p className="text-xs text-slate-500">Source: history.ndjson</p>
        </header>

        <div className="p-4">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
