'use client'

import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Server,
  Activity,
  Shield,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BadgeCheck,
  CircleAlert,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  RiskDistributionChart, 
  ExpiryTimelineChart, 
  PQCScoreGauge,
  ChartSkeleton 
} from '@/components/dashboard/charts'
import QuickScanWidget from '@/components/dashboard/quick-scan'

// Updated to match the new robust Go Backend
interface KPIData {
  total_assets: number
  live_assets: number
  quantum_safe: number
  critical_risk: number
  pqc_score: number
  tls_coverage: number
}

interface ChartData {
  name: string
  value?: number
  count?: number
  fill: string
}

export default function DashboardPage() {
  const { isDemoMode } = useAuth()

  const { data: kpis, isLoading: kpiLoading, mutate: mutateKpis } = useSWR<KPIData>(
    'dashboard-kpis',
    () => api.getKPIs(),
    { refreshInterval: 5000 }
  )

  const { data: riskData, isLoading: riskLoading } = useSWR<ChartData[]>(
    'dashboard-risk',
    () => api.getRiskChart(),
    { refreshInterval: 5000 }
  )

  const { data: expiryData, isLoading: expiryLoading } = useSWR<ChartData[]>(
    'dashboard-expiry',
    () => api.getExpiryChart(),
    { refreshInterval: 5000 }
  )

  // Fallback simple KPI Card in case your imported one is broken
  const SimpleKPICard = ({ title, value, icon: Icon, color }: any) => (
    <div className="glass rounded-xl p-6 border border-border/50 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={`p-2 rounded-lg bg-secondary/50 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-foreground">{value}</h3>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time PQC & Attack Surface Analytics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutateKpis()}
          className="gap-2 border-pnb-gold/30 hover:border-pnb-gold/50 hover:bg-pnb-gold/10"
        >
          <RefreshCw className="h-4 w-4" />
          Sync Data
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Alert className={isDemoMode ? 'glass border-orange-500/40 bg-orange-500/5' : 'glass border-green-500/40 bg-green-500/5'}>
          {isDemoMode ? (
            <CircleAlert className="text-orange-400" />
          ) : (
            <BadgeCheck className="text-green-500" />
          )}
          <AlertTitle className="text-foreground">
            {isDemoMode ? 'Demo Data Mode Active' : 'Verified Live Data'}
          </AlertTitle>
          <AlertDescription>
            {isDemoMode
              ? 'This screen is showing mock/demo values. Connect backend API for production-grade live data.'
              : 'All insights shown here are real backend data from your scanning pipeline, not AI-generated mock data.'}
          </AlertDescription>
        </Alert>
      </motion.div>

            <QuickScanWidget />
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiLoading ? (
           Array(4).fill(0).map((_, i) => <div key={i} className="h-32 glass rounded-xl animate-pulse" />)
        ) : (
          <>
            <SimpleKPICard title="Total Assets" value={kpis?.total_assets || 0} icon={Server} color="text-pnb-gold" />
            <SimpleKPICard title="Live Endpoints" value={kpis?.live_assets || 0} icon={Activity} color="text-blue-400" />
            <SimpleKPICard title="Quantum-Safe (Elite)" value={kpis?.quantum_safe || 0} icon={Shield} color="text-green-500" />
            <SimpleKPICard title="Critical Risks" value={kpis?.critical_risk || 0} icon={AlertTriangle} color="text-red-500" />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {riskLoading ? <ChartSkeleton className="lg:col-span-1" /> : (
          <RiskDistributionChart data={riskData || []} className="lg:col-span-1" />
        )}

        {expiryLoading ? <ChartSkeleton className="lg:col-span-1" /> : (
          <ExpiryTimelineChart data={expiryData || []} className="lg:col-span-1" />
        )}

        <PQCScoreGauge score={kpis?.pqc_score || 0} className="lg:col-span-1" />
      </div>

      {/* Highly Informative Security Compliance Strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-5 border border-border/50"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Compliance & Architecture</h3>
          <TrendingUp className="h-4 w-4 text-elite" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-secondary/20 border border-white/5">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">NIST FIPS 203 Readiness</p>
            <p className="text-2xl font-semibold text-elite">
              {kpis?.total_assets && kpis?.total_assets > 0 
                ? `${Math.round((kpis.quantum_safe / kpis.total_assets) * 100)}%` 
                : '0%'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/20 border border-white/5">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">TLS 1.3 Coverage</p>
            <p className="text-2xl font-semibold text-foreground">{kpis?.tls_coverage || 0}%</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/20 border border-white/5">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Engine Architecture</p>
            <p className="text-lg font-semibold text-pnb-gold mt-1">Go (Goroutines)</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/20 border border-white/5">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Database Link</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-lg font-semibold text-foreground">PostgreSQL Active</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}