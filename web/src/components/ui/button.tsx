import * as React from 'react'
import { Button as PrimerButton, type ButtonProps as PrimerButtonProps } from '@primer/react'

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps
  extends Omit<PrimerButtonProps, 'variant' | 'size'> {
    variant?: ButtonVariant
    size?: ButtonSize
  }

const variantMap: Record<ButtonVariant, PrimerButtonProps['variant']> = {
  default: 'primary',
  secondary: 'default',
  outline: 'default',
  ghost: 'invisible',
  destructive: 'danger',
}

const sizeMap: Record<ButtonSize, PrimerButtonProps['size']> = {
  default: 'medium',
  sm: 'small',
  lg: 'large',
  icon: 'medium',
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <PrimerButton
      className={className}
      variant={variantMap[variant ?? 'default']}
      size={sizeMap[size ?? 'default']}
      {...props}
    />
  )
}
