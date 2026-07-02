import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { savedReportsApi } from '../services/api';
import {
  X, Play, Save, Trash2, Loader2, Table,
} from 'lucide-react';

interface FilterConfig {
  column: string;
  operator: string;
  value: string;
}

interface SortConfig {
  column: string;
  order: 'asc' | 'desc';
}

interface AggregationConfig {
  column: string;
  function: string;
}

interface ReportConfig {
  data_mode: 'table' | 'sql';
  table_name?: string;
  display_columns?: string[];
  aggregation?: AggregationConfig;
  group_by?: string;
  filters?: FilterConfig[];
  limit?: number;
  sort?: SortConfig;
  sql_query?: string;
  x_axis?: string;
  y_axis?: string;
}

interface SavedReport {
  id: string;
  report_type: string;
  name_en: string;
  name_ar: string;
  config_json: ReportConfig;
  created_by: string;
  is_shared: boolean;
  created_at: string;
}

interface Props {
  report?: SavedReport | null;
  onClose: () => void;
  onSaved: () => void;
}

type TabKey = 'config' | 'data' | 'chart' | 'preview';

const REPORT_TYPES = ['table', 'bar', 'line', 'pie', 'metric'];
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN'];
const AGG_FUNCTIONS = ['sum', 'count', 'avg', 'min', 'max'];

export default function ReportBuilderModal({ report, onClose, onSaved }: Props) {
  const toast = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('config');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<Record<string, unknown>[] | null>(null);
  const [queryError, setQueryError] = useState('');

  const [nameEn, setNameEn] = useState(report?.name_en || '');
  const [nameAr, setNameAr] = useState(report?.name_ar || '');
  const [reportType, setReportType] = useState(report?.report_type || 'table');

  const [dataMode, setDataMode] = useState<'table' | 'sql'>(report?.config_json?.data_mode || 'table');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState(report?.config_json?.table_name || '');
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(report?.config_json?.display_columns || []);
  const [aggregationCol, setAggregationCol] = useState(report?.config_json?.aggregation?.column || '');
  const [aggregationFn, setAggregationFn] = useState(report?.config_json?.aggregation?.function || '');
  const [groupBy, setGroupBy] = useState(report?.config_json?.group_by || '');
  const [filters, setFilters] = useState<FilterConfig[]>(report?.config_json?.filters?.length ? report.config_json.filters : [{ column: '', operator: '=', value: '' }]);
  const [limit, setLimit] = useState(report?.config_json?.limit ?? 100);
  const [sortCol, setSortCol] = useState(report?.config_json?.sort?.column || '');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(report?.config_json?.sort?.order || 'asc');
  const [sqlQuery, setSqlQuery] = useState(report?.config_json?.sql_query || '');

  const [xAxis, setXAxis] = useState(report?.config_json?.x_axis || '');
  const [yAxis, setYAxis] = useState(report?.config_json?.y_axis || '');

  const loadTables = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
      });
      if (error) throw error;
      setTables((data || []).map((r: { table_name: string }) => r.table_name));
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  }, []);

  const loadColumns = useCallback(async (table: string) => {
    if (!table) { setColumns([]); return; }
    try {
      const safe = table.replace(/[^a-z_]/g, '');
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${safe}' ORDER BY ordinal_position`,
      });
      if (error) throw error;
      setColumns((data || []).map((r: { column_name: string }) => r.column_name));
    } catch (err) {
      console.error('Failed to load columns:', err);
    }
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);
  useEffect(() => { if (selectedTable) loadColumns(selectedTable); }, [selectedTable, loadColumns]);

  function toggleColumn(col: string) {
    setSelectedColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }

  function addFilter() {
    setFilters(prev => [...prev, { column: '', operator: '=', value: '' }]);
  }

  function updateFilter(index: number, field: keyof FilterConfig, value: string) {
    setFilters(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  }

  function removeFilter(index: number) {
    setFilters(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  function buildConfig(): ReportConfig {
    const cfg: ReportConfig = { data_mode: dataMode };
    if (dataMode === 'table') {
      cfg.table_name = selectedTable || undefined;
      cfg.display_columns = selectedColumns.length > 0 ? selectedColumns : undefined;
      if (aggregationCol && aggregationFn) cfg.aggregation = { column: aggregationCol, function: aggregationFn };
      cfg.group_by = groupBy || undefined;
      const validFilters = filters.filter(f => f.column);
      cfg.filters = validFilters.length > 0 ? validFilters : undefined;
      cfg.limit = limit;
      if (sortCol) cfg.sort = { column: sortCol, order: sortOrder };
    } else {
      cfg.sql_query = sqlQuery || undefined;
    }
    if (reportType !== 'table') {
      cfg.x_axis = xAxis || undefined;
      cfg.y_axis = yAxis || undefined;
    }
    return cfg;
  }

  function buildQuery(): string {
    if (dataMode === 'sql') return sqlQuery;
    if (!selectedTable) return '';
    const safeTable = selectedTable.replace(/[^a-z_]/g, '');
    const cols = selectedColumns.length > 0 ? selectedColumns.map(c => c.replace(/[^a-z_]/g, '')).join(', ') : '*';
    let query = 'SELECT ';
    if (aggregationCol && aggregationFn) {
      const safeCol = aggregationCol.replace(/[^a-z_]/g, '');
      query += `${aggregationFn}(${safeCol}) AS ${aggregationFn}_${safeCol}`;
      if (groupBy) query += `, ${groupBy.replace(/[^a-z_]/g, '')}`;
      query += ` FROM ${safeTable}`;
      if (groupBy) query += ` GROUP BY ${groupBy.replace(/[^a-z_]/g, '')}`;
    } else {
      query += `${cols} FROM ${safeTable}`;
    }
    const validFilters = filters.filter(f => f.column && f.value);
    if (validFilters.length > 0) {
      const where = validFilters.map(f => {
        const c = f.column.replace(/[^a-z_]/g, '');
        if (f.operator === 'IN') return `${c} IN (${f.value})`;
        if (f.operator === 'LIKE') return `${c} LIKE '${f.value.replace(/'/g, "''")}'`;
        return `${c} ${f.operator} '${f.value.replace(/'/g, "''")}'`;
      }).join(' AND ');
      query += ` WHERE ${where}`;
    }
    if (sortCol) query += ` ORDER BY ${sortCol.replace(/[^a-z_]/g, '')} ${sortOrder}`;
    query += ` LIMIT ${limit}`;
    return query;
  }

  async function handleTestQuery() {
    const query = buildQuery();
    if (!query) { toast.error('No query to run'); return; }
    setRunning(true);
    setQueryResult(null);
    setQueryError('');
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query });
      if (error) throw new Error(error.message);
      setQueryResult((data || []) as Record<string, unknown>[]);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!nameEn.trim() || !nameAr.trim()) {
      toast.error('Name is required in both languages');
      return;
    }
    setSaving(true);
    try {
      const config = buildConfig();
      if (report?.id) {
        await savedReportsApi.update(report.id, {
          name_en: nameEn,
          name_ar: nameAr,
          report_type: reportType,
          config_json: config as unknown as Record<string, unknown>,
        });
        toast.success('Report updated');
      } else {
        await savedReportsApi.create({
          name_en: nameEn,
          name_ar: nameAr,
          report_type: reportType,
          config_json: config as unknown as Record<string, unknown>,
          created_by: user?.id,
        });
        toast.success('Report saved');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!report?.id) return;
    setSaving(true);
    try {
      await savedReportsApi.remove(report.id);
      toast.success('Report deleted');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'config', label: 'Config' },
    { key: 'data', label: 'Data' },
    { key: 'chart', label: 'Chart' },
    { key: 'preview', label: 'Preview' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{report ? 'Edit Report' : 'Report Builder'}</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="tabs overflow-x-auto flex-nowrap px-6 pt-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab whitespace-nowrap ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {activeTab === 'config' && renderConfigTab()}
          {activeTab === 'data' && renderDataTab()}
          {activeTab === 'chart' && renderChartTab()}
          {activeTab === 'preview' && renderPreviewTab()}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary btn-sm flex items-center gap-1.5" onClick={handleTestQuery} disabled={running || (!sqlQuery && dataMode === 'sql') || (!selectedTable && dataMode === 'table')}>
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Test Query
          </button>
          <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Report
          </button>
          {report && (
            <button className="btn-danger btn-sm flex items-center gap-1.5" onClick={handleDelete} disabled={saving}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function renderConfigTab() {
    return (
      <div className="space-y-4">
        <div className="form-group">
          <label className="label">Name (English)</label>
          <input className="input" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Report name in English" />
        </div>
        <div className="form-group">
          <label className="label">Name (Arabic)</label>
          <input className="input" value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="اسم التقرير" />
        </div>
        <div className="form-group">
          <label className="label">Report Type</label>
          <select className="select" value={reportType} onChange={e => setReportType(e.target.value)}>
            {REPORT_TYPES.map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  function renderDataTab() {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 mb-3">
          <button
            className={`btn-sm ${dataMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDataMode('table')}
          >
            <Table size={14} /> Table
          </button>
          <button
            className={`btn-sm ${dataMode === 'sql' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDataMode('sql')}
          >
            SQL
          </button>
        </div>

        {dataMode === 'table' ? (
          <>
            <div className="form-group">
              <label className="label">Table</label>
              <select className="select" value={selectedTable} onChange={e => { setSelectedTable(e.target.value); setSelectedColumns([]); }}>
                <option value="">-- Select a table --</option>
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {selectedTable && (
              <>
                <div className="form-group">
                  <label className="label">Display Columns</label>
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto p-2 rounded" style={{ border: '1px solid var(--color-border)' }}>
                    {columns.map(col => (
                      <label key={col} className="flex items-center gap-1.5 text-sm cursor-pointer px-2 py-1 rounded hover:bg-white/5" style={{ color: 'var(--color-text)' }}>
                        <input type="checkbox" checked={selectedColumns.includes(col)} onChange={() => toggleColumn(col)} className="accent-[var(--color-primary)]" />
                        {col}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="label">Aggregation Column</label>
                    <select className="select" value={aggregationCol} onChange={e => setAggregationCol(e.target.value)}>
                      <option value="">None</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Aggregation Function</label>
                    <select className="select" value={aggregationFn} onChange={e => setAggregationFn(e.target.value)} disabled={!aggregationCol}>
                      <option value="">None</option>
                      {AGG_FUNCTIONS.map(fn => <option key={fn} value={fn}>{fn.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Group By</label>
                  <select className="select" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                    <option value="">None</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Filters</label>
                  <div className="space-y-2">
                    {filters.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select className="select flex-1" value={f.column} onChange={e => updateFilter(i, 'column', e.target.value)}>
                          <option value="">-- Column --</option>
                          {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="select w-20" value={f.operator} onChange={e => updateFilter(i, 'operator', e.target.value)}>
                          {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                        <input className="input flex-1" value={f.value} onChange={e => updateFilter(i, 'value', e.target.value)} placeholder="Value" />
                        <button className="btn-sm btn-ghost text-red-400" onClick={() => removeFilter(i)}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="btn-sm btn-secondary" onClick={addFilter}>+ Add Filter</button>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="label">Limit</label>
                    <input className="input" type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} max={10000} />
                  </div>
                  <div className="form-group">
                    <label className="label">Sort By</label>
                    <select className="select" value={sortCol} onChange={e => setSortCol(e.target.value)}>
                      <option value="">None</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Sort Order</label>
                  <select className="select" value={sortOrder} onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')} disabled={!sortCol}>
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="form-group">
            <label className="label">SQL Query</label>
            <textarea
              className="input font-mono text-sm min-h-[200px] resize-y"
              value={sqlQuery}
              onChange={e => setSqlQuery(e.target.value)}
              placeholder="SELECT * FROM your_table LIMIT 50"
              spellCheck={false}
            />
          </div>
        )}

        {queryResult !== null && (
          <div className="mt-4">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Results ({queryResult.length} rows)
            </p>
            <div className="table-wrap max-h-[240px] overflow-auto text-xs">
              <table className="table">
                <thead>
                  <tr>
                    {queryResult.length > 0 && Object.keys(queryResult[0]).map(col => (
                      <th key={col} className="font-mono">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.length === 0 ? (
                    <tr><td colSpan={100} className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No rows returned</td></tr>
                  ) : (
                    queryResult.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {Object.keys(queryResult[0]).map(col => (
                          <td key={col} className="max-w-[200px] truncate font-mono">{formatCell(row[col])}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {queryError && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            {queryError}
          </div>
        )}
      </div>
    );
  }

  function renderChartTab() {
    if (reportType === 'table') {
      return <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Chart options are not available for table reports.</p>;
    }
    const colOptions = dataMode === 'table' ? columns : [];
    return (
      <div className="space-y-4">
        <div className="form-group">
          <label className="label">X-Axis Column</label>
          {colOptions.length > 0 ? (
            <select className="select" value={xAxis} onChange={e => setXAxis(e.target.value)}>
              <option value="">-- Select --</option>
              {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className="input" value={xAxis} onChange={e => setXAxis(e.target.value)} placeholder="Column name for X axis" />
          )}
        </div>
        <div className="form-group">
          <label className="label">Y-Axis Column</label>
          {colOptions.length > 0 ? (
            <select className="select" value={yAxis} onChange={e => setYAxis(e.target.value)}>
              <option value="">-- Select --</option>
              {colOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className="input" value={yAxis} onChange={e => setYAxis(e.target.value)} placeholder="Column name for Y axis (numeric)" />
          )}
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(168,85,247,0.06)', color: 'var(--color-text-secondary)' }}>
          <p className="text-sm">Columns are loaded from the Data tab. Switch back to Data tab to select a table first.</p>
        </div>
      </div>
    );
  }

  function renderPreviewTab() {
    if (!queryResult) {
      return (
        <div className="empty-state">
          <Play size={40} className="empty-state-icon" />
          <p className="empty-state-title">No data yet</p>
          <p className="empty-state-desc">Configure your report and click "Test Query" to preview results.</p>
        </div>
      );
    }
    if (queryResult.length === 0) {
      return (
        <div className="empty-state">
          <p className="empty-state-title">Query returned no rows</p>
        </div>
      );
    }

    const previewColors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444', '#ec4899', '#6366f1'];

    switch (reportType) {
      case 'table':
        return renderPreviewTable();
      case 'bar':
        return renderPreviewBar(previewColors);
      case 'line':
        return renderPreviewLine(previewColors[0]);
      case 'pie':
        return renderPreviewPie(previewColors);
      case 'metric':
        return renderPreviewMetric();
      default:
        return renderPreviewTable();
    }
  }

  function renderPreviewTable() {
    if (!queryResult || queryResult.length === 0) return null;
    const cols = Object.keys(queryResult[0]);
    return (
      <div className="table-wrap max-h-[400px] overflow-auto">
        <table className="table text-sm">
          <thead>
            <tr>
              {cols.map(col => <th key={col}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {queryResult.map((row, i) => (
              <tr key={i}>
                {cols.map(col => (
                  <td key={col} className="max-w-[250px] truncate">{formatCell(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {queryResult.length > 50 && (
          <p className="p-2 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            Showing 50 of {queryResult.length} rows
          </p>
        )}
      </div>
    );
  }

  function renderPreviewBar(colors: string[]) {
    if (!queryResult || queryResult.length === 0) return null;
    const cols = Object.keys(queryResult[0]);
    const labelCol = xAxis || cols[0];
    const valCol = yAxis || (cols.length > 1 ? cols[1] : cols[0]);
    const values = queryResult.slice(0, 30).map(r => ({ label: String(r[labelCol] ?? ''), value: Number(r[valCol] ?? 0) }));
    const maxVal = Math.max(...values.map(v => v.value), 1);
    return (
      <div className="space-y-1">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs w-24 truncate text-right shrink-0" style={{ color: 'var(--color-text-muted)' }}>{v.label}</span>
            <div className="flex-1 progress-bar h-5">
              <div
                className="progress-bar-fill h-5 rounded flex items-center justify-end px-1"
                style={{ width: `${Math.max((v.value / maxVal) * 100, 1)}%`, backgroundColor: colors[i % colors.length] }}
              >
                <span className="text-[10px] font-medium text-white">{v.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderPreviewLine(color: string) {
    if (!queryResult || queryResult.length === 0) return null;
    const cols = Object.keys(queryResult[0]);
    const labelCol = xAxis || cols[0];
    const valCol = yAxis || (cols.length > 1 ? cols[1] : cols[0]);
    const points = queryResult.slice(0, 100).map(r => ({ label: String(r[labelCol] ?? ''), value: Number(r[valCol] ?? 0) }));
    const maxVal = Math.max(...points.map(p => p.value), 1);
    const w = Math.max(600, points.length * 40);
    const h = 300;
    const pad = 40;
    const xStep = (w - pad * 2) / Math.max(points.length - 1, 1);
    const polyline = points.map((p, i) => {
      const x = pad + i * xStep;
      const y = pad + (1 - p.value / maxVal) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: '400px' }}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={polyline} />
        {points.map((p, i) => {
          const x = pad + i * xStep;
          const y = pad + (1 - p.value / maxVal) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
        {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 10)) === 0).map((p) => {
          const i = points.indexOf(p);
          const x = pad + i * xStep;
          return (
            <text key={i} x={x} y={h - 5} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">
              {p.label}
            </text>
          );
        })}
      </svg>
    );
  }

  function renderPreviewPie(colors: string[]) {
    if (!queryResult || queryResult.length === 0) return null;
    const cols = Object.keys(queryResult[0]);
    const labelCol = xAxis || cols[0];
    const valCol = yAxis || (cols.length > 1 ? cols[1] : cols[0]);
    const slices = queryResult.slice(0, 20).map(r => ({ label: String(r[labelCol] ?? ''), value: Number(r[valCol] ?? 0) }));
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total === 0) return <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No values to display</p>;
    const cx = 150, cy = 150, r = 120;
    let currentAngle = -90;
    const paths = slices.map((sl, i) => {
      const angle = (sl.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const largeArc = angle > 180 ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return { d, color: colors[i % colors.length], label: sl.label, value: sl.value, pct: ((sl.value / total) * 100).toFixed(1) };
    });
    return (
      <div className="flex items-start gap-6">
        <svg width="300" height="300" viewBox="0 0 300 300">
          {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="var(--color-surface)" strokeWidth="2" />)}
        </svg>
        <div className="space-y-1.5 text-sm">
          {paths.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="truncate max-w-[120px]">{p.label}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPreviewMetric() {
    if (!queryResult || queryResult.length === 0) return null;
    const cols = Object.keys(queryResult[0]);
    const valCol = yAxis || cols[0];
    const val = Number(queryResult[0][valCol] ?? 0);
    const label = xAxis || valCol;
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-5xl font-bold" style={{ color: 'var(--color-primary)' }}>
          {Number.isFinite(val) ? val.toLocaleString() : String(queryResult[0][valCol] ?? '')}
        </p>
      </div>
    );
  }
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return <span className="text-gray-400 italic">NULL</span>;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
