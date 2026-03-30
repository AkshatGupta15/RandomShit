'use client'

import { useState, useEffect } from 'react'
import { 
  Search, Loader2, ShieldCheck, Cpu, Lock, TriangleAlert, Zap, FileText,
  Activity, Globe, Download, CheckCircle2, Radar, Target, BookOpen, HelpCircle, Info, ChevronRight, Server
} from 'lucide-react'
import { toast } from 'sonner' 
import { api } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// --- Interfaces ---
interface EnrichedPQCReport {
  hostname: string
  is_pqc_enabled: boolean
  detected_algorithm: string
  tls_version: string
  q_day_risk: number
  security_score: number
  score_breakdown: string[]
  layman_summary?: string
  qkd_status: string
  handshake_text: string
  threat_level: number
  readiness: number
  hardening_roadmap: string[]
  legacy_weaknesses: string[]
}

interface SubdomainReport {
  hostname: string
  detected_algorithm: string
  tls_version: string
  issuer: string
  security_score: number
  is_pqc_enabled: boolean
}

type ScanPhase = 'idle' | 'root_scanning' | 'root_completed' | 'sub_scanning' | 'sub_completed'

// --- Reusable Tooltip Component ---
const InfoTooltip = ({ content, children, className = '' }: { content: React.ReactNode, children: React.ReactNode, className?: string }) => (
  <div className={`group relative inline-flex items-center cursor-help ${className}`}>
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 sm:w-64 bg-zinc-800 text-zinc-300 text-xs p-3 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl border border-zinc-700 pointer-events-none normal-case font-sans font-normal tracking-normal text-left">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
    </div>
  </div>
)

export default function QuickScanWidget() {
  const [domainInput, setDomainInput] = useState('')
  const [activeDomainId, setActiveDomainId] = useState<number | null>(null)
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  
  const [mainReport, setMainReport] = useState<EnrichedPQCReport | null>(null)
  const [subdomains, setSubdomains] = useState<SubdomainReport[]>([])
  const [progress, setProgress] = useState({ scanned: 0, total: 0 })
  const [selectedSubdomain, setSelectedSubdomain] = useState<SubdomainReport | null>(null)

  const parseDomainId = (payload: any): number | null => {
    const direct = payload?.domain_id ?? payload?.domainId ?? payload?.domain?.id
    const parsed = Number(direct)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const handleStartRootScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!domainInput.trim()) return

    setScanPhase('root_scanning')
    setMainReport(null)
    setSubdomains([])
    setActiveDomainId(null)
    setProgress({ scanned: 0, total: 0 })

    try {
      const data = await api.startRootScan(domainInput.trim())
      const normalizedDomain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')

      let resolvedDomainId = parseDomainId(data)
      if (!resolvedDomainId) {
        const domains = await api.getDomains()
        const match = domains.find((d: any) => {
          const value = String(d?.domain_name || d?.domain || '').toLowerCase().replace(/^www\./, '')
          return value === normalizedDomain
        })
        if (match) {
          const parsed = Number(match.id)
          if (Number.isFinite(parsed) && parsed > 0) resolvedDomainId = parsed
        }
      }
      
      setMainReport(data.main_report)
      setActiveDomainId(resolvedDomainId)
      setScanPhase('root_completed')

      if (!resolvedDomainId) {
        toast.error('Root scan succeeded but domain registration failed.')
      }
      
      toast.success(`Primary Audit Complete`, {
        icon: <ShieldCheck className="text-emerald-500" />
      })
      
    } catch (error) {
      console.error(error)
      toast.error("Failed to initiate secure connection. Verify target status.")
      setScanPhase('idle')
    }
  }

  const handleLaunchSubdomainScan = async () => {
    if (!activeDomainId) {
      toast.error('Cannot authorize deep scan: missing domain tracking ID.')
      return
    }

    setScanPhase('sub_scanning')
    toast.info("Comprehensive Audit Initiated")

    try {
      await api.startSubdomainScan(activeDomainId)
    } catch (error) {
      toast.error("Failed to launch infrastructure scanner.")
      setScanPhase('root_completed')
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (activeDomainId && scanPhase === 'sub_scanning') {
      interval = setInterval(async () => {
        try {
          const data = await api.getScanStatus(activeDomainId)

          const scanned = data.scanned_assets || data.ScannedAssets || 0
          const total = data.total_assets || data.TotalAssets || 0
          setProgress({ scanned, total })

          const formattedSubs = (data.subdomains || [])
            .filter((sub: any) => sub.ssl_cert || sub.SSLCert)
            .map((sub: any) => {
              const cert = sub.ssl_cert || sub.SSLCert
              return {
                hostname: sub.hostname || sub.Hostname,
                detected_algorithm: cert.key_length || cert.KeyLength || "Unknown",
                tls_version: cert.tls_version || cert.TLSVersion || "Unknown",
                issuer: cert.issuer || cert.Issuer || 'Unknown',
                security_score: cert.q_score || cert.QScore || 0,
                is_pqc_enabled: (cert.q_score || cert.QScore || 0) >= 80,
              }
            })

          const uniqueByHostname = new Map<string, SubdomainReport>()
          for (const item of formattedSubs) {
            if (item.hostname && !uniqueByHostname.has(item.hostname)) uniqueByHostname.set(item.hostname, item)
          }

          setSubdomains(Array.from(uniqueByHostname.values()))

          if (data.status === 'completed' || data.status === 'halted') {
            setScanPhase('sub_completed')
            toast.success('Infrastructure Audit Complete!')
          }
        } catch (error) {
          console.error("Polling error", error)
        }
      }, 2000)
    }

    return () => clearInterval(interval)
  }, [activeDomainId, scanPhase])

  const handleDownloadCBOM = async () => {
    if (!activeDomainId) {
      toast.error('Run a scan first to generate CBOM.')
      return
    }

    try {
      const cbom = await api.downloadCBOM(activeDomainId)
      const blob = new Blob([JSON.stringify(cbom, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `CBOM_${mainReport?.hostname || activeDomainId}_${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('CBOM downloaded')
    } catch (error) {
      console.error('CBOM download failed', error)
      toast.error('Failed to download CBOM report.')
    }
  }

  const handleDownloadReport = async () => {
    if (!activeDomainId) {
      toast.error('Run a scan first to export report.')
      return
    }

    try {
      const report = await api.downloadPDFReport(activeDomainId)
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Scan_Report_${mainReport?.hostname || activeDomainId}_${Date.now()}.txt`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Scan report downloaded')
    } catch (error) {
      console.error('Report download failed', error)
      toast.error('Failed to download scan report.')
    }
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.scanned / progress.total) * 100) : 0
  const isScanning = scanPhase === 'root_scanning' || scanPhase === 'sub_scanning'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-[#A31127]/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOP CONTROL BAR */}
        <header className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col lg:flex-row gap-6 justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F5A623]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#A31127]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 text-center lg:text-left">
            <h1 className="text-2xl font-bold flex items-center justify-center lg:justify-start gap-2.5 tracking-tight">
              <ShieldCheck className="text-[#F5A623] w-7 h-7" />
              PNB Quantum Readiness Engine
            </h1>
            <p className="text-zinc-400 text-sm mt-1 max-w-lg">
              Verify if a financial domain is protected against future quantum computing threats using NIST FIPS 203 standards.
            </p>
          </div>

          <form onSubmit={handleStartRootScan} className="w-full lg:w-auto flex-1 max-w-2xl flex flex-col sm:flex-row gap-3 relative z-10">
            <div className="relative flex-1 group">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-[#F5A623] transition-colors" />
              <input 
                type="text" 
                placeholder="Enter domain (e.g., pnbindia.in)"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                title="Input the fully qualified domain name. The engine will perform a live TLS handshake to extract cryptographic telemetry."
                className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-[#F5A623]/50 text-zinc-100 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-4 focus:ring-[#F5A623]/10 transition-all font-mono text-sm"
                disabled={isScanning}
              />
            </div>
            <button 
              type="submit"
              disabled={isScanning || !domainInput}
              title="Initiate a live mathematical exchange requesting ML-KEM keys."
              className="bg-[#A31127] hover:bg-[#8b0e21] text-white px-8 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(163,17,39,0.3)]"
            >
              {scanPhase === 'root_scanning' ? <Loader2 className="w-4 h-4 animate-spin text-zinc-300" /> : <Search className="w-4 h-4" />}
              {scanPhase === 'root_scanning' ? 'Analyzing...' : 'Audit Target'}
            </button>
          </form>
        </header>

        {/* ACTIVE DASHBOARD */}
        {mainReport && (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* STATUS HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold">{mainReport.hostname}</h2>
                  {mainReport.is_pqc_enabled ? (
                    <InfoTooltip content={<span className="text-emerald-400"><strong>PQC Verified:</strong> The server successfully accepted a Post-Quantum Kyber/ML-KEM key exchange, mathematically securing data against quantum decryption.</span>}>
                      <span className="flex items-center gap-1.5 px-3 py-1 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider cursor-help">
                        <ShieldCheck className="w-3.5 h-3.5" /> PQC Verified
                      </span>
                    </InfoTooltip>
                  ) : (
                    <InfoTooltip content={<span className="text-red-400"><strong>At Risk:</strong> The server relies on classical RSA/ECC cryptography. It is vulnerable to interception and future quantum decryption.</span>}>
                      <span className="flex items-center gap-1.5 px-3 py-1 border border-[#A31127]/30 bg-[#A31127]/10 text-red-400 rounded-full text-xs font-bold uppercase tracking-wider cursor-help">
                        <TriangleAlert className="w-3.5 h-3.5" /> At Risk
                      </span>
                    </InfoTooltip>
                  )}
                </div>
                <p className="text-zinc-500 text-sm">Primary Domain Cryptographic Analysis Complete</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={handleDownloadCBOM}
                  disabled={!activeDomainId}
                  title="Download Cryptographic Bill of Materials (JSON format)"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4 text-zinc-400" /> CBOM
                </button>
                <button
                  onClick={handleDownloadReport}
                  disabled={!activeDomainId}
                  title="Download human-readable executive report"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4 text-zinc-400" /> Report
                </button>
              </div>
            </div>

            {/* BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: Summary & Roadmap */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Exec Summary */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex-1">
                  <InfoTooltip content="An AI-generated synthesis combining the FIPS 203 scoring model with the raw OpenSSL telemetry from the live handshake." className="mb-4 block">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <Info className="w-4 h-4" /> Executive Summary
                    </h3>
                  </InfoTooltip>
                  <div className={`p-4 rounded-xl border ${mainReport.is_pqc_enabled ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-100' : 'bg-[#A31127]/10 border-[#A31127]/20 text-red-100'}`}>
                    <p className="text-sm leading-relaxed">
                      {mainReport.layman_summary || (mainReport.is_pqc_enabled 
                        ? "This domain successfully negotiated a Post-Quantum connection. It is currently protected against Future Quantum Decryption attacks and aligns with upcoming compliance mandates."
                        : "This domain relies on classical cryptography (RSA/ECC). While secure against today's computers, it is vulnerable to 'Harvest Now, Decrypt Later' operations and fails modern PQC readiness checks.")}
                    </p>
                  </div>
                </div>

                {/* Roadmap */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex-1">
                  <InfoTooltip content="Actionable steps mapped directly to NIST Special Publication 800-208 and FIPS 204/205 digital signature requirements." className="mb-4 block">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-500" /> Actionable Roadmap
                    </h3>
                  </InfoTooltip>
                  <ul className="space-y-3">
                    {mainReport.hardening_roadmap.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50 hover:bg-zinc-900 transition-colors cursor-default" title={item}>
                        <ChevronRight className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {mainReport.hardening_roadmap.length === 0 && <li className="text-zinc-500 text-sm italic p-2">No immediate actions required.</li>}
                  </ul>

                  <InfoTooltip content="Older protocols (like TLS 1.2 or SHA-1) that create bottlenecks. These must be upgraded before hybrid PQC can be enabled." className="mt-6 mb-4 block">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#F5A623]" /> Legacy Constraints
                    </h3>
                  </InfoTooltip>
                  <div className="flex flex-wrap gap-2">
                    {mainReport.legacy_weaknesses.map((item, idx) => (
                      <span key={idx} title={`Constraint: ${item}`} className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-medium cursor-help">
                        {item}
                      </span>
                    ))}
                    {mainReport.legacy_weaknesses.length === 0 && <span className="text-zinc-500 text-sm italic p-2">No constraints detected.</span>}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Metrics & Telemetry */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* 4 Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoTooltip content={<div><strong className="text-white block mb-1">Mathematical Formula:</strong> ML-KEM is the new Post-Quantum standard. X25519 or RSA are classical and easily broken by Shor's algorithm.</div>} className="w-full">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden w-full text-left">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[#F5A623]/10 rounded-bl-full -mr-4 -mt-4" />
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                        Key Exchange <Cpu className="w-3.5 h-3.5 text-[#F5A623]" />
                      </p>
                      <p className={`text-xl font-bold font-mono truncate ${mainReport.detected_algorithm === 'OFFLINE' ? 'text-[#A31127]' : 'text-zinc-100'}`}>
                        {mainReport.detected_algorithm}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-2">NIST standard ML-KEM preferred</p>
                    </div>
                  </InfoTooltip>

                  <InfoTooltip content={<div><strong className="text-white block mb-1">Transport Layer:</strong> TLS 1.3 is mandated. Anything lower (TLS 1.2) significantly slows down the large key sizes required for quantum handshakes.</div>} className="w-full">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden w-full text-left">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-bl-full -mr-4 -mt-4" />
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                        Protocol <Lock className="w-3.5 h-3.5 text-cyan-500" />
                      </p>
                      <p className="text-2xl font-bold text-zinc-100">{mainReport.tls_version}</p>
                      <p className="text-[10px] text-zinc-500 mt-2">Transport layer security version</p>
                    </div>
                  </InfoTooltip>

                  <InfoTooltip content={<div><strong className="text-red-400 block mb-1">Data Exposure Risk:</strong> Measures probability of current data harvesting. 10-15% means PQC protected. 60%+ means hackers can store and later decrypt this data.</div>} className="w-full">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden w-full text-left">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[#A31127]/10 rounded-bl-full -mr-4 -mt-4" />
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                        Data Risk <TriangleAlert className="w-3.5 h-3.5 text-red-400" />
                      </p>
                      <p className="text-3xl font-bold text-red-400">{mainReport.q_day_risk}%</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Harvest Now Decrypt Later risk</p>
                    </div>
                  </InfoTooltip>

                  <InfoTooltip content={<div><strong className="text-emerald-400 block mb-1">Score Calculation:</strong> Starts at 100. Deductions for classical key exchange (-30), legacy RSA certificates (-5), or outdated TLS 1.2 (-10). 95+ is compliant.</div>} className="w-full">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden w-full text-left">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4" />
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                        NIST Score <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </p>
                      <p className={`text-3xl font-bold ${mainReport.security_score > 70 ? 'text-emerald-400' : 'text-[#F5A623]'}`}>
                        {mainReport.security_score}/100
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">FIPS 203 Compliance rating</p>
                    </div>
                  </InfoTooltip>
                </div>

                {/* Telemetry Panel */}

                <div className="flex flex-col md:flex-row gap-6 flex-1">

                {mainReport.score_breakdown && mainReport.score_breakdown.length > 0 && (
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex-1 flex flex-col">
    <InfoTooltip content="Deterministic mathematical ledger showing exact penalty deductions from the baseline FIPS 203 perfect score." className="mb-5 block">
      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <Cpu className="w-4 h-4 text-indigo-400" /> Score Proof
      </h3>
    </InfoTooltip>
    
    <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs border border-zinc-800/50 shadow-inner flex-1 flex flex-col overflow-hidden">
      <div className="space-y-3 flex-1 overflow-y-auto">
        {mainReport.score_breakdown.map((log, i) => {
          const isPenalty = log.includes('[-');
          const isBase = log.includes('Base') || log.includes('[+0]');
          return (
            <div key={i} className={`flex items-start gap-3 leading-relaxed ${isBase ? 'text-zinc-300 font-bold border-b border-zinc-800/50 pb-3 mb-3' : isPenalty ? 'text-rose-400' : 'text-emerald-400'}`}>
              <span className="shrink-0 text-zinc-500">{isBase ? '>' : isPenalty ? '-' : '+'}</span>
              <span>{log}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-4 border-t border-zinc-800/50 pt-4 text-zinc-200 font-bold text-sm">
        <span className="shrink-0 text-emerald-500">$</span>
        <span>FIPS 203 Score = {mainReport.security_score}</span>
      </div>
    </div>
  </div>
)}

<div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex-1 flex flex-col">
  <InfoTooltip content="Raw socket data extracted directly from the BoringSSL/OpenSSL negotiation phase during testing." className="mb-5 block">
    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
      <Activity className="w-4 h-4 text-purple-400" /> Live Telemetry
    </h3>
  </InfoTooltip>
  
  <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-400 mb-6 border border-zinc-800/50 shadow-inner overflow-x-auto" title="Raw Handshake Output">
    <span className="text-emerald-500 mr-2">$</span>
    {mainReport.handshake_text}
  </div>

  <div className="space-y-5 mt-auto">
    <div>
      <div className="flex justify-between text-xs font-medium text-zinc-400 mb-2">
        <InfoTooltip content="Percentage of infrastructure components heavily reliant on legacy elliptic curve cryptography (ECC).">
          <span className="border-b border-dashed border-zinc-600 pb-0.5">Vulnerability Footprint</span>
        </InfoTooltip>
        <span>{mainReport.threat_level}%</span>
      </div>
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden" title={`${mainReport.threat_level}% Vulnerability`}>
        <div 
          className="h-full bg-gradient-to-r from-[#F5A623] to-[#A31127] transition-all duration-1000 ease-out"
          style={{ width: `${mainReport.threat_level}%` }}
        />
      </div>
    </div>

    <div>
      <div className="flex justify-between text-xs font-medium text-zinc-400 mb-2">
        <InfoTooltip content="Percentage of load balancers and front-end gateways successfully upgraded to support hybrid Key Encapsulation Mechanisms (KEMs).">
          <span className="border-b border-dashed border-zinc-600 pb-0.5">PQC Architecture Readiness</span>
        </InfoTooltip>
        <span>{mainReport.readiness}%</span>
      </div>
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden" title={`${mainReport.readiness}% Ready`}>
        <div 
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out"
          style={{ width: `${mainReport.readiness}%` }}
        />
      </div>
    </div>
  </div>
</div>
                </div>
              </div>
            </div>

            {/* PHASE 2 OSINT BANNER */}
            {scanPhase === 'root_completed' && (
              <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border border-[#F5A623]/20 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#F5A623]/5 to-transparent pointer-events-none" />
                <div className="flex items-start gap-5 relative z-10">
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 shadow-inner">
                    <Radar className="w-8 h-8 text-[#F5A623]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100 mb-2">Phase 2: Deep Infrastructure Audit</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-3xl">
                      Enterprise risk extends beyond the root domain. Authorize the OSINT engine to automatically discover, map, and cryptographically verify all associated subdomains, API gateways, and mail servers against PQC standards.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleLaunchSubdomainScan}
                  disabled={!activeDomainId}
                  title="Query Certificate Transparency (CT) logs to find shadow IT."
                  className="shrink-0 bg-white hover:bg-zinc-200 text-zinc-950 disabled:opacity-50 px-8 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg relative z-10"
                >
                  <Server className="w-4 h-4" /> Authorize Scan
                </button>
              </div>
            )}

            {/* PHASE 3 ASSET TABLE */}
            {(scanPhase === 'sub_scanning' || scanPhase === 'sub_completed') && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
                
                <div className="p-6 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950/30">
                  <InfoTooltip content="A comprehensive ledger of all discovered subdomains and their individual cryptographic configurations.">
                    <h3 className="text-zinc-100 font-bold flex items-center gap-2">
                      <Radar className="w-5 h-5 text-[#F5A623]" /> Asset Discovery Matrix
                    </h3>
                  </InfoTooltip>
                  
                  <div className="text-xs font-mono font-medium bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                    {scanPhase === 'sub_scanning' ? (
                      progress.total === 0 ? (
                         <span className="flex items-center gap-2 text-zinc-400">
                           <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F5A623]" /> Querying CT Logs...
                         </span>
                      ) : (
                         <span className="flex items-center gap-2 text-[#F5A623]">
                           <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying {progress.scanned}/{progress.total} Assets ({progressPercent}%)
                         </span>
                      )
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1.5" title="All discovered assets have been successfully polled via HTTPS requests.">
                        <CheckCircle2 className="w-4 h-4" /> Audit Complete: {subdomains.length} mapped
                      </span>
                    )}
                  </div>
                </div>

                {scanPhase === 'sub_scanning' && progress.total > 0 && (
                  <div className="w-full bg-zinc-950 h-1">
                    <div 
                      className="bg-[#F5A623] h-full transition-all duration-500 ease-out" 
                      style={{ width: `${progressPercent}%` }} 
                    />
                  </div>
                )}
                
                <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-zinc-950/80 backdrop-blur text-zinc-400 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4">
                          <InfoTooltip content="The resolved CNAME or A-Record discovered via OSINT.">Endpoint</InfoTooltip>
                        </th>
                        <th className="px-6 py-4">
                          <InfoTooltip content="The mathematical curve or lattice used to agree on session keys.">Algorithm</InfoTooltip>
                        </th>
                        <th className="px-6 py-4">
                          <InfoTooltip content="The secure communication protocol version running on the port.">Transport</InfoTooltip>
                        </th>
                        <th className="px-6 py-4 text-right">
                          <InfoTooltip content="Determines if this specific node meets FIPS 203 guidelines.">Status</InfoTooltip>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {subdomains.length === 0 && scanPhase === 'sub_scanning' && (
                         <tr>
                           <td colSpan={4} className="p-16 text-center text-zinc-500 text-sm font-mono flex flex-col items-center justify-center gap-3 w-full">
                             <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
                             Awaiting telemetry...
                           </td>
                         </tr>
                      )}
                      {subdomains.map((sub, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => setSelectedSubdomain(sub)}
                          className="hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                        >
                          <td 
                            className="px-6 py-4 font-medium text-zinc-200 group-hover:text-white transition-colors"
                            title={`Discovered Host: ${sub.hostname}\nClick for full details.`}
                          >
                            {sub.hostname}
                          </td>
                          <td 
                            className="px-6 py-4 font-mono text-xs text-zinc-400"
                            title={`Key Exchange Algorithm: ${sub.detected_algorithm}.\n${sub.detected_algorithm.includes('ML-KEM') ? 'Secure against quantum computing.' : 'Vulnerable to Shor\'s algorithm.'}`}
                          >
                            {sub.detected_algorithm}
                          </td>
                          <td className="px-6 py-4">
                            <span 
                              className="bg-zinc-800 px-2.5 py-1 rounded text-xs text-zinc-300 font-mono"
                              title={`Protocol Version: ${sub.tls_version}.\n${sub.tls_version === 'TLSv1.3' ? 'Optimal for PQC.' : 'Warning: Legacy protocol detected.'}`}
                            >
                              {sub.tls_version}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {sub.is_pqc_enabled ? (
                              <span 
                                title="FIPS 203 Compliant: Data exchanged here is protected against future quantum decryption." 
                                className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                              >
                                PQC Safe
                              </span>
                            ) : (
                              <span 
                                title="Vulnerable: Data exchanged here is at risk of 'Harvest Now, Decrypt Later' attacks." 
                                className="text-red-400 bg-[#A31127]/10 border border-[#A31127]/30 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                              >
                                At Risk
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODAL / DIALOG */}
            <Dialog open={!!selectedSubdomain} onOpenChange={(open) => !open && setSelectedSubdomain(null)}>
              <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-lg p-6 sm:p-8 rounded-2xl shadow-2xl">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-xl">Asset Details</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Deep scan metadata for selected node.
                  </DialogDescription>
                </DialogHeader>

                {selectedSubdomain && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Hostname</p>
                      <p className="font-mono text-zinc-200 break-all">{selectedSubdomain.hostname}</p>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4" title="Transport Layer Security (TLS) Version. TLS 1.3 is required for modern PQC integration.">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 cursor-help border-b border-dashed border-zinc-600 inline-block">Transport</p>
                      <p className="text-zinc-200 font-mono text-xs mt-1">{selectedSubdomain.tls_version}</p>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4" title="The Certificate Authority (CA) that signed the X.509 certificate for this node.">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 cursor-help border-b border-dashed border-zinc-600 inline-block">Authority</p>
                      <p className="text-zinc-200 truncate mt-1">{selectedSubdomain.issuer}</p>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 sm:col-span-2 flex justify-between items-center">
                      <div title="The specific mathematical operation generating the session key.">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 cursor-help border-b border-dashed border-zinc-600 inline-block">Key Exchange</p>
                        <p className="font-mono text-zinc-200 mt-1">{selectedSubdomain.detected_algorithm}</p>
                      </div>
                      <div className="text-right" title="Determines if this node meets FIPS 203 digital signature and key encapsulation mandates.">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1 cursor-help border-b border-dashed border-zinc-600 inline-block">Status</p>
                        <p className={`mt-1 ${selectedSubdomain.is_pqc_enabled ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}`}>
                          {selectedSubdomain.is_pqc_enabled ? 'Verified Safe' : 'Vulnerable'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

          </div>
        )}
      </div>
    </div>
  )
}