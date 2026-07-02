import { useState, useEffect } from 'react';
import { workflowsApi, statusesApi, modulesApi } from '../../services/api';
import type { WorkflowDefinition, WorkflowStep, StatusDefinition, Module } from '../../types';
import { useT } from '../../hooks/useTranslation';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, ArrowRight, ArrowUp, ArrowDown, Save, X, Paperclip, MessageSquare, Bell } from 'lucide-react';

const STEP_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

function getStatusMap(statuses: StatusDefinition[]): Record<string, StatusDefinition> {
  const map: Record<string, StatusDefinition> = {};
  statuses.forEach(s => { map[s.status_code] = s; });
  return map;
}

export default function WorkflowsTab() {
  const t = useT();
  const { hasPermission } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWf, setSelectedWf] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [showWfForm, setShowWfForm] = useState(false);
  const [wfEdit, setWfEdit] = useState<Partial<WorkflowDefinition>>({});
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepEdit, setStepEdit] = useState<Partial<WorkflowStep>>({});

  useEffect(() => { modulesApi.list().then(setModules); }, []);

  useEffect(() => {
    if (!selectedModule) return;
    workflowsApi.list(selectedModule).then(setWorkflows);
    statusesApi.list(selectedModule).then(setStatuses);
  }, [selectedModule]);

  useEffect(() => {
    if (!selectedWf) { setSteps([]); return; }
    workflowsApi.getSteps(selectedWf).then(setSteps);
  }, [selectedWf]);

  async function saveWf() {
    try {
      await workflowsApi.upsert({ ...wfEdit, module_code: selectedModule });
      setShowWfForm(false);
      setWfEdit({});
      setWorkflows(await workflowsApi.list(selectedModule));
    } catch { console.error('Failed to save workflow'); }
  }

  function startEditStep(step: WorkflowStep) {
    setEditingStepId(step.id);
    setStepEdit({ ...step });
  }

  async function saveStepEdit() {
    if (!stepEdit.id) return;
    try {
      await workflowsApi.upsertStep(stepEdit);
      setEditingStepId(null);
      setStepEdit({});
      setSteps(await workflowsApi.getSteps(selectedWf));
    } catch { console.error('Failed to save step'); }
  }

  async function removeStep(id: string) {
    try {
      await workflowsApi.removeStep(id);
      setSteps(await workflowsApi.getSteps(selectedWf));
    } catch { console.error('Failed to remove step'); }
  }

  async function moveStep(id: string, direction: -1 | 1) {
    const idx = steps.findIndex(s => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const reordered = [...steps];
    const temp = reordered[idx].step_order;
    reordered[idx] = { ...reordered[idx], step_order: reordered[newIdx].step_order };
    reordered[newIdx] = { ...reordered[newIdx], step_order: temp };
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    try {
      await Promise.all([
        workflowsApi.upsertStep({ id: reordered[idx].id, step_order: reordered[idx].step_order }),
        workflowsApi.upsertStep({ id: reordered[newIdx].id, step_order: reordered[newIdx].step_order }),
      ]);
      setSteps(await workflowsApi.getSteps(selectedWf));
    } catch { console.error('Failed to reorder'); }
  }

  async function addNewStep() {
    const maxOrder = steps.reduce((max, s) => Math.max(max, s.step_order), 0);
    const newStep: Partial<WorkflowStep> = {
      workflow_id: selectedWf,
      step_order: maxOrder + 10,
      from_status_code: '',
      to_status_code: '',
      allowed_roles: [],
      action_label_en: '',
      action_label_ar: '',
      require_attachment: false,
      require_comment: false,
      notify_roles: [],
    };
    try {
      await workflowsApi.upsertStep(newStep);
      setSteps(await workflowsApi.getSteps(selectedWf));
    } catch { console.error('Failed to add step'); }
  }

  const statusMap = getStatusMap(statuses);
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
  const statusNodes = new Set<string>();
  sortedSteps.forEach(s => { if (s.from_status_code) statusNodes.add(s.from_status_code); if (s.to_status_code) statusNodes.add(s.to_status_code); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('designer.workflows')}</h3>
        <select className="input w-auto" value={selectedModule}
          onChange={(e) => { setSelectedModule(e.target.value); setSelectedWf(''); }}>
          <option value="">{t('designer.select_module')}</option>
          {modules.map((m) => (
            <option key={m.code} value={m.code}>{m.name_en}</option>
          ))}
        </select>
      </div>

      {selectedModule && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {workflows.length === 0 ? (
                <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>{t('designer.no_workflows')}</p>
              ) : (
                workflows.map((wf) => (
                  <button key={wf.id}
                    className={`btn-sm ${selectedWf === wf.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedWf(wf.id)}>
                    {wf.name_en}
                  </button>
                ))
              )}
            </div>
            {hasPermission('settings', 'create') && (
              <button className="btn-primary btn-sm" onClick={() => { setWfEdit({}); setShowWfForm(true); }}>
                <Plus size={16} /> {t('designer.add_workflow')}
              </button>
            )}
          </div>

          {showWfForm && (
            <div className="card border-2 border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('designer.name_en')}</label>
                  <input className="input" value={wfEdit.name_en || ''}
                    onChange={(e) => setWfEdit({ ...wfEdit, name_en: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('designer.name_ar')}</label>
                  <input className="input text-right" dir="rtl" value={wfEdit.name_ar || ''}
                    onChange={(e) => setWfEdit({ ...wfEdit, name_ar: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {hasPermission('settings', 'edit') && <button className="btn-primary btn-sm" onClick={saveWf}>{t('common.save')}</button>}
                <button className="btn-secondary btn-sm" onClick={() => setShowWfForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {selectedWf && (
            <>
              {/* Flow diagram */}
              {sortedSteps.length > 0 && (
                <div className="card p-4 overflow-x-auto">
                  <div className="flex items-center gap-1 min-w-max">
                    {sortedSteps.map((step, i) => {
                      const fromSt = statusMap[step.from_status_code];
                      const toSt = statusMap[step.to_status_code];
                      const color = STEP_COLORS[i % STEP_COLORS.length];
                      return (
                        <div key={step.id} className="flex items-center gap-1">
                          <div className="flex flex-col items-center px-3 py-2 rounded-lg text-xs text-center min-w-[80px]"
                            style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                            <span className="font-semibold truncate max-w-[80px]" style={{ color }}>{fromSt?.label_en || step.from_status_code}</span>
                            <ArrowRight size={10} className="my-0.5" style={{ color: 'var(--color-text-muted)' }} />
                            <span className="font-semibold truncate max-w-[80px]" style={{ color }}>{toSt?.label_en || step.to_status_code}</span>
                            {step.action_label_en && (
                              <span className="text-[9px] mt-0.5 opacity-70 truncate max-w-[80px]">{step.action_label_en}</span>
                            )}
                          </div>
                          {i < sortedSteps.length - 1 && (
                            <div className="w-4 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h4 className="text-md font-semibold">{t('designer.workflow_steps')}</h4>
                {hasPermission('settings', 'create') && (
                  <button className="btn-primary btn-sm" onClick={addNewStep}>
                    <Plus size={16} /> {t('designer.add_step')}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {sortedSteps.map((step, i) => {
                  const isEditing = editingStepId === step.id;
                  const fromSt = statusMap[step.from_status_code];
                  const toSt = statusMap[step.to_status_code];
                  const color = STEP_COLORS[i % STEP_COLORS.length];

                  if (isEditing) {
                    return (
                      <div key={step.id} className="card border-2" style={{ borderColor: `${color}50` }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="label text-xs">{t('designer.from_status')}</label>
                            <select className="input text-sm" value={stepEdit.from_status_code || ''}
                              onChange={(e) => setStepEdit({ ...stepEdit, from_status_code: e.target.value })}>
                              <option value="">{t('designer.select_default')}</option>
                              {statuses.map((s) => (
                                <option key={s.id} value={s.status_code}>{s.label_en}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">{t('designer.to_status')}</label>
                            <select className="input text-sm" value={stepEdit.to_status_code || ''}
                              onChange={(e) => setStepEdit({ ...stepEdit, to_status_code: e.target.value })}>
                              <option value="">{t('designer.select_default')}</option>
                              {statuses.map((s) => (
                                <option key={s.id} value={s.status_code}>{s.label_en}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">{t('designer.action_label')} EN</label>
                            <input className="input text-sm" value={stepEdit.action_label_en || ''}
                              onChange={(e) => setStepEdit({ ...stepEdit, action_label_en: e.target.value })} />
                          </div>
                          <div>
                            <label className="label text-xs">{t('designer.action_label')} AR</label>
                            <input className="input text-sm" value={stepEdit.action_label_ar || ''}
                              onChange={(e) => setStepEdit({ ...stepEdit, action_label_ar: e.target.value })} />
                          </div>
                          <div>
                            <label className="label text-xs">{t('designer.allowed_roles')}</label>
                            <input className="input text-sm" placeholder="role1, role2"
                              value={(stepEdit.allowed_roles || []).join(',')}
                              onChange={(e) => setStepEdit({ ...stepEdit, allowed_roles: e.target.value.split(',').map(s => s.trim()) })} />
                          </div>
                          <div>
                            <label className="label text-xs">{t('designer.order')}</label>
                            <input type="number" className="input text-sm" value={stepEdit.step_order || 0}
                              onChange={(e) => setStepEdit({ ...stepEdit, step_order: parseInt(e.target.value) || 0 })} />
                          </div>
                          <div>
                            <label className="label text-xs">{t('designer.notify_roles')}</label>
                            <input className="input text-sm" placeholder="role1, role2"
                              value={(stepEdit.notify_roles || []).join(',')}
                              onChange={(e) => setStepEdit({ ...stepEdit, notify_roles: e.target.value.split(',').map(s => s.trim()) })} />
                          </div>
                          <div className="flex items-end gap-3 pb-1">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input type="checkbox" checked={stepEdit.require_attachment || false}
                                onChange={(e) => setStepEdit({ ...stepEdit, require_attachment: e.target.checked })} />
                              <Paperclip size={12} /> {t('designer.require_attachment')}
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input type="checkbox" checked={stepEdit.require_comment || false}
                                onChange={(e) => setStepEdit({ ...stepEdit, require_comment: e.target.checked })} />
                              <MessageSquare size={12} /> {t('designer.require_comment')}
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {hasPermission('settings', 'edit') && (
                            <button className="btn-primary btn-sm" onClick={saveStepEdit}><Save size={14} /> {t('common.save')}</button>
                          )}
                          <button className="btn-secondary btn-sm" onClick={() => setEditingStepId(null)}><X size={14} /> {t('common.cancel')}</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={step.id} className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex flex-col gap-0.5">
                        <button className="btn-xs btn-ghost p-0.5" onClick={() => moveStep(step.id, -1)} disabled={i === 0}><ArrowUp size={12} /></button>
                        <button className="btn-xs btn-ghost p-0.5" onClick={() => moveStep(step.id, 1)} disabled={i === sortedSteps.length - 1}><ArrowDown size={12} /></button>
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                        <span className="badge text-xs shrink-0" style={{ backgroundColor: `${color}20`, color }}>
                          {fromSt?.label_en || step.from_status_code || '?'}
                        </span>
                        <ArrowRight size={14} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="badge text-xs shrink-0" style={{ backgroundColor: `${color}20`, color }}>
                          {toSt?.label_en || step.to_status_code || '?'}
                        </span>
                        {step.action_label_en && (
                          <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{step.action_label_en}</span>
                        )}
                        <div className="flex gap-2 ml-2">
                          {step.require_attachment && <Paperclip size={11} style={{ color: 'var(--color-text-muted)' }} />}
                          {step.require_comment && <MessageSquare size={11} style={{ color: 'var(--color-text-muted)' }} />}
                          {(step.notify_roles || []).length > 0 && <Bell size={11} style={{ color: 'var(--color-text-muted)' }} />}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="btn-xs btn-ghost" onClick={() => startEditStep(step)}><Save size={12} /></button>
                        {hasPermission('settings', 'delete') && <button className="btn-xs btn-ghost text-red-500" onClick={() => removeStep(step.id)}><Trash2 size={12} /></button>}
                      </div>
                    </div>
                  );
                })}
                {steps.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>{t('common.no_data')}</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
