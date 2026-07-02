import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { conversationsApi, messagesApi, type Conversation, type ChatMessage, type MessageReaction, type ConversationParticipant } from '../services/api';
import Avatar from '../components/Avatar';
import FilePreviewModal from '../components/FilePreviewModal';
import type { UserProfile } from '../types';
import {
  Search, MessageSquare, Send, Paperclip, Smile, Plus, X, Users, UserPlus, Loader2, FileText, CheckCheck,
} from 'lucide-react';

const EMOJIS = ['👍', '❤️', '😊', '🎉', '😢', '🙏'];

interface ExtendedConvo extends Conversation {
  conversation_participants: (ConversationParticipant & { user?: UserProfile })[];
  last_message?: ChatMessage;
}

interface LocalMessage extends ChatMessage {
  sender?: UserProfile;
  reactions?: MessageReaction[];
  reactionUsers?: Record<string, string[]>;
}

export default function ChatPage() {
  const { user } = useAuth();
  const toast = useToast();

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
  const [previewFile, setPreviewFile] = useState<{ url: string; fileName: string; mimeType?: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedConvo = conversations.find((c) => c.id === selectedId) || null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
      markAsRead(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('chat-presence');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        for (const key of Object.keys(state)) {
          for (const p of state[key] as any[]) {
            if (p.user_id) ids.add(p.user_id);
          }
        }
        setOnlineUsers(ids);
      })
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload?.conversation_id && payload.payload?.user_id && payload.payload?.user_id !== user.id) {
          setTypingUsers((prev) => {
            const convoId = payload.payload.conversation_id;
            const userId = payload.payload.user_id;
            const existing = prev[convoId] || [];
            if (!existing.includes(userId)) {
              return { ...prev, [convoId]: [...existing, userId] };
            }
            return prev;
          });
          setTimeout(() => {
            setTypingUsers((prev) => {
              const convoId = payload.payload.conversation_id;
              const userId = payload.payload.user_id;
              const list = (prev[convoId] || []).filter((id) => id !== userId);
              if (list.length === 0) {
                const { [convoId]: _, ...rest } = prev;
                return rest;
              }
              return { ...prev, [convoId]: list };
            });
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id });
        }
      });
    return () => { channel.unsubscribe(); };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase.channel(`messages:${selectedId}`);
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
    const channel = supabase.channel(`reactions:${selectedId}`);
    channel
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
      }, () => {
        loadReactions(selectedId);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [selectedId]);

  async function loadConversations() {
    setLoading(true);
    try {
      const data = await conversationsApi.list() as ExtendedConvo[];
      const withParticipants = data.filter((c) => c.conversation_participants?.length > 0);
      setConversations(withParticipants);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const data = await messagesApi.list(conversationId) as LocalMessage[];
      setMessages(data);
      await loadReactions(conversationId);
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      toast.error('Failed to load messages');
    }
  }

  async function loadReactions(conversationId: string) {
    try {
      const { data: msgIds } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null);
      if (!msgIds?.length) return;
      const ids = msgIds.map((m) => m.id);
      const { data: reactions } = await supabase
        .from('message_reactions')
        .select('*, user_profiles!inner(id, full_name_en, full_name_ar)')
        .in('message_id', ids);
      if (!reactions) return;
      const grouped: Record<string, { emoji: string; userId: string; userName: string }[]> = {};
      for (const r of reactions as any[]) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push({
          emoji: r.emoji,
          userId: r.user_id,
          userName: r.user_profiles?.full_name_en || r.user_id,
        });
      }
      setMessages((prev) => prev.map((m) => {
        const msgReactions = grouped[m.id] || [];
        const emojiSet = new Map<string, string[]>();
        for (const r of msgReactions) {
          if (!emojiSet.has(r.emoji)) emojiSet.set(r.emoji, []);
          emojiSet.get(r.emoji)!.push(r.userName);
        }
        return {
          ...m,
          reactions: msgReactions.map((r) => ({ id: '', message_id: m.id, user_id: r.userId, emoji: r.emoji, created_at: '' })),
          reactionUsers: Object.fromEntries(emojiSet),
        };
      }));
    } catch (e) { console.error(e); }
  }

  async function markAsRead(conversationId: string) {
    if (!user?.id) return;
    try {
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    } catch { /* ignore */ }
  }

  async function broadcastTyping(conversationId: string) {
    if (!user?.id || !conversationId) return;
    try {
      const channel = supabase.channel('chat-presence');
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { conversation_id: conversationId, user_id: user.id },
      });
    } catch { /* ignore */ }
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (selectedId) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      broadcastTyping(selectedId);
      typingTimerRef.current = setTimeout(() => {}, 2000);
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      await messagesApi.send(selectedId, text, 'text');
      setInput('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleSendFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setSending(true);
    try {
      await messagesApi.sendFile(selectedId, file);
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleReaction(messageId: string, emoji: string) {
    try {
      const msg = messages.find((m) => m.id === messageId);
      const hasReacted = msg?.reactions?.some((r) => r.emoji === emoji && r.user_id === user?.id);
      if (hasReacted) {
        await messagesApi.removeReaction(messageId, emoji);
      } else {
        await messagesApi.addReaction(messageId, emoji);
      }
    } catch (e) { console.error(e); }
  }

  async function searchUsers(q: string) {
    setUserSearch(q);
    if (!q.trim()) { setUsers([]); return; }
    setUserSearching(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name_en, full_name_ar, avatar_url, role')
        .ilike('full_name_en', `%${q}%`)
        .limit(10);
      setUsers((data || []) as UserProfile[]);
    } catch (e) { console.error(e); } finally {
      setUserSearching(false);
    }
  }

  async function startDirectChat(otherUserId: string) {
    try {
      const existing = conversations.find((c) => {
        if (c.type !== 'direct') return false;
        const otherIds = c.conversation_participants
          .filter((p) => p.user_id !== user?.id)
          .map((p) => p.user_id);
        return otherIds.includes(otherUserId);
      });
      if (existing) {
        setSelectedId(existing.id);
        setShowNewChat(false);
        return;
      }
      const convo = await conversationsApi.createDirect(otherUserId) as ExtendedConvo;
      if (convo) {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('*, user:user_profiles(*)')
          .eq('conversation_id', convo.id);
        convo.conversation_participants = (participants || []) as any;
        setConversations((prev) => [convo, ...prev]);
        setSelectedId(convo.id);
        setShowNewChat(false);
      }
    } catch {
      toast.error('Failed to create conversation');
    }
  }

  function getConvoName(convo: ExtendedConvo): string {
    if (convo.name_en) return convo.name_en;
    const others = convo.conversation_participants.filter((p) => p.user_id !== user?.id);
    return others.map((p) => p.user?.full_name_en || 'Unknown').join(', ') || 'Unknown';
  }

  function getOtherUserId(convo: ExtendedConvo): string | undefined {
    if (convo.type !== 'direct') return undefined;
    const other = convo.conversation_participants.find((p) => p.user_id !== user?.id);
    return other?.user_id;
  }

  function isOnline(userId: string): boolean {
    return onlineUsers.has(userId);
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const filteredConvos = conversations.filter((c) => {
    if (!convoSearch) return true;
    const name = getConvoName(c).toLowerCase();
    return name.includes(convoSearch.toLowerCase());
  });

  const sortedMessages = [...messages];

  return (
    <div className="page-enter flex h-[calc(100vh-4rem)]" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Chat</h2>
            <button className="btn-sm" onClick={() => setShowNewChat(true)}><Plus size={16} /> New</button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              className="input ps-8 text-sm"
              placeholder="Search conversations..."
              value={convoSearch}
              onChange={(e) => setConvoSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
            </div>
          ) : filteredConvos.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
              {convoSearch ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : filteredConvos.map((convo) => {
            const isSelected = convo.id === selectedId;
            const otherId = getOtherUserId(convo);
            return (
              <button
                key={convo.id}
                className={`w-full text-start p-3 flex items-center gap-3 border-b transition-colors ${isSelected ? '' : 'hover:opacity-80'}`}
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--color-text)',
                }}
                onClick={() => setSelectedId(convo.id)}
              >
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

      {/* Chat Panel */}
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
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="flex-1 flex items-center gap-3">
                {selectedConvo.type === 'direct' ? (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    {getConvoName(selectedConvo).charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary-light)' }}>
                    <Users size={16} style={{ color: 'var(--color-primary)' }} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{getConvoName(selectedConvo)}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {typingUsers[selectedId!]?.length ? (
                      <span className="text-green-500 italic">
                        {(() => {
                          const names = typingUsers[selectedId!].map((uid) => {
                            const p = selectedConvo.conversation_participants.find(pp => pp.user_id === uid);
                            return p?.user?.full_name_en || 'Someone';
                          });
                          return names.join(', ') + ' typing...';
                        })()}
                      </span>
                    ) : selectedConvo.type === 'group' ? (
                      `${selectedConvo.conversation_participants.length} members`
                    ) : 'Direct message'}
                    {selectedConvo.project?.project_code && <span className="ms-1.5">· {selectedConvo.project.project_code}</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
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
                    <div className={`max-w-[70%] ${isMine ? 'order-1' : 'order-1'}`}>
                      <div className="flex items-end gap-2">
                        {!isMine && (
                          <Avatar url={msg.sender?.avatar_url} name={msg.sender?.full_name_en} size={28} />
                        )}
                        <div>
                          {!isMine && (
                            <p className="text-xs mb-1 ps-1" style={{ color: 'var(--color-text-muted)' }}>
                              {msg.sender?.full_name_en || 'Unknown'}
                            </p>
                          )}
                          <div
                            className="rounded-2xl px-4 py-2 text-sm break-words"
                            style={{
                              backgroundColor: isMine ? 'var(--color-primary)' : 'var(--color-card)',
                              color: isMine ? '#fff' : 'var(--color-text)',
                              borderBottomRightRadius: isMine ? '4px' : '12px',
                              borderBottomLeftRadius: isMine ? '12px' : '4px',
                            }}
                          >
                            {msg.message_type === 'file' ? (
                              <div className="flex items-center gap-2">
                                <FileText size={16} />
                                <button onClick={() => msg.file_url && setPreviewFile({ url: msg.file_url, fileName: msg.file_name || 'file', mimeType: msg.mime_type })}
                                  className="underline text-sm cursor-pointer" style={{ color: isMine ? '#fff' : 'var(--color-primary)' }}>
                                  {msg.file_name || 'Download file'}
                                </button>
                              </div>
                            ) : msg.message_type === 'image' ? (
                              <img src={msg.file_url} alt="" className="max-w-xs rounded-lg cursor-pointer" onClick={() => msg.file_url && setPreviewFile({ url: msg.file_url, fileName: msg.file_name || 'image', mimeType: msg.mime_type })} />
                            ) : (
                              <span>{msg.content}</span>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isMine && (
                              msg.is_read
                                ? <CheckCheck size={12} className="text-blue-500" />
                                : msg.delivered_at
                                  ? <CheckCheck size={12} className="text-gray-400" />
                                  : null
                            )}
                          </div>

                          {/* Reactions */}
                          {msg.reactionUsers && Object.keys(msg.reactionUsers).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(msg.reactionUsers).map(([emoji, names]) => (
                                <span
                                  key={emoji}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border"
                                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                                  title={names.join(', ')}
                                >
                                  {emoji} {names.length}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reaction buttons */}
                      <div className={`flex gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
                          {EMOJIS.slice(0, 4).map((emoji) => (
                            <button
                              key={emoji}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:scale-110 transition-transform"
                              style={{ backgroundColor: 'var(--color-card)' }}
                              onClick={() => handleReaction(msg.id, emoji)}
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-full text-xs"
                            style={{ backgroundColor: 'var(--color-card)' }}
                            onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)}
                          >
                            <Smile size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <div className="flex items-end gap-2">
                <button
                  className="flex-shrink-0 p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleSendFile}
                />
                <div className="flex-1 relative">
                  <textarea
                    className="input pe-10 resize-none"
                    rows={2}
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  />
                </div>
                <button
                  className="btn-sm flex-shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      {previewFile && <FilePreviewModal url={previewFile.url} fileName={previewFile.fileName} mimeType={previewFile.mimeType} onClose={() => setPreviewFile(null)} />}

      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewChat(false)}>
          <div className="glass-card p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>New Conversation</h3>
              <button className="btn-xs btn-secondary" onClick={() => setShowNewChat(false)}><X size={14} /></button>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                className="input ps-8"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => searchUsers(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {userSearching ? (
                <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin" /></div>
              ) : users.length === 0 && userSearch ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No users found</p>
              ) : users.map((u) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:opacity-80 transition-colors text-start"
                  style={{ backgroundColor: 'var(--color-card)' }}
                  onClick={() => startDirectChat(u.id)}
                >
                  <Avatar url={u.avatar_url} name={u.full_name_en} size={36} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{u.full_name_en}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{u.role}</p>
                  </div>
                  <UserPlus size={16} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              ))}
            </div>
            {user?.id && users.length > 0 && (
              <button
                className="btn-sm w-full mt-3"
                onClick={() => {
                  const ids = users.filter((u) => u.id !== user.id).map((u) => u.id);
                  if (ids.length === 0) return;
                  conversationsApi.createGroup('New Group', ids)
                    .then((convo) => {
                      setShowNewChat(false);
                      loadConversations();
                      setSelectedId(convo.id);
                    })
                    .catch(() => toast.error('Failed to create group'));
                }}
              >
                <Users size={16} /> Create Group with all results
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
