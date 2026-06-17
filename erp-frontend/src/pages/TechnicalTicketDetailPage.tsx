import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Edit3, ChevronRight } from 'lucide-react';

interface Ticket {
  id: string; ticket_no: string; title_en: string; description: string;
  category: string; priority: string; status: string; assigned_to: string;
  created_at: string; ticket_type: string; project_id: string;
}

interface UserProfile {
  id: string; display_name: string;
}

export default function TechnicalTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Ticket>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      supabase.from('technical_tickets').select('*').eq('id', id).single(),
      supabase.from('user_profiles').select('id, display_name').order('display_name'),
    ]).then(([tickRes, userRes]) => {
      setTicket(tickRes.data as Ticket | null);
      setForm(tickRes.data as Ticket || {});
      setUsers((userRes.data || []) as UserProfile[]);
      setLoading(false);
    });
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('technical_tickets').update(form).eq('id', id);
      if (error) throw error;
      toast.success('Ticket updated');
      setEditing(false);
      const { data } = await supabase.from('technical_tickets').select('*').eq('id', id).single();
      setTicket(data as Ticket | null);
    } catch (err: unknown) {
      console.error('Ticket update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  const assignedUser = users.find((u) => u.id === ticket?.assigned_to);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (!ticket) return <div className="text-center py-20 text-gray-400">Ticket not found</div>;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/technical" className="hover:text-primary transition-colors">Technical</Link>
        <ChevronRight size={14} />
        <span className="font-mono">{ticket.ticket_no}</span>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium truncate max-w-xs">{ticket.title_en}</span>
      </nav>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <button onClick={() => navigate('/technical')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
          <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ticket.title_en}</h1>
            <p className="text-sm text-gray-500 font-mono mt-1">{ticket.ticket_no}</p>
          </div>
          <div className="flex gap-2">
            <span className={`badge capitalize ${ticket.priority === 'high' || ticket.priority === 'urgent' ? 'badge-danger' : ticket.priority === 'medium' ? 'badge-warning' : 'badge-success'}`}>{ticket.priority}</span>
            <span className={`badge capitalize ${ticket.status === 'closed' ? 'badge-neutral' : 'badge-info'}`}>{ticket.status}</span>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="card space-y-4">
          <h3 className="font-semibold">Edit Ticket</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-full"><label className="label">Title</label><input className="input" value={form.title_en || ''} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status || 'open'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['open','in_progress','review','closed'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Priority</label>
              <select className="input" value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['low','medium','high','urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Assigned To</label>
              <select className="input" value={form.assigned_to || ''} onChange={(e) => setForm({ ...form, assigned_to: e.target.value || '' })}>
                <option value="">-- Unassigned --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
              </select>
            </div>
            <div><label className="label">Type</label>
              <select className="input" value={form.ticket_type || 'rfi'} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}>
                {['rfi','design_query','shop_drawing_review','method_statement_review','submittal_review','site_instruction','technical_query','other'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Description</label><textarea className="input" rows={4} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="capitalize">{ticket.ticket_type?.replace(/_/g, ' ') || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="capitalize">{ticket.status?.replace(/_/g, ' ') || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className={`badge capitalize text-xs ${ticket.priority === 'high' || ticket.priority === 'urgent' ? 'badge-danger' : ticket.priority === 'medium' ? 'badge-warning' : 'badge-success'}`}>{ticket.priority || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Assigned To</span><span>{assignedUser?.display_name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '-'}</span></div>
            </div>
          </div>
          <div className="card col-span-full space-y-3">
            <h3 className="font-semibold text-gray-900">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description || 'No description'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
