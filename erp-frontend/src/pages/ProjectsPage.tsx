import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserProjects } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { Search, Plus, Filter, Building2, X, LayoutGrid, Table, Map as MapIcon, List, MapPin, ExternalLink, Globe, User } from 'lucide-react';
import { formatDate } from '../utils/date';
import Pagination from '../components/Pagination';

interface ProjectForm {
  project_code: string;
  name_en: string;
  name_ar: string;
  project_type: string;
  start_date: string;
  end_date: string;
  location: string;
}

export default function ProjectsPage() {
  const { projects, loading, reload } = useUserProjects();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'map'>('table');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
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
  const filteredProjects = projects.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
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

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Create
        </button>
      </div>

      {error && (
<div className="p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{error}</div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input ps-10 rounded-lg" placeholder="Search projects..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} />
        </div>
        <div className="relative">
          <button className="btn-secondary" onClick={() => setShowFilter(!showFilter)}>
            <Filter size={16} /> Filter {filterStatus !== 'all' && <span className="ml-1 w-2 h-2 rounded-full bg-primary inline-block" />}
          </button>
          {showFilter && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-10 w-44 py-1 animate-slide-up">
              {['all', 'planning', 'active', 'completed', 'on_hold'].map((s) => (
                <button
                  key={s}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors ${filterStatus === s ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => { setFilterStatus(s); setShowFilter(false); }}
                >
                  {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-all duration-150 ${viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            title="Table view"
          >
            <Table size={16} />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-md transition-all duration-150 ${viewMode === 'cards' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            title="Card view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`p-2 rounded-md transition-all duration-150 ${viewMode === 'map' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            title="Map view"
          >
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
                <th>Name (English)</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Progress</th>
                <th>Start Date</th>
                <th>End Date</th>
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
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="clickable"
                  >
                    <td className="font-mono text-xs">{p.project_code}</td>
                    <td className="font-medium text-gray-900">{p.name_en}</td>
                    <td>
                      <span className={`badge text-xs ${
                        p.status === 'active' ? 'badge-success' :
                        p.status === 'planning' ? 'badge-info' :
                        p.status === 'completed' ? 'badge-success' :
                        p.status === 'on_hold' ? 'badge-warning' :
                        'badge-neutral'
                      }`}>{p.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      {(p as any).budget_amount != null
                        ? new Intl.NumberFormat('en', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format((p as any).budget_amount)
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
                    <td>{formatDate(p.start_date)}</td>
                    <td>{formatDate(p.end_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredProjects.length} onChange={setPage} />
        </>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
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
              <Link key={p.id} to={`/projects/${p.id}`} className="card hover:shadow-lg transition-all duration-200 cursor-pointer block group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{p.name_en}</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">{p.project_code}</p>
                  </div>
                  <span className={`badge text-xs shrink-0 ml-2 ${
                    p.status === 'active' ? 'badge-success' :
                    p.status === 'planning' ? 'badge-info' :
                    p.status === 'completed' ? 'badge-success' :
                    p.status === 'on_hold' ? 'badge-warning' :
                    'badge-neutral'
                  }`}>{p.status.replace('_', ' ')}</span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                    <span>Progress</span>
                    <span className="font-medium">{p.progress_percent}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${p.progress_percent}%` }} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      ) : null}

      {viewMode === 'map' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><MapIcon size={16} /> Project Site Map</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredProjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">
              <span className="font-medium text-gray-700">Legend:</span>
              <div className="flex items-center gap-1">
                <MapPin size={14} className="text-primary" />
                <span>Has coordinates</span>
              </div>
              <div className="flex items-center gap-1">
                <Globe size={14} className="text-gray-400" />
                <span>No coordinates</span>
              </div>
            </div>
          )}

          {filteredProjects.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MapIcon size={48} className="mx-auto mb-3 opacity-30" />
              <p>No projects to display.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((p) => {
                const lat = (p as any).latitude;
                const lng = (p as any).longitude;
                const hasCoords = lat != null && lng != null;
                return (
                  <div
                    key={p.id}
                    className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
                      hasCoords
                        ? 'border-primary/20 hover:border-primary/40'
                        : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
                    }`}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.name_en}</p>
                        {p.name_ar && <p className="text-xs text-gray-400 truncate" dir="rtl">{p.name_ar}</p>}
                      </div>
                      <span className={`badge text-xs shrink-0 ml-2 ${
                        p.status === 'active' ? 'badge-success' :
                        p.status === 'planning' ? 'badge-info' :
                        p.status === 'completed' ? 'badge-success' :
                        p.status === 'on_hold' ? 'badge-warning' :
                        'badge-neutral'
                      }`}>{p.status.replace('_', ' ')}</span>
                    </div>

                    <p className="text-xs text-gray-500 font-mono mb-3">{p.project_code}</p>

                    {hasCoords ? (
                      <div className="flex items-center gap-1.5 text-sm mb-3 bg-primary/5 rounded-lg p-2">
                        <MapPin size={14} className="text-primary shrink-0" />
                        <span className="text-primary font-medium text-xs">
                          {lat?.toFixed(4)}, {lng?.toFixed(4)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-gray-400 hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="View on Google Maps"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm mb-3 text-gray-400">
                        <Globe size={14} className="shrink-0" />
                        <span className="text-xs">Location not set</span>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 space-y-1">
                      {(p as any).consultant_name && (
                        <div className="flex items-center gap-1">
                          <User size={12} className="shrink-0" />
                          <span className="truncate">Consultant: {(p as any).consultant_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
