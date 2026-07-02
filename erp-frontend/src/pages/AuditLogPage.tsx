import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { auditLogApi } from '../services/api';
import type { AuditLogEntry } from '../types';
import { History, Search, Filter, ChevronDown, ChevronUp, RefreshCw, Clock, User, Database, ShieldAlert } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  INSERT: '#22c55e',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
};

export default function AuditLogPage() {
  const t = useT();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [entries, types] = await Promise.all([
        auditLogApi.list({ entity_type: entityTypeFilter || undefined }),
        auditLogApi.getEntityTypes(),
      ]);
      setLogs(entries);
      setEntityTypes(types);
    } catch { console.error('Failed to load audit log'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [entityTypeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = logs.filter(e =>
    !search || e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const userDisplay = (e: AuditLogEntry) => {
    if (!e.user_profiles) return '-';
    return e.user_profiles.full_name_en || e.user_profiles.full_name_ar || '-';
  };

  if (loading && logs.length === 0) {
    return (
      <div className="page-enter flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
          <History size={22} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('audit.log')}</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{logs.length} {t('common.entries')}</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm ml-auto" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> {t('common.refresh')}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            placeholder={t('common.search') + '...'}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <select
            className="pl-9 pr-3 py-2 rounded-lg text-sm appearance-none"
            style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            value={entityTypeFilter} onChange={e => setEntityTypeFilter(e.target.value)}
          >
            <option value="">{t('audit.all_entities')}</option>
            {entityTypes.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(e => (
          <div key={e.id} className="card cursor-pointer" onClick={() => toggleExpand(e.id)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${ACTION_COLORS[e.action] || '#6b7280'} 20%, transparent)` }}>
                {e.action === 'INSERT' ? <Database size={16} style={{ color: ACTION_COLORS[e.action] || '#6b7280' }} /> :
                 e.action === 'DELETE' ? <ShieldAlert size={16} style={{ color: ACTION_COLORS[e.action] || '#6b7280' }} /> :
                 <Clock size={16} style={{ color: ACTION_COLORS[e.action] || '#6b7280' }} />}
              </div>
              <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: `color-mix(in srgb, ${ACTION_COLORS[e.action] || '#6b7280'} 20%, transparent)`, color: ACTION_COLORS[e.action] || '#6b7280' }}>
                {e.action}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{e.entity_type}</span>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <User size={12} className="inline mr-1" />{userDisplay(e)}
              </span>
              <span className="text-xs ml-auto" style={{ color: 'var(--color-text-secondary)' }}>
                {formatDate(e.created_at)}
              </span>
              {expanded.has(e.id) ? <ChevronUp size={16} style={{ color: 'var(--color-text-secondary)' }} />
                : <ChevronDown size={16} style={{ color: 'var(--color-text-secondary)' }} />}
            </div>
            {expanded.has(e.id) && (
              <div className="mt-3 pt-3 space-y-2 text-xs" style={{ borderTop: '1px solid var(--color-border)' }}>
                {e.entity_id && <div><span className="font-semibold">ID:</span> {e.entity_id}</div>}
                {e.ip_address && <div><span className="font-semibold">IP:</span> {e.ip_address}</div>}
                {e.new_data && (
                  <div>
                    <span className="font-semibold">{t('audit.new_data')}:</span>
                    <pre className="mt-1 p-2 rounded overflow-auto max-h-48" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>{JSON.stringify(e.new_data, null, 2)}</pre>
                  </div>
                )}
                {e.old_data && (
                  <div>
                    <span className="font-semibold">{t('audit.old_data')}:</span>
                    <pre className="mt-1 p-2 rounded overflow-auto max-h-48" style={{ background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', border: '1px solid var(--color-border)' }}>{JSON.stringify(e.old_data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <History size={40} style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('audit.no_entries')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
