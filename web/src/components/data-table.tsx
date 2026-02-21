import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Row,
} from '@tanstack/react-table'
import { cn } from '../lib/utils'

type DataTableProps<T> = {
  columns: ColumnDef<T, any>[]
  data: T[]
  pageSize?: number
  onRowClick?: (row: T) => void
  getRowClassName?: (row: Row<T>) => string
  renderSubRow?: (row: Row<T>) => React.ReactNode
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 50,
  onRowClick,
  getRowClassName,
  renderSubRow,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-xs">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-3 py-2',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200',
                    )}
                    style={{ minWidth: header.getSize() !== 150 ? header.getSize() : undefined }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? ' ▲' : header.column.getIsSorted() === 'desc' ? ' ▼' : ''}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-gray-400 dark:text-gray-500">
                  No data.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <>
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      onRowClick && 'cursor-pointer',
                      'hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors',
                      getRowClassName?.(row),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {renderSubRow?.(row)}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Page {pageIndex + 1} of {pageCount} · {data.length} rows
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
