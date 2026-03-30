'use client'

import { useState, useEffect } from 'react'
import { 
  Search, Loader2, ShieldCheck, Cpu, Lock, TriangleAlert, Zap, 
  Activity, Globe, Download, CheckCircle2, Radar, Target
} from 'lucide-react'
import { toast } from 'sonner' 
import { api } from '@/lib/api'

// Maps exactly to the EnrichedPQCReport from your Go backend
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

// Maps to the Subdomain models returned by your CheckScanStatus API
interface SubdomainReport {
  hostname: string
  detected_algorithm: string
  tls_version: string
  security_score: number
  is_pqc_enabled: boolean
}

type ScanPhase = 'idle' | 'root_scanning' | 'root_completed' | 'sub_scanning' | 'sub_completed'

export default function QuickScanWidget() {
  const [domainInput, setDomainInput] = useState('')
  const [activeDomainId, setActiveDomainId] = useState<number | null>(null)
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  
  const [mainReport, setMainReport] = useState<EnrichedPQCReport | null>(null)
  const [subdomains, setSubdomains] = useState<SubdomainReport[]>([])
  const [progress, setProgress] = useState({ scanned: 0, total: 0 })

  // 🟢 Phase 1: Scan Root Domain Instantly
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
      
      setMainReport(data.main_report)
      setActiveDomainId(data.domain_id)
      setScanPhase('root_completed')
      
      toast.success(`Root Analysis Complete`, {
        description: `Domain ${domainInput} has been verified.`,
        icon: <ShieldCheck className="text-green-500" />
      })
      
    } catch (error) {
      toast.error("Failed to initiate scan. Is the backend running?")
      setScanPhase('idle')
    }
  }

  // 🟢 Phase 2: User Authorizes Deep Subdomain OSINT Scan
  const handleLaunchSubdomainScan = async () => {
    if (!activeDomainId) return

    setScanPhase('sub_scanning')
    toast.info("OSINT Pipeline Launched", {
      description: "Discovering and analyzing infrastructure...",
      icon: <Radar className="text-purple-400" />
    })

    try {
      await api.startSubdomainScan(activeDomainId)
      // The useEffect polling will take over from here to watch the background worker
    } catch (error) {
      toast.error("Failed to launch subdomain scanner.")
      setScanPhase('root_completed')
    }
  }

  // 🟢 Phase 3: Poll for Background Progress
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (activeDomainId && scanPhase === 'sub_scanning') {
      interval = setInterval(async () => {
        try {
          const data = await api.getScanStatus(activeDomainId)

          // Track live numerical progress
          const scanned = data.scanned_assets || data.ScannedAssets || 0
          const total = data.total_assets || data.TotalAssets || 0
          setProgress({ scanned, total })

          // Map the incoming database structures safely (handling casing differences)
          const formattedSubs = (data.subdomains || [])
            .filter((sub: any) => sub.ssl_cert || sub.SSLCert)
            .map((sub: any) => {
              const cert = sub.ssl_cert || sub.SSLCert
              return {
                hostname: sub.hostname || sub.Hostname,
                detected_algorithm: cert.key_length || cert.KeyLength || "Unknown",
                tls_version: cert.tls_version || cert.TLSVersion || "Unknown",
                security_score: cert.q_score || cert.QScore || 0,
                is_pqc_enabled: (cert.q_score || cert.QScore || 0) >= 80,
              }
            })

          setSubdomains(formattedSubs)

          // Finish the scan
          if (data.status === 'completed' || data.status === 'halted') {
            setScanPhase('sub_completed')
            toast.success('OSINT Pipeline Complete!', {
              description: `Successfully discovered and analyzed ${formattedSubs.length} live endpoints.`,
              icon: <CheckCircle2 className="text-green-500" />
            })
          }
        } catch (error) {
          console.error("Polling error", error)
        }
      }, 2000) // 2-second polling for smooth progress bars
    }

    return () => clearInterval(interval)
  }, [activeDomainId, scanPhase])

  const downloadCBOM = () => {
    if (!mainReport) return;
    const cbomData = {
      bomFormat: "CycloneDX-Crypto",
      specVersion: "1.5",
      serialNumber: `urn:uuid:${crypto.randomUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [{ vendor: "PNB Quantum Shield", name: "Enterprise OSINT Engine", version: "2.0.0" }],
        targetDomain: domainInput
      },
      components: [
        {
          type: "cryptographic-asset",
          name: mainReport.hostname,
          cryptoProperties: {
            protocol: mainReport.tls_version,
            keyExchange: mainReport.detected_algorithm,
            quantumSafe: mainReport.is_pqc_enabled,
            securityScore: mainReport.security_score,
            vulnerabilities: mainReport.legacy_weaknesses
          }
        },
        ...subdomains.map(sub => ({
          type: "cryptographic-asset",
          name: sub.hostname,
          cryptoProperties: {
            protocol: sub.tls_version,
            keyExchange: sub.detected_algorithm,
            quantumSafe: sub.is_pqc_enabled,
            securityScore: sub.security_score,
          }
        }))
      ]
    }
    const blob = new Blob([JSON.stringify(cbomData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CBOM_${domainInput}_${new Date().getTime()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.scanned / progress.total) * 100) : 0
  const isScanning = scanPhase === 'root_scanning' || scanPhase === 'sub_scanning'

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      {/* Search Input Area */}
      <div className="bg-[#0f1219] p-6 rounded-2xl border border-white/5 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">Enterprise Verification Engine</h2>
        <p className="text-white/50 text-sm mb-4">Execute live NIST FIPS 203 handshakes across the root domain and dynamically discovered subdomains.</p>
        <form onSubmit={handleStartRootScan} className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input 
              type="text" 
              placeholder="e.g., targetdomain.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="w-full bg-[#161b22] border border-white/10 text-white rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
              disabled={isScanning}
            />
          </div>
          <button 
            type="submit"
            disabled={isScanning || !domainInput}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 min-w-[180px] justify-center"
          >
            {scanPhase === 'root_scanning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanPhase === 'root_scanning' ? 'Analyzing Root...' : 'Scan Target'}
          </button>
        </form>
      </div>

      {/* Main Results Dashboard */}
      {mainReport && (
        <div className="bg-[#0f1219] rounded-2xl border border-white/5 p-8 shadow-2xl text-white animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold">Root Domain Results</h1>
                {mainReport.is_pqc_enabled ? (
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
                <Globe className="w-4 h-4" /> https://{mainReport.hostname}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={downloadCBOM}
                disabled={isScanning}
                className="flex items-center gap-2 bg-[#1c212b] hover:bg-[#252b36] border border-white/10 px-4 py-2.5 rounded-lg text-sm font-semibold text-yellow-500 transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> EXPORT CBOM
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl">
              <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Cpu className="w-3 h-3 text-blue-400" /> Detected Algorithm
              </span>
              <div className={`font-bold text-lg font-mono truncate ${mainReport.detected_algorithm === 'OFFLINE' ? 'text-red-500' : 'text-white'}`}>
                {mainReport.detected_algorithm}
              </div>
            </div>

            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl">
              <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Lock className="w-3 h-3 text-cyan-400" /> Protocol
              </span>
              <div className="font-bold text-2xl">{mainReport.tls_version}</div>
            </div>

            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl">
              <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <TriangleAlert className="w-3 h-3 text-red-400" /> Q-Day Risk
              </span>
              <div className="font-bold text-3xl text-red-400">{mainReport.q_day_risk}%</div>
            </div>

            <div className="bg-[#161b22] border border-white/5 p-5 rounded-xl">
              <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-green-400" /> Security Score
              </span>
              <div className={`font-bold text-3xl ${mainReport.security_score > 70 ? 'text-[#4ade80]' : 'text-yellow-400'}`}>
                {mainReport.security_score}/100
              </div>
            </div>
          </div>

          {/* Details Section: Handshake & Roadmaps */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-[#161b22] border border-white/5 rounded-xl p-6">
              <h3 className="text-white font-bold flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-blue-400" /> Handshake Breakdown
              </h3>
              
              <div className="bg-[#0a0d14] border border-white/5 p-4 rounded-lg font-mono text-sm text-blue-300 mb-8 leading-relaxed">
                {mainReport.handshake_text}
              </div>

              <div className="space-y-6 px-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-xs text-white/50 text-right">Threat Level</div>
                  <div className="flex-1 h-8 bg-[#0a0d14] rounded overflow-hidden relative">
                    <div className="absolute inset-0 flex justify-between px-1/4">
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                      <div className="w-px h-full bg-white/5 border-l border-dashed border-white/10"></div>
                    </div>
                    <div 
                      className="h-full bg-red-500 rounded relative z-10 transition-all duration-1000 ease-out"
                      style={{ width: `${mainReport.threat_level}%` }}
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
                      style={{ width: `${mainReport.readiness}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#161b22] border border-white/5 rounded-xl p-6 h-full">
                <h3 className="text-cyan-400 font-bold mb-4 text-sm">Hardening Roadmap</h3>
                <ul className="space-y-4 mb-6">
                  {mainReport.hardening_roadmap.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-white/80">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {mainReport.hardening_roadmap.length === 0 && (
                    <li className="text-white/40 text-xs italic">No actions required.</li>
                  )}
                </ul>

                <h3 className="text-orange-400 font-bold mb-4 text-sm">Legacy Weaknesses</h3>
                <div className="flex flex-wrap gap-2">
                  {mainReport.legacy_weaknesses.map((item, idx) => (
                    <span key={idx} className="bg-red-500/10 border border-red-500/20 text-red-200 px-3 py-1.5 rounded-md text-xs font-mono">
                      {item}
                    </span>
                  ))}
                  {mainReport.legacy_weaknesses.length === 0 && (
                    <span className="text-white/40 text-xs italic">No critical legacy weaknesses detected.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 🟢 OSINT Trigger CTA Card 🟢 */}
          {scanPhase === 'root_completed' && (
            <div className="bg-gradient-to-r from-[#1c212b] to-[#161b22] border border-purple-500/20 rounded-xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in zoom-in-95 duration-300">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg shrink-0">
                  <Radar className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Discover Deep Infrastructure</h3>
                  <p className="text-white/60 text-sm">
                    Root domain analysis complete. Deploy OSINT engines to discover and scan all associated subdomains for Post-Quantum readiness.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLaunchSubdomainScan}
                className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              >
                <Target className="w-4 h-4" /> Launch Subdomain Scan
              </button>
            </div>
          )}

          {/* 🟢 Subdomain Report Table (Shows ONLY during/after sub scan) 🟢 */}
          {(scanPhase === 'sub_scanning' || scanPhase === 'sub_completed') && (
            <div className="bg-[#161b22] border border-white/5 rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              
              <div className="p-5 border-b border-white/5 bg-[#1c212b]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Radar className="w-5 h-5 text-purple-400" /> Infrastructure Threat Map
                  </h3>
                  
                  <div className="text-xs font-mono">
                    {scanPhase === 'sub_scanning' ? (
                      progress.total === 0 ? (
                         <span className="flex items-center gap-2 text-yellow-500">
                           <Loader2 className="w-3 h-3 animate-spin" /> Gathering OSINT Data...
                         </span>
                      ) : (
                         <span className="flex items-center gap-2 text-blue-400">
                           <Loader2 className="w-3 h-3 animate-spin" /> Scanning {progress.scanned} / {progress.total} Assets ({progressPercent}%)
                         </span>
                      )
                    ) : (
                      <span className="text-[#4ade80] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Complete ({subdomains.length} verified assets)
                      </span>
                    )}
                  </div>
                </div>

                {scanPhase === 'sub_scanning' && progress.total > 0 && (
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-500 ease-out" 
                      style={{ width: `${progressPercent}%` }} 
                    />
                  </div>
                )}
              </div>
              
              <div className="overflow-x-auto min-h-[150px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0a0d14] text-white/40 text-xs uppercase font-mono">
                    <tr>
                      <th className="px-6 py-4">Hostname</th>
                      <th className="px-6 py-4">Key Exchange</th>
                      <th className="px-6 py-4">Protocol</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 relative">
                    {subdomains.length === 0 && scanPhase === 'sub_scanning' && (
                       <tr>
                         <td colSpan={4} className="p-8 text-center text-white/40 text-sm font-mono">
                           Waiting for first response...
                         </td>
                       </tr>
                    )}
                    {subdomains.map((sub, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors animate-in fade-in duration-500">
                        <td className="px-6 py-4 font-bold text-white/90">{sub.hostname}</td>
                        <td className="px-6 py-4 font-mono text-[11px] text-white/60">{sub.detected_algorithm}</td>
                        <td className="px-6 py-4 font-mono text-xs">{sub.tls_version}</td>
                        <td className="px-6 py-4">
                          {sub.is_pqc_enabled ? (
                            <span className="text-[#4ade80] bg-[#4ade80]/10 border border-[#4ade80]/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">Quantum Safe</span>
                          ) : (
                            <span className="text-[#f87171] bg-[#f87171]/10 border border-[#f87171]/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">HNDL Risk</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}