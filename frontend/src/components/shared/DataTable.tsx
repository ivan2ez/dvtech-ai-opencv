import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// --- Types ---

export interface DataTableColumn<T> {
  /** Display label for the column header */
  label: string;
  /** Key to access the value from the data item */
  accessor: keyof T & string;
  /** Optional custom render function for the cell */
  render?: (value: T[keyof T], item: T) => React.ReactNode;
  /** Whether this column is sortable */
  sortable?: boolean;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface DataTableProps<T> {
  /** Array of data items to display */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Pagination state */
  pagination: DataTablePagination;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Optional callback for sorting */
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  /** Current filter/search value */
  filterValue?: string;
  /** Callback when filter value changes */
  onFilterChange?: (value: string) => void;
  /** Placeholder text for the filter input */
  filterPlaceholder?: string;
  /** Whether data is currently loading */
  isLoading?: boolean;
}

// --- Constants ---

const MAX_PAGE_SIZE = 20;

// --- Component ---

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pagination,
  onPageChange,
  onSort,
  filterValue,
  onFilterChange,
  filterPlaceholder = 'Search...',
  isLoading = false,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Enforce max page size
  const displayData = data.slice(0, MAX_PAGE_SIZE);

  const handleSort = (accessor: string) => {
    if (!onSort) return;

    let newDirection: 'asc' | 'desc' = 'asc';
    if (sortColumn === accessor) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }

    setSortColumn(accessor);
    setSortDirection(newDirection);
    onSort(accessor, newDirection);
  };

  const renderSortIcon = (accessor: string) => {
    if (sortColumn !== accessor) {
      return <ArrowUpDown className="size-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="size-4" />
    ) : (
      <ArrowDown className="size-4" />
    );
  };

  const { page, totalItems, totalPages } = pagination;
  const startItem = totalItems === 0 ? 0 : (page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(page * pagination.pageSize, totalItems);

  return (
    <div className="space-y-4">
      {/* Filter input */}
      {onFilterChange && (
        <div className="flex items-center">
          <Input
            placeholder={filterPlaceholder}
            value={filterValue ?? ''}
            onChange={(e) => onFilterChange(e.target.value)}
            className="max-w-sm"
            aria-label={filterPlaceholder}
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.accessor}>
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors',
                        sortColumn === column.accessor && 'text-foreground'
                      )}
                      onClick={() => handleSort(column.accessor)}
                      aria-label={`Sort by ${column.label}`}
                      aria-sort={
                        sortColumn === column.accessor
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      {column.label}
                      {renderSortIcon(column.accessor)}
                    </button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : displayData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((item, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.accessor}>
                      {column.render
                        ? column.render(item[column.accessor], item)
                        : String(item[column.accessor] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-muted-foreground">
          {totalItems === 0
            ? 'No items'
            : `Showing ${startItem} to ${endItem} of ${totalItems} items`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            aria-label="Go to next page"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
