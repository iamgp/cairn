import { BaseStyles, ThemeProvider as PrimerThemeProvider } from '@primer/react'
import { useEffect, useState, type ReactNode } from 'react'
import { hostSystemTheme } from './host-system-theme'

type ResolvedTheme = 'light' | 'dark'

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return hostSystemTheme ?? 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveSystemTheme())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => setResolvedTheme(resolveSystemTheme())
    media.addEventListener('change', listener)
    listener()
    return () => media.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.dataset.themeMode = 'system'
  }, [resolvedTheme])

  return (
    <PrimerThemeProvider
      colorMode={resolvedTheme === 'dark' ? 'night' : 'day'}
      dayScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      nightScheme="dark"
    >
      <BaseStyles>{children}</BaseStyles>
    </PrimerThemeProvider>
  )
}
