import * as React from 'react'
import { Select as PrimerSelect, type SelectProps } from '@primer/react'

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <PrimerSelect className={className} block size="medium" {...props as SelectProps} />
}
