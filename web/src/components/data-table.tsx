import { Button, Text } from '@primer/react'
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
  const gridTemplateColumns = table
    .getVisibleLeafColumns()
    .map((column) => {
      if (column.id === 'run_id') return 'minmax(180px, 1fr)'
      if (column.id === 'checkers') return 'minmax(260px, 1.2fr)'
      return `${column.getSize()}px`
    })
    .join(' ')

  return (
    <div>
      <Table gridTemplateColumns={gridTemplateColumns}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(header.column.getCanSort() && 'cursor-pointer select-none')}
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
              <TableCell colSpan={columns.length}>
                <Text sx={{ color: 'fg.muted' }}>No data.</Text>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    onRowClick && 'cursor-pointer',
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
        <div className="mt-3 flex items-center justify-between gap-3">
          <Text sx={{ color: 'fg.muted', fontSize: 1 }}>
            Page {pageIndex + 1} of {pageCount} · {data.length} rows
          </Text>
          <div className="flex gap-1.5">
            <Button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              size="small"
            >
              Previous
            </Button>
            <Button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              size="small"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
