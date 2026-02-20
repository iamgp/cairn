import { Badge } from './ui/badge'

const statusClass: Record<string, string> = {
  passed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
  error: 'bg-red-100 text-red-800',
  skipped: 'bg-amber-100 text-amber-800',
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || 'unknown').toLowerCase()
  return (
    <Badge className={statusClass[normalized] ?? 'bg-gray-200 text-gray-700'}>
      {normalized}
    </Badge>
  )
}
