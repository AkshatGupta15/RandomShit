'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface Column<T> {
  key: keyof T | string
  header: string
  sortable?: boolean
  filterable?: boolean
  filterOptions?: string[]
  render?: (value: unknown, row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  searchPlaceholder?: string
  searchKeys?: (keyof T)[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  isLoading = false,
  emptyMessage = 'No data found',
  onRowClick,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})

  const filteredAndSortedData = useMemo(() => {
    let result = [...data]

    // Apply search
    if (searchQuery && searchKeys.length > 0) {
      const query = searchQuery.toLowerCase()
      result = result.filter((row) =>
        searchKeys.some((key) => {
          const value = row[key]
          return value?.toString().toLowerCase().includes(query)
        })
      )
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((row) => {
          const rowValue = row[key as keyof T]
          return rowValue?.toString().toLowerCase() === value.toLowerCase()
        })
      }
    })

    // Apply sorting
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        const aValue = a[sortKey as keyof T]
        const bValue = b[sortKey as keyof T]
        
        if (aValue === bValue) return 0
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        const comparison = aValue < bValue ? -1 : 1
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, searchQuery, searchKeys, sortKey, sortDirection, filters])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const handleFilter = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
  }

  const hasActiveFilters = Object.values(filters).some(Boolean) || searchQuery

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ChevronsUpDown className="h-3 w-3 opacity-50" />
    if (sortDirection === 'asc') return <ChevronUp className="h-3 w-3" />
    return <ChevronDown className="h-3 w-3" />
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary/30 border-border/50 focus:border-pnb-gold"
          />
        </div>

        {/* Filter dropdowns */}
        {columns
          .filter((col) => col.filterable && col.filterOptions)
          .map((col) => (
            <DropdownMenu key={col.key.toString()}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-2 border-border/50',
                    filters[col.key.toString()] && 'border-pnb-gold bg-pnb-gold/10'
                  )}
                >
                  <Filter className="h-3 w-3" />
                  {col.header}
                  {filters[col.key.toString()] && (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                      {filters[col.key.toString()]}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="glass border-border/50">
                <DropdownMenuItem onClick={() => handleFilter(col.key.toString(), '')}>
                  All
                </DropdownMenuItem>
                {col.filterOptions?.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onClick={() => handleFilter(col.key.toString(), option)}
                  >
                    {option}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredAndSortedData.length} of {data.length} records
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key.toString()}
                  className={cn(
                    'text-muted-foreground font-medium',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground',
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key.toString())}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && getSortIcon(col.key.toString())}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-border/30">
                  {columns.map((col, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-secondary/50 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredAndSortedData.map((row, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      'border-border/30 transition-all duration-200',
                      'hover:bg-pnb-maroon/10 hover:border-pnb-gold/20',
                      onRowClick && 'cursor-pointer'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key.toString()} className={col.className}>
                        {col.render
                          ? col.render(row[col.key as keyof T], row)
                          : String(row[col.key as keyof T] ?? '-')}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// Status badge component for tables
export function StatusBadge({
  status,
  variant,
}: {
  status: string
  variant?: 'new' | 'confirmed' | 'false_positive' | 'elite' | 'standard' | 'legacy' | 'critical'
}) {
  const variantStyles = {
    new: 'bg-pnb-gold/20 text-pnb-gold border-pnb-gold/30',
    confirmed: 'bg-elite/20 text-elite border-elite/30',
    false_positive: 'bg-muted text-muted-foreground border-border',
    elite: 'bg-elite/20 text-elite border-elite/30',
    standard: 'bg-pnb-gold/20 text-pnb-gold border-pnb-gold/30',
    legacy: 'bg-legacy/20 text-legacy border-legacy/30',
    critical: 'bg-critical/20 text-critical border-critical/30',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variant ? variantStyles[variant] : 'bg-secondary text-foreground border-border'
      )}
    >
      {status}
    </span>
  )
}

// PQC Support indicator
export function PQCSupportBadge({ supported }: { supported: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-center w-6 h-6 rounded-full',
      supported ? 'bg-elite/20 text-elite' : 'bg-critical/20 text-critical'
    )}>
      {supported ? (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <X className="w-4 h-4" />
      )}
    </div>
  )
}
