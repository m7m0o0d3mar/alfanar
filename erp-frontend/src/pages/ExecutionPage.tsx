import { useState, useEffect, useMemo } from 'react';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import { type SyncConfig } from '../services/syncService';
import EmptyState from '../components/EmptyState';
import { Plus, Download, Upload, Search, Eye, ExternalLink, Edit3 } from 'lucide-react';
import Pagination from '../components/Pagination';
import { useNavigate } from 'react-router-dom';
import WirFormModal from '../components/execution/WirFormModal';
import TaskFormModal from '../components/execution/TaskFormModal';
import ItemFormModal from '../components/execution/ItemFormModal';
import ProgressTab from '../components/execution/ProgressTab';

export interface WorkRequest {
  id: string; wir_no: string; title_en: string; title_ar: string;
  status: string; is_ncr: boolean; request_date: string;
  location: string; project_id: string; inspection_date: string;
  inspector: string; description: string;
  unit_id: string;
  division: string; sub_division: string; activity: string;
  activity_weight: number; zone: string; block: string;
  qc_engineer_id: string; consultant_engineer_id: string;
  rejection_reason: string;
}

export interface WorkTask {
  id: string; task_code: string; title_en: string; status: string;
  progress: number; assigned_to: string; project_id: string;
  activity_id: string; division: string; sub_division: string;
  activity: string; zone: string; block: string; priority: string;
  target_date: string; actual_completion_date: string; description: string;
  unit_id: string;
}

export interface ItemDefinition {
  id: string; project_id: string; division: string; sub_division: string;
  activity: string; activity_weight: number; wbs_code: string; wbs_description: string;
  booked_budget: number; open_budget: number; budget_rate: number; contingency: number;
  quantity: number; unit_price: number;
  projects?: { name_en: string; project_code: string };
}

export interface Project {
  id: string; name_en: string; project_code: string;
}

interface Activity {
  id: string; code: string; name_en: string;
}

export interface UserProfile {
  id: string; full_name_en: string; role: string;
}

export interface ProgressBreakdownItem {
  division: string; sub_division: string; activity: string;
  wbs_code: string; activity_weight: number;
  units_completed: number; total_units: number;
  progress_percent: number; status: string;
}

interface DivisionSubItem {
  sub_division: string; percent: number;
  items: ProgressBreakdownItem[];
}

interface DivisionBreakdownItem {
  division: string; percent: number;
  subDivisions: DivisionSubItem[];
}

export default function ExecutionPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'wir' | 'tasks' | 'items' | 'progress'>('wir');
  const [wirs, setWirs] = useState<WorkRequest[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [items, setItems] = useState<ItemDefinition[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<{ id: string; project_id: string; activity: string; wbs_code: string; division: string; sub_division: string; activity_weight: number }[]>([]);
  const [units, setUnits] = useState<{ id: string; project_id: string; unit_code: string; unit_type: string; zone: string; block: string }[]>([]);
  const [inspectors, setInspectors] = useState<{ id: string; full_name_en: string }[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showWirForm, setShowWirForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [wirForm, setWirForm] = useState({ project_id: '', wir_no: '', title_en: '', title_ar: '', location: '', status: 'draft', activity_id: '', item_definition_id: '', unit_id: '', inspection_date: '', inspector: '', description: '', division: '', sub_division: '', activity: '', activity_weight: 0, zone: '', block: '', qc_engineer_id: '', consultant_engineer_id: '' });
  const [taskForm, setTaskForm] = useState({ project_id: '', task_code: '', title_en: '', status: 'open', progress: 0, assigned_to: '', activity_id: '', division: '', sub_division: '', activity: '', zone: '', block: '', unit_id: '', priority: 'medium', target_date: '', description: '' });
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ project_id: '', division: '', sub_division: '', activity: '', activity_weight: 0, wbs_code: '', wbs_description: '', booked_budget: 0, open_budget: 0, budget_rate: 0, quantity: 0, unit_price: 0 });
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Cascading dropdown state for WR form
  const [wrDivisions, setWrDivisions] = useState<string[]>([]);
  const [wrSubDivisions, setWrSubDivisions] = useState<string[]>([]);
  const [wrActivities, setWrActivities] = useState<{ id: string; activity: string; activity_weight: number }[]>([]);
  const [wrZones, setWrZones] = useState<string[]>([]);
  const [wrBlocks, setWrBlocks] = useState<string[]>([]);

  // Cascading dropdown state for Task form
  const [taskDivisions, setTaskDivisions] = useState<string[]>([]);
  const [taskSubDivisions, setTaskSubDivisions] = useState<string[]>([]);
  const [taskActivities, setTaskActivities] = useState<{ activity: string; activity_weight: number }[]>([]);
  const [taskZones, setTaskZones] = useState<string[]>([]);
  const [taskBlocks, setTaskBlocks] = useState<string[]>([]);

  // Progress tab state
  const [progressProjectId, setProgressProjectId] = useState('');
  const [progressWrs, setProgressWrs] = useState<WorkRequest[]>([]);

  const FALLBACK_DIVISIONS = ['Civil', 'Electrical', 'Mechanical', 'Architectural', 'Structural', 'Plumbing', 'Fire Protection', 'HVAC', 'Landscaping', 'Interior Finishing'];

  // WR Cascading: Divisions + Zones
  useEffect(() => {
    if (!wirForm.project_id) { setWrDivisions([]); setWrZones([]); return; }
    Promise.resolve(supabase.from('item_definitions').select('division')
      .eq('project_id', wirForm.project_id).not('division', 'is', null)).then(({ data }) => {
        const dbDivs = [...new Set((data || []).map(d => d.division).filter(Boolean))] as string[];
        setWrDivisions(dbDivs.length > 0 ? dbDivs : FALLBACK_DIVISIONS);
      }, () => { setWrDivisions(FALLBACK_DIVISIONS); });
    Promise.resolve(supabase.from('units').select('zone')
      .eq('project_id', wirForm.project_id).not('zone', 'is', null)).then(({ data }) => {
        setWrZones([...new Set((data || []).map(d => d.zone).filter(Boolean))] as string[]);
      }, () => {});
  }, [wirForm.project_id]);

  // WR Cascading: Sub-Divisions
  useEffect(() => {
    if (!wirForm.project_id || !wirForm.division) { setWrSubDivisions([]); setWrActivities([]); return; }
    Promise.resolve(supabase.from('item_definitions').select('sub_division')
      .eq('project_id', wirForm.project_id).eq('division', wirForm.division)
      .not('sub_division', 'is', null)).then(({ data }) => {
        setWrSubDivisions([...new Set((data || []).map(d => d.sub_division).filter(Boolean))] as string[]);
      }, () => {});
  }, [wirForm.project_id, wirForm.division]);

  // WR Cascading: Activities
  useEffect(() => {
    if (!wirForm.project_id || !wirForm.division || !wirForm.sub_division) { setWrActivities([]); return; }
    Promise.resolve(supabase.from('item_definitions').select('id, activity, activity_weight')
      .eq('project_id', wirForm.project_id).eq('division', wirForm.division)
      .eq('sub_division', wirForm.sub_division).not('activity', 'is', null)).then(({ data }) => {
        setWrActivities((data || []) as { id: string; activity: string; activity_weight: number }[]);
      }, () => {});
  }, [wirForm.project_id, wirForm.division, wirForm.sub_division]);

  // WR Cascading: Auto-fill activity_weight from selected activity
  useEffect(() => {
    if (wirForm.activity && wrActivities.length > 0) {
      const match = wrActivities.find(a => a.activity === wirForm.activity);
      if (match) { setWirForm(prev => ({ ...prev, activity_weight: match.activity_weight, item_definition_id: match.id })); return; }
    }
    setWirForm(prev => ({ ...prev, activity_weight: 0, item_definition_id: '' }));
  }, [wirForm.activity, wrActivities]);

  // WR Cascading: Blocks
  useEffect(() => {
    if (!wirForm.project_id || !wirForm.zone) { setWrBlocks([]); return; }
    Promise.resolve(supabase.from('units').select('block').eq('project_id', wirForm.project_id)
      .eq('zone', wirForm.zone).not('block', 'is', null)).then(({ data }) => {
        setWrBlocks([...new Set((data || []).map(d => d.block).filter(Boolean))] as string[]);
      }, () => {});
  }, [wirForm.project_id, wirForm.zone]);

  // Task Cascading: Divisions + Zones
  useEffect(() => {
    if (!taskForm.project_id) { setTaskDivisions([]); setTaskZones([]); return; }
    Promise.resolve(supabase.from('item_definitions').select('division')
      .eq('project_id', taskForm.project_id).not('division', 'is', null)).then(({ data }) => {
        setTaskDivisions([...new Set((data || []).map(d => d.division).filter(Boolean))] as string[]);
      }, () => {});
    Promise.resolve(supabase.from('units').select('zone')
      .eq('project_id', taskForm.project_id).not('zone', 'is', null)).then(({ data }) => {
        setTaskZones([...new Set((data || []).map(d => d.zone).filter(Boolean))] as string[]);
      }, () => {});
  }, [taskForm.project_id]);

  // Task Cascading: Sub-Divisions
  useEffect(() => {
    if (!taskForm.project_id || !taskForm.division) { setTaskSubDivisions([]); setTaskActivities([]); return; }
    Promise.resolve(supabase.from('item_definitions').select('sub_division')
      .eq('project_id', taskForm.project_id).eq('division', taskForm.division)
      .not('sub_division', 'is', null)).then(({ data }) => {
        setTaskSubDivisions([...new Set((data || []).map(d => d.sub_division).filter(Boolean))] as string[]);
      }, () => {});
  }, [taskForm.project_id, taskForm.division]);

  // Task Cascading: Activities
  useEffect(() => {
    if (!taskForm.project_id || !taskForm.division || !taskForm.sub_division) { setTaskActivities([]); return; }
    Promise.resolve(supabase.from('item_definitions').select('activity, activity_weight')
      .eq('project_id', taskForm.project_id).eq('division', taskForm.division)
      .eq('sub_division', taskForm.sub_division).not('activity', 'is', null)).then(({ data }) => {
        setTaskActivities((data || []) as { activity: string; activity_weight: number }[]);
      }, () => {});
  }, [taskForm.project_id, taskForm.division, taskForm.sub_division]);

  // Task Cascading: Blocks
  useEffect(() => {
    if (!taskForm.project_id || !taskForm.zone) { setTaskBlocks([]); return; }
    Promise.resolve(supabase.from('units').select('block').eq('project_id', taskForm.project_id)
      .eq('zone', taskForm.zone).not('block', 'is', null)).then(({ data }) => {
        setTaskBlocks([...new Set((data || []).map(d => d.block).filter(Boolean))] as string[]);
      }, () => {});
  }, [taskForm.project_id, taskForm.zone]);

  // Load progress data when project changes
  useEffect(() => {
    if (activeTab === 'progress' && progressProjectId) {
      loadProgressData();
    }
  }, [activeTab, progressProjectId]);

  useEffect(() => { load(); }, [activeTab]);
  useEffect(() => { setPage(1); }, [activeTab]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function load() {
    setLoading(true);
    try {
      const [wirsRes, tasksRes, itemsRes, projRes, actRes, itemDefRes, unitsRes, inspRes, profRes] = await Promise.all([
        activeTab === 'wir' ? supabase.from('work_requests').select('*').eq('is_ncr', false).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        activeTab === 'tasks' ? supabase.from('work_tasks').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        activeTab === 'items' ? supabase.from('item_definitions').select('*, projects(name_en, project_code)').order('created_at') : Promise.resolve({ data: [] }),
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
        supabase.from('activity_definitions').select('id, code, name_en').eq('is_active', true).order('name_en'),
        supabase.from('item_definitions').select('id, project_id, activity, wbs_code, division, sub_division, activity_weight').order('activity'),
        supabase.from('units').select('id, project_id, unit_code, unit_type, zone, block').order('unit_code'),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
        supabase.from('user_profiles').select('id, full_name_en, role').in('role', ['engineer', 'qc', 'consultant']).order('full_name_en'),
      ]);
      setWirs((wirsRes.data || []) as WorkRequest[]);
      setTasks((tasksRes.data || []) as WorkTask[]);
      setItems((itemsRes.data || []) as ItemDefinition[]);
      setProjects((projRes.data || []) as Project[]);
      setActivities((actRes.data || []) as Activity[]);
      setItemDefinitions((itemDefRes.data || []) as { id: string; project_id: string; activity: string; wbs_code: string; division: string; sub_division: string; activity_weight: number }[]);
      setUnits((unitsRes.data || []) as { id: string; project_id: string; unit_code: string; unit_type: string; zone: string; block: string }[]);
      setInspectors((inspRes.data || []) as { id: string; full_name_en: string }[]);
      setUserProfiles((profRes.data || []) as UserProfile[]);
    } catch (err) {
      console.error('Failed to load execution data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function loadProgressData() {
    if (!progressProjectId) return;
    const { data: wrData } = await supabase.from('work_requests')
      .select('*')
      .eq('project_id', progressProjectId)
      .order('created_at', { ascending: false });
    setProgressWrs((wrData || []) as WorkRequest[]);
  }

  const filteredWirs = wirs.filter((w) => !debouncedSearch || w.wir_no.toLowerCase().includes(debouncedSearch.toLowerCase()) || w.title_en.toLowerCase().includes(debouncedSearch.toLowerCase()));
  const filteredTasks = tasks.filter((t) => !debouncedSearch || t.task_code.toLowerCase().includes(debouncedSearch.toLowerCase()) || t.title_en.toLowerCase().includes(debouncedSearch.toLowerCase()));
  const filteredItems = items.filter((i) => !debouncedSearch || i.wbs_code?.toLowerCase().includes(debouncedSearch.toLowerCase()) || i.division?.toLowerCase().includes(debouncedSearch.toLowerCase()) || i.activity?.toLowerCase().includes(debouncedSearch.toLowerCase()));

  async function saveWir() {
    setFormError('');
    if (!wirForm.project_id) { setFormError('Project is required'); return; }
    if (!wirForm.title_en.trim()) { setFormError('Title is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: wirForm.project_id,
        wir_no: wirForm.wir_no || `WIR-${Date.now().toString(36).toUpperCase()}`,
        title_en: wirForm.title_en,
        title_ar: wirForm.title_ar || null,
        location: wirForm.location || null,
        unit_id: wirForm.unit_id || null,
        status: wirForm.status || 'draft',
        request_date: new Date().toISOString().slice(0, 10),
        inspection_date: wirForm.inspection_date || null,
        inspector: wirForm.inspector || null,
        description: wirForm.description || null,
        division: wirForm.division || null,
        sub_division: wirForm.sub_division || null,
        activity: wirForm.activity || null,
        activity_weight: wirForm.activity_weight || null,
        zone: wirForm.zone || null,
        block: wirForm.block || null,
        qc_engineer_id: wirForm.qc_engineer_id || null,
        consultant_engineer_id: wirForm.consultant_engineer_id || null,
      };
      if (wirForm.activity_id) payload.activity_id = wirForm.activity_id;
      if (wirForm.item_definition_id) payload.item_definition_id = wirForm.item_definition_id;
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) payload.requested_by = user.id;
      } catch (err) {
        console.error('Failed to get current user:', err);
      }
      const { error } = await supabase.from('work_requests').insert(payload);
      if (error) throw error;
      toast.success(`Work Request created`);
      setShowWirForm(false); setWirForm({ project_id: '', wir_no: '', title_en: '', title_ar: '', location: '', status: 'draft', activity_id: '', item_definition_id: '', unit_id: '', inspection_date: '', inspector: '', description: '', division: '', sub_division: '', activity: '', activity_weight: 0, zone: '', block: '', qc_engineer_id: '', consultant_engineer_id: '' }); load();
    } catch (err: unknown) {
      console.error('WIR save error:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveTask() {
    setFormError('');
    if (!taskForm.project_id) { setFormError('Project is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: taskForm.project_id,
        task_code: taskForm.task_code || undefined,
        title_en: taskForm.title_en || taskForm.description,
        status: taskForm.status,
        progress: taskForm.progress,
        assigned_to: taskForm.assigned_to || null,
        activity_id: taskForm.activity_id || null,
        division: taskForm.division || null,
        sub_division: taskForm.sub_division || null,
        activity: taskForm.activity || null,
        zone: taskForm.zone || null,
        block: taskForm.block || null,
        unit_id: taskForm.unit_id || null,
        priority: taskForm.priority || 'medium',
        target_date: taskForm.target_date || null,
        description: taskForm.description || null,
      };
      if (taskForm.status === 'completed') {
        payload.actual_completion_date = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase.from('work_tasks').insert(payload);
      if (error) throw error;
      toast.success(`Task "${taskForm.task_code}" created`);
      setShowTaskForm(false); load();
    } catch (err: unknown) {
      console.error('Task save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveItem() {
    setFormError('');
    if (!itemForm.project_id) { setFormError('Project is required'); return; }
    if (!itemForm.division.trim()) { setFormError('Division is required'); return; }
    if (!itemForm.activity.trim()) { setFormError('Activity is required'); return; }
    setSaving(true);
    try {
      const payload = {
        project_id: itemForm.project_id, division: itemForm.division,
        sub_division: itemForm.sub_division || null, activity: itemForm.activity,
        activity_weight: itemForm.activity_weight || 0, wbs_code: itemForm.wbs_code,
        wbs_description: itemForm.wbs_description || null,
        booked_budget: itemForm.booked_budget || 0, open_budget: itemForm.open_budget || 0,
        budget_rate: itemForm.budget_rate || 0, quantity: itemForm.quantity || 0,
        unit_price: itemForm.unit_price || 0,
      };
      const { error } = editingItemId
        ? await supabase.from('item_definitions').update(payload).eq('id', editingItemId)
        : await supabase.from('item_definitions').insert(payload);
      if (error) throw error;
      toast.success(editingItemId ? 'Item updated' : 'Item created');
      setShowItemForm(false); setEditingItemId(null); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  function handleProgressExport() {
    if (!computedProgress.breakdown?.length) return;
    const data = computedProgress.breakdown.map(item => ({
      Division: item.division,
      'Sub Division': item.sub_division,
      Activity: item.activity,
      WBS: item.wbs_code,
      'Weight %': item.activity_weight,
      'Units Completed': item.units_completed,
      'Total Units': item.total_units,
      'Progress %': item.progress_percent,
      Status: item.status,
    }));
    exportCSV(data, `progress_breakdown_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Progress tab computed data
  const approvedWrs = progressWrs.filter(w => w.status === 'approved');
  const pendingWrs = progressWrs.filter(w => ['pending_qc', 'pending_consultant', 'pending_pm'].includes(w.status));
  const rejectedWrs = progressWrs.filter(w => w.status === 'rejected');

  const computedProgress = useMemo(() => {
    const projectUnits = units.filter(u => u.project_id === progressProjectId);
    const totalProjectUnits = projectUnits.length;
    const projectItems = itemDefinitions.filter(i => i.project_id === progressProjectId);
    const approved = approvedWrs;

    let totalWeighted = 0;
    const breakdown: ProgressBreakdownItem[] = [];

    for (const item of projectItems) {
      const wrForItem = progressWrs.filter(wr => wr.division === item.division && wr.sub_division === item.sub_division && wr.activity === item.activity);
      const approvedForItem = approved.filter(wr => wr.division === item.division && wr.sub_division === item.sub_division && wr.activity === item.activity);
      const uniqueUnitsForItem = [...new Set(wrForItem.map(w => w.unit_id).filter(Boolean))];
      const uniqueApprovedUnits = [...new Set(approvedForItem.map(w => w.unit_id).filter(Boolean))];
      const completedUnits = uniqueApprovedUnits.length;
      const totalUnitsForItem = uniqueUnitsForItem.length || totalProjectUnits;
      const progressFraction = totalUnitsForItem > 0 ? Math.min(1, completedUnits / totalUnitsForItem) : 0;
      const weightedContribution = (item.activity_weight || 0) * progressFraction;
      totalWeighted += weightedContribution;

      breakdown.push({
        division: item.division || '',
        sub_division: item.sub_division || '',
        activity: item.activity || '',
        wbs_code: item.wbs_code || '',
        activity_weight: item.activity_weight || 0,
        units_completed: completedUnits,
        total_units: totalUnitsForItem,
        progress_percent: Math.round(progressFraction * 100),
        status: completedUnits > 0 ? (completedUnits >= totalUnitsForItem ? 'completed' : 'in_progress') : 'not_started',
      });
    }

    const totalWeight = projectItems.reduce((s, i) => s + (i.activity_weight || 0), 0);
    const percent = totalWeight > 0 ? Math.min(100, Math.round((totalWeighted / totalWeight) * 100)) : 0;
    const allUnitIds = [...new Set(progressWrs.map(w => w.unit_id).filter(Boolean))];
    const approvedUnitIds = [...new Set(approved.map(w => w.unit_id).filter(Boolean))];
    const completed = approvedUnitIds.length;
    const total = allUnitIds.length || totalProjectUnits;

    // Division breakdown
    const divMap = new Map<string, ProgressBreakdownItem[]>();
    for (const item of breakdown) {
      const div = item.division || 'Uncategorized';
      if (!divMap.has(div)) divMap.set(div, []);
      divMap.get(div)!.push(item);
    }
    const divisionBreakdown: DivisionBreakdownItem[] = [];
    for (const [division, items] of divMap) {
      const subDivMap = new Map<string, ProgressBreakdownItem[]>();
      for (const item of items) {
        const sub = item.sub_division || 'General';
        if (!subDivMap.has(sub)) subDivMap.set(sub, []);
        subDivMap.get(sub)!.push(item);
      }
      const subDivisions: DivisionSubItem[] = [];
      let divWeight = 0;
      let divCompletedWeight = 0;
      for (const [subDivision, subItems] of subDivMap) {
        const subWeight = subItems.reduce((s, i) => s + i.activity_weight, 0);
        const subCompletedWeight = subItems.reduce((s, i) => s + i.activity_weight * i.progress_percent / 100, 0);
        subDivisions.push({
          sub_division: subDivision,
          percent: subWeight > 0 ? Math.round((subCompletedWeight / subWeight) * 100) : 0,
          items: subItems,
        });
        divWeight += subWeight;
        divCompletedWeight += subCompletedWeight;
      }
      divisionBreakdown.push({
        division,
        percent: divWeight > 0 ? Math.round((divCompletedWeight / divWeight) * 100) : 0,
        subDivisions,
      });
    }

    return { percent, completed, total, breakdown, divisionBreakdown };
  }, [progressWrs, itemDefinitions, units, progressProjectId]);

  const importConfig: SyncConfig = activeTab === 'wir'
    ? {
        table: 'work_requests',
        columns: [
          { key: 'wir_no', label: 'WIR No', required: true },
          { key: 'title_en', label: 'Title (EN)', required: true },
          { key: 'title_ar', label: 'Title (AR)' },
          { key: 'status', label: 'Status' },
          { key: 'location', label: 'Location' },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
        defaults: { is_ncr: false, status: 'draft' },
      }
    : activeTab === 'items'
    ? {
        table: 'item_definitions',
        columns: [
          { key: 'division', label: 'Division', required: true },
          { key: 'sub_division', label: 'Sub-Division' },
          { key: 'activity', label: 'Activity', required: true },
          { key: 'activity_weight', label: 'Activity Weight (%)', type: 'number' as const },
          { key: 'wbs_code', label: 'WBS Code', required: true },
          { key: 'wbs_description', label: 'WBS Description' },
          { key: 'booked_budget', label: 'Booked Budget (SAR)', type: 'number' as const },
          { key: 'open_budget', label: 'Open Budget (SAR)', type: 'number' as const },
          { key: 'budget_rate', label: 'Budget Rate', type: 'number' as const },
          { key: 'quantity', label: 'Quantity', type: 'number' as const },
          { key: 'unit_price', label: 'Unit Price (SAR)', type: 'number' as const },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
      }
    : activeTab === 'tasks'
    ? {
        table: 'work_tasks',
        columns: [
          { key: 'task_code', label: 'Task Code', required: true },
          { key: 'title_en', label: 'Title' },
          { key: 'status', label: 'Status' },
          { key: 'division', label: 'Division' },
          { key: 'activity', label: 'Activity' },
          { key: 'priority', label: 'Priority' },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
        defaults: { status: 'open' },
      }
    : {
        table: 'work_requests',
        columns: [
          { key: 'wir_no', label: 'WIR No', required: true },
          { key: 'division', label: 'Division' },
          { key: 'sub_division', label: 'Sub Division' },
          { key: 'activity', label: 'Activity' },
          { key: 'wbs_code', label: 'WBS' },
          { key: 'activity_weight', label: 'Weight %', type: 'number' as const },
          { key: 'units_completed', label: 'Units Completed', type: 'number' as const },
          { key: 'total_units', label: 'Total Units', type: 'number' as const },
          { key: 'progress_percent', label: 'Progress %', type: 'number' as const },
          { key: 'status', label: 'Status' },
        ],
        uniqueKeys: ['wir_no'],
      };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.execution')}</h1>
          {!loading && <p className="text-gray-500 mt-1">{activeTab === 'wir' ? `${wirs.length} WIRs` : activeTab === 'items' ? `${items.length} Item Definitions` : activeTab === 'tasks' ? `${tasks.length} Tasks` : ''}</p>}
        </div>
        <div className="flex gap-2">
          {activeTab !== 'progress' && (
            <>
              <button className="btn-sm btn-secondary" onClick={() => {
                let data: unknown[];
                if (activeTab === 'wir') data = filteredWirs;
                else if (activeTab === 'items') data = filteredItems.map(i => ({ ...i, project_code: i.projects?.project_code, project_name: i.projects?.name_en }));
                else data = filteredTasks;
                if (data.length) exportCSV(data as unknown as Record<string, unknown>[], `${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
              }}><Download size={14} /> {t('admin.export_csv')}</button>
              <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> {t('admin.import_csv')}</button>
            </>
          )}
          {activeTab === 'wir' ? (
            <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setWirForm({ project_id: '', wir_no: '', title_en: '', title_ar: '', location: '', status: 'draft', activity_id: '', item_definition_id: '', unit_id: '', inspection_date: '', inspector: '', description: '', division: '', sub_division: '', activity: '', activity_weight: 0, zone: '', block: '', qc_engineer_id: '', consultant_engineer_id: '' }); setShowWirForm(true); }}><Plus size={16} /> {t('execution.new_wir')}</button>
          ) : activeTab === 'items' ? (
            <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setEditingItemId(null); setItemForm({ project_id: '', division: '', sub_division: '', activity: '', activity_weight: 0, wbs_code: '', wbs_description: '', booked_budget: 0, open_budget: 0, budget_rate: 0, quantity: 0, unit_price: 0 }); setShowItemForm(true); }}><Plus size={16} /> New Item</button>
          ) : activeTab === 'tasks' ? (
            <button className="btn-primary btn-sm" onClick={() => { setFormError(''); setTaskForm({ project_id: '', task_code: '', title_en: '', status: 'open', progress: 0, assigned_to: '', activity_id: '', division: '', sub_division: '', activity: '', zone: '', block: '', unit_id: '', priority: 'medium', target_date: '', description: '' }); setShowTaskForm(true); }}><Plus size={16} /> {t('execution.new_task')}</button>
          ) : null}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'wir' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('wir')}>Work Requests</button>
        <button className={`tab ${activeTab === 'tasks' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('tasks')}>Work Tasks</button>
        <button className={`tab ${activeTab === 'items' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('items')}>Item Definitions</button>
        <button className={`tab ${activeTab === 'progress' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('progress')}>Progress</button>
      </div>

      {activeTab !== 'progress' && (
        <div className="relative max-w-sm">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {activeTab === 'progress' ? (
        <ProgressTab
          projects={projects}
          progressProjectId={progressProjectId}
          onProjectChange={(id) => { setProgressProjectId(id); }}
          computedProgress={computedProgress}
          units={units}
          progressWrs={progressWrs}
          approvedWrs={approvedWrs}
          pendingWrs={pendingWrs}
          rejectedWrs={rejectedWrs}
          onExport={handleProgressExport}
          onImport={() => setShowImport(true)}
          onNavigateWir={(id) => navigate(`/execution/wir/${id}`)}
        />
      ) : (
        /* ===== TABLE VIEW (WIR / TASKS / ITEMS) ===== */
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {activeTab === 'wir' ? (
                    <><th>WR No</th><th>Item Definition</th><th>Activity</th><th>Division</th><th>Unit</th><th>Status</th><th>QC Engineer</th><th>Consultant</th><th>{t('common.actions')}</th></>
                  ) : activeTab === 'items' ? (
                    <><th>Project</th><th>Division</th><th>Sub-Division</th><th>Activity</th><th>Wt%</th><th>WBS Code</th><th>WBS Description</th><th>Booked Budget</th><th>Open Budget</th><th>Rate</th><th>Contingency</th><th>Qty</th><th>Unit Price</th><th>{t('common.actions')}</th></>
                  ) : (
                    <><th>Task No</th><th>Project</th><th>Activity</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Target Date</th><th>Actual Date</th><th>{t('common.actions')}</th></>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={99} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
                ) : activeTab === 'wir' && filteredWirs.length === 0 ? (
                  <EmptyState title="No WIRs found" description="Create a Work Inspection Request to start tracking inspections." actionLabel={t('execution.new_wir')} onAction={() => { setFormError(''); setWirForm({ project_id: '', wir_no: '', title_en: '', title_ar: '', location: '', status: 'draft', activity_id: '', item_definition_id: '', unit_id: '', inspection_date: '', inspector: '', description: '', division: '', sub_division: '', activity: '', activity_weight: 0, zone: '', block: '', qc_engineer_id: '', consultant_engineer_id: '' }); setShowWirForm(true); }} />
                ) : activeTab === 'tasks' && filteredTasks.length === 0 ? (
                  <EmptyState title="No Tasks found" description="Create a Work Task to start tracking project activities." actionLabel={t('execution.new_task')} onAction={() => { setFormError(''); setTaskForm({ project_id: '', task_code: '', title_en: '', status: 'open', progress: 0, assigned_to: '', activity_id: '', division: '', sub_division: '', activity: '', zone: '', block: '', unit_id: '', priority: 'medium', target_date: '', description: '' }); setShowTaskForm(true); }} />
                ) : activeTab === 'items' && filteredItems.length === 0 ? (
                  <EmptyState title="No Item Definitions found" description="Create an Item Definition to start tracking project items." actionLabel="New Item" onAction={() => { setFormError(''); setEditingItemId(null); setItemForm({ project_id: '', division: '', sub_division: '', activity: '', activity_weight: 0, wbs_code: '', wbs_description: '', booked_budget: 0, open_budget: 0, budget_rate: 0, quantity: 0, unit_price: 0 }); setShowItemForm(true); }} />
                ) : activeTab === 'wir' ? (
                  filteredWirs.slice((page - 1) * pageSize, page * pageSize).map((w) => (
                    <tr key={w.id} className="clickable" onClick={() => navigate(`/execution/wir/${w.id}`)}>
                      <td className="font-mono text-xs">{w.wir_no}</td>
                      <td className="text-sm text-gray-600">{w.activity || '-'}</td>
                      <td className="text-sm text-gray-600">{w.sub_division || '-'}</td>
                      <td className="text-sm text-gray-600">{w.division || '-'}</td>
                      <td className="text-sm text-gray-600">{w.unit_id ? (units.find(u => u.id === w.unit_id)?.unit_code || '-') : '-'}</td>
                      <td><span className={`badge capitalize ${w.status === 'approved' ? 'badge-success' : w.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{w.status}</span></td>
                      <td className="text-sm">{w.qc_engineer_id ? (inspectors.find(i => i.id === w.qc_engineer_id)?.full_name_en || '-') : '-'}</td>
                      <td className="text-sm">{w.consultant_engineer_id ? (inspectors.find(i => i.id === w.consultant_engineer_id)?.full_name_en || '-') : '-'}</td>
                      <td><button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); navigate(`/execution/wir/${w.id}`); }}><Eye size={14} /></button></td>
                    </tr>
                  ))
                ) : activeTab === 'items' ? (
                  filteredItems.slice((page - 1) * pageSize, page * pageSize).map((i) => (
                    <tr key={i.id}>
                      <td className="text-sm">{i.projects ? `${i.projects.project_code} - ${i.projects.name_en}` : '-'}</td>
                      <td>{i.division}</td>
                      <td className="text-sm text-gray-500">{i.sub_division || '-'}</td>
                      <td>{i.activity}</td>
                      <td className="text-sm">{i.activity_weight}%</td>
                      <td className="font-mono text-xs">{i.wbs_code}</td>
                      <td className="text-sm text-gray-500 max-w-[150px] truncate">{i.wbs_description || '-'}</td>
                      <td className="text-sm text-right">{i.booked_budget?.toLocaleString()}</td>
                      <td className="text-sm text-right">{i.open_budget?.toLocaleString()}</td>
                      <td className="text-sm text-right">{i.budget_rate?.toLocaleString()}</td>
                      <td className="text-sm text-right text-gray-400">{i.contingency?.toLocaleString()}</td>
                      <td className="text-sm text-right">{i.quantity}</td>
                      <td className="text-sm text-right">{i.unit_price?.toLocaleString()}</td>
                      <td>
                        <button className="btn-sm btn-secondary" onClick={() => { setFormError(''); setEditingItemId(i.id); setItemForm({ project_id: i.project_id, division: i.division, sub_division: i.sub_division || '', activity: i.activity, activity_weight: i.activity_weight, wbs_code: i.wbs_code, wbs_description: i.wbs_description || '', booked_budget: i.booked_budget, open_budget: i.open_budget, budget_rate: i.budget_rate, quantity: i.quantity, unit_price: i.unit_price }); setShowItemForm(true); }}><Edit3 size={14} /></button>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredTasks.slice((page - 1) * pageSize, page * pageSize).map((t) => (
                    <tr key={t.id} className="clickable" onClick={() => navigate(`/execution/tasks/${t.id}`)}>
                      <td className="font-mono text-xs">{t.task_code}</td>
                      <td className="text-sm text-gray-600">{projects.find(p => p.id === t.project_id)?.name_en || t.project_id?.slice(0, 8) || '-'}</td>
                      <td className="text-sm text-gray-600">{t.activity || '-'}</td>
                      <td className="text-sm text-gray-500">{t.assigned_to ? (inspectors.find(i => i.id === t.assigned_to)?.full_name_en || '-') : '-'}</td>
                      <td><span className={`badge text-xs capitalize ${t.priority === 'high' ? 'badge-danger' : t.priority === 'low' ? 'badge-neutral' : 'badge-info'}`}>{t.priority || 'medium'}</span></td>
                      <td><span className={`badge capitalize ${t.status === 'completed' ? 'badge-success' : 'badge-info'}`}>{t.status}</span></td>
                      <td className="text-sm text-gray-500">{t.target_date || '-'}</td>
                      <td className="text-sm text-gray-500">{t.actual_completion_date || '-'}</td>
                      <td><button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); navigate(`/execution/tasks/${t.id}`); }}><ExternalLink size={14} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={activeTab === 'wir' ? filteredWirs.length : activeTab === 'items' ? filteredItems.length : filteredTasks.length} onChange={setPage} />
        </div>
      )}

      <WirFormModal
        show={showWirForm}
        projects={projects}
        wrDivisions={wrDivisions}
        wrSubDivisions={wrSubDivisions}
        wrActivities={wrActivities}
        wrZones={wrZones}
        wrBlocks={wrBlocks}
        units={units}
        inspectors={inspectors}
        userProfiles={userProfiles}
        wirForm={wirForm}
        formError={formError}
        saving={saving}
        onSave={saveWir}
        onClose={() => setShowWirForm(false)}
        onChange={(form) => setWirForm(form)}
      />

      <TaskFormModal
        show={showTaskForm}
        projects={projects}
        taskDivisions={taskDivisions}
        taskSubDivisions={taskSubDivisions}
        taskActivities={taskActivities}
        taskZones={taskZones}
        taskBlocks={taskBlocks}
        units={units}
        userProfiles={userProfiles}
        taskForm={taskForm}
        formError={formError}
        saving={saving}
        onSave={saveTask}
        onClose={() => setShowTaskForm(false)}
        onChange={(form) => setTaskForm(form)}
      />

      <ItemFormModal
        show={showItemForm}
        projects={projects}
        itemForm={itemForm}
        formError={formError}
        saving={saving}
        editingItemId={editingItemId}
        onSave={saveItem}
        onClose={() => { setShowItemForm(false); setEditingItemId(null); }}
        onChange={(form) => setItemForm(form)}
      />

      {showImport && <CsvImportModal
        moduleName={activeTab}
        config={importConfig}
        onClose={() => { setShowImport(false); if (activeTab === 'progress') { loadProgressData(); } else { load(); } }}
      />}
    </div>
  );
}
