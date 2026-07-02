import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import { emailApi, type EmailAccount, type EmailMessage } from '../services/api';
import FilePreviewModal from '../components/FilePreviewModal';
import {
  Mail, Inbox, Send, FileText, Trash2, AlertTriangle, Archive, Star,
  Search, Plus, X, Edit3, Paperclip, Reply,
  Loader2, RefreshCw, Check, Eye
} from 'lucide-react';

const FOLDERS = ['inbox', 'sent', 'drafts', 'spam', 'trash', 'archive'] as const;

export default function EmailPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<string>('inbox');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; fileName: string; mimeType?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [composeForm, setComposeForm] = useState({
    to: '', cc: '', bcc: '', subject: '', body: '',
  });
  const [accountForm, setAccountForm] = useState({
    email_address: '', display_name: '',
    imap_host: 'imap.gmail.com', imap_port: 993, imap_user: '', imap_pass: '',
    smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_user: '', smtp_pass: '',
    use_tls: true,
  });

  async function loadAccounts() {
    const accts = await emailApi.listAccounts();
    setAccounts(accts);
    if (accts.length > 0 && folder) loadMessages(accts, folder);
  }

  async function loadMessages(accts?: EmailAccount[], f?: string) {
    setLoading(true);
    try {
      const a = accts || accounts;
      const fld = f || folder;
      if (a.length === 0) return;
      const all = (await Promise.all(a.map(a => emailApi.listMessages(a.id, fld)))).flat();
      setMessages(all);
    } catch { toast.error('Failed to load emails'); }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAccounts(); }, [user]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (accounts.length) loadMessages(accounts, folder); }, [folder]);

  const primaryAccount = accounts.find(a => a.is_primary) || accounts[0];

  async function addAccount() {
    if (!accountForm.email_address.trim() || !accountForm.imap_user.trim()) {
      toast.error('Email and IMAP user required'); return;
    }
    setSending(true);
    try {
      await emailApi.addAccount({
        user_id: user?.id, ...accountForm,
        imap_port: accountForm.imap_port, smtp_port: accountForm.smtp_port,
      });
      toast.success('Account added');
      setShowAddAccount(false);
      setAccountForm({ ...accountForm, email_address: '', display_name: '', imap_user: '', imap_pass: '', smtp_user: '', smtp_pass: '' });
      loadAccounts();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSending(false); }
  }

  async function sendMessage() {
    if (!composeForm.to.trim() || !composeForm.subject.trim()) { toast.error('To and Subject required'); return; }
    if (!primaryAccount) { toast.error('No email account'); return; }
    setSending(true);
    try {
      await emailApi.sendMessage({
        account_id: primaryAccount.id,
        folder: 'sent',
        from_address: primaryAccount.email_address,
        from_name: primaryAccount.display_name,
        to_addresses: composeForm.to.split(',').map(s => s.trim()),
        cc_addresses: composeForm.cc ? composeForm.cc.split(',').map(s => s.trim()) : [],
        bcc_addresses: composeForm.bcc ? composeForm.bcc.split(',').map(s => s.trim()) : [],
        subject: composeForm.subject,
        body_html: composeForm.body.replace(/\n/g, '<br>'),
        body_text: composeForm.body,
        attachments: [],
        is_read: true,
      });
      toast.success('Email sent');
      setShowCompose(false);
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '' });
      loadMessages();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Send failed'); }
    finally { setSending(false); }
  }

  async function saveDraft() {
    if (!primaryAccount) return;
    try {
      await emailApi.sendMessage({
        account_id: primaryAccount.id,
        folder: 'drafts',
        from_address: primaryAccount.email_address,
        to_addresses: composeForm.to ? composeForm.to.split(',').map(s => s.trim()) : [],
        cc_addresses: composeForm.cc ? composeForm.cc.split(',').map(s => s.trim()) : [],
        subject: composeForm.subject || '(no subject)',
        body_text: composeForm.body,
        attachments: [],
        is_read: true,
      });
      toast.success('Draft saved');
      setShowCompose(false);
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '' });
      if (folder === 'drafts') loadMessages();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Save failed'); }
  }

  async function toggleStar(msg: EmailMessage) {
    try {
      await emailApi.updateMessage(msg.id, { is_starred: !msg.is_starred });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_starred: !m.is_starred } : m));
      if (selected?.id === msg.id) setSelected({ ...selected, is_starred: !selected.is_starred });
    } catch { toast.error('Failed to update'); }
  }

  async function markRead(msg: EmailMessage) {
    if (msg.is_read) return;
    try {
      await emailApi.updateMessage(msg.id, { is_read: true });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      setSelected({ ...msg, is_read: true });
    } catch { /* ignore */ }
  }

  async function batchAction(action: 'delete' | 'read' | 'archive') {
    if (!checked.size) return;
    try {
      const promises: Promise<void>[] = [];
      checked.forEach(id => {
        if (action === 'delete') promises.push(emailApi.moveMessage(id, 'trash'));
        else if (action === 'archive') promises.push(emailApi.moveMessage(id, 'archive'));
        else promises.push(emailApi.updateMessage(id, { is_read: true }));
      });
      await Promise.all(promises);
      toast.success(`${checked.size} emails updated`);
      setChecked(new Set());
      if (selected && checked.has(selected.id)) setSelected(null);
      loadMessages();
    } catch { toast.error('Batch action failed'); }
  }

  function openCompose(replyTo?: EmailMessage) {
    if (replyTo) {
      setComposeForm({
        to: replyTo.from_address,
        cc: '',
        bcc: '',
        subject: `Re: ${replyTo.subject || ''}`,
        body: `\n\n--- On ${replyTo.received_at ? new Date(replyTo.received_at).toLocaleString() : ''} ${replyTo.from_name || replyTo.from_address} wrote ---\n${replyTo.body_text || ''}`,
      });
    } else {
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '' });
    }
    setShowCompose(true);
  }

  const filtered = messages.filter(m =>
    !search || (m.subject?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    m.from_address.toLowerCase().includes(search.toLowerCase())
  );
  const folders = FOLDERS.map(f => ({
    key: f, label: f.charAt(0).toUpperCase() + f.slice(1),
    icon: f === 'inbox' ? Inbox : f === 'sent' ? Send : f === 'drafts' ? FileText : f === 'spam' ? AlertTriangle : f === 'trash' ? Trash2 : Archive,
    count: messages.length,
  }));

  const noAccounts = accounts.length === 0;

  return (
    <div className="page-enter" style={{ height: 'calc(100vh - 7rem)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Mail size={20} style={{ color: 'var(--color-primary)' }} /> Email
        </h1>
        <div className="flex items-center gap-2">
          {!noAccounts && (
            <>
              <button className="btn-secondary btn-sm" onClick={() => { loadMessages(); setSelected(null); }}><RefreshCw size={14} /> Sync</button>
              <button className="btn-primary btn-sm" onClick={() => openCompose()}><Edit3 size={14} /> Compose</button>
            </>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setShowAddAccount(true)}><Plus size={14} /> Add Account</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[220px] shrink-0 border-e overflow-y-auto p-2 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          {accounts.map(a => (
            <div key={a.id} className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Mail size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="truncate flex-1">{a.display_name || a.email_address}</span>
              {a.is_primary && <Check size={12} style={{ color: 'var(--color-success)' }} />}
            </div>
          ))}
          <hr className="my-2" style={{ borderColor: 'var(--color-border)' }} />
          {folders.map(f => (
            <button key={f.key} onClick={() => { setFolder(f.key); setSelected(null); setChecked(new Set()); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: folder === f.key ? 'var(--color-primary-light)' : 'transparent',
                color: folder === f.key ? 'var(--color-primary)' : 'var(--color-text)',
              }}>
              <f.icon size={16} />
              <span className="flex-1 text-start">{f.label}</span>
            </button>
          ))}
          <button className="btn-primary btn-sm w-full mt-4" onClick={() => openCompose()}><Edit3 size={14} /> Compose</button>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {noAccounts ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 p-8">
                <Mail size={48} className="mx-auto" style={{ color: 'var(--color-text-secondary)' }} />
                <p className="text-lg" style={{ color: 'var(--color-text)' }}>Add your email account to get started</p>
                <button className="btn-primary" onClick={() => setShowAddAccount(true)}><Plus size={16} /> Add Email Account</button>
              </div>
            </div>
          ) : selected ? (
            /* Detail View */
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <button className="btn-secondary btn-sm mb-2" onClick={() => setSelected(null)} style={{ display: 'inline-flex' }}><X size={14} /> Back</button>
              <div className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{selected.subject || '(no subject)'}</h2>
                  <button onClick={() => toggleStar(selected)} className="shrink-0">
                    <Star size={18} fill={selected.is_starred ? 'var(--color-warning)' : 'none'} style={{ color: 'var(--color-warning)' }} />
                  </button>
                </div>
                <div className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <p><strong style={{ color: 'var(--color-text)' }}>From:</strong> {selected.from_name ? `${selected.from_name} <${selected.from_address}>` : selected.from_address}</p>
                  <p><strong style={{ color: 'var(--color-text)' }}>To:</strong> {selected.to_addresses?.join(', ')}</p>
                  {selected.cc_addresses?.length > 0 && <p><strong style={{ color: 'var(--color-text)' }}>CC:</strong> {selected.cc_addresses.join(', ')}</p>}
                  <p><strong style={{ color: 'var(--color-text)' }}>Date:</strong> {selected.received_at ? new Date(selected.received_at).toLocaleString() : '-'}</p>
                </div>
                <hr style={{ borderColor: 'var(--color-border)' }} />
                <div className="min-h-[200px]">
                  {selected.body_html ? (
                    <iframe
                      className="w-full border-0"
                      style={{ minHeight: '400px', backgroundColor: 'white' }}
                      srcDoc={selected.body_html}
                      title="Email body"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap font-sans" style={{ color: 'var(--color-text)' }}>{selected.body_text || '(no content)'}</pre>
                  )}
                </div>
                {selected.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Paperclip size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    {selected.attachments.map((att, i) => {
                      const a = att as Record<string, string>;
                      const name = a.name || a.file_name || 'file';
                      const url = a.url || a.file_url || '';
                      const type = a.type || a.mime_type || '';
                      return (
                        url ? (
                          <button key={i} className="badge text-xs cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setPreviewFile({ url, fileName: name, mimeType: type })}>
                            {name}
                          </button>
                        ) : (
                          <span key={i} className="badge text-xs">{name}</span>
                        )
                      );
                    })}
                  </div>
                )}
              </div>
              <button className="btn-primary btn-sm" onClick={() => openCompose(selected)}><Reply size={14} /> Reply</button>
            </div>
          ) : (
            /* List View */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
                  <input className="input ps-9 text-sm" placeholder="Search by subject or sender..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {checked.size > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs mr-1" style={{ color: 'var(--color-text-secondary)' }}>{checked.size} selected</span>
                    <button className="btn-secondary btn-sm" onClick={() => batchAction('read')}><Eye size={14} /></button>
                    <button className="btn-secondary btn-sm" onClick={() => batchAction('archive')}><Archive size={14} /></button>
                    <button className="btn-secondary btn-sm" onClick={() => batchAction('delete')}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} /></div>
                ) : filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No emails in {folder}</div>
                ) : (
                  filtered.map(msg => (
                    <div key={msg.id}
                      className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-colors hover:opacity-80"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: msg.is_read ? 'transparent' : 'var(--color-primary-light)' }}
                      onClick={() => { setSelected(msg); markRead(msg); }}>
                      <input type="checkbox" checked={checked.has(msg.id)} onChange={e => { e.stopPropagation(); const n = new Set(checked); if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id); setChecked(n); }} />
                      <button onClick={e => { e.stopPropagation(); toggleStar(msg); }}>
                        <Star size={14} fill={msg.is_starred ? 'var(--color-warning)' : 'none'} style={{ color: 'var(--color-warning)' }} />
                      </button>
                      <span className="text-sm font-medium w-40 truncate shrink-0" style={{ color: msg.is_read ? 'var(--color-text)' : 'var(--color-primary)' }}>
                        {msg.from_name || msg.from_address}
                      </span>
                      <span className="text-sm truncate flex-1" style={{ color: 'var(--color-text)' }}>
                        <span className="font-medium">{msg.subject || '(no subject)'}</span>
                        {msg.body_text && <span className="ms-2 opacity-60">— {msg.body_text.slice(0, 80)}</span>}
                      </span>
                      <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                        {msg.received_at ? new Date(msg.received_at).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCompose(false)}>
          <div className="rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Edit3 size={16} /> New Message</h3>
              <button className="btn-secondary btn-sm" onClick={() => setShowCompose(false)}><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div><input className="input w-full text-sm" placeholder="To *" value={composeForm.to} onChange={e => setComposeForm({...composeForm, to: e.target.value})} /></div>
              <div className="flex gap-2"><input className="input flex-1 text-sm" placeholder="CC" value={composeForm.cc} onChange={e => setComposeForm({...composeForm, cc: e.target.value})} /><input className="input flex-1 text-sm" placeholder="BCC" value={composeForm.bcc} onChange={e => setComposeForm({...composeForm, bcc: e.target.value})} /></div>
              <div><input className="input w-full text-sm" placeholder="Subject *" value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} /></div>
              <div><textarea className="input w-full text-sm" rows={12} placeholder="Write your message..." value={composeForm.body} onChange={e => setComposeForm({...composeForm, body: e.target.value})} /></div>
            </div>
            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex gap-2">
                <button className="btn-primary btn-sm" onClick={sendMessage} disabled={sending}><Send size={14} /> {sending ? 'Sending...' : 'Send'}</button>
                <button className="btn-secondary btn-sm" onClick={saveDraft} disabled={sending}><FileText size={14} /> Save Draft</button>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => setShowCompose(false)}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAddAccount(false)}>
          <div className="rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Add Email Account</h3>
              <button className="btn-secondary btn-sm" onClick={() => setShowAddAccount(false)}><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3">
              <input className="input w-full text-sm" placeholder="Email address *" value={accountForm.email_address} onChange={e => setAccountForm({...accountForm, email_address: e.target.value})} />
              <input className="input w-full text-sm" placeholder="Display name" value={accountForm.display_name} onChange={e => setAccountForm({...accountForm, display_name: e.target.value})} />
              <hr style={{ borderColor: 'var(--color-border)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>IMAP Settings</p>
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-sm" placeholder="IMAP Host" value={accountForm.imap_host} onChange={e => setAccountForm({...accountForm, imap_host: e.target.value})} />
                <input className="input text-sm" type="number" placeholder="Port" value={accountForm.imap_port} onChange={e => setAccountForm({...accountForm, imap_port: +e.target.value})} />
              </div>
              <input className="input w-full text-sm" placeholder="IMAP User *" value={accountForm.imap_user} onChange={e => setAccountForm({...accountForm, imap_user: e.target.value})} />
              <input className="input w-full text-sm" type="password" placeholder="IMAP Password" value={accountForm.imap_pass} onChange={e => setAccountForm({...accountForm, imap_pass: e.target.value})} />
              <hr style={{ borderColor: 'var(--color-border)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>SMTP Settings</p>
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-sm" placeholder="SMTP Host" value={accountForm.smtp_host} onChange={e => setAccountForm({...accountForm, smtp_host: e.target.value})} />
                <input className="input text-sm" type="number" placeholder="Port" value={accountForm.smtp_port} onChange={e => setAccountForm({...accountForm, smtp_port: +e.target.value})} />
              </div>
              <input className="input w-full text-sm" placeholder="SMTP User" value={accountForm.smtp_user} onChange={e => setAccountForm({...accountForm, smtp_user: e.target.value})} />
              <input className="input w-full text-sm" type="password" placeholder="SMTP Password" value={accountForm.smtp_pass} onChange={e => setAccountForm({...accountForm, smtp_pass: e.target.value})} />
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                <input type="checkbox" checked={accountForm.use_tls} onChange={e => setAccountForm({...accountForm, use_tls: e.target.checked})} /> Use TLS
              </label>
            </div>
            <div className="flex gap-2 p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button className="btn-primary btn-sm" onClick={addAccount} disabled={sending}><Plus size={14} /> {sending ? 'Adding...' : 'Add Account'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowAddAccount(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {previewFile && <FilePreviewModal url={previewFile.url} fileName={previewFile.fileName} mimeType={previewFile.mimeType} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
