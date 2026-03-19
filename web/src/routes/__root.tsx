import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useTheme } from '../lib/theme'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { mode, setMode } = useTheme()

  return (
    <div className="min-h-screen bg-[var(--wf-main-bg)] px-4 py-4 sm:px-8 sm:py-10 lg:px-12">
      <main className="mx-auto w-full">
        <header className="no-print mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <CairnLogo className="size-10 shrink-0 text-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Cairn Report</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
            <nav className="inline-flex shrink-0 rounded-lg border border-[var(--wf-sidebar-border)] bg-[var(--wf-sidebar-bg)] p-1 text-sm">
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

            <div className="inline-flex shrink-0 rounded-lg border border-[var(--wf-sidebar-border)] bg-[var(--wf-sidebar-bg)] p-1 text-sm">
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

function CairnLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="130 130 340 340"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0,600) scale(0.1,-0.1)">
        <path d="M2753 4471 c-292 -53 -536 -183 -754 -400 -203 -204 -322 -423 -385 -711 -15 -67 -19 -126 -19 -275 1 -169 4 -202 27 -301 128 -541 546 -946 1101 -1066 124 -26 386 -31 507 -9 583 105 1025 525 1152 1091 20 91 23 131 23 295 -1 169 -4 202 -27 300 -61 258 -184 486 -362 667 -198 202 -435 334 -716 400 -126 29 -409 34 -547 9z m390 -286 c184 -48 359 -201 462 -404 l27 -55 -20 -17 c-54 -43 -284 -56 -426 -25 -43 10 -140 40 -216 66 -168 60 -271 80 -402 80 l-100 0 7 28 c32 129 241 298 410 332 67 13 198 11 258 -5z m-313 -569 c88 -23 222 -74 264 -100 l38 -23 -82 -48 c-46 -26 -150 -91 -231 -145 -161 -107 -234 -140 -310 -140 -65 0 -108 19 -158 69 -75 75 -125 217 -105 298 8 35 14 40 74 61 109 40 193 52 330 47 69 -2 150 -10 180 -19z m947 -118 c18 -22 24 -115 13 -185 -22 -141 -101 -252 -217 -309 -103 -51 -266 -45 -453 16 -111 36 -290 110 -290 120 0 21 317 210 440 263 175 74 478 131 507 95z m-1023 -563 c48 -9 129 -31 180 -49 122 -44 316 -127 316 -136 0 -4 -10 -12 -23 -17 -13 -6 -104 -59 -203 -119 -309 -185 -382 -215 -533 -215 -228 0 -434 170 -449 372 l-5 67 39 20 c59 30 190 69 274 81 41 6 86 13 100 15 43 8 211 -3 304 -19z m1214 -121 c30 -9 37 -42 23 -117 -39 -199 -219 -404 -422 -480 -125 -47 -280 -59 -431 -32 -159 27 -332 92 -326 122 3 15 80 64 385 245 246 145 469 235 644 257 86 11 100 12 127 5z" />
      </g>
    </svg>
  )
}
