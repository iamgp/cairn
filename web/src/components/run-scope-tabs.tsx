import { Link } from '@tanstack/react-router'

type RunScopeTabsProps = {
  className?: string
}

export function RunScopeTabs({ className = '' }: RunScopeTabsProps) {
  return (
    <div className={className}>
      <div className="inline-flex rounded-lg border border-gray-200 p-1 dark:border-gray-700">
        <Link
          to="/"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 [&.active]:bg-blue-50 [&.active]:text-blue-700 dark:[&.active]:bg-blue-950 dark:[&.active]:text-blue-300"
        >
          Main Branch
        </Link>
        <Link
          to="/pr"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 [&.active]:bg-blue-50 [&.active]:text-blue-700 dark:[&.active]:bg-blue-950 dark:[&.active]:text-blue-300"
        >
          Pull Requests
        </Link>
      </div>
    </div>
  )
}
