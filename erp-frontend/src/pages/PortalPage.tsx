import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/Avatar';
import {
  TicketCheck, Target, ClipboardList, Phone, Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'badge-success', medium: 'badge-warning', high: 'badge-danger', urgent: 'badge-danger',
};
const STATUS_COLORS: Record<string, string> = {
  open: 'badge-info', in_progress: 'badge-warning', waiting_customer: 'badge-neutral',
  waiting_third_party: 'badge-neutral', resolved: 'badge-success', closed: 'badge', cancelled: 'badge-danger',
};
function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function PortalPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<{ icon: LucideIcon; label: string; value: string; color: string }[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', channel: 'web', priority: 'medium' });
  const [formError, setFormError] = useState('');

  useEffect(() => { loadPortal(); }, []);

  async function loadPortal() {
    setLoading(true);
    try {
      const [ticketRes, dealRes] = await Promise.all([
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('crm_deals').select('*, crm_pipeline_stages!inner(name_en, color)').order('created_at', { ascending: false }).limit(5),
      ]);

      setTickets(ticketRes.data || []);
      setDeals(dealRes.data || []);

      const openTickets = (ticketRes.data || []).filter(t => !['resolved', 'closed', 'cancelled'].includes(t.status)).length;
      const totalDeals = (dealRes.data || []).length;

      const openDealRes = await supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('is_won', false).eq('is_lost', false);
      const pendingTaskRes = await supabase.from('crm_tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending');

      setStats([
        { icon: TicketCheck, label: 'Open Tickets', value: String(openTickets), color: '#3b82f6' },
        { icon: Target, label: 'Active Deals', value: String(openDealRes.count ?? 0), color: '#22c55e' },
        { icon: ClipboardList, label: 'Pending Tasks', value: String(pendingTaskRes.count ?? 0), color: '#f59e0b' },
        { icon: Phone, label: 'Total Interactions', value: String(totalDeals * 3 || '-'), color: '#8b5cf6' },
      ]);
    } catch (err) {
      console.error('Portal load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketForm.subject.trim()) { setFormError('Subject is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const ticketNumber = `TKT-${Date.now().toString().slice(-5)}`;
      const { error } = await supabase.from('support_tickets').insert({
        ticket_number: ticketNumber,
        subject: ticketForm.subject,
        description: ticketForm.description || null,
        channel: ticketForm.channel,
        priority: ticketForm.priority,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Ticket created');
      setShowCreateTicket(false);
      setTicketForm({ subject: '', description: '', channel: 'web', priority: 'medium' });
      loadPortal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="welcome-gradient p-6 md:p-8">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar url={user?.avatar_url} name={user?.full_name_en} email={user?.email} size={48} className="ring-2 ring-white/30" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {getGreeting()}, {user?.full_name_en?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-sm text-white/80">Customer Portal — track your deals and support tickets</p>
            </div>
          </div>
          {hasPermission('portal', 'create') && <button className="btn-sm" style={{ backgroundColor: 'white', color: 'var(--color-primary)' }} onClick={() => setShowCreateTicket(true)}>
            <Plus size={16} /> New Ticket
          </button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />) :
          stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="stat-glass">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{s.value}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TicketCheck size={16} />
              <h2 className="text-lg font-semibold">My Tickets</h2>
            </div>
            <button className="btn-sm btn-secondary" onClick={() => setShowCreateTicket(true)}>
              <Plus size={14} /> New
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No tickets yet</td></tr>
                ) : tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs">{t.ticket_number}</td>
                    <td className="font-medium text-sm">{t.subject}</td>
                    <td><span className={`badge ${PRIORITY_COLORS[t.priority] || 'badge'}`}>{t.priority}</span></td>
                    <td><span className={`badge ${STATUS_COLORS[t.status] || 'badge'}`}>{t.status.replace(/_/g, ' ')}</span></td>
                    <td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} />
            <h2 className="text-lg font-semibold">Active Deals</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Stage</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8">Loading...</td></tr>
                ) : deals.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No deals found</td></tr>
                ) : deals.map((d: any) => (
                  <tr key={d.id}>
                    <td className="font-medium text-sm">{d.deal_name}</td>
                    <td>
                      <span className="badge text-xs" style={{ backgroundColor: `${d.crm_pipeline_stages?.color || '#6B7280'}20`, color: d.crm_pipeline_stages?.color || '#6B7280' }}>
                        {d.crm_pipeline_stages?.name_en || '-'}
                      </span>
                    </td>
                    <td className="text-sm">{new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(Number(d.amount || 0))}</td>
                    <td>
                      {d.is_won ? <span className="badge badge--green">Won</span> :
                       d.is_lost ? <span className="badge badge--red">Lost</span> :
                       <span className="badge badge--yellow">Open</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card hover:shadow-md transition-shadow cursor-pointer p-4" onClick={() => navigate('/crm')}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)', color: 'var(--color-text-secondary)' }}>
              <Target size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">View CRM</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Browse contacts, companies, and deals</p>
            </div>
          </div>
        </div>
        <div className="card hover:shadow-md transition-shadow cursor-pointer p-4" onClick={() => navigate('/support')}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)', color: 'var(--color-text-secondary)' }}>
              <TicketCheck size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">All Tickets</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Full support ticket management</p>
            </div>
          </div>
        </div>
        <div className="card hover:shadow-md transition-shadow cursor-pointer p-4" onClick={() => setShowCreateTicket(true)}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)', color: 'var(--color-text-secondary)' }}>
              <Plus size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">Create Ticket</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Report an issue or request support</p>
            </div>
          </div>
        </div>
      </div>

      {showCreateTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !saving && setShowCreateTicket(false)}>
          <div className="glass-card p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create Support Ticket</h2>
            {formError && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{formError}</p>}
            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="label">Subject *</label>
                <input className="input" value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} placeholder="Brief description" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={3} value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Detailed description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Channel</label>
                  <select className="input" value={ticketForm.channel} onChange={(e) => setTicketForm({ ...ticketForm, channel: e.target.value })}>
                    <option value="web">Web</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="portal">Portal</option>
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-sm btn-secondary" onClick={() => setShowCreateTicket(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-sm" disabled={saving}>{saving ? 'Creating...' : 'Create Ticket'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
