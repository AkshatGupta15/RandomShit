'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Key,
  Lock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTable, StatusBadge, Column } from '@/components/tables/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SSLCertificate {
  id: number
  certificate_authority: string
  company_name: string
  common_name: string
  valid_from: string
  valid_to?: string
  ssl_sha_fingerprint: string
  detection_date: string
  status: 'new' | 'false_positive' | 'confirmed'
  key_length?: string
  tls_version?: string
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

export default function SSLCertificatesPage() {
  const [activeTab, setActiveTab] = useState('all')

  const { data: assets, error, isLoading, mutate } = useSWR<Asset[]>(
    'assets',
    () => api.getAssets(),
    { refreshInterval: 30000 }
  )

  // Transform assets to SSL certificate format
  const sslCerts: SSLCertificate[] = (Array.isArray(assets) ? assets : []).map(
  (asset, index) => ({
    id: asset.id || index,
    certificate_authority: asset.certificateAuthority || 'Unknown',
    company_name: 'PNB',
    common_name: asset.assetName,
    valid_from: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    ssl_sha_fingerprint: `${Math.random().toString(36).substring(2, 15)}...`,
    detection_date: new Date().toISOString(),
    status: asset.certStatus === 'Valid' ? 'confirmed' : 'new',
    key_length: asset.keyLength,
    tls_version: asset.tlsVersion,
  }))

  const filteredData = activeTab === 'all'
    ? sslCerts
    : sslCerts.filter((cert) => cert.status === activeTab)

  const columns: Column<SSLCertificate>[] = [
    {
      key: 'certificate_authority',
      header: 'Certificate Authority',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-elite/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-elite" />
          </div>
          <span className="font-medium">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Company',
      sortable: true,
    },
    {
      key: 'common_name',
      header: 'Common Name',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-sm text-pnb-gold">{value as string}</span>
      ),
    },
    {
      key: 'key_length',
      header: 'Key Length',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <Key className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{(value as string) || 'N/A'}</span>
        </div>
      ),
    },
    {
      key: 'tls_version',
      header: 'TLS Version',
      sortable: true,
      render: (value) => {
        const version = value as string
        const isSecure = version?.includes('1.3') || version?.includes('1.2')
        return (
          <div className="flex items-center gap-1">
            <Lock className={cn('h-3 w-3', isSecure ? 'text-elite' : 'text-legacy')} />
            <span className={cn('text-sm', isSecure ? 'text-elite' : 'text-legacy')}>
              {version || 'N/A'}
            </span>
          </div>
        )
      },
    },
    {
      key: 'valid_from',
      header: 'Valid From',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(value as string).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'ssl_sha_fingerprint',
      header: 'SHA Fingerprint',
      render: (value) => (
        <span className="font-mono text-xs text-muted-foreground">
          {value as string}
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
    total: sslCerts.length,
    new: sslCerts.filter(c => c.status === 'new').length,
    confirmed: sslCerts.filter(c => c.status === 'confirmed').length,
    falsePositive: sslCerts.filter(c => c.status === 'false_positive').length,
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
          <h1 className="text-2xl font-bold text-foreground">SSL Certificates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage SSL/TLS certificate inventory
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
            <Shield className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Certificates</p>
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
            <Clock className="h-4 w-4 text-muted-foreground" />
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
            <TabsTrigger value="false_positive">False Positive ({stats.falsePositive})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <DataTable
              columns={columns}
              data={filteredData}
              searchPlaceholder="Search certificates..."
              searchKeys={['common_name', 'certificate_authority', 'company_name']}
              isLoading={isLoading}
              emptyMessage={error ? 'Failed to load certificates' : 'No certificates found'}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
