import { useState, useEffect, useMemo } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { pageRegistryApi } from '../services/api';
import {
  FileText, Table as TableIcon, Columns, Key, Shield, Search, ChevronRight, ChevronDown,
  BookOpen, Monitor, Database, ArrowRight, CheckCircle, XCircle, Download, Copy,
} from 'lucide-react';

interface TableInfo {
  table_name: string;
  table_type: string;
  row_count: number;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary: boolean;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  column_name: string;
  foreign_table: string | null;
  foreign_column: string | null;
}

interface IndexInfo {
  index_name: string;
  index_type: string;
  column_names: string;
  is_unique: boolean;
}

interface PageInfo {
  code: string;
  path: string;
  name_en: string;
  name_ar?: string;
  is_admin: boolean;
  is_enabled: boolean;
  require_module?: string;
}

const TYPE_COLORS: Record<string, string> = {
  integer: '#0ea5e9',
  bigint: '#2563eb',
  smallint: '#7dd3fc',
  serial: '#0284c7',
  bigserial: '#0369a1',
  boolean: '#22c55e',
  text: '#8b5cf6',
  'character varying': '#a855f7',
  varchar: '#a855f7',
  'timestamp with time zone': '#f59e0b',
  'timestamp without time zone': '#d97706',
  timestamptz: '#f59e0b',
  timestamp: '#d97706',
  date: '#84cc16',
  time: '#65a30d',
  numeric: '#06b6d4',
  'double precision': '#0891b2',
  float8: '#0891b2',
  real: '#0e7490',
  jsonb: '#ec4899',
  json: '#db2777',
  uuid: '#6366f1',
  bytea: '#78716c',
};

function getTypeBadge(type: string) {
  const short = type.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz').replace('timestamp without time zone', 'timestamp').replace('double precision', 'float8');
  const color = TYPE_COLORS[type] || TYPE_COLORS[short] || '#6b7280';
  return { short, color };
}

function exportMarkdown(tables: TableInfo[], columns: Record<string, ColumnInfo[]>, constraints: Record<string, ConstraintInfo[]>, indexes: Record<string, IndexInfo[]>, pages: PageInfo[]) {
  let md = `# System Documentation\n\nGenerated on ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `## Summary\n\n`;
  md += `- Tables: ${tables.length}\n`;
  md += `- Columns: ${Object.values(columns).reduce((s, c) => s + c.length, 0)}\n`;
  md += `- Relations: ${Object.values(constraints).reduce((s, c) => s + c.length, 0)}\n`;
  md += `- Pages: ${pages.length}\n\n`;
  md += `---\n\n## Tables\n\n`;
  for (const t of tables) {
    md += `### ${t.table_name}\n\n`;
    md += `- Row count: ~${t.row_count}\n\n`;
    const cols = columns[t.table_name] || [];
    if (cols.length > 0) {
      md += `| Column | Type | Nullable | Default |\n|--------|------|----------|--------|\n`;
      for (const c of cols) {
        const short = c.data_type.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz');
        md += `| ${c.column_name}${c.is_primary ? ' 🔑' : ''} | ${short} | ${c.is_nullable === 'YES' ? '✔' : '✖'} | ${c.column_default || '-'} |\n`;
      }
      md += '\n';
    }
    const fks = (constraints[t.table_name] || []).filter(c => c.constraint_type === 'FOREIGN KEY');
    if (fks.length > 0) {
      md += `**Foreign Keys:**\n\n`;
      for (const fk of fks) {
        md += `- ${fk.column_name} → ${fk.foreign_table}.${fk.foreign_column}\n`;
      }
      md += '\n';
    }
    const idxs = indexes[t.table_name] || [];
    if (idxs.length > 0) {
      md += `**Indexes:** ${idxs.map(i => `${i.is_unique ? 'UNIQUE ' : ''}${i.index_name}`).join(', ')}\n\n`;
    }
    md += `---\n\n`;
  }
  md += `## Pages\n\n`;
  for (const p of pages) {
    md += `- **${p.name_en}** ${p.is_admin ? '(Admin)' : ''} ${p.is_enabled ? '✅' : '❌'} — \`${p.path}\`\n`;
    if (p.require_module) md += `  - Module: ${p.require_module}\n`;
    if (p.name_ar) md += `  - Arabic: ${p.name_ar}\n`;
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `system-documentation-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocsPage() {
  const t = useT();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columns, setColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [constraints, setConstraints] = useState<Record<string, ConstraintInfo[]>>({});
  const [indexes, setIndexes] = useState<Record<string, IndexInfo[]>>({});
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [columnSearch, setColumnSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'tables' | 'pages' | 'summary'>('summary');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    try {
      const [tablesRes, colsRes, constraintsRes, indexesRes, pagesData] = await Promise.all([
        supabase.rpc('list_tables'),
        supabase.rpc('exec_sql', {
          query: `SELECT table_name, column_name, data_type, is_nullable, column_default
                  FROM information_schema.columns WHERE table_schema = 'public'
                  ORDER BY table_name, ordinal_position`,
        }),
        supabase.rpc('exec_sql', {
          query: `SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
                  kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                  LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                  WHERE tc.table_schema = 'public'
                  ORDER BY tc.table_name, tc.constraint_type`,
        }),
        supabase.rpc('exec_sql', {
          query: `SELECT tablename AS table_name, indexname AS index_name, indexdef AS index_definition
                  FROM pg_indexes WHERE schemaname = 'public'
                  ORDER BY tablename, indexname`,
        }),
        pageRegistryApi.list(),
      ]);

      const tableList = ((tablesRes.data || []) as Array<{ table_name: string; row_count: number }>)
        .filter(t => !['_prisma_migrations', 'schema_migrations'].includes(t.table_name));
      setTables(tableList.map(t => ({ ...t, table_type: 'BASE TABLE' })));

      const colsMap: Record<string, ColumnInfo[]> = {};
      const pkCols = await loadPrimaryKeys();
      for (const row of (colsRes.data || []) as Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>) {
        if (!colsMap[row.table_name]) colsMap[row.table_name] = [];
        colsMap[row.table_name].push({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable,
          column_default: row.column_default,
          is_primary: pkCols[row.table_name]?.has(row.column_name) || false,
        });
      }
      setColumns(colsMap);

      const constraintsMap: Record<string, ConstraintInfo[]> = {};
      for (const row of (constraintsRes.data || []) as Array<{ table_name: string; constraint_name: string; constraint_type: string; column_name: string; foreign_table: string | null; foreign_column: string | null }>) {
        if (!constraintsMap[row.table_name]) constraintsMap[row.table_name] = [];
        constraintsMap[row.table_name].push(row);
      }
      setConstraints(constraintsMap);

      const indexMap: Record<string, IndexInfo[]> = {};
      for (const row of (indexesRes.data || []) as Array<{ table_name: string; index_name: string; index_definition: string }>) {
        if (!indexMap[row.table_name]) indexMap[row.table_name] = [];
        const def = row.index_definition;
        indexMap[row.table_name].push({
          index_name: row.index_name,
          index_type: def?.includes('btree') ? 'BTREE' : def?.includes('gin') ? 'GIN' : def?.includes('gist') ? 'GiST' : 'OTHER',
          column_names: def?.match(/\((.+?)\)/)?.[1]?.replace(/ /g, '') || '',
          is_unique: def?.toUpperCase().includes('UNIQUE') || false,
        });
      }
      setIndexes(indexMap);
      setPages((pagesData || []) as PageInfo[]);
    } catch (e) { console.error('Failed to load documentation', e); }
    setLoading(false);
  }

  async function loadPrimaryKeys(): Promise<Record<string, Set<string>>> {
    const result: Record<string, Set<string>> = {};
    try {
      const { data } = await supabase.rpc('exec_sql', {
        query: `SELECT kcu.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'`,
      });
      for (const row of (data || []) as Array<{ table_name: string; column_name: string }>) {
        if (!result[row.table_name]) result[row.table_name] = new Set();
        result[row.table_name].add(row.column_name);
      }
    } catch { /* ignore */ }
    return result;
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard not available */ }
  }

  const filteredTables = useMemo(() => {
    let list = tables.filter(t => t.table_name.toLowerCase().includes(search.toLowerCase()));
    if (columnSearch) {
      const q = columnSearch.toLowerCase();
      list = list.filter(t => {
        const cols = columns[t.table_name] || [];
        return cols.some(c => c.column_name.toLowerCase().includes(q) || c.data_type.toLowerCase().includes(q));
      });
    }
    return list;
  }, [tables, search, columnSearch, columns]);

  function toggleTable(name: string) {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const totalColumns = Object.values(columns).reduce((s, c) => s + c.length, 0);
  const totalConstraints = Object.values(constraints).reduce((s, c) => s + c.length, 0);
  const totalIndexes = Object.values(indexes).reduce((s, c) => s + c.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 mx-auto" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
          <div className="text-sm opacity-60" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading') || 'Loading...'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BookOpen size={24} style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('admin.system_documentation') || 'System Documentation'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
              style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              placeholder={t('common.search') || 'Search...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-secondary btn-sm" onClick={() => exportMarkdown(tables, columns, constraints, indexes, pages)}>
            <Download size={14} /> Markdown
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-glass p-4 rounded-xl">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <TableIcon size={16} /> {t('admin.tables') || 'Tables'}
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{tables.length}</div>
        </div>
        <div className="stat-glass p-4 rounded-xl">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <Columns size={16} /> {t('admin.columns') || 'Columns'}
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{totalColumns}</div>
        </div>
        <div className="stat-glass p-4 rounded-xl">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <Key size={16} /> {t('admin.relations') || 'Relations'}
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{totalConstraints}</div>
        </div>
        <div className="stat-glass p-4 rounded-xl">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <Monitor size={16} /> {t('admin.pages') || 'Pages'}
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{pages.length}</div>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-3 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
        {(['summary', 'tables', 'pages'] as const).map(tab => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-white' : ''
            }`}
            style={{
              background: activeTab === tab ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--color-text)',
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'summary' && <><FileText size={14} className="inline mr-1" /> {t('admin.summary') || 'Summary'}</>}
            {tab === 'tables' && <><Database size={14} className="inline mr-1" /> {t('admin.tables') || 'Tables'} ({filteredTables.length})</>}
            {tab === 'pages' && <><Monitor size={14} className="inline mr-1" /> {t('admin.pages') || 'Pages'} ({pages.length})</>}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-5 rounded-xl space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <Database size={18} className="inline mr-2" /> {t('admin.database_schema') || 'Database Schema'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('admin.docs_db_desc') || `The system uses ${tables.length} tables with ${totalColumns} columns, ${totalConstraints} constraints, and ${totalIndexes} indexes across the public schema.`}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="p-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>{tables.length}</div>
                <div className="text-xs opacity-60">{t('admin.tables') || 'Tables'}</div>
              </div>
              <div className="p-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>{totalColumns}</div>
                <div className="text-xs opacity-60">{t('admin.columns') || 'Columns'}</div>
              </div>
              <div className="p-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                <div className="font-bold" style={{ color: 'var(--color-text)' }}>{totalIndexes}</div>
                <div className="text-xs opacity-60">{t('admin.indexes') || 'Indexes'}</div>
              </div>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {tables.slice(0, 30).map(tbl => (
                <div key={tbl.table_name} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:opacity-80 cursor-pointer" style={{ color: 'var(--color-text)' }} onClick={() => copyText(tbl.table_name)} title={copied === tbl.table_name ? (t('common.copied') || 'Copied!') : (t('common.copy_name') || 'Copy name')}>
                  <span className="font-mono text-xs">{tbl.table_name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs opacity-60">{columns[tbl.table_name]?.length || 0} cols</span>
                    {copied === tbl.table_name && <CheckCircle size={12} style={{ color: '#22c55e' }} />}
                  </span>
                </div>
              ))}
              {tables.length > 30 && (
                <div className="text-xs text-center opacity-50 pt-1">+{tables.length - 30} more</div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl space-y-3">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              <Monitor size={18} className="inline mr-2" /> {t('admin.page_registry') || 'Page Registry'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('admin.docs_pages_desc') || `${pages.length} registered pages, ${pages.filter(p => p.is_enabled).length} enabled, ${pages.filter(p => p.is_admin).length} admin-only.`}
            </p>
            <div className="flex gap-2 text-sm flex-wrap">
              <span className="px-2 py-1 rounded-lg text-xs" style={{ background: '#22c55e20', color: '#22c55e' }}>{pages.filter(p => p.is_enabled).length} Enabled</span>
              <span className="px-2 py-1 rounded-lg text-xs" style={{ background: '#ef444420', color: '#ef4444' }}>{pages.filter(p => !p.is_enabled).length} Disabled</span>
              <span className="px-2 py-1 rounded-lg text-xs" style={{ background: '#f59e0b20', color: '#f59e0b' }}>{pages.filter(p => p.is_admin).length} Admin</span>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {pages.slice(0, 30).map(p => (
                <div key={p.code} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:opacity-80 cursor-pointer" style={{ color: 'var(--color-text)' }} onClick={() => copyText(p.path)} title={copied === p.path ? (t('common.copied') || 'Copied!') : (t('common.copy_path') || 'Copy path')}>
                  <div className="flex items-center gap-2">
                    {p.is_enabled ? <CheckCircle size={12} style={{ color: '#22c55e' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}
                    <span className="text-xs">{p.name_en}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono opacity-60">{p.path}</span>
                    {copied === p.path && <CheckCircle size={12} style={{ color: '#22c55e' }} />}
                  </div>
                </div>
              ))}
              {pages.length > 30 && (
                <div className="text-xs text-center opacity-50 pt-1">+{pages.length - 30} more</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tables' && (
        <div className="space-y-3">
          {columnSearch && (
            <div className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                placeholder={t('admin.search_columns') || 'Search columns...'}
                value={columnSearch}
                onChange={e => setColumnSearch(e.target.value)}
              />
            </div>
          )}
          {filteredTables.map(table => {
            const isExpanded = expandedTables.has(table.table_name);
            const tableCols = columns[table.table_name] || [];
            const tableConstraints = constraints[table.table_name] || [];
            const tableIndexes = indexes[table.table_name] || [];
            const fkConstraints = tableConstraints.filter(c => c.constraint_type === 'FOREIGN KEY');

            return (
              <div key={table.table_name} className="glass-card rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 hover:opacity-80 transition-opacity"
                  onClick={() => toggleTable(table.table_name)}
                  style={{ color: 'var(--color-text)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Database size={18} style={{ color: 'var(--color-primary)' }} />
                    <span className="font-semibold font-mono truncate">{table.table_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'var(--color-primary)20', color: 'var(--color-primary)' }}>
                      {tableCols.length} cols
                    </span>
                    <span className="text-xs opacity-60 whitespace-nowrap">~{table.row_count} rows</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="btn-secondary !p-1" onClick={e => { e.stopPropagation(); copyText(table.table_name); }} title={copied === table.table_name ? (t('common.copied') || 'Copied!') : (t('common.copy_name') || 'Copy name')}>
                      {copied === table.table_name ? <CheckCircle size={12} style={{ color: '#22c55e' }} /> : <Copy size={12} />}
                    </button>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <h4 className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                        <Columns size={12} /> Columns ({tableCols.length})
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                              <th className="text-left py-1 pr-3 font-medium">Name</th>
                              <th className="text-left py-1 pr-3 font-medium">Type</th>
                              <th className="text-left py-1 pr-3 font-medium">Nullable</th>
                              <th className="text-left py-1 font-medium">Default</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableCols.map(col => {
                              const { short, color } = getTypeBadge(col.data_type);
                              return (
                                <tr key={col.column_name} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                                  <td className="py-1.5 pr-3">
                                    <span className="font-mono">{col.column_name}</span>
                                    {col.is_primary && (
                                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#f59e0b20', color: '#f59e0b' }}>PK</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: `${color}18`, color }}>
                                      {short}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    {col.is_nullable === 'YES' ? (
                                      <span className="text-green-500 text-[10px] font-medium">NULL</span>
                                    ) : (
                                      <span className="text-red-400 text-[10px] font-medium">NOT NULL</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 font-mono opacity-60 text-[10px]">
                                    {col.column_default || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {fkConstraints.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                          <ArrowRight size={12} /> {t('admin.foreign_keys') || 'Foreign Keys'} ({fkConstraints.length})
                        </h4>
                        <div className="space-y-1">
                          {fkConstraints.map(fk => (
                            <div key={fk.constraint_name} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#0ea5e920', color: '#0ea5e9' }}>{fk.column_name}</span>
                              <ArrowRight size={10} className="opacity-50" />
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#8b5cf615', color: '#8b5cf6' }}>{fk.foreign_table}.{fk.foreign_column}</span>
                              <span className="text-[10px] opacity-40 ml-auto font-mono">{fk.constraint_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tableIndexes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                          <Key size={12} /> {t('admin.indexes') || 'Indexes'} ({tableIndexes.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {tableIndexes.map(idx => (
                            <div key={idx.index_name} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#8b5cf615', color: '#8b5cf6' }}>
                              {idx.is_unique && <span className="font-bold">U</span>}
                              {idx.index_name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredTables.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
              <Database size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('common.no_results') || 'No tables found'}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pages' && (
        <>
          <div className="flex gap-2 text-sm flex-wrap">
            <span className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: '#22c55e20', color: '#22c55e' }}>{pages.filter(p => p.is_enabled).length} {t('common.enabled') || 'Enabled'}</span>
            <span className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: '#ef444420', color: '#ef4444' }}>{pages.filter(p => !p.is_enabled).length} {t('common.disabled') || 'Disabled'}</span>
            <span className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: '#f59e0b20', color: '#f59e0b' }}>{pages.filter(p => p.is_admin).length} {t('admin.admin') || 'Admin'}</span>
            <span className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: '#0ea5e920', color: '#0ea5e9' }}>{pages.filter(p => !p.is_admin).length} {t('admin.public') || 'Public'}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.filter(p => p.name_en.toLowerCase().includes(search.toLowerCase())).map(p => (
              <div key={p.code} className="glass-card p-4 rounded-xl space-y-2 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.is_admin ? <Shield size={16} style={{ color: '#f59e0b' }} /> : <Monitor size={16} style={{ color: 'var(--color-primary)' }} />}
                    <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{p.name_en}</span>
                  </div>
                  {p.is_enabled ? (
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Enabled" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Disabled" />
                  )}
                </div>
                <div className="text-xs font-mono truncate" style={{ color: 'var(--color-text-secondary)' }}>{p.path}</div>
                {p.name_ar && <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.name_ar}</div>}
                <div className="flex items-center gap-2 text-[10px]">
                  {p.is_admin && <span className="px-1.5 py-0.5 rounded" style={{ background: '#f59e0b20', color: '#f59e0b' }}>{t('admin.admin') || 'Admin'}</span>}
                  {p.require_module && <span className="px-1.5 py-0.5 rounded" style={{ background: '#0ea5e920', color: '#0ea5e9' }}>{p.require_module}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
