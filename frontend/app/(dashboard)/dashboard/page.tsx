'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Server,
  Activity,
  Shield,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { KPICard, KPICardSkeleton } from '@/components/dashboard/kpi-card'
import { 
  RiskDistributionChart, 
  ExpiryTimelineChart, 
  PQCScoreGauge,
  ChartSkeleton 
} from '@/components/dashboard/charts'

interface KPIData {
  total_assets: number
  live_assets: number
  quantum_safe: number
  critical_risk: number
}

interface RiskData {
  name: string
  value: number
}

interface ExpiryData {
  name: string
  count: number
  fill: string
}

export default function DashboardPage() {
  const [pqcScore] = useState(755)

  const { data: kpis, error: kpiError, isLoading: kpiLoading, mutate: mutateKpis } = useSWR<KPIData>(
    'dashboard-kpis',
    () => api.getKPIs(),
    { refreshInterval: 30000 }
  )

  const { data: riskData, error: riskError, isLoading: riskLoading } = useSWR<RiskData[]>(
    'dashboard-risk',
    () => api.getRiskChart(),
    { refreshInterval: 30000 }
  )

  const { data: expiryData, error: expiryError, isLoading: expiryLoading } = useSWR<ExpiryData[]>(
    'dashboard-expiry',
    () => api.getExpiryChart(),
    { refreshInterval: 30000 }
  )

  const handleRefresh = () => {
    mutateKpis()
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
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time security posture overview
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2 border-pnb-gold/30 hover:border-pnb-gold/50 hover:bg-pnb-gold/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : kpiError ? (
          <div className="col-span-4 glass rounded-xl p-8 text-center border border-destructive/30">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load KPIs</p>
          </div>
        ) : (
          <>
            <KPICard
              title="Total Assets"
              value={kpis?.total_assets || 0}
              icon={Server}
              variant="gold"
              delay={0}
              trend={{ value: 12, isPositive: true }}
            />
            <KPICard
              title="Live Endpoints"
              value={kpis?.live_assets || 0}
              icon={Activity}
              variant="default"
              delay={0.1}
            />
            <KPICard
              title="Quantum-Safe (Elite)"
              value={kpis?.quantum_safe || 0}
              icon={Shield}
              variant="elite"
              delay={0.2}
              trend={{ value: 8, isPositive: true }}
            />
            <KPICard
              title="Critical Risks"
              value={kpis?.critical_risk || 0}
              icon={AlertTriangle}
              variant="critical"
              delay={0.3}
              trend={{ value: 2, isPositive: false }}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {riskLoading ? (
          <ChartSkeleton className="lg:col-span-1" />
        ) : riskError ? (
          <div className="glass rounded-xl p-8 text-center border border-destructive/30">
            <p className="text-sm text-muted-foreground">Failed to load chart</p>
          </div>
        ) : (
          <RiskDistributionChart
  data={Array.isArray(riskData) ? riskData : []}
  className="lg:col-span-1"
/>
        )}

        {expiryLoading ? (
          <ChartSkeleton className="lg:col-span-1" />
        ) : expiryError ? (
          <div className="glass rounded-xl p-8 text-center border border-destructive/30">
            <p className="text-sm text-muted-foreground">Failed to load chart</p>
          </div>
        ) : (
          <ExpiryTimelineChart data={expiryData || []} className="lg:col-span-1" />
        )}

        <PQCScoreGauge score={pqcScore} className="lg:col-span-1" />
      </div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-xl p-5 border border-border/50"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Security Compliance</h3>
          <TrendingUp className="h-4 w-4 text-elite" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">NIST FIPS 203/204</p>
            <p className="text-lg font-semibold text-elite">Compliant</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">TLS 1.3 Coverage</p>
            <p className="text-lg font-semibold text-foreground">87%</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">Certificate Health</p>
            <p className="text-lg font-semibold text-pnb-gold">Good</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">Last Scan</p>
            <p className="text-lg font-semibold text-foreground">2h ago</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
