import { Metadata } from "next"
import NetworkPageClient from "@/components/dashboard/network-page-client"


export const metadata: Metadata = {
  title: "Topology Map | PNB Quantum Shield",
  description: "Real-time 2D network attack surface visualization.",
}

export default function NetworkPage() {
  return <NetworkPageClient />
}