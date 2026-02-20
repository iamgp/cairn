import * as React from 'react'
import { cn } from '../../lib/utils'

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none ring-gray-300 focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}
