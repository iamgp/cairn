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
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-64 border-r border-gray-200 bg-gray-50/95 md:block">
        <div className="border-b border-gray-200 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Cairn</p>
          <h1 className="text-lg font-bold text-gray-900">Checks Report</h1>
        </div>
        <div className="p-3">
          {navGroups.map((group) => (
            <section key={group.label} className="mb-5">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</p>
              <nav className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 [&.active]:bg-blue-50 [&.active]:text-blue-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </section>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <p className="text-sm font-medium text-gray-800">CAN Checks</p>
          <p className="text-xs text-gray-500">Source: history.ndjson</p>
        </header>
        <main className="p-4">
          <Outlet />
        </main>
      </section>
    </div>
  )
}
