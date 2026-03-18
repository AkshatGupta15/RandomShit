'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Settings,
  Save,
  RefreshCw,
  Cpu,
  Clock,
  Network,
  Shield,
  Globe,
  AlertTriangle,
  CheckCircle,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'

interface ScannerSettings {
  id: number
  max_concurrent_workers: number
  timeout_seconds: number
  enable_cert_spotter: boolean
  enable_hacker_target: boolean
  enable_alien_vault: boolean
}

interface EngineStatus {
  engine_architecture: string
  active_scans: number
  telemetry: {
    active_goroutines: number
    memory_allocated_mb: number
    sys_memory_mb: number
  }
  capacity: {
    max_worker_threads: number
    http_timeout_sec: number
  }
  osint_modules: {
    certspotter: boolean
    hackertarget: boolean
    alienvault: boolean
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<ScannerSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { data: fetchedSettings, isLoading: settingsLoading, mutate: mutateSettings } = useSWR<ScannerSettings>(
    'scanner-settings',
    () => api.getScannerSettings(),
    { revalidateOnFocus: false }
  )

  const { data: engineStatus, isLoading: statusLoading, mutate: mutateStatus } = useSWR<EngineStatus>(
    'engine-status',
    () => api.getEngineStatus(),
    { refreshInterval: 5000 }
  )

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings)
    }
  }, [fetchedSettings])

  const handleSave = async () => {
    if (!settings) return

    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await api.updateScannerSettings({
        max_concurrent_workers: settings.max_concurrent_workers,
        timeout_seconds: settings.timeout_seconds,
        enable_cert_spotter: settings.enable_cert_spotter,
        enable_hacker_target: settings.enable_hacker_target,
        enable_alien_vault: settings.enable_alien_vault,
      })
      await mutateSettings()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefresh = () => {
    mutateSettings()
    mutateStatus()
  }

  const updateSetting = <K extends keyof ScannerSettings>(key: K, value: ScannerSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scanner engine configuration and OSINT modules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2 border-border/50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !settings}
            className={cn(
              'gap-2 bg-pnb-maroon hover:bg-pnb-maroon-dark border border-pnb-gold/30',
              saveSuccess && 'bg-elite hover:bg-elite'
            )}
          >
            {isSaving ? (
              <Spinner className="h-4 w-4" />
            ) : saveSuccess ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveSuccess ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </motion.div>

      {/* Engine Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-6 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-pnb-gold" />
          Engine Telemetry
        </h3>

        {statusLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-lg bg-secondary/30">
                <div className="h-3 w-20 bg-secondary rounded animate-pulse mb-2" />
                <div className="h-6 w-12 bg-secondary rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Architecture</p>
              </div>
              <p className="text-sm font-medium">{engineStatus?.engine_architecture || 'N/A'}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Active Goroutines</p>
              </div>
              <p className="text-2xl font-bold font-mono text-elite">
                {engineStatus?.telemetry?.active_goroutines || 0}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Memory Used</p>
              </div>
              <p className="text-2xl font-bold font-mono">
                {engineStatus?.telemetry?.memory_allocated_mb || 0}
                <span className="text-sm text-muted-foreground ml-1">MB</span>
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Active Scans</p>
              </div>
              <p className="text-2xl font-bold font-mono text-pnb-gold">
                {engineStatus?.active_scans || 0}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Scanner Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-6 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-6 flex items-center gap-2">
          <Settings className="h-4 w-4 text-pnb-gold" />
          Scanner Configuration
        </h3>

        {settingsLoading || !settings ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel>Max Concurrent Workers</FieldLabel>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.max_concurrent_workers}
                  onChange={(e) => updateSetting('max_concurrent_workers', parseInt(e.target.value) || 1)}
                  className="w-32 bg-secondary/50 border-border/50 focus:border-pnb-gold font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Number of parallel scanning threads (1-100)
                </p>
              </div>
            </Field>

            <Field>
              <FieldLabel>HTTP Timeout (seconds)</FieldLabel>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={settings.timeout_seconds}
                    onChange={(e) => updateSetting('timeout_seconds', parseInt(e.target.value) || 15)}
                    className="w-32 bg-secondary/50 border-border/50 focus:border-pnb-gold font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Request timeout for asset discovery (5-60 seconds)
                </p>
              </div>
            </Field>
          </FieldGroup>
        )}
      </motion.div>

      {/* OSINT Modules */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl p-6 border border-border/50"
      >
        <h3 className="text-sm font-medium text-foreground mb-6 flex items-center gap-2">
          <Globe className="h-4 w-4 text-pnb-gold" />
          OSINT Modules
        </h3>

        {settingsLoading || !settings ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {[
              {
                key: 'enable_cert_spotter' as const,
                name: 'CertSpotter',
                description: 'SSL certificate transparency log monitoring',
                icon: Shield,
              },
              {
                key: 'enable_hacker_target' as const,
                name: 'HackerTarget',
                description: 'Subdomain enumeration and DNS reconnaissance',
                icon: Globe,
              },
              {
                key: 'enable_alien_vault' as const,
                name: 'AlienVault OTX',
                description: 'Open threat exchange intelligence feeds',
                icon: AlertTriangle,
              },
            ].map((module) => (
              <div
                key={module.key}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border transition-all',
                  settings[module.key]
                    ? 'bg-elite/10 border-elite/30'
                    : 'bg-secondary/30 border-border/30'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    settings[module.key] ? 'bg-elite/20' : 'bg-secondary'
                  )}>
                    <module.icon className={cn(
                      'h-5 w-5',
                      settings[module.key] ? 'text-elite' : 'text-muted-foreground'
                    )} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{module.name}</p>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                  </div>
                </div>
                <Switch
                  checked={settings[module.key]}
                  onCheckedChange={(checked) => updateSetting(module.key, checked)}
                />
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-xl p-6 border border-destructive/30"
      >
        <h3 className="text-sm font-medium text-destructive mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </h3>
        
        <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <div>
            <p className="font-medium text-foreground">Reset Scanner Engine</p>
            <p className="text-xs text-muted-foreground">
              Stop all active scans and reset engine to default state
            </p>
          </div>
          <Button variant="destructive" size="sm">
            Reset Engine
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
