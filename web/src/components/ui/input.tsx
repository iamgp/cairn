import * as React from 'react'
import { TextInput, type TextInputProps } from '@primer/react'

type InputProps = React.ComponentPropsWithoutRef<typeof TextInput>

export function Input({ className, ...props }: InputProps) {
  return <TextInput className={className} block size="medium" {...props} />
}
