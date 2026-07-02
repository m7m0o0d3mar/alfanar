import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface AppNotification {
  id: string; title_en: string; title_ar?: string; body_en?: string; body_ar?: string;
  type: string; channel: string; priority: string; reference_type?: string;
  reference_id?: string; is_read: boolean; created_at: string;
}

let hookIdCounter = 0;

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [id] = useState(() => hookIdCounter++);
  const channelName = `notifications-realtime-${id}`;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    load();

    const channel = supabase
      .channel(channelName)
      .on<AppNotification>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: RealtimePostgresChangesPayload<AppNotification>) => {
          setNotifications(prev => [payload.new as AppNotification, ...prev]);
          setUnreadCount(c => c + 1);
        }
      )
      .on<AppNotification>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: RealtimePostgresChangesPayload<AppNotification>) => {
          const updated = payload.new as AppNotification;
          setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
          if (updated.is_read) setUnreadCount(c => Math.max(0, c - 1));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        setNotifications(data as AppNotification[]);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function markAllRead() {
    try {
      await supabase.from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user?.id).eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  async function markRead(id: string) {
    try {
      await supabase.from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { /* ignore */ }
  }

  return { notifications, unreadCount, loading, markRead, markAllRead, reload: load };
}
