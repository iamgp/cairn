import type { ReactNode } from 'react'
import { Card, CardContent } from '../ui/card'
import { cn } from '../../lib/utils'

type ReportEmptyStateProps = {
  title: ReactNode
  message?: ReactNode
  actions?: ReactNode
  className?: string
}

export function ReportEmptyState({ title, message, actions, className }: ReportEmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="py-8 text-center sm:py-10">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        {message ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p> : null}
        {actions ? <div className="mt-4 flex justify-center gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  )
}
