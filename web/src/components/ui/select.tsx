import * as React from 'react'
import { Select as PrimerSelect, type SelectProps } from '@primer/react'

type UiSelectProps = React.ComponentPropsWithoutRef<typeof PrimerSelect>

export function Select({ className, ...props }: UiSelectProps) {
  return <PrimerSelect className={className} block size="medium" {...props} />
}
