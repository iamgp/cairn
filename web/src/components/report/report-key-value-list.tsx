import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type ReportKeyValueItem = {
  keyLabel: ReactNode
  value: ReactNode
  hint?: ReactNode
}

export function ReportKeyValueList({
  items,
  className,
}: {
  items: ReportKeyValueItem[]
  className?: string
}) {
  return (
    <dl className={cn('divide-y divide-zinc-200 dark:divide-zinc-800', className)}>
      {items.map((item, index) => (
        <div key={index} className="grid gap-1 py-3 sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {item.keyLabel}
          </dt>
          <dd className="text-sm text-zinc-800 dark:text-zinc-200">
            {item.value}
            {item.hint ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.hint}</p>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
