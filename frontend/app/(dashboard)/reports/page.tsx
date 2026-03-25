'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  FileText,
  Download,
  FileJson,
  Globe,
  Calendar,
  Clock,
  Shield,
  CheckCircle,
  AlertTriangle,
  Printer,
  Share2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Domain {
  id: number
  domain_name: string
  status: string
  scanned_assets: number
  total_assets: number
  last_scanned: string | null
}

export default function ReportsPage() {
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [isDownloadingCBOM, setIsDownloadingCBOM] = useState(false)
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  const { data: domains, isLoading: domainsLoading } = useSWR<Domain[]>(
    'reports-domains',
    async () => {
      const response = await api.domains.getAll()
      const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []

      return rows.map((domain: any) => ({
        id: Number(domain.id),
        domain_name: (domain.domain_name as string | undefined) || (domain.domain as string | undefined) || '',
        status: (domain.status as string | undefined) || 'unknown',
        scanned_assets: Number(domain.scanned_assets ?? domain.endpoints ?? 0),
        total_assets: Number(domain.total_assets ?? domain.scanned_assets ?? domain.endpoints ?? 0),
        last_scanned: (domain.last_scanned as string | null | undefined) || (domain.lastScanned as string | null | undefined) || null,
      }))
    }
  )

  const domainList = Array.isArray(domains) ? domains : []
  const selectedDomain = domainList.find(d => d.id === selectedDomainId)

  const handleDownloadCBOM = async () => {
    if (!selectedDomainId) return

    setIsDownloadingCBOM(true)
    try {
      const cbom = await api.downloadCBOM(selectedDomainId)
      const blob = new Blob([JSON.stringify(cbom, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cbom_${selectedDomain?.domain_name || 'report'}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download CBOM:', error)
    } finally {
      setIsDownloadingCBOM(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!selectedDomainId) return

    setIsDownloadingPDF(true)
    try {
      const htmlContent = await api.downloadPDFReport(selectedDomainId)

      // Save generated report as an .html file (manual PDF conversion via browser Print to PDF)
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const fileName = `pnb_report_${selectedDomain?.domain_name || selectedDomainId}.html`

      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // offer print experience in new tab
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        printWindow.focus()
      }
    } catch (error) {
      console.error('Failed to download PDF:', error)
    } finally {
      setIsDownloadingPDF(false)
    }
  }

  const reportTypes = [
    {
      id: 'cbom',
      title: 'CycloneDX CBOM',
      description: 'Cryptographic Bill of Materials (v1.6)',
      icon: FileJson,
      format: 'JSON',
      compliance: 'NIST FIPS 203/204',
      action: handleDownloadCBOM,
      isLoading: isDownloadingCBOM,
    },
    {
      id: 'pdf',
      title: 'Executive Report',
      description: 'Comprehensive security assessment PDF',
      icon: Printer,
      format: 'PDF',
      compliance: 'Enterprise Standard',
      action: handleDownloadPDF,
      isLoading: isDownloadingPDF,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Export</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate compliance reports and export cryptographic inventories
          </p>
        </div>
      </motion.div>

      {/* Domain Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-6 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-pnb-gold" />
          Select Domain for Reports
        </h3>

        <div className="flex flex-col md:flex-row gap-4">
          <Select
            value={selectedDomainId?.toString() || ''}
            onValueChange={(value) => setSelectedDomainId(Number(value))}
          >
            <SelectTrigger className="md:w-96 bg-secondary/50 border-border/50">
              <SelectValue placeholder="Select a domain" />
            </SelectTrigger>
            <SelectContent className="glass border-border/50">
              {domainsLoading ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : domainList.length === 0 ? (
                <SelectItem value="none" disabled>No domains available</SelectItem>
              ) : (
                domainList.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-pnb-gold" />
                      {domain.domain_name}
                      <span className="text-xs text-muted-foreground">
                        ({domain.scanned_assets} assets)
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {selectedDomain && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Last scanned: {selectedDomain.last_scanned 
                  ? new Date(selectedDomain.last_scanned).toLocaleDateString()
                  : 'Never'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>{selectedDomain.scanned_assets} assets</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTypes.map((report, index) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <Card className="glass border-border/50 hover:border-pnb-gold/30 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-pnb-maroon/20 flex items-center justify-center">
                      <report.icon className="h-6 w-6 text-pnb-gold" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <CardDescription>{report.description}</CardDescription>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-secondary text-xs font-mono">
                    {report.format}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-elite" />
                    {report.compliance}
                  </div>
                  <Button
                    onClick={report.action}
                    disabled={!selectedDomainId || report.isLoading}
                    className="gap-2 bg-pnb-maroon hover:bg-pnb-maroon-dark border border-pnb-gold/30"
                  >
                    {report.isLoading ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Compliance Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-xl p-6 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-pnb-gold" />
          Compliance Standards
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              standard: 'NIST FIPS 203',
              description: 'ML-KEM (Kyber) Post-Quantum KEM',
              status: 'compliant',
            },
            {
              standard: 'NIST FIPS 204',
              description: 'ML-DSA (Dilithium) Digital Signatures',
              status: 'compliant',
            },
            {
              standard: 'CycloneDX 1.6',
              description: 'Cryptographic Bill of Materials',
              status: 'compliant',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-elite/10 border border-elite/30"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-elite" />
                <span className="font-medium text-foreground">{item.standard}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-elite/20 text-elite text-xs">
                Compliant
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Exports */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-xl p-6 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-pnb-gold" />
          Recent Exports
        </h3>

        <div className="space-y-2">
          {[
            { name: 'cbom_pnbindia.in.json', date: '2 hours ago', size: '24 KB' },
            { name: 'executive_report_pnb.pdf', date: '1 day ago', size: '156 KB' },
            { name: 'cbom_pnbuat.bank.in.json', date: '3 days ago', size: '18 KB' },
          ].map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-mono">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{file.size}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
