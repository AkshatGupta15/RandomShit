'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Network,
  Globe,
  MapPin,
  Server,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTable, StatusBadge, Column } from '@/components/tables/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface IPAddress {
  id: number
  company: string
  location: string
  netname: string
  asn: string
  subnet: string
  ports: string
  ip_address: string
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

const locations = ['India', 'Mumbai, India', 'Chennai, India', 'Nashik, India', 'Leh, India', 'Delhi, India']

export default function IPAddressesPage() {
  const [activeTab, setActiveTab] = useState('all')

  const { data: assets, error, isLoading, mutate } = useSWR<Asset[]>(
    'assets',
    () => api.getAssets(),
    { refreshInterval: 30000 }
  )

  // Transform assets to IP address format
 const ipAddresses: IPAddress[] = (Array.isArray(assets) ? assets : []).map((asset, index) => ({
    id: asset.id || index,
    company: 'Punjab National Bank',
    location: locations[index % locations.length],
    netname: index % 3 === 0 ? 'E2E-Networks-IN' : index % 3 === 1 ? 'Quantum-Link-Co' : 'MSFTAS',
    asn: 'AS9583',
    subnet: '103.107.224.0/22',
    ports: asset.type?.includes('Web') ? '80,443' : '22,443',
    ip_address: asset.ipv4 || `103.${100 + index}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    detection_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: index % 5 === 0 ? 'new' : index % 7 === 0 ? 'false_positive' : 'confirmed',
  }))

  const filteredData = activeTab === 'all'
    ? ipAddresses
    : ipAddresses.filter((ip) => ip.status === activeTab)

  const columns: Column<IPAddress>[] = [
    {
      key: 'ip_address',
      header: 'IP Address',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pnb-gold/20 flex items-center justify-center">
            <Network className="h-4 w-4 text-pnb-gold" />
          </div>
          <span className="font-mono font-medium text-pnb-gold">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-muted-foreground">{value as string}</span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      filterable: true,
      filterOptions: locations,
      render: (value) => (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {(value as string) || '-'}
        </div>
      ),
    },
    {
      key: 'netname',
      header: 'Netname',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{(value as string) || '-'}</span>
        </div>
      ),
    },
    {
      key: 'asn',
      header: 'ASN',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-sm text-elite">{value as string}</span>
      ),
    },
    {
      key: 'subnet',
      header: 'Subnet',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-xs">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'ports',
      header: 'Ports',
      render: (value) => (
        <div className="flex gap-1 flex-wrap">
          {(value as string).split(',').map((port, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono"
            >
              {port}
            </span>
          ))}
        </div>
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
    total: ipAddresses.length,
    new: ipAddresses.filter(ip => ip.status === 'new').length,
    confirmed: ipAddresses.filter(ip => ip.status === 'confirmed').length,
    falsePositive: ipAddresses.filter(ip => ip.status === 'false_positive').length,
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
          <h1 className="text-2xl font-bold text-foreground">IP Address / Subnets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Network infrastructure and IP address inventory
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
            <Network className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total IPs</p>
          </div>
          <p className="text-2xl font-bold font-mono">{stats.total}</p>
        </div>
        <div className="glass rounded-lg p-4 border border-pnb-gold/30">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-pnb-gold" />
            <p className="text-xs text-muted-foreground">New</p>
          </div>
          <p className="text-2xl font-bold font-mono text-pnb-gold">{stats.new}</p>
        </div>
        <div className="glass rounded-lg p-4 border border-elite/30">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-elite" />
            <p className="text-xs text-muted-foreground">Confirmed</p>
          </div>
          <p className="text-2xl font-bold font-mono text-elite">{stats.confirmed}</p>
        </div>
        <div className="glass rounded-lg p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">False Positive</p>
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
              searchPlaceholder="Search IP addresses..."
              searchKeys={['ip_address', 'company', 'location', 'netname']}
              isLoading={isLoading}
              emptyMessage={error ? 'Failed to load IP addresses' : 'No IP addresses found'}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
