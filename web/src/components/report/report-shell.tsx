import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type ReportShellProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function ReportShell({
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: ReportShellProps) {
  return (
    <section className={cn('space-y-5', className)}>
      <header
        className={cn(
          'rounded-xl border border-zinc-200/80 bg-white/95 p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-black/10 sm:p-5',
          headerClassName,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-lg">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <div className={cn('space-y-5', contentClassName)}>{children}</div>
    </section>
  )
}
