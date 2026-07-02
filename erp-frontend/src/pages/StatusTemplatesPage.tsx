import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { Search, Plus, Edit3, Trash2, Save, X, Palette, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';

interface StatusTemplate {
  id: string; code: string; name_en: string; name_ar?: string;
  description?: string; target_type: string; is_active: boolean;
  created_at: string; updated_at: string;
}

interface StatusTemplateItem {
  id: string; template_id: string; status_key: string;
  label_en: string; label_ar?: string; color: string; icon?: string;
  sort_order: number; is_default: boolean; allow_transitions: string[];
}

const TARGET_TYPES = ['project', 'block', 'unit', 'task', 'all'];
const PAGE_SIZE = 20;

export default function StatusTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<StatusTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StatusTemplate>>({ code: '', name_en: '', name_ar: '', description: '', target_type: 'all', is_active: true });

  const [itemsTemplate, setItemsTemplate] = useState<StatusTemplate | null>(null);
  const [items, setItems] = useState<StatusTemplateItem[]>([]);
  const [showItems, setShowItems] = useState(false);

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<Partial<StatusTemplateItem>>({ status_key: '', label_en: '', label_ar: '', color: '#6b7280', sort_order: 0, is_default: false, allow_transitions: [] });

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null);

  useEffect(() => { loadTemplates(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTemplates() {
    try {
      setLoading(true);
      const { data } = await supabase.from('status_templates').select('*').order('name_en');
      setTemplates(data || []);
    } catch { toast.error('Failed to load status templates'); }
    finally { setLoading(false); }
  }

  async function loadItems(templateId: string) {
    try {
      const { data } = await supabase.from('status_template_items').select('*').eq('template_id', templateId).order('sort_order');
      setItems(data || []);
    } catch { toast.error('Failed to load template items'); }
  }

  function openNew() { setEditingId(null); setForm({ code: '', name_en: '', name_ar: '', description: '', target_type: 'all', is_active: true }); setShowForm(true); }

  function openEdit(tmpl: StatusTemplate) { setEditingId(tmpl.id); setForm({ code: tmpl.code, name_en: tmpl.name_en, name_ar: tmpl.name_ar, description: tmpl.description, target_type: tmpl.target_type, is_active: tmpl.is_active }); setShowForm(true); }

  async function saveTemplate() {
    if (!form.name_en?.trim() || !form.code?.trim()) { toast.error('Name and code are required'); return; }
    try {
      if (editingId) {
        await supabase.from('status_templates').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingId);
      } else {
        await supabase.from('status_templates').insert(form);
      }
      toast.success(editingId ? 'Template updated' : 'Template created');
      setShowForm(false);
      await loadTemplates();
    } catch { toast.error('Failed to save template'); }
  }

  async function deleteTemplate(id: string) {
    try {
      await supabase.from('status_templates').delete().eq('id', id);
      toast.success('Template deleted');
      setConfirmDelete(null);
      await loadTemplates();
    } catch { toast.error('Failed to delete template'); }
  }

  async function duplicateTemplate(tmpl: StatusTemplate) {
    try {
      const { data: srcItems } = await supabase.from('status_template_items').select('*').eq('template_id', tmpl.id).order('sort_order');
      const { data: newTmpl, error } = await supabase.from('status_templates').insert({
        code: tmpl.code + '-copy', name_en: tmpl.name_en + ' (Copy)', name_ar: tmpl.name_ar ? tmpl.name_ar + ' (نسخة)' : null,
        description: tmpl.description, target_type: tmpl.target_type, is_active: true,
      }).select().single();
      if (error || !newTmpl) throw error || new Error('no data');
      if (srcItems && srcItems.length > 0) {
        const newItems = srcItems.map(i => ({
          template_id: newTmpl.id, status_key: i.status_key, label_en: i.label_en, label_ar: i.label_ar,
          color: i.color, sort_order: i.sort_order, is_default: i.is_default, allow_transitions: i.allow_transitions,
        }));
        await supabase.from('status_template_items').insert(newItems);
      }
      toast.success('Template duplicated');
      await loadTemplates();
    } catch { toast.error('Failed to duplicate template'); }
  }

  function openManageItems(tmpl: StatusTemplate) { setItemsTemplate(tmpl); loadItems(tmpl.id); setShowItems(true); }

  function openNewItem() { setEditingItemId(null); setItemForm({ status_key: '', label_en: '', label_ar: '', color: '#6b7280', sort_order: items.length, is_default: false, allow_transitions: [] }); setShowItemForm(true); }

  function openEditItem(item: StatusTemplateItem) { setEditingItemId(item.id); setItemForm({ status_key: item.status_key, label_en: item.label_en, label_ar: item.label_ar, color: item.color, sort_order: item.sort_order, is_default: item.is_default, allow_transitions: item.allow_transitions || [] }); setShowItemForm(true); }

  async function saveItem() {
    if (!itemForm.status_key?.trim() || !itemForm.label_en?.trim()) { toast.error('Status key and label are required'); return; }
    if (!itemsTemplate) return;
    try {
      if (editingItemId) {
        await supabase.from('status_template_items').update(itemForm).eq('id', editingItemId);
      } else {
        await supabase.from('status_template_items').insert({ ...itemForm, template_id: itemsTemplate.id });
      }
      toast.success(editingItemId ? 'Item updated' : 'Item added');
      setShowItemForm(false);
      await loadItems(itemsTemplate.id);
    } catch { toast.error('Failed to save item'); }
  }

  async function deleteItem(id: string) {
    try {
      await supabase.from('status_template_items').delete().eq('id', id);
      toast.success('Item deleted');
      setConfirmDeleteItem(null);
      if (itemsTemplate) await loadItems(itemsTemplate.id);
    } catch { toast.error('Failed to delete item'); }
  }

  async function moveItem(item: StatusTemplateItem, direction: -1 | 1) {
    const idx = items.findIndex(i => i.id === item.id);
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    const swapped = [...items];
    const tempSort = swapped[idx].sort_order;
    swapped[idx] = { ...swapped[idx], sort_order: swapped[target].sort_order };
    swapped[target] = { ...swapped[target], sort_order: tempSort };
    try {
      await supabase.from('status_template_items').update({ sort_order: swapped[idx].sort_order }).eq('id', swapped[idx].id);
      await supabase.from('status_template_items').update({ sort_order: swapped[target].sort_order }).eq('id', swapped[target].id);
      setItems(swapped.sort((a, b) => a.sort_order - b.sort_order));
    } catch { toast.error('Failed to reorder'); }
  }

  const filtered = templates.filter(t => !search || t.name_en.toLowerCase().includes(search.toLowerCase()) || t.name_ar?.includes(search) || t.code.toLowerCase().includes(search.toLowerCase()));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Status Templates</h1>
        <button className="btn-primary btn-sm" onClick={openNew}><Plus size={16} /> New Template</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input className="input pl-9" placeholder="Search templates..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          {search ? 'No templates match your search' : 'No status templates yet. Create your first one!'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text)' }}>Code</th>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text)' }}>Name</th>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text)' }}>Target</th>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--color-text)' }}>Active</th>
                  <th className="text-right p-3 font-semibold" style={{ color: 'var(--color-text)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(tmpl => (
                  <tr key={tmpl.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="p-3 font-mono text-xs" style={{ color: 'var(--color-text)' }}>{tmpl.code}</td>
                    <td className="p-3">
                      <div style={{ color: 'var(--color-text)' }}>{tmpl.name_en}</div>
                      {tmpl.name_ar && <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{tmpl.name_ar}</div>}
                    </td>
                    <td className="p-3"><span className="badge badge-info text-xs">{tmpl.target_type}</span></td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tmpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {tmpl.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-secondary btn-sm p-1.5" title="Manage Statuses" onClick={() => openManageItems(tmpl)}><Palette size={14} /></button>
                        <button className="btn-secondary btn-sm p-1.5" title="Duplicate" onClick={() => duplicateTemplate(tmpl)}><Copy size={14} /></button>
                        <button className="btn-secondary btn-sm p-1.5" title="Edit" onClick={() => openEdit(tmpl)}><Edit3 size={14} /></button>
                        <button className="btn-secondary btn-sm p-1.5" title="Delete" onClick={() => setConfirmDelete(tmpl.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
        </>
      )}

      {/* Template form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-lg mx-4 space-y-4" style={{ background: 'var(--color-card)', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{editingId ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>
            <div><label className="label">Code *</label><input className="input" value={form.code || ''} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. CONSTRUCTION-DEFAULT" /></div>
            <div><label className="label">Name (EN) *</label><input className="input" value={form.name_en || ''} onChange={e => setForm({...form, name_en: e.target.value})} /></div>
            <div><label className="label">Name (AR)</label><input className="input" value={form.name_ar || ''} onChange={e => setForm({...form, name_ar: e.target.value})} /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div><label className="label">Target Type</label>
              <select className="input" value={form.target_type} onChange={e => setForm({...form, target_type: e.target.value})}>
                {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="toggle" checked={form.is_active ?? true} onChange={e => setForm({...form, is_active: e.target.checked})} />
              <span className="text-sm" style={{ color: 'var(--color-text)' }}>Active</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary btn-sm" onClick={saveTemplate}><Save size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Items management modal */}
      {showItems && itemsTemplate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowItems(false)}>
          <div className="card p-6 w-full max-w-2xl mx-4 space-y-4" style={{ background: 'var(--color-card)', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Status Definitions</h3>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{itemsTemplate.name_en} ({itemsTemplate.code})</p>
              </div>
              <button onClick={() => setShowItems(false)}><X size={18} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>

            <button className="btn-primary btn-sm" onClick={openNewItem}><Plus size={14} /> Add Status</button>

            {items.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No status definitions yet.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex flex-col gap-0.5">
                      <button className="p-0.5 hover:opacity-60" onClick={() => moveItem(item, -1)} disabled={idx === 0}><ArrowUp size={12} /></button>
                      <button className="p-0.5 hover:opacity-60" onClick={() => moveItem(item, 1)} disabled={idx === items.length - 1}><ArrowDown size={12} /></button>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 flex-shrink-0" style={{ backgroundColor: item.color, borderColor: item.color }} title={item.color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{item.label_en}</span>
                        {item.is_default && <span className="badge badge-info text-xs">Default</span>}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {item.status_key}{item.label_ar ? ` · ${item.label_ar}` : ''}
                      </div>
                    </div>
                    <button className="btn-secondary btn-sm p-1.5" onClick={() => openEditItem(item)}><Edit3 size={14} /></button>
                    <button className="btn-secondary btn-sm p-1.5" onClick={() => setConfirmDeleteItem(item.id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item form modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowItemForm(false)}>
          <div className="card p-6 w-full max-w-md mx-4 space-y-4" style={{ background: 'var(--color-card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{editingItemId ? 'Edit Status' : 'Add Status'}</h3>
              <button onClick={() => setShowItemForm(false)}><X size={18} style={{ color: 'var(--color-text-secondary)' }} /></button>
            </div>
            <div><label className="label">Status Key *</label><input className="input font-mono text-xs" value={itemForm.status_key || ''} onChange={e => setItemForm({...itemForm, status_key: e.target.value.replace(/\s+/g, '_').toLowerCase()})} placeholder="e.g. in_progress" /></div>
            <div><label className="label">Label (EN) *</label><input className="input" value={itemForm.label_en || ''} onChange={e => setItemForm({...itemForm, label_en: e.target.value})} /></div>
            <div><label className="label">Label (AR)</label><input className="input" value={itemForm.label_ar || ''} onChange={e => setItemForm({...itemForm, label_ar: e.target.value})} /></div>
            <div className="flex items-end gap-3">
              <div className="flex-1"><label className="label">Color</label><input type="color" className="h-10 w-full rounded cursor-pointer border" style={{ borderColor: 'var(--color-border)' }} value={itemForm.color || '#6b7280'} onChange={e => setItemForm({...itemForm, color: e.target.value})} /></div>
              <div className="w-10 h-10 rounded-full border-2 mb-0.5 flex-shrink-0" style={{ backgroundColor: itemForm.color || '#6b7280', borderColor: itemForm.color || '#6b7280' }} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><label className="label">Sort Order</label><input type="number" className="input" value={itemForm.sort_order ?? 0} onChange={e => setItemForm({...itemForm, sort_order: parseInt(e.target.value) || 0})} /></div>
              <label className="flex items-center gap-2 cursor-pointer pt-5">
                <input type="checkbox" checked={itemForm.is_default || false} onChange={e => setItemForm({...itemForm, is_default: e.target.checked})} />
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>Default</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary btn-sm" onClick={() => setShowItemForm(false)}>Cancel</button>
              <button className="btn-primary btn-sm" onClick={saveItem}><Save size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && <ConfirmDialog title="Delete Template" message="Delete this template? All status definitions inside will be lost." onConfirm={() => deleteTemplate(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
      {confirmDeleteItem && <ConfirmDialog title="Delete Status" message="Delete this status definition?" onConfirm={() => deleteItem(confirmDeleteItem)} onCancel={() => setConfirmDeleteItem(null)} />}
    </div>
  );
}
