import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Tooltip, useMap, useMapEvents, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../services/supabase';
import { projectGeometriesApi, type ProjectGeometry } from '../services/api';
import { Building2, Layers, Home, Map, MapPin, Maximize2, Minimize2, ExternalLink, DollarSign, Target, ArrowLeft, ChevronRight, Upload, Download, Grid3x3, Search, RotateCw, Filter, Info, Ruler, MousePointer, Type } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ProjectSitePlanGenerator from './ProjectSitePlanGenerator';
import MeasurementTool, { calculateDistance, calculateArea } from './MeasurementTool';
import type { Measurement } from './MeasurementTool';

interface Props {
  projectId: string;
  projectName?: string;
  height?: string;
}

const typeColors: Record<string, { fill: string; stroke: string }> = {
  building: { fill: '#3b82f6', stroke: '#1d4ed8' },
  floor: { fill: '#10b981', stroke: '#059669' },
  unit: { fill: '#8b5cf6', stroke: '#7c3aed' },
  zone: { fill: '#f59e0b', stroke: '#d97706' },
  amenity: { fill: '#ec4899', stroke: '#db2777' },
  site: { fill: '#6b7280', stroke: '#4b5563' },
};

const statusColors: Record<string, string> = {
  available: '#10b981', reserved: '#f59e0b', sold: '#ef4444',
  completed: '#9ca3af', in_progress: '#3b82f6', planned: '#8b5cf6',
};

function getFeatureColor(geom: ProjectGeometry): { fill: string; stroke: string } {
  const props = geom.properties || {};
  const saleStatus = (props as any).sales_status as string;
  const execStatus = (props as any).execution_status as string;
  const color = statusColors[saleStatus || execStatus];
  if (color) return { fill: color + '88', stroke: color };
  return typeColors[geom.geometry_type] || { fill: '#6b7280', stroke: '#4b5563' };
}

interface FeatureGroupData {
  id: string;
  parentId?: string;
  type: string;
  label?: string;
  coords: number[][][];
  properties: Record<string, unknown>;
  salesStatus?: string;
}

function parseGeoJSONCoords(geometry: Record<string, unknown>): number[][][] {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number])
    );
  }
  if (geometry.type === 'MultiPolygon') {
    const polys: number[][][] = [];
    for (const poly of geometry.coordinates as number[][][][]) {
      for (const ring of poly) {
        polys.push(ring.map(([lng, lat]) => [lat, lng] as [number, number]));
      }
    }
    return polys;
  }
  return [];
}

function FitProjectBounds({ features }: { features: FeatureGroupData[] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length === 0) return;
    try {
      const allCoords: [number, number][] = [];
      for (const f of features) {
        if (!f.coords || f.coords.length === 0) continue;
        for (const ring of f.coords) {
          if (!ring || ring.length < 2) continue;
          for (const coord of ring) {
            if (!coord || coord.length < 2) continue;
            const [lat, lng] = coord;
            if (typeof lat !== 'number' || typeof lng !== 'number') continue;
            allCoords.push([lat, lng]);
          }
        }
      }
      if (allCoords.length < 2) return;
      const bounds = L.latLngBounds(allCoords);
      if (bounds.isValid()) {
        map.whenReady(() => {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
        });
      } else {
        console.warn('FitProjectBounds: invalid bounds', allCoords.length, allCoords.slice(0, 3));
      }
    } catch (err) {
      console.error('FitProjectBounds error:', err);
    }
  }, [map, features]);
  return null;
}

function UnitMarkers({ projectId, showLabels, refreshKey = 0 }: { projectId: string; showLabels?: boolean; refreshKey?: number }) {
  const map = useMap();
  const [units, setUnits] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('units').select('id, unit_code, unit_type, status, area_sqm, bedrooms, price, lat, lng, floor_number, project_id')
      .eq('project_id', projectId).eq('is_active', true).limit(500).then(({ data }) => {
        setUnits(data || []);
      });
  }, [projectId, refreshKey]);
  useEffect(() => {
    const markers: L.Marker[] = [];
    for (const u of units) {
      if (!u.lat || !u.lng) continue;
      const color = statusColors[u.status] || '#6b7280';
      const shortLabel = u.unit_code ? u.unit_code.match(/\d+$/)?.[0] || u.unit_code.slice(-3) : 'U';
      const marker = L.marker([u.lat, u.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px ${color}66;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;letter-spacing:-0.5px">${shortLabel}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      });
      marker.bindTooltip(`
        <div style="font-size:12px;font-weight:600">${u.unit_code}
          <span style="font-weight:400;color:#6b7280;font-size:11px;text-transform:capitalize">${u.unit_type ? `· ${u.unit_type}` : ''}${u.status ? `· ${u.status}` : ''}</span>
        </div>
      `, { direction: 'top', offset: L.point(0, -16), sticky: true });
      marker.bindPopup(`
        <div style="min-width:220px;font-family:system-ui,sans-serif">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0"></span>
            <span style="font-weight:700;font-size:15px">${u.unit_code}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;font-size:12px;color:#374151">
            <span style="color:#6b7280">Type:</span><span>${u.unit_type || '—'}</span>
            <span style="color:#6b7280">Status:</span><span style="color:${color};font-weight:500">${u.status || '—'}</span>
            ${u.area_sqm != null ? `<span style="color:#6b7280">Area:</span><span>${u.area_sqm} m²</span>` : ''}
            ${u.bedrooms != null ? `<span style="color:#6b7280">Bedrooms:</span><span>${u.bedrooms}</span>` : ''}
            ${u.floor_number != null ? `<span style="color:#6b7280">Floor:</span><span>${u.floor_number}</span>` : ''}
            ${u.price != null ? `<span style="color:#6b7280">Price:</span><span>${u.price.toLocaleString()} SAR</span>` : ''}
          </div>
        </div>
      `, { maxWidth: 280 });
      marker.addTo(map);
      markers.push(marker);
    }
    return () => { markers.forEach(m => { try { map.removeLayer(m); } catch {} }); };
  }, [map, units]);
  // Label effect: rebuilds labels on units change, toggles visibility on showLabels change
  useEffect(() => {
    if (units.length === 0) return;
    const labels = L.layerGroup();
    for (const u of units) {
      if (!u.lat || !u.lng || !u.unit_code) continue;
      const labelMarker = L.marker([u.lat, u.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="font-size:9px;font-weight:600;color:#111;background:rgba(255,255,255,0.85);border-radius:3px;padding:0 4px;white-space:nowrap;pointer-events:none;box-shadow:0 0 3px rgba(0,0,0,0.2);text-align:center">${u.unit_code.match(/\d+$/)?.[0] || u.unit_code.slice(-3)}</div>`,
          iconSize: [100, 18],
          iconAnchor: [50, 22],
        }),
        interactive: false,
      });
      labels.addLayer(labelMarker);
    }
    if (showLabels) map.addLayer(labels);
    return () => { try { if (map && map.hasLayer(labels)) map.removeLayer(labels); } catch {} };
  }, [map, units, showLabels]);
  return null;
}

function MapContent({ geometries, selectedId, onSelect, drillLevel, levelColors, searchQuery }: {
  geometries: FeatureGroupData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  drillLevel: number;
  levelColors: Record<string, { fill: string; stroke: string }>;
  searchQuery: string;
}) {
  const map = useMap();
  const geoJsonKey = useRef(0);

  useEffect(() => {
    geoJsonKey.current += 1;
  }, [geometries.length, drillLevel, searchQuery]);

  const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
    const id = feature.properties?._id;
    const label = feature.properties?._label || id;
    if (!id) return;
    const poly = layer as L.Polygon;
    poly.bindTooltip(label, { sticky: true, direction: 'center' });
    layer.on({
      click: () => {
        onSelect(id);
        const bounds = poly.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      },
      mouseover: (e) => {
        const l = e.target as L.Polygon;
        l.setStyle({ fillOpacity: 0.6, weight: 3 });
        if (l.getTooltip()) l.openTooltip();
      },
      mouseout: (e) => {
        const l = e.target as L.Polygon;
        const isSelected = selectedId === id;
        l.setStyle({ fillOpacity: isSelected ? 0.5 : 0.25, weight: isSelected ? 3 : 1.5 });
        if (l.getTooltip()) l.closeTooltip();
      },
    });
  }, [onSelect, selectedId, map]);

  const q = searchQuery.toLowerCase();
  const filtered = geometries.filter((g) => {
    if (drillLevel === 0) return (g.type === 'building' || g.type === 'zone' || g.type === 'amenity') && (!q || (g.label && g.label.toLowerCase().includes(q)));
    if (drillLevel === 1) return (g.type === 'floor' || g.type === 'zone') && (!q || (g.label && g.label.toLowerCase().includes(q)));
    return g.type === 'unit' && (!q || (g.label && g.label.toLowerCase().includes(q)));
  });

  return (
    <>
      {filtered.map((g) => {
        if (!g.coords[0] || g.coords[0].length < 3) return null;
        const c = levelColors[g.id] || getFeatureColor(g as any);
        const isSelected = selectedId === g.id;
        const geoJsonData = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { _id: g.id, _label: g.label || g.id },
            geometry: {
              type: 'Polygon',
              coordinates: [g.coords[0].map(([lat, lng]) => [lng, lat])],
            },
          }],
        };
        return (
          <GeoJSON
            key={`${geoJsonKey.current}-${g.id}`}
            data={geoJsonData as any}
            style={() => ({
              color: c.stroke,
              fillColor: isSelected ? c.stroke : c.fill,
              weight: isSelected ? 3 : 1.5,
              opacity: 1,
              fillOpacity: isSelected ? 0.5 : 0.25,
            })}
            onEachFeature={onEachFeature}
          />
        );
      })}
    </>
  );
}

// ---------- Coordinate Tracker ----------
function CoordTracker() {
  const map = useMap();
  const [coord, setCoord] = useState('');
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => setCoord(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
    map.on('mousemove', handler);
    return () => { map.off('mousemove', handler); };
  }, [map]);
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5 text-[10px] font-mono text-gray-600 absolute bottom-3 left-3 z-[1000]">
      {coord || '24.7500, 46.7500'}
    </div>
  );
}

// ---------- Measure Click Handler ----------
function MeasureClickHandler({ onMeasure }: { onMeasure: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e: L.LeafletMouseEvent) => { onMeasure(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// ---------- Measurement Layer Renderer ----------
function MeasurementLayer({ measurements }: { measurements: Measurement[] }) {
  const map = useMap();
  useEffect(() => {
    const layers: L.Layer[] = [];
    for (const m of measurements) {
      if (m.points.length < 2) continue;
      const latlngs = m.points.map(([lat, lng]) => [lat, lng] as [number, number]);
      if (m.type === 'distance') {
        const poly = L.polyline(latlngs, { color: m.color, weight: 2, dashArray: '5,5' });
        poly.addTo(map);
        layers.push(poly);
        const mid = m.points.length === 2 ? [(m.points[0][0] + m.points[1][0]) / 2, (m.points[0][1] + m.points[1][1]) / 2] as [number, number] : null;
        if (mid) {
          const icon = L.divIcon({ className: '', html: `<div style="background:${m.color};color:white;padding:1px 5px;border-radius:8px;font-size:10px;font-weight:600;white-space:nowrap">${m.label}</div>` });
          const label = L.marker(mid, { icon, interactive: false });
          label.addTo(map);
          layers.push(label);
        }
      } else if (m.type === 'area' && m.points.length >= 3) {
        const poly = L.polygon(latlngs, { color: m.color, weight: 2, fillColor: m.color, fillOpacity: 0.15 });
        poly.addTo(map);
        layers.push(poly);
        const centroid = [m.points.reduce((s, p) => s + p[0], 0) / m.points.length, m.points.reduce((s, p) => s + p[1], 0) / m.points.length] as [number, number];
        const icon = L.divIcon({ className: '', html: `<div style="background:${m.color};color:white;padding:1px 5px;border-radius:8px;font-size:10px;font-weight:600;white-space:nowrap">${m.label}</div>` });
        const label = L.marker(centroid, { icon, interactive: false });
        label.addTo(map);
        layers.push(label);
      }
    }
    return () => { layers.forEach(l => map.removeLayer(l)); };
  }, [map, measurements]);
  return null;
}

export default function ProjectSitePlan({ projectId, projectName, height = '500px' }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [geometries, setGeometries] = useState<ProjectGeometry[]>([]);
  const [features, setFeatures] = useState<FeatureGroupData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProjectGeometry | null>(null);
  const [drillLevel, setDrillLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [measureMode, setMeasureMode] = useState<'none' | 'distance' | 'area'>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showUnitMarkers, setShowUnitMarkers] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unitRefreshKey, setUnitRefreshKey] = useState(0);
  const [tileLayer, setTileLayer] = useState<'street' | 'satellite'>('street');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const levelColors = useRef<Record<string, { fill: string; stroke: string }>>({});
  const fitKey = useRef(0);

  const loadData = useCallback(() => {
    setLoading(true);
    projectGeometriesApi.list(projectId).then((data) => {
      setGeometries(data);
      const feats: FeatureGroupData[] = [];
      for (const g of data) {
        const coords = parseGeoJSONCoords(g.geometry);
        if (coords.length > 0 && coords[0].length >= 3) {
          feats.push({
            id: g.id, parentId: g.parent_id, type: g.geometry_type,
            label: g.label_en || g.label_ar, coords, properties: g.properties || {},
            salesStatus: ((g.properties as any)?.sales_status as string) || undefined,
          });
          levelColors.current[g.id] = getFeatureColor(g);
        }
      }
      setFeatures(feats);
      setLoading(false);
      fitKey.current++;
    }).catch(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    const bySalesStatus: Record<string, number> = {};
    for (const f of features) {
      byType[f.type] = (byType[f.type] || 0) + 1;
      if (f.salesStatus) bySalesStatus[f.salesStatus] = (bySalesStatus[f.salesStatus] || 0) + 1;
    }
    return { byType, bySalesStatus, total: features.length };
  }, [features]);

  function downloadAllGeoJSON() {
    const geoFeatures = features.map((f) => ({
      type: 'Feature',
      properties: { id: f.id, type: f.type, label: f.label, ...f.properties },
      geometry: {
        type: 'Polygon',
        coordinates: [f.coords[0].map(([lat, lng]) => [lng, lat])],
      },
    }));
    const fc = { type: 'FeatureCollection', features: geoFeatures };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site_plan_${projectName || projectId}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const sample: Record<string, unknown> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Building A', type: 'building', area: 1200, height: 30, sales_status: 'available', execution_progress: 65 },
          geometry: { type: 'Polygon', coordinates: [[[46.75, 24.75], [46.753, 24.75], [46.753, 24.754], [46.75, 24.754], [46.75, 24.75]]] },
        },
        {
          type: 'Feature',
          properties: { name: 'Building B', type: 'building', area: 800, height: 20, sales_status: 'reserved', execution_progress: 40 },
          geometry: { type: 'Polygon', coordinates: [[[46.754, 24.75], [46.757, 24.75], [46.757, 24.754], [46.754, 24.754], [46.754, 24.75]]] },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site_plan_template.geojson';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleGeoJSONUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const geojson = JSON.parse(text);
      const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
      let count = 0;
      const unitRows: Record<string, unknown>[] = [];
      for (const feat of features) {
        if (!feat.geometry || (feat.geometry.type !== 'Polygon' && feat.geometry.type !== 'MultiPolygon')) continue;
        const props = feat.properties || {};
        const rawType = props.type || props.geometry_type || 'unit';
        const geoType = (rawType === 'Feature' || rawType === 'FeatureCollection') ? 'unit' : rawType;
        await projectGeometriesApi.upsert({
          project_id: projectId,
          geometry_type: geoType,
          label_en: props.name || props.label_en || props.name_en || `${geoType} ${count + 1}`,
          label_ar: props.label_ar || props.name_ar || null,
          geometry: feat.geometry,
          properties: {
            area: props.area || null,
            height: props.height || null,
            sales_status: props.sales_status || null,
            execution_progress: props.execution_progress || null,
            ...props,
          },
          level: props.level || 1,
          sort_order: count,
        });
        // Sync non-site features directly to units table
        if (geoType !== 'site') {
          const coords = feat.geometry.type === 'Polygon' ? feat.geometry.coordinates[0] : feat.geometry.coordinates[0][0];
          const lat = String(coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length);
          const lng = String(coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length);
          unitRows.push({
            unit_code: props.unit_code || props.name || `UNIT-${String(count + 1).padStart(3, '0')}`,
            unit_type: props.unit_type || 'apartment',
            geometry: JSON.stringify(feat.geometry),
            status: props.status || 'available',
            is_active: 'true',
            lat,
            lng,
          });
        }
        count++;
      }
      // Sync unit geometries to units table in batch
      if (unitRows.length > 0) {
        const { error } = await supabase.rpc('generate_project_units', {
          p_project_id: projectId, p_unit_data: unitRows, p_mode: 'append',
        });
        if (error) console.error('Unit sync failed:', error);
        else { setUnitRefreshKey(k => k + 1); toast.success(`${unitRows.length} units synced`); }
      }
      loadData();
    } catch (err) {
      console.error('GeoJSON import failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function generateUnitsFromGeometries(pid: string, mode: 'append' | 'replace') {
    setGenerating(true);
    try {
      const { data: geoms, error: geomsErr } = await supabase.from('project_geometries').select('id, geometry, label_en, geometry_type, project_id')
        .eq('project_id', pid).in('geometry_type', ['site', 'building', 'floor', 'unit']);
      if (geomsErr) { toast.error('Failed to load geometries: ' + geomsErr.message); return; }
      if (!geoms || geoms.length === 0) { toast.info('No geometries found'); return; }
      const unitRows: Record<string, unknown>[] = [];
      for (const g of geoms) {
        if (!g.geometry) continue;
        const prefix = g.label_en ? g.label_en.slice(0, 6).replace(/[^a-zA-Z0-9_]/g, '') : 'U';
        // For 'unit' type geometries, create 1 unit; for larger geometries, subdivide into 2×2 grid
        const isUnitType = g.geometry_type === 'unit';
        const bounds = L.geoJSON(g.geometry).getBounds();
        const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
        const rows = isUnitType ? 1 : 2, cols = isUnitType ? 1 : 2;
        const latStep = rows > 1 ? (ne.lat - sw.lat) / rows : 0;
        const lngStep = cols > 1 ? (ne.lng - sw.lng) / cols : 0;
        let idx = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            idx++;
            const unitPolygon = isUnitType ? g.geometry : {
              type: 'Polygon',
              coordinates: [[
                [sw.lng + c * lngStep, sw.lat + r * latStep],
                [sw.lng + (c + 1) * lngStep, sw.lat + r * latStep],
                [sw.lng + (c + 1) * lngStep, sw.lat + (r + 1) * latStep],
                [sw.lng + c * lngStep, sw.lat + (r + 1) * latStep],
                [sw.lng + c * lngStep, sw.lat + r * latStep],
              ]],
            };
            const coords = unitPolygon.coordinates[0];
            const lat = String(coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length);
            const lng = String(coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length);
            unitRows.push({
              unit_code: `${prefix}-${String(idx).padStart(3, '0')}`,
              unit_type: 'apartment',
              geometry: JSON.stringify(unitPolygon),
              status: 'available',
              is_active: 'true',
              lat,
              lng,
            });
          }
        }
      }
      if (unitRows.length === 0) { toast.info('No units generated'); return; }
      const { data: count, error } = await supabase.rpc('generate_project_units', {
        p_project_id: pid, p_unit_data: unitRows, p_mode: mode,
      });
      if (error) throw error;
      toast.success(`${count || unitRows.length} units ${mode === 'replace' ? 'replaced' : 'added'}`);
      setUnitRefreshKey(k => k + 1);
      loadData();
    } catch (err: any) { toast.error(err?.message || 'Generation failed'); }
    setGenerating(false);
  }

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    const geom = geometries.find((g) => g.id === id);
    setSelected(geom || null);
  }, [geometries]);

  const drillDown = useCallback(() => {
    if (drillLevel < 2) setDrillLevel((d) => d + 1);
  }, [drillLevel]);

  const drillUp = useCallback(() => {
    if (drillLevel > 0) {
      setDrillLevel((d) => d - 1);
      setSelectedId(null);
      setSelected(null);
    }
  }, [drillLevel]);

  const currentLevelLabel = drillLevel === 0 ? 'Buildings' : drillLevel === 1 ? 'Floors' : 'Units';

  return (
    <div className={`rounded-xl overflow-hidden border border-gray-200 transition-all ${fullscreen ? 'fixed inset-4 z-[9999] shadow-2xl' : ''}`}
      style={{ background: 'var(--color-card-bg, #fff)' }}>
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-primary" />
          <span className="font-semibold text-sm">{projectName || 'Site Plan'}</span>
          <span className="text-xs text-gray-400">|</span>
          <div className="flex items-center gap-1 text-xs">
            <button onClick={drillUp} disabled={drillLevel === 0}
              className={`p-1 rounded ${drillLevel > 0 ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-default'}`}>
              <ArrowLeft size={14} />
            </button>
            <span className="font-medium text-gray-600">{currentLevelLabel}</span>
            {drillLevel < 2 && (
              <button onClick={drillDown} className="p-1 rounded hover:bg-gray-100 text-gray-700">
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..."
              className="text-xs border rounded py-1 pl-6 pr-2 w-28 outline-none focus:border-blue-400"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          {features.length > 0 && (
            <button onClick={() => setShowStats(!showStats)}
              className={`p-1.5 rounded hover:bg-gray-100 ${showStats ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`} title="Statistics">
              <Info size={14} />
            </button>
          )}
          <button onClick={downloadAllGeoJSON} disabled={features.length === 0}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30" title="Export All GeoJSON">
            <Download size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept=".geojson,.json" className="hidden" onChange={handleGeoJSONUpload} />
          <button onClick={downloadTemplate}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Download GeoJSON Template">
            <Grid3x3 size={14} className="opacity-50" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40" title="Upload GeoJSON">
            {uploading ? <div className="animate-spin h-4 w-4 border-b-2 border-primary rounded-full" /> : <Upload size={14} />}
          </button>
          <button onClick={() => setShowGenerator(true)}
            className="btn-sm btn-primary text-xs flex items-center gap-1">
            <Grid3x3 size={12} /> Generate Site Plan
          </button>
          <button className="btn-sm text-xs flex items-center gap-1" disabled={generating}
            style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, padding: '4px 8px', cursor: 'pointer', opacity: generating ? 0.5 : 1 }}
            onClick={() => generateUnitsFromGeometries(projectId, 'append')}>
            <Grid3x3 size={10} /> {generating ? '...' : 'Append'}
          </button>
          <button className="btn-sm text-xs flex items-center gap-1" disabled={generating}
            style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, padding: '4px 8px', cursor: 'pointer', opacity: generating ? 0.5 : 1 }}
            onClick={() => generateUnitsFromGeometries(projectId, 'replace')}>
            <Grid3x3 size={10} /> {generating ? '...' : 'Replace'}
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={() => setShowUnitMarkers(!showUnitMarkers)}
            className={`p-1.5 rounded ${showUnitMarkers ? 'text-blue-600 bg-blue-50' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Toggle Unit Markers"><Home size={14} /></button>
          <button onClick={() => setShowLabels(!showLabels)}
            className={`p-1.5 rounded ${showLabels ? 'text-blue-600 bg-blue-50' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Toggle Labels"><Type size={14} /></button>
          <button onClick={() => setTileLayer(tileLayer === 'street' ? 'satellite' : 'street')}
            className={`p-1.5 rounded ${tileLayer === 'satellite' ? 'text-blue-600 bg-blue-50' : 'hover:bg-gray-100 text-gray-500'}`}
            title={tileLayer === 'street' ? 'Switch to Satellite' : 'Switch to Street Map'}><Map size={14} /></button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={() => setMeasureMode(measureMode === 'distance' ? 'none' : 'distance')}
            className={`p-1.5 rounded ${measureMode === 'distance' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Measure Distance"><Ruler size={14} /></button>
          <button onClick={() => setMeasureMode(measureMode === 'area' ? 'none' : 'area')}
            className={`p-1.5 rounded ${measureMode === 'area' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Measure Area"><Target size={14} /></button>
          {measurements.length > 0 && (
            <button onClick={() => { setMeasurements([]); setMeasureMode('none'); }}
              className="p-1.5 rounded hover:bg-gray-100 text-red-500" title="Clear Measurements">
              <MousePointer size={14} />
            </button>
          )}
          <span className="text-xs text-gray-500">{features.length} features</span>
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="flex" style={{ minHeight: height }}>
        <div className="relative flex-1">
          {loading ? (
            <div className="h-full flex items-center justify-center" style={{ height }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : features.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
              <div className="text-center">
                <Building2 size={40} className="mx-auto mb-2 opacity-30" />
                <p>No site plan data available.</p>
                <p className="text-xs mt-1">Click <strong>Generate Site Plan</strong> or upload a GeoJSON file.</p>
                <button onClick={() => setShowGenerator(true)}
                  className="btn-sm btn-primary mt-3 flex items-center gap-1 mx-auto">
                  <Grid3x3 size={14} /> Generate Site Plan
                </button>
              </div>
            </div>
          ) : (
            <MapContainer center={[24.75, 46.75]} zoom={15} className="h-full w-full" style={{ height, background: '#f8f9fa' }}
              zoomControl={false}>
              <TileLayer key={tileLayer}
                attribution={tileLayer === 'street' ? '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' : '&copy; Esri'}
                url={tileLayer === 'street' ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}
              />
              <ScaleControl position="bottomleft" imperial={false} />
              <FitProjectBounds features={features} key={fitKey.current} />
              <MapContent
                geometries={features}
                selectedId={selectedId}
                onSelect={handleSelect}
                drillLevel={drillLevel}
                levelColors={levelColors.current}
                searchQuery={searchQuery}
              />
              {showUnitMarkers && <UnitMarkers projectId={projectId} showLabels={showLabels} refreshKey={unitRefreshKey} />}
              <CoordTracker />
              {measureMode !== 'none' && (
                <MeasureClickHandler onMeasure={(lat, lng) => {
                  if (measureMode === 'distance') {
                    setMeasurements(prev => {
                      const last = prev.length > 0 ? prev[prev.length - 1] : null;
                      if (last && last.type === 'distance' && last.points.length < 2) {
                        const pts: [number, number][] = [[lat, lng]];
                        const dist = calculateDistance(last.points[0], pts[0]);
                        return [...prev.slice(0, -1), { ...last, points: [...last.points, [lat, lng] as [number, number]], value: Math.round(dist), label: `${Math.round(dist)} m`, color: last.color }];
                      }
                      const id = `m-${Date.now()}`;
                      const color = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][prev.length % 5];
                      return [...prev, { id, type: 'distance' as const, points: [[lat, lng] as [number, number]], value: 0, label: 'Click second point', color }];
                    });
                  } else if (measureMode === 'area') {
                    setMeasurements(prev => {
                      const last = prev.length > 0 ? prev[prev.length - 1] : null;
                      if (last && last.type === 'area' && last.points.length < 3) {
                        const pts = [...last.points, [lat, lng] as [number, number]];
                        if (pts.length >= 3) {
                          const area = calculateArea(pts);
                          const label = area >= 10000 ? `${(area / 10000).toFixed(2)} ha` : `${Math.round(area)} m²`;
                          return [...prev.slice(0, -1), { ...last, points: pts, value: Math.round(area), label, color: last.color }];
                        }
                        return [...prev.slice(0, -1), { ...last, points: pts }];
                      }
                      const id = `m-${Date.now()}`;
                      const color = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][prev.length % 5];
                      return [...prev, { id, type: 'area' as const, points: [[lat, lng] as [number, number]], value: 0, label: 'Click 2 more points', color }];
                    });
                  }
                }} />
              )}
              {measurements.length > 0 && <MeasurementLayer measurements={measurements} />}
              {measureMode !== 'none' && (
                <div className="absolute top-2 right-2 z-[1000]">
                  <MeasurementTool
                    enabled={true}
                    mode={measureMode}
                    onModeChange={setMeasureMode}
                    onMapClick={() => {}}
                    measurements={measurements}
                    onMeasurementsChange={setMeasurements}
                  />
                </div>
              )}
              {measureMode !== 'none' && measurements.length > 0 && (
                <div className="absolute bottom-10 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5 text-[10px] text-gray-600">
                  {measurements.length} measurement{measurements.length > 1 ? 's' : ''}
                </div>
              )}
            </MapContainer>
          )}
        </div>

        {showStats && !selected && (
          <div className="w-56 border-l border-gray-100 p-3 overflow-y-auto shrink-0 bg-gray-50/50 text-xs space-y-3">
            <p className="font-semibold text-gray-700 flex items-center gap-1"><Info size={12} /> Statistics</p>
            <div className="space-y-1.5">
              <p className="text-gray-500">Total Features: <span className="font-medium text-gray-800">{stats.total}</span></p>
              {Object.entries(stats.byType).map(([type, count]) => {
                const c = typeColors[type] || { fill: '#6b7280' };
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.fill }} />
                      <span className="capitalize text-gray-600">{type}</span>
                    </div>
                    <span className="font-medium text-gray-800">{count}</span>
                  </div>
                );
              })}
            </div>
            {Object.keys(stats.bySalesStatus).length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 mb-1">By Sales Status</p>
                {Object.entries(stats.bySalesStatus).map(([status, count]) => {
                  const color = statusColors[status] || '#6b7280';
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="capitalize text-gray-600">{status}</span>
                      </div>
                      <span className="font-medium text-gray-800">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selected && (
          <div className="w-64 border-l border-gray-100 p-3 space-y-3 text-sm overflow-y-auto shrink-0 bg-gray-50/50">
            <div className="flex items-center gap-2">
              {selected.geometry_type === 'building' && <Building2 size={16} className="text-blue-500" />}
              {selected.geometry_type === 'floor' && <Layers size={16} className="text-emerald-500" />}
              {selected.geometry_type === 'unit' && <Home size={16} className="text-purple-500" />}
              <div>
                <p className="font-semibold text-gray-900">{selected.label_en || selected.geometry_type}</p>
                {selected.label_ar && <p className="text-xs text-gray-400" dir="rtl">{selected.label_ar}</p>}
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium capitalize">{selected.geometry_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium capitalize ${selected.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                  {selected.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Level</span>
                <span className="font-medium">{selected.level || 0}</span>
              </div>
            </div>

            {(selected.properties as any)?.area != null && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Target size={12} />
                <span>Area: {(selected.properties as any).area} sqm</span>
              </div>
            )}
            {(selected.properties as any)?.height != null && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Building2 size={12} />
                <span>Height: {(selected.properties as any).height}m</span>
              </div>
            )}
            {(selected.properties as any)?.units != null && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Home size={12} />
                <span>Units: {(selected.properties as any).units}</span>
              </div>
            )}

            {(selected.properties as any)?.sales_status && (
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}>
                <p className="text-xs font-semibold flex items-center gap-1"><DollarSign size={12} /> Sales</p>
                <span className={`badge text-xs mt-1 ${
                  (selected.properties as any).sales_status === 'available' ? 'badge-success' :
                  (selected.properties as any).sales_status === 'reserved' ? 'badge-warning' : 'badge-danger'
                }`}>{(selected.properties as any).sales_status}</span>
              </div>
            )}

            {(selected.properties as any)?.execution_progress != null && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Execution</span>
                  <span>{(selected.properties as any).execution_progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(selected.properties as any).execution_progress}%` }} />
                </div>
              </div>
            )}

            <div className="pt-2 space-y-1">
              {selected.geometry_type === 'building' && (
                <button onClick={() => navigate(`/units?project=${projectId}&building=${selected.id}`)}
                  className="btn-sm btn-secondary w-full text-xs flex items-center justify-center gap-1">
                  <Home size={12} /> View Units
                </button>
              )}
              {selected.geometry_type === 'unit' && selected.id && (
                <button onClick={() => navigate(`/units?project=${projectId}`)}
                  className="btn-sm btn-secondary w-full text-xs flex items-center justify-center gap-1">
                  <ExternalLink size={12} /> Unit Details
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {features.length > 0 && !selected && !showStats && (
        <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
          <span className="font-medium">Legend:</span>
          {Object.entries(typeColors).map(([type, c]) => {
            const hasType = features.some((f) => f.type === type);
            if (!hasType) return null;
            return (
              <div key={type} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.fill, border: `1px solid ${c.stroke}` }} />
                <span className="capitalize">{type}</span>
              </div>
            );
          })}
        </div>
      )}

      {showGenerator && (
        <ProjectSitePlanGenerator
          projectId={projectId}
          onClose={() => setShowGenerator(false)}
          onGenerated={() => { setShowGenerator(false); loadData(); }}
        />
      )}
    </div>
  );
}
