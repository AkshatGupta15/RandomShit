'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import {
  Play,
  Square,
  RefreshCw,
  Globe,
  Server,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadarScanner, ScanProgress } from '@/components/scanner/radar-scanner'

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
}

interface ScanStatus {
  status: 'idle' | 'scanning' | 'completed' | 'stopped'
  percentage: number
  scanned_assets: number
  total_assets: number
}

interface DiscoveredAsset {
  id: number
  name: string
  type: 'domain' | 'ssl' | 'ip' | 'software'
  status: 'elite' | 'standard' | 'legacy' | 'critical'
  timestamp: Date
}

type DiscoveryFeedItem = {
  id?: unknown
  name?: unknown
  type?: unknown
  status?: unknown
  timestamp?: unknown
}

function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

export default function ScannerPage() {
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    status: 'idle',
    percentage: 0,
    scanned_assets: 0,
    total_assets: 0,
  })
  const [discoveredAssets, setDiscoveredAssets] = useState<DiscoveredAsset[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  const { data: domainsResponse, isLoading: domainsLoading } = useSWR<{ data: unknown[] }>(
    'scanner-domains',
    () => api.domains.getAll(),
    { refreshInterval: 10000 }
  )

  const domains: Domain[] = (Array.isArray(domainsResponse?.data) ? domainsResponse.data : []).map((item) => {
    const domain = item as Record<string, unknown>
    return {
      id: Number(domain.id ?? 0),
      domain: (domain.domain as string | undefined) || (domain.domain_name as string | undefined) || '',
      domain_name: (domain.domain_name as string | undefined) || (domain.domain as string | undefined) || '',
      status: (domain.status as string | undefined) || 'unknown',
      endpoints: Number(domain.endpoints ?? domain.total_assets ?? domain.scanned_assets ?? 0),
      scanned_assets: Number(domain.scanned_assets ?? domain.endpoints ?? 0),
      total_assets: Number(domain.total_assets ?? domain.scanned_assets ?? domain.endpoints ?? 0),
      lastScanned:
        (domain.lastScanned as string | null | undefined) ||
        (domain.last_scanned as string | null | undefined) ||
        null,
      last_scanned:
        (domain.last_scanned as string | null | undefined) ||
        (domain.lastScanned as string | null | undefined) ||
        null,
      riskLevel: (domain.riskLevel as string | undefined) || (domain.risk_level as string | undefined) || 'unknown',
    }
  })

  const pollDiscoveryFeed = useCallback(async () => {
    if (!selectedDomainId) return

    try {
      const response = await api.getDiscoveryFeed(selectedDomainId, 20)
      const rows = Array.isArray((response as { data?: unknown })?.data)
        ? ((response as { data?: DiscoveryFeedItem[] }).data ?? [])
        : []

      const normalized = rows.map((item, index) => {
        const rawType = typeof item.type === 'string' ? item.type.toLowerCase() : 'domain'
        const type: DiscoveredAsset['type'] =
          rawType === 'ssl' || rawType === 'ip' || rawType === 'software' || rawType === 'domain'
            ? rawType
            : 'domain'

        const rawStatus = typeof item.status === 'string' ? item.status.toLowerCase() : 'standard'
        const status: DiscoveredAsset['status'] =
          rawStatus === 'elite' || rawStatus === 'legacy' || rawStatus === 'critical' || rawStatus === 'standard'
            ? rawStatus
            : 'standard'

        const parsedTimestamp = item.timestamp ? new Date(String(item.timestamp)) : new Date()
        const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp

        return {
          id: Number(item.id ?? index),
          name: typeof item.name === 'string' && item.name.trim() ? item.name : 'unknown-asset',
          type,
          status,
          timestamp,
        }
      })

      setDiscoveredAssets(normalized)
    } catch (error) {
      console.error('Failed to fetch discovery feed:', error)
    }
  }, [selectedDomainId])

  // Poll scan status when scanning
  const pollScanStatus = useCallback(async () => {
    if (!selectedDomainId || scanStatus.status !== 'scanning') return

    try {
      const status = await api.getScanStatus(selectedDomainId)

      const percentage = toNumber((status as { percentage?: unknown; progress?: unknown }).percentage ?? (status as { percentage?: unknown; progress?: unknown }).progress, 0)
      const scannedAssets = toNumber((status as { scanned_assets?: unknown; scannedEndpoints?: unknown; discoveredEndpoints?: unknown }).scanned_assets ?? (status as { scanned_assets?: unknown; scannedEndpoints?: unknown; discoveredEndpoints?: unknown }).scannedEndpoints ?? (status as { scanned_assets?: unknown; scannedEndpoints?: unknown; discoveredEndpoints?: unknown }).discoveredEndpoints, 0)
      const totalAssets = toNumber((status as { total_assets?: unknown; totalEndpoints?: unknown }).total_assets ?? (status as { total_assets?: unknown; totalEndpoints?: unknown }).totalEndpoints, 0)

      setScanStatus({
        status: (status as { status?: string }).status === 'completed' ? 'completed' : 'scanning',
        percentage,
        scanned_assets: scannedAssets,
        total_assets: totalAssets,
      })

      if ((status as { status?: string }).status === 'completed' || percentage >= 100) {
        setScanStatus(prev => ({ ...prev, status: 'completed' }))
      }
    } catch (error) {
      console.error('Failed to poll scan status:', error)
    }
  }, [selectedDomainId, scanStatus.status])

  useEffect(() => {
    if (scanStatus.status === 'scanning') {
      const interval = setInterval(pollScanStatus, 2000)
      return () => clearInterval(interval)
    }
  }, [scanStatus.status, pollScanStatus])

  useEffect(() => {
    if (!selectedDomainId) {
      setDiscoveredAssets([])
      return
    }

    void pollDiscoveryFeed()
  }, [selectedDomainId, pollDiscoveryFeed])

  useEffect(() => {
    if (scanStatus.status !== 'scanning') return

    const interval = setInterval(() => {
      void pollDiscoveryFeed()
    }, 2500)

    return () => clearInterval(interval)
  }, [scanStatus.status, pollDiscoveryFeed])

  const handleStartScan = async () => {
    if (!selectedDomainId) return

    setIsStarting(true)
    setDiscoveredAssets([])
    try {
      await api.startScan(selectedDomainId)
      setScanStatus({
        status: 'scanning',
        percentage: 0,
        scanned_assets: 0,
        total_assets: 40,
      })
    } catch (error) {
      console.error('Failed to start scan:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopScan = async () => {
    if (!selectedDomainId) return

    setIsStopping(true)
    try {
      await api.stopScan(selectedDomainId)
      setScanStatus(prev => ({ ...prev, status: 'stopped' }))
    } catch (error) {
      console.error('Failed to stop scan:', error)
    } finally {
      setIsStopping(false)
    }
  }

  const selectedDomain = domains?.find(d => d.id === selectedDomainId)
  const isScanning = scanStatus.status === 'scanning'

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'domain': return Globe
      case 'ssl': return Shield
      case 'ip': return Server
      case 'software': return Activity
      default: return Globe
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'elite': return 'text-elite'
      case 'standard': return 'text-pnb-gold'
      case 'legacy': return 'text-legacy'
      case 'critical': return 'text-critical'
      default: return 'text-foreground'
    }
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
          <h1 className="text-2xl font-bold text-foreground">Scanner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Attack surface discovery and cryptographic analysis
          </p>
        </div>
      </motion.div>

      {/* Scanner Control Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Left: Radar */}
        <div className="glass rounded-xl p-6 border border-border/50">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-pnb-gold" />
            Quantum Scanner
          </h3>
          
          <RadarScanner
            isScanning={isScanning}
            progress={scanStatus.percentage}
          />
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Domain Selector */}
          <div className="glass rounded-xl p-6 border border-border/50">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Target Domain
            </h3>
            
            <div className="flex gap-3">
              <Select
                value={selectedDomainId?.toString() || ''}
                onValueChange={(value) => setSelectedDomainId(Number(value))}
                disabled={isScanning}
              >
                <SelectTrigger className="flex-1 bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select a domain to scan" />
                </SelectTrigger>
                <SelectContent className="glass border-border/50">
                  {domainsLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : domains?.length === 0 ? (
                    <SelectItem value="none" disabled>No domains available</SelectItem>
                  ) : (
                    domains?.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-pnb-gold" />
                          {domain.domain || domain.domain_name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {!isScanning ? (
                <Button
                  onClick={handleStartScan}
                  disabled={!selectedDomainId || isStarting}
                  className="gap-2 bg-pnb-maroon hover:bg-pnb-maroon-dark border border-pnb-gold/30 px-6"
                >
                  {isStarting ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Start Scan
                </Button>
              ) : (
                <Button
                  onClick={handleStopScan}
                  disabled={isStopping}
                  variant="destructive"
                  className="gap-2 px-6"
                >
                  {isStopping ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Stop
                </Button>
              )}
            </div>

            {selectedDomain && (
              <div className="mt-4 p-3 rounded-lg bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last scanned:</span>
                  <span className="text-foreground">
                    {(selectedDomain.lastScanned || selectedDomain.last_scanned)
                      ? new Date(selectedDomain.lastScanned || selectedDomain.last_scanned || '').toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-pnb-gold">
                    {selectedDomain.endpoints || 0} endpoints
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {(isScanning || scanStatus.status === 'completed') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass rounded-xl p-6 border border-pnb-gold/30"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Scan Progress</h3>
                {scanStatus.status === 'completed' && (
                  <span className="flex items-center gap-1 text-xs text-elite">
                    <CheckCircle className="h-3 w-3" />
                    Completed
                  </span>
                )}
              </div>
              
              <ScanProgress
                progress={scanStatus.percentage}
                scannedAssets={scanStatus.scanned_assets}
                totalAssets={scanStatus.total_assets}
              />
            </motion.div>
          )}

          {/* Engine Status */}
          <div className="glass rounded-xl p-6 border border-border/50">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Engine Telemetry
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-1">Architecture</p>
                <p className="text-sm font-medium">Golang M:N Scheduler</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-1">Active Goroutines</p>
                <p className="text-sm font-mono text-elite">{isScanning ? 45 : 2}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-1">Memory Used</p>
                <p className="text-sm font-mono">{isScanning ? '24' : '12'} MB</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-1">Workers</p>
                <p className="text-sm font-mono text-pnb-gold">{isScanning ? '20' : '0'}/20</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Discovered Assets Feed */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-6 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <RefreshCw className={cn('h-4 w-4', isScanning && 'animate-spin text-pnb-gold')} />
          Live Discovery Feed
        </h3>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {discoveredAssets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {isScanning ? 'Discovering assets...' : 'Start a scan to discover assets'}
              </div>
            ) : (
              discoveredAssets.map((asset) => {
                const Icon = getAssetIcon(asset.type)
                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      asset.status === 'elite' ? 'bg-elite/20' :
                      asset.status === 'critical' ? 'bg-critical/20' :
                      asset.status === 'legacy' ? 'bg-legacy/20' :
                      'bg-pnb-gold/20'
                    )}>
                      <Icon className={cn('h-4 w-4', getStatusColor(asset.status))} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">{asset.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{asset.type}</p>
                    </div>
                    <div className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                      asset.status === 'elite' ? 'bg-elite/20 text-elite' :
                      asset.status === 'critical' ? 'bg-critical/20 text-critical' :
                      asset.status === 'legacy' ? 'bg-legacy/20 text-legacy' :
                      'bg-pnb-gold/20 text-pnb-gold'
                    )}>
                      {asset.status}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {asset.timestamp.toLocaleTimeString()}
                    </div>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
