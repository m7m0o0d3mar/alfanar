import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { projectGeometriesApi, type ProjectGeometry } from '../services/api';
import { Building2, Layers, Home, MapPin, Maximize2, Minimize2, ExternalLink, DollarSign, Target, ArrowLeft, ChevronRight, Upload, Download, Grid3x3, Search, RotateCw, Filter, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProjectSitePlanGenerator from './ProjectSitePlanGenerator';

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
    const allCoords: [number, number][] = [];
    for (const f of features) {
      for (const ring of f.coords) {
        for (const [lat, lng] of ring) {
          allCoords.push([lat, lng]);
        }
      }
    }
    if (allCoords.length < 2) return;
    const bounds = L.latLngBounds(allCoords);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }
  }, [map, features]);
  return null;
}

function MapContent({ geometries, selectedId, onSelect, drillLevel, levelColors, searchQuery }: {
  geometries: FeatureGroupData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  drillLevel: number;
  levelColors: Map<string, { fill: string; stroke: string }>;
  searchQuery: string;
}) {
  const map = useMap();
  const geoJsonKey = useRef(0);

  useEffect(() => {
    geoJsonKey.current += 1;
  }, [geometries.length, drillLevel, searchQuery]);

  const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
    const id = feature.properties?._id;
    if (!id) return;
    layer.on({
      click: () => {
        onSelect(id);
        const bounds = (layer as L.Polygon).getBounds();
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
        const c = levelColors.get(g.id) || getFeatureColor(g as any);
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

export default function ProjectSitePlan({ projectId, projectName, height = '500px' }: Props) {
  const navigate = useNavigate();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const levelColors = useRef(new Map<string, { fill: string; stroke: string }>());
  const fitKey = useRef(0);

  const loadData = useCallback(() => {
    setLoading(true);
    projectGeometriesApi.list(projectId).then((data) => {
      setGeometries(data);
      const feats: FeatureGroupData[] = [];
      for (const g of data) {
        const coords = parseGeoJSONCoords(g.geometry);
        if (coords.length > 0) {
          feats.push({
            id: g.id, parentId: g.parent_id, type: g.geometry_type,
            label: g.label_en || g.label_ar, coords, properties: g.properties || {},
            salesStatus: ((g.properties as any)?.sales_status as string) || undefined,
          });
          levelColors.current.set(g.id, getFeatureColor(g));
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
      for (const feat of features) {
        if (!feat.geometry || (feat.geometry.type !== 'Polygon' && feat.geometry.type !== 'MultiPolygon')) continue;
        const props = feat.properties || {};
        await projectGeometriesApi.upsert({
          project_id: projectId,
          geometry_type: props.type || 'building',
          label_en: props.name || props.label_en || props.name_en || `Imported ${count + 1}`,
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
        count++;
      }
      loadData();
    } catch (err) {
      console.error('GeoJSON import failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitProjectBounds features={features} key={fitKey.current} />
              <MapContent
                geometries={features}
                selectedId={selectedId}
                onSelect={handleSelect}
                drillLevel={drillLevel}
                levelColors={levelColors.current}
                searchQuery={searchQuery}
              />
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
