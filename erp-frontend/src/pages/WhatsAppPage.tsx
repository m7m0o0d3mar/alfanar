import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useT } from '../hooks/useTranslation';
import { MessageCircle, Send, Search, Phone, ArrowUpRight, ArrowDownLeft, CheckCheck, Clock, XCircle, Smartphone, FileText, Plus, Trash2, Check, X, Image, Paperclip } from 'lucide-react';
import FilePreviewModal from '../components/FilePreviewModal';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { whatsappAccountsApi, type UserWhatsAppAccount } from '../services/api';

interface WhatsAppMessage {
  id: string; direction: string; from_number: string; to_number: string;
  message_body: string; media_url: string; status: string;
  ticket_id: string; deal_id: string;
  sent_at: string; created_at: string;
}

export default function WhatsAppPage() {
  const toast = useToast();
  const { hasPermission, user, isAdmin } = useAuth();
  const [mainTab, setMainTab] = useState<'messages' | 'accounts' | 'templates'>('messages');
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [accounts, setAccounts] = useState<UserWhatsAppAccount[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const pageSize = 25;
  const [tab, setTab] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [showSend, setShowSend] = useState(false); const [sending, setSending] = useState(false);
  const [sendForm, setSendForm] = useState({ to_number: '', message_body: '' });
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ phone_number: '', display_name: '' });
  const [previewFile, setPreviewFile] = useState<{ url: string; fileName: string; mimeType?: string } | null>(null);

  useEffect(() => {
    if (mainTab === 'messages') { loadMessages(); }
    else if (mainTab === 'accounts') { loadAccounts(); }
    else { loadTemplates(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, tab]);

  async function loadMessages() {
    setLoading(true);
    try {
      let q = supabase.from('whatsapp_messages').select('*');
      if (tab === 'inbound') q = q.eq('direction', 'inbound');
      else if (tab === 'outbound') q = q.eq('direction', 'outbound');
      const { data } = await q.order('created_at', { ascending: false });
      setMessages((data || []) as WhatsAppMessage[]);
    } catch { toast.error('Failed to load messages'); }
    finally { setLoading(false); }
  }

  async function loadAccounts() {
    setLoading(true);
    try {
      const accts = await whatsappAccountsApi.list();
      setAccounts(accts);
      const { data: tmpls } = await supabase.from('whatsapp_templates').select('*').order('name');
      setTemplates(tmpls || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }

  async function loadTemplates() {
    setLoading(true);
    try {
      const { data } = await supabase.from('whatsapp_templates').select('*').order('name');
      setTemplates(data || []);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  }

  async function addAccount() {
    if (!accountForm.phone_number.trim()) { toast.error('Phone number is required'); return; }
    try {
      await whatsappAccountsApi.upsert({
        user_id: user?.id || '', phone_number: accountForm.phone_number.trim(),
        display_name: accountForm.display_name.trim() || undefined,
        is_connected: true, connected_at: new Date().toISOString(),
      });
      toast.success('Account added'); setShowAddAccount(false);
      setAccountForm({ phone_number: '', display_name: '' }); loadAccounts();
    } catch { toast.error('Failed to add account'); }
  }

  async function removeAccount(id: string) {
    try { await whatsappAccountsApi.remove(id); toast.success('Account removed'); loadAccounts(); }
    catch { toast.error('Failed to remove'); }
  }

  async function sendMessage() {
    if (!sendForm.to_number.trim() || !sendForm.message_body.trim()) { toast.error('Phone and message are required'); return; }
    setSending(true);
    try {
      const { data: inserted } = await supabase.from('whatsapp_messages').insert({
        direction: 'outbound', from_number: accounts.find(a => a.is_primary)?.phone_number || 'ERP-System',
        to_number: sendForm.to_number.trim(), message_body: sendForm.message_body.trim(),
        status: 'pending', sent_at: new Date().toISOString(),
      }).select('id').single<{ id: string }>();
      const waWorkerUrl = import.meta.env.VITE_WHATSAPP_WORKER_URL;
      const primaryAccount = accounts.find(a => a.is_primary);
      if (inserted && waWorkerUrl && primaryAccount) {
        fetch(`${waWorkerUrl}/send`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: primaryAccount.id, to: sendForm.to_number.trim(), text: sendForm.message_body.trim(), messageId: inserted.id }),
        }).catch(() => {});
      } else {
        await supabase.from('whatsapp_messages').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', inserted!.id);
      }
      toast.success('Message sent'); setShowSend(false);
      setSendForm({ to_number: '', message_body: '' }); loadMessages();
    } catch { toast.error('Send failed'); }
    finally { setSending(false); }
  }

  const filtered = messages.filter((m) => !search || m.message_body?.toLowerCase().includes(search.toLowerCase()) || m.from_number.includes(search) || m.to_number.includes(search));
  const getStatusIcon = (s: string) => { if (s === 'sent') return <Send size={14} />; if (s === 'delivered' || s === 'read') return <CheckCheck size={14} />; if (s === 'failed') return <XCircle size={14} />; return <Clock size={14} />; };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          <MessageCircle size={24} className="inline mr-2" style={{ color: '#25D366' }} /> WhatsApp
        </h1>
        <div className="flex gap-2">
          {mainTab === 'messages' && hasPermission('crm', 'create') && (
            <button className="btn-primary btn-sm" onClick={() => setShowSend(true)}><Send size={14} /> Send Message</button>
          )}
          {mainTab === 'accounts' && !isAdmin && (
            <button className="btn-primary btn-sm" onClick={() => setShowAddAccount(true)}><Plus size={14} /> Add Account</button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b pb-0" style={{ borderColor: 'var(--color-border)' }}>
        {[
          { key: 'messages' as const, label: 'Messages', icon: MessageCircle },
          { key: 'accounts' as const, label: 'My Accounts', icon: Smartphone },
          { key: 'templates' as const, label: 'Templates', icon: FileText },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setMainTab(key); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 -mb-px ${mainTab === key ? '' : 'opacity-60 hover:opacity-80'}`}
            style={{ backgroundColor: mainTab === key ? 'var(--color-surface)' : 'transparent', borderColor: 'var(--color-border)', color: mainTab === key ? 'var(--color-primary)' : 'var(--color-text)' }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {mainTab === 'messages' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'All Messages', value: messages.length, icon: MessageCircle, color: '#25D366' },
              { label: 'Inbound', value: messages.filter(m => m.direction === 'inbound').length, icon: ArrowDownLeft, color: '#3B82F6' },
              { label: 'Outbound', value: messages.filter(m => m.direction === 'outbound').length, icon: ArrowUpRight, color: '#F59E0B' },
            ].map((c) => (
              <div key={c.label} className="card p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${c.color}15` }}><c.icon size={20} style={{ color: c.color }} /></div>
                <div><p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.label}</p><p className="text-xl font-bold">{c.value}</p></div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 border-b pb-0" style={{ borderColor: 'var(--color-border)' }}>
            {[
              { key: 'all' as const, label: 'All' },
              { key: 'inbound' as const, label: 'Inbound' },
              { key: 'outbound' as const, label: 'Outbound' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => { setTab(key); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 -mb-px ${tab === key ? '' : 'opacity-60 hover:opacity-80'}`}
                style={{ backgroundColor: tab === key ? 'var(--color-surface)' : 'transparent', borderColor: 'var(--color-border)', color: tab === key ? 'var(--color-primary)' : 'var(--color-text)' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
              <input className="input ps-9" placeholder="Search messages..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead><tr><th>Direction</th><th>From</th><th>To</th><th>Message</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No messages yet.</td></tr>
                ) : (
                  filtered.slice((page - 1) * pageSize, page * pageSize).map((m) => (
                    <tr key={m.id}>
                      <td>{m.direction === 'inbound' ? <ArrowDownLeft size={16} style={{ color: '#3B82F6' }} /> : <ArrowUpRight size={16} style={{ color: '#F59E0B' }} />}</td>
                      <td className="font-mono text-sm">{m.from_number}</td>
                      <td className="font-mono text-sm">{m.to_number}</td>
                      <td className="max-w-xs">
                        <div className="flex items-center gap-1">
                          {m.media_url ? (
                            <button onClick={() => setPreviewFile({ url: m.media_url, fileName: 'media', mimeType: '' })}
                              className="shrink-0 p-1 rounded hover:bg-gray-100 transition-colors">
                              {m.media_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? <Image size={14} style={{ color: 'var(--color-primary)' }} /> : <Paperclip size={14} style={{ color: 'var(--color-text-secondary)' }} />}
                            </button>
                          ) : null}
                          <span className="truncate">{m.message_body}</span>
                        </div>
                      </td>
                      <td><span className={`badge text-xs flex items-center gap-1 w-fit ${m.status === 'sent' ? 'badge-info' : m.status === 'delivered' ? 'badge-success' : m.status === 'failed' ? 'badge-danger' : ''}`}>{getStatusIcon(m.status)}{m.status}</span></td>
                      <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </>
      )}

      {mainTab === 'accounts' && (
        <div className="space-y-4">
          {accounts.length === 0 && !loading && (
            <div className="text-center py-12">
              <Smartphone size={48} className="mx-auto mb-3 opacity-30" />
              <p style={{ color: 'var(--color-text-secondary)' }}>No WhatsApp accounts linked.</p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>Add your phone number to send and receive messages from the system.</p>
              <button className="btn-primary btn-sm" onClick={() => setShowAddAccount(true)}><Plus size={14} /> Add Your Number</button>
            </div>
          )}
          {accounts.map((a) => (
            <div key={a.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: a.is_connected ? 'rgba(22,163,74,0.1)' : 'rgba(100,116,139,0.1)' }}>
                  <Smartphone size={20} style={{ color: a.is_connected ? '#16a34a' : '#64748b' }} />
                </div>
                <div>
                  <p className="font-medium">{a.display_name || a.phone_number}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{a.phone_country_code} {a.phone_number}</p>
                  <span className={`text-xs ${a.is_connected ? 'text-green-600' : 'text-gray-400'}`}>
                    {a.is_connected ? <><Check size={10} className="inline" /> Connected</> : 'Disconnected'}
                    {a.is_primary && <span className="ml-2 badge badge-info">Primary</span>}
                  </span>
                </div>
              </div>
              <button className="btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => removeAccount(a.id)}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {mainTab === 'templates' && (
        <div className="space-y-3">
          {templates.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p style={{ color: 'var(--color-text-secondary)' }}>No message templates yet.</p>
            </div>
          )}
          {templates.map((t: any) => (
            <div key={t.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{t.name}</p>
                <span className={`badge text-xs ${t.status === 'approved' ? 'badge-success' : t.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{t.status}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{t.body_en}</p>
              {t.variables?.length > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Variables: {t.variables.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showSend && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSend(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Send size={16} /> Send WhatsApp Message</h3>
            {accounts.length > 0 && (
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>From: {accounts.find(a => a.is_primary)?.phone_number || accounts[0].phone_number}</p>
            )}
            <div className="space-y-4">
              <div><label className="label">Phone Number *</label>
                <div className="relative"><Phone size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
                  <input className="input ps-9" placeholder="+966501234567" value={sendForm.to_number} onChange={(e) => setSendForm({...sendForm, to_number: e.target.value})} />
                </div>
              </div>
              <div><label className="label">Message *</label>
                <textarea className="input" rows={4} placeholder="Type your message..." value={sendForm.message_body} onChange={(e) => setSendForm({...sendForm, message_body: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={sendMessage} disabled={sending}><Send size={14} /> {sending ? 'Sending...' : 'Send'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowSend(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddAccount && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAddAccount(false)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Smartphone size={16} /> Link WhatsApp Account</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>Add your phone number to link it with the system. You can use this number to send messages.</p>
            <div className="space-y-4">
              <div><label className="label">Phone Number *</label>
                <div className="relative"><Phone size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
                  <input className="input ps-9" placeholder="+966501234567" value={accountForm.phone_number} onChange={(e) => setAccountForm({...accountForm, phone_number: e.target.value})} />
                </div>
              </div>
              <div><label className="label">Display Name</label>
                <input className="input" placeholder="e.g. Ahmed's WhatsApp" value={accountForm.display_name} onChange={(e) => setAccountForm({...accountForm, display_name: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={addAccount}><Smartphone size={14} /> Link Account</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowAddAccount(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {previewFile && <FilePreviewModal url={previewFile.url} fileName={previewFile.fileName} mimeType={previewFile.mimeType} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
