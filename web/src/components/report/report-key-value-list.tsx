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
    <dl className={cn('divide-y divide-gray-200 dark:divide-gray-800', className)}>
      {items.map((item, index) => (
        <div key={index} className="grid gap-1 py-3 sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {item.keyLabel}
          </dt>
          <dd className="text-sm text-gray-800 dark:text-gray-200">
            {item.value}
            {item.hint ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.hint}</p>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
