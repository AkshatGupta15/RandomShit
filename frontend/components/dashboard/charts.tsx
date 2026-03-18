'use client'

import { motion } from 'framer-motion'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

interface RiskDistributionData {
  name: string
  value: number
}

interface ExpiryData {
  name: string
  count: number
  fill: string
}

const RISK_COLORS = {
  Elite: 'oklch(0.65 0.2 145)',
  Standard: 'oklch(0.85 0.15 85)',
  Legacy: 'oklch(0.6 0.2 30)',
  Critical: 'oklch(0.55 0.25 25)',
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { fill?: string } }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="glass rounded-lg px-3 py-2 border border-pnb-gold/20 shadow-xl">
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.payload.fill || RISK_COLORS[entry.name as keyof typeof RISK_COLORS] }}
          />
          <span className="text-sm font-medium text-foreground">{entry.name}:</span>
          <span className="text-sm font-mono text-pnb-gold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function RiskDistributionChart({
  data,
  className,
}: {
  data: RiskDistributionData[]
  className?: string
}) {
  const total = data.reduce((acc, item) => acc + item.value, 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={cn('glass rounded-xl p-5 border border-border/50', className)}
    >
      <h3 className="text-sm font-medium text-foreground mb-4">Risk Distribution</h3>
      
      <div className="flex items-center gap-6">
        <div className="relative w-44 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={RISK_COLORS[entry.name as keyof typeof RISK_COLORS] || 'oklch(0.5 0.1 260)'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.map((item) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
            return (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: RISK_COLORS[item.name as keyof typeof RISK_COLORS] }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-foreground">{item.value}</span>
                  <span className="text-xs text-muted-foreground">({percentage}%)</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

export function ExpiryTimelineChart({
  data,
  className,
}: {
  data: ExpiryData[]
  className?: string
}) {
  // Ensure data is an array
  const chartData = Array.isArray(data) ? data : []

  if (!chartData || chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={cn('glass rounded-xl p-5 border border-border/50', className)}
      >
        <h3 className="text-sm font-medium text-foreground mb-4">Certificate Expiry Timeline</h3>
        <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
          No expiry data available
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={cn('glass rounded-xl p-5 border border-border/50', className)}
    >
      <h3 className="text-sm font-medium text-foreground mb-4">Certificate Expiry Timeline</h3>
      
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={120}
              tick={{ fill: 'oklch(0.65 0.02 260)', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(0.2 0.02 260)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

export function PQCScoreGauge({
  score,
  maxScore = 1000,
  className,
}: {
  score: number
  maxScore?: number
  className?: string
}) {
  const percentage = (score / maxScore) * 100
  const tier = score >= 700 ? 'Elite-PQC' : score >= 400 ? 'Standard' : 'Legacy'
  const tierColor = score >= 700 ? 'text-elite' : score >= 400 ? 'text-pnb-gold' : 'text-legacy'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={cn('glass rounded-xl p-5 border border-border/50', className)}
    >
      <h3 className="text-sm font-medium text-foreground mb-4">Enterprise PQC Rating</h3>
      
      <div className="flex flex-col items-center">
        {/* Circular gauge */}
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="oklch(0.2 0.02 260)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={score >= 700 ? 'oklch(0.65 0.2 145)' : score >= 400 ? 'oklch(0.85 0.15 85)' : 'oklch(0.6 0.2 30)'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${percentage * 2.51} 251`}
              initial={{ strokeDasharray: '0 251' }}
              animate={{ strokeDasharray: `${percentage * 2.51} 251` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className={cn('text-3xl font-bold font-mono', tierColor)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {score}
            </motion.span>
            <span className="text-xs text-muted-foreground">/{maxScore}</span>
          </div>
        </div>

        {/* Tier badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className={cn(
            'mt-4 px-4 py-1.5 rounded-full text-sm font-medium',
            score >= 700 ? 'bg-elite/20 text-elite' : score >= 400 ? 'bg-pnb-gold/20 text-pnb-gold' : 'bg-legacy/20 text-legacy'
          )}
        >
          {tier}
        </motion.div>

        {/* Tier scale */}
        <div className="w-full mt-4 flex justify-between text-[10px] text-muted-foreground">
          <span>Legacy {'<'}400</span>
          <span>Standard 400-700</span>
          <span>Elite {'>'}700</span>
        </div>
      </div>
    </motion.div>
  )
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('glass rounded-xl p-5 border border-border/50', className)}>
      <div className="h-4 w-32 bg-secondary rounded animate-pulse mb-4" />
      <div className="h-44 bg-secondary/50 rounded animate-pulse" />
    </div>
  )
}
