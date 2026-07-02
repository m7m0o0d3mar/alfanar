import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Edit3, ChevronRight, Trash2, Download, Upload, Clock } from 'lucide-react';
import Avatar from '../components/Avatar';

interface Ticket {
  id: string; ticket_no: string; title_en: string; title_ar?: string;
  description?: string; ticket_type: string; priority: string; status: string;
  assigned_to?: string; requested_by?: string; due_date?: string;
  project_id?: string; created_at: string; updated_at?: string;
  project?: { project_code: string; name_en: string };
  assigned_user?: { id: string; full_name_en: string; avatar_url?: string } | null;
  requester?: { id: string; full_name_en: string; avatar_url?: string } | null;
}

interface TicketComment {
  id: string; ticket_id: string; user_id: string; comment_text: string;
  attachment_url?: string; created_at: string;
  user?: { id: string; full_name_en: string; avatar_url?: string } | null;
}

interface TicketReference {
  id: string; ticket_id: string; related_ticket_id: string; reference_type: string;
  related_ticket?: { id: string; ticket_no: string; title_en: string; status: string };
}

interface UserProfile {
  id: string; full_name_en: string; avatar_url?: string;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6', in_progress: '#F59E0B', under_review: '#8B5CF6',
  resolved: '#22C55E', closed: '#6B7280', cancelled: '#EF4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22C55E', medium: '#F59E0B', high: '#EF4444', urgent: '#DC2626',
};

const TICKET_TYPES = ['rfi', 'design_query', 'shop_drawing_review', 'method_statement_review', 'submittal_review', 'site_instruction', 'technical_query', 'other'];
const STATUS_OPTIONS = ['open', 'in_progress', 'under_review', 'resolved', 'closed', 'cancelled'];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['under_review', 'resolved', 'cancelled'],
  under_review: ['resolved', 'open', 'cancelled'],
  resolved: ['closed', 'open'],
  closed: [],
  cancelled: ['open'],
};

export default function TechnicalTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const toast = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const [references, setReferences] = useState<TicketReference[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      supabase.from('technical_tickets')
        .select('*, project:projects(project_code, name_en), assigned_user:user_profiles!assigned_to(id, full_name_en, avatar_url), requester:user_profiles!requested_by(id, full_name_en, avatar_url)')
        .eq('id', id).single(),
      supabase.from('user_profiles').select('id, full_name_en, avatar_url').order('full_name_en'),
      supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      supabase.from('ticket_comments')
        .select('*, user:user_profiles(id, full_name_en, avatar_url)')
        .eq('ticket_id', id).order('created_at', { ascending: true }),
      supabase.from('ticket_references')
        .select('*, related_ticket:technical_tickets!related_ticket_id(id, ticket_no, title_en, status)')
        .eq('ticket_id', id),
    ]).then(([tickRes, userRes, projRes, commRes, refRes]) => {
      setTicket(tickRes.data as Ticket | null);
      setForm((tickRes.data || {}) as Record<string, string>);
      setUsers((userRes.data || []) as UserProfile[]);
      setProjects((projRes.data || []) as Project[]);
      setComments((commRes.data || []) as TicketComment[]);
      setReferences((refRes.data || []) as TicketReference[]);
      setLoading(false);
    });
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (form.title_en !== ticket?.title_en) payload.title_en = form.title_en;
      if (form.title_ar !== (ticket?.title_ar || '')) payload.title_ar = form.title_ar || null;
      if (form.description !== (ticket?.description || '')) payload.description = form.description || null;
      if (form.ticket_type !== ticket?.ticket_type) payload.ticket_type = form.ticket_type;
      if (form.priority !== ticket?.priority) payload.priority = form.priority;
      if (form.status !== ticket?.status) payload.status = form.status;
      if (form.assigned_to !== (ticket?.assigned_to || '')) payload.assigned_to = form.assigned_to || null;
      if (form.due_date !== (ticket?.due_date || '')) payload.due_date = form.due_date || null;
      if (form.project_id !== ticket?.project_id) payload.project_id = form.project_id || null;

      if (Object.keys(payload).length === 0) { setEditing(false); return; }

      const { error } = await supabase.from('technical_tickets').update(payload).eq('id', id);
      if (error) throw error;
      toast.success('Ticket updated');
      setEditing(false);
      const { data } = await supabase.from('technical_tickets')
        .select('*, project:projects(project_code, name_en), assigned_user:user_profiles!assigned_to(id, full_name_en, avatar_url), requester:user_profiles!requested_by(id, full_name_en, avatar_url)')
        .eq('id', id).single();
      setTicket(data as Ticket | null);
      setForm((data || {}) as Record<string, string>);
    } catch (err: unknown) {
      console.error('Ticket update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  async function handleStatusTransition(newStatus: string) {
    if (!id) return;
    try {
      const { error } = await supabase.from('technical_tickets').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Status changed to ${newStatus.replace(/_/g, ' ')}`);
      const { data } = await supabase.from('technical_tickets')
        .select('*, project:projects(project_code, name_en), assigned_user:user_profiles!assigned_to(id, full_name_en, avatar_url), requester:user_profiles!requested_by(id, full_name_en, avatar_url)')
        .eq('id', id).single();
      setTicket(data as Ticket | null);
      setForm((data || {}) as Record<string, string>);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Status update failed'); }
  }

  async function handleCommentSubmit() {
    if (!id || !newComment.trim()) return;
    setSendingComment(true);
    try {
      let attachmentUrl = '';
      if (attachment) {
        setUploading(true);
        const path = `technical/comments/${id}/${Date.now()}_${attachment.name}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, attachment);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
        setUploading(false);
      }
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: id, user_id: authUser?.id,
        comment_text: newComment.trim(), attachment_url: attachmentUrl || null,
      });
      if (error) throw error;
      setNewComment('');
      setAttachment(null);
      const res = await supabase.from('ticket_comments')
        .select('*, user:user_profiles(id, full_name_en, avatar_url)')
        .eq('ticket_id', id).order('created_at', { ascending: true });
      setComments((res.data || []) as TicketComment[]);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to post comment'); }
    finally { setSendingComment(false); }
  }

  async function deleteComment(commentId: string) {
    try {
      await supabase.from('ticket_comments').delete().eq('id', commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch { toast.error('Delete failed'); }
  }

  const nextStatuses = ticket ? STATUS_TRANSITIONS[ticket.status] || [] : [];

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (!ticket) return <div className="text-center py-20 text-gray-400">Ticket not found</div>;

  return (
    <div className="page-enter space-y-6">
      <nav className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        <Link to="/technical" className="hover:text-primary transition-colors">Technical</Link>
        <ChevronRight size={14} />
        <span className="font-mono">{ticket.ticket_no}</span>
        <ChevronRight size={14} />
        <span className="font-medium truncate max-w-xs" style={{ color: 'var(--color-text)' }}>{ticket.title_en}</span>
      </nav>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <button onClick={() => navigate('/technical')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
          <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{ticket.title_en}</h1>
            {ticket.title_ar && <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }} dir="rtl">{ticket.title_ar}</p>}
            <p className="text-sm font-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>{ticket.ticket_no}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="badge capitalize text-xs" style={{ backgroundColor: `${PRIORITY_COLORS[ticket.priority]}18`, color: PRIORITY_COLORS[ticket.priority] }}>{ticket.priority}</span>
            <span className="badge capitalize text-xs" style={{ backgroundColor: `${STATUS_COLORS[ticket.status]}18`, color: STATUS_COLORS[ticket.status] }}>{ticket.status.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="card space-y-4">
          <h3 className="font-semibold">Edit Ticket</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-full">
              <label className="label">Project</label>
              <select className="input" value={form.project_id || ''} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">-- Select Project --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
              </select>
            </div>
            <div className="col-span-full"><label className="label">Title (EN) *</label><input className="input" value={form.title_en || ''} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
            <div className="col-span-full"><label className="label">Title (AR)</label><input className="input" value={form.title_ar || ''} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></div>
            <div><label className="label">Type</label>
              <select className="input" value={form.ticket_type || 'rfi'} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}>
                {TICKET_TYPES.map(tp => <option key={tp} value={tp}>{tp.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Priority</label>
              <select className="input" value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status || 'open'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><label className="label">Assigned To</label>
              <select className="input" value={form.assigned_to || ''} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">-- Unassigned --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
              </select>
            </div>
            <div className="col-span-full"><label className="label">Description</label><textarea className="input" rows={4} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Details</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Project</span><span>{ticket.project?.project_code || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Type</span><span className="capitalize">{ticket.ticket_type?.replace(/_/g, ' ') || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Status</span><span className="capitalize">{ticket.status?.replace(/_/g, ' ') || '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Priority</span><span className="badge capitalize text-xs" style={{ backgroundColor: `${PRIORITY_COLORS[ticket.priority]}18`, color: PRIORITY_COLORS[ticket.priority] }}>{ticket.priority || '-'}</span></div>
              <div className="flex justify-between items-center"><span style={{ color: 'var(--color-text-secondary)' }}>Assigned To</span>
                <div className="flex items-center gap-1.5">
                  {ticket.assigned_user ? <><Avatar url={ticket.assigned_user.avatar_url} name={ticket.assigned_user.full_name_en} size={22} /><span>{ticket.assigned_user.full_name_en}</span></> : <span>-</span>}
                </div>
              </div>
              <div className="flex justify-between items-center"><span style={{ color: 'var(--color-text-secondary)' }}>Requester</span>
                <div className="flex items-center gap-1.5">
                  {ticket.requester ? <><Avatar url={ticket.requester.avatar_url} name={ticket.requester.full_name_en} size={22} /><span>{ticket.requester.full_name_en}</span></> : <span>-</span>}
                </div>
              </div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Due Date</span><span>{ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Created</span><span>{new Date(ticket.created_at).toLocaleString()}</span></div>
              {ticket.updated_at && <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Updated</span><span>{new Date(ticket.updated_at).toLocaleString()}</span></div>}
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Status Workflow</h3>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(s => (
                <span key={s} className={`badge text-xs capitalize ${s === ticket.status ? '' : 'opacity-40'}`}
                  style={{ backgroundColor: `${STATUS_COLORS[s]}18`, color: STATUS_COLORS[s] }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            {nextStatuses.length > 0 && (
              <div className="pt-2">
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Next possible transitions:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {nextStatuses.map(ns => (
                    <button key={ns} className="btn-sm text-xs" style={{ backgroundColor: `${STATUS_COLORS[ns]}18`, color: STATUS_COLORS[ns], border: `1px solid ${STATUS_COLORS[ns]}33` }}
                      onClick={() => handleStatusTransition(ns)}>
                      {ns.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {nextStatuses.length === 0 && ticket.status !== 'closed' && ticket.status !== 'cancelled' && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No further transitions available.</p>
            )}
          </div>

          <div className="card col-span-full space-y-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Description</h3>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{ticket.description || 'No description'}</p>
          </div>
        </div>
      )}

      {references.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Related Ticket References</h3>
          <div className="space-y-2">
            {references.map(ref => (
              <div key={ref.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex-1">
                  <div className="text-sm font-medium">{ref.related_ticket?.ticket_no || 'Unknown'}</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ref.related_ticket?.title_en || ''} &middot; {ref.reference_type}</div>
                </div>
                {ref.related_ticket && (
                  <span className="badge text-xs" style={{ backgroundColor: `${STATUS_COLORS[ref.related_ticket.status]}18`, color: STATUS_COLORS[ref.related_ticket.status] }}>
                    {ref.related_ticket.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Activity Timeline</h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="p-1.5 rounded-full" style={{ backgroundColor: `${STATUS_COLORS[ticket.status]}18` }}><Clock size={14} style={{ color: STATUS_COLORS[ticket.status] }} /></div>
              <div className="w-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>
            <div className="pb-3">
              <p className="text-sm font-medium">Created</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(ticket.created_at).toLocaleString()}</p>
            </div>
          </div>
          {ticket.updated_at && ticket.updated_at !== ticket.created_at && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="p-1.5 rounded-full" style={{ backgroundColor: '#8B5CF618' }}><Clock size={14} style={{ color: '#8B5CF6' }} /></div>
                <div className="w-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
              <div className="pb-3">
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(ticket.updated_at).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Comments ({comments.length})</h3>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--color-text-secondary)' }}>No comments yet.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary, #f8f9fa)' }}>
                <Avatar url={c.user?.avatar_url} name={c.user?.full_name_en} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.user?.full_name_en || 'Unknown'}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    {c.user_id === authUser?.id && (
                      <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => deleteComment(c.id)}><Trash2 size={12} /></button>
                    )}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{c.comment_text}</p>
                  {c.attachment_url && (
                    <a href={c.attachment_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-2 rounded-md px-2 py-1"
                      style={{ backgroundColor: 'var(--color-primary)10', color: 'var(--color-primary)' }}>
                      <Download size={12} /> Attachment
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
          <textarea className="input" rows={2} placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <label className="btn-sm btn-secondary cursor-pointer">
              <Upload size={14} /> {attachment ? attachment.name : 'Attach File'}
              <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
            </label>
            {attachment && <button className="btn-sm btn-secondary text-xs" style={{ color: 'var(--color-danger)' }} onClick={() => setAttachment(null)}>Remove</button>}
            <button className="btn-primary btn-sm ml-auto" onClick={handleCommentSubmit} disabled={sendingComment || !newComment.trim()}>
              {sendingComment ? (uploading ? 'Uploading...' : 'Sending...') : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
