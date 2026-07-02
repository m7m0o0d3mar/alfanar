import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Activity, Database, Table, RefreshCw, CheckCircle, XCircle, Clock, HardDrive } from 'lucide-react';

export default function SystemHealthPage() {
  const t = useT();
  const { effectiveRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [tableStats, setTableStats] = useState<{ table_name: string; row_count: number }[]>([]);
  const [serverTime, setServerTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (effectiveRole !== 'admin') return;
    loadHealth();
  }, [effectiveRole]);

  async function loadHealth() {
    setLoading(true); setError('');
    try {
      const [timeRes, tablesRes] = await Promise.all([
        supabase.rpc('exec_sql', { query: "SELECT NOW()::text as server_time" }),
        supabase.rpc('list_tables'),
      ]);
      if (timeRes.error) throw new Error(timeRes.error.message);
      if (tablesRes.error) throw new Error(tablesRes.error.message);
      const timeRows = (timeRes.data as { server_time: string }[]) || [];
      setServerTime(timeRows[0]?.server_time || '');
      const rows = (tablesRes.data || []) as { table_name: string; row_count: number }[];
      setTableStats(rows);
      setDbStatus('ok');
    } catch (e) {
      setDbStatus('error');
      setError(e instanceof Error ? e.message : 'Connection failed');
    }
    setLoading(false);
  }

  if (effectiveRole !== 'admin') {
    return <div className="page-enter flex items-center justify-center py-16"><p style={{ color: 'var(--color-text-secondary)' }}>{t('common.no_permission')}</p></div>;
  }

  const totalRows = tableStats.reduce((sum, t) => sum + t.row_count, 0);
  const dbSize = totalRows > 100000 ? `${(totalRows / 1000000).toFixed(1)}M` : `${(totalRows / 1000).toFixed(1)}K`;

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
            <Activity size={22} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('system_health.title')}</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('system_health.description')}</p>
          </div>
        </div>
        <button onClick={loadHealth} className="btn-secondary btn-sm" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {t('common.refresh')}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: dbStatus === 'ok' ? 'color-mix(in srgb, #22c55e 15%, transparent)' : 'color-mix(in srgb, #ef4444 15%, transparent)' }}>
              {dbStatus === 'ok' ? <CheckCircle size={20} style={{ color: '#22c55e' }} /> : <XCircle size={20} style={{ color: '#ef4444' }} />}
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: dbStatus === 'ok' ? '#22c55e' : '#ef4444' }}>{dbStatus === 'ok' ? t('system_health.connected') : t('system_health.error')}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('system_health.database')}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, #3b82f6 15%, transparent)' }}>
              <Database size={20} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{tableStats.length}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('system_health.tables')}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, #8b5cf6 15%, transparent)' }}>
              <HardDrive size={20} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{dbSize}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('system_health.total_rows')}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 15%, transparent)' }}>
              <Clock size={20} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{serverTime ? new Date(serverTime).toLocaleString() : '—'}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('system_health.server_time')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table Stats */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Table size={16} /> {t('system_health.table_stats')} ({tableStats.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('system_health.table_name')}</th>
                  <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('system_health.row_count')}</th>
                </tr>
              </thead>
              <tbody>
                {tableStats.map(s => (
                  <tr key={s.table_name} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover:opacity-80 transition-opacity">
                    <td className="py-2 px-2" style={{ color: 'var(--color-text)' }}><code className="text-xs">{s.table_name}</code></td>
                    <td className="py-2 px-2 text-right font-mono" style={{ color: 'var(--color-text)' }}>{s.row_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="card p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}>
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
        </div>
      )}
    </div>
  );
}
