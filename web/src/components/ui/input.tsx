import * as React from 'react'
import { TextInput, type TextInputProps } from '@primer/react'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput className={className} block size="medium" {...props as TextInputProps} />
}
