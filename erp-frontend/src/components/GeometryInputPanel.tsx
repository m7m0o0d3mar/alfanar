import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Grid3x3, Type, Copy, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { geometryImportsApi } from '../services/mapsApi';
import { projectGeometriesApi } from '../services/api';
import L from 'leaflet';

async function autoGenerateUnits(projectId: string, mode: 'append' | 'replace' = 'append'): Promise<number> {
  try {
    const { data: geoms } = await supabase.from('project_geometries').select('id, geometry, label_en, project_id')
      .eq('project_id', projectId).in('geometry_type', ['site', 'building', 'floor']);
    if (!geoms || geoms.length === 0) { console.warn('autoGenerateUnits: no geometries found for', projectId); return 0; }
    const unitRows: Record<string, unknown>[] = [];
    for (const g of geoms) {
      if (!g.geometry) continue;
      const prefix = g.label_en ? g.label_en.slice(0, 6).replace(/[^a-zA-Z0-9_]/g, '') : 'U';
      const generated = generateUnitsFromGeometry(g.geometry, prefix, 2, 2);
      for (const u of generated) {
        const g = u.geometry as any;
        const coords = g?.coordinates?.[0];
        let lat: string | null = null;
        let lng: string | null = null;
        if (coords?.length >= 4) {
          lat = String(coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length);
          lng = String(coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length);
        }
        unitRows.push({
          unit_code: (u.label_en || `U-${unitRows.length + 1}`) as string,
          unit_type: 'apartment',
          geometry: JSON.stringify(g),
          status: 'available',
          is_active: 'true',
          lat,
          lng,
        });
      }
    }
    if (unitRows.length === 0) return 0;
    const { data: count, error } = await supabase.rpc('generate_project_units', {
      p_project_id: projectId,
      p_unit_data: unitRows,
      p_mode: mode,
    });
    if (error) { console.error('generate_project_units RPC:', error); return 0; }
    return (count as number) || 0;
  } catch (err) { console.error('autoGenerateUnits error:', err); return 0; }
}

function generateUnitsFromGeometry(geometry: any, labelPrefix: string, cols = 4, rows = 3): Record<string, unknown>[] {
  try {
    const bounds = L.geoJSON(geometry).getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const latStep = (ne.lat - sw.lat) / rows;
    const lngStep = (ne.lng - sw.lng) / cols;
    const units: Record<string, unknown>[] = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        idx++;
        const unitPolygon = {
          type: 'Polygon',
          coordinates: [[
            [sw.lng + c * lngStep, sw.lat + r * latStep],
            [sw.lng + (c + 1) * lngStep, sw.lat + r * latStep],
            [sw.lng + (c + 1) * lngStep, sw.lat + (r + 1) * latStep],
            [sw.lng + c * lngStep, sw.lat + (r + 1) * latStep],
            [sw.lng + c * lngStep, sw.lat + r * latStep],
          ]],
        };
        units.push({
          geometry_type: 'unit',
          label_en: `${labelPrefix}-${String(idx).padStart(3, '0')}`,
          geometry: unitPolygon,
          level: 3,
          sort_order: idx,
          status: 'active',
          properties: { generated: true, col: c + 1, row: r + 1 },
        });
      }
    }
    return units;
  } catch {
    return [];
  }
}

interface Props {
  projectId: string;
  parentId?: string;
  targetLevel: 'site' | 'building' | 'floor' | 'unit';
  onClose: () => void;
  onImported: () => void;
  existingGeometries?: { id: string; label_en?: string; label_ar?: string; geometry_type: string }[];
}

function isValidGeoJSON(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.type === 'FeatureCollection') return Array.isArray(obj.features) && obj.features.length > 0;
  if (obj.type === 'Feature') return !!obj.geometry;
  return ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(obj.type);
}

function coordsToGeoJSON(lat: number, lng: number, widthMeters: number, heightMeters: number): any {
  const latPerM = 1 / 111320;
  const lngPerM = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const w = widthMeters * lngPerM / 2;
  const h = heightMeters * latPerM / 2;
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - w, lat - h],
      [lng + w, lat - h],
      [lng + w, lat + h],
      [lng - w, lat + h],
      [lng - w, lat - h],
    ]],
  };
}

export default function GeometryInputPanel({ projectId, parentId, targetLevel, onClose, onImported, existingGeometries }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<'geojson' | 'csv' | 'form' | 'template'>('geojson');
  const [geoJsonText, setGeoJsonText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    label_en: '', label_ar: '', lat: '24.86', lng: '46.72',
    width: '50', height: '40',
  });
  const [templateSource, setTemplateSource] = useState('');

  useEffect(() => {
    setResult(null);
  }, [tab]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
        setGeoJsonText(text);
        setTab('geojson');
      } else if (file.name.endsWith('.csv')) {
        setCsvText(text);
        setTab('csv');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function formatGeoJson() {
    try {
      const parsed = JSON.parse(geoJsonText);
      setGeoJsonText(JSON.stringify(parsed, null, 2));
    } catch { }
  }

  async function processGeoJson() {
    setProcessing(true);
    setResult(null);
    const errors: string[] = [];
    let success = 0;

    try {
      let parsed: any;
      try { parsed = JSON.parse(geoJsonText); }
      catch { toast.error('Invalid JSON syntax'); setProcessing(false); return; }

      if (!isValidGeoJSON(parsed)) {
        toast.error('Not a valid GeoJSON object (need Feature, FeatureCollection, or geometry)');
        setProcessing(false);
        return;
      }

      const features = parsed.type === 'FeatureCollection' ? parsed.features
        : parsed.type === 'Feature' ? [parsed]
        : [{ type: 'Feature', geometry: parsed, properties: {} }];

      const unitRows: Record<string, unknown>[] = [];
      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        const geom = f.geometry;
        if (!geom) { errors.push(`Feature ${i + 1}: missing geometry`); continue; }

        const rawType = f.properties?.type || f.properties?.geometry_type || targetLevel;
        const featType = (rawType === 'Feature' || rawType === 'FeatureCollection') ? targetLevel : rawType;
        const label = f.properties?.label_en || f.properties?.name || f.properties?.unit_code || `${featType}_${i + 1}`;
        const labelAr = f.properties?.label_ar || null;

        try {
          await projectGeometriesApi.upsert({
            project_id: projectId,
            parent_id: parentId || undefined,
            geometry_type: featType,
            label_en: label,
            label_ar: labelAr || undefined,
            geometry: geom,
            properties: f.properties || {},
            level: ['site', 'building', 'floor', 'unit'].indexOf(featType),
            sort_order: i,
            status: 'active',
          });
          success++;
          // If type is 'unit', sync directly to units table preserving exact geometry
          if (featType === 'unit') {
            const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
            const lat = String(coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length);
            const lng = String(coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length);
            unitRows.push({
              unit_code: f.properties?.unit_code || f.properties?.name || `UNIT-${String(i + 1).padStart(3, '0')}`,
              unit_type: f.properties?.unit_type || 'apartment',
              geometry: JSON.stringify(geom),
              status: f.properties?.status || 'available',
              is_active: 'true',
              lat,
              lng,
            });
          }
        } catch (err: any) {
          errors.push(`Feature ${i + 1} (${label}): ${err.message || 'DB error'}`);
        }
      }

      // Sync unit geometries to units table in batch
      if (unitRows.length > 0) {
        const { error } = await supabase.rpc('generate_project_units', {
          p_project_id: projectId, p_unit_data: unitRows, p_mode: 'append',
        });
        if (error) console.error('Unit sync failed:', error);
        else toast.success(`${unitRows.length} units synced from GeoJSON`);
      }

      await geometryImportsApi.create({
        project_id: projectId, import_type: 'geojson',
        source_name: `Imported ${success}/${features.length} features`,
        processed_count: success, error_count: errors.length, status: errors.length > 0 && success === 0 ? 'failed' : 'completed',
      });
    } catch (err: any) {
      errors.push(err.message || 'Unexpected error');
    }

    if (success > 0) {
      const genCount = await autoGenerateUnits(projectId, 'append');
      if (genCount > 0) toast.success(`Auto-generated ${genCount} units from site/building/floor geometries`);
    }

    setResult({ success, errors });
    if (success > 0) {
      toast.success(`${success} geometries created`);
      onImported();
    } else {
      toast.error('Import failed — see details below');
    }
    setProcessing(false);
  }

  async function processCsv() {
    setProcessing(true);
    setResult(null);
    const errors: string[] = [];
    let success = 0;

    try {
      const lines = csvText.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV must have header + at least 1 data row'); setProcessing(false); return; }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const latIdx = headers.findIndex(h => h === 'lat' || h === 'latitude');
      const lngIdx = headers.findIndex(h => h === 'lng' || h === 'longitude' || h === 'lon');
      const labelIdx = headers.findIndex(h => h === 'label' || h === 'name' || h === 'unit_code' || h === 'code');
      const widthIdx = headers.findIndex(h => h === 'width' || h === 'w');
      const heightIdx = headers.findIndex(h => h === 'height' || h === 'h' || h === 'depth');

      if (latIdx < 0 || lngIdx < 0) {
        toast.error('CSV must have lat and lng columns');
        setProcessing(false);
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const lat = parseFloat(cols[latIdx]);
        const lng = parseFloat(cols[lngIdx]);
        if (isNaN(lat) || isNaN(lng)) { errors.push(`Row ${i + 1}: invalid lat/lng`); continue; }

        const label = labelIdx >= 0 && cols[labelIdx] ? cols[labelIdx] : `${targetLevel}_${i}`;
        const w = widthIdx >= 0 ? parseFloat(cols[widthIdx]) : 50;
        const h = heightIdx >= 0 ? parseFloat(cols[heightIdx]) : 40;

        const geom = coordsToGeoJSON(lat, lng, isNaN(w) ? 50 : w, isNaN(h) ? 40 : h);

        try {
          await projectGeometriesApi.upsert({
            project_id: projectId, parent_id: parentId || undefined, geometry_type: targetLevel,
            label_en: label, geometry: geom,
            level: ['site', 'building', 'floor', 'unit'].indexOf(targetLevel),
            sort_order: success, status: 'active',
          });
          success++;
        } catch (err: any) {
          errors.push(`Row ${i + 1} (${label}): ${err.message || 'DB error'}`);
        }
      }

      await geometryImportsApi.create({
        project_id: projectId, import_type: 'csv',
        source_name: `Imported ${success}/${lines.length - 1} from CSV`,
        processed_count: success, error_count: errors.length, status: 'completed',
      });
    } catch (err: any) {
      errors.push(err.message || 'Unexpected error');
    }

    if (success > 0) {
      const unitCount = await autoGenerateUnits(projectId, 'append');
      if (unitCount > 0) toast.success(`Auto-generated ${unitCount} units from CSV`);
    }

    setResult({ success, errors });
    if (success > 0) {
      toast.success(`${success} geometries created from CSV`);
      onImported();
    }
    setProcessing(false);
  }

  async function processForm() {
    setProcessing(true);
    setResult(null);
    const errors: string[] = [];

    try {
      const lat = parseFloat(formData.lat);
      const lng = parseFloat(formData.lng);
      const w = parseFloat(formData.width);
      const h = parseFloat(formData.height);

      if (isNaN(lat) || isNaN(lng)) { toast.error('Invalid coordinates'); setProcessing(false); return; }
      if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) { toast.error('Width and height must be positive numbers (meters)'); setProcessing(false); return; }

      const label = formData.label_en.trim() || `${targetLevel}_form`;
      const geom = coordsToGeoJSON(lat, lng, w, h);

      await projectGeometriesApi.upsert({
        project_id: projectId, parent_id: parentId || undefined, geometry_type: targetLevel,
        label_en: label, label_ar: formData.label_ar.trim() || undefined,
        geometry: geom,
        level: ['site', 'building', 'floor', 'unit'].indexOf(targetLevel),
        sort_order: 0, status: 'active',
      });

      await geometryImportsApi.create({
        project_id: projectId, import_type: 'form',
        source_name: `Form: ${label}`,
        processed_count: 1, error_count: 0, status: 'completed',
      });

      setResult({ success: 1, errors: [] });
      toast.success(`${targetLevel} geometry created`);
      onImported();
    } catch (err: any) {
      errors.push(err.message || 'Failed to create geometry');
      setResult({ success: 0, errors });
      toast.error('Failed to create geometry');
    }
    setProcessing(false);
  }

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-sm font-semibold capitalize">Add {targetLevel} Geometry</span>
        <button onClick={onClose} className="p-0.5 hover:opacity-70"><X size={14} /></button>
      </div>

      <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
        {([
          { key: 'geojson', icon: FileText, label: 'GeoJSON' },
          { key: 'csv', icon: Grid3x3, label: 'CSV' },
          { key: 'form', icon: Type, label: 'Form' },
          { key: 'template', icon: Copy, label: 'Template' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${
              tab === t.key ? 'gradient-primary text-white' : ''
            }`}
            style={tab !== t.key ? { color: 'var(--color-text-secondary)' } : {}}>
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-2 text-xs">
        {tab === 'geojson' && (
          <>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Paste GeoJSON or upload a .geojson/.json file. Supports FeatureCollection, single Feature, or raw geometry.
            </p>
            <textarea className="input w-full" rows={6}
              placeholder={'{\n  "type": "FeatureCollection",\n  "features": [\n    {\n      "type": "Feature",\n      "properties": {"name": "..."},\n      "geometry": {\n        "type": "Polygon",\n        "coordinates": [[[lng,lat],[lng,lat],...]]\n      }\n    }\n  ]\n}'}
              value={geoJsonText} onChange={e => setGeoJsonText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 10, minHeight: 140 }} />
            <div className="flex gap-1">
              <button className="btn-secondary btn-xs" onClick={() => fileRef.current?.click()}>
                <Upload size={10} /> Upload
              </button>
              <button className="btn-secondary btn-xs" onClick={formatGeoJson} disabled={!geoJsonText}>
                Format
              </button>
              <button className="btn-primary btn-xs flex-1" disabled={!geoJsonText || processing} onClick={processGeoJson}>
                {processing ? 'Processing...' : 'Import GeoJSON'}
              </button>
            </div>
          </>
        )}

        {tab === 'csv' && (
          <>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Required columns: <code>lat</code>, <code>lng</code>. Optional: <code>label</code>, <code>width</code> (m), <code>height</code> (m).
              Each row creates a rectangle polygon centered at (lat, lng).
            </p>
            <textarea className="input w-full" rows={5}
              placeholder={'lat,lng,label,width,height\n24.86,46.72,Building A,60,50\n24.87,46.73,Building B,45,35'}
              value={csvText} onChange={e => setCsvText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 10, minHeight: 100 }} />
            <div className="flex gap-1">
              <button className="btn-secondary btn-xs" onClick={() => fileRef.current?.click()}>
                <Upload size={10} /> Upload CSV
              </button>
              <button className="btn-primary btn-xs flex-1" disabled={!csvText || processing} onClick={processCsv}>
                {processing ? 'Processing...' : 'Import CSV'}
              </button>
            </div>
          </>
        )}

        {tab === 'form' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Label (EN)</label>
              <input className="input w-full text-xs" placeholder={`${targetLevel} name`}
                value={formData.label_en}
                onChange={e => setFormData(p => ({ ...p, label_en: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Label (AR)</label>
              <input className="input w-full text-xs" placeholder="الاسم بالعربية"
                value={formData.label_ar}
                onChange={e => setFormData(p => ({ ...p, label_ar: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Latitude</label>
              <input className="input w-full text-xs" value={formData.lat}
                onChange={e => setFormData(p => ({ ...p, lat: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Longitude</label>
              <input className="input w-full text-xs" value={formData.lng}
                onChange={e => setFormData(p => ({ ...p, lng: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Width (meters)</label>
              <input className="input w-full text-xs" type="number" min="1" value={formData.width}
                onChange={e => setFormData(p => ({ ...p, width: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Height (meters)</label>
              <input className="input w-full text-xs" type="number" min="1" value={formData.height}
                onChange={e => setFormData(p => ({ ...p, height: e.target.value }))} />
            </div>
            <div className="col-span-2 mt-1">
              <button className="btn-primary btn-xs w-full" disabled={processing} onClick={processForm}>
                {processing ? 'Creating...' : 'Create Rectangle'}
              </button>
            </div>
          </div>
        )}

        {tab === 'template' && (
          <div className="space-y-2">
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Copy geometry from an existing item as a template.
            </p>
            <select className="select w-full text-xs" value={templateSource}
              onChange={e => setTemplateSource(e.target.value)}>
              <option value="">Select source...</option>
              {(existingGeometries || []).map(g => (
                <option key={g.id} value={g.id}>{g.label_en || g.id} ({g.geometry_type})</option>
              ))}
            </select>
            <button className="btn-primary btn-xs w-full" disabled={!templateSource || processing}
              onClick={async () => {
                setProcessing(true);
                setResult(null);
                try {
                  const { data } = await supabase.from('project_geometries').select('*').eq('id', templateSource).single();
                  if (!data) { toast.error('Source not found'); setProcessing(false); return; }
                  const { id: _, created_at: __, updated_at: ___, ...rest } = data;
                  await projectGeometriesApi.upsert({ ...rest, geometry: rest.geometry, label_en: (rest.label_en || '') + ' (copy)', id: undefined });
                  setResult({ success: 1, errors: [] });
                  toast.success('Template copied');
                  onImported();
                } catch (err: any) {
                  setResult({ success: 0, errors: [err.message || 'Copy failed'] });
                  toast.error('Copy failed');
                }
                setProcessing(false);
              }}>
              {processing ? 'Copying...' : 'Copy & Create'}
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".geojson,.json,.csv" className="hidden" onChange={handleFileUpload} />
      </div>

      {result && (
        <div className="border-t px-3 py-2 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-1.5 text-xs">
            {result.success > 0 ? (
              <><CheckCircle2 size={12} className="text-green-500" /><span className="text-green-600 font-medium">{result.success} created</span></>
            ) : (
              <><AlertCircle size={12} className="text-red-500" /><span className="text-red-600 font-medium">Import failed</span></>
            )}
            {result.errors.length > 0 && <span className="text-[10px] opacity-60">({result.errors.length} errors)</span>}
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-20 overflow-y-auto space-y-0.5">
              {result.errors.map((e, i) => (
                <p key={i} className="text-[9px] text-red-500 font-mono">• {e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
