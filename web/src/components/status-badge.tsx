import { Badge } from './ui/badge'

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'secondary' | 'default'> = {
  passed: 'success',
  failed: 'destructive',
  error: 'destructive',
  skipped: 'warning',
  running: 'secondary',
}

const statusTone: Record<string, string> = {
  passed: 'ring-emerald-500/30',
  failed: 'ring-rose-500/30',
  error: 'ring-rose-500/30',
  skipped: 'ring-amber-500/30',
  running: 'ring-blue-500/30',
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || 'unknown').toLowerCase()

  return (
    <Badge
      variant={statusVariant[normalized] ?? 'default'}
      className={`capitalize ring-1 ring-inset ${statusTone[normalized] ?? 'ring-gray-500/20'}`}
    >
      {normalized}
    </Badge>
  )
}
