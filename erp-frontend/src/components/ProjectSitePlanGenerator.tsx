import { useState, useRef } from 'react';
import { projectGeometriesApi } from '../services/api';
import { X, Upload, Download, FileSpreadsheet, FileText, AlertCircle, CheckCircle, Grid3x3 } from 'lucide-react';
import { exportCSV, parseCSV } from '../utils/csv';
import * as XLSX from 'xlsx';

interface Props {
  projectId: string;
  onClose: () => void;
  onGenerated: () => void;
}

interface BuildingParam {
  building_name: string;
  latitude: number;
  longitude: number;
  width_m: number;
  depth_m: number;
  rotation_deg: number;
  floors: number;
  units_per_floor: number;
  sales_status: string;
  execution_progress: number;
}

function metersToDegrees(lat: number, lng: number, w: number, d: number) {
  const latPerM = 1 / 111320;
  const lngPerM = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  return { wDeg: w * lngPerM, dDeg: d * latPerM };
}

function rotatePoint(cx: number, cy: number, x: number, y: number, angleDeg: number) {
  const rad = angleDeg * Math.PI / 180;
  const dx = x - cx, dy = y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function makeRectangle(cx: number, cy: number, wDeg: number, dDeg: number, rotDeg: number): [number, number][][] {
  const pts = [
    { x: cx - wDeg / 2, y: cy - dDeg / 2 },
    { x: cx + wDeg / 2, y: cy - dDeg / 2 },
    { x: cx + wDeg / 2, y: cy + dDeg / 2 },
    { x: cx - wDeg / 2, y: cy + dDeg / 2 },
  ];
  const rotated = pts.map(p => rotatePoint(cx, cy, p.x, p.y, rotDeg));
  return [rotated.map((p): [number, number] => [p.y, p.x])];
}

function generateGeoJSON(b: BuildingParam): {
  building: Record<string, unknown>;
  floors: Record<string, unknown>[];
  units: Record<string, unknown>[][];
} {
  const { wDeg, dDeg } = metersToDegrees(b.latitude, b.longitude, b.width_m, b.depth_m);
  const cx = b.longitude, cy = b.latitude;

  const buildingCoords = makeRectangle(cx, cy, wDeg, dDeg, b.rotation_deg);
  const buildingGeo = {
    type: 'Polygon',
    coordinates: [buildingCoords[0].map((p): [number, number] => [p[1], p[0]])],
  };

  const floors: Record<string, unknown>[] = [];
  const units: Record<string, unknown>[][] = [];

  for (let f = 0; f < b.floors; f++) {
    const shrink = 1 - f * 0.02;
    const fw = wDeg * shrink;
    const fd = dDeg * shrink;
    const offsetNorth = f * dDeg * 0.003;
    const fc = { x: cx, y: cy + offsetNorth };
    const floorCoords = makeRectangle(fc.x, fc.y, fw, fd, b.rotation_deg);
    const floorGeo = {
      type: 'Polygon',
      coordinates: [floorCoords[0].map((p): [number, number] => [p[1], p[0]])],
    };

    floors.push({
      project_id: b.building_name,
      geometry_type: 'floor',
      label_en: `Floor ${f + 1}`,
      label_ar: `الدور ${f + 1}`,
      geometry: floorGeo,
      properties: { building: b.building_name, level: f + 1, area: b.width_m * b.depth_m / b.floors },
      level: 2,
      sort_order: f,
    });

    const upf = Math.max(0, b.units_per_floor);
    if (upf > 0) {
      const cols = Math.ceil(Math.sqrt(upf * (b.width_m / b.depth_m)));
      const rows = Math.ceil(upf / cols);
      const unitFloors: Record<string, unknown>[] = [];
      let uIdx = 0;
      for (let r = 0; r < rows && uIdx < upf; r++) {
        for (let c = 0; c < cols && uIdx < upf; c++) {
          const ux = fc.x - fw / 2 + (c + 0.5) * (fw / cols);
          const uy = fc.y - fd / 2 + (r + 0.5) * (fd / rows);
          const uw = fw / cols * 0.85;
          const ud = fd / rows * 0.85;
          const unitCoords = makeRectangle(ux, uy, uw, ud, b.rotation_deg);
          const unitGeo = {
            type: 'Polygon',
            coordinates: [unitCoords[0].map((p): [number, number] => [p[1], p[0]])],
          };
          unitFloors.push({
            project_id: b.building_name,
            geometry_type: 'unit',
            label_en: `${b.building_name}-${String(f + 1).padStart(2, '0')}${String(uIdx + 1).padStart(2, '0')}`,
            label_ar: `وحدة ${uIdx + 1}`,
            geometry: unitGeo,
            properties: {
              building: b.building_name, floor: f + 1,
              unit_number: uIdx + 1,
              area: (b.width_m * b.depth_m / b.floors) / upf,
              sales_status: b.sales_status || 'available',
              execution_progress: b.execution_progress || 0,
            },
            level: 3,
            sort_order: uIdx,
          });
          uIdx++;
        }
      }
      units.push(unitFloors);
    }
  }

  return {
    building: {
      project_id: b.building_name,
      geometry_type: 'building',
      label_en: b.building_name,
      label_ar: b.building_name,
      geometry: buildingGeo,
      properties: { area: b.width_m * b.depth_m, floors: b.floors, sales_status: b.sales_status, execution_progress: b.execution_progress },
      level: 1,
      sort_order: 0,
    },
    floors,
    units,
  };
}

const TEMPLATE_COLS = ['building_name', 'latitude', 'longitude', 'width_m', 'depth_m', 'rotation_deg', 'floors', 'units_per_floor', 'sales_status', 'execution_progress'];
const TEMPLATE_EXAMPLE = {
  building_name: 'Example Building A',
  latitude: 24.75,
  longitude: 46.75,
  width_m: 50,
  depth_m: 30,
  rotation_deg: 0,
  floors: 5,
  units_per_floor: 4,
  sales_status: 'available',
  execution_progress: 65,
};

export default function ProjectSitePlanGenerator({ projectId, onClose, onGenerated }: Props) {
  const [tab, setTab] = useState<'csv' | 'dxf'>('csv');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; total: number; errors: string[] } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const dxfRef = useRef<HTMLInputElement>(null);
  const [dxfEntities, setDxfEntities] = useState<number>(0);
  const [dxfLayers, setDxfLayers] = useState<string[]>([]);

  function downloadTemplate() {
    const cols = TEMPLATE_COLS.map(c => ({ key: c, label: c }));
    exportCSV([TEMPLATE_EXAMPLE as any], 'site_plan_template.csv', cols);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrors([]);
    setResult(null);
    try {
      let rows: Record<string, string>[] = [];
      if (file.name.endsWith('.csv')) {
        rows = parseCSV(await file.text());
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      }
      setParsedRows(rows);
    } catch {
      setErrors(['Failed to parse file. Ensure it is a valid CSV or Excel file.']);
    }
  }

  async function generateAll() {
    setImporting(true);
    setProgress(0);
    const errorsList: string[] = [];
    let ok = 0;
    const total = parsedRows.length;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      try {
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        const w = parseFloat(row.width_m);
        const d = parseFloat(row.depth_m);
        if (isNaN(lat) || isNaN(lng) || isNaN(w) || isNaN(d) || w <= 0 || d <= 0) {
          errorsList.push(`Row ${i + 2}: Invalid numeric value for latitude/longitude/width/depth`);
          continue;
        }
        const param: BuildingParam = {
          building_name: row.building_name || `Building ${i + 1}`,
          latitude: lat,
          longitude: lng,
          width_m: w,
          depth_m: d,
          rotation_deg: parseFloat(row.rotation_deg) || 0,
          floors: Math.max(1, parseInt(row.floors) || 1),
          units_per_floor: parseInt(row.units_per_floor) || 0,
          sales_status: row.sales_status || 'available',
          execution_progress: Math.min(100, Math.max(0, parseInt(row.execution_progress) || 0)),
        };

        const generated = generateGeoJSON(param);
        const building = { ...generated.building, project_id: projectId };
        await projectGeometriesApi.upsert(building as any);

        for (const floor of generated.floors) {
          await projectGeometriesApi.upsert({ ...floor, project_id: projectId } as any);
        }

        for (const unitFloor of generated.units) {
          for (const unit of unitFloor) {
            await projectGeometriesApi.upsert({ ...unit, project_id: projectId } as any);
          }
        }

        ok++;
      } catch (err: any) {
        errorsList.push(`Row ${i + 2}: ${err?.message || 'Generation failed'}`);
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResult({ ok, total, errors: errorsList });
    setImporting(false);
  }

  async function handleDXFUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrors([]);
    setResult(null);
    try {
      const { default: DxfParser } = await import('dxf-parser');
      const parser = new DxfParser();
      const text = await file.text();
      const dxf = parser.parseSync(text);
      if (!dxf) { setErrors(['Failed to parse DXF file.']); return; }
      const layers = Object.keys(dxf.tables?.layer?.layers || {});
      setDxfLayers(layers);
      setDxfEntities(dxf.entities.length);
      setParsedRows([]);

      let ok = 0;
      const errorsList: string[] = [];
      for (const entity of dxf.entities) {
        try {
          let coords: number[][][] = [];
          if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            const verts = (entity as any).vertices || [];
            if (verts.length < 3) continue;
            const pts = verts.map((v: any) => [v.y, v.x] as [number, number]);
            if ((pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) {
              pts.push([pts[0][0], pts[0][1]]);
            }
            coords = [pts];
          } else if (entity.type === 'LINE') {
            const e = entity as any;
            coords = [[[e.start.y, e.start.x] as [number, number], [e.end.y, e.end.x] as [number, number]]];
          }

          if (coords.length > 0 && coords[0].length >= 3) {
            const geo = {
              type: 'Polygon' as const,
              coordinates: [coords[0].map(([lat, lng]) => [lng, lat])],
            };
            await projectGeometriesApi.upsert({
              project_id: projectId,
              geometry_type: 'building',
              label_en: `DXF ${(entity as any).layer || 'Layer'} ${ok + 1}`,
              geometry: geo as any,
              properties: { source: 'dxf', layer: (entity as any).layer || '' },
              level: 1,
              sort_order: ok,
            } as any);
            ok++;
          }
        } catch {
          // skip invalid entities
        }
      }
      setResult({ ok, total: dxf.entities.length, errors: errorsList });
    } catch {
      setErrors(['Failed to parse DXF file. Ensure it is a valid DXF (text) format.']);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <div>
            <h3 className="text-lg font-semibold">Generate Site Plan</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Auto-generate building geometries from parameters or DXF files
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'csv' ? '' : 'opacity-60 hover:opacity-100'}`}
            style={{ borderColor: tab === 'csv' ? 'var(--color-primary)' : 'transparent', color: tab === 'csv' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
            onClick={() => setTab('csv')}>
            <FileSpreadsheet size={14} className="inline mr-1" /> From Excel / CSV
          </button>
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'dxf' ? '' : 'opacity-60 hover:opacity-100'}`}
            style={{ borderColor: tab === 'dxf' ? 'var(--color-primary)' : 'transparent', color: tab === 'dxf' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
            onClick={() => setTab('dxf')}>
            <FileText size={14} className="inline mr-1" /> From DXF (AutoCAD)
          </button>
        </div>

        <div className="modal-body space-y-4">
          {tab === 'csv' && (
            <>
              <div className="flex items-center gap-2">
                <button className="btn-sm btn-secondary" onClick={downloadTemplate}>
                  <Download size={14} /> Download Template
                </button>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  CSV with building parameters (name, lat, lng, width, depth, floors, units...)
                </span>
              </div>

              <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}>
                <strong>Template columns:</strong> building_name, latitude, longitude, width_m, depth_m, rotation_deg, floors, units_per_floor, sales_status, execution_progress
              </div>

              <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                {parsedRows.length === 0 ? (
                  <>
                    <Upload size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Upload CSV or Excel file with building parameters</p>
                    <button className="btn-primary btn-sm" onClick={() => fileRef.current?.click()}>Select File</button>
                  </>
                ) : (
                  <div className="text-start">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{parsedRows.length} buildings detected</p>
                      <button className="btn-sm btn-secondary" onClick={() => fileRef.current?.click()}>Re-upload</button>
                    </div>
                    <div className="table-wrap max-h-[200px] overflow-auto">
                      <table className="table text-xs">
                        <thead><tr>{Object.keys(parsedRows[0] || {}).map(h => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                          {parsedRows.slice(0, 8).map((row, i) => (
                            <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="truncate max-w-[120px]">{v}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                  {errors.map((e, i) => <p key={i} className="flex items-center gap-1"><AlertCircle size={12} /> {e}</p>)}
                </div>
              )}

              {importing && (
                <div>
                  <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
                  <p className="text-xs mt-1 text-center" style={{ color: 'var(--color-text-secondary)' }}>Generating... {progress}%</p>
                </div>
              )}

              {result && (
                <div className="p-3 rounded-lg text-sm" style={{
                  backgroundColor: result.errors.length > 0 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
                }}>
                  <div className="flex items-center gap-2">
                    {result.errors.length > 0 ? <AlertCircle size={16} style={{ color: '#d97706' }} /> : <CheckCircle size={16} style={{ color: '#16a34a' }} />}
                    <span className="font-medium">{result.ok} / {result.total} buildings generated</span>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-2 max-h-[120px] overflow-y-auto text-xs space-y-0.5" style={{ color: '#dc2626' }}>
                      {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button className="btn-primary btn-sm" onClick={() => { if (result.ok > 0) onGenerated(); onClose(); }}>Done</button>
                    <button className="btn-secondary btn-sm" onClick={() => { setResult(null); setParsedRows([]); }}>Generate More</button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'dxf' && (
            <>
              <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 8%, transparent)' }}>
                <strong>Note:</strong> Upload DXF (text format) files from AutoCAD. Closed polylines are imported as building footprints. Each entity is stored as a separate building geometry.
              </div>

              <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
                <input ref={dxfRef} type="file" accept=".dxf" onChange={handleDXFUpload} className="hidden" />
                {dxfEntities === 0 ? (
                  <>
                    <FileText size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Upload a DXF file</p>
                    <button className="btn-primary btn-sm" onClick={() => dxfRef.current?.click()}>Select DXF</button>
                  </>
                ) : (
                  <div>
                    <CheckCircle size={24} className="mx-auto mb-2" style={{ color: '#16a34a' }} />
                    <p className="text-sm font-medium">{dxfEntities} entities found</p>
                    {dxfLayers.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Layers: {dxfLayers.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {result && (
                <div className="p-3 rounded-lg text-sm" style={{
                  backgroundColor: result.errors.length > 0 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
                }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} style={{ color: '#16a34a' }} />
                    <span className="font-medium">{result.ok} / {result.total} entities imported as buildings</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="btn-primary btn-sm" onClick={() => { if (result.ok > 0) onGenerated(); onClose(); }}>Done</button>
                    <button className="btn-secondary btn-sm" onClick={() => { setResult(null); setDxfEntities(0); setDxfLayers([]); }}>Import More</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {tab === 'csv' && parsedRows.length > 0 && !result && !importing && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={generateAll} disabled={errors.length > 0}>
              <Grid3x3 size={14} /> Generate {parsedRows.length} Buildings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
