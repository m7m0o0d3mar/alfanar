import { useState, useRef } from 'react';
import { useT } from '../hooks/useTranslation';
import { sqlApi } from '../services/api';
import { Play, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

const DESTRUCTIVE_PATTERNS = /^\s*(DROP|TRUNCATE|DELETE|UPDATE|ALTER|CREATE\s+TABLE|REINDEX|VACUUM)\b/im;

export default function SqlEditorPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ columns: string[]; rows: Record<string, unknown>[]; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const pendingQuery = useRef('');

  async function handleRun() {
    if (!query.trim()) return;
    if (DESTRUCTIVE_PATTERNS.test(query)) {
      pendingQuery.current = query;
      setConfirmDestructive(true);
      return;
    }
    executeQuery(query);
  }

  async function executeQuery(sql: string) {
    setRunning(true);
    setResults(null);
    try {
      const result = await sqlApi.execute(sql);
      setResults(result);
    } catch (err: unknown) {
      setResults({ columns: [], rows: [], error: err instanceof Error ? err.message : 'Execution failed' });
    } finally { setRunning(false); }
  }

  const isUnavailable = results?.error?.includes('Could not find the function') || results?.error?.includes('exec_sql');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.sql_editor')}</h1>
        <p className="text-gray-500 mt-1">{t('admin.sql_editor_desc')}</p>
        <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Database function not deployed</p>
              <p>The <code className="bg-amber-100 px-1 rounded">exec_sql</code> RPC function is required for this page but has not been deployed to your Supabase project.</p>
              <p className="mt-2">To enable SQL Editor, run the migration file <code className="bg-amber-100 px-1 rounded">database/010_admin_features.sql</code> in your Supabase SQL Editor or via CLI:</p>
              <pre className="mt-1 bg-amber-100 p-2 rounded text-xs overflow-x-auto">supabase migration up  -- or paste the SQL manually in Supabase Dashboard &gt; SQL Editor</pre>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t('admin.sql_query')}</label>
            <div className="flex gap-2">
              <button className="btn-sm btn-secondary" onClick={() => setQuery('')}>
                <Trash2 size={14} /> {t('common.clear')}
              </button>
              {hasPermission('sql_editor', 'create') && <button className="btn-primary btn-sm" onClick={handleRun} disabled={running || !query.trim()}>
                <Play size={14} /> {running ? t('common.running') : t('admin.run')}
              </button>}
            </div>
          </div>
          <textarea
            className={`input font-mono text-sm min-h-[200px] resize-y ${results?.error && isUnavailable ? 'border-amber-300' : ''}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT * FROM user_profiles LIMIT 10;"
            spellCheck={false}
          />
        </div>
      </div>

      {results && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            {results.error ? (
              <>
                <AlertCircle size={18} className="text-red-500" />
                <span className="text-sm font-medium text-red-600">{t('admin.error')}:</span>
                <span className="text-sm text-red-500">{results.error}</span>
              </>
            ) : (
              <>
                <CheckCircle size={18} className="text-green-500" />
                <span className="text-sm text-gray-500">
                  {results.rows.length} {t('admin.row_s')} {results.columns.length} {t('admin.col_s')}
                </span>
              </>
            )}
          </div>

          {!results.error && results.columns.length > 0 && (
            <div className="table-wrap max-h-[500px] overflow-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    {results.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap font-mono">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.length === 0 ? (
                    <tr><td colSpan={results.columns.length} className="text-center py-4 text-gray-400">
                      {t('common.no_data')}
                    </td></tr>
                  ) : (
                    results.rows.map((row, i) => (
                      <tr key={i}>
                        {results.columns.map((col) => (
                          <td key={col} className="max-w-[300px] truncate font-mono">
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {confirmDestructive && (
        <ConfirmDialog
          title="Destructive Query"
          message="This query may modify or delete data. Are you sure you want to run it?"
          confirmLabel="Run Anyway"
          variant="warning"
          onConfirm={() => { setConfirmDestructive(false); executeQuery(pendingQuery.current); }}
          onCancel={() => setConfirmDestructive(false)}
        />
      )}
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return <span className="text-gray-400 italic">NULL</span>;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
