import { HeadContent, Outlet, Scripts, Link, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/pr', label: 'PRs' },
  { to: '/run', label: 'Run Detail' },
  { to: '/trends', label: 'Trends' },
]

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Cairn Report' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-[radial-gradient(circle_at_top,#dff6ef_0,#f8fbff_35%,#f2f5f9_100%)] text-slate-900">
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
        <Scripts />
      </body>
    </html>
  )
}
