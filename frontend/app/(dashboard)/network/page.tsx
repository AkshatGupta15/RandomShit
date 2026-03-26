import { Metadata } from "next"
import NetworkGraph from "@/components/dashboard/network-graph"
import { Activity } from "lucide-react"
import GeoMap from "@/components/dashboard/geo-map"

export const metadata: Metadata = {
  title: "Topology Map | PNB Quantum Shield",
  description: "Real-time 2D network attack surface visualization.",
}

export default function NetworkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Activity className="h-8 w-8 text-pnb-gold" />
          Attack Surface Topology
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Interactive representation of the enterprise network. Nodes are physically repelled using strict collision physics and color-coded by Post-Quantum cryptographic readiness. Scroll to zoom and reveal endpoint hostnames.
        </p>
      </div>

      <div className="w-full">
        <GeoMap />
      </div>
    </div>
  )
}