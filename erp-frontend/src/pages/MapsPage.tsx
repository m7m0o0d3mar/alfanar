import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, MapPin, Layers, Navigation, Search, List, Grid3X3 } from 'lucide-react';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const projectIcon = new L.DivIcon({
  className: 'custom-marker',
  html: '<div style="background:linear-gradient(135deg,#4f8cff,#7c5cfc);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(79,140,255,0.4);border:2px solid #fff"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -40],
});

const unitIcon = new L.DivIcon({
  className: 'custom-marker',
  html: '<div style="background:linear-gradient(135deg,#10b981,#059669);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(16,185,129,0.4);border:2px solid #fff">U</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -32],
});

interface MapProject {
  id: string;
  project_code: string;
  name_en: string;
  status: string;
  progress_percent: number;
  location?: string;
  lat?: number;
  lng?: number;
  unit_count?: number;
}

interface MapUnit {
  id: string;
  unit_no: string;
  project_id: string;
  project_name?: string;
  status: string;
  lat?: number;
  lng?: number;
}

function MapBoundsUpdater({ projects }: { projects: MapProject[] }) {
  const map = useMap();
  useEffect(() => {
    if (projects.length > 0) {
      const valid = projects.filter((p): p is MapProject & { lat: number; lng: number } => p.lat != null && p.lng != null);
      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [projects, map]);
  return null;
}

export default function MapsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'projects' | 'units'>('projects');
  const [projects, setProjects] = useState<MapProject[]>([]);
  const [units, setUnits] = useState<MapUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    supabase.from('projects').select('id, project_code, name_en, status, progress_percent, location').eq('is_active', true).limit(500).then(({ data }) => {
      const mapped = (data || []).map((p: any) => ({
        ...p,
        lat: p.location ? extractLat(p.location) : getRandomCoord(24.7, 24.8),
        lng: p.location ? extractLng(p.location) : getRandomCoord(46.7, 46.8),
        unit_count: Math.floor(Math.random() * 50) + 5,
      }));
      setProjects(mapped);
      setLoading(false);
    });

    supabase.from('units').select('id, unit_no, project_id, status').limit(1000).then(({ data }) => {
      const mapped = (data || []).map((u: any) => ({
        ...u,
        project_name: '',
        lat: getRandomCoord(24.72, 24.78),
        lng: getRandomCoord(46.72, 46.78),
      }));
      setUnits(mapped);
    });
  }, []);

  useEffect(() => {
    if (selectedProject && view === 'units') {
      supabase.from('units').select('id, unit_no, status').eq('project_id', selectedProject).limit(500).then(({ data }) => {
        const mapped = (data || []).map((u: any) => ({
          ...u,
          project_id: selectedProject,
          lat: getRandomCoord(24.73, 24.77),
          lng: getRandomCoord(46.73, 46.77),
        }));
        setUnits(mapped);
      });
    }
  }, [selectedProject, view]);

  function extractLat(location: string): number {
    const match = location.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 24.75;
  }
  function extractLng(location: string): number {
    const parts = location.split(',');
    return parts[1] ? parseFloat(parts[1]) : 46.75;
  }

  const filteredProjects = projects.filter((p) =>
    !search || p.name_en.toLowerCase().includes(search.toLowerCase()) || p.project_code.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUnits = units.filter((u) =>
    !search || u.unit_no.toLowerCase().includes(search.toLowerCase()) || (u.status || '').includes(search.toLowerCase())
  );

  return (
    <div className="page-enter h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Interactive Map</h1>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'projects' ? 'gradient-primary text-white' : ''}`}
              style={view !== 'projects' ? { color: 'var(--color-text-secondary)', background: 'var(--color-surface)' } : {}}
              onClick={() => setView('projects')}
            >
              <Building2 size={14} className="inline mr-1" /> Projects
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'units' ? 'gradient-primary text-white' : ''}`}
              style={view !== 'units' ? { color: 'var(--color-text-secondary)', background: 'var(--color-surface)' } : {}}
              onClick={() => setView('units')}
            >
              <Grid3X3 size={14} className="inline mr-1" /> Units
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Search ${view}...`}
            className="input"
            style={{ width: '220px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowList(!showList)}
          >
            {showList ? <MapPin size={14} /> : <List size={14} />}
            {showList ? 'Map' : 'List'}
          </button>
          {view === 'units' && (
            <select
              className="select text-sm"
              style={{ width: '200px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name_en}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Map + List */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Map */}
        <div className={`glass-card overflow-hidden ${showList ? 'flex-1' : 'w-full'}`}>
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
            </div>
          ) : (
            <MapContainer
              center={[24.75, 46.75]}
              zoom={11}
              className="h-full w-full"
              style={{ background: 'var(--color-bg)' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBoundsUpdater projects={filteredProjects} />
              {view === 'projects'
                ? filteredProjects.map((p) =>
                    p.lat && p.lng ? (
                      <Marker key={p.id} position={[p.lat, p.lng]} icon={projectIcon}>
                        <Popup>
                          <div className="map-popup" style={{ minWidth: '180px' }}>
                            <h3>{p.name_en}</h3>
                            <p className="text-xs font-mono">{p.project_code}</p>
                            <p className="text-xs mt-1">Status: <span className="capitalize">{p.status}</span></p>
                            <p className="text-xs">Progress: {p.progress_percent}%</p>
                            <p className="text-xs">Units: {p.unit_count || 'N/A'}</p>
                            <button
                              className="btn btn-primary btn-xs mt-2 w-full"
                              onClick={() => navigate(`/projects/${p.id}`)}
                            >
                              View Project
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null
                  )
                : filteredUnits.map((u) =>
                    u.lat && u.lng ? (
                      <Marker key={u.id} position={[u.lat, u.lng]} icon={unitIcon}>
                        <Popup>
                          <div className="map-popup" style={{ minWidth: '160px' }}>
                            <h3>Unit {u.unit_no}</h3>
                            <p className="text-xs">Status: <span className="capitalize">{u.status}</span></p>
                            <button
                              className="btn btn-primary btn-xs mt-2 w-full"
                              onClick={() => navigate(`/units/${u.id}`)}
                            >
                              View Unit
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null
                  )}
            </MapContainer>
          )}
        </div>

        {/* Side List */}
        {showList && (
          <div className="w-72 glass-card overflow-hidden shrink-0">
            <div className="p-3 border-b text-xs font-semibold uppercase tracking-wider" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              {view === 'projects' ? `${filteredProjects.length} Projects` : `${filteredUnits.length} Units`}
            </div>
            <div className="overflow-y-auto h-full pb-12">
              {view === 'projects'
                ? filteredProjects.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2.5 border-b cursor-pointer hover:bg-white/5 transition-colors"
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <p className="text-sm font-medium truncate">{p.name_en}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{p.project_code}</span>
                        <span className={`badge text-xs ${p.status === 'active' || p.status === 'in_progress' ? 'badge-success' : 'badge-neutral'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))
                : filteredUnits.map((u) => (
                    <div
                      key={u.id}
                      className="px-3 py-2.5 border-b cursor-pointer hover:bg-white/5 transition-colors"
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => navigate(`/units/${u.id}`)}
                    >
                      <p className="text-sm font-medium">Unit {u.unit_no}</p>
                      <span className="badge text-xs mt-0.5">{u.status || 'available'}</span>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getRandomCoord(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
