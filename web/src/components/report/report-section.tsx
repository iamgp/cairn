import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { cn } from '../../lib/utils'

type ReportSectionProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function ReportSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: ReportSectionProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn('pt-4', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
