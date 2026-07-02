import { useState, useEffect } from 'react';
import { Ruler, Square, Trash2, X, MousePointer } from 'lucide-react';

interface Measurement {
  id: string;
  type: 'distance' | 'area';
  points: [number, number][];
  value: number;
  label: string;
  color: string;
}

interface MeasurementToolProps {
  enabled: boolean;
  mode: 'distance' | 'area' | 'none';
  onModeChange: (mode: 'distance' | 'area' | 'none') => void;
  onMapClick: (lat: number, lng: number) => void;
  measurements: Measurement[];
  onMeasurementsChange: (measurements: Measurement[]) => void;
}

export function calculateDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateArea(points: [number, number][]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  area = Math.abs(area) / 2;
  const R = 6371000;
  const midLat = points.reduce((s, p) => s + p[0], 0) / points.length * Math.PI / 180;
  const scale = R * Math.PI / 180;
  return area * (scale ** 2) * Math.cos(midLat);
}

export default function MeasurementTool({
  enabled, mode, onModeChange, measurements, onMeasurementsChange,
}: MeasurementToolProps) {
  const [pendingPoints, setPendingPoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!enabled) { setPendingPoints([]); }
  }, [enabled]);

  const clearAll = () => { onMeasurementsChange([]); setPendingPoints([]); };
  const removeMeasurement = (id: string) => {
    onMeasurementsChange(measurements.filter(m => m.id !== id));
  };

  if (!enabled && measurements.length === 0) return null;

  return (
    <div className="absolute top-2 right-2 z-[1000] space-y-1">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-1.5 text-xs">
        <div className="flex gap-0.5">
          <button onClick={() => onModeChange(mode === 'distance' ? 'none' : 'distance')}
            className={`p-1.5 rounded ${mode === 'distance' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`} title="Measure distance">
            <Ruler size={14} />
          </button>
          <button onClick={() => onModeChange(mode === 'area' ? 'none' : 'area')}
            className={`p-1.5 rounded ${mode === 'area' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`} title="Measure area">
            <Square size={14} />
          </button>
          {mode !== 'none' && (
            <button onClick={() => onModeChange('none')}
              className="p-1.5 rounded text-gray-600 hover:bg-gray-100" title="Done">
              <MousePointer size={14} />
            </button>
          )}
        </div>
        {mode !== 'none' && (
          <div className="px-1.5 pb-1 text-[10px] text-gray-500">
            {mode === 'distance' ? 'Click two points to measure distance' : 'Click 3+ points to measure area'}
            {pendingPoints.length > 0 && ` (${pendingPoints.length} point${pendingPoints.length > 1 ? 's' : ''})`}
          </div>
        )}
      </div>
      {measurements.length > 0 && (
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-1.5 max-h-40 overflow-y-auto min-w-[130px]">
          <div className="flex items-center justify-between px-1 pb-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-[10px] font-medium text-gray-500">{measurements.length} measurement{measurements.length > 1 ? 's' : ''}</span>
            <button onClick={clearAll} className="text-red-500 hover:bg-red-50 p-0.5 rounded" title="Clear all"><Trash2 size={10} /></button>
          </div>
          {measurements.map(m => (
            <div key={m.id} className="flex items-center justify-between px-1 py-0.5 text-[10px] hover:bg-gray-50 group">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                <span>{m.type === 'distance' ? '📏' : '📐'} {m.label}</span>
              </div>
              <button onClick={() => removeMeasurement(m.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { Measurement };
