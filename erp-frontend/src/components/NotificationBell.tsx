import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCheck, Info, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '../utils/date';

interface Notification {
  id: string; title: string; body: string; type: string;
  entity_type: string; entity_id: string; is_read: boolean; created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info size={14} style={{color: 'var(--color-info)'}} />,
  success: <CheckCircle size={14} style={{color: 'var(--color-success)'}} />,
  warning: <AlertCircle size={14} style={{color: 'var(--color-warning)'}} />,
  error: <XCircle size={14} style={{color: 'var(--color-danger)'}} />,
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    pollRef.current = setInterval(load, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function load() {
    if (!user) return;
    try {
      const { data } = await supabase.from('notifications')
        .select('*').order('created_at', { ascending: false }).limit(20);
      if (data) {
        setNotifications(data as Notification[]);
        setUnread(data.filter((n: Notification) => !n.is_read).length);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={ref}>
      <button className="btn btn-sm btn-secondary relative" onClick={() => setOpen(!open)}>
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold" style={{backgroundColor: 'var(--color-danger)'}}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown flex flex-col">
          <div className="flex items-center justify-between px-4 py-3" style={{borderBottom: '1px solid var(--color-border)'}}>
            <h3 className="text-sm font-semibold" style={{color: 'var(--color-text)'}}>Notifications</h3>
            {unread > 0 && (
              <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={markAllRead}>
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8" style={{color: 'var(--color-text-muted)'}}>
                <span className="text-sm">No notifications</span>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="px-4 py-3 transition-colors" style={{
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: !n.is_read ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : undefined
                }}>
                  <div className="flex items-start gap-2 hover:bg-transparent">
                    <div className="mt-0.5">{typeIcons[n.type] || typeIcons.info}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{color: 'var(--color-text)'}}>{n.title}</p>
                      {n.body && <p className="text-xs mt-0.5 truncate" style={{color: 'var(--color-text-secondary)'}}>{n.body}</p>}
                      <p className="text-[10px] mt-1" style={{color: 'var(--color-text-muted)'}}>{formatDate(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
