// PNB Quantum Shield API Configuration
import * as mockData from './mock-data'

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
const API_BASE_URL = "http://localhost:8080/api/v1" // Placeholder since no backend is configured

// Demo mode - uses mock data when no API is configured
// Always true when API_BASE_URL is not set (undefined, null, or empty)
function isDemoMode(): boolean {
  return !API_BASE_URL || API_BASE_URL.trim() === ''
}

// Export for use in components
const IS_DEMO_MODE = false // Force demo mode since no backend is configured

interface FetchOptions extends RequestInit {
  timeout?: number
}

interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}

interface PaginatedResponse<T> {
  data: T[]
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

type ApiErrorPayload = {
  message?: unknown
  error?: unknown
  msg?: unknown
  details?: unknown
}

function extractErrorMessage(payload: ApiErrorPayload | null, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback

  const directMsg = payload.msg
  if (typeof directMsg === 'string' && directMsg.trim()) {
    return directMsg.trim()
  }

  const directMessage = payload.message
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim()
  }

  const directError = payload.error
  if (typeof directError === 'string' && directError.trim()) {
    return directError.trim()
  }

  if (directError && typeof directError === 'object') {
    const nestedMessage = (directError as { message?: unknown }).message
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage.trim()
    }
  }

  if (Array.isArray(payload.details) && payload.details.length > 0) {
    const firstDetail = payload.details[0]
    if (typeof firstDetail === 'string' && firstDetail.trim()) {
      return firstDetail.trim()
    }
  }

  return fallback
}

function showErrorToast(message: string) {
  if (typeof window === 'undefined') return

  void import('sonner')
    .then(({ toast }) => {
      toast.error(message)
    })
    .catch(() => {
      // Ignore toast rendering failures
    })
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    showErrorToast(message)
  }
}

function buildQueryString(params: PaginationParams): string {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  if (params.search) query.set('search', params.search)
  if (params.sort) query.set('sort', params.sort)
  if (params.order) query.set('order', params.order)
  const str = query.toString()
  return str ? `?${str}` : ''
}

// Simulate network delay for realistic demo experience
async function simulateDelay(min = 200, max = 600) {
  const delay = Math.random() * (max - min) + min
  await new Promise(resolve => setTimeout(resolve, delay))
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout = 15000, ...fetchOptions } = options
  
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)

    if (error instanceof ApiError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out. Please try again.')
    }

    throw new ApiError(0, 'Unable to connect to the server. Please check your network and try again.')
  }
}

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  let payload: ApiErrorPayload | null = null
  let textPayload = ''

  try {
    payload = (await response.clone().json()) as ApiErrorPayload
  } catch {
    payload = null
  }

  if (!payload) {
    try {
      textPayload = (await response.clone().text()).trim()
      if (textPayload.startsWith('{') || textPayload.startsWith('[')) {
        const parsed = JSON.parse(textPayload) as ApiErrorPayload
        payload = parsed
      }
    } catch {
      textPayload = ''
    }
  }

  const message = extractErrorMessage(payload, textPayload || fallbackMessage)
  throw new ApiError(response.status, message)
}

export const api = {
  // Auth
  async login(username: string, password: string) {
    if (IS_DEMO_MODE) {
      await simulateDelay(500, 1000)
      if (username === 'admin' && password === 'admin123') {
        return { user: mockData.mockUser, token: 'demo-jwt-token' }
      }
      throw new ApiError(401, 'Invalid credentials. Use admin/admin123 for demo.')
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      await throwApiError(res, 'Login failed')
    }

    const data = await res.json()

    if (typeof window !== "undefined") {
    localStorage.setItem("token", data.token)
  }

  return data
  },

  async logout() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { success: true }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
    })
    if (!res.ok) await throwApiError(res, 'Logout failed')
    return res.json()
  },

  async getSession() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      const stored = typeof window !== 'undefined' && localStorage.getItem('pnb_demo_user')
      if (stored) {
        return { user: JSON.parse(stored) }
      }
      throw new ApiError(401, 'No session')
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/auth/me`)
    if (!res.ok) await throwApiError(res, 'Session invalid')
    return res.json()
  },

  // Domains
  domains: {
    async getAll(params: PaginationParams = {}): Promise<PaginatedResponse<unknown>> {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        let data = [...mockData.mockDomains]
        if (params.search) {
          data = data.filter(d => d.domain.toLowerCase().includes(params.search!.toLowerCase()))
        }
        return { data, pagination: { total: data.length, page: 1, limit: 10, totalPages: 1 } }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/domains${buildQueryString(params)}`)
      if (!res.ok) await throwApiError(res, 'Failed to fetch domains')
      const payload = await res.json()

      const normalizedData = Array.isArray(payload?.domains)
        ? payload.domains.map((domain: Record<string, unknown>) => ({
            ...domain,
            domain: (domain.domain as string | undefined) || (domain.domain_name as string | undefined) || '',
            lastScanned:
              (domain.lastScanned as string | null | undefined) ||
              (domain.last_scanned as string | null | undefined) ||
              null,
            endpoints:
              (domain.endpoints as number | undefined) ||
              (domain.total_assets as number | undefined) ||
              (domain.scanned_assets as number | undefined) ||
              0,
            riskLevel: (domain.riskLevel as string | undefined) || 'unknown',
          }))
        : Array.isArray(payload?.data)
          ? payload.data
          : []

      const total =
        (payload?.count as number | undefined) ??
        (payload?.pagination?.total as number | undefined) ??
        normalizedData.length
      const page =
        params.page ??
        (payload?.pagination?.page as number | undefined) ??
        1
      const limit =
        params.limit ??
        (payload?.pagination?.limit as number | undefined) ??
        (normalizedData.length || 10)
      const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1

      return {
        data: normalizedData,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      }
    },
    async add(domain: string) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        const newDomain = {
          id: Date.now(),
          domain,
          status: 'pending',
          lastScanned: '',
          endpoints: 0,
          riskLevel: 'unknown'
        }
        mockData.mockDomains.push(newDomain as typeof mockData.mockDomains[0])
        return { success: true, data: newDomain }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/domains`, {
    method: 'POST',
    body: JSON.stringify({ domain }),
  })

  if (!res.ok) await throwApiError(res, 'Failed to add domain')
  return res.json()
    },
    async delete(id: number) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        const idx = mockData.mockDomains.findIndex(d => d.id === id)
        if (idx > -1) mockData.mockDomains.splice(idx, 1)
        return { success: true }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/domains/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) await throwApiError(res, 'Failed to delete domain')
      return res.json()
    },
  },

  // SSL Certificates
  ssl: {
    async getAll(params: PaginationParams = {}): Promise<PaginatedResponse<unknown>> {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        let data = [...mockData.mockSSLCertificates]
        if (params.search) {
          data = data.filter(d => d.domain.toLowerCase().includes(params.search!.toLowerCase()))
        }
        return { data, pagination: { total: data.length, page: 1, limit: 10, totalPages: 1 } }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/ssl${buildQueryString(params)}`)
      if (!res.ok) await throwApiError(res, 'Failed to fetch SSL certificates')
      return res.json()
    },
    async add(data: { domain: string; certificate: string }) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        return { success: true }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/ssl`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) await throwApiError(res, 'Failed to add certificate')
      return res.json()
    },
    async delete(id: number) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        return { success: true }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/ssl/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) await throwApiError(res, 'Failed to delete certificate')
      return res.json()
    },
  },

  // IP Addresses
  ips: {
    async getAll(params: PaginationParams = {}): Promise<PaginatedResponse<unknown>> {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        let data = [...mockData.mockIPAddresses]
        if (params.search) {
          data = data.filter(d => d.ip.includes(params.search!) || d.location.toLowerCase().includes(params.search!.toLowerCase()))
        }
        return { data, pagination: { total: data.length, page: 1, limit: 10, totalPages: 1 } }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/ips${buildQueryString(params)}`)
      if (!res.ok) await throwApiError(res, 'Failed to fetch IP addresses')
      return res.json()
    },
    async add(data: { ip: string; subnet?: string; description?: string }) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        return { success: true }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/ips`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) await throwApiError(res, 'Failed to add IP address')
      return res.json()
    },
    async delete(id: number) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        return { success: true }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/ips/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) await throwApiError(res, 'Failed to delete IP address')
      return res.json()
    },
  },

  // Software Assets
  software: {
    async getAll(params: PaginationParams = {}): Promise<PaginatedResponse<unknown>> {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        let data = [...mockData.mockSoftware]
        if (params.search) {
          data = data.filter(d => d.name.toLowerCase().includes(params.search!.toLowerCase()))
        }
        return { data, pagination: { total: data.length, page: 1, limit: 10, totalPages: 1 } }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/software${buildQueryString(params)}`)
      if (!res.ok) await throwApiError(res, 'Failed to fetch software')
      return res.json()
    },
    async add(data: { name: string; version: string; vendor?: string }) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        return { success: true }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/software`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) await throwApiError(res, 'Failed to add software')
      return res.json()
    },
    async delete(id: number) {
      if (IS_DEMO_MODE) {
        await simulateDelay()
        return { success: true }
      }
      const res = await fetchWithTimeout(`${API_BASE_URL}/software/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) await throwApiError(res, 'Failed to delete software')
      return res.json()
    },
  },

  // Scanner
  async startScan(domainId: number) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { success: true, scanId: Date.now(), message: 'Scan started' }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/scan/start`, {
      method: 'POST',
      body: JSON.stringify({ domain_id: domainId }),
    })
    if (!res.ok) await throwApiError(res, 'Failed to start scan')
    return res.json()
  },

  async getScanStatus(domainId: number) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { ...mockData.mockScanProgress, domainId }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/scan/status/${domainId}`)
    if (!res.ok) await throwApiError(res, 'Failed to get scan status')
    return res.json()
  },

  async stopScan(domainId: number) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { success: true, message: 'Scan stopped' }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/scan/stop/${domainId}`, {
      method: 'POST',
    })
    if (!res.ok) await throwApiError(res, 'Failed to stop scan')
    return res.json()
  },

  // Assets
  async getAssets() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return {
        domains: mockData.mockDomains.length,
        ssl: mockData.mockSSLCertificates.length,
        ips: mockData.mockIPAddresses.length,
        software: mockData.mockSoftware.length,
      }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/ui/assets`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch assets')
    return res.json()
  },

  // Crypto
  async getQuantumReadyAssets() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { data: mockData.mockQuantumReadyAssets }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/crypto/quantum-ready`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch quantum-ready assets')
    return res.json()
  },

  async getVulnerableAssets() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { data: mockData.mockVulnerableAssets }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/crypto/vulnerabilities`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch vulnerable assets')
    return res.json()
  },

  // Dashboard
  async getKPIs() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return mockData.mockKPIs
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/dashboard/kpis`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch KPIs')
    return res.json()
  },

  async getRiskChart() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { data: mockData.mockRiskDistribution }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/dashboard/charts/risk`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch risk chart')
    return res.json()
  },

  async getExpiryChart() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { data: mockData.mockExpiryTimeline }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/dashboard/charts/expiry`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch expiry chart')
    return res.json()
  },

  // System
  async getEngineStatus() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return mockData.mockEngineStatus
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/system/engine-status`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch engine status')
    return res.json()
  },

  async getScannerSettings() {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return mockData.mockScannerSettings
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/settings/scanner-rules`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch settings')
    return res.json()
  },

  async updateScannerSettings(settings: Record<string, unknown>) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      Object.assign(mockData.mockScannerSettings, settings)
      return { success: true }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/settings/scanner-rules`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
    if (!res.ok) await throwApiError(res, 'Failed to update settings')
    return res.json()
  },

  // Export
  async downloadCBOM(domainId: number) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        version: 1,
        metadata: {
          timestamp: new Date().toISOString(),
          tools: [{ vendor: 'PNB', name: 'Quantum Shield', version: '2.4.1' }]
        },
        components: mockData.mockSoftware.map(s => ({
          type: 'library',
          name: s.name,
          version: s.version,
          supplier: { name: s.vendor },
          cryptoProperties: {
            algorithms: s.cryptoAlgorithms,
            quantumSafe: s.quantumSafe
          }
        }))
      }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/export/cbom/${domainId}`)
    if (!res.ok) await throwApiError(res, 'Failed to download CBOM')
    return res.json()
  },

  async downloadPDFReport(domainId: number) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return `PNB Quantum Shield Security Report\nDomain ID: ${domainId}\nGenerated: ${new Date().toISOString()}\n\nThis is a demo report.`
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/export/pdf-report/${domainId}`)
    if (!res.ok) await throwApiError(res, 'Failed to download report')
    return res.text()
  },

  // Discovery feed for scanner
  async getDiscoveryFeed() {
    if (IS_DEMO_MODE) {
      await simulateDelay(100, 300)
      return { data: mockData.mockDiscoveryFeed }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/scan/discovery-feed`)
    if (!res.ok) await throwApiError(res, 'Failed to fetch discovery feed')
    return res.json()
  },

  // Schedules
  async createSchedule(data: { domain_id: number; frequency: string; day?: string; time: string }) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { success: true, id: Date.now() }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/schedules`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (!res.ok) await throwApiError(res, 'Failed to create schedule')
    return res.json()
  },

  // Diff
  async getScanDiff(oldScanId: number, newScanId: number) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return {
        added: [{ type: 'endpoint', name: '/api/v3/payments' }],
        removed: [{ type: 'endpoint', name: '/api/v1/legacy' }],
        changed: [{ type: 'certificate', name: 'api.pnb.co.in', change: 'Algorithm upgraded to ECDSA' }]
      }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/scan/diff?old_scan_id=${oldScanId}&new_scan_id=${newScanId}`)
    if (!res.ok) await throwApiError(res, 'Failed to get scan diff')
    return res.json()
  },

  // Webhooks
  async createWebhook(data: { provider: string; url: string; events: string[] }) {
    if (IS_DEMO_MODE) {
      await simulateDelay()
      return { success: true, id: Date.now() }
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (!res.ok) await throwApiError(res, 'Failed to create webhook')
    return res.json()
  },

  // Check if demo mode
  isDemoMode: () => isDemoMode() || IS_DEMO_MODE,
}

export type { ApiError, PaginationParams, PaginatedResponse }
