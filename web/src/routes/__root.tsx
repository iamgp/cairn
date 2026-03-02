import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useTheme } from '../lib/theme'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { mode, setMode } = useTheme()

  return (
    <div className="min-h-screen bg-[var(--wf-main-bg)] px-4 py-8 sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-[1300px]">
        <header className="no-print mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Cairn Report</h1>
          <div className="flex items-center gap-3">
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

            <div className="inline-flex rounded-lg border border-[var(--wf-sidebar-border)] bg-[var(--wf-sidebar-bg)] p-1 text-sm">
              <ThemeModeButton
                active={mode === 'light'}
                onClick={() => setMode('light')}
                label="Light"
              />
              <ThemeModeButton
                active={mode === 'dark'}
                onClick={() => setMode('dark')}
                label="Dark"
              />
              <ThemeModeButton
                active={mode === 'system'}
                onClick={() => setMode('system')}
                label="System"
              />
            </div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}

function ThemeModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 transition-colors ${
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}
