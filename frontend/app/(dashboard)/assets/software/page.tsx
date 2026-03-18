'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Package,
  Server,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Code,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTable, StatusBadge, Column } from '@/components/tables/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Software {
  id: number
  company_name: string
  host: string
  port: string
  type: string
  version: string
  product: string
  detection_date: string
  status: 'new' | 'false_positive' | 'confirmed'
}

interface Asset {
  id: number
  rootDomain: string
  assetName: string
  url: string
  ipv4: string
  type: string
  certStatus: string
  keyLength: string
  cipherSuite: string
  tlsVersion: string
  certificateAuthority: string
}

const statusVariants: Record<string, 'new' | 'confirmed' | 'false_positive'> = {
  new: 'new',
  confirmed: 'confirmed',
  false_positive: 'false_positive',
}

const products = ['Apache', 'Nginx', 'IIS', 'OpenResty', 'Tomcat', 'http_server']
const versions = ['10.0', '1.27.1.1', '2.4.52', '-', '9.0.65', '2.0']

export default function SoftwarePage() {
  const [activeTab, setActiveTab] = useState('all')

  const { data: assets, error, isLoading, mutate } = useSWR<Asset[]>(
    'assets',
    () => api.getAssets(),
    { refreshInterval: 30000 }
  )

  // Transform assets to software format
  const softwareList: Software[] = (Array.isArray(assets) ? assets : []).map((asset, index) => ({
    id: asset.id || index,
    company_name: 'PNB',
    host: asset.ipv4 || `49.${50 + index}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    port: asset.type?.includes('Web') ? (index % 2 === 0 ? '443' : '80') : '22',
    type: 'WebServer',
    version: versions[index % versions.length],
    product: products[index % products.length],
    detection_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: index % 5 === 0 ? 'new' : index % 7 === 0 ? 'false_positive' : 'confirmed',
  }))

  const filteredData = activeTab === 'all'
    ? softwareList
    : softwareList.filter((sw) => sw.status === activeTab)

  const columns: Column<Software>[] = [
    {
      key: 'company_name',
      header: 'Company',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pnb-maroon/20 flex items-center justify-center">
            <Package className="h-4 w-4 text-pnb-gold" />
          </div>
          <span className="font-medium">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'host',
      header: 'Host',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-sm text-pnb-gold">{value as string}</span>
      ),
    },
    {
      key: 'port',
      header: 'Port',
      sortable: true,
      render: (value) => (
        <span className="px-2 py-0.5 rounded bg-secondary font-mono text-xs">
          {value as string}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      filterable: true,
      filterOptions: ['WebServer', 'Database', 'API'],
      render: (value) => (
        <div className="flex items-center gap-1">
          <Server className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      sortable: true,
      filterable: true,
      filterOptions: products,
      render: (value) => (
        <div className="flex items-center gap-1">
          <Code className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm font-medium">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-sm">
          {(value as string) || '-'}
        </span>
      ),
    },
    {
      key: 'detection_date',
      header: 'Detection Date',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value as string).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value) => (
        <StatusBadge
          status={String(value).replace('_', ' ')}
          variant={statusVariants[value as string] || 'new'}
        />
      ),
    },
  ]

  const stats = {
    total: softwareList.length,
    new: softwareList.filter(sw => sw.status === 'new').length,
    confirmed: softwareList.filter(sw => sw.status === 'confirmed').length,
    falsePositive: softwareList.filter(sw => sw.status === 'false_positive').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Software</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detected software and services inventory
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          className="gap-2 border-border/50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="glass rounded-lg p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Software</p>
          </div>
          <p className="text-2xl font-bold font-mono">{stats.total}</p>
        </div>
        <div className="glass rounded-lg p-4 border border-pnb-gold/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-pnb-gold" />
            <p className="text-xs text-muted-foreground">New</p>
          </div>
          <p className="text-2xl font-bold font-mono text-pnb-gold">{stats.new}</p>
        </div>
        <div className="glass rounded-lg p-4 border border-elite/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-elite" />
            <p className="text-xs text-muted-foreground">Confirmed</p>
          </div>
          <p className="text-2xl font-bold font-mono text-elite">{stats.confirmed}</p>
        </div>
        <div className="glass rounded-lg p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">False/Ignore</p>
          </div>
          <p className="text-2xl font-bold font-mono text-muted-foreground">{stats.falsePositive}</p>
        </div>
      </motion.div>

      {/* Tabs and Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="new">New ({stats.new})</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed ({stats.confirmed})</TabsTrigger>
            <TabsTrigger value="false_positive">False/Ignore ({stats.falsePositive})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <DataTable
              columns={columns}
              data={filteredData}
              searchPlaceholder="Search software..."
              searchKeys={['product', 'host', 'company_name', 'version']}
              isLoading={isLoading}
              emptyMessage={error ? 'Failed to load software' : 'No software found'}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
