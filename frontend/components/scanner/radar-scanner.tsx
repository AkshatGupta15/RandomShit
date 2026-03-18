'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RadarScannerProps {
  isScanning: boolean
  progress: number
  className?: string
}

export function RadarScanner({ isScanning, progress, className }: RadarScannerProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Radar container */}
      <div className="relative w-64 h-64 mx-auto">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-pnb-gold/30" />
        
        {/* Middle rings */}
        <div className="absolute inset-4 rounded-full border border-pnb-gold/20" />
        <div className="absolute inset-8 rounded-full border border-pnb-gold/15" />
        <div className="absolute inset-12 rounded-full border border-pnb-gold/10" />
        
        {/* Grid lines */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-[1px] bg-pnb-gold/10" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[1px] h-full bg-pnb-gold/10" />
        </div>
        
        {/* Scanning sweep */}
        {isScanning && (
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <div 
              className="absolute top-1/2 left-1/2 w-1/2 h-[2px] origin-left"
              style={{
                background: 'linear-gradient(90deg, oklch(0.85 0.15 85 / 0.8), transparent)',
                transform: 'translateY(-50%)',
              }}
            />
            {/* Sweep glow */}
            <div
              className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left"
              style={{
                background: 'conic-gradient(from 0deg, oklch(0.85 0.15 85 / 0.15), transparent 30deg)',
              }}
            />
          </motion.div>
        )}
        
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-3 h-3 rounded-full bg-pnb-gold"
            animate={isScanning ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ boxShadow: '0 0 10px oklch(0.85 0.15 85), 0 0 20px oklch(0.85 0.15 85 / 0.5)' }}
          />
        </div>
        
        {/* Detected points */}
        {isScanning && (
          <>
            <motion.div
              className="absolute w-2 h-2 rounded-full bg-elite"
              style={{ top: '25%', left: '60%' }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0.5], scale: [0, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
            <motion.div
              className="absolute w-2 h-2 rounded-full bg-standard"
              style={{ top: '45%', left: '75%' }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0.5], scale: [0, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            />
            <motion.div
              className="absolute w-2 h-2 rounded-full bg-critical"
              style={{ top: '70%', left: '35%' }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0.5], scale: [0, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
            />
            <motion.div
              className="absolute w-2 h-2 rounded-full bg-elite"
              style={{ top: '30%', left: '30%' }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0.5], scale: [0, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: 2 }}
            />
          </>
        )}
      </div>
      
      {/* Progress bar */}
      <div className="mt-6 max-w-xs mx-auto">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Scan Progress</span>
          <span className="text-pnb-gold font-mono">{progress.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, oklch(0.35 0.12 15), oklch(0.85 0.15 85))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>
      
      {/* Status text */}
      <motion.div
        className="mt-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {isScanning ? (
          <div className="flex items-center justify-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-pnb-gold"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-sm text-muted-foreground">
              Scanning network assets...
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            Ready to scan
          </span>
        )}
      </motion.div>
    </div>
  )
}

export function ScanProgress({ 
  progress, 
  scannedAssets, 
  totalAssets,
  className 
}: { 
  progress: number
  scannedAssets: number
  totalAssets: number
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Main progress bar */}
      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        {/* Animated background */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'repeating-linear-gradient(90deg, transparent, transparent 10px, oklch(0.85 0.15 85 / 0.3) 10px, oklch(0.85 0.15 85 / 0.3) 20px)',
            animation: 'data-flow 1s linear infinite',
          }}
        />
        
        {/* Progress fill */}
        <motion.div
          className="relative h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, oklch(0.35 0.12 15), oklch(0.5 0.15 15), oklch(0.85 0.15 85))',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Shimmer effect */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              animation: 'data-flow 2s ease-in-out infinite',
            }}
          />
        </motion.div>
      </div>
      
      {/* Stats */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-pnb-gold"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-muted-foreground">
            Scanning: <span className="text-foreground font-mono">{scannedAssets}</span> / {totalAssets} assets
          </span>
        </div>
        <span className="font-mono text-pnb-gold">{progress.toFixed(1)}%</span>
      </div>
    </div>
  )
}
