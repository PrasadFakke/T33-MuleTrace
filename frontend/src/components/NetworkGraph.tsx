import React, { useRef, useEffect, useState, useMemo } from 'react';
import { NetworkResponse, NetworkNode, NetworkEdge } from '../api';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, ShieldAlert, Users, Building, Globe, ArrowRight } from 'lucide-react';

interface NetworkGraphProps {
  data: NetworkResponse;
  onSelectNode?: (node: NetworkNode) => void;
}

interface Point {
  x: number;
  y: number;
}

interface RenderNode extends NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, onSelectNode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<RenderNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<RenderNode | null>(null);
  const [edgeFilter, setEdgeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');

  // Compute node positions with radial bipartite layout
  const nodes = useMemo(() => {
    if (!data.nodes || data.nodes.length === 0) return [];

    const focalNode = data.nodes.find(n => n.is_focal);
    const cpNodes = data.nodes.filter(n => n.type === 'COUNTERPARTY');
    const secNodes = data.nodes.filter(n => n.type === 'SECONDARY_ACCOUNT');

    const result: RenderNode[] = [];
    const centerX = 400;
    const centerY = 300;

    // 1. Focal account at center
    if (focalNode) {
      result.push({
        ...focalNode,
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: 28,
      });
    }

    // 2. Counterparties in an inner circle
    const cpCount = cpNodes.length;
    const cpRadius = Math.min(240, Math.max(160, cpCount * 12));
    cpNodes.forEach((cp, i) => {
      const angle = (2 * Math.PI * i) / (cpCount || 1) - Math.PI / 2;
      result.push({
        ...cp,
        x: centerX + cpRadius * Math.cos(angle),
        y: centerY + cpRadius * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: cp.is_reciprocal ? 18 : 14,
      });
    });

    // 3. Secondary Accounts in an outer orbit
    const secCount = secNodes.length;
    const secRadius = cpRadius + 140;
    secNodes.forEach((sec, i) => {
      const angle = (2 * Math.PI * i) / (secCount || 1) + Math.PI / 4;
      result.push({
        ...sec,
        x: centerX + secRadius * Math.cos(angle),
        y: centerY + secRadius * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: 20,
      });
    });

    return result;
  }, [data.nodes]);

  // Handle Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear to crisp white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Save state for transform
    ctx.save();
    ctx.translate(pan.x + rect.width / 2, pan.y + rect.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-400, -300); // Center at layout coordinate origin

    // Draw Subtle Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x <= 800; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y <= 600; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // Node lookup map
    const nodeMap = new Map<string, RenderNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    // Draw Edges
    const visibleEdges = data.edges.filter(e => {
      if (edgeFilter === 'ALL') return true;
      if (edgeFilter === 'CREDIT') return e.type === 'CREDIT';
      if (edgeFilter === 'DEBIT') return e.type === 'DEBIT';
      return true;
    });

    visibleEdges.forEach(edge => {
      const src = nodeMap.get(edge.source);
      const dst = nodeMap.get(edge.target);
      if (!src || !dst) return;

      const isCredit = edge.type === 'CREDIT';
      const isDebit = edge.type === 'DEBIT';
      const isPeer = edge.type === 'PEER_FLOW';

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);

      // Edge style
      if (isCredit) {
        ctx.strokeStyle = '#10b981cc'; // Emerald for incoming credit
      } else if (isDebit) {
        ctx.strokeStyle = '#2563ebcc'; // Royal Blue for outgoing debit
      } else {
        ctx.strokeStyle = '#818cf8cc'; // Indigo for peer
      }

      ctx.lineWidth = Math.min(4, Math.max(1.5, Math.log10(edge.amount + 1) / 1.5));
      ctx.stroke();

      // Draw directional arrow midway
      const midX = (src.x + dst.x) / 2;
      const midY = (src.y + dst.y) / 2;
      const angle = Math.atan2(dst.y - src.y, dst.x - src.x);

      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      ctx.fillStyle = isCredit ? '#10b981' : isDebit ? '#2563eb' : '#818cf8';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Draw Nodes
    nodes.forEach(node => {
      ctx.save();
      const isSelected = selectedNode?.id === node.id;

      // Outer glow for selected
      if (isSelected) {
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 18;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);

      if (node.is_focal) {
        // Focal Account Node: Royal Blue / Red with glowing ring
        ctx.fillStyle = node.risk_score && node.risk_score >= 80 ? '#ef4444' : '#2563eb';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.stroke();
      } else if (node.type === 'COUNTERPARTY') {
        // Counterparty
        if (node.category === 'FOREIGN') {
          ctx.fillStyle = '#7c3aed'; // Violet
        } else if (node.category === 'EMPLOYER') {
          ctx.fillStyle = '#0284c7'; // Sky
        } else if (node.category === 'BRANCH') {
          ctx.fillStyle = '#d97706'; // Amber
        } else {
          ctx.fillStyle = node.is_reciprocal ? '#f59e0b' : '#64748b'; // Gold or slate
        }
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#2563eb' : '#ffffff';
        ctx.lineWidth = node.is_reciprocal ? 2.5 : 2;
        ctx.stroke();
      } else {
        // Secondary Account
        ctx.fillStyle = node.risk_score && node.risk_score >= 60 ? '#ef4444' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.restore();

      // Node Label with clean dark text
      ctx.font = node.is_focal ? 'bold 11px Inter, sans-serif' : '500 10px Inter, sans-serif';
      ctx.fillStyle = node.is_focal ? '#0f172a' : '#475569';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.replace('\n', ' - '), node.x, node.y + node.radius + 13);
    });

    ctx.restore();
  }, [nodes, data.edges, zoom, pan, selectedNode, edgeFilter]);

  // Pointer interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.x;
    const clickY = e.clientY - rect.y;

    // Transform click to world coordinate
    const worldX = (clickX - pan.x - rect.width / 2) / zoom + 400;
    const worldY = (clickY - pan.y - rect.height / 2) / zoom + 300;

    // Check hit test against nodes
    const hit = nodes.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });

    if (hit) {
      setSelectedNode(hit);
      setDraggedNode(hit);
      if (onSelectNode) onSelectNode(hit);
    } else {
      setIsDraggingPan(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.x - pan.x - rect.width / 2) / zoom + 400;
      const worldY = (e.clientY - rect.y - pan.y - rect.height / 2) / zoom + 300;
      draggedNode.x = worldX;
      draggedNode.y = worldY;
      // Trigger re-render
      setPan({ ...pan });
    } else if (isDraggingPan) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingPan(false);
    setDraggedNode(null);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  return (
    <div className="relative w-full h-[540px] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" ref={containerRef}>
      {/* Top Overlay Controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs">
          <span className="text-slate-500 font-mono font-medium">Bipartite Network:</span>
          <span className="text-blue-600 font-bold font-mono">{nodes.length} Nodes</span>
          <span className="text-slate-300">|</span>
          <span className="text-emerald-600 font-bold font-mono">{data.edges.length} Edges</span>
        </div>

        {/* Edge Filter Toggle */}
        <div className="flex bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm p-0.5 text-xs">
          <button
            onClick={() => setEdgeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${edgeFilter === 'ALL' ? 'bg-blue-600 text-white font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All Flows
          </button>
          <button
            onClick={() => setEdgeFilter('CREDIT')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${edgeFilter === 'CREDIT' ? 'bg-emerald-600 text-white font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Inflow (Credit)
          </button>
          <button
            onClick={() => setEdgeFilter('DEBIT')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${edgeFilter === 'DEBIT' ? 'bg-blue-600 text-white font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Outflow (Debit)
          </button>
        </div>
      </div>

      {/* Top Right Zoom / Action Tools */}
      <div className="absolute top-3 right-3 z-10 flex items-center space-x-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Bottom Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-3 text-xs bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 shadow-md">
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-xs bg-blue-600 ring-2 ring-blue-500/30"></span>
          <span className="text-slate-700 font-semibold">Focal Account</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 ring-1 ring-amber-400/50"></span>
          <span className="text-slate-700 font-semibold">Reciprocal Loop</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-500"></span>
          <span className="text-slate-700 font-semibold">Standard CP</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-violet-600"></span>
          <span className="text-slate-700 font-semibold">Foreign CP</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-sky-600"></span>
          <span className="text-slate-700 font-semibold">Employer CP</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span>
          <span className="text-slate-700 font-semibold">Peer Account</span>
        </div>
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNode && (
        <div className="absolute top-14 right-3 z-20 w-80 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-xl animate-fade-in text-sm">
          <div className="flex justify-between items-start mb-3 pb-2.5 border-b border-slate-100">
            <div>
              <span className="text-xs uppercase tracking-wider text-blue-600 font-bold">
                {selectedNode.type}
              </span>
              <h4 className="font-bold text-slate-900 text-base">{selectedNode.id}</h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-slate-700 text-xs px-2.5 py-1 rounded-md bg-slate-100 font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5 text-slate-700">
            {selectedNode.type === 'ACCOUNT' || selectedNode.type === 'SECONDARY_ACCOUNT' ? (
              <>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Risk Score:</span>
                  <span className={`font-bold text-sm ${
                    (selectedNode.risk_score || 0) >= 80 ? 'text-rose-600' :
                    (selectedNode.risk_score || 0) >= 60 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {selectedNode.risk_score || 'N/A'}/100 ({selectedNode.risk_level || 'LOW'})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Primary Pattern:</span>
                  <span className="text-slate-900 font-semibold">{selectedNode.pattern || 'Standard Activity'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Classification:</span>
                  <span className="text-blue-600 font-semibold">{selectedNode.category || 'STANDARD'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Total Volume:</span>
                  <span className="text-slate-900 font-semibold">₹{selectedNode.total_amount?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Transactions:</span>
                  <span className="text-slate-900 font-semibold">{selectedNode.tx_count || 0}</span>
                </div>
                {selectedNode.is_reciprocal && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center space-x-2 shadow-2xs">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Bidirectional Credit & Debit Flow Detected</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
