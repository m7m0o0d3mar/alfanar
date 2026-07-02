import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useT } from '../hooks/useTranslation';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { pageRegistryApi, genericDataApi } from '../services/api';
import type { LucideIcon } from 'lucide-react';
import type { PageRegistryEntry } from '../types';
import { LayoutDashboard, History, ExternalLink, Plus, Save, Trash2, X, RefreshCw, Edit3, Download, Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { exportCSV, parseCSV } from '../utils/csv';

const ICON_MAP: Record<string, LucideIcon> = { History };

const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at']);

function CrudView({ page }: { page: PageRegistryEntry }) {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [schema, setSchema] = useState<{ column_name: string; data_type: string }[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const entity = page.config?.entity_type;
  if (!entity) return null;

  const load = useCallback(async () => {
    const e = entity;
    if (!e) return;
    setLoading(true);
    const [s, r] = await Promise.all([
      genericDataApi.getSchema(e).catch(() => []),
      genericDataApi.list(e).catch(() => []),
    ]);
    setSchema(s);
    setRows(r);
    setLoading(false);
  }, [entity]);

  useEffect(() => { load(); }, [load]);

  const fields = schema.filter(f => !SKIP_FIELDS.has(f.column_name) && !f.column_name.endsWith('_id'));
  const idField = schema.find(f => f.column_name === 'id');

  function startNew() {
    const blank: Record<string, string> = {};
    fields.forEach(f => blank[f.column_name] = '');
    setForm(blank);
    setIsNew(true);
    setEditing(null);
  }

  function startEdit(row: Record<string, unknown>) {
    const vals: Record<string, string> = {};
    fields.forEach(f => vals[f.column_name] = String(row[f.column_name] ?? ''));
    setForm(vals);
    setIsNew(false);
    setEditing(row);
  }

  async function save() {
    const record = { ...form };
    try {
      if (isNew) {
        await genericDataApi.insert(entity!, record);
        toast.success(t('common.record_created'));
      } else if (editing && idField) {
        const id = editing[idField.column_name] as string;
        await genericDataApi.update(entity!, id, record);
        toast.success(t('common.record_updated'));
      }
      setEditing(null); setIsNew(false); load();
    } catch { toast.error(t('common.save_failed')); }
  }

  async function remove(row: Record<string, unknown>) {
    if (!idField) return;
    try {
      await genericDataApi.remove(entity!, row[idField.column_name] as string);
      toast.success(t('common.record_deleted'));
      load();
    } catch { toast.error(t('common.delete_failed')); }
  }

  async function removeSelected() {
    if (selected.size === 0 || !idField) return;
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await genericDataApi.remove(entity!, id); ok++; }
      catch { fail++; }
    }
    const msg = ok > 0 ? `${ok} ${t('common.record_deleted')}` : '';
    if (fail > 0 && msg) toast.info(`${msg}, ${fail} failed`);
    else if (fail > 0) toast.error(`${fail} ${t('common.delete_failed')}`);
    else toast.success(msg);
    setSelected(new Set());
    load();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = parseCSV(text);
      setImportRows(rows);
      setImportResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function runImport() {
    if (!importRows || importRows.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    let ok = 0, fail = 0;
    const errors: string[] = [];
    for (let i = 0; i < importRows.length; i++) {
      try {
        await genericDataApi.insert(entity!, importRows[i]);
        ok++;
      } catch (e) {
        fail++;
        errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Error'}`);
      }
      setImportProgress(Math.round(((i + 1) / importRows.length) * 100));
    }
    setImportResult({ ok, fail, errors });
    setImporting(false);
    load();
  }

  const listFields = page.config?.list_fields;
  const displayFields = listFields ? fields.filter(f => listFields.includes(f.column_name)) : fields.slice(0, 6);
  const labelMap = (page.config as Record<string, unknown>)?.label_map as Record<string, string> | undefined;
  const searchLower = search.toLowerCase();
  const filteredRows = searchLower
    ? rows.filter(row => displayFields.some(f => String(row[f.column_name] ?? '').toLowerCase().includes(searchLower)))
    : rows;

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{filteredRows.length} {t('common.entries')}</span>
          {search && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)' }}>{t('common.filtered')}</span>}
          {selected.size > 0 && (
            <>
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>{selected.size} selected</span>
              {hasPermission(entity, 'delete') && (
                <button className="btn-sm" style={{ color: 'var(--color-danger)' }} onClick={removeSelected}>
                  <Trash2 size={14} /> {t('common.delete')}
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <input className="input text-sm w-48" placeholder={t('common.search') + '...'}
            value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={load} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
          <button className="btn-secondary btn-sm" onClick={() => {
            const example: Record<string, string> = {};
            fields.forEach((f) => { example[f.column_name] = ''; });
            if (fields.length > 0) example[fields[0].column_name] = `Example ${fields[0].column_name}`;
            exportCSV([example], `${entity}_import_template.csv`);
          }}>
            <Download size={14} /> {t('admin.download_template')}
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
          <button className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> {t('common.import')}
          </button>
          {filteredRows.length > 0 && (
            <button className="btn-secondary btn-sm" onClick={() => exportCSV(filteredRows as Record<string, unknown>[], `${entity}_${new Date().toISOString().slice(0, 10)}.csv`)}>
              <Download size={14} /> {t('admin.export_csv')}
            </button>
          )}
          {hasPermission(entity, 'create') && (
            <button onClick={startNew} className="btn-primary btn-sm"><Plus size={14} /> {t('common.add')}</button>
          )}
        </div>
      </div>

      {importRows && !importResult && (
        <div className="border rounded-lg p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Upload size={16} style={{ color: 'var(--color-primary)' }} />
            <span className="font-semibold text-sm">{importRows.length} {t('common.entries')}</span>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{Object.keys(importRows[0] || {}).length} columns</span>
          </div>
          <div className="overflow-x-auto max-h-[200px]">
            <table className="w-full text-xs">
              <thead><tr>{Object.keys(importRows[0] || {}).map(h => <th key={h} className="text-left py-1 px-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{h.trim()}</th>)}</tr></thead>
              <tbody>{importRows.slice(0, 5).map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {Object.values(row).map((v, j) => <td key={j} className="py-1 px-1 truncate max-w-[150px]" style={{ color: 'var(--color-text)' }}>{v}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary btn-sm" onClick={() => { setImportRows(null); setImportResult(null); }} disabled={importing}><X size={14} /> {t('common.cancel')}</button>
            <button className="btn-primary btn-sm" onClick={runImport} disabled={importing}>
              {importing ? <><Loader2 size={14} className="animate-spin" /> {t('common.importing')}</> : <><Upload size={14} /> {t('common.import')} {importRows.length}</>}
            </button>
          </div>
          {importing && (
            <div className="w-full bg-gray-700 rounded-full h-1.5"><div className="h-1.5 rounded-full transition-all" style={{ width: `${importProgress}%`, backgroundColor: 'var(--color-primary)' }} /></div>
          )}
        </div>
      )}

      {importResult && (
        <div className="border rounded-lg p-4 space-y-2" style={{ backgroundColor: importResult.fail > 0 ? 'color-mix(in srgb, #d97706 10%, transparent)' : 'color-mix(in srgb, #22c55e 10%, transparent)' }}>
          <div className="flex items-center gap-2">
            {importResult.fail > 0 ? <AlertCircle size={16} style={{ color: '#d97706' }} /> : <CheckCircle size={16} style={{ color: '#22c55e' }} />}
            <span className="font-semibold text-sm">{importResult.ok + importResult.fail} / {importRows?.length || 0}</span>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{importResult.ok} ok, {importResult.fail} failed</span>
            <button className="btn-sm ml-auto" onClick={() => { setImportRows(null); setImportResult(null); }}><X size={14} /></button>
          </div>
          {importResult.errors.length > 0 && (
            <div className="max-h-[120px] overflow-y-auto text-xs space-y-0.5" style={{ color: 'var(--color-danger)' }}>
              {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {(isNew || editing) && (
        <div className="border rounded-lg p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fields.map(f => {
              const isText = f.data_type.includes('text') || f.data_type.includes('char') || f.data_type.includes('json');
              const isBool = f.data_type === 'boolean';
              const isNum = f.data_type.includes('int') || f.data_type.includes('numeric') || f.data_type.includes('float');
              return (
                <div key={f.column_name}>
                  <label className="label text-xs">{f.column_name}</label>
                  {isBool ? (
                    <input type="checkbox" className="w-4 h-4 mt-2" checked={form[f.column_name] === 'true'}
                      onChange={e => setForm({ ...form, [f.column_name]: String(e.target.checked) })} />
                  ) : isText && (f.column_name.includes('description') || f.column_name.includes('notes') || f.column_name.includes('address')) ? (
                    <textarea className="input text-sm w-full" rows={3} value={form[f.column_name] || ''}
                      onChange={e => setForm({ ...form, [f.column_name]: e.target.value })} />
                  ) : (
                    <input type={isNum ? 'number' : 'text'} className="input text-sm w-full" value={form[f.column_name] || ''}
                      onChange={e => setForm({ ...form, [f.column_name]: e.target.value })} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary btn-sm" onClick={() => { setEditing(null); setIsNew(false); }}><X size={14} /> {t('common.cancel')}</button>
            {hasPermission(entity, editing ? 'edit' : 'create') && (
              <button className="btn-primary btn-sm" onClick={save}><Save size={14} /> {t('common.save')}</button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th className="py-2 px-1 w-8">
                  {idField && (
                  <input type="checkbox" className="w-3.5 h-3.5"
                    checked={selected.size === filteredRows.length && filteredRows.length > 0}
                    onChange={e => {
                      if (e.target.checked) setSelected(new Set(filteredRows.map(r => String(r[idField!.column_name]))));
                      else setSelected(new Set());
                    }} />
                )}
              </th>
              {displayFields.map(f => (
                <th key={f.column_name} className="text-left py-2 px-2 whitespace-nowrap font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {labelMap?.[f.column_name] || f.column_name}
                </th>
              ))}
              <th className="text-right py-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => {
              const rowId = String(row[idField?.column_name || 'id'] ?? i);
              return (
                <tr key={rowId}
                  style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: selected.has(rowId) ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent' }}
                  className="hover:opacity-80 transition-opacity">
                  <td className="py-2 px-1">
                    <input type="checkbox" className="w-3.5 h-3.5" checked={selected.has(rowId)}
                      onChange={e => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(rowId); else next.delete(rowId);
                        setSelected(next);
                      }} />
                  </td>
                  {displayFields.map(f => {
                    const val = row[f.column_name];
                    return (
                      <td key={f.column_name} className="py-2 px-2 max-w-[200px] truncate" style={{ color: 'var(--color-text)' }}>
                        {f.data_type === 'boolean' ? (val ? '✓' : '—') : String(val ?? '')}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button className="btn-sm" onClick={() => startEdit(row)}><Edit3 size={14} /></button>
                      {hasPermission(entity, 'delete') && (
                        <button className="btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => remove(row)}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <LayoutDashboard size={32} style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }} />
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('common.no_results')}</p>
        </div>
      )}
    </div>
  );
}

function AuditTableView({ page }: { page: PageRegistryEntry }) {
  const t = useT();
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (page.config?.entity_type) {
      genericDataApi.list(page.config.entity_type, 50)
        .then(setEntries).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [page.config?.entity_type]);

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>;
  if (entries.length === 0) return <div className="flex flex-col items-center py-12 text-center"><History size={40} style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }} /><p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('audit.no_entries')}</p></div>;

  return (
    <div className="space-y-2">
      {entries.slice(0, 50).map((e, i) => {
        const action = String(e.action || '');
        const entityType = String(e.entity_type || '');
        return (
          <div key={e.id as string || i} className="card flex items-center gap-3 py-3 px-4">
            <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded"
              style={{ backgroundColor: action === 'INSERT' ? 'color-mix(in srgb, #22c55e 20%, transparent)' : action === 'DELETE' ? 'color-mix(in srgb, #ef4444 20%, transparent)' : 'color-mix(in srgb, #3b82f6 20%, transparent)', color: action === 'INSERT' ? '#22c55e' : action === 'DELETE' ? '#ef4444' : '#3b82f6' }}>
              {action}
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>{entityType}</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--color-text-secondary)' }}>
              {e.created_at ? new Date(String(e.created_at)).toLocaleDateString() : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DynamicPage() {
  const t = useT();
  const location = useLocation();
  const { settings } = useSettings();
  const [page, setPage] = useState<PageRegistryEntry | null>(null);
  const [children, setChildren] = useState<PageRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pageRegistryApi.list(true).then(pages => {
      const match = pages.find(p => {
        const pattern = p.path.replace(/:\w+/g, '[^/]+');
        return location.pathname.match(new RegExp(`^${pattern}$`));
      });
      setPage(match || null);
      setChildren(pages.filter(p => p.parent_code === match?.code).sort((a, b) => a.sort_order - b.sort_order));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [location.pathname]);

  if (loading) {
    return <div className="page-enter flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} /></div>;
  }

  if (!page) {
    return (
      <div className="page-enter flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)' }}>
          <LayoutDashboard size={32} style={{ color: 'var(--color-danger)' }} />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>404 — {t('common.not_found')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{location.pathname}</p>
      </div>
    );
  }

  const IconComp = page.icon ? ICON_MAP[page.icon] : null;

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        {IconComp && <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
          <IconComp size={22} style={{ color: 'var(--color-primary)' }} />
        </div>}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{page.name_en || page.code}</h1>
          {page.section_key && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.section')}: {page.section_label_en || page.section_key}</p>}
        </div>
      </div>

      {page.config?.view === 'crud' && <CrudView page={page} />}
      {page.config?.view === 'table' && <AuditTableView page={page} />}

      {(!page.config || page.config.view === 'custom' || !page.config.view) && (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
              <LayoutDashboard size={32} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{settings.app_name || 'ERP'}</h2>
            <p className="text-sm max-w-md" style={{ color: 'var(--color-text-secondary)' }}>{t('dynamic.page_placeholder')}</p>
          </div>
        </div>
      )}

      {children.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>{t('audit.sub_pages')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map(child => (
              <a key={child.id} href={child.path}
                className="card flex items-center gap-3 py-3 px-4 hover:opacity-80 transition-opacity no-underline"
                style={{ color: 'var(--color-text)' }}
                onClick={e => { e.preventDefault(); window.location.href = child.path; }}>
                <ExternalLink size={16} style={{ color: 'var(--color-primary)' }} />
                <span className="text-sm font-medium">{child.name_en || child.code}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
