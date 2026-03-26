'use client'

import React, { useState, useEffect, useMemo } from "react"
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from "react-simple-maps"
import { ShieldCheck, ShieldAlert, Shield, Activity, Globe } from "lucide-react"
import { api } from "@/lib/api"

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const INDIAN_HUB_CITIES = [
  { city: "Mumbai", coords: [72.8777, 19.0760] },
  { city: "Delhi", coords: [77.2090, 28.6139] },
  { city: "Chennai", coords: [80.2707, 13.0827] },
  { city: "Bangalore", coords: [77.5946, 12.9716] },
  { city: "Hyderabad", coords: [78.4744, 17.3850] },
  { city: "Pune", coords: [73.8567, 18.5204] },
  { city: "Kolkata", coords: [88.3639, 22.5726] },
  { city: "Ahmedabad", coords: [72.5714, 23.0225] },
  { city: "Jaipur", coords: [75.7873, 26.9124] },
  { city: "Noida", coords: [77.3910, 28.5355] }
]

function getCityForIP(ip: string) {
  let hash = 0
  for (let i = 0; i < ip.length; i++) {
    hash = ip.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const baseCity = INDIAN_HUB_CITIES[Math.abs(hash) % INDIAN_HUB_CITIES.length]

  // 🟢 DETERMINISTIC SCATTER (JITTER) 🟢
  // We use the IP string to generate a small offset (-0.5 to +0.5 degrees).
  // This prevents 20 IPs from stacking on the exact same pixel, creating a beautiful "cluster" effect.
  const jitterX = ((Math.abs(hash * 31) % 100) / 100) * 0.8 - 0.4
  const jitterY = ((Math.abs(hash * 17) % 100) / 100) * 0.8 - 0.4

  return {
    city: baseCity.city,
    coords: [baseCity.coords[0] + jitterX, baseCity.coords[1] + jitterY]
  }
}

export default function GeoMap() {
  const [tooltipContent, setTooltipContent] = useState<any>(null)
  const [domains, setDomains] = useState<any[]>([])
  const [selectedDomainId, setSelectedDomainId] = useState<string>("")
  const [markers, setMarkers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const res = await api.domains.getAll({ limit: 100 })
        setDomains(res.data || [])
        if (res.data?.length > 0) setSelectedDomainId(res.data[0].id.toString())
      } catch (error) {
        console.error("Failed to fetch domains for map", error)
      }
    }
    fetchDomains()
  }, [])

  useEffect(() => {
    if (!selectedDomainId) return

    const fetchDomainDetails = async () => {
      setIsLoading(true)
      try {
        const domainData = await api.getDomain(Number(selectedDomainId))

        // Robust fallback for Go JSON parsing quirks (Subdomains vs subdomains)
        const subdomains = domainData.Subdomains || (domainData as any).subdomains || []
        
        const newMarkers = subdomains
          .filter((sub: any) => sub.ssl_cert != null)
          .map((sub: any) => {
            const location = getCityForIP(sub.ip_address || sub.hostname)
            const score = sub.ssl_cert.q_score || 0
            
            let status = "Critical"
            let color = "#f87171"
            if (score >= 65) { status = "Safe"; color = "#4ade80" } 
            else if (score >= 50) { status = "Moderate"; color = "#eab308" }

            return {
              coordinates: location.coords,
              city: location.city,
              ip: sub.ip_address,
              hostname: sub.hostname,
              status, color, score
            }
          })

        setMarkers(newMarkers)
      } catch (error) {
        console.error("Failed to fetch domain details", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDomainDetails()
  }, [selectedDomainId])

  const stats = useMemo(() => {
    return {
      total: markers.length,
      safe: markers.filter(m => m.status === 'Safe').length,
      critical: markers.filter(m => m.status === 'Critical').length,
    }
  }, [markers])

  return (
    <div className="relative w-full h-[650px] rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#0d1117]">
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-2 pointer-events-auto">
        <h3 className="text-white/90 font-bold text-base tracking-wide flex items-center gap-2">
          <Globe className="w-4 h-4 text-pnb-gold" /> Geolocation Intelligence
        </h3>
        <select
          value={selectedDomainId}
          onChange={(e) => setSelectedDomainId(e.target.value)}
          className="bg-[#161b22]/90 border border-white/10 text-white text-xs rounded-lg px-3 py-2 w-64 focus:outline-none focus:border-[#a31a38] shadow-lg backdrop-blur-sm cursor-pointer"
          disabled={isLoading}
        >
          <option value="" disabled>Select Target Domain...</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.domain_name}</option>
          ))}
        </select>
        {isLoading && <span className="text-xs text-yellow-500 font-mono animate-pulse">Mapping endpoints...</span>}
      </div>

      <div className="absolute top-6 right-6 z-10 flex gap-4 text-[10px] font-mono text-white/60 bg-[#161b22]/80 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm pointer-events-none">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_5px_#4ade80]"></span> Safe</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#eab308] shadow-[0_0_5px_#eab308]"></span> Transition</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f87171] shadow-[0_0_5px_#f87171]"></span> Critical</div>
      </div>

      <div className="absolute bottom-6 right-6 z-10 flex gap-3 pointer-events-none">
        <div className="bg-[#161b22]/90 backdrop-blur-md border border-white/10 rounded-lg p-3 min-w-[90px] shadow-lg text-right">
          <div className="text-white/50 text-[9px] uppercase tracking-wider mb-1">Mapped IPs</div>
          <div className="text-white font-bold text-lg">{stats.total}</div>
        </div>
        <div className="bg-[#161b22]/90 backdrop-blur-md border border-[#4ade80]/20 rounded-lg p-3 min-w-[90px] shadow-lg text-right">
          <div className="text-white/50 text-[9px] uppercase tracking-wider mb-1">PQC Safe</div>
          <div className="text-[#4ade80] font-bold text-lg">{stats.safe}</div>
        </div>
        <div className="bg-[#161b22]/90 backdrop-blur-md border border-[#f87171]/20 rounded-lg p-3 min-w-[90px] shadow-lg text-right">
          <div className="text-white/50 text-[9px] uppercase tracking-wider mb-1">HNDL Risk</div>
          <div className="text-[#f87171] font-bold text-lg">{stats.critical}</div>
        </div>
      </div>

      {tooltipContent && (
        <div 
          className="absolute z-50 bg-[#161b22]/95 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-[120%]"
          style={{ left: '50%', top: '50%' }} 
        >
          <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/10">
            {tooltipContent.status === 'Safe' ? <ShieldCheck className="w-5 h-5 text-[#4ade80]" /> : 
             tooltipContent.status === 'Moderate' ? <Shield className="w-5 h-5 text-[#eab308]" /> : 
             <ShieldAlert className="w-5 h-5 text-[#f87171]" />}
            <div>
              <div className="text-white font-bold text-sm tracking-wide">{tooltipContent.city}, IN</div>
              <div className="text-[#a31a38] text-[10px] font-bold uppercase tracking-wider">Asset Node Detected</div>
            </div>
          </div>
          <div className="space-y-1">
             <div className="flex justify-between gap-6 text-xs">
              <span className="text-white/40">Hostname:</span>
              <span className="text-white font-mono text-[10px]">{tooltipContent.hostname}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs">
              <span className="text-white/40">IP Address:</span>
              <span className="text-white font-mono text-[10px]">{tooltipContent.ip}</span>
            </div>
            <div className="flex justify-between gap-6 text-xs">
              <span className="text-white/40">Risk Status:</span>
              <span style={{ color: tooltipContent.color }} className="font-bold uppercase text-[10px] tracking-wider">
                {tooltipContent.status} (Q-{tooltipContent.score})
              </span>
            </div>
          </div>
        </div>
      )}

      <ComposableMap projection="geoMercator" style={{ width: "100%", height: "100%" }}>
        {/* 🟢 ZOOM LEVEL INCREASED TO 16x 🟢 */}
        <ZoomableGroup center={[79.0, 22.0]} zoom={16} maxZoom={30}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const isIndia = geo.properties.name === "India"
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isIndia ? "#1c2431" : "#11151c"} 
                    stroke="#ffffff"
                    strokeWidth={isIndia ? 0.05 : 0.01}
                    strokeOpacity={0.2}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#242e3e", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                )
              })
            }
          </Geographies>

          {markers.map((marker, idx) => (
            <Marker 
              key={idx} 
              coordinates={marker.coordinates as [number, number]}
              onMouseEnter={() => setTooltipContent(marker)}
              onMouseLeave={() => setTooltipContent(null)}
            >
              {/* 🟢 RADIUS DRASTICALLY REDUCED FOR ZOOM COMPENSATION 🟢 */}
              <circle r={0.8} fill={marker.color} opacity={0.3} className="animate-pulse" />
              <circle r={0.2} fill={marker.color} stroke="#0d1117" strokeWidth={0.05} />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}