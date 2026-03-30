'use client'

import { useState } from 'react'
import { Search, Loader2, ShieldCheck, Cpu, Lock, TriangleAlert, Zap, Share2, RefreshCw, Activity, Globe } from 'lucide-react'
interface EnrichedPQCReport {
  hostname: string
  is_pqc_enabled: boolean
  detected_algorithm: string
  tls_version: string
  q_day_risk: number
  security_score: number
  qkd_status: string
  handshake_text: string
  threat_level: number
  readiness: number
  hardening_roadmap: string[]
  legacy_weaknesses: string[]
}

export default function QuickScanWidget() {
  const [domain, setDomain] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<EnrichedPQCReport | null>(null)

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!domain.trim()) return

    setIsScanning(true)
    setResult(null)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scan/quick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() })
      })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error("Scan failed", error)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      
      {/* Search Input Area */}
      <div className="bg-[#0f1219] p-6 rounded-2xl border border-white/5 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">Verification Engine</h2>
        <p className="text-white/50 text-sm mb-4">Execute a live TLS handshake to verify NIST PQC compliance.</p>
        <form onSubmit={handleScan} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input 
              type="text" 
              placeholder="crypto.cloudflare.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full bg-[#161b22] border border-white/10 text-white rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
              disabled={isScanning}
            />
          </div>
          <button 
            type="submit"
            disabled={isScanning || !domain}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
          >
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isScanning ? 'Verifying...' : 'Scan Target'}
          </button>
        </form>
      </div>

      {/* Results Dashboard (Matches Screenshot) */}
      {result && (
        <div className="bg-[#0f1219] rounded-2xl border border-white/5 p-8 shadow-2xl text-white">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold">Verification Results</h1>
                {result.is_pqc_enabled ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 border border-[#4ade80]/30 text-[#4ade80] bg-[#4ade80]/10 rounded-full text-xs font-bold tracking-wider">
                    <ShieldCheck className="w-4 h-4" /> PQC ENABLED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 border border-red-500/30 text-red-400 bg-red-500/10 rounded-full text-xs font-bold tracking-wider">
                    <TriangleAlert className="w-4 h-4" /> VULNERABLE
                  </span>
                )}
              </div>
              <p className="text-white/40 font-mono text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" /> https://{result.hostname}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button className="flex items-center gap-2 bg-[#1c212b] hover:bg-[#252b36] border border-white/10 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all">
                <Share2 className="w-4 h-4" /> SHARE RESULTS
              </button>
              <button onClick={() => handleScan()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all">
                <RefreshCw className="w-4 h-4" /> RE-SCAN TARGET
              </button>
            </div>
          </div>

          {/* Top 5 Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Detected<br/>Algorithm</span>
                <Cpu className="w-4 h-4 text-blue-400" />
              </div>
              <div className="font-bold text-lg font-mono truncate">{result.detected_algorithm}</div>
              <div className="text-white/40 text-xs mt-1">Active handshake mechanism.</div>
            </div>

            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">TLS Version</span>
                <Lock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="font-bold text-2xl">{result.tls_version}</div>
              <div className="text-white/40 text-xs mt-1">Current transport protocol.</div>
            </div>

            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Q-Day Risk</span>
                <TriangleAlert className="w-4 h-4 text-red-400" />
              </div>
              <div className="font-bold text-3xl text-red-400 relative z-10">{result.q_day_risk}%</div>
              <div className="text-white/40 text-xs mt-1 relative z-10">Shor's Algorithm vulnerability.</div>
            </div>

            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Security<br/>Score</span>
                <ShieldCheck className="w-4 h-4 text-green-400" />
              </div>
              <div className={`font-bold text-3xl ${result.security_score > 70 ? 'text-[#4ade80]' : 'text-yellow-400'}`}>
                {result.security_score}/100
              </div>
              <div className="text-white/40 text-xs mt-1">NIST standard alignment.</div>
            </div>

            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl opacity-70">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">QKD Status</span>
                <Zap className="w-4 h-4 text-white/40" />
              </div>
              <div className="font-bold text-lg">{result.qkd_status}</div>
              <div className="text-white/40 text-xs mt-1">Quantum Key Distribution</div>
            </div>
          </div>

          {/* Bottom Section: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Handshake Breakdown */}
            <div className="lg:col-span-2 bg-[#161b22] border border-white/5 rounded-xl p-6">
              <h3 className="text-white font-bold flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-blue-400" /> Handshake Breakdown
              </h3>
              
              <div className="bg-[#0a0d14] border border-white/5 p-4 rounded-lg font-mono text-sm text-blue-300 mb-8 leading-relaxed">
                {result.handshake_text}
              </div>

              {/* Progress Bars */}
              <div className="space-y-6 px-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-xs text-white/50 text-right">Threat Level</div>
                  <div className="flex-1 h-8 bg-[#0a0d14] rounded overflow-hidden relative">
                    {/* Vertical grid lines for aesthetic */}
                    <div className="absolute inset-0 flex justify-between px-1/4">
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                    </div>
                    {/* The Fill Bar */}
                    <div 
                      className="h-full bg-red-500 rounded relative z-10 transition-all duration-1000 ease-out"
                      style={{ width: `${result.threat_level}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-24 text-xs text-white/50 text-right">Readiness</div>
                  <div className="flex-1 h-8 bg-[#0a0d14] rounded overflow-hidden relative">
                    <div className="absolute inset-0 flex justify-between px-1/4">
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                    </div>
                    <div 
                      className="h-full bg-[#4ade80] rounded relative z-10 transition-all duration-1000 ease-out"
                      style={{ width: `${result.readiness}%` }}
                    />
                  </div>
                  {/* Axis labels */}
                  <div className="absolute bottom-4 left-[120px] right-6 flex justify-between text-[10px] text-white/30">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Roadmap & Weaknesses */}
            <div className="space-y-6">
              
              <div className="bg-[#161b22] border border-white/5 rounded-xl p-6">
                <h3 className="text-cyan-400 font-bold mb-4 text-sm">Hardening Roadmap</h3>
                <ul className="space-y-4">
                  {result.hardening_roadmap.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-white/80">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#161b22] border border-white/5 rounded-xl p-6">
                <h3 className="text-orange-400 font-bold mb-4 text-sm">Legacy Weaknesses</h3>
                <div className="flex flex-wrap gap-2">
                  {result.legacy_weaknesses.map((item, idx) => (
                    <span key={idx} className="bg-red-500/10 border border-red-500/20 text-red-200 px-3 py-1.5 rounded-md text-xs font-mono">
                      {item}
                    </span>
                  ))}
                  {result.legacy_weaknesses.length === 0 && (
                    <span className="text-white/40 text-xs italic">No critical legacy weaknesses detected.</span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}