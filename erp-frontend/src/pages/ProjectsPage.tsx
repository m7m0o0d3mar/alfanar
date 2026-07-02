import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserProjects } from '../hooks/useData';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { Search, Plus, Filter, Building2, X, LayoutGrid, Table, Map as MapIcon, MapPin, ExternalLink, Check, DollarSign, Calendar, Clock, Activity, CheckCircle, BarChart3 } from 'lucide-react';
import { formatDate } from '../utils/date';
import Pagination from '../components/Pagination';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ProjectForm {
  project_code: string;
  name_en: string;
  name_ar: string;
  project_type: string;
  start_date: string;
  end_date: string;
  location: string;
}

const statusGradients: Record<string, string> = {
  active: 'linear-gradient(135deg, #059669, #10b981)',
  planning: 'linear-gradient(135deg, #2563eb, #3b82f6)',
  completed: 'linear-gradient(135deg, #6b7280, #9ca3af)',
  on_hold: 'linear-gradient(135deg, #d97706, #f59e0b)',
  cancelled: 'linear-gradient(135deg, #dc2626, #ef4444)',
};

const statusColors: Record<string, string> = {
  active: '#10b981',
  planning: '#3b82f6',
  completed: '#9ca3af',
  on_hold: '#f59e0b',
  cancelled: '#ef4444',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  planning: 'Planning',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
};

function ProjectMarkerIcon({ status }: { status: string }) {
  const color = statusColors[status] || '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;box-shadow:0 2px 8px ${color}66;border:2px solid #fff"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });
}

export default function ProjectsPage() {
  const { projects, loading, reload } = useUserProjects();
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'map'>('table');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<ProjectForm>({
    project_code: '', name_en: '', name_ar: '', project_type: 'residential',
    start_date: '', end_date: '', location: '',
  });
  const resetForm = () => setForm({
    project_code: '', name_en: '', name_ar: '', project_type: 'residential',
    start_date: '', end_date: '', location: '',
  });

  useEffect(() => { setPage(1); }, [viewMode]);

  const types = [...new Set(projects.map((p) => p.project_type).filter((t): t is string => !!t))];

  const filteredProjects = projects.filter((p) => {
    if (filterStatuses.length > 0 && !filterStatuses.includes(p.status)) return false;
    if (filterType !== 'all' && p.project_type !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!p.name_en.toLowerCase().includes(q) && !p.project_code.toLowerCase().includes(q) && !(p.name_ar || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data: project, error: insertError } = await supabase
        .from('projects')
        .insert({
          project_code: form.project_code,
          name_en: form.name_en,
          name_ar: form.name_ar,
          project_type: form.project_type,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          location: form.location || null,
          status: 'planning',
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      if (user && project) {
        await supabase.from('user_projects').insert({
          user_id: user.id,
          project_id: project.id,
          project_role: 'owner',
        });
      }

      setShowModal(false);
      resetForm();
      toast.success(`Project "${form.name_en}" created successfully`);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function toggleStatus(s: string) {
    setFilterStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => navigate('/project-analytics')}>
            <BarChart3 size={16} /> Analytics
          </button>
          {hasPermission('projects', 'create') && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> Create
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10" style={{ color: 'var(--color-primary)' }}><Building2 size={18} /></div>
          <div><p className="text-xs text-gray-500">Total Projects</p><p className="text-lg font-bold">{projects.length}</p></div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }}><Activity size={18} /></div>
          <div><p className="text-xs text-gray-500">Active</p><p className="text-lg font-bold">{projects.filter(p => p.status === 'active').length}</p></div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(156,163,175,0.1)', color: '#9ca3af' }}><CheckCircle size={18} /></div>
          <div><p className="text-xs text-gray-500">Completed</p><p className="text-lg font-bold">{projects.filter(p => p.status === 'completed').length}</p></div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(234,179,8,0.1)', color: '#eab308' }}><DollarSign size={18} /></div>
          <div><p className="text-xs text-gray-500">Total Budget</p><p className="text-lg font-bold">{projects.reduce((s, p) => s + ((p as any).budget_amount || 0), 0).toLocaleString()} SAR</p></div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input ps-10 rounded-lg" placeholder="Search projects..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} />
        </div>
        <div className="relative">
          <button className="btn-secondary" onClick={() => setShowFilter(!showFilter)}>
            <Filter size={16} /> Filter {filterStatuses.length > 0 && <span className="ml-1 w-2 h-2 rounded-full bg-primary inline-block" />}
          </button>
          {showFilter && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-10 w-56 py-2 animate-slide-up">
              <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</div>
              {['planning', 'active', 'completed', 'on_hold', 'cancelled'].map((s) => (
                <button
                  key={s}
                  className="flex items-center gap-2 w-full text-left px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleStatus(s)}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${filterStatuses.includes(s) ? 'border-primary bg-primary' : 'border-gray-300'}`}
                    style={filterStatuses.includes(s) ? { borderColor: statusColors[s], backgroundColor: statusColors[s] } : {}}>
                    {filterStatuses.includes(s) && <Check size={12} className="text-white" />}
                  </div>
                  <span className="capitalize">{s.replace('_', ' ')}</span>
                </button>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</div>
                <button className={`block w-full text-left px-4 py-1.5 text-sm transition-colors ${filterType === 'all' ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setFilterType('all')}>All Types</button>
                {types.map((t) => (
                  <button key={t} className={`block w-full text-left px-4 py-1.5 text-sm capitalize transition-colors ${filterType === t ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                    onClick={() => setFilterType(t)}>{t.replace('_', ' ')}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-all duration-150 ${viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`} title="Table view">
            <Table size={16} />
          </button>
          <button onClick={() => setViewMode('cards')}
            className={`p-2 rounded-md transition-all duration-150 ${viewMode === 'cards' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`} title="Card view">
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode('map')}
            className={`p-2 rounded-md transition-all duration-150 ${viewMode === 'map' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`} title="Map view">
            <MapIcon size={16} />
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Budget</th>
                  <th>Progress</th>
                  <th>Timeline</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j}><div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-gray-400">
                      <Building2 size={48} className="mx-auto mb-3 opacity-30" />
                      <p>No projects match your filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredProjects.slice((page - 1) * pageSize, page * pageSize).map((p) => (
                    <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="clickable">
                      <td className="font-mono text-xs">{p.project_code}</td>
                      <td className="font-medium text-gray-900">
                        {p.name_en}
                        {p.name_ar && <span className="text-xs text-gray-400 mr-1" dir="rtl"> / {p.name_ar}</span>}
                      </td>
                      <td className="text-sm text-gray-500 capitalize">{p.project_type?.replace('_', ' ') || '-'}</td>
                      <td>
                        <span className={`badge text-xs ${
                          p.status === 'active' ? 'badge-success' :
                          p.status === 'planning' ? 'badge-info' :
                          p.status === 'completed' ? 'badge-neutral' :
                          p.status === 'on_hold' ? 'badge-warning' :
                          'badge-danger'
                        }`}>{statusLabels[p.status] || p.status}</span>
                      </td>
                      <td className="text-sm font-medium">
                        {p.budget_amount != null
                          ? `${p.budget_amount.toLocaleString()} SAR`
                          : '-'}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress-bar" style={{ width: '5rem' }}>
                            <div className="progress-bar-fill" style={{ width: `${p.progress_percent}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-600">{p.progress_percent}%</span>
                        </div>
                      </td>
                      <td className="text-xs text-gray-500">
                        {p.start_date ? formatDate(p.start_date) : '?'} &rarr; {p.end_date ? formatDate(p.end_date) : '?'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filteredProjects.length} onChange={setPage} />
        </>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-20 rounded-t-xl mb-3" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full text-center py-20 text-gray-400">
              <Building2 size={48} className="mx-auto mb-3 opacity-30" />
              <p>No projects match your filters.</p>
            </div>
          ) : (
            filteredProjects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="block card overflow-hidden hover:shadow-lg transition-all duration-200 group">
                <div className="h-20 relative" style={{ background: statusGradients[p.status] || '#6b7280' }}>
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                    <span className="text-white/90 text-xs font-medium uppercase tracking-wider">{statusLabels[p.status] || p.status}</span>
                    <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-mono px-2 py-0.5 rounded">{p.project_code}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{p.name_en}</h3>
                  {p.name_ar && <p className="text-xs text-gray-400 mt-0.5" dir="rtl">{p.name_ar}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="badge text-xs capitalize bg-gray-100 text-gray-600">{p.project_type?.replace('_', ' ') || 'N/A'}</span>
                    {p.location && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} />{p.location}</span>}
                  </div>
                  {p.budget_amount != null && (
                    <div className="mt-3 flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                      <DollarSign size={14} />
                      {p.budget_amount.toLocaleString()} SAR
                    </div>
                  )}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                      <span>Progress</span>
                      <span className="font-semibold" style={{ color: statusColors[p.status] || '#6b7280' }}>{p.progress_percent}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p.progress_percent}%`, background: statusGradients[p.status] || '#6b7280' }} />
                    </div>
                  </div>
                  {(p.start_date || p.end_date) && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                      {p.start_date && <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(p.start_date)}</span>}
                      {p.end_date && <span className="flex items-center gap-1"><Clock size={11} />{formatDate(p.end_date)}</span>}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      ) : null}

      {viewMode === 'map' && (
        <div className="card overflow-hidden p-0" style={{ height: '600px' }}>
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-sm flex items-center gap-3">
            <span className="font-medium text-gray-700">{filteredProjects.length} projects</span>
            <span className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              {Object.entries(statusColors).map(([s, c]) => (
                <div key={s} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                  <span className="text-xs text-gray-500 capitalize">{s.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
          {filteredProjects.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <MapIcon size={48} className="mx-auto mb-3 opacity-30" />
              <p>No projects to display.</p>
            </div>
          ) : (
            <MapContainer center={[24.75, 46.75]} zoom={11} className="h-full w-full" style={{ background: 'var(--color-bg)' }}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {filteredProjects.map((p) => {
                const lat = p.latitude;
                const lng = p.longitude;
                if (lat == null || lng == null) return null;
                return (
                  <Marker key={p.id} position={[lat, lng]} icon={ProjectMarkerIcon({ status: p.status })}>
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        <h3 className="font-semibold text-gray-900">{p.name_en}</h3>
                        <p className="text-xs font-mono text-gray-500">{p.project_code}</p>
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[p.status] || '#6b7280' }} />
                            <span className="text-xs capitalize">{statusLabels[p.status] || p.status}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <div className="progress-bar flex-1" style={{ height: '6px' }}>
                              <div className="progress-bar-fill" style={{ width: `${p.progress_percent}%` }} />
                            </div>
                            <span className="font-medium">{p.progress_percent}%</span>
                          </div>
                          {p.budget_amount != null && (
                            <p className="text-xs text-gray-500">Budget: {p.budget_amount.toLocaleString()} SAR</p>
                          )}
                          {p.location && <p className="text-xs text-gray-400">{p.location}</p>}
                        </div>
                        <button className="btn-primary btn-xs w-full mt-3 text-center" onClick={() => navigate(`/projects/${p.id}`)}>
                          <ExternalLink size={12} /> View Project
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="modal max-w-lg max-h-[90vh] flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between pb-4 mb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="text-lg font-bold">Create Project</h2>
              <button onClick={() => setShowModal(false)} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Project Code *</label>
                  <input className="input" required value={form.project_code}
                    onChange={(e) => setForm({ ...form, project_code: e.target.value })} placeholder="PRJ-001" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.project_type}
                    onChange={(e) => setForm({ ...form, project_type: e.target.value })}>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="mixed_use">Mixed Use</option>
                    <option value="government">Government</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Name (English) *</label>
                <input className="input" required value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Al-Fanar Tower" />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input className="input text-right" dir="rtl" value={form.name_ar}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="برج الفنار" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Riyadh, Saudi Arabia" />
              </div>
              {error && <div className="p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
