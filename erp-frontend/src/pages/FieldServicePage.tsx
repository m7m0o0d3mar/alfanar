import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { Search, Plus, Eye, Trash2, Wrench, Settings, Clock, Download, BarChart3 } from 'lucide-react';
import Pagination from '../components/Pagination';
import { exportCSV } from '../utils/csv';

interface KpiData { workOrders: number; openWo: number; equipment: number; totalHours: number; }
interface WorkOrder { id: string; wo_no: string; title: string; priority: string; status: string; scheduled_date: string; assigned_technician: string; total_cost: number; project_id?: string; project?: { project_code: string; name_en: string }; }
interface Equipment { id: string; equipment_code: string; name: string; model: string; serial_number: string; status: string; customer_id: string; project_id?: string; project?: { project_code: string; name_en: string }; }
interface TimeEntry { id: string; employee_id: string; work_order_id: string; clock_in: string; clock_out: string; total_hours: number; latitude: number; longitude: number; project_id?: string; project?: { project_code: string; name_en: string }; }

export default function FieldServicePage() {
  const [kpi, setKpi] = useState<KpiData>({ workOrders: 0, openWo: 0, equipment: 0, totalHours: 0 });
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [tab, setTab] = useState<'work-orders' | 'equipment' | 'time'>('work-orders');

  const loadKpi = useCallback(async () => {
    try {
      const [woRes, eqRes, timeRes] = await Promise.all([
        supabase.from('fs_work_orders').select('status'),
        supabase.from('fs_equipment').select('id', { count: 'exact', head: true }),
        supabase.from('fs_time_entries').select('total_hours'),
      ]);
      const hours = (timeRes.data || []).reduce((sum: number, e: any) => sum + (e.total_hours || 0), 0);
      setKpi({
        workOrders: woRes.data?.length || 0,
        openWo: (woRes.data || []).filter((w: any) => !['completed', 'cancelled'].includes(w.status)).length,
        equipment: eqRes.count ?? 0,
        totalHours: Math.round(hours * 10) / 10,
      });
    } catch { console.error('FieldService KPI load failed'); }
    finally { setLoadingKpi(false); }
  }, []);

  useEffect(() => { loadKpi(); }, [loadKpi]);

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Field Service</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Work Orders', value: kpi.workOrders, icon: Wrench, color: '#3B82F6' },
          { label: 'Open Orders', value: kpi.openWo, icon: BarChart3, color: '#F59E0B' },
          { label: 'Equipment', value: kpi.equipment, icon: Settings, color: '#22C55E' },
          { label: 'Hours Logged', value: `${kpi.totalHours}h`, icon: Clock, color: '#8B5CF6' },
        ].map((c) => (
          <div key={c.label} className="card p-4 flex items-center gap-3" style={{ opacity: loadingKpi ? 0.5 : 1 }}>
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${c.color}15` }}><c.icon size={20} style={{ color: c.color }} /></div>
            <div><p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.label}</p><p className="text-xl font-bold">{c.value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b pb-0" style={{ borderColor: 'var(--color-border)' }}>
        {([
          { key: 'work-orders' as const, label: 'Work Orders', icon: Wrench },
          { key: 'equipment' as const, label: 'Equipment', icon: Settings },
          { key: 'time' as const, label: 'Time Tracking', icon: Clock },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 -mb-px ${tab === key ? '' : 'opacity-60 hover:opacity-80'}`}
            style={{ backgroundColor: tab === key ? 'var(--color-surface)' : 'transparent', borderColor: 'var(--color-border)', color: tab === key ? 'var(--color-primary)' : 'var(--color-text)' }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'work-orders' && <WorkOrdersTab />}
      {tab === 'equipment' && <EquipmentTab />}
      {tab === 'time' && <TimeTab />}
    </div>
  );
}

function WorkOrdersTab() {
  const { hasPermission } = useAuth();
  const t = useT();
  const toast = useToast();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [projects, setProjects] = useState<{ id: string; project_code: string; name_en: string }[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const pid = sp.get('project_id'); if (pid) setFilterProject(pid); }, [sp]);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', status: 'pending', scheduled_date: '', project_id: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [woRes, projRes] = await Promise.all([
        supabase.from('fs_work_orders').select('*, project:projects(project_code, name_en)').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, project_code, name_en').order('project_code'),
      ]);
      setOrders((woRes.data || []) as WorkOrder[]);
      setProjects((projRes.data || []) as { id: string; project_code: string; name_en: string }[]);
    } catch { toast.error('Failed to load work orders'); }
    finally { setLoading(false); }
  }

  async function save() {
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('fs_work_orders').insert({
        title: form.title, description: form.description, priority: form.priority, status: form.status,
        scheduled_date: form.scheduled_date || null, project_id: form.project_id || null,
      });
      if (error) throw error;
      toast.success(`Work order created`);
      setShowForm(false); setForm({ title: '', description: '', priority: 'medium', status: 'pending', scheduled_date: '', project_id: '' }); load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  const filtered = orders.filter((o) =>
    (!search || o.title.toLowerCase().includes(search.toLowerCase()) || o.wo_no.toLowerCase().includes(search.toLowerCase())) &&
    (!filterProject || o.project_id === filterProject)
  );
  const getPriorityBadge = (p: string) => {
    const m: Record<string, string> = { low: 'badge', medium: 'badge-warning', high: 'badge-danger', urgent: 'badge-danger' };
    return m[p] || 'badge';
  };
  const getStatusBadge = (s: string) => {
    const m: Record<string, string> = { pending: 'badge', scheduled: 'badge-info', in_progress: 'badge-warning', completed: 'badge-success', cancelled: 'badge' };
    return m[s] || 'badge';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `work_orders_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> Export
          </button>
          {hasPermission('field-service', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Work Order
          </button>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr><th>WO No</th><th>Title</th><th>Project</th><th>Priority</th><th>Status</th><th>Scheduled</th><th>Cost</th><th>{t('common.actions')}</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No work orders yet</td></tr>
            ) : (
              filtered.slice((page - 1) * pageSize, page * pageSize).map((wo) => (
                <tr key={wo.id}>
                  <td className="font-mono text-xs">{wo.wo_no}</td>
                  <td className="font-medium">{wo.title}</td>
                  <td className="text-xs">{(wo as any).project?.project_code || '-'}</td>
                  <td><span className={`badge capitalize ${getPriorityBadge(wo.priority)}`}>{wo.priority}</span></td>
                  <td><span className={`badge capitalize ${getStatusBadge(wo.status)}`}>{wo.status}</span></td>
                  <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{wo.scheduled_date || '-'}</td>
                  <td className="font-mono text-sm">{wo.total_cost ? `${wo.total_cost.toFixed(2)} SAR` : '-'}</td>
                  <td>
                    <button className="btn-sm btn-secondary" onClick={() => toast.info(`WO: ${wo.wo_no} – ${wo.title}`)} title="View"><Eye size={14} /></button>
                    <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={async () => { try { await supabase.from('work_orders').delete().eq('id', wo.id); toast.success('Deleted'); load(); } catch { toast.error('Delete failed'); } }} title="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Work Order</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div><label className="label">Scheduled Date</label><input type="date" className="input" value={form.scheduled_date} onChange={(e) => setForm({...form, scheduled_date: e.target.value})} /></div>
              <div>
                <label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})}>
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EquipmentTab() {
  const { hasPermission } = useAuth();
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<Equipment[]>([]);
  const [projects, setProjects] = useState<{ id: string; project_code: string; name_en: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const pid = sp.get('project_id'); if (pid) setFilterProject(pid); }, [sp]);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', equipment_code: '', model: '', serial_number: '', status: 'active', project_id: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [res, projRes] = await Promise.all([
        supabase.from('fs_equipment').select('*, project:projects(project_code, name_en)').order('name'),
        supabase.from('projects').select('id, project_code, name_en').order('project_code'),
      ]);
      setItems((res.data || []) as Equipment[]);
      setProjects((projRes.data || []) as { id: string; project_code: string; name_en: string }[]);
    } catch { toast.error('Failed to load equipment'); }
    finally { setLoading(false); }
  }

  async function save() {
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (!form.equipment_code.trim()) { setFormError('Code is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('fs_equipment').insert({
        name: form.name, equipment_code: form.equipment_code, model: form.model,
        serial_number: form.serial_number, status: form.status,
        project_id: form.project_id || null,
      });
      if (error) throw error;
      toast.success(`Equipment "${form.name}" created`);
      setShowForm(false); setForm({ name: '', equipment_code: '', model: '', serial_number: '', status: 'active', project_id: '' }); load();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Save failed'; setFormError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  const filtered = items.filter((i) =>
    (!search || i.name.toLowerCase().includes(search.toLowerCase()) || i.equipment_code.toLowerCase().includes(search.toLowerCase()) || i.serial_number?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterProject || i.project_id === filterProject)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input max-w-[200px]" value={filterProject} onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as any, `equipment_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> Export
          </button>
          {hasPermission('field-service', 'create') && <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Equipment
          </button>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Project</th><th>Model</th><th>Serial No</th><th>Status</th><th>{t('common.actions')}</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No equipment registered</td></tr>
            ) : (
              filtered.slice((page - 1) * pageSize, page * pageSize).map((eq) => (
                <tr key={eq.id}>
                  <td className="font-mono text-xs">{eq.equipment_code}</td>
                  <td className="font-medium">{eq.name}</td>
                  <td className="text-xs">{(eq as any).project?.project_code || '-'}</td>
                  <td className="text-sm">{eq.model || '-'}</td>
                  <td className="text-sm font-mono">{eq.serial_number || '-'}</td>
                  <td><span className={`badge capitalize ${eq.status === 'active' ? 'badge-success' : eq.status === 'under_repair' ? 'badge-warning' : 'badge'}`}>{eq.status}</span></td>
                  <td>
                    <button className="btn-sm btn-secondary" onClick={() => toast.info(`Equipment: ${eq.name} (${eq.equipment_code})`)} title="View"><Eye size={14} /></button>
                    <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={async () => { try { await supabase.from('equipment').delete().eq('id', eq.id); toast.success('Deleted'); load(); } catch { toast.error('Delete failed'); } }} title="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Equipment</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
              <div><label className="label">Code *</label><input className="input" value={form.equipment_code} onChange={(e) => setForm({...form, equipment_code: e.target.value})} /></div>
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({...form, project_id: e.target.value})}>
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Model</label><input className="input" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})} /></div>
              <div><label className="label">Serial Number</label><input className="input" value={form.serial_number} onChange={(e) => setForm({...form, serial_number: e.target.value})} /></div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="under_repair">Under Repair</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeTab() {
  const t = useT();
  const toast = useToast();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [clockedInId, setClockedInId] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [gpsStatus, setGpsStatus] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { checkActiveClock(); }, [entries]);

  function checkActiveClock() {
    const active = entries.find(e => !e.clock_out);
    if (active) {
      setClockedInId(active.id);
      setClockInTime(new Date(active.clock_in));
    } else {
      setClockedInId(null);
      setClockInTime(null);
      setElapsed(0);
    }
  }

  useEffect(() => {
    if (!clockInTime) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - clockInTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [clockInTime]);

  async function load() {
    setLoading(true);
    try {
      const res = await supabase.from('fs_time_entries').select('*, project:projects(project_code, name_en)').order('clock_in', { ascending: false });
      setEntries((res.data || []) as TimeEntry[]);
    } catch { toast.error('Failed to load time entries'); }
    finally { setLoading(false); }
  }

  async function clockIn() {
    setGpsStatus('Getting GPS location...');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      setGpsStatus('GPS acquired. Clocking in...');
      const { data: user } = await supabase.auth.getUser();
      const employeeId = user?.user?.id;
      const { error } = await supabase.from('fs_time_entries').insert({
        employee_id: employeeId, clock_in: new Date().toISOString(),
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: `GPS: ${pos.coords.latitude}, ${pos.coords.longitude}`,
      });
      if (error) throw error;
      toast.success('Clocked in successfully');
      setGpsStatus('');
      load();
    } catch (err: any) {
      if (err.code === 1) { toast.error('GPS permission denied. Enable location services.'); setGpsStatus('GPS denied'); }
      else if (err.code === 2) { toast.error('GPS unavailable. Try again.'); setGpsStatus('GPS unavailable'); }
      else { toast.error(err instanceof Error ? err.message : 'Clock in failed'); setGpsStatus(''); }
    }
  }

  async function clockOut() {
    if (!clockedInId) return;
    try {
      const now = new Date().toISOString();
      const { data: entry } = await supabase.from('fs_time_entries').select('clock_in').eq('id', clockedInId).single();
      if (!entry) throw new Error('Time entry not found');
      const hours = (Date.now() - new Date(entry.clock_in).getTime()) / 3600000;
      const { error } = await supabase.from('fs_time_entries').update({
        clock_out: now, total_hours: Math.round(hours * 100) / 100,
      }).eq('id', clockedInId);
      if (error) throw error;
      toast.success(`Clocked out — ${Math.round(hours * 100) / 100}h logged`);
      setClockedInId(null); setClockInTime(null); setElapsed(0);
      load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Clock out failed'); }
  }

  function formatElapsed(sec: number) {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-4">
      {clockedInId ? (
        <div className="card p-4 flex items-center justify-between" style={{ borderLeft: '4px solid #22C55E' }}>
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Clocked In — {formatElapsed(elapsed)}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Since {clockInTime?.toLocaleTimeString()}</p>
          </div>
          <button className="btn-sm" style={{ backgroundColor: '#EF4444', color: 'white' }} onClick={clockOut}>Clock Out</button>
        </div>
      ) : gpsStatus ? (
        <div className="card p-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{gpsStatus}</div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{entries.length} time entries</p>
        <div className="flex gap-2">
          {!clockedInId && !gpsStatus && (
            <button className="btn-primary btn-sm" onClick={clockIn}><Clock size={14} /> Clock In with GPS</button>
          )}
          <button className="btn-sm btn-secondary" onClick={() => { if (entries.length) exportCSV(entries as any, `time_entries_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr><th>Employee</th><th>Work Order</th><th>Project</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>GPS</th><th>{t('common.actions')}</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No time entries yet</td></tr>
            ) : (
              entries.slice((page - 1) * pageSize, page * pageSize).map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.employee_id?.slice(0, 8)}</td>
                  <td className="font-mono text-xs">{e.work_order_id?.slice(0, 8) || '-'}</td>
                  <td className="text-xs">{(e as any).project?.project_code || '-'}</td>
                  <td className="text-sm">{new Date(e.clock_in).toLocaleString()}</td>
                  <td className="text-sm">{e.clock_out ? new Date(e.clock_out).toLocaleString() : <span className="text-green-500 font-semibold">Active</span>}</td>
                  <td className="font-mono text-sm">{e.total_hours ? `${e.total_hours}h` : '-'}</td>
                  <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{(e as any).latitude ? `${(e as any).latitude?.toFixed(4)}, ${(e as any).longitude?.toFixed(4)}` : '-'}</td>
                  <td><button className="btn-sm btn-secondary" onClick={() => toast.info(`Time entry: ${e.total_hours || 0}h on ${new Date(e.clock_in).toLocaleDateString()}`)} title="View"><Eye size={14} /></button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={entries.length} onChange={setPage} />
    </div>
  );
}
