'use client'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Download, FileText, Loader2, Activity, Globe, Building2, Shield, ArrowLeft } from 'lucide-react'
import { DataTable, Column } from '@/components/tables/data-table'
import Link from 'next/link'

interface Certificate {
  q_score: number
  key_length: string
  pqc_tier: string
  tls_version: string
  cipher_suite: string
  risk_label?: string 
  issuer: string
  valid_from: string
  valid_to: string
}

interface Subdomain {
  id: number
  hostname: string
  ip_address: string
  is_alive: boolean
  ssl_cert?: Certificate
}

interface Domain {
  id: number
  domain_name: string
  status: string
  total_assets: number
  scanned_assets: number
  company_name?: string
  registrar?: string
  registration_date?: string
  Subdomains: Subdomain[] 
  //  NEW FIELDS COMING DIRECTLY FROM GO BACKEND 
  pqc_score: number
  risk_level: string
  risk_subtitle: string
  risk_color: 'green' | 'yellow' | 'red' | 'muted'
  total_clean: number
}

export default function DomainSubdomainsPage() {
  const params = useParams()
  const domainId = parseInt(params.id as string, 10)

  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [isCbomLoading, setIsCbomLoading] = useState(false)

  const { data: domain, error, isLoading } = useSWR<Domain>(
    domainId ? `domain-${domainId}` : null,
    () => api.getDomain(domainId)
  )

  // Just filter the table data, no more math needed!
  const cleanSubdomains = (domain?.Subdomains || []).filter(sub => sub.ssl_cert != null)

  const handleDownloadCBOM = async () => {
    setIsCbomLoading(true)
    try {
      const data = await api.downloadCBOM(domainId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cbom_${domain?.domain_name || domainId}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CBOM download failed:', err)
    } finally {
      setIsCbomLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    setIsPdfLoading(true)
    try {
      const html = await api.downloadPDFReport(domainId)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${domain?.domain_name || domainId}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download failed:', err)
    } finally {
      setIsPdfLoading(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch { return '-' }
  }

  const getExpiryStatus = (validTo?: string) => {
    if (!validTo) return null
    const daysLeft = Math.ceil((new Date(validTo).getTime() - Date.now()) / (1000 * 3600 * 24))
    if (daysLeft < 0) return { text: 'Expired', className: 'text-red-500' }
    if (daysLeft < 30) return { text: `${daysLeft} days`, className: 'text-orange-500' }
    return { text: formatDate(validTo), className: 'text-green-500' }
  }

  // Helper to map backend colors to Tailwind classes securely
  const getRiskColors = (color?: string) => {
    switch (color) {
      case 'green': return { text: 'text-green-400', bg: 'bg-green-500/10' }
      case 'yellow': return { text: 'text-yellow-400', bg: 'bg-yellow-500/10' }
      case 'red': return { text: 'text-red-400', bg: 'bg-red-500/10' }
      default: return { text: 'text-muted-foreground', bg: 'bg-secondary/50' }
    }
  }

  const riskStyles = getRiskColors(domain?.risk_color)

 const columns: Column<Subdomain>[] = [
    { key: 'hostname', header: 'Hostname', sortable: true },
    { key: 'ip_address', header: 'IP Address', sortable: true },
    {
      key: 'pqc_score',
      header: 'Q-Score',
      sortable: true,
      render: (_, row) => {
        const score = row.ssl_cert?.q_score ?? 0
        let color = 'text-red-500' // Default to critical
        if (score >= 80) color = 'text-[#4ade80]' // Green for safe
        else if (score >= 50) color = 'text-yellow-400' // Yellow for moderate
        return <span className={`font-mono font-bold ${color}`}>{score}</span>
      }
    },
    {
      key: 'signature_algo',
      header: 'Signature Algo / Issuer ',
      render: (_, row) => <span className="text-yellow-500 font-mono">{row.ssl_cert?.issuer || '-'}</span>
    },
    {
      key: 'key_length',
      header: 'Key Length',
      render: (_, row) => <span className="font-mono">{row.ssl_cert?.key_length || '-'}</span>
    },
    {
      key: 'tls_version',
      header: 'TLS Version',
      render: (_, row) => <span className="font-mono">{row.ssl_cert?.tls_version || '-'}</span>
    },
    {
      key: 'valid_to',
      header: 'Valid Until',
      render: (_, row) => {
        const expiry = getExpiryStatus(row.ssl_cert?.valid_to)
        if (!expiry) return '-'
        return <span className={expiry.className}>{expiry.text}</span>
      }
    },
    {
      key: 'pqc_tier',
      header: 'Risk Status', // 🟢 Renamed to match the data better
      render: (_, row) => {
        if (!row.ssl_cert) return <span className="text-muted-foreground">-</span>

        // Grab the explicit risk label or fallback to tier
        const rawLabel = row.ssl_cert.risk_label || row.ssl_cert.pqc_tier || 'Unknown'
        // Clean underscores for UI (e.g., NOT_PQC_READY -> NOT PQC READY)
        const displayText = rawLabel.replace(/_/g, ' ')
        const score = row.ssl_cert.q_score

        //  FORCE MATCH THE COLOR TO THE MATH SCORE 
        let badgeClass = 'bg-secondary/50 text-muted-foreground'
        if (score >= 80 || rawLabel === 'Elite') {
          badgeClass = 'bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20'
        } else if (score >= 50) {
          badgeClass = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
        } else {
          badgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20'
        }

        return (
          <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${badgeClass}`}>
            {displayText}
          </span>
        )
      }
    },
  ]

  if (error) return <div className="p-8 text-center text-red-500">Failed to load domain details.</div>

  return (
    <div className="space-y-6 p-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass p-6 rounded-xl border border-border/50">
        <div>
          <Link href="/assets/domains" className="text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-2 mb-2 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to Domains
          </Link>
          <h1 className="text-3xl font-bold text-foreground">
            {domain?.domain_name || `Loading...`}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1.5 text-elite bg-elite/10 px-3 py-1 rounded-full border border-elite/20">
              <Activity className="w-4 h-4" /> Status: {domain?.status || 'Active'}
            </span>
            <span className="text-muted-foreground font-mono">
              Aggregate PQC Score: <strong className="text-foreground">{domain?.pqc_score || 0} / 1000</strong>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleDownloadCBOM} variant="outline" className="gap-2 border-border/50" disabled={isCbomLoading || !domain}>
            {isCbomLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-yellow-500" />}
            Export CBOM
          </Button>
          <Button onClick={handleDownloadPDF} className="gap-2 bg-pnb-maroon hover:bg-pnb-maroon-dark" disabled={isPdfLoading || !domain}>
            {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF Report
          </Button>
        </div>
      </div>

      {/* INTELLIGENCE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-xl border border-border/50 flex items-start gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><Building2 className="w-5 h-5" /></div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Organization</div>
            <div className="text-foreground text-sm font-semibold">{domain?.company_name || 'Fetching...'}</div>
            <div className="text-muted-foreground text-xs mt-1">Registrar: {domain?.registrar || 'N/A'}</div>
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-border/50 flex items-start gap-4">
          <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400"><Globe className="w-5 h-5" /></div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Infrastructure</div>
            <div className="text-foreground text-sm">Total Assets: <span className="font-bold text-yellow-400">{domain?.total_assets || 0}</span></div>
            <div className="text-foreground text-sm">Verified Live: <span className="font-mono text-muted-foreground">{domain?.total_clean || 0}</span></div>
          </div>
        </div>

        {/*  100% DYNAMIC RISK POSTURE BOX  */}
        <div className="glass p-5 rounded-xl border border-border/50 flex items-start gap-4">
          <div className={`p-3 rounded-lg ${riskStyles.bg} ${riskStyles.text}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Risk Posture</div>
            <div className={`text-sm font-bold ${riskStyles.text}`}>
              {domain?.risk_level || 'Loading...'}
            </div>
            <div className="text-muted-foreground text-xs mt-1">{domain?.risk_subtitle || 'Please wait...'}</div>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-secondary/30">
          <h3 className="text-foreground font-bold tracking-wider">Verified Endpoints ({domain?.total_clean || 0})</h3>
        </div>
        <DataTable
          columns={columns}
          data={cleanSubdomains}
          searchPlaceholder="Search active endpoints..."
          searchKeys={['hostname', 'ip_address']}
          isLoading={isLoading}
          emptyMessage={cleanSubdomains.length === 0 ? 'No verified SSL assets found' : undefined}
        />
      </div>
    </div>
  )
}