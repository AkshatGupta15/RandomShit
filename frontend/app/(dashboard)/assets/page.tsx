"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, Shield, Network, Package, ArrowRight, TrendingUp, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"

interface AssetCounts {
  domains: number
  ssl: number
  ips: number
  software: number
}

const assetCategories = [
  {
    id: "domains",
    title: "Domains",
    description: "Manage and monitor all registered domains",
    icon: Globe,
    href: "/assets/domains",
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
    borderColor: "border-blue-500/30",
  },
  {
    id: "ssl",
    title: "SSL Certificates",
    description: "Track certificate expiration and cryptographic status",
    icon: Shield,
    href: "/assets/ssl",
    color: "from-green-500/20 to-green-600/5",
    iconColor: "text-green-400",
    borderColor: "border-green-500/30",
  },
  {
    id: "ips",
    title: "IP Addresses",
    description: "Monitor IP addresses and subnet allocations",
    icon: Network,
    href: "/assets/ips",
    color: "from-purple-500/20 to-purple-600/5",
    iconColor: "text-purple-400",
    borderColor: "border-purple-500/30",
  },
  {
    id: "software",
    title: "Software Assets",
    description: "Inventory of software with cryptographic dependencies",
    icon: Package,
    href: "/assets/software",
    color: "from-orange-500/20 to-orange-600/5",
    iconColor: "text-orange-400",
    borderColor: "border-orange-500/30",
  },
]

export default function AssetsOverviewPage() {
  const [counts, setCounts] = useState<AssetCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [domainsRes, sslRes, ipsRes, softwareRes] = await Promise.all([
          api.domains.getAll({ page: 1, limit: 1 }),
          api.ssl.getAll({ page: 1, limit: 1 }),
          api.ips.getAll({ page: 1, limit: 1 }),
          api.software.getAll({ page: 1, limit: 1 }),
        ])
        
        setCounts({
          domains: domainsRes.pagination?.total || 0,
          ssl: sslRes.pagination?.total || 0,
          ips: ipsRes.pagination?.total || 0,
          software: softwareRes.pagination?.total || 0,
        })
      } catch (error) {
        console.error("Failed to fetch asset counts:", error)
        setCounts({ domains: 0, ssl: 0, ips: 0, software: 0 })
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()
  }, [])

  const getCount = (id: string) => {
    if (!counts) return 0
    return counts[id as keyof AssetCounts] || 0
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Asset Management</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive overview of your organization&apos;s digital assets
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center justify-center h-20">
                <Spinner className="h-6 w-6" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {Object.values(counts || {}).reduce((a, b) => a + b, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Assets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Shield className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">Secure</p>
                    <p className="text-xs text-muted-foreground">Overall Status</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-400">3</p>
                    <p className="text-xs text-muted-foreground">Needs Attention</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Globe className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">Active</p>
                    <p className="text-xs text-muted-foreground">Monitoring</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Asset Categories */}
      <div className="grid md:grid-cols-2 gap-6">
        {assetCategories.map((category, index) => {
          const Icon = category.icon
          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={category.href}>
                <Card className={`group relative overflow-hidden border ${category.borderColor} bg-gradient-to-br ${category.color} hover:border-primary/50 transition-all duration-300 cursor-pointer`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transform -skew-x-12 transition-opacity duration-500" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl bg-background/50 ${category.iconColor}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <Badge variant="secondary" className="bg-background/50">
                        {loading ? (
                          <Spinner className="h-3 w-3" />
                        ) : (
                          `${getCount(category.id)} items`
                        )}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mt-4">{category.title}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-primary group-hover:translate-x-1 transition-transform">
                      View Details
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
