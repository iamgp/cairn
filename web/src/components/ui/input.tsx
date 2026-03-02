import * as React from 'react'
import { cn } from '../../lib/utils'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-[border-color,box-shadow,background-color,color] placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-[#D1D5DB]/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-gray-500/30',
        className,
      )}
      {...props}
    />
  )
}
