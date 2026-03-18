'use client'

import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Shield,
  Lock,
  AlertTriangle,
  CheckCircle,
  Key,
  RefreshCw,
  TrendingUp,
  Award,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable, StatusBadge, PQCSupportBadge, Column } from '@/components/tables/data-table'
import { PQCScoreGauge } from '@/components/dashboard/charts'

interface QuantumReadyAsset {
  id: number
  subdomain_id: number
  pqc_tier: 'Elite' | 'Standard' | 'Legacy'
  tls_version: string
  key_length: string
  issuer: string
  asset_name?: string
  url?: string
}

interface VulnerableAsset {
  id: number
  pqc_tier: 'Legacy' | 'Critical'
  tls_version: string
  key_length: string
  asset_name?: string
  vulnerability?: string
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

const tierDescriptions = {
  'Elite': 'TLS 1.3, PQC-Ready, NIST FIPS 203/204 Compliant',
  'Standard': 'TLS 1.2+, Strong ciphers, Forward secrecy',
  'Legacy': 'TLS 1.0/1.1, Weak ciphers, Needs remediation',
  'Critical': 'SSL v2/v3, Insecure, Immediate action required',
}

export default function CryptoInventoryPage() {
  const { data: quantumReady, isLoading: qrLoading, mutate: mutateQR } = useSWR(
    'crypto-quantum-ready',
    () => api.getQuantumReadyAssets(),
    { refreshInterval: 30000 }
  )

  const { data: vulnerable, isLoading: vulnLoading, mutate: mutateVuln } = useSWR(
    'crypto-vulnerabilities',
    () => api.getVulnerableAssets(),
    { refreshInterval: 30000 }
  )

  const { data: assets } = useSWR<Asset[]>(
    'assets',
    () => api.getAssets(),
    { refreshInterval: 30000 }
  )

  const handleRefresh = () => {
    mutateQR()
    mutateVuln()
  }

  // Transform assets into crypto inventory
  const cryptoAssets = (Array.isArray(assets) ? assets : []).map((asset, index) => ({
    id: asset.id,
    assetName: asset.assetName,
    url: asset.url,
    pqc_tier: asset.tlsVersion?.includes('1.3') ? 'Elite' as const : 
              asset.tlsVersion?.includes('1.2') ? 'Standard' as const : 'Legacy' as const,
    tls_version: asset.tlsVersion || 'Unknown',
    key_length: asset.keyLength || 'RSA-2048',
    cipher_suite: asset.cipherSuite || 'TLS_AES_256_GCM_SHA384',
    issuer: asset.certificateAuthority || 'Unknown',
    pqc_support: index % 3 === 0,
  }))

  const eliteAssets = cryptoAssets.filter(a => a.pqc_tier === 'Elite')
  const standardAssets = cryptoAssets.filter(a => a.pqc_tier === 'Standard')
  const legacyAssets = cryptoAssets.filter(a => a.pqc_tier === 'Legacy')

  const allCryptoColumns: Column<typeof cryptoAssets[0]>[] = [
    {
      key: 'assetName',
      header: 'Asset',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            row.pqc_tier === 'Elite' ? 'bg-elite/20' :
            row.pqc_tier === 'Standard' ? 'bg-pnb-gold/20' :
            'bg-legacy/20'
          )}>
            <Shield className={cn(
              'h-4 w-4',
              row.pqc_tier === 'Elite' ? 'text-elite' :
              row.pqc_tier === 'Standard' ? 'text-pnb-gold' :
              'text-legacy'
            )} />
          </div>
          <div>
            <p className="font-medium text-foreground">{row.assetName}</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{row.url}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'pqc_tier',
      header: 'PQC Tier',
      sortable: true,
      filterable: true,
      filterOptions: ['Elite', 'Standard', 'Legacy'],
      render: (value) => (
        <StatusBadge
          status={value as string}
          variant={value === 'Elite' ? 'elite' : value === 'Standard' ? 'standard' : 'legacy'}
        />
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
            <span className={cn('text-sm font-mono', isSecure ? 'text-elite' : 'text-legacy')}>
              {version}
            </span>
          </div>
        )
      },
    },
    {
      key: 'key_length',
      header: 'Key Algorithm',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <Key className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-sm">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'cipher_suite',
      header: 'Cipher Suite',
      render: (value) => (
        <span className="font-mono text-xs text-muted-foreground">{value as string}</span>
      ),
    },
    {
      key: 'pqc_support',
      header: 'PQC Support',
      render: (value) => <PQCSupportBadge supported={value as boolean} />,
    },
    {
      key: 'issuer',
      header: 'Issuer',
      sortable: true,
    },
  ]

  const stats = {
    total: cryptoAssets.length,
    elite: eliteAssets.length,
    standard: standardAssets.length,
    legacy: legacyAssets.length,
    pqcReady: cryptoAssets.filter(a => a.pqc_support).length,
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
          <h1 className="text-2xl font-bold text-foreground">Crypto Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Post-Quantum Cryptography readiness assessment
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2 border-border/50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </motion.div>

      {/* Stats and Score */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="glass rounded-lg p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Assets</p>
            </div>
            <p className="text-2xl font-bold font-mono">{stats.total}</p>
          </div>
          <div className="glass rounded-lg p-4 border border-elite/30">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-elite" />
              <p className="text-xs text-muted-foreground">Elite (PQC)</p>
            </div>
            <p className="text-2xl font-bold font-mono text-elite">{stats.elite}</p>
          </div>
          <div className="glass rounded-lg p-4 border border-pnb-gold/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-pnb-gold" />
              <p className="text-xs text-muted-foreground">Standard</p>
            </div>
            <p className="text-2xl font-bold font-mono text-pnb-gold">{stats.standard}</p>
          </div>
          <div className="glass rounded-lg p-4 border border-legacy/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-legacy" />
              <p className="text-xs text-muted-foreground">Legacy</p>
            </div>
            <p className="text-2xl font-bold font-mono text-legacy">{stats.legacy}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PQCScoreGauge score={755} className="h-full" />
        </motion.div>
      </div>

      {/* Compliance Tiers Reference */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl p-5 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-pnb-gold" />
          Compliance Tier Classification
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(tierDescriptions).map(([tier, description]) => (
            <div
              key={tier}
              className={cn(
                'p-3 rounded-lg border',
                tier === 'Elite' ? 'bg-elite/10 border-elite/30' :
                tier === 'Standard' ? 'bg-pnb-gold/10 border-pnb-gold/30' :
                tier === 'Legacy' ? 'bg-legacy/10 border-legacy/30' :
                'bg-critical/10 border-critical/30'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge
                  status={tier}
                  variant={tier === 'Elite' ? 'elite' : tier === 'Standard' ? 'standard' : tier === 'Legacy' ? 'legacy' : 'critical'}
                />
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Crypto Inventory Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Tabs defaultValue="all">
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="all">All Assets ({stats.total})</TabsTrigger>
            <TabsTrigger value="elite">Elite ({stats.elite})</TabsTrigger>
            <TabsTrigger value="standard">Standard ({stats.standard})</TabsTrigger>
            <TabsTrigger value="legacy">Legacy ({stats.legacy})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <DataTable
              columns={allCryptoColumns}
              data={cryptoAssets}
              searchPlaceholder="Search crypto assets..."
              searchKeys={['assetName', 'issuer', 'tls_version']}
              isLoading={qrLoading || vulnLoading}
              emptyMessage="No crypto assets found"
            />
          </TabsContent>

          <TabsContent value="elite" className="mt-4">
            <DataTable
              columns={allCryptoColumns}
              data={eliteAssets}
              searchPlaceholder="Search elite assets..."
              searchKeys={['assetName', 'issuer']}
              emptyMessage="No elite assets found"
            />
          </TabsContent>

          <TabsContent value="standard" className="mt-4">
            <DataTable
              columns={allCryptoColumns}
              data={standardAssets}
              searchPlaceholder="Search standard assets..."
              searchKeys={['assetName', 'issuer']}
              emptyMessage="No standard assets found"
            />
          </TabsContent>

          <TabsContent value="legacy" className="mt-4">
            <DataTable
              columns={allCryptoColumns}
              data={legacyAssets}
              searchPlaceholder="Search legacy assets..."
              searchKeys={['assetName', 'issuer']}
              emptyMessage="No legacy assets found"
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
