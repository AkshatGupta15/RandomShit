'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import * as d3 from 'd3-force'
import { Radar, Target, Search, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
  ssr: false,
  loading: () => null
})

const ENTERPRISE_TARGETS = [
  "pnbindia.in",
  "pnb.co.in",
  "pnbinternational.com",
  "pnbhousing.com"
]

export default function NetworkGraph() {
  const [targetDomain, setTargetDomain] = useState<string>(ENTERPRISE_TARGETS[0])
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  
  const [graphData, setGraphData] = useState<{nodes: any[], links: any[]}>({ nodes: [], links: [] })
  const [hoverNode, setHoverNode] = useState<any | null>(null)
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [graphSize, setGraphSize] = useState({ width: 0, height: 650 })

  useEffect(() => {
    if (!containerRef.current) return

    const updateSize = () => {
      if (!containerRef.current) return
      setGraphSize({
        width: Math.max(0, containerRef.current.clientWidth),
        height: Math.max(0, containerRef.current.clientHeight),
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDomain) return;
    
    setIsScanning(true);
    setHasScanned(false);
    
    try {
      const data = await api.getTopologyData(targetDomain);
      setGraphData(data);
      setHasScanned(true);
    } catch (error) {
      console.error("Error loading OSINT data", error);
    } finally {
      setIsScanning(false);
    }
  }

  const handleReset = () => {
    setHasScanned(false);
    setGraphData({ nodes: [], links: [] });
    setHoverNode(null);
  }

  // 🟢 FIXED PHYSICS: ADDED GRAVITY TO PREVENT OVERFLOW 🟢
  useEffect(() => {
    if (fgRef.current && hasScanned && graphData.nodes.length > 0) {
      // 1. Reduced the outward push slightly so they don't fly away
      fgRef.current.d3Force('charge').strength(-250);
      
      // 2. Link distance
      fgRef.current.d3Force('link').distance(80); 
      
      // 3. Pin Root to absolute center
      if (graphData.nodes[0]) {
        graphData.nodes[0].fx = 0; 
        graphData.nodes[0].fy = 0;
      }
      
      // 4. THE FIX: Add a radial gravity well. This gently pulls all nodes back 
      // toward the center (0,0) so they can never overflow the screen boundaries.
      fgRef.current.d3Force('radial', d3.forceRadial(150, 0, 0).strength(0.08));
      
      // 5. Collision to prevent overlapping
      fgRef.current.d3Force('collide', d3.forceCollide().radius((node: any) => (node.val * 0.4) * 6));
    }
  }, [graphData, hasScanned])

  const hoverNeighbors = useMemo(() => {
    if (!hoverNode) return new Set();
    const neighbors = new Set();
    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sourceId === hoverNode.id) neighbors.add(targetId);
      if (targetId === hoverNode.id) neighbors.add(sourceId);
    });
    return neighbors;
  }, [hoverNode, graphData.links]);

  return (
    <div ref={containerRef} className="relative w-full min-w-0 h-[650px] max-w-full rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#0d1117] flex items-center justify-center">
      
      {/* 🟢 STATE 1: IDLE 🟢 */}
      {!isScanning && !hasScanned && (
        <div className="z-10 w-full max-w-md p-8 glass rounded-2xl border border-white/10 bg-[#161b22]/80 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
            <div className="p-3 bg-pnb-maroon/20 rounded-xl border border-pnb-maroon/50">
              <Target className="w-8 h-8 text-pnb-maroon" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Target Designation</h2>
              <p className="text-white/50 text-xs font-mono mt-1">Select root domain for OSINT mapping</p>
            </div>
          </div>

          <form onSubmit={handleStartScan} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/70 uppercase tracking-wider">Root Domain</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <select 
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  className="w-full bg-[#0d1117] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-pnb-maroon focus:ring-1 focus:ring-pnb-maroon appearance-none"
                >
                  {ENTERPRISE_TARGETS.map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-3 px-4 bg-pnb-maroon hover:bg-pnb-maroon/80 text-white text-sm font-bold rounded-lg transition-colors border border-white/10 shadow-[0_0_15px_rgba(128,0,0,0.5)] flex items-center justify-center gap-2"
            >
              <Radar className="w-4 h-4" />
              Initiate Topology Scan
            </button>
          </form>
        </div>
      )}

      {/* 🟢 STATE 2: SCANNING 🟢 */}
      {isScanning && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1117]/90 backdrop-blur-sm">
          <div className="relative flex items-center justify-center w-24 h-24 mb-6">
            <Radar className="absolute w-16 h-16 text-[#4ade80] animate-ping opacity-20" />
            <Radar className="relative w-12 h-12 text-[#4ade80] animate-spin-slow" />
          </div>
          <h2 className="text-[#4ade80] font-bold tracking-[0.2em] uppercase mb-2">Initiating OSINT Sweep</h2>
          <p className="text-white/50 font-mono text-xs max-w-sm text-center animate-pulse">
            Querying Certificate Transparency Logs. Compiling Post-Quantum risk metrics...
          </p>
        </div>
      )}

      {/* 🟢 STATE 3: ANALYZED GRAPH 🟢 */}
      {hasScanned && (
        <>
          <div className="absolute top-6 left-6 z-10 pointer-events-none">
            <h3 className="text-white/90 font-bold text-base tracking-wide">Enterprise Topology</h3>
            <p className="text-white/40 text-[10px] font-mono mt-0.5">Hover nodes to reveal hostnames</p>
          </div>
            
          <div className="absolute top-6 right-6 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-3 pointer-events-auto">
            <div className="flex flex-wrap gap-4 text-xs font-mono text-white/60 bg-[#161b22]/80 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#4ade80]"></span> Safe</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f87171]"></span> Vulnerable</div>
            </div>
            
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 bg-[#161b22]/80 hover:bg-[#161b22] text-white/80 px-4 py-2 rounded-lg border border-white/10 transition-colors text-xs font-bold shadow-lg"
            >
              <ArrowLeft className="w-3 h-3" /> New Scan
            </button>
          </div>

          <div className="absolute bottom-6 left-6 right-6 z-10 flex flex-wrap justify-end gap-3 pointer-events-none">
            <div className="bg-[#161b22]/90 backdrop-blur-md border border-white/10 rounded-lg p-3 min-w-[100px] shadow-lg text-right">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Total Assets</div>
              <div className="text-white font-bold text-xl">{graphData.nodes.length}</div>
            </div>
            <div className="bg-[#161b22]/90 backdrop-blur-md border border-[#4ade80]/20 rounded-lg p-3 min-w-[100px] shadow-lg text-right">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Quantum Safe</div>
              <div className="text-[#4ade80] font-bold text-xl">{graphData.nodes.filter(n => n.color === '#4ade80').length}</div>
            </div>
            <div className="bg-[#161b22]/90 backdrop-blur-md border border-[#f87171]/20 rounded-lg p-3 min-w-[100px] shadow-lg text-right">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">At Risk</div>
              <div className="text-[#f87171] font-bold text-xl">{graphData.nodes.filter(n => n.color === '#f87171').length}</div>
            </div>
          </div>

          <div className="w-full h-full animate-in fade-in duration-1000">
            {graphSize.width > 0 && (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                width={graphSize.width}
                height={graphSize.height}
                backgroundColor="#0d1117"
                
                // THE FIX: Forces the engine to stop moving quickly and snap the camera
                cooldownTicks={150} 
                
                onNodeHover={setHoverNode}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const isHovered = hoverNode === node;
                  const isNeighbor = hoverNeighbors.has(node.id);
                  const isDimmed = hoverNode && !isHovered && !isNeighbor;

                  ctx.globalAlpha = isDimmed ? 0.15 : 1;
                  
                  const baseVal = node.val * 0.4; 
                  const coreRadius = isHovered ? baseVal * 1.5 : baseVal;
                  const haloRadius = coreRadius * 2.5;

                  ctx.beginPath();
                  ctx.arc(node.x, node.y, haloRadius, 0, 2 * Math.PI, false);
                  ctx.fillStyle = `${node.color}${isHovered ? '44' : '22'}`; 
                  ctx.fill();

                  ctx.beginPath();
                  ctx.arc(node.x, node.y, coreRadius, 0, 2 * Math.PI, false);
                  ctx.fillStyle = node.color;
                  ctx.fill();

                  if (globalScale >= 2.5 || isHovered || isNeighbor || node.group === 0) {
                    const fontSize = isHovered ? 13 / globalScale : 10 / globalScale;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
                    ctx.font = `${isHovered ? 'bold ' : ''}${fontSize}px Inter, Sans-Serif`;
                    
                    ctx.fillText(node.name, node.x + haloRadius + (4 / globalScale), node.y);
                  }
                  
                  ctx.globalAlpha = 1; 
                }}
                linkCanvasObjectMode={() => 'after'}
                linkColor={(link: any) => {
                  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                  const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                  const isHoveredLink = hoverNode && (sourceId === hoverNode.id || targetId === hoverNode.id);
                  
                  if (hoverNode && !isHoveredLink) return 'rgba(255, 255, 255, 0.02)'; 
                  if (isHoveredLink) return 'rgba(255, 255, 255, 0.8)';
                  
                  const targetNode = graphData.nodes.find(n => n.id === targetId);
                  if (targetNode?.color === '#f87171') return 'rgba(248, 113, 113, 0.2)';
                  return 'rgba(74, 222, 128, 0.2)';
                }}
                linkWidth={(link: any) => {
                  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                  const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                  return hoverNode && (sourceId === hoverNode.id || targetId === hoverNode.id) ? 2 : 0.5;
                }}
                
                // Auto-center camera when the nodes settle
                onEngineStop={() => {
                  if (fgRef.current && hasScanned) fgRef.current.zoomToFit(400, 80); // Added more padding (80)
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}