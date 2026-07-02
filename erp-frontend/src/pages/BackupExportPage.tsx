import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import { Database, Download, Save, FileJson, FileSpreadsheet, Trash2, RefreshCw, Play } from 'lucide-react';

type TabKey = 'export' | 'configs' | 'logs';

interface TableInfo {
  table_name: string;
  table_schema: string;
  row_count: number;
}

interface ExportConfig {
  id: string;
  name: string;
  table_name: string;
  format: 'csv' | 'json';
  updated_at: string;
}

interface ExportLog {
  id: string;
  table_name: string;
  format: 'csv' | 'json';
  row_count: number;
  created_at: string;
}

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'export', labelKey: 'backup_export.export_data' },
  { key: 'configs', labelKey: 'backup_export.saved_configs' },
  { key: 'logs', labelKey: 'backup_export.export_logs' },
];

export default function BackupExportPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('export');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const [configs, setConfigs] = useState<ExportConfig[]>([]);
  const [logs, setLogs] = useState<ExportLog[]>([]);
  const [configName, setConfigName] = useState('');

  useEffect(() => {
    loadTables();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'configs') loadConfigs();
    if (activeTab === 'logs') loadLogs();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTables() {
    setLoading(true);
    try {
      const res = await supabase.rpc('list_tables');
      if (res.error) throw res.error;
      const rows = (res.data || []) as TableInfo[];
      setTables(rows);
      if (rows.length > 0) setSelectedTable(rows[0].table_name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tables');
    }
    setLoading(false);
  }

  async function exportTable() {
    if (!selectedTable) return;
    setExporting(true);
    try {
      const res = await supabase.from(selectedTable).select('*');
      if (res.error) throw res.error;
      const data = res.data as Record<string, unknown>[];

      if (exportFormat === 'csv') {
        exportCSV(data, `${selectedTable}.csv`);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedTable}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      addLogEntry(selectedTable, exportFormat, data.length);
      toast.success(`${data.length} ${t('backup_export.rows_exported')}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
    setExporting(false);
  }

  async function saveConfig() {
    if (!configName.trim() || !selectedTable) return;
    try {
      const res = await supabase.from('export_configs').insert({
        name: configName.trim(),
        table_name: selectedTable,
        format: exportFormat,
      }).select().single();
      if (res.error) throw res.error;
      toast.success(t('backup_export.config_saved'));
      setConfigName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function loadConfigs() {
    setLoading(true);
    try {
      const res = await supabase.from('export_configs').select('*').order('updated_at', { ascending: false });
      if (res.error) throw res.error;
      setConfigs((res.data || []) as ExportConfig[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load configs');
    }
    setLoading(false);
  }

  async function deleteConfig(id: string) {
    try {
      const res = await supabase.from('export_configs').delete().eq('id', id);
      if (res.error) throw res.error;
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      toast.success(t('backup_export.config_deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function runConfig(config: ExportConfig) {
    setExporting(true);
    try {
      const res = await supabase.from(config.table_name).select('*');
      if (res.error) throw res.error;
      const data = res.data as Record<string, unknown>[];

      if (config.format === 'csv') {
        exportCSV(data, `${config.table_name}.csv`);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${config.table_name}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      addLogEntry(config.table_name, config.format, data.length);
      toast.success(`${data.length} ${t('backup_export.rows_exported')}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
    setExporting(false);
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await supabase.from('export_logs').select('*').order('created_at', { ascending: false });
      if (res.error) throw res.error;
      setLogs((res.data || []) as ExportLog[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load logs');
    }
    setLoading(false);
  }

  async function deleteLog(id: string) {
    try {
      const res = await supabase.from('export_logs').delete().eq('id', id);
      if (res.error) throw res.error;
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success(t('backup_export.log_deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function addLogEntry(table: string, fmt: 'csv' | 'json', count: number) {
    try {
      await supabase.from('export_logs').insert({ table_name: table, format: fmt, row_count: count });
    } catch (e) { console.error(e); }
  }

  if (!hasPermission('settings')) {
    return <div className="page-enter flex items-center justify-center py-16"><p style={{ color: 'var(--color-text-secondary)' }}>{t('common.no_permission')}</p></div>;
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
          <Database size={22} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('backup_export.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.description')}</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 50%, transparent)', border: '1px solid var(--color-border)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--color-card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-text-secondary)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'export' && (
        <div className="card p-6 space-y-5">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{t('backup_export.export_data')}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.select_table')}</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
              >
                {tables.map((tbl) => (
                  <option key={tbl.table_name} value={tbl.table_name}>{tbl.table_name} ({tbl.row_count.toLocaleString()})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.format')}</label>
              <div className="flex gap-2 h-[38px]">
                <button
                  onClick={() => setExportFormat('csv')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: exportFormat === 'csv' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-card)',
                    color: exportFormat === 'csv' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <FileSpreadsheet size={16} /> CSV
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: exportFormat === 'json' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-card)',
                    color: exportFormat === 'json' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <FileJson size={16} /> JSON
                </button>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <button className="btn-primary flex-1 h-[38px]" onClick={exportTable} disabled={exporting || !selectedTable}>
                <Download size={16} /> {exporting ? t('common.loading') : t('backup_export.export')}
              </button>
              <button className="btn-secondary h-[38px] px-3" onClick={loadTables} title="Refresh tables">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.config_name')}</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder={t('backup_export.config_name')}
              />
            </div>
            <button className="btn-secondary h-[38px]" onClick={saveConfig} disabled={!configName.trim() || !selectedTable}>
              <Save size={16} /> {t('backup_export.save_config')}
            </button>
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.all_tables')}: {tables.length} ({tables.reduce((s, t) => s + t.row_count, 0).toLocaleString()} rows)</p>
        </div>
      )}

      {activeTab === 'configs' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{t('backup_export.saved_configs')}</h3>
            <button className="btn-secondary btn-sm" onClick={loadConfigs}>
              <RefreshCw size={14} /> {t('common.refresh')}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>
          ) : configs.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.no_configs')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.config_name')}</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.select_table')}</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.format')}</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.date')}</th>
                    <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg) => (
                    <tr key={cfg.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover:opacity-80 transition-opacity">
                      <td className="py-2 px-2" style={{ color: 'var(--color-text)' }}>{cfg.name}</td>
                      <td className="py-2 px-2"><code className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{cfg.table_name}</code></td>
                      <td className="py-2 px-2 text-xs uppercase" style={{ color: 'var(--color-text)' }}>{cfg.format}</td>
                      <td className="py-2 px-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(cfg.updated_at).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-sm" style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }} onClick={() => runConfig(cfg)} disabled={exporting}>
                            <Play size={14} />
                          </button>
                          <button className="btn-sm" style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }} onClick={() => deleteConfig(cfg.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{t('backup_export.export_logs')}</h3>
            <button className="btn-secondary btn-sm" onClick={loadLogs}>
              <RefreshCw size={14} /> {t('common.refresh')}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>
          ) : logs.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.no_logs')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.select_table')}</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.format')}</th>
                    <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('backup_export.rows_exported')}</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.date')}</th>
                    <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover:opacity-80 transition-opacity">
                      <td className="py-2 px-2"><code className="text-xs" style={{ color: 'var(--color-text)' }}>{log.table_name}</code></td>
                      <td className="py-2 px-2 text-xs uppercase" style={{ color: 'var(--color-text)' }}>{log.format}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs" style={{ color: 'var(--color-text)' }}>{log.row_count.toLocaleString()}</td>
                      <td className="py-2 px-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">
                        <button className="btn-sm" style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }} onClick={() => deleteLog(log.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
