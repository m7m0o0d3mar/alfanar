import { useState, useEffect } from 'react';
import { workflowsApi, statusesApi, modulesApi } from '../../services/api';
import type { WorkflowDefinition, WorkflowStep, StatusDefinition, Module } from '../../types';
import { useT } from '../../hooks/useTranslation';
import { Plus, Edit3, Trash2, ArrowRight } from 'lucide-react';

export default function WorkflowsTab() {
  const t = useT();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWf, setSelectedWf] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [showWfForm, setShowWfForm] = useState(false);
  const [showStepForm, setShowStepForm] = useState(false);
  const [wfEdit, setWfEdit] = useState<Partial<WorkflowDefinition>>({});
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
    await workflowsApi.upsert({ ...wfEdit, module_code: selectedModule });
    setShowWfForm(false);
    setWfEdit({});
    setWorkflows(await workflowsApi.list(selectedModule));
  }

  async function saveStep() {
    await workflowsApi.upsertStep({ ...stepEdit, workflow_id: selectedWf });
    setShowStepForm(false);
    setStepEdit({});
    setSteps(await workflowsApi.getSteps(selectedWf));
  }

  async function removeStep(id: string) {
    await workflowsApi.removeStep(id);
    setSteps(await workflowsApi.getSteps(selectedWf));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('designer.workflows')}</h3>
        <select className="input w-auto" value={selectedModule}
          onChange={(e) => { setSelectedModule(e.target.value); setSelectedWf(''); }}>
          <option value="">-- Select Module --</option>
          {modules.map((m) => (
            <option key={m.code} value={m.code}>{m.name_en}</option>
          ))}
        </select>
      </div>

      {selectedModule && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {workflows.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No workflows defined yet. Create your first workflow below.</p>
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
            <button className="btn-primary btn-sm" onClick={() => { setWfEdit({}); setShowWfForm(true); }}>
              <Plus size={16} /> {t('designer.add_workflow')}
            </button>
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
                <button className="btn-primary btn-sm" onClick={saveWf}>{t('common.save')}</button>
                <button className="btn-secondary btn-sm" onClick={() => setShowWfForm(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {selectedWf && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-semibold">Workflow Steps</h4>
                <button className="btn-primary btn-sm" onClick={() => { setStepEdit({}); setShowStepForm(true); }}>
                  <Plus size={16} /> {t('designer.add_step')}
                </button>
              </div>

              {showStepForm && (
                <div className="card border-2 border-amber-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="label">{t('designer.from_status')}</label>
                      <select className="input" value={stepEdit.from_status_code || ''}
                        onChange={(e) => setStepEdit({ ...stepEdit, from_status_code: e.target.value })}>
                        <option value="">-- Select --</option>
                        {statuses.map((s) => (
                          <option key={s.id} value={s.status_code}>{s.label_en}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('designer.to_status')}</label>
                      <select className="input" value={stepEdit.to_status_code || ''}
                        onChange={(e) => setStepEdit({ ...stepEdit, to_status_code: e.target.value })}>
                        <option value="">-- Select --</option>
                        {statuses.map((s) => (
                          <option key={s.id} value={s.status_code}>{s.label_en}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('designer.action_label')} EN</label>
                      <input className="input" value={stepEdit.action_label_en || ''}
                        onChange={(e) => setStepEdit({ ...stepEdit, action_label_en: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">{t('designer.action_label')} AR</label>
                      <input className="input" value={stepEdit.action_label_ar || ''}
                        onChange={(e) => setStepEdit({ ...stepEdit, action_label_ar: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">{t('designer.allowed_roles')}</label>
                      <input className="input" placeholder="role1,role2"
                        value={(stepEdit.allowed_roles || []).join(',')}
                        onChange={(e) => setStepEdit({ ...stepEdit, allowed_roles: e.target.value.split(',').map(s => s.trim()) })} />
                    </div>
                    <div>
                      <label className="label">{t('designer.order')}</label>
                      <input type="number" className="input" value={stepEdit.step_order || 0}
                        onChange={(e) => setStepEdit({ ...stepEdit, step_order: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="btn-primary btn-sm" onClick={saveStep}>{t('common.save')}</button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowStepForm(false)}>{t('common.cancel')}</button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {steps.map((step) => (
                  <div key={step.id} className="card p-4 min-w-[200px]">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="badge bg-blue-100 text-blue-700">{step.from_status_code}</span>
                      <ArrowRight size={16} className="text-gray-400" />
                      <span className="badge bg-green-100 text-green-700">{step.to_status_code}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{step.action_label_en}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Roles: {(step.allowed_roles || []).join(', ')}
                    </p>
                    <button className="btn-sm btn-danger mt-2" onClick={() => removeStep(step.id)}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                ))}
                {steps.length === 0 && (
                  <p className="text-sm text-gray-400 py-4">{t('common.no_data')}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
