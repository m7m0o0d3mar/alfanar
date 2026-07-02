import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { FileText, Download, X } from 'lucide-react';

interface Props {
  projectId?: string;
  blockId?: string;
  selectedType: string;
  onClose: () => void;
}

interface StatusCount {
  status: string;
  label: string;
  color: string;
  count: number;
  items: { id: string; label: string; area_sqm?: number; price?: number }[];
}

export default function MapStatusReport({ projectId, blockId, selectedType, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [templateInfo, setTemplateInfo] = useState<any>(null);
  const [totalUnits, setTotalUnits] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        let query = supabase.from('units').select('id, unit_code, unit_type, status, area_sqm, price, floor_number');
        if (blockId) query = query.eq('block_id', blockId);
        else if (projectId) query = query.eq('project_id', projectId);
        else { setLoading(false); return; }
        query = query.eq('is_active', true).limit(2000);

        const { data: units } = await query;
        if (!units || units.length === 0) { setLoading(false); return; }

        setTotalUnits(units.length);

        // Load status template if available
        let statusColors: Record<string, string> = {};
        let statusLabels: Record<string, string> = {};
        let templateName = '';

        if (selectedType === 'project' && projectId) {
          const { data: proj } = await supabase.from('projects').select('status_template_id').eq('id', projectId).single() as any;
          if (proj?.status_template_id) {
            const { data: items } = await supabase.from('status_template_items').select('*').eq('template_id', proj.status_template_id).order('sort_order');
            if (items) {
              templateName = 'Project Template';
              for (const it of items) { statusColors[it.status_key] = it.color; statusLabels[it.status_key] = it.label_en; }
            }
          }
        }

        // Group by status
        const groups: Record<string, StatusCount> = {};
        for (const u of units) {
          const s = u.status || 'unknown';
          if (!groups[s]) {
            groups[s] = { status: s, label: statusLabels[s] || s.replace(/_/g, ' '), color: statusColors[s] || '#6b7280', count: 0, items: [] };
          }
          groups[s].count++;
          groups[s].items.push({ id: u.id, label: u.unit_code, area_sqm: u.area_sqm, price: u.price });
        }
        setStatusCounts(Object.values(groups));
        setTemplateInfo(templateName ? { name: templateName } : null);
      } catch (err) { console.error(err); }
      setLoading(false);
    })();
  }, [projectId, blockId, selectedType]);

  function exportCsv() {
    let csv = 'Status,Label,Count,Unit Code,Area (sqm),Price (SAR)\n';
    for (const g of statusCounts) {
      for (const item of g.items) {
        csv += `${g.status},${g.label},${g.count},${item.label},${item.area_sqm || ''},${item.price || ''}\n`;
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `status-report-${projectId?.slice(0, 8) || 'map'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <FileText size={14} /> Status Report
        </span>
        <div className="flex items-center gap-1">
          <button onClick={exportCsv} className="btn-xs btn-secondary" title="Export CSV">
            <Download size={11} /> CSV
          </button>
          <button onClick={onClose} className="p-0.5 hover:opacity-70"><X size={12} /></button>
        </div>
      </div>

      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
        ) : statusCounts.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No units found</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Total Units: {totalUnits}</span>
              {templateInfo && (
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  Template: {templateInfo.name}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {statusCounts.map(g => {
                const pct = totalUnits > 0 ? Math.round((g.count / totalUnits) * 100) : 0;
                return (
                  <div key={g.status} className="p-2 rounded border text-xs" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="font-medium capitalize">{g.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{g.count}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                    </div>
                    {g.items.length <= 5 && (
                      <div className="mt-1 space-y-0.5">
                        {g.items.map(item => (
                          <div key={item.id} className="flex justify-between text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                            <span>{item.label}</span>
                            <span>{item.area_sqm ? `${item.area_sqm} m²` : ''}{item.price ? ` - ${(item.price / 1000).toFixed(0)}k SAR` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center pt-1">
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                Report generated from {selectedType} data
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
