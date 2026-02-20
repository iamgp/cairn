import type { ReactNode } from 'react'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { cn } from '../../lib/utils'

type ReportMetricCardProps = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  trend?: ReactNode
  trendVariant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
  className?: string
}

export function ReportMetricCard({
  label,
  value,
  hint,
  trend,
  trendVariant = 'secondary',
  className,
}: ReportMetricCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <div className="flex w-full items-center justify-between gap-3">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
          </CardTitle>
          {trend ? <Badge variant={trendVariant}>{trend}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
        {hint ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

export function ReportMetricGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
}
