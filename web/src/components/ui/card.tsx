import * as React from 'react'
import { Card as PrimerCard } from '@primer/react/experimental'
import { cn } from '../../lib/utils'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'condensed' | 'normal'
}

export function Card({ className, padding = 'none', ...props }: CardProps) {
  return (
    <PrimerCard
      className={cn(
        className,
      )}
      padding={padding}
      borderRadius="medium"
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-3 p-4 sm:p-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100',
        className,
      )}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-sm text-gray-600 dark:text-gray-400', className)} {...props} />
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 sm:px-5 sm:pb-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-gray-200/80 px-4 py-3 dark:border-gray-800 sm:px-5',
        className,
      )}
      {...props}
    />
  )
}
