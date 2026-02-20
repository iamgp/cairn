import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/pr', label: 'PRs' },
  { to: '/run', label: 'Run Detail' },
  { to: '/trends', label: 'Trends' },
]

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 md:px-8">
      <header className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Cairn</h1>
        <p className="mt-1 text-sm text-slate-600">Quality dashboard across all runs and pull requests</p>
      </header>
      <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/90 p-2 shadow-sm">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{ className: 'bg-emerald-600 text-white' }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </main>
  )
}
