'use client'

import { cn } from '@/lib/utils'

interface PNBLogoProps {
  className?: string
  showText?: boolean
}

export function PNBLogo({ className, showText = true }: PNBLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg
        viewBox="0 0 48 48"
        className="h-10 w-10 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield background */}
        <defs>
          <linearGradient id="pnb-shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B0000" />
            <stop offset="50%" stopColor="#600000" />
            <stop offset="100%" stopColor="#400000" />
          </linearGradient>
          <linearGradient id="pnb-gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#DAA520" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Outer shield */}
        <path
          d="M24 2L6 10v14c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V10L24 2z"
          fill="url(#pnb-shield-gradient)"
          stroke="url(#pnb-gold-gradient)"
          strokeWidth="1.5"
        />
        
        {/* Inner quantum pattern */}
        <g filter="url(#glow)">
          {/* Central atom */}
          <circle cx="24" cy="24" r="4" fill="url(#pnb-gold-gradient)" />
          
          {/* Orbits */}
          <ellipse
            cx="24"
            cy="24"
            rx="10"
            ry="4"
            fill="none"
            stroke="url(#pnb-gold-gradient)"
            strokeWidth="1"
            opacity="0.8"
          />
          <ellipse
            cx="24"
            cy="24"
            rx="10"
            ry="4"
            fill="none"
            stroke="url(#pnb-gold-gradient)"
            strokeWidth="1"
            opacity="0.8"
            transform="rotate(60 24 24)"
          />
          <ellipse
            cx="24"
            cy="24"
            rx="10"
            ry="4"
            fill="none"
            stroke="url(#pnb-gold-gradient)"
            strokeWidth="1"
            opacity="0.8"
            transform="rotate(120 24 24)"
          />
          
          {/* Electron dots */}
          <circle cx="34" cy="24" r="2" fill="url(#pnb-gold-gradient)" />
          <circle cx="19" cy="15" r="2" fill="url(#pnb-gold-gradient)" />
          <circle cx="19" cy="33" r="2" fill="url(#pnb-gold-gradient)" />
        </g>
        
        {/* PNB text at bottom */}
        <text
          x="24"
          y="41"
          textAnchor="middle"
          fill="url(#pnb-gold-gradient)"
          fontSize="7"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          PNB
        </text>
      </svg>
      
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-gradient-gold">
            Quantum Shield
          </span>
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
            Post-Quantum Security
          </span>
        </div>
      )}
    </div>
  )
}

export function QuantumShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-6 w-6', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="shield-mini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B0000" />
          <stop offset="100%" stopColor="#600000" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z"
        fill="url(#shield-mini-grad)"
        stroke="#DAA520"
        strokeWidth="1"
      />
      <circle cx="12" cy="11" r="2" fill="#DAA520" />
      <ellipse cx="12" cy="11" rx="4" ry="1.5" fill="none" stroke="#DAA520" strokeWidth="0.5" opacity="0.7" />
    </svg>
  )
}
