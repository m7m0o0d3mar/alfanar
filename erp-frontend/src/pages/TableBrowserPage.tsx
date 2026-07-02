import { useState, useEffect } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Database, Table2, Search, RefreshCw, Plus, Edit3, Trash2, Save, X,
  ChevronDown, ChevronRight, Key, Link2, Settings, Columns,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

type TabKey = 'schema' | 'data' | 'relationships' | 'properties';

interface TableInfo {
  table_name: string;
  table_schema: string;
  row_count: number;
  has_fks: boolean;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface ConstraintInfo {
  column_name: string;
  constraint_type: string;
  foreign_table_name: string | null;
  foreign_column_name: string | null;
}

interface UniqueConstraint {
  constraint_name: string;
  column_name: string;
}

interface CheckConstraint {
  constraint_name: string;
  check_clause: string;
}

interface IncomingFK {
  table_name: string;
  column_name: string;
  referenced_column: string;
}

interface FormField {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_fk: boolean;
  fk_ref: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'schema', label: 'Schema' },
  { key: 'data', label: 'Data' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'properties', label: 'Properties' },
];

const SKIP_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'deleted_at']);

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getInputType(dataType: string): string {
  const t = dataType.toLowerCase();
  if (['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision', 'float', 'float4', 'float8', 'int4', 'int8'].includes(t)) return 'number';
  if (t === 'boolean') return 'checkbox';
  if (t === 'date') return 'date';
  if (t.startsWith('timestamp')) return 'datetime-local';
  return 'text';
}

function isJsonType(dataType: string): boolean {
  return ['json', 'jsonb'].includes(dataType.toLowerCase());
}

function isNumericType(dataType: string): boolean {
  return ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision', 'float', 'float4', 'float8', 'int4', 'int8'].includes(dataType.toLowerCase());
}

export default function TableBrowserPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [tablesWithFK, setTablesWithFK] = useState<Set<string>>(new Set());
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('schema');
  const [loadingTables, setLoadingTables] = useState(true);

  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [constraints, setConstraints] = useState<ConstraintInfo[]>([]);
  const [uniqueConstraints, setUniqueConstraints] = useState<UniqueConstraint[]>([]);
  const [checkConstraints, setCheckConstraints] = useState<CheckConstraint[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [dataLoading, setDataLoading] = useState(false);

  const [incomingFKs, setIncomingFKs] = useState<IncomingFK[]>([]);
  const [relLoading, setRelLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, unknown> | null>(null);

  const [showConstraints, setShowConstraints] = useState(false);

  // Schema editing
  const [showColModal, setShowColModal] = useState(false);
  const [colEdit, setColEdit] = useState<{ column_name: string; new_name: string; data_type: string; is_nullable: boolean; default_value: string } | null>(null);
  const [colForm, setColForm] = useState({ name: '', type: 'text', nullable: true, default: '' });
  const [colSaving, setColSaving] = useState(false);

  // FK editing
  const [showFKModal, setShowFKModal] = useState(false);
  const [fkForm, setFkForm] = useState({ column: '', ref_table: '', ref_column: '', on_delete: 'SET NULL' });
  const [fkSaving, setFkSaving] = useState(false);
  const [allColumns, setAllColumns] = useState<{ table_name: string; column_name: string }[]>([]);

  // Indexes
  const [indexes, setIndexes] = useState<{ index_name: string; index_type: string; column_names: string; is_unique: boolean }[]>([]);

  const pageSize = 25;

  const pkColumn = constraints.find(c => c.constraint_type === 'PRIMARY KEY')?.column_name || columns[0]?.column_name || 'id';
  const formFields = buildFormFields(columns, constraints);

  useEffect(() => {
    loadTables();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTable) {
      setPage(1);
      loadSchema();
      loadConstraints();
      loadUniqueConstraints();
      loadCheckConstraints();
      setTotalCount(tableCounts[selectedTable] ?? 0);
      if (activeTab === 'data') loadData();
      if (activeTab === 'relationships') loadRelationships();
    }
  }, [selectedTable]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTable && activeTab === 'data') loadData();
    if (selectedTable && activeTab === 'relationships') loadRelationships();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTable && activeTab === 'data') loadData();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTables() {
    setLoadingTables(true);
    try {
      const res = await supabase.rpc('list_tables');
      if (res.error) throw res.error;
      const rows = (res.data || []) as TableInfo[];
      setTables(rows);

      const fkSet = new Set(rows.filter(r => r.has_fks).map(r => r.table_name));
      setTablesWithFK(fkSet);

      const counts: Record<string, number> = {};
      rows.forEach(r => { counts[r.table_name] = r.row_count; });
      setTableCounts(counts);

      if (rows.length > 0 && !selectedTable) {
        setSelectedTable(rows[0].table_name);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tables');
    }
    setLoadingTables(false);
  }

  async function loadSchema() {
    if (!selectedTable) return;
    setSchemaLoading(true);
    try {
      const res = await supabase.rpc('list_columns', { tbl: selectedTable });
      if (res.error) throw res.error;
      setColumns((res.data || []) as ColumnInfo[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load schema');
      setColumns([]);
    }
    setSchemaLoading(false);
  }

  async function loadConstraints() {
    if (!selectedTable) return;
    try {
      const res = await supabase.rpc('list_table_constraints', { tbl: selectedTable });
      if (res.error) throw res.error;
      setConstraints((res.data || []) as ConstraintInfo[]);
    } catch {
      setConstraints([]);
    }
  }

  async function loadUniqueConstraints() {
    if (!selectedTable) return;
    try {
      const res = await supabase.rpc('list_unique_constraints', { tbl: selectedTable });
      if (res.error) throw res.error;
      setUniqueConstraints((res.data || []) as UniqueConstraint[]);
    } catch {
      setUniqueConstraints([]);
    }
  }

  async function loadCheckConstraints() {
    if (!selectedTable) return;
    try {
      const res = await supabase.rpc('list_check_constraints', { tbl: selectedTable });
      if (res.error) throw res.error;
      setCheckConstraints((res.data || []) as CheckConstraint[]);
    } catch {
      setCheckConstraints([]);
    }
  }

  async function loadData() {
    if (!selectedTable) return;
    setDataLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = page * pageSize - 1;
      let query = supabase.from(selectedTable).select('*').range(from, to);
      if (pkColumn) {
        query = query.order(pkColumn, { ascending: true });
      }
      const res = await query;
      if (res.error) throw res.error;
      setRows((res.data || []) as Record<string, unknown>[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load data');
      setRows([]);
    }
    setDataLoading(false);
  }

  async function loadRelationships() {
    if (!selectedTable) return;
    setRelLoading(true);
    try {
      const incRes = await supabase.rpc('list_incoming_fks', { tbl: selectedTable });
      if (incRes.error) throw incRes.error;
      setIncomingFKs((incRes.data || []) as IncomingFK[]);
    } catch {
      setIncomingFKs([]);
    }
    setRelLoading(false);
  }

  function startNew() {
    const blank: Record<string, string> = {};
    formFields.forEach(f => {
      if (f.data_type === 'boolean') blank[f.column_name] = 'false';
      else blank[f.column_name] = '';
    });
    setForm(blank);
    setIsNew(true);
    setEditingRow(null);
    setShowModal(true);
  }

  function startEdit(row: Record<string, unknown>) {
    const vals: Record<string, string> = {};
    formFields.forEach(f => {
      const raw = row[f.column_name];
      if (raw === null || raw === undefined) {
        vals[f.column_name] = f.data_type === 'boolean' ? 'false' : '';
      } else {
        vals[f.column_name] = String(raw);
      }
    });
    setForm(vals);
    setIsNew(false);
    setEditingRow(row);
    setShowModal(true);
  }

  async function handleSave() {
    if (!selectedTable) return;
    setSaving(true);
    try {
      const record: Record<string, unknown> = {};
      formFields.forEach(f => {
        const val = form[f.column_name];
        if (f.data_type === 'boolean') {
          record[f.column_name] = val === 'true';
        } else if (isNumericType(f.data_type) && val !== '') {
          record[f.column_name] = Number(val);
        } else if (isJsonType(f.data_type) && val) {
          try { record[f.column_name] = JSON.parse(val); } catch { record[f.column_name] = val; }
        } else if (val === '' && f.is_nullable === 'YES') {
          record[f.column_name] = null;
        } else {
          record[f.column_name] = val;
        }
      });

      if (isNew) {
        const res = await supabase.from(selectedTable).insert(record).select();
        if (res.error) throw res.error;
        toast.success('Row inserted');
      } else if (editingRow) {
        const pkValue = editingRow[pkColumn];
        if (!pkValue) throw new Error('No primary key value');
        const res = await supabase.from(selectedTable).update(record).eq(pkColumn, pkValue).select();
        if (res.error) throw res.error;
        toast.success('Row updated');
      }
      setShowModal(false);
      setEditingRow(null);
      setIsNew(false);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  function handleDeleteClick(row: Record<string, unknown>) {
    setDeleteConfirm(row);
  }

  async function handleDeleteConfirm() {
    if (!selectedTable || !deleteConfirm) return;
    const pkValue = deleteConfirm[pkColumn];
    if (!pkValue) return;
    try {
      const res = await supabase.from(selectedTable).delete().eq(pkColumn, pkValue);
      if (res.error) throw res.error;
      toast.success('Row deleted');
      setDeleteConfirm(null);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function handleRefresh() {
    loadTables();
    if (selectedTable) {
      loadSchema();
      loadConstraints();
      loadUniqueConstraints();
      loadCheckConstraints();
      setTotalCount(tableCounts[selectedTable] ?? 0);
      if (activeTab === 'data') loadData();
      if (activeTab === 'relationships') loadRelationships();
    }
  }

  const filteredTables = tables.filter(t =>
    t.table_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const outgoingFKs = constraints.filter(c => c.constraint_type === 'FOREIGN KEY');

  // ── Schema Editing ──
  async function addColumn() {
    if (!selectedTable || !colForm.name.trim()) return;
    setColSaving(true);
    try {
      const safeName = colForm.name.replace(/[^a-z_]/g, '');
      const nullable = colForm.nullable ? '' : ' NOT NULL';
      const def = colForm.default ? ` DEFAULT ${colForm.default}` : '';
      const res = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE ${selectedTable} ADD COLUMN ${safeName} ${colForm.type}${nullable}${def}`,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Column added');
      setShowColModal(false);
      setColForm({ name: '', type: 'text', nullable: true, default: '' });
      loadSchema();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add column');
    }
    setColSaving(false);
  }

  async function dropColumn(col: string) {
    if (!selectedTable) return;
    try {
      const res = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE ${selectedTable} DROP COLUMN ${col}`,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Column dropped');
      loadSchema();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to drop column');
    }
  }

  async function renameColumn(oldName: string, newName: string) {
    if (!selectedTable || !newName.trim()) return;
    try {
      const safeNew = newName.replace(/[^a-z_]/g, '');
      const res = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE ${selectedTable} RENAME COLUMN ${oldName} TO ${safeNew}`,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Column renamed');
      loadSchema();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rename column');
    }
  }

  // ── FK Editing ──
  async function loadAllColumns() {
    try {
      const { data } = await supabase.rpc('exec_sql', {
        query: `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
      });
      setAllColumns((data || []) as { table_name: string; column_name: string }[]);
    } catch { /* ignore */ }
  }

  async function addForeignKey() {
    if (!selectedTable || !fkForm.column || !fkForm.ref_table) return;
    setFkSaving(true);
    try {
      const name = `fk_${selectedTable}_${fkForm.column}`;
      const res = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE ${selectedTable} ADD CONSTRAINT ${name} FOREIGN KEY (${fkForm.column}) REFERENCES ${fkForm.ref_table}(${fkForm.ref_column || 'id'}) ON DELETE ${fkForm.on_delete}`,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Foreign key added');
      setShowFKModal(false);
      setFkForm({ column: '', ref_table: '', ref_column: 'id', on_delete: 'SET NULL' });
      loadConstraints();
      loadRelationships();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add foreign key');
    }
    setFkSaving(false);
  }

  async function dropForeignKey(colName: string) {
    if (!selectedTable) return;
    try {
      const res = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE ${selectedTable} DROP CONSTRAINT IF EXISTS fk_${selectedTable}_${colName}`,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Foreign key dropped');
      loadConstraints();
      loadRelationships();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to drop foreign key');
    }
  }

  // ── Indexes ──
  async function loadIndexes() {
    if (!selectedTable) return;
    try {
      const { data } = await supabase.rpc('exec_sql', {
        query: `SELECT indexname AS index_name, indexdef AS index_definition FROM pg_indexes WHERE schemaname = 'public' AND tablename = '${selectedTable}'`,
      });
      const rows = ((data || []) as { index_name: string; index_definition: string }[]).map(r => {
        const def = r.index_definition;
        return {
          index_name: r.index_name,
          index_type: def?.includes('btree') ? 'BTREE' : def?.includes('gin') ? 'GIN' : 'OTHER',
          column_names: def?.match(/\((.+?)\)/)?.[1]?.replace(/ /g, '') || '',
          is_unique: def?.toUpperCase().includes('UNIQUE') || false,
        };
      });
      setIndexes(rows);
    } catch { /* ignore */ }
  }

  async function dropIndex(name: string) {
    if (!selectedTable) return;
    try {
      const res = await supabase.rpc('exec_sql', { query: `DROP INDEX IF EXISTS ${name}` });
      if (res.error) throw new Error(res.error.message);
      toast.success('Index dropped');
      loadIndexes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to drop index');
    }
  }

  function startAddColumn() {
    setColForm({ name: '', type: 'text', nullable: true, default: '' });
    setColEdit(null);
    setShowColModal(true);
  }

  function startEditColumn(col: ColumnInfo) {
    setColEdit({
      column_name: col.column_name,
      new_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable === 'YES',
      default_value: col.column_default || '',
    });
    setShowColModal(true);
  }

  function startAddFK() {
    setFkForm({ column: '', ref_table: '', ref_column: 'id', on_delete: 'SET NULL' });
    setShowFKModal(true);
    loadAllColumns();
  }

  // Load indexes when properties tab is activated
  useEffect(() => {
    if (selectedTable && activeTab === 'properties') {
      loadIndexes();
    }
  }, [activeTab, selectedTable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasPermission('settings')) {
    return (
      <div className="page-enter flex items-center justify-center py-16">
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('common.no_permission')}</p>
      </div>
    );
  }

  return (
    <div className="page-enter h-[calc(100vh-2rem)] flex flex-col gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
          <Database size={22} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Table Browser</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Browse and manage database tables</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={handleRefresh} disabled={loadingTables}>
          <RefreshCw size={14} className={loadingTables ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[300px] shrink-0 flex flex-col rounded-xl" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                className="w-full rounded-lg pl-8 pr-3 py-2 text-sm"
                style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                placeholder="Search tables..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loadingTables ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
              </div>
            ) : filteredTables.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No tables found</p>
            ) : (
              filteredTables.map(tbl => {
                const isSelected = tbl.table_name === selectedTable;
                const hasFK = tablesWithFK.has(tbl.table_name);
                return (
                  <button
                    key={tbl.table_name}
                    onClick={() => setSelectedTable(tbl.table_name)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all"
                    style={{
                      backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                    }}
                  >
                    {hasFK && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} />}
                    {!hasFK && <span className="w-1.5 h-1.5 shrink-0" />}
                    <span className="truncate flex-1 font-medium">{tbl.table_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 8%, transparent)', color: 'var(--color-text-muted)' }}>
                      {tableCounts[tbl.table_name]?.toLocaleString() ?? '?'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="p-2 border-t text-xs text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            {tables.length} tables
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {!selectedTable ? (
            <div className="flex-1 flex items-center justify-center">
              <p style={{ color: 'var(--color-text-muted)' }}>Select a table</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1 p-1 rounded-xl mb-4 shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 50%, transparent)', border: '1px solid var(--color-border)' }}>
                {TABS.map(tab => (
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
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'schema' && renderSchemaTab()}
                {activeTab === 'data' && renderDataTab()}
                {activeTab === 'relationships' && renderRelationshipsTab()}
                {activeTab === 'properties' && renderPropertiesTab()}
              </div>
            </>
          )}
        </div>
      </div>

      {showModal && renderModal()}

      {showColModal && (
        <div className="modal-overlay" onClick={() => setShowColModal(false)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                {colEdit ? `Edit Column — ${colEdit.column_name}` : 'Add Column'}
              </h3>
              <button className="btn-sm" onClick={() => setShowColModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body space-y-3">
              {colEdit ? (
                <>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>New Name</label>
                    <input className="w-full input text-sm mt-1" value={colEdit.new_name}
                      onChange={e => setColEdit({ ...colEdit, new_name: e.target.value })} />
                  </div>
                  <button className="btn-primary btn-sm" onClick={() => {
                    renameColumn(colEdit.column_name, colEdit.new_name);
                    setShowColModal(false);
                  }}>
                    <Save size={14} /> Rename
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Column Name</label>
                    <input className="w-full input text-sm mt-1" value={colForm.name}
                      onChange={e => setColForm({ ...colForm, name: e.target.value })} placeholder="column_name" />
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data Type</label>
                    <select className="w-full input text-sm mt-1" value={colForm.type}
                      onChange={e => setColForm({ ...colForm, type: e.target.value })}>
                      <option value="text">text</option>
                      <option value="integer">integer</option>
                      <option value="bigint">bigint</option>
                      <option value="numeric">numeric</option>
                      <option value="boolean">boolean</option>
                      <option value="date">date</option>
                      <option value="timestamp with time zone">timestamptz</option>
                      <option value="jsonb">jsonb</option>
                      <option value="uuid">uuid</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="col-nullable" checked={colForm.nullable}
                      onChange={e => setColForm({ ...colForm, nullable: e.target.checked })} />
                    <label htmlFor="col-nullable" className="text-sm" style={{ color: 'var(--color-text)' }}>Allow NULL</label>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Default Value</label>
                    <input className="w-full input text-sm mt-1" value={colForm.default}
                      onChange={e => setColForm({ ...colForm, default: e.target.value })} placeholder="e.g. 0, 'text', NOW()" />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button className="btn-secondary btn-sm" onClick={() => setShowColModal(false)} disabled={colSaving}>
                      <X size={14} /> Cancel
                    </button>
                    <button className="btn-primary btn-sm" onClick={addColumn} disabled={colSaving || !colForm.name.trim()}>
                      <Plus size={14} /> {colSaving ? 'Adding...' : 'Add Column'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showFKModal && (
        <div className="modal-overlay" onClick={() => setShowFKModal(false)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Add Foreign Key</h3>
              <button className="btn-sm" onClick={() => setShowFKModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Source Column</label>
                <select className="w-full input text-sm mt-1" value={fkForm.column}
                  onChange={e => setFkForm({ ...fkForm, column: e.target.value })}>
                  <option value="">Select column...</option>
                  {columns.filter(c => !SKIP_COLUMNS.has(c.column_name)).map(c => (
                    <option key={c.column_name} value={c.column_name}>{c.column_name} ({c.data_type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Referenced Table</label>
                <select className="w-full input text-sm mt-1" value={fkForm.ref_table}
                  onChange={e => setFkForm({ ...fkForm, ref_table: e.target.value, ref_column: 'id' })}>
                  <option value="">Select table...</option>
                  {tables.filter(t => t.table_name !== selectedTable).map(t => (
                    <option key={t.table_name} value={t.table_name}>{t.table_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Referenced Column</label>
                <select className="w-full input text-sm mt-1" value={fkForm.ref_column}
                  onChange={e => setFkForm({ ...fkForm, ref_column: e.target.value })}>
                  <option value="id">id</option>
                  {allColumns.filter(c => c.table_name === fkForm.ref_table).map(c => (
                    <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>On Delete</label>
                <select className="w-full input text-sm mt-1" value={fkForm.on_delete}
                  onChange={e => setFkForm({ ...fkForm, on_delete: e.target.value })}>
                  <option value="SET NULL">SET NULL</option>
                  <option value="CASCADE">CASCADE</option>
                  <option value="RESTRICT">RESTRICT</option>
                  <option value="NO ACTION">NO ACTION</option>
                  <option value="SET DEFAULT">SET DEFAULT</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button className="btn-secondary btn-sm" onClick={() => setShowFKModal(false)} disabled={fkSaving}>
                  <X size={14} /> Cancel
                </button>
                <button className="btn-primary btn-sm" onClick={addForeignKey} disabled={fkSaving || !fkForm.column || !fkForm.ref_table}>
                  <Plus size={14} /> {fkSaving ? 'Adding...' : 'Add FK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Row"
          message={`Are you sure you want to delete this row? (${pkColumn}: ${deleteConfirm[pkColumn]})`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );

  function renderSchemaTab() {
    if (schemaLoading) {
      return (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
        </div>
      );
    }

    const pkSet = new Set(constraints.filter(c => c.constraint_type === 'PRIMARY KEY').map(c => c.column_name));
    const fkMap = new Map(constraints.filter(c => c.constraint_type === 'FOREIGN KEY').map(c => [c.column_name, `${c.foreign_table_name}(${c.foreign_column_name})`]));

    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{selectedTable}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>
            {totalCount.toLocaleString()} rows
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {columns.length} columns
          </span>
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary btn-sm" onClick={startAddColumn}>
              <Plus size={12} /> Add Column
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left py-2 px-2 font-medium w-8" style={{ color: 'var(--color-text-secondary)' }}>#</th>
                <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Column</th>
                <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Type</th>
                <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nullable</th>
                <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Default</th>
                <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Key</th>
                <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>References</th>
                <th className="text-right py-2 px-2 w-20" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => {
                const isPK = pkSet.has(col.column_name);
                const fkRef = fkMap.get(col.column_name);
                return (
                  <tr key={col.column_name} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover:opacity-80 transition-opacity">
                    <td className="py-2 px-2 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                    <td className="py-2 px-2">
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>{col.column_name}</span>
                      {col.character_maximum_length && (
                        <span className="text-xs ml-1 font-mono" style={{ color: 'var(--color-text-muted)' }}>({col.character_maximum_length})</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <code className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 6%, transparent)', color: 'var(--color-text-secondary)' }}>
                        {col.data_type}
                      </code>
                    </td>
                    <td className="py-2 px-2">
                      {col.is_nullable === 'YES' ? (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>YES</span>
                      ) : (
                        <span className="text-xs font-medium" style={{ color: 'var(--color-danger)' }}>NO</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs font-mono max-w-[200px] truncate" style={{ color: col.column_default ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                      {col.column_default || '—'}
                    </td>
                    <td className="py-2 px-2">
                      {isPK && <span title="Primary Key"><Key size={14} style={{ color: 'var(--color-primary)' }} /></span>}
                      {fkRef && <span title="Foreign Key" className="ml-1"><Link2 size={14} style={{ color: 'var(--color-warning, #eab308)' }} /></span>}
                    </td>
                    <td className="py-2 px-2">
                      {fkRef ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning, #eab308) 15%, transparent)', color: 'var(--color-warning, #eab308)' }}>
                          <Link2 size={10} />
                          {fkRef}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex gap-1 justify-end">
                        {!isPK && !fkRef && col.column_name !== 'id' && (
                          <>
                            <button className="btn-sm" onClick={() => startEditColumn(col)} title="Edit column">
                              <Edit3 size={12} />
                            </button>
                            <button className="btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => {
                              if (window.confirm(`Drop column ${col.column_name}?`)) dropColumn(col.column_name);
                            }} title="Drop column">
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(uniqueConstraints.length > 0 || checkConstraints.length > 0) && (
          <div className="border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => setShowConstraints(!showConstraints)}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {showConstraints ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Constraints ({uniqueConstraints.length + checkConstraints.length})
            </button>
            {showConstraints && (
              <div className="mt-3 space-y-3">
                {uniqueConstraints.length > 0 && (
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>UNIQUE</span>
                    <div className="mt-1 space-y-1">
                      {uniqueConstraints.map(uc => (
                        <div key={uc.constraint_name} className="text-xs px-3 py-1.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
                          <span className="font-mono" style={{ color: 'var(--color-text)' }}>{uc.constraint_name}</span>
                          <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>→</span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{uc.column_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {checkConstraints.length > 0 && (
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>CHECK</span>
                    <div className="mt-1 space-y-1">
                      {checkConstraints.map(cc => (
                        <div key={cc.constraint_name} className="text-xs px-3 py-1.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
                          <span className="font-mono" style={{ color: 'var(--color-text)' }}>{cc.constraint_name}</span>
                          <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>→</span>
                          <code style={{ color: 'var(--color-text-secondary)' }}>{cc.check_clause}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderDataTab() {
    const hasPK = constraints.some(c => c.constraint_type === 'PRIMARY KEY');

    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{selectedTable}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>
              {totalCount.toLocaleString()} rows
            </span>
          </div>
          <button className="btn-primary btn-sm" onClick={startNew}>
            <Plus size={14} /> Add Row
          </button>
        </div>

        {dataLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Table2 size={32} style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }} />
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No data in this table</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {columns.filter(c => !SKIP_COLUMNS.has(c.column_name)).map(col => (
                      <th key={col.column_name} className="text-left py-2 px-2 whitespace-nowrap font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        <div className="flex items-center gap-1">
                          {col.column_name}
                          <code className="text-[10px] font-normal" style={{ color: 'var(--color-text-muted)' }}>{col.data_type}</code>
                        </div>
                      </th>
                    ))}
                    <th className="text-right py-2 px-2 w-20" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row[pkColumn] as string || idx} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover:opacity-80 transition-opacity">
                      {columns.filter(c => !SKIP_COLUMNS.has(c.column_name)).map(col => {
                        const val = row[col.column_name];
                        const display = formatValue(val);
                        const isLong = display.length > 80;
                        const isJson = isJsonType(col.data_type) && val !== null && val !== undefined;
                        return (
                          <td key={col.column_name} className="py-2 px-2 max-w-[250px]" style={{ color: 'var(--color-text)' }}>
                            {val === null || val === undefined ? (
                              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                            ) : col.data_type === 'boolean' ? (
                              <span style={{ color: val ? '#22c55e' : 'var(--color-text-muted)' }}>{val ? 'true' : 'false'}</span>
                            ) : isJson ? (
                              <code className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{JSON.stringify(val)}</code>
                            ) : (
                              <span title={isLong ? display : undefined} className={isLong ? 'block truncate' : ''}>
                                {display}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button className="btn-sm" onClick={() => startEdit(row)} title="Edit">
                            <Edit3 size={13} />
                          </button>
                          {hasPK && (
                            <button className="btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteClick(row)} title="Delete">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={totalCount} onChange={setPage} />
          </>
        )}
      </div>
    );
  }

  function renderRelationshipsTab() {
    const outgoingCount = outgoingFKs.length;
    const incomingCount = incomingFKs.length;

    if (relLoading) {
      return (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{selectedTable}</span>
            <button className="btn-secondary btn-sm ml-auto" onClick={startAddFK}>
              <Plus size={14} /> Add Foreign Key
            </button>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
              <Link2 size={14} style={{ color: 'var(--color-primary)' }} />
              <span style={{ color: 'var(--color-text)' }}>{outgoingCount} outgoing</span>
            </div>
            <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning, #eab308) 10%, transparent)' }}>
              <Link2 size={14} style={{ color: 'var(--color-warning, #eab308)' }} />
              <span style={{ color: 'var(--color-text)' }}>{incomingCount} incoming</span>
            </div>
          </div>
        </div>

        {outgoingFKs.length > 0 && (
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Outgoing References</h3>
            <div className="space-y-2">
              {outgoingFKs.map(fk => (
                <div key={`${fk.column_name}-${fk.foreign_table_name}`} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
                  <div className="flex items-center gap-2 text-sm flex-1">
                    <span className="font-mono font-medium" style={{ color: 'var(--color-text)' }}>{fk.column_name}</span>
                    <span className="text-lg" style={{ color: 'var(--color-text-muted)' }}>───→</span>
                    <span className="font-mono font-medium" style={{ color: 'var(--color-primary)' }}>{fk.foreign_table_name}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>({fk.foreign_column_name})</span>
                  </div>
                  <button className="btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => {
                    if (window.confirm(`Drop FK on ${fk.column_name}?`)) dropForeignKey(fk.column_name);
                  }} title="Drop FK">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {incomingFKs.length > 0 && (
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Incoming References</h3>
            <div className="space-y-2">
              {incomingFKs.map(fk => (
                <div key={`${fk.table_name}-${fk.column_name}`} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-medium" style={{ color: 'var(--color-warning, #eab308)' }}>{fk.table_name}</span>
                    <span className="text-lg" style={{ color: 'var(--color-text-muted)' }}>───→</span>
                    <span className="font-mono font-medium" style={{ color: 'var(--color-text)' }}>{fk.column_name}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>references {selectedTable}({fk.referenced_column})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {outgoingFKs.length === 0 && incomingFKs.length === 0 && (
          <div className="card p-5">
            <div className="flex flex-col items-center py-8 text-center">
              <Link2 size={32} style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }} />
              <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No relationships defined</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderPropertiesTab() {
    return (
      <div className="space-y-4">
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Settings size={16} /> Table Properties
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Row Count</span>
              <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{totalCount.toLocaleString()}</div>
            </div>
            <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Columns</span>
              <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{columns.length}</div>
            </div>
            <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Outgoing FKs</span>
              <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{outgoingFKs.length}</div>
            </div>
            <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Incoming FKs</span>
              <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{incomingFKs.length}</div>
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Columns size={16} /> Indexes ({indexes.length})
          </h3>
          {indexes.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No indexes</p>
          ) : (
            <div className="space-y-2">
              {indexes.map(idx => (
                <div key={idx.index_name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono" style={{ color: 'var(--color-text)' }}>{idx.index_name}</span>
                    {idx.is_unique && (
                      <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: '#22c55e20', color: '#22c55e' }}>UNIQUE</span>
                    )}
                    <span className="text-xs opacity-50" style={{ color: 'var(--color-text-secondary)' }}>{idx.index_type}</span>
                    <span className="text-xs font-mono opacity-50" style={{ color: 'var(--color-text-secondary)' }}>({idx.column_names})</span>
                  </div>
                  <button className="btn-sm" style={{ color: 'var(--color-danger)' }}
                    onClick={() => { if (window.confirm(`Drop index ${idx.index_name}?`)) dropIndex(idx.index_name); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {uniqueConstraints.length > 0 && (
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>UNIQUE Constraints ({uniqueConstraints.length})</h3>
            <div className="space-y-1">
              {uniqueConstraints.map(uc => (
                <div key={uc.constraint_name} className="text-xs px-3 py-1.5 rounded flex items-center justify-between" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
                  <div>
                    <span className="font-mono" style={{ color: 'var(--color-text)' }}>{uc.constraint_name}</span>
                    <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>→</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{uc.column_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {checkConstraints.length > 0 && (
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>CHECK Constraints ({checkConstraints.length})</h3>
            <div className="space-y-1">
              {checkConstraints.map(cc => (
                <div key={cc.constraint_name} className="text-xs px-3 py-1.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' }}>
                  <span className="font-mono" style={{ color: 'var(--color-text)' }}>{cc.constraint_name}</span>
                  <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>→</span>
                  <code style={{ color: 'var(--color-text-secondary)' }}>{cc.check_clause}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderModal() {
    return (
      <div className="modal-overlay" onClick={() => setShowModal(false)}>
        <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              {isNew ? 'Add Row' : 'Edit Row'} — {selectedTable}
            </h3>
            <button className="btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
          </div>
          <div className="modal-body max-h-[60vh] overflow-y-auto space-y-3">
            {formFields.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No editable fields</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formFields.map(f => {
                  const inputType = getInputType(f.data_type);
                  const isJson = isJsonType(f.data_type);
                  const isBool = f.data_type === 'boolean';

                  return (
                    <div key={f.column_name} className={isBool ? '' : 'space-y-1'}>
                      <div className="flex items-center gap-1">
                        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{f.column_name}</label>
                        {f.is_fk && (
                          <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning, #eab308) 15%, transparent)', color: 'var(--color-warning, #eab308)' }}>
                            <Link2 size={8} className="inline" /> {f.fk_ref}
                          </span>
                        )}
                        {f.is_nullable === 'NO' && <span className="text-xs" style={{ color: 'var(--color-danger)' }}>*</span>}
                      </div>
                      {isBool ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded"
                            checked={form[f.column_name] === 'true'}
                            onChange={e => setForm({ ...form, [f.column_name]: String(e.target.checked) })}
                          />
                        </div>
                      ) : inputType === 'datetime-local' ? (
                        <input
                          type="datetime-local"
                          className="input text-sm w-full"
                          value={form[f.column_name] || ''}
                          onChange={e => setForm({ ...form, [f.column_name]: e.target.value })}
                        />
                      ) : inputType === 'date' ? (
                        <input
                          type="date"
                          className="input text-sm w-full"
                          value={form[f.column_name] || ''}
                          onChange={e => setForm({ ...form, [f.column_name]: e.target.value })}
                        />
                      ) : isJson ? (
                        <textarea
                          className="input text-sm w-full font-mono"
                          rows={3}
                          value={form[f.column_name] || ''}
                          onChange={e => setForm({ ...form, [f.column_name]: e.target.value })}
                          placeholder="{}"
                        />
                      ) : inputType === 'number' ? (
                        <input
                          type="number"
                          className="input text-sm w-full"
                          value={form[f.column_name] || ''}
                          onChange={e => setForm({ ...form, [f.column_name]: e.target.value })}
                        />
                      ) : (
                        <input
                          type="text"
                          className="input text-sm w-full"
                          value={form[f.column_name] || ''}
                          onChange={e => setForm({ ...form, [f.column_name]: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="modal-footer flex gap-2 justify-end">
            <button className="btn-secondary btn-sm" onClick={() => setShowModal(false)} disabled={saving}>
              <X size={14} /> Cancel
            </button>
            <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving || formFields.length === 0}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function buildFormFields(columns: ColumnInfo[], constraints: ConstraintInfo[]): FormField[] {
  const fkMap = new Map(
    constraints.filter(c => c.constraint_type === 'FOREIGN KEY').map(c => [c.column_name, `${c.foreign_table_name}(${c.foreign_column_name})`])
  );

  return columns
    .filter(c => !SKIP_COLUMNS.has(c.column_name))
    .map(col => ({
      column_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
      column_default: col.column_default,
      is_fk: fkMap.has(col.column_name),
      fk_ref: fkMap.get(col.column_name) || '',
    }));
}
