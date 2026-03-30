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

  const normalizedRiskData = (riskData || []).map((item) => ({
    name: item.name,
    value: item.value ?? item.count ?? 0,
  }))

  const normalizedExpiryData = (expiryData || []).map((item) => ({
    name: item.name,
    count: item.count ?? item.value ?? 0,
    fill: item.fill,
  }))

  // Refined, denser KPI Card
  const SimpleKPICard = ({ title, value, icon: Icon, color }: any) => (
    <div className="glass rounded-xl p-4 border border-border/50 flex flex-col justify-between shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className={`p-1.5 rounded-md bg-secondary/30 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-foreground font-mono">{value}</h3>
    </div>
  )

  return (
    <div className="space-y-4"> {/* Reduced overall gap from 6 to 4 */}
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between bg-secondary/10 p-4 rounded-xl border border-border/50"
      >
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-pnb-gold" /> 
            Enterprise Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time Post-Quantum Cryptography & Attack Surface Analytics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutateKpis()}
          className="h-8 text-xs gap-2 border-pnb-gold/30 hover:border-pnb-gold/50 hover:bg-pnb-gold/10 font-medium"
        >
          <RefreshCw className="h-3 w-3" />
          Sync Data
        </Button>
      </motion.div>

      {/* Tighter Alert Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Alert className={`py-2.5 px-4 ${isDemoMode ? 'glass border-orange-500/40 bg-orange-500/5' : 'glass border-green-500/40 bg-green-500/5'}`}>
          <div className="flex items-center gap-3">
            {/* {isDemoMode ? (
              <CircleAlert className="h-4 w-4 text-orange-400 shrink-0" />
            ) : (
              <BadgeCheck className="h-4 w-4 text-green-500 shrink-0" />
            )} */}
            {/* <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full">
              <AlertTitle className="text-xs font-bold text-foreground m-0">
                {isDemoMode ? 'Demo Data Mode Active' : 'Verified Live Data Stream Active'}
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground m-0">
                {isDemoMode
                  ? '— Showing mock values. Connect API for live data.'
                  : '— All insights reflect real-time network telemetry.'}
              </AlertDescription>
            </div> */}
          </div>
        </Alert>
      </motion.div>

      {/* The Scanner Widget */}
      <QuickScanWidget />
      
      {/* Dense KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiLoading ? (
           Array(4).fill(0).map((_, i) => <div key={i} className="h-24 glass rounded-xl animate-pulse" />)
        ) : (
          <>
            <SimpleKPICard title="Total Assets" value={kpis?.total_assets || 0} icon={Server} color="text-pnb-gold" />
            <SimpleKPICard title="Live Endpoints" value={kpis?.live_assets || 0} icon={Activity} color="text-blue-400" />
            <SimpleKPICard title="Quantum-Safe" value={kpis?.quantum_safe || 0} icon={Shield} color="text-green-500" />
            <SimpleKPICard title="Critical Risks" value={kpis?.critical_risk || 0} icon={AlertTriangle} color="text-red-500" />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {riskLoading ? <ChartSkeleton className="lg:col-span-1 h-[280px]" /> : (
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-4">
            <RiskDistributionChart data={normalizedRiskData} className="h-[250px]" />
          </div>
        )}

        {expiryLoading ? <ChartSkeleton className="lg:col-span-1 h-[280px]" /> : (
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-4">
            <ExpiryTimelineChart data={normalizedExpiryData} className="h-[250px]" />
          </div>
        )}
        
        <div className="bg-[#0f1219] border border-white/5 rounded-xl p-4">
          <PQCScoreGauge score={kpis?.pqc_score || 0} className="h-[250px]" />
        </div>
      </div>

      {/* Highly Informative Security Compliance Strip - Made Compact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#0f1219] rounded-xl p-4 border border-white/5 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-pnb-gold" /> System Telemetry
          </h3>
          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-secondary/10 border border-white/5">
            <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">FIPS 203 Readiness</p>
            <p className="text-lg font-bold text-green-400 font-mono">
              {kpis?.total_assets && kpis?.total_assets > 0 
                ? `${Math.round((kpis.quantum_safe / kpis.total_assets) * 100)}%` 
                : '0%'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/10 border border-white/5">
            <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">TLS 1.3 Coverage</p>
            <p className="text-lg font-bold text-foreground font-mono">{kpis?.tls_coverage || 0}%</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/10 border border-white/5">
            <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Engine Logic</p>
            <p className="text-sm font-semibold text-pnb-gold mt-1.5">Go Asynchronous</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/10 border border-white/5">
            <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Data Pipeline</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-semibold text-foreground">PostgreSQL Sync</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}