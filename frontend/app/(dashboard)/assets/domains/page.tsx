'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Calendar,
  Building2,
  Clock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DataTable, StatusBadge, Column } from '@/components/tables/data-table'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { ArrowUpRight } from "lucide-react"

interface Domain {
  id: number
  domain: string
  domain_name?: string
  status: string
  endpoints?: number
  scanned_assets?: number
  total_assets?: number
  lastScanned?: string | null
  last_scanned?: string | null
  riskLevel?: string
  company_name?: string
  registrar?: string
  registration_date?: string
  detection_date?: string
}

const statusVariants: Record<string, 'new' | 'confirmed' | 'legacy' | 'critical'> = {
  pending: 'new',
  scanning: 'new',
  active: 'confirmed',
  completed: 'confirmed',
  failed: 'critical',
  inactive: 'legacy',
   halted: 'legacy', 
}

export default function DomainsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: response, error, isLoading, mutate } = useSWR<{ data: Domain[] }>(
    'domains',
    () => api.domains.getAll(),
    { refreshInterval: 10000 }
  )
  
  const domains = response?.data || []

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return

    setIsAdding(true)
    try {
      await api.domains.add(newDomain.trim())
      await mutate()
      setNewDomain('')
      setIsAddDialogOpen(false)
    } catch (err) {
      console.error('Add Domain Error:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteDomain = async (id: number) => {
    setDeleteId(id)
    try {
      await api.domains.delete(id)
      await mutate()
    } catch (err) {
      console.error('Failed to delete domain:', err)
    } finally {
      setDeleteId(null)
    }
  }

  const columns: Column<Domain>[] = [
    {
      key: 'domain',
      header: 'Domain Name',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-pnb-maroon/20 flex items-center justify-center">
            <Globe className="h-4 w-4 text-pnb-gold" />
          </div>
          <div>
            <p className="font-medium text-foreground">{row.domain || row.domain_name}</p>
            {row.company_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {row.company_name}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'registrar',
      header: 'Registrar',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {(value as string) || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'registration_date',
      header: 'Registration Date',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {value ? new Date(value as string).toLocaleDateString() : '-'}
        </div>
      ),
    },
    {
      key: 'detection_date',
      header: 'Detection Date',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {value ? new Date(value as string).toLocaleDateString() : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      filterOptions: ['pending', 'scanning', 'completed', 'failed'],
      render: (value) => (
        <StatusBadge
          status={String(value)}
          variant={statusVariants[value as string] || 'new'}
        />
      ),
    },
    {
      key: 'endpoints',
      header: 'Endpoints',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-red-500 ">
            {row.total_assets || 0}
          </span>
        </div>
      ),
    },
    {
  key: 'view',
  header: 'View',
  className: 'w-16',
  render: (_, row) => (
<Link
  href={`/domains/${row.id}`}
  className="group inline-flex items-center gap-1 text-pnb-gold text-sm font-semibold"
>
  Details
  <ArrowUpRight size={14} className="opacity-60 group-hover:opacity-100 transition" />
</Link>
  ),
},
    // {
    //   key: 'riskLevel',
    //   header: 'Risk Level',
    //   sortable: true,
    //   render: (value) => {
    //     const riskColors: Record<string, string> = {
    //       low: 'bg-elite/20 text-elite',
    //       medium: 'bg-pnb-gold/20 text-pnb-gold',
    //       high: 'bg-critical/20 text-critical',
    //       unknown: 'bg-muted/20 text-muted-foreground',
    //     }
    //     const risk = (value as string) || 'unknown'
    //     return (
    //       <span className={cn('px-2 py-1 rounded-full text-xs font-medium capitalize', riskColors[risk] || riskColors.unknown)}>
    //         {risk}
    //       </span>
    //     )
    //   },
    // },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`https://${row.domain || row.domain_name}`, '_blank')
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteDomain(row.id)
            }}
            disabled={deleteId === row.id}
          >
            {deleteId === row.id ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Domains</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage target domains for security scanning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            className="gap-2 border-border/50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-2 bg-pnb-maroon hover:bg-pnb-maroon-dark border border-pnb-gold/30"
              >
                <Plus className="h-4 w-4" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-pnb-gold/30">
              <DialogHeader>
                <DialogTitle>Add Target Domain</DialogTitle>
                <DialogDescription>
                  Enter a domain name to add to the monitoring list
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="bg-secondary/50 border-border/50 focus:border-pnb-gold"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="border-border/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddDomain}
                  disabled={isAdding || !newDomain.trim()}
                  className="bg-pnb-maroon hover:bg-pnb-maroon-dark border border-pnb-gold/30"
                >
                  {isAdding ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" />
                      Adding...
                    </>
                  ) : (
                    'Add Domain'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Domains', value: domains?.length || 0, color: 'text-foreground' },
          { label: 'New', value: domains?.filter(d => d.status === 'pending').length || 0, color: 'text-pnb-gold' },
          { label: 'Completed', value: domains?.filter(d => d.status === 'completed').length || 0, color: 'text-elite' },
          { label: 'Failed', value: domains?.filter(d => d.status === 'failed').length || 0, color: 'text-critical' },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-lg p-4 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={cn('text-2xl font-bold font-mono', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={columns}
          data={domains || []}
          searchPlaceholder="Search domains..."
          searchKeys={['domain', 'domain_name', 'company_name', 'registrar']}
          isLoading={isLoading}
          emptyMessage={error ? 'Failed to load domains' : 'No domains found'}
        />
      </motion.div>
    </div>
  )
}
