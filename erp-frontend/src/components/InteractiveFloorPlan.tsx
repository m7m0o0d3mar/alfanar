import { useState, useRef, useCallback } from 'react';
import { Info, Maximize2, Minimize2, Crosshair, ZoomIn, ZoomOut } from 'lucide-react';

interface RoomHotspot {
  id: string;
  name_en: string;
  name_ar?: string;
  room_type: string;
  area_sqm?: number;
  polygon: [number, number][];
  color?: string;
  status?: string;
  unit_code?: string;
  price?: number;
  unit_id?: string;
}

interface InteractiveFloorPlanProps {
  imageUrl: string;
  hotspots: RoomHotspot[];
  width?: number;
  height?: number;
  className?: string;
  onUnitClick?: (unitId: string) => void;
}

const ROOM_COLORS: Record<string, string> = {
  bedroom: '#3b82f6', bathroom: '#06b6d4', kitchen: '#f59e0b', living: '#10b981',
  dining: '#8b5cf6', office: '#ec4899', storage: '#6b7280', balcony: '#14b8a6',
  corridor: '#9ca3af', utility: '#f97316', default: '#6366f1',
};

export default function InteractiveFloorPlan({
  imageUrl, hotspots, className = '', onUnitClick,
}: InteractiveFloorPlanProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<RoomHotspot | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.5, Math.min(5, prev * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { setDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const getRoomColor = (hotspot: RoomHotspot) => {
    return hotspot.color || ROOM_COLORS[hotspot.room_type] || ROOM_COLORS.default;
  };

  const roomTypeLabels: Record<string, string> = {
    bedroom: 'Bedroom', bathroom: 'Bathroom', kitchen: 'Kitchen', living: 'Living Room',
    dining: 'Dining Room', office: 'Office', storage: 'Storage', balcony: 'Balcony',
    corridor: 'Corridor', utility: 'Utility Room',
  };

  const hotspotCenter = (polygon: [number, number][]) => {
    const x = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
    const y = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
    return { x, y };
  };

  return (
    <div className={`relative ${fullscreen ? 'fixed inset-0 z-[9999] bg-black' : ''} ${className}`}
      onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Controls */}
      <div className={`flex items-center gap-1 p-1.5 ${fullscreen ? 'absolute top-2 right-2 z-10' : ''}`}>
        <div className="flex bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
          <button className="p-1.5 hover:bg-gray-100 rounded-l text-gray-600" onClick={() => setScale(s => Math.min(5, s * 1.3))} title="Zoom in"><ZoomIn size={14} /></button>
          <span className="px-1.5 py-1 text-[10px] font-mono text-gray-500 flex items-center">{Math.round(scale * 100)}%</span>
          <button className="p-1.5 hover:bg-gray-100 rounded-r text-gray-600" onClick={() => setScale(s => Math.max(0.5, s / 1.3))} title="Zoom out"><ZoomOut size={14} /></button>
          <span className="w-px bg-gray-200 mx-0.5" />
          <button className="p-1.5 hover:bg-gray-100 text-gray-600" onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} title="Reset"><Crosshair size={14} /></button>
        </div>
        <button className={`p-1.5 rounded-lg shadow-lg ${fullscreen ? 'bg-white/90 hover:bg-white text-gray-600' : 'bg-white/90 hover:bg-white'}`}
          onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Exit' : 'Fullscreen'}>
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border cursor-grab active:cursor-grabbing"
        style={{ borderColor: 'var(--color-border)', height: fullscreen ? '100%' : 400 }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0', transition: dragging ? 'none' : 'transform 0.1s' }}>
          <img ref={imgRef} src={imageUrl} alt="Floor plan" className="max-w-none" draggable={false} style={{ opacity: 0.85 }} />

          {/* Hotspot polygons */}
          <svg className="absolute inset-0 pointer-events-none" style={{ top: 0, left: 0, width: imgRef.current?.width || 800, height: imgRef.current?.height || 600 }}>
            {hotspots.map(h => {
              const pts = h.polygon.map(p => `${p[0]},${p[1]}`).join(' ');
              const isHovered = hovered === h.id;
              const color = getRoomColor(h);
              return (
                <g key={h.id}>
                  <polygon
                    points={pts} fill={`${color}33`} stroke={isHovered ? '#fff' : color}
                    strokeWidth={isHovered ? 3 : 1.5} className="pointer-events-auto cursor-pointer transition-all"
                    onMouseEnter={() => setHovered(h.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={(e) => { e.stopPropagation(); setSelected(h); }}
                  />
                  {isHovered && (
                    <text
                      x={hotspotCenter(h.polygon).x} y={hotspotCenter(h.polygon).y}
                      textAnchor="middle" fill="white" fontSize="11" fontWeight="600"
                      style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                      {h.name_en}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {dragging && <div className="absolute inset-0 bg-transparent z-10" />}
      </div>

      {/* Hotspot info panel */}
      {selected && (
        <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: getRoomColor(selected), background: `${getRoomColor(selected)}08` }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: getRoomColor(selected) }} />
              <h4 className="text-sm font-semibold">{selected.name_en}</h4>
            </div>
            <button className="p-0.5 hover:opacity-60" onClick={() => setSelected(null)}><Info size={12} /></button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-xs">
            <div><span className="text-gray-500">Type:</span> <span className="capitalize">{roomTypeLabels[selected.room_type] || selected.room_type}</span></div>
            {selected.area_sqm != null && <div><span className="text-gray-500">Area:</span> {selected.area_sqm} m²</div>}
            {selected.unit_code && <div><span className="text-gray-500">Unit:</span> {selected.unit_code}</div>}
            {selected.price != null && <div><span className="text-gray-500">Price:</span> {selected.price.toLocaleString()} SAR</div>}
            {selected.status && <div><span className="text-gray-500">Status:</span> <span className="capitalize">{selected.status}</span></div>}
          </div>
          {selected.unit_id && onUnitClick && (
            <button className="btn-primary btn-xs mt-2 w-full text-center" onClick={() => onUnitClick(selected.unit_id!)}>
              View Unit Details
            </button>
          )}
        </div>
      )}
    </div>
  );
}
