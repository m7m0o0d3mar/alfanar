import { useRef, useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { Bell, CheckCheck, Info, AlertCircle, CheckCircle, XCircle, Mail, ExternalLink } from 'lucide-react';
import { useT } from '../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';

interface AppNotification {
  id: string; title_en: string; title_ar?: string; body_en?: string; body_ar?: string;
  type: string; channel: string; priority: string; reference_type?: string;
  reference_id?: string; is_read: boolean; created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info size={14} style={{color: 'var(--color-info)'}} />,
  success: <CheckCircle size={14} style={{color: 'var(--color-success)'}} />,
  warning: <AlertCircle size={14} style={{color: 'var(--color-warning)'}} />,
  error: <XCircle size={14} style={{color: 'var(--color-danger)'}} />,
  status_change: <Info size={14} style={{color: 'var(--color-primary)'}} />,
  approval: <CheckCircle size={14} style={{color: 'var(--color-warning)'}} />,
  assignment: <Mail size={14} style={{color: 'var(--color-info)'}} />,
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'notifications.priority_urgent',
  high: 'notifications.priority_high',
  normal: 'notifications.priority_normal',
  low: 'notifications.priority_low',
  critical: 'notifications.priority_critical',
};

const PRIORITY_CLASSES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const recent = notifications.slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      <button aria-label="Notifications" className="btn-sm btn-secondary relative" onClick={() => setOpen(!open)}>
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] rounded-full h-4.5 w-4.5 flex items-center justify-center font-bold" style={{backgroundColor: 'var(--color-danger)'}}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown flex flex-col">
          <div className="flex items-center justify-between px-4 py-3" style={{borderBottom: '1px solid var(--color-border)'}}>
            <h3 className="text-sm font-semibold" style={{color: 'var(--color-text)'}}>{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <button className="text-xs flex items-center gap-1 hover:underline" style={{color: 'var(--color-primary)'}} onClick={markAllRead}>
                <CheckCheck size={12} /> {t('notifications.mark_all_read')}
              </button>
            )}
          </div>
          <div className="flex-1 max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="text-center py-8" style={{color: 'var(--color-text-muted)'}}><span className="text-sm">{t('common.loading')}</span></div>
            ) : recent.length === 0 ? (
              <div className="text-center py-8" style={{color: 'var(--color-text-muted)'}}><span className="text-sm">{t('notifications.no_notifications')}</span></div>
            ) : (
              recent.map(n => (
                <div key={n.id} className="px-4 py-3 transition-colors cursor-pointer" style={{
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: !n.is_read ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : undefined
                }} onClick={() => { if (!n.is_read) markRead(n.id); }}>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{typeIcons[n.type] || typeIcons.info}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{color: 'var(--color-text)'}}>{n.title_en}</p>
                      {n.body_en && <p className="text-xs mt-0.5 truncate" style={{color: 'var(--color-text-secondary)'}}>{n.body_en}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_CLASSES[n.priority] || 'bg-gray-100 text-gray-500'}`}>{t(PRIORITY_LABELS[n.priority]) || n.priority}</span>
                        <span className="text-[10px]" style={{color: 'var(--color-text-muted)'}}>
                          {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{backgroundColor: 'var(--color-primary)'}} />}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-2 text-center" style={{borderTop: '1px solid var(--color-border)'}}>
            <button className="text-xs font-medium hover:underline flex items-center justify-center gap-1 w-full" style={{color: 'var(--color-primary)'}} onClick={() => { setOpen(false); navigate('/notifications'); }}>
              <ExternalLink size={12} /> View All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
