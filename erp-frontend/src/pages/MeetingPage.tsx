import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { meetingsApi, type MeetingRoom } from '../services/api';
import { Video, Calendar, Clock, Plus, Search, Users, Check, X, HelpCircle, Loader2, ArrowLeft, Upload, Film, Download, Trash2, Briefcase } from 'lucide-react';

const PROVIDER_ICONS: Record<string, string> = { jitsi: '🔗', zoom: '🖥️', 'microsoft-teams': '💬' };
const STATUS_COLORS: Record<string, string> = { scheduled: 'var(--color-primary)', ongoing: 'var(--color-success)', completed: 'var(--color-text-secondary)', cancelled: 'var(--color-danger)' };

export default function MeetingPage() {
  const t = useT();
  const toast = useToast();
  const { user: authUser } = useAuth();
  const [meetings, setMeetings] = useState<MeetingRoom[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name_en: string; full_name_ar?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [joinMeeting, setJoinMeeting] = useState<MeetingRoom | null>(null);
  const [recordingsTab, setRecordingsTab] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedRecordingMeeting, setSelectedRecordingMeeting] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [projects, setProjects] = useState<{ id: string; name_en: string; project_code: string }[]>([]);
  const [form, setForm] = useState({
    title_en: '', title_ar: '', description: '', start_time: '', duration_minutes: 30,
    provider: 'jitsi', participant_ids: [] as string[], project_id: '',
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [meetRes, userRes, projRes] = await Promise.all([
        meetingsApi.list(),
        supabase.from('user_profiles').select('id, full_name_en, full_name_ar').eq('is_active', true).order('full_name_en'),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setMeetings(meetRes);
      setUsers((userRes.data || []) as { id: string; full_name_en: string; full_name_ar?: string }[]);
      setProjects((projRes.data || []) as { id: string; name_en: string; project_code: string }[]);
    } catch (err) {
      console.error('Failed to load meetings:', err);
      toast.error('Failed to load meetings');
    } finally { setLoading(false); }
  }

  const [filterProject, setFilterProject] = useState('');
  const now = new Date().toISOString();
  const filtered = meetings.filter(m => {
    if (tab === 'upcoming' && m.start_time && m.start_time < now && m.status !== 'scheduled' && m.status !== 'ongoing') return false;
    if (tab === 'past' && (!m.start_time || m.start_time >= now) && m.status !== 'completed' && m.status !== 'cancelled') return false;
    if (search && !m.title_en.toLowerCase().includes(search.toLowerCase()) && !(m.title_ar || '').includes(search)) return false;
    if (filterProject && (m as any).project_id !== filterProject) return false;
    return true;
  });

  function getUserStatus(m: MeetingRoom): string | null {
    if (!authUser || !m.participants) return null;
    const p = m.participants.find(p => p.user_id === authUser.id);
    return p?.status || null;
  }

  async function handleCreate() {
    setFormError('');
    if (!form.title_en.trim()) { setFormError('Title is required'); return; }
    if (!form.start_time) { setFormError('Start time is required'); return; }
    setSaving(true);
    try {
      const meetId = crypto.randomUUID().slice(0, 8);
      const meeting = await meetingsApi.create({
        title_en: form.title_en,
        title_ar: form.title_ar || undefined,
        description: form.description || undefined,
        start_time: form.start_time,
        duration_minutes: form.duration_minutes,
        provider: form.provider,
        meet_link: `https://meet.jit.si/ERP-${meetId}`,
        status: 'scheduled',
        created_by: authUser?.id,
        project_id: form.project_id || undefined,
      });
      if (form.participant_ids.length) {
        const { error } = await supabase.from('meeting_participants').insert(
          form.participant_ids.map(user_id => ({ meeting_id: meeting.id, user_id, status: 'pending' }))
        );
        if (error) throw error;
      }
      toast.success('Meeting created');
      setShowCreate(false);
      setForm({ title_en: '', title_ar: '', description: '', start_time: '', duration_minutes: 30, provider: 'jitsi', participant_ids: [], project_id: '' });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function loadRecordings(meetingId?: string) {
    try {
      let query = supabase.from('meeting_recordings').select('*, meeting:meeting_rooms(id, title_en, title_ar)').order('created_at', { ascending: false });
      if (meetingId) query = query.eq('meeting_id', meetingId);
      const { data } = await query;
      setRecordings(data || []);
    } catch { /* ignore */ }
  }

  async function handleUploadRecording(meetingId: string, file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `meeting-recordings/${meetingId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('recordings').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('recordings').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('meeting_recordings').insert({
        meeting_id: meetingId, file_url: publicUrl, file_name: file.name, file_size: file.size, mime_type: file.type,
      });
      if (insertError) throw insertError;
      toast.success('Recording uploaded');
      await loadRecordings(selectedRecordingMeeting || undefined);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally { setUploading(false); }
  }

  async function deleteRecording(id: string) {
    try {
      await supabase.from('meeting_recordings').delete().eq('id', id);
      toast.success('Recording deleted');
      await loadRecordings(selectedRecordingMeeting || undefined);
    } catch { toast.error('Delete failed'); }
  }

  async function handleRespond(meetingId: string, status: string) {
    try {
      await meetingsApi.respond(meetingId, status);
      toast.success(`RSVP: ${status}`);
      load();
    } catch { toast.error('RSVP failed'); }
  }

  function toggleParticipant(id: string) {
    setForm(f => ({
      ...f,
      participant_ids: f.participant_ids.includes(id)
        ? f.participant_ids.filter(x => x !== id)
        : [...f.participant_ids, id],
    }));
  }

  const statusBadge = (status: string) => (
    <span className="badge text-xs capitalize" style={{ backgroundColor: `color-mix(in srgb, ${STATUS_COLORS[status] || 'var(--color-text-secondary)'} 15%, transparent)`, color: STATUS_COLORS[status] || 'var(--color-text-secondary)' }}>
      {status}
    </span>
  );

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.meetings') || 'Meetings'}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{meetings.length} total</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setShowCreate(true); }}>
          <Plus size={16} /> New Meeting
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {(['upcoming', 'past', 'all'] as const).map(key => (
          <button key={key} onClick={() => { setTab(key); setRecordingsTab(false); }}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${tab === key && !recordingsTab ? '' : 'opacity-60'}`}
            style={{ color: 'var(--color-text)', borderColor: tab === key && !recordingsTab ? 'var(--color-primary)' : 'transparent' }}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
        <button onClick={() => { setRecordingsTab(true); loadRecordings(); }}
          className={`text-sm font-medium pb-1 border-b-2 transition-colors ${recordingsTab ? '' : 'opacity-60'}`}
          style={{ color: 'var(--color-text)', borderColor: recordingsTab ? 'var(--color-primary)' : 'transparent' }}>
          <Film size={14} className="inline mr-1" /> Recordings ({recordings.length})
        </button>
        <select className="input max-w-[200px] text-sm py-1.5" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
        </select>
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-8 py-1.5 text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {recordingsTab ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <select className="input text-sm" style={{ width: '240px' }} value={selectedRecordingMeeting || ''} onChange={e => { setSelectedRecordingMeeting(e.target.value || null); loadRecordings(e.target.value || undefined); }}>
              <option value="">All Meetings</option>
              {meetings.map(m => <option key={m.id} value={m.id}>{m.title_en}</option>)}
            </select>
          </div>
          {recordings.length === 0 ? (
            <div className="text-center py-20" style={{ color: 'var(--color-text-secondary)' }}>
              <Film size={48} className="mx-auto mb-3 opacity-30" />
              <p>No recordings yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map(r => (
                <div key={r.id} className="card p-3 flex items-center gap-3">
                  <Film size={20} className="text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.file_name || 'Recording'}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {r.meeting?.title_en || 'Unknown meeting'} &middot; {r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(1)} MB` : ''} &middot; {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="btn-sm btn-secondary"><Download size={14} /></a>
                    <button className="btn-sm btn-secondary text-red-500" onClick={() => deleteRecording(r.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--color-text-secondary)' }}>
          <Video size={48} className="mx-auto mb-3 opacity-30" />
          <p>No meetings found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => {
            const participantCount = m.participants?.length || 0;
            const userStatus = getUserStatus(m);
            const canJoin = m.status === 'scheduled' || m.status === 'ongoing';
            const isPast = m.status === 'completed' || m.status === 'cancelled';
            return (
              <div key={m.id} className="card p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => canJoin && setJoinMeeting(m)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{m.title_en}</h3>
                  <span className="text-lg flex-shrink-0">{PROVIDER_ICONS[m.provider] || '🔗'}</span>
                </div>
                {m.description && <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{m.description}</p>}
                <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                  {m.start_time && <span className="flex items-center gap-1"><Calendar size={12} />{new Date(m.start_time).toLocaleDateString()}</span>}
                  {m.start_time && <span className="flex items-center gap-1"><Clock size={12} />{new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  <span className="flex items-center gap-1"><Users size={12} />{participantCount}</span>
                  {(m as any).project?.project_code && <span className="flex items-center gap-1"><Briefcase size={12} />{(m as any).project.project_code}</span>}
                </div>
                <div className="flex items-center justify-between">
                  {statusBadge(m.status)}
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {userStatus && userStatus !== 'pending' ? (
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{userStatus}</span>
                    ) : canJoin && (
                      <button className="btn-sm btn-primary text-xs flex items-center gap-1" onClick={() => setJoinMeeting(m)}>
                        <Video size={12} /> Join
                      </button>
                    )}
                    {isPast && (
                      <button className="btn-sm btn-secondary text-xs" onClick={() => setJoinMeeting(m)}>
                        View
                      </button>
                    )}
                    <div className="flex gap-0.5">
                      {userStatus !== 'accepted' && <button className="btn-sm text-xs p-1" style={{ color: 'var(--color-success)' }} onClick={() => handleRespond(m.id, 'accepted')} title="Accept"><Check size={12} /></button>}
                      {userStatus !== 'declined' && <button className="btn-sm text-xs p-1" style={{ color: 'var(--color-danger)' }} onClick={() => handleRespond(m.id, 'declined')} title="Decline"><X size={12} /></button>}
                      {userStatus !== 'maybe' && <button className="btn-sm text-xs p-1" style={{ color: 'var(--color-warning)' }} onClick={() => handleRespond(m.id, 'maybe')} title="Maybe"><HelpCircle size={12} /></button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>New Meeting</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>{formError}</div>}
            <div className="space-y-4">
              <div><label className="label">Title *</label><input className="input" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} /></div>
              <div><label className="label">Title (Arabic)</label><input className="input" value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} dir="rtl" /></div>
              <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Start Time *</label><input type="datetime-local" className="input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><label className="label">Duration (min)</label><input type="number" className="input" min={5} max={480} value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} /></div>
              </div>
              <div><label className="label">Provider</label>
                <select className="input" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}>
                  <option value="jitsi">Jitsi Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="microsoft-teams">Microsoft Teams</option>
                </select>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- None --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Add Participants</label>
                <input className="input mb-2 text-sm" placeholder="Search users..." value={participantSearch} onChange={e => setParticipantSearch(e.target.value)} />
                <div className="max-h-32 overflow-y-auto space-y-1 border rounded-lg p-2" style={{ borderColor: 'var(--color-border)' }}>
                  {users.filter(u => !participantSearch || u.full_name_en.toLowerCase().includes(participantSearch.toLowerCase())).map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5" style={{ color: 'var(--color-text)' }}>
                      <input type="checkbox" checked={form.participant_ids.includes(u.id)} onChange={() => toggleParticipant(u.id)} />
                      {u.full_name_en}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-primary btn-sm" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Meeting'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {joinMeeting && (
        <div className="fixed inset-0 bg-black/40 flex flex-col z-50" onClick={() => setJoinMeeting(null)}>
          <div className="flex items-center gap-3 px-4 py-2 bg-black/60 text-white flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => setJoinMeeting(null)} className="p-1 hover:bg-white/10 rounded"><ArrowLeft size={18} /></button>
            <Video size={16} />
            <span className="font-medium text-sm truncate">{joinMeeting.title_en}</span>
            <span className="ml-auto text-xs opacity-70" style={{ color: STATUS_COLORS[joinMeeting.status] }}>{joinMeeting.status}</span>
          </div>
          <div className="flex flex-1 min-h-0" onClick={e => e.stopPropagation()}>
            <div className="flex-1 relative">
              <iframe
                src={`${joinMeeting.meet_link || `https://meet.jit.si/ERP-${joinMeeting.id.slice(0, 8)}`}?userInfo.displayName="${authUser?.full_name_en || 'User'}"`}
                className="absolute inset-0 w-full h-full"
                allow="camera; microphone; display-capture; autoplay"
                style={{ border: 'none' }}
                title="Jitsi Meeting"
              />
            </div>
            <div className="w-72 hidden lg:flex flex-col p-4 gap-4 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
              <div>
                <h3 className="font-semibold text-sm">{joinMeeting.title_en}</h3>
                {joinMeeting.title_ar && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }} dir="rtl">{joinMeeting.title_ar}</p>}
                {joinMeeting.description && <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>{joinMeeting.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {joinMeeting.start_time && <span className="flex items-center gap-1"><Calendar size={12} />{new Date(joinMeeting.start_time).toLocaleString()}</span>}
                {joinMeeting.duration_minutes && <span className="flex items-center gap-1"><Clock size={12} />{joinMeeting.duration_minutes} min</span>}
              </div>
              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1"><Users size={12} /> Participants ({joinMeeting.participants?.length || 0})</p>
                <div className="space-y-1">
                  {joinMeeting.participants?.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span>{p.user?.full_name_en || p.user_id.slice(0, 8)}</span>
                      <span className="capitalize" style={{ color: p.status === 'accepted' ? 'var(--color-success)' : p.status === 'declined' ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
