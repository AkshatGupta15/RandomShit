'use client'

import { motion } from 'framer-motion'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
// import { AnimatedNumber } from './animated-number'

interface KPICardProps {
  title: string
  value: number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'elite' | 'critical' | 'gold'
  delay?: number
  suffix?: string
}

const variantStyles = {
  default: {
    container: 'border-border/50 hover:border-pnb-gold/30',
    icon: 'bg-secondary text-foreground',
    value: 'text-foreground',
  },
  elite: {
    container: 'border-elite/30 hover:border-elite/50',
    icon: 'bg-elite/20 text-elite',
    value: 'text-elite',
  },
  critical: {
    container: 'border-critical/30 hover:border-critical/50',
    icon: 'bg-critical/20 text-critical',
    value: 'text-critical',
  },
  gold: {
    container: 'border-pnb-gold/30 hover:border-pnb-gold/50',
    icon: 'bg-pnb-gold/20 text-pnb-gold',
    value: 'text-pnb-gold',
  },
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  delay = 0,
  suffix,
}: KPICardProps) {
  const styles = variantStyles[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        'relative group overflow-hidden rounded-xl',
        'glass p-5 border transition-all duration-300',
        styles.container
      )}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div 
          className="absolute inset-0"
          style={{
            background: variant === 'elite' 
              ? 'radial-gradient(circle at 80% 20%, oklch(0.65 0.2 145 / 0.1), transparent 50%)'
              : variant === 'critical'
              ? 'radial-gradient(circle at 80% 20%, oklch(0.55 0.25 25 / 0.1), transparent 50%)'
              : variant === 'gold'
              ? 'radial-gradient(circle at 80% 20%, oklch(0.85 0.15 85 / 0.1), transparent 50%)'
              : 'radial-gradient(circle at 80% 20%, oklch(0.35 0.12 15 / 0.1), transparent 50%)'
          }}
        />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <div className="flex items-baseline gap-1">
            {/* <AnimatedNumber
              value={value}
              duration={2000}
              delay={delay * 1000 + 300}
              className={cn('text-3xl font-bold font-mono tracking-tight', styles.value)}
            /> */}
            {suffix && (
              <span className={cn('text-lg font-medium', styles.value)}>{suffix}</span>
            )}
          </div>
          
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-xs',
              trend.isPositive ? 'text-elite' : 'text-critical'
            )}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              <span className="text-muted-foreground ml-1">vs last scan</span>
            </div>
          )}
        </div>

        <div className={cn(
          'p-3 rounded-lg transition-transform duration-300 group-hover:scale-110',
          styles.icon
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Animated border glow */}
      {variant !== 'default' && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          style={{
            boxShadow: variant === 'elite'
              ? '0 0 20px oklch(0.65 0.2 145 / 0.2), inset 0 0 20px oklch(0.65 0.2 145 / 0.05)'
              : variant === 'critical'
              ? '0 0 20px oklch(0.55 0.25 25 / 0.2), inset 0 0 20px oklch(0.55 0.25 25 / 0.05)'
              : '0 0 20px oklch(0.85 0.15 85 / 0.2), inset 0 0 20px oklch(0.85 0.15 85 / 0.05)'
          }}
        />
      )}
    </motion.div>
  )
}

export function KPICardSkeleton() {
  return (
    <div className="glass rounded-xl p-5 border border-border/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-secondary rounded animate-pulse mb-3" />
          <div className="h-8 w-16 bg-secondary rounded animate-pulse" />
        </div>
        <div className="w-11 h-11 bg-secondary rounded-lg animate-pulse" />
      </div>
    </div>
  )
}
