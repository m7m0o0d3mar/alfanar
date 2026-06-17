import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import {
  CalendarRange, Plus, Save, Download, Link2, BarChart3,
  Layers, GitBranch, AlertTriangle, Clock, Users,
} from 'lucide-react';
import type { ScheduleTask, TaskDependency, ScheduleFilter, WBSNode, Project, Resource, TaskResource, Baseline } from '../types';
import GanttChart from '../components/timeline/GanttChart';
import TimelineFilter from '../components/timeline/TimelineFilter';

export default function TimelinePage() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'gantt' | 'resources' | 'dependencies'>('gantt');

  // Raw data
  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<{ id: string; project_id: string; phase_code: string; name_en: string; name_ar?: string; start_date?: string; end_date?: string; progress_percent?: number; status?: string; "order"?: number }[]>([]);
  const [wbsNodes, setWbsNodes] = useState<WBSNode[]>([]);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [taskResources, setTaskResources] = useState<TaskResource[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>([]);

  // Filter state
  const [filter, setFilter] = useState<ScheduleFilter>({
    scale: 'week',
    level: 'task',
  });

  // Form state
  const [showDepModal, setShowDepModal] = useState(false);
  const [depForm, setDepForm] = useState<{ predecessor_id: string; successor_id: string; dependency_type: 'FS' | 'SS' | 'FF' | 'SF'; lag_days: number }>({ predecessor_id: '', successor_id: '', dependency_type: 'FS', lag_days: 0 });
  const [saving, setSaving] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineName, setBaselineName] = useState('');
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [baselines, setBaselines] = useState<Baseline[]>([]);

  useEffect(() => {
    loadAll();
    loadBaselines();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [
        { data: projs },
        { data: phs },
        { data: wbs },
        { data: tks },
        { data: deps },
        { data: res },
        { data: tres },
        { data: users },
      ] = await Promise.all([
        supabase.from('projects').select('id, name_en, start_date, end_date, progress_percent, status, project_code').eq('is_active', true).order('name_en'),
        supabase.from('project_phases').select('*').order('order'),
        supabase.from('work_breakdown_structure').select('*').order('level, wbs_code'),
        supabase.from('work_tasks').select('*').order('start_date nulls last, created_at'),
        supabase.from('task_dependencies').select('*'),
        supabase.from('resources').select('*').eq('is_active', true),
        supabase.from('task_resources').select('*, resource:resources(*)'),
        supabase.from('user_profiles').select('id, full_name_en'),
      ]);

      setProjects(projs || []);
      setPhases(phs || []);
      setWbsNodes(wbs || []);
      setTasks(tks || []);
      setDependencies(deps || []);
      setResources(res || []);
      setTaskResources(tres || []);
      setAssignees((users || []).map((u: { id: string; full_name_en: string }) => ({ id: u.id, name: u.full_name_en })));
    } catch (err) {
      console.error('Failed to load scheduling data', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadBaselines() {
    const { data } = await supabase.from('baselines').select('*').order('baseline_no', { ascending: false });
    setBaselines(data || []);
  }

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filter.project_id) result = result.filter(t => t.project_id === filter.project_id);
    if (filter.status && filter.status.length > 0) result = result.filter(t => filter.status!.includes(t.status));
    if (filter.priority && filter.priority.length > 0) result = result.filter(t => filter.priority!.includes(t.priority));
    if (filter.assigned_to && filter.assigned_to.length > 0) result = result.filter(t => t.assigned_to && filter.assigned_to!.includes(t.assigned_to));
    if (filter.is_critical) result = result.filter(t => t.is_critical);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(t =>
        t.task_code?.toLowerCase().includes(q) ||
        t.title_en?.toLowerCase().includes(q) ||
        t.division?.toLowerCase().includes(q) ||
        t.activity?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, filter]);

  const filteredDeps = useMemo(() => {
    if (!filter.project_id) return dependencies;
    return dependencies.filter(d => d.project_id === filter.project_id);
  }, [dependencies, filter.project_id]);

  // Save dependency
  async function saveDependency() {
    if (!depForm.predecessor_id || !depForm.successor_id) return;
    setSaving(true);
    const pred = tasks.find(t => t.id === depForm.predecessor_id);
    const projId = pred?.project_id;
    if (!projId) { setSaving(false); return; }

    const { error } = await supabase.from('task_dependencies').insert({
      project_id: projId,
      predecessor_id: depForm.predecessor_id,
      successor_id: depForm.successor_id,
      dependency_type: depForm.dependency_type,
      lag_days: depForm.lag_days,
    });
    if (!error) {
      setShowDepModal(false);
      setDepForm({ predecessor_id: '', successor_id: '', dependency_type: 'FS', lag_days: 0 });
      loadAll();
    }
    setSaving(false);
  }

  // Delete dependency
  async function deleteDependency(id: string) {
    await supabase.from('task_dependencies').delete().eq('id', id);
    loadAll();
  }

  // Save baseline
  async function saveBaseline() {
    if (!baselineName.trim() || !filter.project_id) return;
    setSavingBaseline(true);
    await supabase.rpc('save_baseline', {
      p_project_id: filter.project_id,
      p_name: baselineName.trim(),
      p_user_id: null,
    });
    setShowBaselineModal(false);
    setBaselineName('');
    loadBaselines();
    setSavingBaseline(false);
  }

  // Run CPM
  async function runCPM() {
    if (!filter.project_id) return;
    setLoading(true);
    await supabase.rpc('calculate_cpm', { p_project_id: filter.project_id });
    await loadAll();
  }

  // Update task from Gantt drag
  async function handleUpdateTask(taskId: string, updates: Partial<ScheduleTask>) {
    const { error } = await supabase.from('work_tasks').update(updates).eq('id', taskId);
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } as ScheduleTask : t));
    } else {
      console.error('Failed to update task', error);
    }
  }

  // Export CSV
  const exportCSV = () => {
    const headers = ['Task Code', 'Title', 'Start', 'End', 'Duration', 'Progress', 'Status', 'Priority', 'Float', 'Critical', 'Assignee'];
    const rows = filteredTasks.map(t => [
      t.task_code, t.title_en,
      t.start_date ? new Date(t.start_date).toLocaleDateString() : '',
      t.end_date ? new Date(t.end_date).toLocaleDateString() : '',
      t.duration_days ?? '', t.progress, t.status, t.priority || '',
      t.total_float ?? '', t.is_critical ? 'Yes' : 'No',
      t.assignee_name || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Resource summary
  const resourceSummary = useMemo(() => {
    const summary: Record<string, { allocated: number; cost: number; tasks: number }> = {};
    for (const tr of taskResources) {
      const resName = tr.resource?.name_en || tr.resource_id;
      if (!summary[resName]) summary[resName] = { allocated: 0, cost: 0, tasks: 0 };
      summary[resName].allocated += Number(tr.allocated_units) || 0;
      summary[resName].cost += Number(tr.total_cost) || 0;
      summary[resName].tasks += 1;
    }
    return summary;
  }, [taskResources]);

  if (loading) {
    return (
      <div className="page-enter flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Schedule Planner</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Primavera-style project scheduling with CPM, WBS, resources & baselines
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filter.project_id && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={runCPM}>
                <GitBranch size={14} /> Calculate CPM
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBaselineModal(true)}>
                <Save size={14} /> Save Baseline
              </button>
            </>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowDepModal(true)}>
            <Link2 size={14} /> Add Dependency
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="tabs">
        <button className={`tab ${activeView === 'gantt' ? 'tab-active' : ''}`} onClick={() => setActiveView('gantt')}>
          <BarChart3 size={16} /> Gantt
        </button>
        <button className={`tab ${activeView === 'dependencies' ? 'tab-active' : ''}`} onClick={() => setActiveView('dependencies')}>
          <GitBranch size={16} /> Dependencies
        </button>
        <button className={`tab ${activeView === 'resources' ? 'tab-active' : ''}`} onClick={() => setActiveView('resources')}>
          <Users size={16} /> Resources
        </button>
      </div>

      {/* Filter */}
      <TimelineFilter
        filter={filter}
        onChange={setFilter}
        projects={projects}
        assignees={assignees}
      />

      {/* ===== GANTT VIEW ===== */}
      {activeView === 'gantt' && (
        <>
          {filteredTasks.length === 0 ? (
            <div className="empty-state py-16">
              <CalendarRange size={48} className="empty-state-icon" />
              <p className="empty-state-title">No tasks match your filters</p>
              <p className="empty-state-desc">Try adjusting the filter or create new tasks in Execution</p>
            </div>
          ) : (
            <GanttChart
              projects={projects}
              phases={phases}
              wbsNodes={wbsNodes}
              tasks={filteredTasks}
              dependencies={filteredDeps}
              filter={filter}
              onUpdateTask={handleUpdateTask}
            />
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="stat-glass">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Tasks</span>
              </div>
              <p className="text-2xl font-bold mt-1">{filteredTasks.length}</p>
            </div>
            <div className="stat-glass">
              <div className="flex items-center gap-2">
                <CheckCircleIcon />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Completed</span>
              </div>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>{filteredTasks.filter(t => t.status === 'completed').length}</p>
            </div>
            <div className="stat-glass">
              <div className="flex items-center gap-2">
                <Clock size={16} style={{ color: 'var(--color-warning)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>In Progress</span>
              </div>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-warning)' }}>{filteredTasks.filter(t => t.status === 'in_progress').length}</p>
            </div>
            <div className="stat-glass">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Critical</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-500">{filteredTasks.filter(t => t.is_critical).length}</p>
            </div>
            <div className="stat-glass">
              <div className="flex items-center gap-2">
                <Layers size={16} style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Dependencies</span>
              </div>
              <p className="text-2xl font-bold mt-1">{filteredDeps.length}</p>
            </div>
          </div>

          {/* Baselines */}
          {baselines.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3">Baselines</h3>
              <div className="flex flex-wrap gap-2">
                {baselines.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: b.is_active ? 'var(--color-primary-10, rgba(59,130,246,0.1))' : 'var(--color-surface-hover, rgba(255,255,255,0.03))',
                      color: b.is_active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <Save size={12} />
                    {b.name}
                    {b.is_active && <span className="ml-1 text-[10px] opacity-70">(active)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== DEPENDENCIES VIEW ===== */}
      {activeView === 'dependencies' && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Task Dependencies</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowDepModal(true)}>
              <Link2 size={14} /> Add Dependency
            </button>
          </div>
          {filteredDeps.length === 0 ? (
            <div className="empty-state py-12">
              <GitBranch size={32} className="empty-state-icon" />
              <p className="empty-state-title">No dependencies defined</p>
              <p className="empty-state-desc">Add dependencies to model task relationships and run CPM</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Predecessor</th>
                    <th>Successor</th>
                    <th>Type</th>
                    <th>Lag (days)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeps.map((dep) => {
                    const pred = tasks.find(t => t.id === dep.predecessor_id);
                    const succ = tasks.find(t => t.id === dep.successor_id);
                    return (
                      <tr key={dep.id}>
                        <td className="text-xs">{pred ? `${pred.task_code} - ${pred.title_en}` : dep.predecessor_id}</td>
                        <td className="text-xs">{succ ? `${succ.task_code} - ${succ.title_en}` : dep.successor_id}</td>
                        <td>
                          <span className="badge badge-info text-xs">{dep.dependency_type}</span>
                        </td>
                        <td className="text-xs">{dep.lag_days}</td>
                        <td>
                          <button className="btn btn-sm btn-secondary text-xs" onClick={() => deleteDependency(dep.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== RESOURCES VIEW ===== */}
      {activeView === 'resources' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Resource Allocation</h3>
            {taskResources.length === 0 ? (
              <div className="empty-state py-12">
                <Users size={32} className="empty-state-icon" />
                <p className="empty-state-title">No resources assigned</p>
                <p className="empty-state-desc">Assign resources to tasks from the Resources page</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Type</th>
                      <th>Task</th>
                      <th>Units</th>
                      <th>Unit Price</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskResources.map((tr) => {
                      const task = tasks.find(t => t.id === tr.task_id);
                      return (
                        <tr key={tr.id}>
                          <td className="text-xs font-medium">{tr.resource?.name_en || tr.resource_id}</td>
                          <td className="text-xs">{tr.resource?.resource_type || '-'}</td>
                          <td className="text-xs">{task?.task_code || '-'}</td>
                          <td className="text-xs">{tr.allocated_units}</td>
                          <td className="text-xs">{tr.unit_price?.toLocaleString() || '-'} {tr.resource?.currency || 'SAR'}</td>
                          <td className="text-xs font-medium">{Number(tr.total_cost)?.toLocaleString() || '-'} {tr.resource?.currency || 'SAR'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resource summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Resource Summary</h3>
            {Object.keys(resourceSummary).length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No resources loaded</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(resourceSummary).map(([name, data]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate">{name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{data.tasks} tasks</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--color-text-muted)' }}>{data.allocated} units</span>
                      <span className="font-medium">{data.cost.toLocaleString()} SAR</span>
                    </div>
                    <div className="w-full h-1 rounded-full mt-1" style={{ background: 'var(--color-border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, data.allocated)}%`, background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total Cost</span>
                    <span>{Object.values(resourceSummary).reduce((s, r) => s + r.cost, 0).toLocaleString()} SAR</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Add Dependency Modal ===== */}
      {showDepModal && (
        <div className="modal-overlay" onClick={() => setShowDepModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Task Dependency</h2>
            <div className="space-y-4 mt-4">
              <div>
                <label className="label">Predecessor Task</label>
                <select
                  className="input"
                  value={depForm.predecessor_id}
                  onChange={(e) => setDepForm({ ...depForm, predecessor_id: e.target.value })}
                >
                  <option value="">Select predecessor...</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.task_code} - {t.title_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Successor Task</label>
                <select
                  className="input"
                  value={depForm.successor_id}
                  onChange={(e) => setDepForm({ ...depForm, successor_id: e.target.value })}
                >
                  <option value="">Select successor...</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.task_code} - {t.title_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Dependency Type</label>
                <div className="flex gap-2 mt-1">
                  {(['FS', 'SS', 'FF', 'SF'] as const).map((type) => (
                    <button
                      key={type}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        depForm.dependency_type === type ? 'bg-primary/20 text-primary' : 'hover:bg-white/5'
                      }`}
                      style={{
                        color: depForm.dependency_type === type ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        background: depForm.dependency_type === type ? 'var(--color-primary-10, rgba(59,130,246,0.1))' : undefined,
                      }}
                      onClick={() => setDepForm({ ...depForm, dependency_type: type })}
                    >
                      {type === 'FS' ? 'Finish → Start' : type === 'SS' ? 'Start → Start' : type === 'FF' ? 'Finish → Finish' : 'Start → Finish'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Lag Days (optional)</label>
                <input
                  type="number"
                  className="input"
                  value={depForm.lag_days}
                  onChange={(e) => setDepForm({ ...depForm, lag_days: Number(e.target.value) })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn btn-secondary" onClick={() => setShowDepModal(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={saveDependency}
                  disabled={saving || !depForm.predecessor_id || !depForm.successor_id}
                >
                  {saving ? 'Saving...' : 'Add Dependency'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Save Baseline Modal ===== */}
      {showBaselineModal && (
        <div className="modal-overlay" onClick={() => setShowBaselineModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Save Baseline</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Snapshot current schedule dates for comparison
            </p>
            <div className="space-y-4 mt-4">
              <div>
                <label className="label">Baseline Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Baseline 1 - Initial Schedule"
                  value={baselineName}
                  onChange={(e) => setBaselineName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn btn-secondary" onClick={() => setShowBaselineModal(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={saveBaseline}
                  disabled={savingBaseline || !baselineName.trim()}
                >
                  {savingBaseline ? 'Saving...' : 'Save Baseline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-success)' }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
