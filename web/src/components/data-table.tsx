import { Fragment, useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
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
    <div className="bg-transparent">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'text-sm font-semibold text-muted-foreground',
                    header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground',
                  )}
                  style={{ minWidth: header.getSize() !== 150 ? header.getSize() : undefined }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ▲' : header.column.getIsSorted() === 'desc' ? ' ▼' : ''}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                No data.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    'transition-colors hover:bg-[var(--wf-card-header-bg)]',
                    getRowClassName?.(row),
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {renderSubRow?.(row)}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="mt-2 flex items-center justify-between px-2 py-2 text-sm text-muted-foreground">
          <span>
            Page {pageIndex + 1} of {pageCount} · {data.length} rows
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-[var(--wf-card-border)] bg-[var(--wf-card-bg)] px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-[var(--wf-card-header-bg)]"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-[var(--wf-card-border)] bg-[var(--wf-card-bg)] px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-[var(--wf-card-header-bg)]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
