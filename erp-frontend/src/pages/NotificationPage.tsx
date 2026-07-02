import { useState, useEffect, useMemo, useRef } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useNotifications } from '../hooks/useNotifications';
import { notificationPreferencesApi } from '../services/api';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { formatDate } from '../utils/date';
import {
  Bell, CheckCheck, Info, AlertCircle, CheckCircle, XCircle,
  Mail, Search, Trash2, Settings, BellRing, Calendar, Clock,
  RefreshCw, Globe, Smartphone, ExternalLink, ChevronDown,
  ChevronUp, X, BarChart3, MessageSquare, Phone, Loader,
  ArrowUpDown, Square, CheckSquare, Filter, Eye, EyeOff
} from 'lucide-react';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  info: <Info size={16} style={{color: 'var(--color-info)'}} />,
  success: <CheckCircle size={16} style={{color: 'var(--color-success)'}} />,
  warning: <AlertCircle size={16} style={{color: 'var(--color-warning)'}} />,
  error: <XCircle size={16} style={{color: 'var(--color-danger)'}} />,
  status_change: <Info size={16} style={{color: 'var(--color-primary)'}} />,
  approval: <CheckCircle size={16} style={{color: 'var(--color-warning)'}} />,
  assignment: <Mail size={16} style={{color: 'var(--color-info)'}} />,
};

const TYPE_ICONS_LG: Record<string, React.ReactNode> = {
  info: <Info size={28} style={{color: 'var(--color-info)'}} />,
  success: <CheckCircle size={28} style={{color: 'var(--color-success)'}} />,
  warning: <AlertCircle size={28} style={{color: 'var(--color-warning)'}} />,
  error: <XCircle size={28} style={{color: 'var(--color-danger)'}} />,
  status_change: <Info size={28} style={{color: 'var(--color-primary)'}} />,
  approval: <CheckCircle size={28} style={{color: 'var(--color-warning)'}} />,
  assignment: <Mail size={28} style={{color: 'var(--color-info)'}} />,
};

const PRIORITY_CLS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_BADGE_CLS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  normal: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const DEFAULT_PREFS = {
  email_notifications: true,
  in_app_notifications: true,
  whatsapp_notifications: false,
  sms_notifications: false,
  notify_on_approval: true,
  notify_on_rejection: true,
  notify_on_status_change: true,
  notify_on_new_assignment: true,
  notify_on_comments: true,
  notify_on_deadline: true,
  daily_digest: false,
  quiet_hours_from: '',
  quiet_hours_to: '',
};

export default function NotificationPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, loading, markRead, markAllRead, reload } = useNotifications();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedNotification, setSelectedNotification] = useState<(typeof notifications)[number] | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, statusFilter, priorityFilter, channelFilter, dateFrom, dateTo, sortOrder]);

  useEffect(() => { if (user) loadPrefs(); }, [user]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        reload();
        setLastRefreshed(new Date());
      }, 60000);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, reload]);

  // Realtime subscription for push notifications
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('notifications_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        reload();
        setLastRefreshed(new Date());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        reload();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, reload]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [notifications]);

  async function loadPrefs() {
    try {
      const data = await notificationPreferencesApi.get(user!.id);
      if (data) setPrefs({ ...DEFAULT_PREFS, ...data });
    } catch { /* ignore */ }
  }

  async function savePrefs() {
    try {
      await notificationPreferencesApi.upsert({ ...prefs, user_id: user!.id });
      toast.success('Preferences saved');
    } catch { toast.error('Failed to save preferences'); }
  }

  async function handleDelete(id: string) {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      toast.success('Deleted');
      reload();
    } catch { toast.error('Failed to delete'); }
  }

  async function handleClearAll() {
    try {
      await supabase.from('notifications').delete().eq('user_id', user?.id);
      toast.success('All cleared');
      reload();
    } catch { toast.error('Failed to clear'); }
  }

  async function handleToggleRead(n: (typeof notifications)[number]) {
    if (n.is_read) return;
    await markRead(n.id);
  }

  function openDetail(n: (typeof notifications)[number]) {
    setSelectedNotification(n);
  }

  function closeDetail() {
    setSelectedNotification(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map(n => n.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await supabase.from('notifications').delete().in('id', ids);
      toast.success(`Deleted ${ids.length} notifications`);
      setSelectedIds(new Set());
      reload();
    } catch { toast.error('Failed to delete selected'); }
  }

  async function handleBulkMarkRead() {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids).eq('is_read', false);
      toast.success(`Marked ${ids.length} as read`);
      setSelectedIds(new Set());
      reload();
    } catch { toast.error('Failed to mark as read'); }
  }

  function handleReferenceClick(refType?: string, refId?: string) {
    if (!refType || !refId) return;
    closeDetail();
    const routes: Record<string, string> = {
      project: `/projects/${refId}`,
      task: `/tasks/${refId}`,
      purchase_requisition: `/procurement/pr/${refId}`,
      expense_claim: `/finance/expenses/${refId}`,
      leave_request: `/hr/leaves/${refId}`,
      employee: `/hr/employees/${refId}`,
      unit: `/units/${refId}`,
      form: `/forms/${refId}`,
    };
    const path = routes[refType] || `/${refType}/${refId}`;
    navigate(path);
  }

  const filtered = useMemo(() => {
    let result = notifications.filter(n => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
      if (statusFilter === 'unread' && n.is_read) return false;
      if (statusFilter === 'read' && !n.is_read) return false;
      if (channelFilter !== 'all' && n.channel !== channelFilter) return false;
      if (dateFrom && new Date(n.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (new Date(n.created_at) > endOfDay) return false;
      }
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!n.title_en.toLowerCase().includes(q) && !(n.body_en || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortOrder === 'oldest') result = result.slice().reverse();
    return result;
  }, [notifications, typeFilter, priorityFilter, statusFilter, channelFilter, dateFrom, dateTo, debouncedSearch, sortOrder]);

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const grouped = paged.reduce((acc, n) => {
    const day = new Date(n.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(n);
    return acc;
  }, {} as Record<string, typeof paged>);

  const types = useMemo(() => [...new Set(notifications.map(n => n.type))], [notifications]);
  const priorities = useMemo(() => [...new Set(notifications.map(n => n.priority))], [notifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const statsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach(n => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [notifications]);

  const todayCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return notifications.filter(n => new Date(n.created_at) >= start).length;
  }, [notifications]);

  const yesterdayCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return notifications.filter(n => {
      const d = new Date(n.created_at);
      return d >= start && d < end;
    }).length;
  }, [notifications]);

  const dayStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      counts[key] = 0;
    }
    notifications.forEach(n => {
      const d = new Date(n.created_at);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (key in counts) counts[key]++;
    });
    return Object.entries(counts);
  }, [notifications]);

  const maxDayCount = useMemo(() => Math.max(1, ...dayStats.map(([, c]) => c)), [dayStats]);

  const typeStatsFull = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach(n => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [notifications]);

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="page-enter max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
            <Bell size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Notifications</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{unreadCount} unread · {notifications.length} total</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {lastRefreshed && autoRefresh && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <Loader size={10} className="animate-spin" /> Auto-refreshing
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto
          </label>
          <button className="btn-secondary btn-sm" onClick={() => setShowStats(!showStats)} title="Statistics">
            <BarChart3 size={14} />
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={14} /> Settings
          </button>
          <button className="btn-secondary btn-sm" onClick={reload} title="Refresh"><RefreshCw size={14} /></button>
          <button className="btn-secondary btn-sm" onClick={markAllRead} disabled={!notifications.some(n => !n.is_read)}>
            <CheckCheck size={14} /> Mark All Read
          </button>
          <button className="btn-secondary btn-sm" onClick={handleClearAll} disabled={notifications.length === 0}>
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        <div className="glass-card p-3 cursor-pointer transition-all hover:opacity-80" onClick={() => { setTypeFilter('all'); setPage(1); }}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total</p>
          <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-text)' }}>{notifications.length}</p>
        </div>
        <div className="glass-card p-3 cursor-pointer transition-all hover:opacity-80" onClick={() => { setStatusFilter('unread'); setPage(1); }}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Unread</p>
          <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{unreadCount}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Today</p>
          <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-text)' }}>{todayCount}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Trend</p>
          <p className="text-lg font-bold mt-1" style={{ color: todayCount > yesterdayCount ? 'var(--color-success)' : todayCount < yesterdayCount ? 'var(--color-danger)' : 'var(--color-text)' }}>
            {todayCount > yesterdayCount ? `+${todayCount - yesterdayCount}` : todayCount < yesterdayCount ? `-${yesterdayCount - todayCount}` : '0'}
          </p>
        </div>
        {statsByType.map(([tp, cnt]) => (
          <div key={tp} className="glass-card p-3 cursor-pointer transition-all hover:opacity-80" onClick={() => { setTypeFilter(tp); setPage(1); }}>
            <p className="text-[10px] uppercase tracking-wider truncate" style={{ color: 'var(--color-text-muted)' }}>{tp}</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-text)' }}>{cnt}</p>
          </div>
        ))}
      </div>

      {showSettings && user && (
        <div className="card p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <BellRing size={16} className="text-primary" />
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Notification Preferences</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {[
              { key: 'email_notifications', label: 'Email', icon: Mail },
              { key: 'in_app_notifications', label: 'In-App', icon: Smartphone },
              { key: 'whatsapp_notifications', label: 'WhatsApp', icon: Phone },
              { key: 'sms_notifications', label: 'SMS', icon: MessageSquare },
              { key: 'notify_on_approval', label: 'Approval Requests', icon: CheckCircle },
              { key: 'notify_on_rejection', label: 'Rejections', icon: XCircle },
              { key: 'notify_on_status_change', label: 'Status Changes', icon: RefreshCw },
              { key: 'notify_on_new_assignment', label: 'New Assignments', icon: ExternalLink },
              { key: 'notify_on_comments', label: 'Comments', icon: Globe },
              { key: 'notify_on_deadline', label: 'Deadlines', icon: Clock },
              { key: 'daily_digest', label: 'Daily Digest', icon: Calendar },
            ].map(({ key, label, icon: Icon }) => (
              <label key={key} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--color-surface)' }}>
                <input type="checkbox" className="rounded" checked={(prefs as any)[key]} onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })} />
                <Icon size={14} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Quiet Hours From</label>
              <input type="time" className="input text-sm" value={prefs.quiet_hours_from} onChange={e => setPrefs({ ...prefs, quiet_hours_from: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Quiet Hours To</label>
              <input type="time" className="input text-sm" value={prefs.quiet_hours_to} onChange={e => setPrefs({ ...prefs, quiet_hours_to: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary btn-sm" onClick={savePrefs}>Save Preferences</button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2" style={{color: 'var(--color-text-muted)'}} />
          <input type="text" placeholder="Search notifications..." value={search} onChange={e => setSearch(e.target.value)} className="input ps-8 text-sm" />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="input text-sm w-auto">
          <option value="all">All Types</option>
          {types.map(tp => <option key={tp} value={tp}>{tp}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }} className="input text-sm w-auto">
          <option value="all">All Priority</option>
          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input text-sm w-auto">
          <option value="all">All Status</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(1); }} className="input text-sm w-auto">
          <option value="all">All Channels</option>
          <option value="in_app">In-App</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="input text-sm w-auto" placeholder="From" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="input text-sm w-auto" placeholder="To" />
        <select value={sortOrder} onChange={e => { setSortOrder(e.target.value); setPage(1); }} className="input text-sm w-auto">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {showStats && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Notification Statistics</h3>
            </div>
            <button className="btn-sm p-1" onClick={() => setShowStats(false)} style={{ color: 'var(--color-text-muted)' }}>
              <X size={14} />
            </button>
          </div>
          <div className="mb-5">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Notifications by Day (Last 7 Days)</p>
            <div className="space-y-1.5">
              {dayStats.map(([day, count]) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs w-28 shrink-0 text-end" style={{ color: 'var(--color-text-muted)' }}>{day}</span>
                  <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <div className="h-full rounded-sm transition-all duration-300" style={{
                      width: `${(count / maxDayCount) * 100}%`,
                      backgroundColor: 'var(--color-primary)',
                      opacity: count > 0 ? 1 : 0.3,
                    }} />
                  </div>
                  <span className="text-xs font-medium w-6" style={{ color: 'var(--color-text)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>By Type</p>
              <div className="space-y-1.5">
                {typeStatsFull.map(([tp, cnt]) => (
                  <div key={tp} className="flex items-center justify-between px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <div className="flex items-center gap-2">
                      {TYPE_ICONS[tp] || TYPE_ICONS.info}
                      <span className="text-xs capitalize" style={{ color: 'var(--color-text)' }}>{tp}</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Trend</p>
              <div className="flex items-center gap-4 p-3 rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Yesterday</p>
                  <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{yesterdayCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Today</p>
                  <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{todayCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Change</p>
                  <p className={`text-xl font-bold ${todayCount > yesterdayCount ? 'text-green-500' : todayCount < yesterdayCount ? 'text-red-500' : ''}`} style={{ color: todayCount > yesterdayCount ? 'var(--color-success)' : todayCount < yesterdayCount ? 'var(--color-danger)' : 'var(--color-text)' }}>
                    {todayCount > yesterdayCount ? `+${todayCount - yesterdayCount}` : todayCount < yesterdayCount ? yesterdayCount - todayCount : '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {someSelected && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text)' }}>{selectedIds.size} selected</span>
          <button className="btn-secondary btn-sm" onClick={allSelected ? deselectAll : selectAll}>
            {allSelected ? <X size={14} /> : <CheckSquare size={14} />}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button className="btn-secondary btn-sm" onClick={handleBulkMarkRead} disabled={!notifications.some(n => selectedIds.has(n.id) && !n.is_read)}>
            <CheckCheck size={14} /> Mark Read
          </button>
          <button className="btn-secondary btn-sm" onClick={handleBulkDelete}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
        </div>
      ) : paged.length === 0 ? (
        <EmptyState icon={<Bell size={48} strokeWidth={1.5} />} title="No notifications" description={debouncedSearch || typeFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || channelFilter !== 'all' || dateFrom || dateTo ? 'No notifications match your filters.' : 'You have no notifications yet.'} />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Calendar size={14} /> {day}
              </h3>
              <div className="rounded-xl border overflow-hidden" style={{borderColor:'var(--color-border)'}}>
                {items.map((n, i) => (
                  <div key={n.id} className="transition-colors" style={{
                    borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : undefined,
                  }}>
                    <div className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:opacity-85" style={{
                      borderInlineStart: '3px solid',
                      borderInlineStartColor: !n.is_read ? 'var(--color-primary)' : 'transparent',
                      paddingInlineStart: !n.is_read ? '13px' : '16px',
                    }} onClick={() => handleToggleRead(n)}>
                      <div className="flex items-center pt-0.5" onClick={e => e.stopPropagation()}>
                        <button className="p-0.5" onClick={() => toggleSelect(n.id)} style={{ color: selectedIds.has(n.id) ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                          {selectedIds.has(n.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </div>
                      <div className="mt-0.5 shrink-0 cursor-pointer" onClick={e => { e.stopPropagation(); openDetail(n); }} title="View details">
                        {TYPE_ICONS[n.type] || TYPE_ICONS.info}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={e => { e.stopPropagation(); openDetail(n); }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium truncate ${!n.is_read ? 'font-semibold' : ''}`} style={{color:'var(--color-text)'}}>{n.title_en}</p>
                          {!n.is_read && <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:'var(--color-primary)'}} />}
                        </div>
                        {n.body_en && <p className="text-xs mt-0.5 line-clamp-2" style={{color:'var(--color-text-secondary)'}}>{n.body_en}</p>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {n.priority && n.priority !== 'normal' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_CLS[n.priority] || ''}`}>{n.priority}</span>
                          )}
                          <span className="text-[10px]" style={{color:'var(--color-text-muted)'}}>
                            {new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                          </span>
                          {n.channel && n.channel !== 'in_app' && <span className="text-[10px]" style={{color:'var(--color-text-muted)'}}>({n.channel})</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!n.is_read && <button className="btn-sm p-1.5" title="Mark read" onClick={e => { e.stopPropagation(); markRead(n.id); }} style={{color:'var(--color-text-muted)'}}><CheckCheck size={14} /></button>}
                        <button className="btn-sm p-1.5" title="View details" onClick={e => { e.stopPropagation(); openDetail(n); }} style={{color:'var(--color-text-muted)'}}><Eye size={14} /></button>
                        <button className="btn-sm p-1.5" title="Delete" onClick={e => { e.stopPropagation(); handleDelete(n.id); }} style={{color:'var(--color-text-muted)'}}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />}

      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-8" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} onClick={closeDetail}>
          <div className="card p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {TYPE_ICONS_LG[selectedNotification.type] || TYPE_ICONS_LG.info}
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{selectedNotification.title_en}</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatDate(selectedNotification.created_at)} · {new Date(selectedNotification.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                  </p>
                </div>
              </div>
              <button className="btn-sm p-1.5" onClick={closeDetail} style={{ color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {selectedNotification.type && (
                <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>
                  {selectedNotification.type}
                </span>
              )}
              {selectedNotification.priority && selectedNotification.priority !== 'normal' && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_BADGE_CLS[selectedNotification.priority] || ''}`}>
                  {selectedNotification.priority}
                </span>
              )}
              {selectedNotification.channel && selectedNotification.channel !== 'in_app' && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-info) 10%, transparent)', color: 'var(--color-info)' }}>
                  {selectedNotification.channel}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${selectedNotification.is_read ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                {selectedNotification.is_read ? 'Read' : 'Unread'}
              </span>
            </div>

            <div className="mb-5 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                {selectedNotification.body_en || 'No additional details.'}
              </p>
            </div>

            {selectedNotification.reference_type && selectedNotification.reference_id && (
              <div className="mb-4">
                <button className="btn-primary btn-sm" onClick={() => handleReferenceClick(selectedNotification.reference_type, selectedNotification.reference_id)}>
                  <ExternalLink size={14} /> View {selectedNotification.reference_type.replace(/_/g, ' ')}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
              {!selectedNotification.is_read && (
                <button className="btn-primary btn-sm" onClick={() => { markRead(selectedNotification.id); setSelectedNotification({ ...selectedNotification, is_read: true }); }}>
                  <CheckCheck size={14} /> Mark as Read
                </button>
              )}
              <button className="btn-secondary btn-sm" onClick={() => { const id = selectedNotification.id; closeDetail(); handleDelete(id); }}>
                <Trash2 size={14} /> Delete
              </button>
              <button className="btn-secondary btn-sm" onClick={closeDetail}>
                <X size={14} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
