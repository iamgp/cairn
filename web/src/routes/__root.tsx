import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-[var(--wf-main-bg)] px-4 py-8 sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-[1300px]">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Cairn Report</h1>
          <nav className="inline-flex rounded-lg border border-[var(--wf-sidebar-border)] bg-[var(--wf-sidebar-bg)] p-1 text-sm">
            <Link
              to="/"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
            >
              Main Branch
            </Link>
            <Link
              to="/pr"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
            >
              Pull Requests
            </Link>
          </nav>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
