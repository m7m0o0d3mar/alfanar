import { useState, useRef } from 'react';
import { Upload, FileText, Grid3x3, Type, Copy, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { geometryImportsApi } from '../services/mapsApi';

interface Props {
  projectId: string;
  parentId?: string;
  targetLevel: 'site' | 'building' | 'floor' | 'unit';
  onClose: () => void;
  onImported: () => void;
}

export default function GeometryInputPanel({ projectId, parentId, targetLevel, onClose, onImported }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<'geojson' | 'csv' | 'form' | 'template'>('geojson');
  const [geoJsonText, setGeoJsonText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    label_en: '', label_ar: '', lat: '24.86', lng: '46.72',
    width: '100', height: '80', rotation: '0',
  });

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

  function parseAndCreateGeometry(rawCoords: [number, number][]): Record<string, unknown> {
    if (rawCoords.length < 3) return {};
    const closed = [...rawCoords, rawCoords[0]];
    return {
      type: 'Polygon',
      coordinates: [closed.map(([lat, lng]) => [lng, lat])],
    };
  }

  async function processGeoJson() {
    setProcessing(true);
    try {
      let parsed: any;
      try { parsed = JSON.parse(geoJsonText); }
      catch { toast.error('Invalid JSON'); setProcessing(false); return; }

      const features = parsed.type === 'FeatureCollection' ? parsed.features : [parsed];
      let count = 0;

      for (const f of features) {
        const geom = f.geometry || parsed;
        const label = f.properties?.label_en || f.properties?.name || `${targetLevel}_${Date.now()}_${count}`;
        const { error } = await supabase.from('project_geometries').insert({
          project_id: projectId,
          parent_id: parentId || null,
          geometry_type: targetLevel,
          label_en: label,
          geometry: geom,
          properties: f.properties || {},
          level: targetLevel === 'site' ? 0 : targetLevel === 'building' ? 1 : targetLevel === 'floor' ? 2 : 3,
          sort_order: count,
          status: 'active',
        });
        if (!error) count++;
      }

      await geometryImportsApi.create({
        project_id: projectId, import_type: 'geojson',
        source_name: `Imported ${count} features`,
        processed_count: count, error_count: 0, status: 'completed',
      });

      toast.success(`Imported ${count} ${targetLevel} geometries`);
      onImported();
    } catch (err) {
      toast.error('Import failed');
      console.error(err);
    }
    setProcessing(false);
  }

  async function processCsv() {
    setProcessing(true);
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) { toast.error('CSV must have header + data rows'); setProcessing(false); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const latIdx = headers.findIndex(h => h === 'lat' || h === 'latitude');
      const lngIdx = headers.findIndex(h => h === 'lng' || h === 'longitude' || h === 'lon');
      const labelIdx = headers.findIndex(h => h === 'label' || h === 'name' || h === 'unit_code');
      if (latIdx < 0 || lngIdx < 0) { toast.error('CSV must have lat and lng columns'); setProcessing(false); return; }

      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const lat = parseFloat(cols[latIdx]);
        const lng = parseFloat(cols[lngIdx]);
        if (isNaN(lat) || isNaN(lng)) continue;

        const label = labelIdx >= 0 ? cols[labelIdx] : `${targetLevel}_${count}`;
        const geom = {
          type: 'Polygon',
          coordinates: [[
            [lng - 0.001, lat - 0.001], [lng + 0.001, lat - 0.001],
            [lng + 0.001, lat + 0.001], [lng - 0.001, lat + 0.001],
            [lng - 0.001, lat - 0.001],
          ]],
        };
        const { error } = await supabase.from('project_geometries').insert({
          project_id: projectId, parent_id: parentId || null, geometry_type: targetLevel,
          label_en: label, geometry: geom, level: targetLevel === 'site' ? 0 : targetLevel === 'building' ? 1 : targetLevel === 'floor' ? 2 : 3,
          sort_order: count, status: 'active',
        });
        if (!error) count++;
      }

      await geometryImportsApi.create({
        project_id: projectId, import_type: 'csv',
        source_name: `Imported ${count} from CSV`,
        processed_count: count, error_count: 0, status: 'completed',
      });
      toast.success(`Imported ${count} geometries from CSV`);
      onImported();
    } catch (err) {
      toast.error('CSV import failed');
      console.error(err);
    }
    setProcessing(false);
  }

  async function processForm() {
    setProcessing(true);
    try {
      const lat = parseFloat(formData.lat);
      const lng = parseFloat(formData.lng);
      const w = parseFloat(formData.width) / 100000;
      const h = parseFloat(formData.height) / 100000;
      if (isNaN(lat) || isNaN(lng)) { toast.error('Invalid coordinates'); setProcessing(false); return; }

      const geom = {
        type: 'Polygon',
        coordinates: [[
          [lng - w, lat - h], [lng + w, lat - h],
          [lng + w, lat + h], [lng - w, lat + h],
          [lng - w, lat - h],
        ]],
      };
      const { error } = await supabase.from('project_geometries').insert({
        project_id: projectId, parent_id: parentId || null, geometry_type: targetLevel,
        label_en: formData.label_en || `${targetLevel}_form`,
        label_ar: formData.label_ar || null,
        geometry: geom, level: targetLevel === 'site' ? 0 : targetLevel === 'building' ? 1 : targetLevel === 'floor' ? 2 : 3,
        sort_order: 0, status: 'active',
      });
      if (error) throw error;

      await geometryImportsApi.create({
        project_id: projectId, import_type: 'form',
        source_name: `Form-created ${targetLevel}`,
        processed_count: 1, error_count: 0, status: 'completed',
      });

      toast.success(`${targetLevel} geometry created`);
      onImported();
    } catch (err) {
      toast.error('Failed to create geometry');
      console.error(err);
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
            <textarea className="input w-full" rows={6} placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]}'
              value={geoJsonText} onChange={e => setGeoJsonText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 10 }} />
            <div className="flex gap-1">
              <button className="btn-secondary btn-xs flex-1" onClick={() => fileRef.current?.click()}>
                <Upload size={10} /> Upload File
              </button>
              <button className="btn-primary btn-xs flex-1" disabled={!geoJsonText || processing} onClick={processGeoJson}>
                {processing ? 'Processing...' : 'Import'}
              </button>
            </div>
          </>
        )}

        {tab === 'csv' && (
          <>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Columns: lat, lng, label (optional)
            </p>
            <textarea className="input w-full" rows={6} placeholder="lat,lng,label&#10;24.86,46.72,Building A&#10;24.87,46.73,Building B"
              value={csvText} onChange={e => setCsvText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 10 }} />
            <div className="flex gap-1">
              <button className="btn-secondary btn-xs flex-1" onClick={() => fileRef.current?.click()}>
                <Upload size={10} /> Upload CSV
              </button>
              <button className="btn-primary btn-xs flex-1" disabled={!csvText || processing} onClick={processCsv}>
                {processing ? 'Processing...' : 'Import'}
              </button>
            </div>
          </>
        )}

        {tab === 'form' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Label (EN)</label>
              <input className="input w-full text-xs" value={formData.label_en}
                onChange={e => setFormData(p => ({ ...p, label_en: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Label (AR)</label>
              <input className="input w-full text-xs" value={formData.label_ar}
                onChange={e => setFormData(p => ({ ...p, label_ar: e.target.value }))} dir="rtl" />
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
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Width (m)</label>
              <input className="input w-full text-xs" value={formData.width}
                onChange={e => setFormData(p => ({ ...p, width: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Height (m)</label>
              <input className="input w-full text-xs" value={formData.height}
                onChange={e => setFormData(p => ({ ...p, height: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <button className="btn-primary btn-xs w-full" disabled={processing} onClick={processForm}>
                {processing ? 'Creating...' : 'Create Geometry'}
              </button>
            </div>
          </div>
        )}

        {tab === 'template' && (
          <div className="space-y-2">
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Copy geometry from an existing item as a template, then adjust coordinates.
            </p>
            <select className="select w-full text-xs">
              <option value="">Select source...</option>
            </select>
            <button className="btn-primary btn-xs w-full" disabled>Copy & Adjust</button>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".geojson,.json,.csv" className="hidden" onChange={handleFileUpload} />
      </div>
    </div>
  );
}

// De-duplicate supabase import
import { supabase } from '../services/supabase';
