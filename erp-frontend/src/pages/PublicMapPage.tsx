import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';

interface MapProject {
  id: string; name_en: string; name_ar: string | null;
  project_code: string; location: string | null;
  latitude: number | null; longitude: number | null;
  project_type: string | null; status: string;
  progress_percent: number | null;
  unit_count?: number;
}

function FitBounds({ projects }: { projects: MapProject[] }) {
  const map = useMap();
  useEffect(() => {
    if (projects.length === 0) return;
    const valid = projects.filter(p => p.latitude && p.longitude).map(p => [p.latitude!, p.longitude!] as [number, number]);
    if (valid.length === 0) return;
    try {
      map.whenReady(() => {
        map.fitBounds(valid, { padding: [40, 40], maxZoom: 14 });
      });
    } catch { }
  }, [map, projects]);
  return null;
}

function createDivIcon(label: string, type: string) {
  const colors: Record<string, string> = {
    residential: '#6366f1',
    commercial: '#f59e0b',
    mixed: '#10b981',
    infrastructure: '#06b6d4',
  };
  const bg = colors[type] || '#6366f1';
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:white;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.8);cursor:pointer">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [20, 20],
  });
}

export default function PublicMapPage() {
  const t = useT();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<MapProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    document.title = 'Interactive Map | Property Portal';
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: projData } = await supabase
          .from('projects')
          .select('id, name_en, name_ar, project_code, location, latitude, longitude, project_type, status, progress_percent')
          .eq('is_active', true)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('name_en');
        if (!projData) { setLoading(false); return; }
        const unitCounts: Record<string, number> = {};
        const { data: units } = await supabase
          .from('units')
          .select('project_id')
          .eq('is_published', true);
        if (units) {
          for (const u of units) {
            unitCounts[u.project_id] = (unitCounts[u.project_id] || 0) + 1;
          }
        }
        setProjects(projData.map(p => ({
          ...p,
          unit_count: unitCounts[p.id] || 0,
        })));
      } catch (err) {
        console.error('Public map data load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = projects.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name_en.toLowerCase().includes(q) ||
      (p.name_ar && p.name_ar.toLowerCase().includes(q)) ||
      (p.project_code && p.project_code.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q));
  });

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b z-20" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{t('public_portal.map_title') || 'Property Map'}</h1>
          <a href="/public-properties" className="text-xs underline opacity-70 hover:opacity-100">{t('public_portal.back_to_listing') || 'Back to Listing'}</a>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" placeholder={t('public_portal.map_search_placeholder') || 'Search projects...'}
              className="input text-xs" style={{ width: 200, padding: '0.3rem 0.5rem 0.3rem 1.6rem' }}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-sm btn-secondary text-xs" onClick={() => setShowList(!showList)}>
            {showList ? 'Map' : 'List'}
          </button>
          <a href="/login" className="btn-sm btn-primary text-xs">{t('public_portal.login')}</a>
        </div>
      </header>

      <div className="flex-1 relative">
        {showList ? (
          <div className="p-4 overflow-y-auto h-full">
            <div className="max-w-2xl mx-auto space-y-2">
              {filtered.map(p => (
                <div key={p.id} className="glass-card rounded-lg p-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/public-properties?project=${p.id}`)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{p.name_en}</div>
                      <div className="text-xs opacity-70 mt-0.5">{p.location || p.project_type}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold">{p.unit_count || 0} units</div>
                      <div className="text-[10px] opacity-60">{p.status}</div>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center py-8 text-sm opacity-60">{t('public_portal.no_properties') || 'No properties found'}</p>
              )}
            </div>
          </div>
        ) : (
          <MapContainer center={[24.75, 46.75]} zoom={6} className="h-full w-full" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds projects={filtered} />
            {filtered.filter(p => p.latitude && p.longitude).map(p => (
              <Marker key={p.id} position={[p.latitude!, p.longitude!]}
                icon={createDivIcon(p.project_code || p.name_en, p.project_type || 'residential')}>
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <h3 className="font-bold text-sm">{p.name_en}</h3>
                    {p.name_ar && <p className="text-xs opacity-70" dir="rtl">{p.name_ar}</p>}
                    <div className="mt-2 space-y-1 text-xs">
                      <div><strong>Location:</strong> {p.location || 'N/A'}</div>
                      <div><strong>Type:</strong> {p.project_type || 'N/A'}</div>
                      <div><strong>Status:</strong> {p.status}</div>
                      <div><strong>Published units:</strong> {p.unit_count}</div>
                    </div>
                    <button className="btn-primary btn-xs mt-2 w-full text-center"
                      onClick={() => window.location.href = `/public-properties?project=${p.id}`}>
                      View Properties
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
