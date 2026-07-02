import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import {
  conversationsApi, messagesApi, emailApi, meetingsApi, callLogsApi,
  type Conversation, type ChatMessage, type MessageReaction, type ConversationParticipant,
  type EmailAccount, type EmailMessage, type MeetingRoom,
} from '../services/api';
import FilePreviewModal from '../components/FilePreviewModal';
import Pagination from '../components/Pagination';

import Avatar from '../components/Avatar';
import type { UserProfile } from '../types';
import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare, Mail, Video, Phone, TicketCheck, Bot,
  Search, Send, Paperclip, Smile, Plus, X, Users, UserPlus, Loader2,
  FileText, CheckCheck, Inbox, Trash2, AlertTriangle, Archive, Star,
  Edit3, Reply, RefreshCw, Check, Eye, Clock, Calendar, Briefcase,
  HelpCircle, ArrowLeft, Film, Download,
  Zap, Settings, List, Cpu, Activity, Tag,
} from 'lucide-react';

const EMOJIS = ['👍', '❤️', '😊', '🎉', '😢', '🙏'];
const FOLDERS = ['inbox', 'sent', 'drafts', 'spam', 'trash', 'archive'] as const;

const PROVIDER_ICONS: Record<string, string> = { jitsi: '🔗', zoom: '🖥️', 'microsoft-teams': '💬' };

const MEETING_STATUS_COLORS: Record<string, string> = {
  scheduled: 'var(--color-primary)', ongoing: 'var(--color-success)',
  completed: 'var(--color-text-secondary)', cancelled: 'var(--color-danger)',
};

const TABS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'chat', label: 'Chat', Icon: MessageSquare },
  { key: 'email', label: 'Email', Icon: Mail },
  { key: 'meetings', label: 'Meetings', Icon: Video },
  { key: 'voice', label: 'Voice Calls', Icon: Phone },
  { key: 'support', label: 'Support', Icon: TicketCheck },
  { key: 'bot', label: 'Smart Bot', Icon: Bot },
];

interface ExtendedConvo extends Conversation {
  conversation_participants: (ConversationParticipant & { user?: UserProfile })[];
  last_message?: ChatMessage;
}

interface LocalMessage extends ChatMessage {
  sender?: UserProfile;
  reactions?: MessageReaction[];
  reactionUsers?: Record<string, string[]>;
}

export default function CommunicationPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [previewFile, setPreviewFile] = useState<{ url: string; fileName: string; mimeType?: string } | null>(null);

  return (
    <div className="page-enter space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <MessageSquare size={22} style={{ color: 'var(--color-primary)' }} /> Communication Hub
        </h1>
      </div>

      <div className="flex gap-1 border-b pb-0 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 -mb-px transition-colors ${activeTab === key ? '' : 'opacity-60 hover:opacity-80'}`}
            style={{
              backgroundColor: activeTab === key ? 'var(--color-surface)' : 'transparent',
              borderColor: 'var(--color-border)',
              color: activeTab === key ? 'var(--color-primary)' : 'var(--color-text)',
            }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'chat' && <ChatTab user={user} toast={toast} setPreviewFile={setPreviewFile} />}
      {activeTab === 'email' && <EmailTab user={user} toast={toast} setPreviewFile={setPreviewFile} />}
      {activeTab === 'meetings' && <MeetingsTab user={user} toast={toast} />}
      {activeTab === 'voice' && <VoiceCallsTab user={user} toast={toast} />}
      {activeTab === 'support' && <SupportTab user={user} toast={toast} />}
      {activeTab === 'bot' && <SmartBotTab user={user} toast={toast} />}

      {previewFile && <FilePreviewModal url={previewFile.url} fileName={previewFile.fileName} mimeType={previewFile.mimeType} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

function ChatTab({ user, toast, setPreviewFile }: { user: UserProfile | null; toast: ReturnType<typeof useToast>; setPreviewFile: (f: { url: string; fileName: string; mimeType?: string } | null) => void }) {
  const [conversations, setConversations] = useState<ExtendedConvo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [convoSearch, setConvoSearch] = useState('');
  const [input, setInput] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [showEmoji, setShowEmoji] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedConvo = conversations.find((c) => c.id === selectedId) || null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (selectedId) { loadMessages(selectedId); markAsRead(selectedId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('comm-chat-presence');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        for (const key of Object.keys(state)) {
          for (const p of state[key] as any[]) { if (p.user_id) ids.add(p.user_id); }
        }
        setOnlineUsers(ids);
      })
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload?.conversation_id && payload.payload?.user_id && payload.payload?.user_id !== user.id) {
          setTypingUsers((prev) => {
            const convoId = payload.payload.conversation_id;
            const userId = payload.payload.user_id;
            const existing = prev[convoId] || [];
            if (!existing.includes(userId)) return { ...prev, [convoId]: [...existing, userId] };
            return prev;
          });
          setTimeout(() => {
            setTypingUsers((prev) => {
              const convoId = payload.payload.conversation_id;
              const userId = payload.payload.user_id;
              const list = (prev[convoId] || []).filter((id) => id !== userId);
              if (list.length === 0) { delete prev[convoId]; return { ...prev }; }
              return { ...prev, [convoId]: list };
            });
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ user_id: user.id });
      });
    return () => { channel.unsubscribe(); };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase.channel(`comm-msg-${selectedId}`);
    channel
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, async (payload) => {
        const newMsg = payload.new as any;
        const { data: sender } = await supabase
          .from('user_profiles')
          .select('id, full_name_en, full_name_ar, avatar_url')
          .eq('id', newMsg.sender_id)
          .single();
        setMessages((prev) => [...prev, { ...newMsg, sender: sender as UserProfile, reactions: [], reactionUsers: {} } as LocalMessage]);
        conversationsApi.list().then(setConversations as any).catch(console.error);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase.channel(`comm-react-${selectedId}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        if (selectedId) loadReactions(selectedId);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [selectedId]);

  async function loadConversations() {
    setLoading(true);
    try {
      const data = await conversationsApi.list() as ExtendedConvo[];
      setConversations(data.filter((c) => c.conversation_participants?.length > 0));
    } catch { toast.error('Failed to load conversations'); }
    finally { setLoading(false); }
  }

  async function loadMessages(conversationId: string) {
    try {
      const data = await messagesApi.list(conversationId) as LocalMessage[];
      setMessages(data);
      await loadReactions(conversationId);
    } catch { toast.error('Failed to load messages'); }
  }

  async function loadReactions(conversationId: string) {
    try {
      const { data: msgIds } = await supabase.from('messages').select('id').eq('conversation_id', conversationId).is('deleted_at', null);
      if (!msgIds?.length) return;
      const ids = msgIds.map((m) => m.id);
      const { data: reactions } = await supabase.from('message_reactions').select('*, user_profiles!inner(id, full_name_en, full_name_ar)').in('message_id', ids);
      if (!reactions) return;
      const grouped: Record<string, { emoji: string; userId: string; userName: string }[]> = {};
      for (const r of reactions as any[]) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push({ emoji: r.emoji, userId: r.user_id, userName: r.user_profiles?.full_name_en || r.user_id });
      }
      setMessages((prev) => prev.map((m) => {
        const msgReactions = grouped[m.id] || [];
        const emojiSet = new Map<string, string[]>();
        for (const r of msgReactions) {
          if (!emojiSet.has(r.emoji)) emojiSet.set(r.emoji, []);
          emojiSet.get(r.emoji)!.push(r.userName);
        }
        return { ...m, reactions: msgReactions.map((r) => ({ id: '', message_id: m.id, user_id: r.userId, emoji: r.emoji, created_at: '' })), reactionUsers: Object.fromEntries(emojiSet) };
      }));
    } catch (e) { console.error(e); }
  }

  async function markAsRead(conversationId: string) {
    if (!user?.id) return;
    try {
      await supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId).neq('sender_id', user.id).eq('is_read', false);
    } catch (e) { console.error(e); }
  }

  async function broadcastTyping(conversationId: string) {
    if (!user?.id || !conversationId) return;
    try {
      const channel = supabase.channel('comm-chat-presence');
      await channel.send({ type: 'broadcast', event: 'typing', payload: { conversation_id: conversationId, user_id: user.id } });
    } catch (e) { console.error(e); }
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (selectedId) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      broadcastTyping(selectedId);
      typingTimerRef.current = setTimeout(() => {}, 2000);
    }
  }

  function scrollToBottom() { setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50); }

  async function handleSend() {
    const text = input.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try { await messagesApi.send(selectedId, text, 'text'); setInput(''); }
    catch { toast.error('Failed to send message'); }
    finally { setSending(false); }
  }

  async function handleSendFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setSending(true);
    try { await messagesApi.sendFile(selectedId, file); }
    catch { toast.error('Failed to upload file'); }
    finally { setSending(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleReaction(messageId: string, emoji: string) {
    try {
      const msg = messages.find((m) => m.id === messageId);
      const hasReacted = msg?.reactions?.some((r) => r.emoji === emoji && r.user_id === user?.id);
      if (hasReacted) await messagesApi.removeReaction(messageId, emoji);
      else await messagesApi.addReaction(messageId, emoji);
    } catch (e) { console.error(e); }
  }

  async function searchUsers(q: string) {
    setUserSearch(q);
    if (!q.trim()) { setUsers([]); return; }
    setUserSearching(true);
    try {
      const { data } = await supabase.from('user_profiles')
        .select('id, full_name_en, full_name_ar, avatar_url, role').ilike('full_name_en', `%${q}%`).limit(10);
      setUsers((data || []) as UserProfile[]);
    } catch (e) { console.error(e); }
    finally { setUserSearching(false); }
  }

  async function startDirectChat(otherUserId: string) {
    try {
      const existing = conversations.find((c) => {
        if (c.type !== 'direct') return false;
        return c.conversation_participants.filter((p) => p.user_id !== user?.id).map((p) => p.user_id).includes(otherUserId);
      });
      if (existing) { setSelectedId(existing.id); setShowNewChat(false); return; }
      const convo = await conversationsApi.createDirect(otherUserId) as ExtendedConvo;
      if (convo) {
        const { data: participants } = await supabase.from('conversation_participants').select('*, user:user_profiles(*)').eq('conversation_id', convo.id);
        convo.conversation_participants = (participants || []) as any;
        setConversations((prev) => [convo, ...prev]);
        setSelectedId(convo.id);
        setShowNewChat(false);
      }
    } catch { toast.error('Failed to create conversation'); }
  }

  function getConvoName(convo: ExtendedConvo): string {
    if (convo.name_en) return convo.name_en;
    return convo.conversation_participants.filter((p) => p.user_id !== user?.id)
      .map((p) => p.user?.full_name_en || 'Unknown').join(', ') || 'Unknown';
  }

  function getOtherUserId(convo: ExtendedConvo): string | undefined {
    if (convo.type !== 'direct') return undefined;
    return convo.conversation_participants.find((p) => p.user_id !== user?.id)?.user_id;
  }

  function isOnline(userId: string): boolean { return onlineUsers.has(userId); }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const filteredConvos = conversations.filter((c) => !convoSearch || getConvoName(c).toLowerCase().includes(convoSearch.toLowerCase()));
  const sortedMessages = [...messages];

  return (
    <div className="flex h-[calc(100vh-12rem)]" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-80 flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Chat</h2>
            <button className="btn-sm" onClick={() => setShowNewChat(true)}><Plus size={16} /> New</button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input className="input ps-8 text-sm" placeholder="Search conversations..." value={convoSearch} onChange={(e) => setConvoSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} /></div>
          ) : filteredConvos.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
              {convoSearch ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : filteredConvos.map((convo) => {
            const isSelected = convo.id === selectedId;
            const otherId = getOtherUserId(convo);
            return (
              <button key={convo.id}
                className={`w-full text-start p-3 flex items-center gap-3 border-b transition-colors ${isSelected ? '' : 'hover:opacity-80'}`}
                style={{ borderColor: 'var(--color-border)', backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent', color: isSelected ? '#fff' : 'var(--color-text)' }}
                onClick={() => setSelectedId(convo.id)}>
                <div className="relative flex-shrink-0">
                  {convo.type === 'direct' ? (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--color-primary-light)', color: isSelected ? '#fff' : 'var(--color-primary)' }}>
                      {getConvoName(convo).charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--color-primary-light)' }}>
                      <Users size={18} style={{ color: isSelected ? '#fff' : 'var(--color-primary)' }} />
                    </div>
                  )}
                  {otherId && (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${isOnline(otherId) ? 'bg-green-500' : 'bg-gray-400'}`}
                      style={{ borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-surface)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{getConvoName(convo)}</p>
                  <p className="text-xs truncate" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)' }}>
                    {convo.type === 'direct' ? 'Direct message' : 'Group'}
                    {convo.project?.project_code && <span className="ms-1.5 opacity-70">· {convo.project.project_code}</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!selectedConvo ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-lg font-medium" style={{ color: 'var(--color-text-muted)' }}>Select a conversation</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Choose a chat from the sidebar or start a new one</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="flex-1 flex items-center gap-3">
                {selectedConvo.type === 'direct' ? (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    {getConvoName(selectedConvo).charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                    <Users size={16} style={{ color: 'var(--color-primary)' }} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{getConvoName(selectedConvo)}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {typingUsers[selectedId!]?.length ? (
                      <span className="text-green-500 italic">
                        {typingUsers[selectedId!].map((uid) => {
                          const p = selectedConvo.conversation_participants.find(pp => pp.user_id === uid);
                          return p?.user?.full_name_en || 'Someone';
                        }).join(', ') + ' typing...'}
                      </span>
                    ) : selectedConvo.type === 'group' ? `${selectedConvo.conversation_participants.length} members` : 'Direct message'}
                    {selectedConvo.project?.project_code && <span className="ms-1.5">· {selectedConvo.project.project_code}</span>}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sortedMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No messages yet</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Send a message to start the conversation</p>
                  </div>
                </div>
              ) : sortedMessages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[70%]">
                      <div className="flex items-end gap-2">
                        {!isMine && (
                          <Avatar url={msg.sender?.avatar_url} name={msg.sender?.full_name_en} size={28} />
                        )}
                        <div>
                          {!isMine && <p className="text-xs mb-1 ps-1" style={{ color: 'var(--color-text-muted)' }}>{msg.sender?.full_name_en || 'Unknown'}</p>}
                          <div className="rounded-2xl px-4 py-2 text-sm break-words"
                            style={{ backgroundColor: isMine ? 'var(--color-primary)' : 'var(--color-card)', color: isMine ? '#fff' : 'var(--color-text)', borderBottomRightRadius: isMine ? '4px' : '12px', borderBottomLeftRadius: isMine ? '12px' : '4px' }}>
                            {msg.message_type === 'file' ? (
                              <div className="flex items-center gap-2">
                                <FileText size={16} />
                                <button onClick={() => msg.file_url && setPreviewFile({ url: msg.file_url, fileName: msg.file_name || 'file', mimeType: msg.mime_type })}
                                  className="underline text-sm cursor-pointer" style={{ color: isMine ? '#fff' : 'var(--color-primary)' }}>{msg.file_name || 'Download file'}</button>
                              </div>
                            ) : msg.message_type === 'image' ? (
                              <img src={msg.file_url} alt="" className="max-w-xs rounded-lg cursor-pointer"
                                onClick={() => msg.file_url && setPreviewFile({ url: msg.file_url, fileName: msg.file_name || 'image', mimeType: msg.mime_type })} />
                            ) : <span>{msg.content}</span>}
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatTime(msg.created_at)}</span>
                            {isMine && (msg.is_read ? <CheckCheck size={12} className="text-blue-500" /> : msg.delivered_at ? <CheckCheck size={12} className="text-gray-400" /> : null)}
                          </div>
                          {msg.reactionUsers && Object.keys(msg.reactionUsers).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(msg.reactionUsers).map(([emoji, names]) => (
                                <span key={emoji} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border"
                                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }} title={names.join(', ')}>
                                  {emoji} {names.length}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`flex gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
                          {EMOJIS.slice(0, 4).map((emoji) => (
                            <button key={emoji} className="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:scale-110 transition-transform"
                              style={{ backgroundColor: 'var(--color-card)' }} onClick={() => handleReaction(msg.id, emoji)} title={emoji}>{emoji}</button>
                          ))}
                          <button className="w-6 h-6 flex items-center justify-center rounded-full text-xs" style={{ backgroundColor: 'var(--color-card)' }}
                            onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)}><Smile size={12} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-end gap-2">
                <button className="flex-shrink-0 p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-muted)' }} onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={18} />
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleSendFile} />
                <div className="flex-1 relative">
                  <textarea className="input pe-10 resize-none" rows={2} placeholder="Type a message..." value={input}
                    onChange={(e) => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} style={{ backgroundColor: 'var(--color-bg)' }} />
                </div>
                <button className="btn-sm flex-shrink-0" onClick={handleSend} disabled={!input.trim() || sending}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewChat(false)}>
          <div className="glass-card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>New Conversation</h3>
              <button className="btn-xs btn-secondary" onClick={() => setShowNewChat(false)}><X size={14} /></button>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input className="input ps-8" placeholder="Search users..." value={userSearch} onChange={(e) => searchUsers(e.target.value)} autoFocus />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {userSearching ? (
                <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin" /></div>
              ) : users.length === 0 && userSearch ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No users found</p>
              ) : users.map((u) => (
                <button key={u.id} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:opacity-80 transition-colors text-start"
                  style={{ backgroundColor: 'var(--color-card)' }} onClick={() => startDirectChat(u.id)}>
                  <Avatar url={(u as any).avatar_url} name={u.full_name_en} size={36} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{u.full_name_en}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{u.role}</p>
                  </div>
                  <UserPlus size={16} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              ))}
            </div>
            {user?.id && users.length > 0 && (
              <button className="btn-sm w-full mt-3" onClick={() => {
                const ids = users.filter((u) => u.id !== user.id).map((u) => u.id);
                if (ids.length === 0) return;
                conversationsApi.createGroup('New Group', ids)
                  .then((convo) => { setShowNewChat(false); loadConversations(); setSelectedId(convo.id); })
                  .catch(() => toast.error('Failed to create group'));
              }}>
                <Users size={16} /> Create Group with all results
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmailTab({ user, toast, setPreviewFile }: { user: UserProfile | null; toast: ReturnType<typeof useToast>; setPreviewFile: (f: { url: string; fileName: string; mimeType?: string } | null) => void }) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<string>('inbox');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name_en: string; subject_en: string; body_en: string }[]>([]);
  const [composeForm, setComposeForm] = useState({
    to: '', cc: '', bcc: '', subject: '', body: '', scheduled_send_at: '', importance: 'normal' as string, read_receipt_requested: false,
  });
  const [accountForm, setAccountForm] = useState({
    email_address: '', display_name: '',
    imap_host: 'imap.gmail.com', imap_port: 993, imap_user: '', imap_pass: '',
    smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_user: '', smtp_pass: '',
    use_tls: true,
  });
  const [saveTemplateForm, setSaveTemplateForm] = useState({ name_en: '', subject_en: '', body_en: '' });
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  async function loadAccounts() {
    try {
      const accts = await emailApi.listAccounts();
      setAccounts(accts);
      if (accts.length > 0 && folder) loadMessages(accts, folder);
    } catch { toast.error('Failed to load accounts'); }
  }

  async function loadMessages(accts?: EmailAccount[], f?: string) {
    setLoading(true);
    try {
      const a = accts || accounts;
      const fld = f || folder;
      if (a.length === 0) return;
      const all = (await Promise.all(a.map(ac => emailApi.listMessages(ac.id, fld)))).flat();
      setMessages(all);
    } catch { toast.error('Failed to load emails'); }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAccounts(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (accounts.length) loadMessages(accounts, folder); }, [folder]);

  const primaryAccount = accounts.find(a => a.is_primary) || accounts[0];

  async function loadTemplates() {
    try { const { data } = await supabase.from('email_templates').select('id, name_en, subject_en, body_en').order('name_en'); setTemplates(data || []); }
    catch (e) { console.error(e); }
  }

  async function addAccount() {
    if (!accountForm.email_address.trim() || !accountForm.imap_user.trim()) { toast.error('Email and IMAP user required'); return; }
    setSending(true);
    try {
      await emailApi.addAccount({ user_id: user?.id, ...accountForm, imap_port: accountForm.imap_port, smtp_port: accountForm.smtp_port });
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
      const msgPayload: any = {
        account_id: primaryAccount.id, folder: 'sent', from_address: primaryAccount.email_address,
        from_name: primaryAccount.display_name, to_addresses: composeForm.to.split(',').map(s => s.trim()),
        cc_addresses: composeForm.cc ? composeForm.cc.split(',').map(s => s.trim()) : [],
        bcc_addresses: composeForm.bcc ? composeForm.bcc.split(',').map(s => s.trim()) : [],
        subject: composeForm.subject, body_html: composeForm.body.replace(/\n/g, '<br>'), body_text: composeForm.body,
        attachments: [], is_read: true, importance: composeForm.importance, read_receipt_requested: composeForm.read_receipt_requested,
      };
      if (composeForm.scheduled_send_at) msgPayload.scheduled_send_at = composeForm.scheduled_send_at;
      await emailApi.sendMessage(msgPayload);
      toast.success('Email sent');
      setShowCompose(false);
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '', scheduled_send_at: '', importance: 'normal', read_receipt_requested: false });
      loadMessages();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Send failed'); }
    finally { setSending(false); }
  }

  async function saveDraft() {
    if (!primaryAccount) return;
    try {
      await emailApi.sendMessage({
        account_id: primaryAccount.id, folder: 'drafts', from_address: primaryAccount.email_address,
        to_addresses: composeForm.to ? composeForm.to.split(',').map(s => s.trim()) : [],
        subject: composeForm.subject || '(no subject)', body_text: composeForm.body, attachments: [], is_read: true,
      });
      toast.success('Draft saved');
      setShowCompose(false);
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '', scheduled_send_at: '', importance: 'normal', read_receipt_requested: false });
      if (folder === 'drafts') loadMessages();
    } catch { toast.error('Save failed'); }
  }

  async function saveAsTemplate() {
    if (!saveTemplateForm.name_en.trim() || !composeForm.subject.trim()) { toast.error('Template name and subject required'); return; }
    try {
      await supabase.from('email_templates').insert({
        name_en: saveTemplateForm.name_en, subject_en: composeForm.subject, body_en: composeForm.body,
        code: `tpl_${Date.now()}`, name_ar: '', subject_ar: '', body_ar: '', variables: [], is_active: true,
      });
      toast.success('Template saved');
      setShowSaveTemplate(false);
      setSaveTemplateForm({ name_en: '', subject_en: '', body_en: '' });
      loadTemplates();
    } catch { toast.error('Failed to save template'); }
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
    } catch (e) { console.error(e); }
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
        to: replyTo.from_address, cc: '', bcc: '', subject: `Re: ${replyTo.subject || ''}`,
        body: `\n\n--- On ${replyTo.received_at ? new Date(replyTo.received_at).toLocaleString() : ''} ${replyTo.from_name || replyTo.from_address} wrote ---\n${replyTo.body_text || ''}`,
        scheduled_send_at: '', importance: 'normal', read_receipt_requested: false,
      });
    } else {
      setComposeForm({ to: '', cc: '', bcc: '', subject: '', body: '', scheduled_send_at: '', importance: 'normal', read_receipt_requested: false });
    }
    setShowCompose(true);
  }

  function insertTemplate(tpl: typeof templates[0]) {
    setComposeForm(prev => ({ ...prev, subject: tpl.subject_en || prev.subject, body: tpl.body_en || prev.body }));
    setShowTemplates(false);
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
    <div style={{ height: 'calc(100vh - 12rem)', display: 'flex', flexDirection: 'column' }}>
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
        <div className="w-[220px] shrink-0 border-e overflow-y-auto p-2 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
          {accounts.map(a => (
            <div key={a.id} className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Mail size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="truncate flex-1">{a.display_name || a.email_address}</span>
              {a.is_primary && <Check size={12} style={{ color: 'var(--color-success)' }} />}
            </div>
          ))}
          {accounts.length > 0 && <hr className="my-2" style={{ borderColor: 'var(--color-border)' }} />}
          {folders.map(f => (
            <button key={f.key} onClick={() => { setFolder(f.key); setSelected(null); setChecked(new Set()); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ backgroundColor: folder === f.key ? 'var(--color-primary-light)' : 'transparent', color: folder === f.key ? 'var(--color-primary)' : 'var(--color-text)' }}>
              <f.icon size={16} />
              <span className="flex-1 text-start">{f.label}</span>
            </button>
          ))}
          <button className="btn-primary btn-sm w-full mt-4" onClick={() => openCompose()}><Edit3 size={14} /> Compose</button>
        </div>

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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <button className="btn-secondary btn-sm mb-2" onClick={() => setSelected(null)} style={{ display: 'inline-flex' }}><X size={14} /> Back</button>
              <div className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{selected.subject || '(no subject)'}</h2>
                  <button onClick={() => toggleStar(selected)} className="shrink-0">
                    <Star size={18} fill={selected.is_starred ? 'var(--color-warning)' : 'none'} style={{ color: 'var(--color-warning)' }} />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {(selected as any).importance === 'high' && <span className="badge text-xs" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>High</span>}
                  {(selected as any).importance === 'low' && <span className="badge text-xs" style={{ backgroundColor: '#f0fdf4', color: '#22c55e' }}>Low</span>}
                  {(selected as any).read_receipt_requested && <span className="badge text-xs flex items-center gap-1"><Eye size={10} /> Read Receipt</span>}
                  {(selected as any).labels?.length > 0 && (selected as any).labels.map((l: string, i: number) => (
                    <span key={i} className="badge text-xs">{l}</span>
                  ))}
                  {(selected as any).scheduled_send_at && <span className="badge text-xs" style={{ backgroundColor: '#fefce8', color: '#ca8a04' }}>Scheduled: {new Date((selected as any).scheduled_send_at).toLocaleDateString()}</span>}
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
                    <iframe className="w-full border-0" style={{ minHeight: '400px', backgroundColor: 'white' }}
                      srcDoc={selected.body_html} title="Email body" sandbox="allow-same-origin" />
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
                      return url ? (
                        <button key={i} className="badge text-xs cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={() => setPreviewFile({ url, fileName: name, mimeType: type })}>{name}</button>
                      ) : <span key={i} className="badge text-xs">{name}</span>;
                    })}
                  </div>
                )}
              </div>
              <button className="btn-primary btn-sm" onClick={() => openCompose(selected)}><Reply size={14} /> Reply</button>
            </div>
          ) : (
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
                ) : filtered.map(msg => (
                  <div key={msg.id}
                    className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: msg.is_read ? 'transparent' : 'var(--color-primary-light)' }}
                    onClick={() => { setSelected(msg); markRead(msg); }}>
                    <input type="checkbox" checked={checked.has(msg.id)}
                      onChange={e => { e.stopPropagation(); const n = new Set(checked); if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id); setChecked(n); }} />
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
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCompose(false)}>
          <div className="rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Edit3 size={16} /> New Message</h3>
              <div className="flex items-center gap-2">
                <button className="btn-secondary btn-sm" onClick={() => { setShowTemplates(true); loadTemplates(); }}><FileText size={14} /> Templates</button>
                <button className="btn-secondary btn-sm" onClick={() => setShowCompose(false)}><X size={14} /></button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div><input className="input w-full text-sm" placeholder="To *" value={composeForm.to} onChange={e => setComposeForm({...composeForm, to: e.target.value})} /></div>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder="CC" value={composeForm.cc} onChange={e => setComposeForm({...composeForm, cc: e.target.value})} />
                <input className="input flex-1 text-sm" placeholder="BCC" value={composeForm.bcc} onChange={e => setComposeForm({...composeForm, bcc: e.target.value})} />
              </div>
              <div><input className="input w-full text-sm" placeholder="Subject *" value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label text-xs">Scheduled Send</label>
                  <input type="datetime-local" className="input text-sm" value={composeForm.scheduled_send_at} onChange={e => setComposeForm({...composeForm, scheduled_send_at: e.target.value})} /></div>
                <div><label className="label text-xs">Importance</label>
                  <select className="input text-sm" value={composeForm.importance} onChange={e => setComposeForm({...composeForm, importance: e.target.value})}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
                    <input type="checkbox" checked={composeForm.read_receipt_requested} onChange={e => setComposeForm({...composeForm, read_receipt_requested: e.target.checked})} />
                    <Eye size={14} /> Read Receipt
                  </label>
                </div>
              </div>
              <div><textarea className="input w-full text-sm" rows={12} placeholder="Write your message..." value={composeForm.body} onChange={e => setComposeForm({...composeForm, body: e.target.value})} /></div>
            </div>
            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex gap-2">
                <button className="btn-primary btn-sm" onClick={sendMessage} disabled={sending}><Send size={14} /> {sending ? 'Sending...' : 'Send'}</button>
                <button className="btn-secondary btn-sm" onClick={saveDraft} disabled={sending}><FileText size={14} /> Save Draft</button>
                <button className="btn-secondary btn-sm" onClick={() => { setSaveTemplateForm({ name_en: composeForm.subject || 'Template', subject_en: composeForm.subject, body_en: composeForm.body }); setShowSaveTemplate(true); }}><Tag size={14} /> Save as Template</button>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => setShowCompose(false)}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSaveTemplate(false)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Save as Template</h3>
            <div className="space-y-3">
              <div><label className="label">Template Name *</label><input className="input" value={saveTemplateForm.name_en} onChange={e => setSaveTemplateForm({...saveTemplateForm, name_en: e.target.value})} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={saveAsTemplate}><Tag size={14} /> Save</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowSaveTemplate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowTemplates(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg max-h-[70vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Email Templates</h3>
              <button className="btn-secondary btn-sm" onClick={() => setShowTemplates(false)}><X size={14} /></button>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No templates saved yet</p>
            ) : templates.map(tpl => (
              <div key={tpl.id} className="card p-3 mb-2 cursor-pointer hover:opacity-80" onClick={() => insertTemplate(tpl)}>
                <p className="font-medium text-sm">{tpl.name_en}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{tpl.subject_en}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}

function MeetingsTab({ user, toast }: { user: UserProfile | null; toast: ReturnType<typeof useToast> }) {
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
  const [selectedRecordingMeeting, setSelectedRecordingMeeting] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [projects, setProjects] = useState<{ id: string; name_en: string; project_code: string }[]>([]);
  const [filterProject, setFilterProject] = useState('');
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
        supabase.from('user_profiles').select('id, full_name_en, full_name_ar, avatar_url').eq('is_active', true).order('full_name_en'),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      setMeetings(meetRes);
      setUsers((userRes.data || []) as { id: string; full_name_en: string; full_name_ar?: string }[]);
      setProjects((projRes.data || []) as { id: string; name_en: string; project_code: string }[]);
    } catch { toast.error('Failed to load meetings'); }
    finally { setLoading(false); }
  }

  const now = new Date().toISOString();
  const filtered = meetings.filter(m => {
    if (tab === 'upcoming' && m.start_time && m.start_time < now && m.status !== 'scheduled' && m.status !== 'ongoing') return false;
    if (tab === 'past' && (!m.start_time || m.start_time >= now) && m.status !== 'completed' && m.status !== 'cancelled') return false;
    if (search && !m.title_en.toLowerCase().includes(search.toLowerCase()) && !(m.title_ar || '').includes(search)) return false;
    if (filterProject && (m as any).project_id !== filterProject) return false;
    return true;
  });

  function getUserStatus(m: MeetingRoom): string | null {
    if (!user || !m.participants) return null;
    const p = m.participants.find(pp => pp.user_id === user.id);
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
        title_en: form.title_en, title_ar: form.title_ar || undefined, description: form.description || undefined,
        start_time: form.start_time, duration_minutes: form.duration_minutes, provider: form.provider,
        meet_link: `https://meet.jit.si/ERP-${meetId}`, status: 'scheduled',
        created_by: user?.id, project_id: form.project_id || undefined,
      });
      if (form.participant_ids.length) {
        const { error } = await supabase.from('meeting_participants').insert(
          form.participant_ids.map(uid => ({ meeting_id: meeting.id, user_id: uid, status: 'pending' }))
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
    } catch (e) { console.error(e); }
  }

  async function deleteRecording(id: string) {
    try { await supabase.from('meeting_recordings').delete().eq('id', id); toast.success('Recording deleted'); await loadRecordings(selectedRecordingMeeting || undefined); }
    catch { toast.error('Delete failed'); }
  }

  async function handleRespond(meetingId: string, status: string) {
    try { await meetingsApi.respond(meetingId, status); toast.success(`RSVP: ${status}`); load(); }
    catch { toast.error('RSVP failed'); }
  }

  function toggleParticipant(id: string) {
    setForm(f => ({
      ...f, participant_ids: f.participant_ids.includes(id) ? f.participant_ids.filter(x => x !== id) : [...f.participant_ids, id],
    }));
  }

  const statusBadge = (status: string) => (
    <span className="badge text-xs capitalize"
      style={{ backgroundColor: `color-mix(in srgb, ${MEETING_STATUS_COLORS[status] || 'var(--color-text-secondary)'} 15%, transparent)`, color: MEETING_STATUS_COLORS[status] || 'var(--color-text-secondary)' }}>
      {status}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{meetings.length} total</p></div>
        <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setShowCreate(true); }}><Plus size={16} /> New Meeting</button>
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
          <Film size={14} className="inline mr-1" /> Recordings
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
            <select className="input text-sm" style={{ width: '240px' }} value={selectedRecordingMeeting || ''}
              onChange={e => { setSelectedRecordingMeeting(e.target.value || null); loadRecordings(e.target.value || undefined); }}>
              <option value="">All Meetings</option>
              {meetings.map(m => <option key={m.id} value={m.id}>{m.title_en}</option>)}
            </select>
          </div>
          {recordings.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
              <Film size={48} className="mx-auto mb-3 opacity-30" /><p>No recordings yet</p>
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
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <Video size={48} className="mx-auto mb-3 opacity-30" /><p>No meetings found</p>
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
                      <button className="btn-sm btn-primary text-xs flex items-center gap-1" onClick={() => setJoinMeeting(m)}><Video size={12} /> Join</button>
                    )}
                    {isPast && <button className="btn-sm btn-secondary text-xs" onClick={() => setJoinMeeting(m)}>View</button>}
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
                  <option value="jitsi">Jitsi Meet</option><option value="zoom">Zoom</option><option value="microsoft-teams">Microsoft Teams</option>
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
            <span className="ml-auto text-xs opacity-70" style={{ color: MEETING_STATUS_COLORS[joinMeeting.status] }}>{joinMeeting.status}</span>
          </div>
          <div className="flex flex-1 min-h-0" onClick={e => e.stopPropagation()}>
            <div className="flex-1 relative">
              <iframe src={`${joinMeeting.meet_link || `https://meet.jit.si/ERP-${joinMeeting.id.slice(0, 8)}`}?userInfo.displayName="${user?.full_name_en || 'User'}"`}
                className="absolute inset-0 w-full h-full" allow="camera; microphone; display-capture; autoplay"
                style={{ border: 'none' }} title="Jitsi Meeting" />
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

function VoiceCallsTab({ user: _user, toast }: { user: UserProfile | null; toast: ReturnType<typeof useToast> }) {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [selectedCall, setSelectedCall] = useState<any>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await callLogsApi.list();
      setCalls(data);
    } catch { toast.error('Failed to load call logs'); }
    finally { setLoading(false); }
  }

  const filtered = calls.filter(c => {
    if (direction && c.direction !== direction) return false;
    if (status && c.status !== status) return false;
    if (search && !(c.caller_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCalls = calls.length;
  const answered = calls.filter(c => c.status === 'completed').length;
  const missed = calls.filter(c => c.status === 'missed').length;
  const avgDuration = calls.filter(c => c.duration).reduce((s, c) => s + (c.duration || 0), 0) / (calls.filter(c => c.duration).length || 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-glass text-center"><p className="text-2xl font-bold">{totalCalls}</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Total</p></div>
        <div className="stat-glass text-center" style={{ borderTop: '2px solid var(--color-success)' }}><p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{answered}</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Answered</p></div>
        <div className="stat-glass text-center" style={{ borderTop: '2px solid var(--color-danger)' }}><p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{missed}</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Missed</p></div>
        <div className="stat-glass text-center"><p className="text-2xl font-bold">{Math.round(avgDuration / 60)}m</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Avg Duration</p></div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <select className="input max-w-[160px] text-sm py-1.5" value={direction} onChange={e => setDirection(e.target.value)}>
          <option value="">All Directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option>
        </select>
        <select className="input max-w-[160px] text-sm py-1.5" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option><option value="completed">Completed</option><option value="missed">Missed</option><option value="busy">Busy</option><option value="failed">Failed</option>
        </select>
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input ps-8 py-1.5 text-sm w-full" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{filtered.length} results</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <Phone size={48} className="mx-auto mb-3 opacity-30" /><p>No call logs found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Type</th><th>Caller</th><th>Direction</th><th>Duration</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="cursor-pointer hover:opacity-80" onClick={() => setSelectedCall(c)}>
                  <td><span className="text-lg">{c.call_type === 'video' ? <Video size={16} /> : <Phone size={16} />}</span></td>
                  <td><div><p className="text-sm font-medium">{c.caller_name || 'Unknown'}</p><p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.caller_number}</p></div></td>
                  <td><span className={`badge text-xs ${c.direction === 'inbound' ? 'badge-info' : 'badge-warning'}`}>{c.direction}</span></td>
                  <td className="text-sm">{c.duration ? `${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')}` : '-'}</td>
                  <td className="text-sm">{new Date(c.started_at || c.created_at).toLocaleString()}</td>
                  <td><span className={`badge text-xs capitalize ${c.status === 'completed' ? 'text-green-500' : c.status === 'missed' ? 'text-red-500' : ''}`} style={{ backgroundColor: `color-mix(in srgb, ${c.status === 'completed' ? 'var(--color-success)' : c.status === 'missed' ? 'var(--color-danger)' : 'var(--color-text-secondary)'} 15%, transparent)` }}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCall && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setSelectedCall(null)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Call Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Caller</span><span>{selectedCall.caller_name || selectedCall.caller_number || 'Unknown'}</span></div>
              {selectedCall.caller_number && <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Number</span><span>{selectedCall.caller_number}</span></div>}
              {selectedCall.callee_number && <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Callee</span><span>{selectedCall.callee_number}</span></div>}
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Direction</span><span className="capitalize">{selectedCall.direction}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Status</span><span className={`capitalize ${selectedCall.status === 'completed' ? 'text-green-500' : selectedCall.status === 'missed' ? 'text-red-500' : ''}`}>{selectedCall.status}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Duration</span><span>{selectedCall.duration ? `${Math.floor(selectedCall.duration / 60)}:${String(selectedCall.duration % 60).padStart(2, '0')}` : '-'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--color-text-secondary)' }}>Time</span><span>{new Date(selectedCall.started_at || selectedCall.created_at).toLocaleString()}</span></div>
              {selectedCall.notes && <div><span style={{ color: 'var(--color-text-secondary)' }}>Notes</span><p className="mt-1 text-xs">{selectedCall.notes}</p></div>}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-secondary btn-sm" onClick={() => setSelectedCall(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupportTab({ user, toast }: { user: UserProfile | null; toast: ReturnType<typeof useToast> }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', category: '', project_id: '' });
  const [projects, setProjects] = useState<{ id: string; name_en: string; project_code: string }[]>([]);

  const limit = 10;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [ticketRes, projRes] = await Promise.all([
        supabase.from('support_tickets').select('*, assignee:user_profiles!support_tickets_assigned_to_fkey(id, full_name_en), creator:user_profiles!support_tickets_created_by_fkey(id, full_name_en)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true),
      ]);
      setTickets(ticketRes.data || []);
      setCount(ticketRes.count || 0);
      setProjects((projRes.data || []) as any);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = tickets.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalTickets = count;
  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  async function handleCreate() {
    if (!form.subject.trim()) { toast.error('Subject is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        subject: form.subject, description: form.description || undefined, priority: form.priority,
        category: form.category || undefined, project_id: form.project_id || undefined, created_by: user?.id, status: 'open',
      });
      if (error) throw error;
      toast.success('Ticket created');
      setShowCreate(false);
      setForm({ subject: '', description: '', priority: 'medium', category: '', project_id: '' });
      load();
    } catch (err: any) { toast.error(err.message || 'Create failed'); }
    finally { setSaving(false); }
  }

  async function addComment(ticketId: string) {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId, user_id: user?.id, content: commentText, is_internal: false,
      });
      if (error) throw error;
      setCommentText('');
      toast.success('Comment added');
      if (showDetail?.id === ticketId) {
        const { data } = await supabase.from('ticket_comments').select('*, user:user_profiles(id, full_name_en)').eq('ticket_id', ticketId).order('created_at');
        setShowDetail({ ...showDetail, comments: data || [] });
      }
    } catch (err: any) { toast.error(err.message || 'Comment failed'); }
    finally { setSubmittingComment(false); }
  }

  async function updateStatus(ticketId: string, newStatus: string) {
    try {
      const { error } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', ticketId);
      if (error) throw error;
      toast.success(`Status: ${newStatus}`);
      load();
      if (showDetail?.id === ticketId) {
        const { data } = await supabase.from('support_tickets').select('*, assignee:user_profiles!support_tickets_assigned_to_fkey(id, full_name_en), creator:user_profiles!support_tickets_created_by_fkey(id, full_name_en)').eq('id', ticketId).single();
        if (data) setShowDetail(data);
      }
    } catch (err: any) { toast.error(err.message || 'Update failed'); }
  }

  async function openDetail(t: any) {
    const { data: comms } = await supabase.from('ticket_comments').select('*, user:user_profiles(id, full_name_en)').eq('ticket_id', t.id).order('created_at');
    setShowDetail({ ...t, comments: comms || [] });
  }

  const priorityColor = (p: string) => p === 'critical' ? 'var(--color-danger)' : p === 'high' ? 'var(--color-warning)' : p === 'low' ? 'var(--color-text-secondary)' : 'var(--color-primary)';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-glass text-center"><p className="text-2xl font-bold">{totalTickets}</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Total</p></div>
        <div className="stat-glass text-center" style={{ borderTop: '2px solid var(--color-primary)' }}><p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{openCount}</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Open</p></div>
        <div className="stat-glass text-center" style={{ borderTop: '2px solid var(--color-success)' }}><p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{resolvedCount}</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Resolved</p></div>
        <div className="stat-glass text-center" style={{ borderTop: '2px solid var(--color-text-secondary)' }}><p className="text-2xl font-bold" style={{ color: 'var(--color-text-secondary)' }}>{Math.round((openCount / (totalTickets || 1)) * 100)}%</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Open Rate</p></div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select className="input max-w-[140px] text-sm py-1.5" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
          </select>
          <select className="input max-w-[140px] text-sm py-1.5" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All Priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
            <input className="input ps-8 py-1.5 text-sm w-full" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={16} /> New Ticket</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <TicketCheck size={48} className="mx-auto mb-3 opacity-30" /><p>No tickets found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Subject</th><th>Category</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Created</th></tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="cursor-pointer hover:opacity-80" onClick={() => openDetail(t)}>
                  <td className="font-medium max-w-[200px] truncate text-sm">{t.subject}</td>
                  <td className="text-sm">{t.category || '-'}</td>
                  <td><span className="badge text-xs capitalize" style={{ backgroundColor: `color-mix(in srgb, ${t.status === 'closed' || t.status === 'resolved' ? 'var(--color-success)' : t.status === 'in_progress' ? 'var(--color-primary)' : 'var(--color-text-secondary)'} 15%, transparent)`, color: t.status === 'closed' || t.status === 'resolved' ? 'var(--color-success)' : t.status === 'in_progress' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{t.status.replace('_', ' ')}</span></td>
                  <td><span className="text-xs" style={{ color: priorityColor(t.priority) }}>{t.priority}</span></td>
                  <td className="text-sm">{t.assignee?.full_name_en || '-'}</td>
                  <td className="text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={count} pageSize={limit} onChange={(p) => setPage(p)} />

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>New Ticket</h3>
            <div className="space-y-4">
              <div><label className="label">Subject *</label><input className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
              <div><label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">-- None --</option><option value="bug">Bug</option><option value="feature">Feature</option><option value="question">Question</option><option value="other">Other</option>
                </select>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- None --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-primary btn-sm" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Ticket'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDetail(null)}>
          <div className="rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--color-text)' }}>{showDetail.subject}</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Created by {showDetail.creator?.full_name_en || 'Unknown'} &middot; {new Date(showDetail.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="p-1 rounded hover:bg-white/10"><X size={18} /></button>
            </div>
            {showDetail.description && <div className="p-3 rounded-lg text-sm mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg) 50%, transparent)' }}>{showDetail.description}</div>}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <select className="input text-sm" style={{ width: '140px' }} value={showDetail.status} onChange={e => updateStatus(showDetail.id, e.target.value)}>
                <option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
              </select>
              <span className="text-xs" style={{ color: priorityColor(showDetail.priority) }}>Priority: {showDetail.priority}</span>
              {showDetail.assigned_to && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Assigned to: {showDetail.assignee?.full_name_en || showDetail.assigned_to.slice(0, 8)}</span>}
            </div>
            <hr className="mb-4" style={{ borderColor: 'var(--color-border)' }} />
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {(showDetail.comments || []).length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>No comments yet</p>
              ) : (showDetail.comments || []).map((c: any) => (
                <div key={c.id} className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg) 40%, transparent)' }}>
                  <div className="flex items-center gap-2 mb-1"><span className="text-xs font-medium">{c.user?.full_name_en || 'Unknown'}</span><span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(c.created_at).toLocaleString()}</span></div>
                  <p className="text-xs">{c.content}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder="Add comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComment(showDetail.id); }} />
              <button className="btn-primary btn-sm" disabled={submittingComment || !commentText.trim()} onClick={() => addComment(showDetail.id)}>{submittingComment ? '...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SmartBotTab({ user, toast }: { user: UserProfile | null; toast: ReturnType<typeof useToast> }) {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBot, setSelectedBot] = useState<any>(null);
  const [intents, setIntents] = useState<any[]>([]);
  const [showEditBot, setShowEditBot] = useState(false);
  const [showIntents, setShowIntents] = useState(false);
  const [showCreateIntent, setShowCreateIntent] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', model: 'gpt-3.5-turbo', system_prompt: '', welcome_message: '', max_tokens: 512, temperature: 0.7 });
  const [intentForm, setIntentForm] = useState({ name: '', description: '', keywords: '', response: '', action: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.from('chat_bots').select('*').order('name');
      setBots(data || []);
    } catch { toast.error('Failed to load bots'); }
    finally { setLoading(false); }
  }

  async function loadIntents(botId: string) {
    try {
      const { data } = await supabase.from('bot_intents').select('*').eq('bot_id', botId).order('name');
      setIntents(data || []);
    } catch (e) { console.error(e); }
  }

  async function saveBot() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, updated_by: user?.id };
      if (selectedBot) {
        const { error } = await supabase.from('chat_bots').update(payload).eq('id', selectedBot.id);
        if (error) throw error;
        toast.success('Bot updated');
      } else {
        const { error } = await supabase.from('chat_bots').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success('Bot created');
      }
      setShowEditBot(false);
      setSelectedBot(null);
      setForm({ name: '', description: '', model: 'gpt-3.5-turbo', system_prompt: '', welcome_message: '', max_tokens: 512, temperature: 0.7 });
      load();
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function deleteBot(id: string) {
    try {
      await supabase.from('chat_bots').delete().eq('id', id);
      toast.success('Bot deleted');
      load();
    } catch { toast.error('Delete failed'); }
  }

  async function saveIntent() {
    if (!intentForm.name.trim() || !intentForm.keywords.trim()) { toast.error('Name and keywords required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('bot_intents').insert({
        bot_id: selectedBot!.id, name: intentForm.name, description: intentForm.description || undefined,
        keywords: intentForm.keywords.split(',').map(k => k.trim()), response: intentForm.response || undefined,
        action: intentForm.action || undefined, created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Intent created');
      setShowCreateIntent(false);
      setIntentForm({ name: '', description: '', keywords: '', response: '', action: '' });
      loadIntents(selectedBot!.id);
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function deleteIntent(id: string) {
    try { await supabase.from('bot_intents').delete().eq('id', id); toast.success('Intent deleted'); loadIntents(selectedBot!.id); }
    catch { toast.error('Delete failed'); }
  }

  async function testBot(botId: string) {
    if (!testInput.trim()) { toast.error('Enter a message'); return; }
    setTesting(true);
    setTestResult('');
    try {
      const { data, error } = await supabase.rpc('chat_with_bot', { p_bot_id: botId, p_message: testInput, p_user_id: user?.id || '' });
      if (error) throw error;
      setTestResult(typeof data === 'string' ? data : JSON.stringify(data));
    } catch (err: any) { setTestResult(`Error: ${err.message || 'Unknown'}`); }
    finally { setTesting(false); }
  }

  function openEditBot(bot?: any) {
    if (bot) {
      setSelectedBot(bot);
      setForm({ name: bot.name, description: bot.description || '', model: bot.model || 'gpt-3.5-turbo', system_prompt: bot.system_prompt || '', welcome_message: bot.welcome_message || '', max_tokens: bot.max_tokens || 512, temperature: bot.temperature || 0.7 });
    } else {
      setSelectedBot(null);
      setForm({ name: '', description: '', model: 'gpt-3.5-turbo', system_prompt: '', welcome_message: '', max_tokens: 512, temperature: 0.7 });
    }
    setShowEditBot(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{bots.length} bots configured</p>
        <button className="btn-primary btn-sm" onClick={() => openEditBot()}><Bot size={16} /> New Bot</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} /></div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          <Bot size={48} className="mx-auto mb-3 opacity-30" /><p>No bots configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map(b => (
            <div key={b.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{b.name}</h3>
                  {b.description && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{b.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button className="btn-sm btn-secondary" onClick={() => { setSelectedBot(b); openEditBot(b); }}><Settings size={14} /></button>
                  <button className="btn-sm btn-secondary" onClick={() => { setSelectedBot(b); setShowIntents(true); loadIntents(b.id); }}><List size={14} /></button>
                  <button className="btn-sm btn-secondary text-red-500" onClick={() => deleteBot(b.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span><Cpu size={12} className="inline mr-1" />{b.model || 'gpt-3.5-turbo'}</span>
                <span><Zap size={12} className="inline mr-1" />{b.max_tokens || 512} tokens</span>
                <span><Activity size={12} className="inline mr-1" />{(b.temperature || 0.7).toFixed(1)} temp</span>
                {b.is_active !== false && <span className="badge text-xs" style={{ backgroundColor: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}>Active</span>}
              </div>
              {b.welcome_message && <p className="text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>&ldquo;{b.welcome_message}&rdquo;</p>}
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder="Test message..." value={testInput} onChange={e => setTestInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') testBot(b.id); }} />
                <button className="btn-primary btn-sm" disabled={testing} onClick={() => testBot(b.id)}><Zap size={14} /> {testing ? '...' : 'Test'}</button>
              </div>
              {testResult && (
                <div className="p-3 rounded-lg text-xs whitespace-pre-wrap" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', color: 'var(--color-text)' }}>
                  <p className="font-medium mb-1">Response:</p>{testResult}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showEditBot && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowEditBot(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>{selectedBot ? 'Edit Bot' : 'New Bot'}</h3>
            <div className="space-y-4">
              <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><label className="label">Model</label>
                <select className="input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option><option value="gpt-4">GPT-4</option><option value="gpt-4o">GPT-4o</option><option value="claude-3-haiku">Claude 3 Haiku</option>
                </select>
              </div>
              <div><label className="label">System Prompt</label><textarea className="input" rows={3} value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })} /></div>
              <div><label className="label">Welcome Message</label><textarea className="input" rows={2} value={form.welcome_message} onChange={e => setForm({ ...form, welcome_message: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Max Tokens</label><input type="number" className="input" min={64} max={4096} value={form.max_tokens} onChange={e => setForm({ ...form, max_tokens: +e.target.value })} /></div>
                <div><label className="label">Temperature</label><input type="number" className="input" min={0} max={2} step={0.1} value={form.temperature} onChange={e => setForm({ ...form, temperature: +e.target.value })} /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-primary btn-sm" onClick={saveBot} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowEditBot(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showIntents && selectedBot && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowIntents(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Intents: {selectedBot.name}</h3>
              <div className="flex gap-2">
                <button className="btn-primary btn-sm" onClick={() => setShowCreateIntent(true)}><Plus size={14} /> New Intent</button>
                <button className="btn-sm btn-secondary" onClick={() => setShowIntents(false)}><X size={14} /></button>
              </div>
            </div>
            {intents.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>No intents configured</p>
            ) : (
              <div className="space-y-2">
                {intents.map(i => (
                  <div key={i.id} className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg) 40%, transparent)' }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{i.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{i.description || 'No description'}</p>
                      </div>
                      <div className="flex gap-1">
                        <button className="btn-xs btn-secondary text-red-500" onClick={() => deleteIntent(i.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(i.keywords || []).map((k: string, idx: number) => <span key={idx} className="badge text-xs" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>{k}</span>)}
                    </div>
                    {i.response && <p className="text-xs mt-2 italic" style={{ color: 'var(--color-text-secondary)' }}>Response: {i.response}</p>}
                    {i.action && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Action: {i.action}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateIntent && selectedBot && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCreateIntent(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>New Intent</h3>
            <div className="space-y-4">
              <div><label className="label">Name *</label><input className="input" value={intentForm.name} onChange={e => setIntentForm({ ...intentForm, name: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={2} value={intentForm.description} onChange={e => setIntentForm({ ...intentForm, description: e.target.value })} /></div>
              <div><label className="label">Keywords * (comma-separated)</label><input className="input" placeholder="hello, hi, greetings" value={intentForm.keywords} onChange={e => setIntentForm({ ...intentForm, keywords: e.target.value })} /></div>
              <div><label className="label">Response</label><textarea className="input" rows={2} value={intentForm.response} onChange={e => setIntentForm({ ...intentForm, response: e.target.value })} /></div>
              <div><label className="label">Action</label><input className="input" placeholder="search_tickets, create_task, ..." value={intentForm.action} onChange={e => setIntentForm({ ...intentForm, action: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-primary btn-sm" onClick={saveIntent} disabled={saving}>{saving ? 'Saving...' : 'Save Intent'}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowCreateIntent(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
