import * as React from 'react'
import { Label, type LabelProps } from '@primer/react'

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

const variantMap: Record<BadgeVariant, LabelProps['variant']> = {
  default: 'default',
  secondary: 'accent',
  success: 'success',
  warning: 'attention',
  destructive: 'danger',
  outline: 'secondary',
}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <Label
      className={className}
      variant={variantMap[variant ?? 'default']}
      size="large"
      {...props as LabelProps}
    >
      {children}
    </Label>
  )
}
