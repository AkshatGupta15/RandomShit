// Mock data for demo mode when backend is unavailable

export const mockUser = {
  id: 1,
  username: 'admin',
  role: 'administrator',
  email: 'admin@pnb.co.in'
}

export const mockDomains = [
  { id: 1, domain: 'pnb.co.in', status: 'active', lastScanned: '2026-03-15T10:30:00Z', endpoints: 45, riskLevel: 'low' },
  { id: 2, domain: 'netbanking.pnb.co.in', status: 'active', lastScanned: '2026-03-14T08:15:00Z', endpoints: 128, riskLevel: 'medium' },
  { id: 3, domain: 'corporate.pnb.co.in', status: 'active', lastScanned: '2026-03-13T14:22:00Z', endpoints: 67, riskLevel: 'low' },
  { id: 4, domain: 'api.pnb.co.in', status: 'scanning', lastScanned: '2026-03-12T09:45:00Z', endpoints: 234, riskLevel: 'high' },
  { id: 5, domain: 'mobile.pnb.co.in', status: 'active', lastScanned: '2026-03-11T16:30:00Z', endpoints: 89, riskLevel: 'medium' },
]

export const mockSSLCertificates = [
  { id: 1, domain: 'pnb.co.in', issuer: 'DigiCert', validFrom: '2025-06-01', validTo: '2027-06-01', algorithm: 'RSA-2048', status: 'valid', daysToExpiry: 440 },
  { id: 2, domain: 'netbanking.pnb.co.in', issuer: 'GlobalSign', validFrom: '2025-08-15', validTo: '2026-08-15', algorithm: 'ECDSA-P256', status: 'valid', daysToExpiry: 150 },
  { id: 3, domain: 'corporate.pnb.co.in', issuer: 'DigiCert', validFrom: '2025-01-10', validTo: '2026-04-10', algorithm: 'RSA-4096', status: 'expiring', daysToExpiry: 23 },
  { id: 4, domain: 'api.pnb.co.in', issuer: 'Let\'s Encrypt', validFrom: '2026-01-01', validTo: '2026-04-01', algorithm: 'ECDSA-P384', status: 'expiring', daysToExpiry: 14 },
  { id: 5, domain: 'mobile.pnb.co.in', issuer: 'Comodo', validFrom: '2025-11-20', validTo: '2027-11-20', algorithm: 'RSA-2048', status: 'valid', daysToExpiry: 612 },
]

export const mockIPAddresses = [
  { id: 1, ip: '10.0.1.1', subnet: '10.0.1.0/24', location: 'Mumbai DC', type: 'internal', status: 'active', services: 12 },
  { id: 2, ip: '10.0.2.1', subnet: '10.0.2.0/24', location: 'Delhi DC', type: 'internal', status: 'active', services: 8 },
  { id: 3, ip: '203.45.67.89', subnet: '203.45.67.0/24', location: 'AWS Mumbai', type: 'external', status: 'active', services: 24 },
  { id: 4, ip: '103.21.45.67', subnet: '103.21.45.0/24', location: 'Azure India', type: 'external', status: 'inactive', services: 0 },
  { id: 5, ip: '192.168.1.1', subnet: '192.168.1.0/24', location: 'Chennai Branch', type: 'internal', status: 'active', services: 5 },
]

export const mockSoftware = [
  { id: 1, name: 'OpenSSL', version: '3.0.12', vendor: 'OpenSSL Foundation', cryptoAlgorithms: ['AES-256', 'RSA-2048', 'SHA-256'], quantumSafe: false, riskScore: 45 },
  { id: 2, name: 'Apache Tomcat', version: '10.1.18', vendor: 'Apache', cryptoAlgorithms: ['TLS 1.3', 'AES-128'], quantumSafe: false, riskScore: 32 },
  { id: 3, name: 'PostgreSQL', version: '16.2', vendor: 'PostgreSQL Global', cryptoAlgorithms: ['AES-256', 'SHA-512'], quantumSafe: false, riskScore: 28 },
  { id: 4, name: 'Bouncy Castle', version: '1.77', vendor: 'Legion of BC', cryptoAlgorithms: ['CRYSTALS-Kyber', 'CRYSTALS-Dilithium'], quantumSafe: true, riskScore: 12 },
  { id: 5, name: 'Node.js', version: '20.11.1', vendor: 'OpenJS Foundation', cryptoAlgorithms: ['AES-256-GCM', 'ChaCha20'], quantumSafe: false, riskScore: 38 },
]

export const mockKPIs = {
  totalAssets: 1247,
  liveEndpoints: 563,
  quantumSafe: 234,
  criticalRisks: 18,
  pqcScore: 72,
  trends: {
    totalAssets: 5.2,
    liveEndpoints: -2.1,
    quantumSafe: 12.8,
    criticalRisks: -8.3,
  }
}

export const mockRiskDistribution = [
  { name: 'Critical', value: 18, fill: '#ef4444' },
  { name: 'High', value: 45, fill: '#f97316' },
  { name: 'Medium', value: 124, fill: '#eab308' },
  { name: 'Low', value: 376, fill: '#22c55e' },
]

export const mockExpiryTimeline = [
  { month: 'Mar', critical: 5, warning: 12, ok: 45 },
  { month: 'Apr', critical: 3, warning: 8, ok: 52 },
  { month: 'May', critical: 2, warning: 15, ok: 48 },
  { month: 'Jun', critical: 8, warning: 22, ok: 38 },
  { month: 'Jul', critical: 1, warning: 6, ok: 61 },
  { month: 'Aug', critical: 4, warning: 11, ok: 55 },
]

export const mockQuantumReadyAssets = [
  { id: 1, name: 'Core Banking API', algorithm: 'CRYSTALS-Kyber-1024', status: 'migrated', migratedDate: '2026-01-15' },
  { id: 2, name: 'Payment Gateway', algorithm: 'CRYSTALS-Dilithium-3', status: 'migrated', migratedDate: '2026-02-01' },
  { id: 3, name: 'Auth Service', algorithm: 'SPHINCS+-256s', status: 'in_progress', progress: 78 },
  { id: 4, name: 'Data Warehouse', algorithm: 'BIKE-L3', status: 'planned', scheduledDate: '2026-04-01' },
]

export const mockVulnerableAssets = [
  { id: 1, name: 'Legacy SSL Gateway', vulnerability: 'RSA-1024 key size', severity: 'critical', cve: 'CVE-2023-0215', recommendation: 'Upgrade to RSA-4096 or migrate to PQC' },
  { id: 2, name: 'Internal CA', vulnerability: 'SHA-1 signatures', severity: 'high', cve: 'CVE-2022-4450', recommendation: 'Migrate to SHA-256 or higher' },
  { id: 3, name: 'VPN Concentrator', vulnerability: 'DES encryption', severity: 'critical', cve: 'CVE-2021-3449', recommendation: 'Upgrade to AES-256-GCM' },
  { id: 4, name: 'SMTP Server', vulnerability: 'SSLv3 enabled', severity: 'medium', cve: 'CVE-2014-3566', recommendation: 'Disable SSLv3, enable TLS 1.3' },
]

export const mockScannerSettings = {
  autoScan: true,
  scanFrequency: 'daily',
  deepScan: false,
  portRange: '1-1024',
  timeout: 30,
  maxThreads: 50,
  notifications: {
    email: true,
    slack: false,
    webhook: true
  },
  webhooks: [
    { id: 1, url: 'https://hooks.slack.com/services/xxx', events: ['scan_complete', 'critical_found'], active: true },
  ]
}

export const mockEngineStatus = {
  status: 'online',
  version: '2.4.1',
  uptime: '15d 4h 32m',
  lastUpdate: '2026-03-10T08:00:00Z',
  activeScans: 2,
  queuedScans: 5,
  cpuUsage: 34,
  memoryUsage: 62,
}

export const mockScanProgress = {
  domainId: 4,
  domain: 'api.pnb.co.in',
  status: 'scanning',
  progress: 67,
  startTime: '2026-03-18T09:00:00Z',
  estimatedCompletion: '2026-03-18T10:30:00Z',
  discoveredEndpoints: 156,
  scannedEndpoints: 104,
  findings: {
    critical: 2,
    high: 5,
    medium: 12,
    low: 28
  }
}

export const mockDiscoveryFeed = [
  { id: 1, timestamp: Date.now() - 5000, type: 'endpoint', message: 'Discovered /api/v2/accounts endpoint', severity: 'info' },
  { id: 2, timestamp: Date.now() - 12000, type: 'certificate', message: 'SSL certificate using RSA-2048', severity: 'warning' },
  { id: 3, timestamp: Date.now() - 25000, type: 'vulnerability', message: 'Weak cipher suite detected: TLS_RSA_WITH_AES_128_CBC_SHA', severity: 'high' },
  { id: 4, timestamp: Date.now() - 45000, type: 'endpoint', message: 'Discovered /api/v2/transactions endpoint', severity: 'info' },
  { id: 5, timestamp: Date.now() - 60000, type: 'certificate', message: 'Certificate expires in 14 days', severity: 'critical' },
]
