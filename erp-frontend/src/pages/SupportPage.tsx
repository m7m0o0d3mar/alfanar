import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  TicketCheck, Plus, Search, Phone, Mail, MessageSquare,
  Globe, AlertTriangle, CheckCircle, XCircle,
  MessageCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';
import Pagination from '../components/Pagination';

interface Ticket {
  id: string; ticket_number: string; subject: string; description?: string;
  channel: string; priority: string; severity: string; status: string;
  category?: string; contact_id?: string; company_id?: string;
  assigned_to?: string; assigned_name?: string; created_by?: string;
  sla_respond_by?: string; sla_resolve_by?: string; first_responded_at?: string;
  resolved_at?: string; is_escalated: boolean; tags?: string[];
  created_at: string; project_id?: string;
}

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  web: Globe, email: Mail, phone: Phone, whatsapp: MessageCircle, chat: MessageSquare, portal: Globe,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'badge-success', medium: 'badge-warning', high: 'badge-danger', urgent: 'badge-danger',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'badge-info', in_progress: 'badge-warning', waiting_customer: 'badge-neutral',
  waiting_third_party: 'badge-neutral', resolved: 'badge-success', closed: 'badge', cancelled: 'badge-danger',
};

const PER_PAGE = 20;

const defaultForm = {
  subject: '', description: '', channel: 'web', priority: 'medium', severity: 'minor',
  category: '', contact_id: '', company_id: '', assigned_to: '', project_id: '',
};

export default function SupportPage() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const toast = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState('');
  const [stats, setStats] = useState<{ label: string; value: number; color: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; project_code: string }[]>([]);
  const [filterProject, setFilterProject] = useState('');

  const priorityFilter = ['low', 'medium', 'high', 'urgent'];
  const channelFilter = ['web', 'email', 'phone', 'whatsapp', 'chat', 'portal'];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTickets(); }, [page, search, filterProject]);

  async function loadTickets() {
    setLoading(true);
    try {
      let q = supabase
        .from('support_tickets')
        .select('*', { count: 'exact' });

      if (filterProject) {
        q = q.eq('project_id', filterProject);
      }

      if (search) {
        q = q.or(`subject.ilike.%${search}%,ticket_number.ilike.%${search}%`);
      }

      const { data, count, error } = await q
        .order('created_at', { ascending: false })
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

      if (error) throw error;
      setTickets(data || []);
      setTotal(count || 0);

      const { data: projData } = await supabase.from('projects').select('id, project_code').eq('is_active', true).order('project_code');
      setProjects(projData || []);

      const { data: statsData } = await supabase.from('v_support_kpis').select('*').single();
      if (statsData) {
        setStats([
          { label: 'Open', value: statsData.open_tickets, color: '#3b82f6' },
          { label: 'In Progress', value: statsData.in_progress_tickets, color: '#f59e0b' },
          { label: 'Resolved', value: statsData.resolved_tickets, color: '#22c55e' },
          { label: 'Urgent', value: statsData.urgent_open_tickets, color: '#ef4444' },
          { label: 'Escalated', value: statsData.escalated_tickets, color: '#8b5cf6' },
          { label: '7 Days', value: statsData.tickets_7d, color: '#14b8a6' },
        ]);
      }
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim()) { setFormError('Subject is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const ticketNumber = `TKT-${Date.now().toString().slice(-5)}`;
      const { error } = await supabase.from('support_tickets').insert({
        ticket_number: ticketNumber,
        subject: form.subject,
        description: form.description || null,
        channel: form.channel,
        priority: form.priority,
        severity: form.severity,
        category: form.category || null,
        assigned_to: form.assigned_to || null,
        created_by: user?.id,
        project_id: form.project_id || null,
      });
      if (error) throw error;
      toast.success('Ticket created');
      setShowForm(false);
      setForm(defaultForm);
      loadTickets();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(ticketId: string, newStatus: string) {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
      if (newStatus === 'closed') updates.closed_at = new Date().toISOString();
      if (!tickets.find(t => t.id === ticketId)?.first_responded_at && newStatus !== 'open') {
        updates.first_responded_at = new Date().toISOString();
      }
      const { error } = await supabase.from('support_tickets').update(updates).eq('id', ticketId);
      if (error) throw error;
      toast.success(`Ticket ${newStatus.replace(/_/g, ' ')}`);
      loadTickets();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const channelIcon = (ch: string) => {
    const Icon = CHANNEL_ICONS[ch] || Globe;
    return <Icon size={14} />;
  };

  return (
    <div className="page-enter space-y-6">
      <div className="welcome-gradient p-6 md:p-8">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
              <TicketCheck size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Support Tickets</h1>
              <p className="text-sm text-white/80">Omnichannel case management</p>
            </div>
          </div>
          {hasPermission('support', 'create') && <button className="btn-sm" style={{ backgroundColor: 'white', color: 'var(--color-primary)' }} onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Ticket
          </button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />) :
          stats.map((s) => (
            <div key={s.label} className="stat-glass">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                  <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select className="select text-sm" style={{ width: '150px' }} value={filterProject} onChange={e => { setFilterProject(e.target.value); setPage(1); }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              className="input ps-9"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Subject</th>
                <th>Channel</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Project</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8">Loading...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'No matching tickets found' : 'No tickets yet — create your first ticket'}
                </td></tr>
              ) : tickets.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => setDetailTicket(t)}>
                  <td className="font-mono text-xs">{t.ticket_number}</td>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      {t.is_escalated && <AlertTriangle size={14} style={{ color: '#ef4444' }} />}
                      {t.subject}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-xs">
                      {channelIcon(t.channel)} {t.channel}
                    </div>
                  </td>
                  <td><span className={`badge ${PRIORITY_COLORS[t.priority] || 'badge'}`}>{t.priority}</span></td>
                  <td><span className={`badge ${STATUS_COLORS[t.status] || 'badge'}`}>{t.status.replace(/_/g, ' ')}</span></td>
                  <td className="text-xs">{projects.find(p => p.id === t.project_id)?.project_code || '-'}</td>
                  <td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {t.status === 'open' && (
                        <button className="btn-xs btn-secondary" onClick={() => updateStatus(t.id, 'in_progress')}>
                          <Play size={12} /> Start
                        </button>
                      )}
                      {['in_progress', 'waiting_customer'].includes(t.status) && (
                        <button className="btn-xs btn-secondary" onClick={() => updateStatus(t.id, 'resolved')}>
                          <CheckCircle size={12} /> Resolve
                        </button>
                      )}
                      {t.status === 'resolved' && (
                        <button className="btn-xs btn-secondary" onClick={() => updateStatus(t.id, 'closed')}>
                          <XCircle size={12} /> Close
                        </button>
                      )}
                      <button className="btn-xs" style={{ backgroundColor: '#25D36615', color: '#25D366' }} onClick={() => navigate('/whatsapp')} title="Reply via WhatsApp">
                        <MessageCircle size={12} /> WA
                      </button>
                    </div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > PER_PAGE && (
          <Pagination page={page} total={total} pageSize={PER_PAGE} onChange={setPage} />
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !saving && setShowForm(false)}>
          <div className="glass-card p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create New Ticket</h2>
            {formError && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{formError}</p>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="label">Subject *</label>
                <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of the issue" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Channel</label>
                  <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                    {channelFilter.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {priorityFilter.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Technical, Billing, General" />
              </div>
              <div>
                <label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-sm btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-sm" disabled={saving}>{saving ? 'Creating...' : 'Create Ticket'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailTicket(null)}>
          <div className="glass-card p-6 w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TicketCheck size={18} />
                <h2 className="text-lg font-semibold">{detailTicket.ticket_number}</h2>
              </div>
              <button className="btn-xs btn-secondary" onClick={() => setDetailTicket(null)}>Close</button>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium text-base">{detailTicket.subject}</h3>
              {detailTicket.description && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{detailTicket.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Status</span><br /><span className={`badge ${STATUS_COLORS[detailTicket.status] || 'badge'}`}>{detailTicket.status.replace(/_/g, ' ')}</span></div>
                <div><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Priority</span><br /><span className={`badge ${PRIORITY_COLORS[detailTicket.priority] || 'badge'}`}>{detailTicket.priority}</span></div>
                <div><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Channel</span><br /><span className="flex items-center gap-1">{channelIcon(detailTicket.channel)} {detailTicket.channel}</span></div>
                <div><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Category</span><br />{detailTicket.category || '-'}</div>
                <div><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Project</span><br />{projects.find(p => p.id === detailTicket.project_id)?.project_code || '-'}</div>
                <div><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Created</span><br />{new Date(detailTicket.created_at).toLocaleString()}</div>
                {detailTicket.sla_resolve_by && (
                  <div><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>SLA Deadline</span><br />{new Date(detailTicket.sla_resolve_by).toLocaleString()}</div>
                )}
              </div>
              {detailTicket.is_escalated && (
                <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#fef2f2' }}>
                  <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                  <span className="text-sm font-medium" style={{ color: '#991b1b' }}>Escalated</span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {detailTicket.status === 'open' && <button className="btn-sm" onClick={() => { updateStatus(detailTicket.id, 'in_progress'); setDetailTicket(null); }}>Start Progress</button>}
                {['in_progress', 'waiting_customer'].includes(detailTicket.status) && <button className="btn-sm" style={{ backgroundColor: '#22c55e' }} onClick={() => { updateStatus(detailTicket.id, 'resolved'); setDetailTicket(null); }}>Resolve</button>}
                {detailTicket.status === 'resolved' && <button className="btn-sm btn-secondary" onClick={() => { updateStatus(detailTicket.id, 'closed'); setDetailTicket(null); }}>Close</button>}
                {!detailTicket.is_escalated && <button className="btn-sm btn-secondary" style={{ color: '#ef4444' }} onClick={() => { updateStatus(detailTicket.id, detailTicket.status); setDetailTicket(null); toast.info('Escalation requested'); }}>Escalate</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Play({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
