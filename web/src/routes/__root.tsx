import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

const nav = [
  { to: '/', label: 'Overview' },
  { to: '/pr', label: 'Pull Requests' },
  { to: '/run', label: 'Runs' },
  { to: '/trends', label: 'Analytics' },
]

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1400px] gap-4 p-4 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-5 border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cairn</p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">Quality Console</h1>
        </div>
        <nav className="grid gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: 'bg-slate-900 text-white' }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 text-xs text-slate-500">
          <p>Published via</p>
          <p className="font-semibold text-slate-700">gh-pages</p>
        </div>
      </aside>

      <section className="grid gap-4">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operations</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Pipeline Dashboard</h2>
            </div>
            <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Live from `history.ndjson`
            </p>
          </div>
        </header>
        <Outlet />
      </section>
    </main>
  )
}
