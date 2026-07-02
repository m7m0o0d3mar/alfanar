import { useState, useRef } from 'react';
import { useT } from '../hooks/useTranslation';
import { parseCSV, exportCSV } from '../utils/csv';
import { syncRows, type SyncConfig, type SyncResult } from '../services/syncService';
import { Upload, Download, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';

interface Props {
  moduleName: string;
  config: SyncConfig;
  onClose: () => void;
}

export default function CsvImportModal({ moduleName, config, onClose }: Props) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Record<string, string>[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SyncResult | null>(null);

  function downloadTemplate() {
    const example: Record<string, string> = {};
    config.columns.forEach((c) => { example[c.label] = ''; });
    if (config.columns.length > 0) example[config.columns[0].label] = `Example ${config.columns[0].label}`;
    exportCSV([example], `${moduleName}_import_template.csv`, config.columns.map((c) => ({ key: c.label, label: c.label })));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = parseCSV(text);
      setParsed(rows);
      validate(rows);
    };
    reader.readAsText(file);
  }

  function validate(rows: Record<string, string>[]) {
    const errors: string[] = [];
    if (rows.length === 0) { errors.push('File is empty'); setValidationErrors(errors); return; }
    const fileCols = Object.keys(rows[0]);
    const missing = config.columns.filter((c) => c.required && !fileCols.includes(c.label));
    missing.forEach((c) => errors.push(`Missing required column: "${c.label}"`));
    rows.forEach((row, i) => {
      config.columns.forEach((col) => {
        if (col.required && !row[col.label]?.trim()) errors.push(`Row ${i + 2}: "${col.label}" is required`);
        if (col.type === 'number' && row[col.label] && isNaN(Number(row[col.label]))) errors.push(`Row ${i + 2}: "${col.label}" must be a number`);
        if (col.type === 'date' && row[col.label] && isNaN(Date.parse(row[col.label]))) errors.push(`Row ${i + 2}: "${col.label}" must be a valid date`);
      });
    });
    setValidationErrors(errors);
  }

  async function handleImport() {
    if (validationErrors.length > 0 || parsed.length === 0) return;
    setImporting(true);
    setProgress(0);
    try {
      const batchSize = Math.max(1, Math.min(50, Math.ceil(parsed.length / 10)));
      let allSuccess = 0;
      let allErrors: { row: number; msg: string }[] = [];
      for (let i = 0; i < parsed.length; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize);
        const res = await syncRows(batch, config);
        allSuccess += res.success;
        allErrors = allErrors.concat(res.errors.map((e) => ({ ...e, row: e.row + i })));
        setProgress(Math.round(((i + batchSize) / parsed.length) * 100));
      }
      setResult({ success: allSuccess, errors: allErrors, total: parsed.length });
    } catch {
      setResult({ success: 0, errors: [{ row: 0, msg: 'Import failed unexpectedly' }], total: parsed.length });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="text-lg font-semibold">{t('admin.import_csv')} — {moduleName}</h3>
            <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>{t('admin.import_csv_desc')}</p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={importing}><X size={16} /></button>
        </div>

        {result ? (
          <div className="modal-body">
            <div className="space-y-4">
              <div className="p-4 rounded-lg flex items-center gap-3" style={{
                backgroundColor: result.errors.length > 0 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)'
              }}>
                {result.errors.length > 0 ? <AlertCircle size={24} style={{color: '#d97706'}} /> : <CheckCircle size={24} style={{color: '#16a34a'}} />}
                <div>
                  <p className="font-medium">{result.success} / {result.total} records imported</p>
                  {result.errors.length > 0 && <p className="text-sm" style={{color: '#d97706'}}>{result.errors.length} errors</p>}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="text-sm space-y-1 max-h-[240px] overflow-y-auto p-3 rounded-lg" style={{backgroundColor: 'rgba(220,38,38,0.06)', color: '#dc2626'}}>
                  {result.errors.map((e, i) => <p key={i}>Row {e.row}: {e.msg}</p>)}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary" onClick={onClose}>{t('common.close')}</button>
              {result.errors.length > 0 && (
                <button className="btn-secondary" onClick={() => { setResult(null); setParsed([]); setValidationErrors([]); }}>
                  Try Again
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="modal-body">
              <div className="mb-4">
                <button className="btn-sm btn-secondary" onClick={downloadTemplate}>
                  <Download size={14} /> {t('admin.download_template')}
                </button>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center" style={{borderColor: 'var(--color-border)'}}>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" disabled={importing} />
                {parsed.length === 0 ? (
                  <>
                    <Upload size={40} className="mx-auto mb-3" style={{color: 'var(--color-text-muted)'}} />
                    <p className="mb-2" style={{color: 'var(--color-text-secondary)'}}>{t('admin.drop_csv')}</p>
                    <button className="btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
                      {t('admin.select_file')}
                    </button>
                  </>
                ) : (
                  <div className="text-start">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm" style={{color: 'var(--color-text-secondary)'}}>{parsed.length} rows detected</p>
                      <button className="btn-sm btn-secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
                        {t('admin.re_upload')}
                      </button>
                    </div>
                    <div className="table-wrap max-h-[200px] overflow-auto mb-3">
                      <table className="table text-xs">
                        <thead><tr>{Object.keys(parsed[0]).map((h) => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                          {parsed.slice(0, 5).map((row, i) => (
                            <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="truncate max-w-[150px]">{v}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {importing && (
                <div className="mt-4">
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{width: `${progress}%`}} />
                  </div>
                  <p className="text-sm mt-1 text-center" style={{color: 'var(--color-text-secondary)'}}>Importing... {progress}%</p>
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="mt-4 p-3 rounded-lg text-sm max-h-[200px] overflow-y-auto" style={{
                  backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626'
                }}>
                  {validationErrors.map((e, i) => <p key={i} className="flex items-center gap-1"><AlertCircle size={12} /> {e}</p>)}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose} disabled={importing}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleImport}
                disabled={parsed.length === 0 || validationErrors.length > 0 || importing}>
                {importing ? <><Loader2 size={14} className="animate-spin" /> Importing...</> : `${t('common.import')} ${parsed.length} Records`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}