import * as React from 'react'
import { Table as PrimerTable } from '@primer/react/experimental'

type TableProps = React.ComponentProps<typeof PrimerTable>

function Table({ className, gridTemplateColumns, ...props }: TableProps) {
  return (
    <PrimerTable.Container>
      <PrimerTable
        cellPadding="condensed"
        className={className}
        gridTemplateColumns={gridTemplateColumns}
        {...props}
      />
    </PrimerTable.Container>
  )
}

function TableHeader(props: React.ComponentProps<'thead'>) {
  return <PrimerTable.Head {...props} />
}

function TableBody(props: React.ComponentProps<'tbody'>) {
  return <PrimerTable.Body {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return <tfoot className={className} {...props} />
}

function TableRow(props: React.ComponentProps<'tr'>) {
  return <PrimerTable.Row {...props} />
}

function TableHead(props: React.ComponentProps<'th'>) {
  return <PrimerTable.Header {...props} />
}

function TableCell(props: React.ComponentProps<'td'>) {
  return <PrimerTable.Cell {...props} />
}

function TableCaption(props: React.ComponentProps<'caption'>) {
  return <caption {...props} />
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
