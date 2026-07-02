import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Users, Building2, Target, Phone, ClipboardList, Plus, Search, Eye, Download, Upload, LayoutGrid, Table2, X, Check, Trash2, TrendingUp, DollarSign, TicketCheck, MessageCircle, Send, Smartphone, Image, Paperclip } from 'lucide-react';
import FilePreviewModal from '../components/FilePreviewModal';
import CsvImportModal from '../components/CsvImportModal';
import type { SyncConfig } from '../services/syncService';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportCSV } from '../utils/csv';

interface CRMContact {
  id: string; first_name: string; last_name: string; email?: string; phone?: string; mobile?: string;
  position?: string; company_id?: string; company_name?: string; source?: string; tags?: string[];
  notes?: string; assigned_to?: string; assigned_name?: string; is_active: boolean; created_at: string;
}
interface CRMCompany {
  id: string; company_name: string; trading_name?: string; registration_number?: string; vat_number?: string;
  phone?: string; email?: string; industry?: string; company_size?: string; source?: string; tags?: string[];
  notes?: string; assigned_to?: string; assigned_name?: string; is_active: boolean; created_at: string;
}
interface CRMDeal {
  id: string; deal_name: string; company_id?: string; company_name?: string; contact_id?: string;
  contact_name?: string; pipeline_stage_id: string; stage_name?: string; stage_color?: string;
  stage_order?: number; amount: number; probability?: number; expected_close_date?: string;
  assigned_to?: string; assigned_name?: string; is_won: boolean; is_lost: boolean; created_at: string;
}
interface CRMPipelineStage {
  id: string; name_en: string; name_ar: string; sort_order: number; color: string; probability: number;
}
interface CRMInteraction {
  id: string; interaction_type: string; subject: string; description?: string; contact_id?: string;
  contact_name?: string; company_id?: string; company_name?: string; deal_id?: string;
  interaction_date: string; duration_minutes?: number; direction?: string; outcome?: string;
  follow_up_date?: string; created_by?: string; created_by_name?: string;
}
interface CRMTask {
  id: string; task_type: string; subject: string; description?: string; contact_id?: string;
  contact_name?: string; company_id?: string; company_name?: string; deal_id?: string;
  due_date?: string; priority: string; status: string; assigned_to?: string; assigned_name?: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(amount);
}

const TABS = [
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'deals', label: 'Deals', icon: Target },
  { key: 'interactions', label: 'Interactions', icon: Phone },
  { key: 'tasks', label: 'Tasks', icon: ClipboardList },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const INTERACTION_TYPES = ['call', 'email', 'meeting', 'site_visit', 'note'];
const TASK_TYPES = ['call', 'email', 'meeting', 'follow_up', 'reminder', 'other'];
const PRIORITIES = ['low', 'medium', 'high'];
const DIRECTIONS = ['inbound', 'outbound'];
const INDUSTRIES = ['Construction', 'Real Estate', 'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Energy', 'Hospitality', 'Transportation', 'Other'];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const SOURCES = ['website', 'referral', 'social_media', 'cold_call', 'email_campaign', 'trade_show', 'partner', 'other'];

const typeColors: Record<string, string> = {
  call: 'badge-info', email: 'badge-success', meeting: 'bg-purple-100 text-purple-800',
  site_visit: 'bg-orange-100 text-orange-800', note: 'badge-neutral',
};
const priorityColors: Record<string, string> = {
  high: 'badge-danger', medium: 'badge-warning', low: 'badge-success',
};
const statusColors: Record<string, string> = {
  pending: 'badge-warning', completed: 'badge-success', cancelled: 'badge-danger',
};

const defaultContactForm = { first_name: '', last_name: '', email: '', phone: '', mobile: '', position: '', company_id: '', source: '', tags: '', notes: '', assigned_to: '', project_id: '', is_active: true };
const defaultCompanyForm = { company_name: '', trading_name: '', registration_number: '', vat_number: '', phone: '', email: '', website: '', industry: '', company_size: '', source: '', tags: '', notes: '', assigned_to: '', project_id: '', is_active: true };
const defaultDealForm = { deal_name: '', company_id: '', contact_id: '', pipeline_stage_id: '', amount: '', probability: '', expected_close_date: '', assigned_to: '', project_id: '', description: '' };
const defaultInteractionForm = { interaction_type: 'call', subject: '', description: '', contact_id: '', company_id: '', deal_id: '', project_id: '', interaction_date: new Date().toISOString().slice(0, 10), duration_minutes: '', direction: 'inbound', outcome: '', follow_up_date: '', follow_up_notes: '' };
const defaultTaskForm = { task_type: 'other', subject: '', description: '', contact_id: '', company_id: '', deal_id: '', project_id: '', due_date: '', priority: 'medium', status: 'pending', assigned_to: '' };

export default function CRMPage() {
  const t = useT();
  const toast = useToast();
  const { user, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState('contacts');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [companies, setCompanies] = useState<CRMCompany[]>([]);
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [stages, setStages] = useState<CRMPipelineStage[]>([]);
  const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name_en: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; project_code: string; name_en: string }[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [pipelineKpis, setPipelineKpis] = useState<{ label: string; value: string; color: string; icon: any }[]>([]);
  const [leadScores, setLeadScores] = useState<Record<string, string>>({});
  const [waMessages, setWaMessages] = useState<any[]>([]);
  const [waContacts, setWaContacts] = useState<{ phone: string; contactName: string; contactId?: string }[]>([]);
  const [waSendForm, setWaSendForm] = useState({ phone: '', message: '', project_id: '' });
  const [waSending, setWaSending] = useState(false);
  const [waPreviewFile, setWaPreviewFile] = useState<{ url: string; fileName: string; mimeType?: string } | null>(null);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);
  const [dealView, setDealView] = useState<'kanban' | 'list'>('kanban');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [contactForm, setContactForm] = useState(defaultContactForm);
  const [companyForm, setCompanyForm] = useState(defaultCompanyForm);
  const [dealForm, setDealForm] = useState(defaultDealForm);
  const [interactionForm, setInteractionForm] = useState(defaultInteractionForm);
  const [taskForm, setTaskForm] = useState(defaultTaskForm);
  const [deleting, setDeleting] = useState<{ table: string; id: string; label: string } | null>(null);
  const [dragDealId, setDragDealId] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { setPage(1); }, [activeTab]);

  async function loadAll() {
    setLoading(true);
    try {
      const [cRes, compRes, dRes, sRes, iRes, tRes, uRes, kpiRes, lsRes, waRes, projRes] = await Promise.all([
        supabase.from('crm_contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('crm_companies').select('*').order('created_at', { ascending: false }),
        supabase.from('crm_deals').select('*').order('created_at', { ascending: false }),
        supabase.from('crm_pipeline_stages').select('*').order('sort_order'),
        supabase.from('crm_interactions').select('*').order('interaction_date', { ascending: false }),
        supabase.from('crm_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
        supabase.from('v_crm_sales_kpis').select('*').single(),
        supabase.from('crm_lead_scores').select('contact_id, score'),
        supabase.from('crm_whatsapp_messages').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('projects').select('id, project_code, name_en').eq('is_active', true).order('project_code'),
      ]);
      setContacts((cRes.data || []) as CRMContact[]);
      setCompanies((compRes.data || []) as CRMCompany[]);
      setDeals((dRes.data || []) as CRMDeal[]);
      setStages((sRes.data || []) as CRMPipelineStage[]);
      setInteractions((iRes.data || []) as CRMInteraction[]);
      setTasks((tRes.data || []) as CRMTask[]);
      setUsers((uRes.data || []) as { id: string; full_name_en: string }[]);
      setProjects((projRes.data || []) as { id: string; project_code: string; name_en: string }[]);

      if (kpiRes.data) {
        const s: any = kpiRes.data;
        setPipelineKpis([
          { label: 'Pipeline Value', value: formatCurrency(s.pipeline_value), color: '#3b82f6', icon: DollarSign },
          { label: 'Win Rate', value: `${s.win_rate}%`, color: '#22c55e', icon: TrendingUp },
          { label: 'Open Deals', value: String(s.open_deals), color: '#f59e0b', icon: Target },
          { label: 'Total Tickets', value: String(s.total_tickets), color: '#8b5cf6', icon: TicketCheck },
        ]);
      }
      const scoreMap: Record<string, string> = {};
      (lsRes.data || []).forEach((ls: any) => {
        const sc = ls.score;
        scoreMap[ls.contact_id] = sc >= 80 ? 'hot' : sc >= 50 ? 'warm' : sc >= 20 ? 'cool' : 'cold';
      });
      setLeadScores(scoreMap);

      const waData = (waRes.data || []) as any[];
      setWaMessages(waData);
      const phoneSet = new Set<string>();
      const phoneToContact: Record<string, { name: string; id: string }> = {};
      (cRes.data || []).forEach((c: any) => {
        if (c.phone) { phoneSet.add(c.phone); phoneToContact[c.phone] = { name: c.full_name || c.full_name_en || c.email || 'Unknown', id: c.id }; }
      });
      setWaContacts(Array.from(phoneSet).map(p => ({ phone: p, contactName: phoneToContact[p]?.name || p, contactId: phoneToContact[p]?.id })));
    } catch (err) {
      console.error('Failed to load CRM data:', err);
      toast.error('Failed to load CRM data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(table: string, id: string) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
    setDeleting(null);
  }

  function resolveUser(id?: string): string {
    if (!id) return '-';
    return users.find(u => u.id === id)?.full_name_en || id;
  }

  function resolveCompany(id?: string): string {
    if (!id) return '-';
    return companies.find(c => c.id === id)?.company_name || id;
  }

  function resolveContact(id?: string): string {
    if (!id) return '-';
    const c = contacts.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : id;
  }

  const searchLower = search.toLowerCase();
  const projectFilter = (item: any) => !filterProject || item.project_id === filterProject;
  const filteredContacts = contacts.filter(c =>
    projectFilter(c) && (!search || `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(searchLower))
  );
  const filteredCompanies = companies.filter(c =>
    projectFilter(c) && (!search || `${c.company_name} ${c.trading_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(searchLower))
  );
  const filteredDeals = deals.filter(d =>
    projectFilter(d) && (!search || `${d.deal_name} ${d.company_name || ''} ${d.contact_name || ''}`.toLowerCase().includes(searchLower))
  );
  const filteredInteractions = interactions.filter(i =>
    projectFilter(i) && (!search || `${i.subject} ${i.contact_name || ''} ${i.company_name || ''}`.toLowerCase().includes(searchLower))
  );
  const filteredTasks = tasks.filter(t =>
    projectFilter(t) && (!search || `${t.subject} ${t.contact_name || ''} ${t.company_name || ''}`.toLowerCase().includes(searchLower))
  );

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.project_code]));

  async function saveContact() {
    setFormError('');
    if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) { setFormError('First and last name are required'); return; }
    setSaving(true);
    try {
      const payload = { ...contactForm, tags: contactForm.tags ? contactForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      const { error } = await supabase.from('crm_contacts').insert(payload);
      if (error) throw error;
      toast.success('Contact created');
      setShowForm(false); setContactForm(defaultContactForm); loadAll();
    } catch (err: unknown) {
      console.error('Contact save failed:', err);
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function saveCompany() {
    setFormError('');
    if (!companyForm.company_name.trim()) { setFormError('Company name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...companyForm, tags: companyForm.tags ? companyForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      const { error } = await supabase.from('crm_companies').insert(payload);
      if (error) throw error;
      toast.success('Company created');
      setShowForm(false); setCompanyForm(defaultCompanyForm); loadAll();
    } catch (err: unknown) {
      console.error('Company save failed:', err);
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function saveDeal() {
    setFormError('');
    if (!dealForm.deal_name.trim()) { setFormError('Deal name is required'); return; }
    if (!dealForm.pipeline_stage_id) { setFormError('Pipeline stage is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        deal_name: dealForm.deal_name,
        company_id: dealForm.company_id || null,
        contact_id: dealForm.contact_id || null,
        pipeline_stage_id: dealForm.pipeline_stage_id,
        amount: dealForm.amount ? parseFloat(dealForm.amount) : 0,
        probability: dealForm.probability ? parseInt(dealForm.probability) : null,
        expected_close_date: dealForm.expected_close_date || null,
        assigned_to: dealForm.assigned_to || null,
        notes: dealForm.description || null,
      };
      const { error } = await supabase.from('crm_deals').insert(payload);
      if (error) throw error;
      toast.success('Deal created');
      setShowForm(false); setDealForm(defaultDealForm); loadAll();
    } catch (err: unknown) {
      console.error('Deal save failed:', err);
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function saveInteraction() {
    setFormError('');
    if (!interactionForm.subject.trim()) { setFormError('Subject is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        interaction_type: interactionForm.interaction_type,
        subject: interactionForm.subject,
        description: interactionForm.description || null,
        contact_id: interactionForm.contact_id || null,
        company_id: interactionForm.company_id || null,
        deal_id: interactionForm.deal_id || null,
        interaction_date: interactionForm.interaction_date,
        duration_minutes: interactionForm.duration_minutes ? parseInt(interactionForm.duration_minutes) : null,
        direction: interactionForm.direction || null,
        outcome: interactionForm.outcome || null,
        follow_up_date: interactionForm.follow_up_date || null,
        created_by: user?.id || null,
      };
      const { error } = await supabase.from('crm_interactions').insert(payload);
      if (error) throw error;
      toast.success('Interaction created');
      setShowForm(false); setInteractionForm(defaultInteractionForm); loadAll();
    } catch (err: unknown) {
      console.error('Interaction save failed:', err);
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function saveTask() {
    setFormError('');
    if (!taskForm.subject.trim()) { setFormError('Subject is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        task_type: taskForm.task_type,
        subject: taskForm.subject,
        description: taskForm.description || null,
        contact_id: taskForm.contact_id || null,
        company_id: taskForm.company_id || null,
        deal_id: taskForm.deal_id || null,
        due_date: taskForm.due_date || null,
        priority: taskForm.priority,
        status: taskForm.status,
        assigned_to: taskForm.assigned_to || null,
      };
      const { error } = await supabase.from('crm_tasks').insert(payload);
      if (error) throw error;
      toast.success('Task created');
      setShowForm(false); setTaskForm(defaultTaskForm); loadAll();
    } catch (err: unknown) {
      console.error('Task save failed:', err);
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function markDealWon(dealId: string) {
    try {
      await supabase.from('crm_deals').update({ is_won: true, is_lost: false, actual_close_date: new Date().toISOString().slice(0, 10) }).eq('id', dealId);
      toast.success('Deal marked as won');
      setDetailItem(null); loadAll();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Update failed'); }
  }

  async function markDealLost(dealId: string) {
    try {
      await supabase.from('crm_deals').update({ is_lost: true, is_won: false, actual_close_date: new Date().toISOString().slice(0, 10) }).eq('id', dealId);
      toast.success('Deal marked as lost');
      setDetailItem(null); loadAll();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Update failed'); }
  }

  async function markTaskComplete(task: CRMTask) {
    try {
      const { error } = await supabase.from('crm_tasks').update({ status: 'completed' }).eq('id', task.id);
      if (error) throw error;
      toast.success('Task marked complete');
      loadAll();
    } catch (err: unknown) {
      console.error('Task update failed:', err);
    }
  }

  function openCreateModal() {
    setFormError('');
    if (activeTab === 'contacts') setContactForm(defaultContactForm);
    else if (activeTab === 'companies') setCompanyForm(defaultCompanyForm);
    else if (activeTab === 'deals') setDealForm(defaultDealForm);
    else if (activeTab === 'interactions') setInteractionForm(defaultInteractionForm);
    else if (activeTab === 'tasks') setTaskForm(defaultTaskForm);
    setShowForm(true);
  }

  function stageName(stageId: string): string {
    return stages.find(s => s.id === stageId)?.name_en || stageId;
  }

  function stageColor(stageId: string): string {
    return stages.find(s => s.id === stageId)?.color || '#6b7280';
  }

  function formatDate(date?: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderContactsSection() {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'company_name', label: 'Company' },
      { key: 'position', label: 'Position' },
      { key: 'project', label: 'Project' },
      { key: 'score', label: 'Lead Score' },
      { key: 'tags', label: 'Tags' },
      { key: 'assigned', label: 'Assigned To' },
      { key: 'status', label: 'Status' },
    ];
    return (
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map(c => <th key={c.key}>{c.label}</th>)}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filteredContacts.length === 0 ? (
                <tr><td colSpan={99}><EmptyState title="No contacts found" description="Create your first contact to get started." actionLabel="Add Contact" onAction={openCreateModal} /></td></tr>
              ) : (
                filteredContacts.slice((page - 1) * pageSize, page * pageSize).map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setDetailItem(c as unknown as Record<string, unknown>)}>
                    <td className="text-sm font-medium">{c.first_name} {c.last_name}</td>
                    <td className="text-sm">{c.email || '-'}</td>
                    <td className="text-sm">{c.phone || '-'}</td>
                    <td className="text-sm">{c.company_name || resolveCompany(c.company_id)}</td>
                    <td className="text-sm">{c.position || '-'}</td>
                    <td className="text-xs">{projectMap[(c as any).project_id || ''] || '-'}</td>
                    <td className="text-sm">
                      {leadScores[c.id] ? (
                        <span className={`badge ${
                          leadScores[c.id] === 'hot' ? 'badge-danger' :
                          leadScores[c.id] === 'warm' ? 'badge-warning' :
                          leadScores[c.id] === 'cool' ? 'badge-info' : 'badge-neutral'
                        }`}>{leadScores[c.id]}</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>-</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {c.tags && Array.isArray(c.tags) ? c.tags.map((tag, i) => <span key={i} className="badge mr-1">{tag}</span>) : '-'}
                    </td>
                    <td className="text-sm">{resolveUser(c.assigned_to)}</td>
                    <td className="text-sm"><span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDetailItem(c as unknown as Record<string, unknown>); }}><Eye size={14} /></button>
                      {hasPermission('crm', 'delete') && (
                        <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'crm_contacts', id: c.id, label: `${c.first_name} ${c.last_name}` }); }}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredContacts.length} onChange={setPage} />
      </div>
    );
  }

  function renderCompaniesSection() {
    const columns = [
      { key: 'company_name', label: 'Company Name' },
      { key: 'trading_name', label: 'Trading Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'industry', label: 'Industry' },
      { key: 'company_size', label: 'Size' },
      { key: 'project', label: 'Project' },
      { key: 'tags', label: 'Tags' },
      { key: 'assigned', label: 'Assigned To' },
      { key: 'status', label: 'Status' },
    ];
    return (
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map(c => <th key={c.key}>{c.label}</th>)}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filteredCompanies.length === 0 ? (
                <tr><td colSpan={99}><EmptyState title="No companies found" description="Create your first company to get started." actionLabel="Add Company" onAction={openCreateModal} /></td></tr>
              ) : (
                filteredCompanies.slice((page - 1) * pageSize, page * pageSize).map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setDetailItem(c as unknown as Record<string, unknown>)}>
                    <td className="text-sm font-medium">{c.company_name}</td>
                    <td className="text-sm">{c.trading_name || '-'}</td>
                    <td className="text-sm">{c.phone || '-'}</td>
                    <td className="text-sm">{c.email || '-'}</td>
                    <td className="text-sm">{c.industry || '-'}</td>
                    <td className="text-sm">{c.company_size || '-'}</td>
                    <td className="text-xs">{projectMap[(c as any).project_id || ''] || '-'}</td>
                    <td className="text-sm">
                      {c.tags && Array.isArray(c.tags) ? c.tags.map((tag, i) => <span key={i} className="badge mr-1">{tag}</span>) : '-'}
                    </td>
                    <td className="text-sm">{resolveUser(c.assigned_to)}</td>
                    <td className="text-sm"><span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDetailItem(c as unknown as Record<string, unknown>); }}><Eye size={14} /></button>
                      {hasPermission('crm', 'delete') && (
                        <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'crm_companies', id: c.id, label: c.company_name }); }}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredCompanies.length} onChange={setPage} />
      </div>
    );
  }

  async function handleDragDrop(dealId: string, targetStageId: string) {
    try {
      await supabase.from('crm_deals').update({ pipeline_stage_id: targetStageId }).eq('id', dealId);
      toast.success('Deal moved');
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Move failed');
    }
    setDragDealId(null);
  }

  function renderDealsKanban() {
    if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;
    if (stages.length === 0) return <div className="text-center py-8 text-gray-400">No pipeline stages configured.</div>;

    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageDeals = filteredDeals.filter(d => d.pipeline_stage_id === stage.id && !d.is_won && !d.is_lost);
          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-72"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('dealId');
                if (id && dragDealId === id) handleDragDrop(id, stage.id);
              }}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-semibold text-sm text-gray-700">{stage.name_en}</span>
                <span className="text-xs text-gray-400 ml-auto">{stageDeals.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px] rounded-lg p-1 transition-colors" style={dragDealId ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' } : {}}>
                {stageDeals.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-lg">No deals</div>
                ) : (
                  stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => {
                        setDragDealId(deal.id);
                        e.dataTransfer.setData('dealId', deal.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragDealId(null)}
                      className="card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      style={dragDealId === deal.id ? { opacity: 0.4 } : {}}
                      onClick={() => setDetailItem(deal as unknown as Record<string, unknown>)}
                    >
                      <div className="font-medium text-sm text-gray-900 mb-1">{deal.deal_name}</div>
                      {deal.company_name && <div className="text-xs text-gray-500 mb-1">{deal.company_name}</div>}
                      <div className="text-sm font-bold text-gray-800 mb-2">{formatCurrency(deal.amount)}</div>
                      {deal.probability != null && (
                        <div className="w-full rounded-full h-1.5 mb-2" style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)'}}>
                          <div className="h-1.5 rounded-full" style={{ width: `${deal.probability}%`, backgroundColor: 'var(--color-primary)' }} />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{deal.probability != null ? `${deal.probability}%` : '-'}</span>
                        <span>{deal.expected_close_date ? formatDate(deal.expected_close_date) : '-'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{resolveUser(deal.assigned_to)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderDealsList() {
    const columns = [
      { key: 'deal_name', label: 'Deal Name' },
      { key: 'company', label: 'Company' },
      { key: 'stage', label: 'Stage' },
      { key: 'project', label: 'Project' },
      { key: 'amount', label: 'Amount' },
      { key: 'probability', label: 'Probability' },
      { key: 'close_date', label: 'Close Date' },
      { key: 'assigned', label: 'Assigned To' },
      { key: 'status', label: 'Status' },
    ];
    return (
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map(c => <th key={c.key}>{c.label}</th>)}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filteredDeals.length === 0 ? (
                <tr><td colSpan={99}><EmptyState title="No deals found" description="Create your first deal to get started." actionLabel="Add Deal" onAction={openCreateModal} /></td></tr>
              ) : (
                filteredDeals.slice((page - 1) * pageSize, page * pageSize).map((d) => (
                  <tr key={d.id} className="clickable" onClick={() => setDetailItem(d as unknown as Record<string, unknown>)}>
                    <td className="text-sm font-medium">{d.deal_name}</td>
                    <td className="text-sm">{d.company_name || resolveCompany(d.company_id)}</td>
                    <td className="text-sm">
                      <span className="badge" style={{ backgroundColor: stageColor(d.pipeline_stage_id) + '20', color: stageColor(d.pipeline_stage_id) }}>
                        {stageName(d.pipeline_stage_id)}
                      </span>
                    </td>
                    <td className="text-xs">{projectMap[(d as any).project_id || ''] || '-'}</td>
                    <td className="text-sm">{formatCurrency(d.amount)}</td>
                    <td className="text-sm">{d.probability != null ? `${d.probability}%` : '-'}</td>
                    <td className="text-sm">{d.expected_close_date ? formatDate(d.expected_close_date) : '-'}</td>
                    <td className="text-sm">{resolveUser(d.assigned_to)}</td>
                    <td className="text-sm">
                      {d.is_won ? <span className="badge badge-success">Won</span> :
                       d.is_lost ? <span className="badge badge-danger">Lost</span> :
                       <span className="badge badge-info">Open</span>}
                    </td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDetailItem(d as unknown as Record<string, unknown>); }}><Eye size={14} /></button>
                      {hasPermission('crm', 'delete') && (
                        <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'crm_deals', id: d.id, label: d.deal_name }); }}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredDeals.length} onChange={setPage} />
      </div>
    );
  }

  function renderInteractionsSection() {
    const columns = [
      { key: 'type', label: 'Type' },
      { key: 'subject', label: 'Subject' },
      { key: 'contact', label: 'Contact' },
      { key: 'company', label: 'Company' },
      { key: 'project', label: 'Project' },
      { key: 'date', label: 'Date' },
      { key: 'duration', label: 'Duration' },
      { key: 'direction', label: 'Direction' },
      { key: 'outcome', label: 'Outcome' },
      { key: 'follow_up', label: 'Follow-up' },
      { key: 'created_by', label: 'Created By' },
    ];
    return (
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map(c => <th key={c.key}>{c.label}</th>)}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filteredInteractions.length === 0 ? (
                <tr><td colSpan={99}><EmptyState title="No interactions found" description="Log your first interaction." actionLabel="Add Interaction" onAction={openCreateModal} /></td></tr>
              ) : (
                filteredInteractions.slice((page - 1) * pageSize, page * pageSize).map((i) => (
                  <tr key={i.id} className="clickable" onClick={() => setDetailItem(i as unknown as Record<string, unknown>)}>
                    <td className="text-sm"><span className={`badge ${typeColors[i.interaction_type] || 'badge-neutral'}`}>{i.interaction_type}</span></td>
                    <td className="text-sm font-medium">{i.subject}</td>
                    <td className="text-sm">{i.contact_name || resolveContact(i.contact_id)}</td>
                    <td className="text-sm">{i.company_name || resolveCompany(i.company_id)}</td>
                    <td className="text-xs">{projectMap[(i as any).project_id || ''] || '-'}</td>
                    <td className="text-sm">{formatDate(i.interaction_date)}</td>
                    <td className="text-sm">{i.duration_minutes ? `${i.duration_minutes}m` : '-'}</td>
                    <td className="text-sm">{i.direction ? <span className={`badge ${i.direction === 'inbound' ? 'bg-sky-100 text-sky-800' : 'badge-warning'}`}>{i.direction}</span> : '-'}</td>
                    <td className="text-sm">{i.outcome || '-'}</td>
                    <td className="text-sm">{i.follow_up_date ? formatDate(i.follow_up_date) : '-'}</td>
                    <td className="text-sm">{i.created_by_name || resolveUser(i.created_by)}</td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDetailItem(i as unknown as Record<string, unknown>); }}><Eye size={14} /></button>
                      {hasPermission('crm', 'delete') && (
                        <button className="btn-sm btn-secondary ml-1" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'crm_interactions', id: i.id, label: i.subject }); }}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredInteractions.length} onChange={setPage} />
      </div>
    );
  }

  function renderTasksSection() {
    const columns = [
      { key: 'type', label: 'Type' },
      { key: 'subject', label: 'Subject' },
      { key: 'contact', label: 'Contact' },
      { key: 'company', label: 'Company' },
      { key: 'project', label: 'Project' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'assigned', label: 'Assigned To' },
    ];
    return (
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map(c => <th key={c.key}>{c.label}</th>)}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filteredTasks.length === 0 ? (
                <tr><td colSpan={99}><EmptyState title="No tasks found" description="Create your first task." actionLabel="Add Task" onAction={openCreateModal} /></td></tr>
              ) : (
                filteredTasks.slice((page - 1) * pageSize, page * pageSize).map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => setDetailItem(t as unknown as Record<string, unknown>)}>
                    <td className="text-sm"><span className={`badge ${typeColors[t.task_type] || 'badge-neutral'}`}>{t.task_type}</span></td>
                    <td className="text-sm font-medium">{t.subject}</td>
                    <td className="text-sm">{t.contact_name || resolveContact(t.contact_id)}</td>
                    <td className="text-sm">{t.company_name || resolveCompany(t.company_id)}</td>
                    <td className="text-xs">{projectMap[(t as any).project_id || ''] || '-'}</td>
                    <td className="text-sm">{t.due_date ? formatDate(t.due_date) : '-'}</td>
                    <td className="text-sm"><span className={`badge ${priorityColors[t.priority] || 'badge-neutral'}`}>{t.priority}</span></td>
                    <td className="text-sm"><span className={`badge ${statusColors[t.status] || 'badge-neutral'}`}>{t.status}</span></td>
                    <td className="text-sm">{resolveUser(t.assigned_to)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDetailItem(t as unknown as Record<string, unknown>); }}><Eye size={14} /></button>
                        {t.status === 'pending' && (
                          <button className="btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); markTaskComplete(t); }}><Check size={14} /></button>
                        )}
                        {hasPermission('crm', 'delete') && (
                          <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); setDeleting({ table: 'crm_tasks', id: t.id, label: t.subject }); }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredTasks.length} onChange={setPage} />
      </div>
    );
  }

  function renderCreateEditModal() {
    return (
      <div className="modal-overlay" onClick={() => setShowForm(false)}>
        <div className="modal max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4 capitalize">New {activeTab === 'deals' ? 'Deal' : activeTab === 'interactions' ? 'Interaction' : activeTab === 'tasks' ? 'Task' : activeTab.slice(0, -1)}</h3>
          {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}

          {activeTab === 'contacts' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">First Name *</label><input className="input" value={contactForm.first_name} onChange={e => setContactForm({ ...contactForm, first_name: e.target.value })} /></div>
              <div><label className="label">Last Name *</label><input className="input" value={contactForm.last_name} onChange={e => setContactForm({ ...contactForm, last_name: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} /></div>
              <div><label className="label">Mobile</label><input className="input" value={contactForm.mobile} onChange={e => setContactForm({ ...contactForm, mobile: e.target.value })} /></div>
              <div><label className="label">Position</label><input className="input" value={contactForm.position} onChange={e => setContactForm({ ...contactForm, position: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Company</label>
                <select className="input" value={contactForm.company_id} onChange={e => setContactForm({ ...contactForm, company_id: e.target.value })}>
                  <option value="">-- Select Company --</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div><label className="label">Source</label>
                <select className="input" value={contactForm.source} onChange={e => setContactForm({ ...contactForm, source: e.target.value })}>
                  <option value="">-- Select --</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Tags (comma-separated)</label><input className="input" value={contactForm.tags} onChange={e => setContactForm({ ...contactForm, tags: e.target.value })} placeholder="tag1, tag2" /></div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={3} value={contactForm.notes} onChange={e => setContactForm({ ...contactForm, notes: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Project</label>
                <select className="input" value={contactForm.project_id} onChange={e => setContactForm({ ...contactForm, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Assigned To</label>
                <select className="input" value={contactForm.assigned_to} onChange={e => setContactForm({ ...contactForm, assigned_to: e.target.value })}>
                  <option value="">-- Select --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={contactForm.is_active} onChange={e => setContactForm({ ...contactForm, is_active: e.target.checked })} className="w-4 h-4" />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Company Name *</label><input className="input" value={companyForm.company_name} onChange={e => setCompanyForm({ ...companyForm, company_name: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Trading Name</label><input className="input" value={companyForm.trading_name} onChange={e => setCompanyForm({ ...companyForm, trading_name: e.target.value })} /></div>
              <div><label className="label">Registration Number</label><input className="input" value={companyForm.registration_number} onChange={e => setCompanyForm({ ...companyForm, registration_number: e.target.value })} /></div>
              <div><label className="label">VAT Number</label><input className="input" value={companyForm.vat_number} onChange={e => setCompanyForm({ ...companyForm, vat_number: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Website</label><input className="input" value={companyForm.website} onChange={e => setCompanyForm({ ...companyForm, website: e.target.value })} /></div>
              <div><label className="label">Industry</label>
                <select className="input" value={companyForm.industry} onChange={e => setCompanyForm({ ...companyForm, industry: e.target.value })}>
                  <option value="">-- Select --</option>
                  {INDUSTRIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Company Size</label>
                <select className="input" value={companyForm.company_size} onChange={e => setCompanyForm({ ...companyForm, company_size: e.target.value })}>
                  <option value="">-- Select --</option>
                  {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Source</label>
                <select className="input" value={companyForm.source} onChange={e => setCompanyForm({ ...companyForm, source: e.target.value })}>
                  <option value="">-- Select --</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Tags (comma-separated)</label><input className="input" value={companyForm.tags} onChange={e => setCompanyForm({ ...companyForm, tags: e.target.value })} placeholder="tag1, tag2" /></div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={3} value={companyForm.notes} onChange={e => setCompanyForm({ ...companyForm, notes: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Project</label>
                <select className="input" value={companyForm.project_id} onChange={e => setCompanyForm({ ...companyForm, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Assigned To</label>
                <select className="input" value={companyForm.assigned_to} onChange={e => setCompanyForm({ ...companyForm, assigned_to: e.target.value })}>
                  <option value="">-- Select --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={companyForm.is_active} onChange={e => setCompanyForm({ ...companyForm, is_active: e.target.checked })} className="w-4 h-4" />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'deals' && (
            <div className="space-y-4">
              <div><label className="label">Deal Name *</label><input className="input" value={dealForm.deal_name} onChange={e => setDealForm({ ...dealForm, deal_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Company</label>
                  <select className="input" value={dealForm.company_id} onChange={e => setDealForm({ ...dealForm, company_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div><label className="label">Contact</label>
                  <select className="input" value={dealForm.contact_id} onChange={e => setDealForm({ ...dealForm, contact_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Pipeline Stage *</label>
                <select className="input" value={dealForm.pipeline_stage_id} onChange={e => setDealForm({ ...dealForm, pipeline_stage_id: e.target.value })}>
                  <option value="">-- Select Stage --</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Amount (SAR)</label><input type="number" className="input" value={dealForm.amount} onChange={e => setDealForm({ ...dealForm, amount: e.target.value })} /></div>
                <div><label className="label">Probability (%)</label><input type="number" min="0" max="100" className="input" value={dealForm.probability} onChange={e => setDealForm({ ...dealForm, probability: e.target.value })} /></div>
              </div>
              <div><label className="label">Expected Close Date</label><input type="date" className="input" value={dealForm.expected_close_date} onChange={e => setDealForm({ ...dealForm, expected_close_date: e.target.value })} /></div>
              <div><label className="label">Assigned To</label>
                <select className="input" value={dealForm.assigned_to} onChange={e => setDealForm({ ...dealForm, assigned_to: e.target.value })}>
                  <option value="">-- Select --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={dealForm.project_id} onChange={e => setDealForm({ ...dealForm, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={dealForm.description} onChange={e => setDealForm({ ...dealForm, description: e.target.value })} /></div>
            </div>
          )}

          {activeTab === 'interactions' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Type</label>
                  <select className="input" value={interactionForm.interaction_type} onChange={e => setInteractionForm({ ...interactionForm, interaction_type: e.target.value })}>
                    {INTERACTION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Direction</label>
                  <select className="input" value={interactionForm.direction} onChange={e => setInteractionForm({ ...interactionForm, direction: e.target.value })}>
                    <option value="">-- Select --</option>
                    {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Subject *</label><input className="input" value={interactionForm.subject} onChange={e => setInteractionForm({ ...interactionForm, subject: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={interactionForm.description} onChange={e => setInteractionForm({ ...interactionForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Contact</label>
                  <select className="input" value={interactionForm.contact_id} onChange={e => setInteractionForm({ ...interactionForm, contact_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div><label className="label">Company</label>
                  <select className="input" value={interactionForm.company_id} onChange={e => setInteractionForm({ ...interactionForm, company_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Deal (optional)</label>
                <select className="input" value={interactionForm.deal_id} onChange={e => setInteractionForm({ ...interactionForm, deal_id: e.target.value })}>
                  <option value="">-- Select --</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.deal_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Interaction Date</label><input type="date" className="input" value={interactionForm.interaction_date} onChange={e => setInteractionForm({ ...interactionForm, interaction_date: e.target.value })} /></div>
                <div><label className="label">Duration (minutes)</label><input type="number" className="input" value={interactionForm.duration_minutes} onChange={e => setInteractionForm({ ...interactionForm, duration_minutes: e.target.value })} /></div>
              </div>
              <div><label className="label">Outcome</label><input className="input" value={interactionForm.outcome} onChange={e => setInteractionForm({ ...interactionForm, outcome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Follow-up Date</label><input type="date" className="input" value={interactionForm.follow_up_date} onChange={e => setInteractionForm({ ...interactionForm, follow_up_date: e.target.value })} /></div>
                <div><label className="label">Follow-up Notes</label><input className="input" value={interactionForm.follow_up_notes} onChange={e => setInteractionForm({ ...interactionForm, follow_up_notes: e.target.value })} /></div>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={interactionForm.project_id} onChange={e => setInteractionForm({ ...interactionForm, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Task Type</label>
                  <select className="input" value={taskForm.task_type} onChange={e => setTaskForm({ ...taskForm, task_type: e.target.value })}>
                    {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Priority</label>
                  <select className="input" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Subject *</label><input className="input" value={taskForm.subject} onChange={e => setTaskForm({ ...taskForm, subject: e.target.value })} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Contact</label>
                  <select className="input" value={taskForm.contact_id} onChange={e => setTaskForm({ ...taskForm, contact_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div><label className="label">Company</label>
                  <select className="input" value={taskForm.company_id} onChange={e => setTaskForm({ ...taskForm, company_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Deal (optional)</label>
                <select className="input" value={taskForm.deal_id} onChange={e => setTaskForm({ ...taskForm, deal_id: e.target.value })}>
                  <option value="">-- Select --</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.deal_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Due Date</label><input type="date" className="input" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} /></div>
                <div><label className="label">Assigned To</label>
                  <select className="input" value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })}>
                    <option value="">-- Select --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Project</label>
                <select className="input" value={taskForm.project_id} onChange={e => setTaskForm({ ...taskForm, project_id: e.target.value })}>
                  <option value="">-- Select Project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button className="btn-primary btn-sm" onClick={
              activeTab === 'contacts' ? saveContact :
              activeTab === 'companies' ? saveCompany :
              activeTab === 'deals' ? saveDeal :
              activeTab === 'interactions' ? saveInteraction :
              saveTask
            } disabled={saving}>
              {saving ? 'Saving...' : t('common.save')}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      </div>
    );
  }

  function renderDetailModal() {
    if (!detailItem) return null;
    const item = detailItem;
    const itemId = item.id as string;
    const excluded = ['id', 'created_at', 'updated_at', 'is_active', 'is_lost'];
    const labels: Record<string, string> = {
      first_name: 'First Name', last_name: 'Last Name', email: 'Email', phone: 'Phone', mobile: 'Mobile',
      position: 'Position', company_id: 'Company', company_name: 'Company Name', source: 'Source',
      tags: 'Tags', notes: 'Notes', assigned_to: 'Assigned To', is_active: 'Status',
      trading_name: 'Trading Name', registration_number: 'Registration Number',
      vat_number: 'VAT Number', industry: 'Industry', company_size: 'Company Size',
      deal_name: 'Deal Name', pipeline_stage_id: 'Stage', amount: 'Amount', probability: 'Probability',
      expected_close_date: 'Expected Close Date', is_won: 'Status', is_lost: 'Status', description: 'Description',
      interaction_type: 'Type', subject: 'Subject', contact_id: 'Contact', contact_name: 'Contact',
      interaction_date: 'Date', duration_minutes: 'Duration', direction: 'Direction', outcome: 'Outcome',
      follow_up_date: 'Follow-up Date', created_by: 'Created By', created_by_name: 'Created By',
      task_type: 'Type', due_date: 'Due Date', priority: 'Priority', status: 'Status',
      website: 'Website',
    };

    const isDeal = activeTab === 'deals';
    const isContact = activeTab === 'contacts';
    const relatedTasks = isContact ? tasks.filter(t => t.contact_id === itemId) : isDeal ? tasks.filter(t => t.deal_id === itemId) : [];
    const relatedInteractions = isContact ? interactions.filter(i => i.contact_id === itemId) : isDeal ? interactions.filter(i => i.deal_id === itemId) : [];
    const relatedDeals = isContact ? deals.filter(d => d.contact_id === itemId) : [];
    return (
      <div className="modal-overlay" onClick={() => setDetailItem(null)}>
        <div className="modal max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold capitalize">{activeTab === 'deals' ? 'Deal' : activeTab === 'interactions' ? 'Interaction' : activeTab === 'tasks' ? 'Task' : activeTab.slice(0, -1)} Details</h3>
            <button className="btn-sm btn-secondary" onClick={() => setDetailItem(null)}><X size={16} /></button>
          </div>
          <div className="space-y-3">
            {Object.entries(item).filter(([k]) => !excluded.includes(k)).map(([key, val]) => (
              <div key={key} className="flex justify-between pb-2" style={{borderBottom: '1px solid var(--color-border)'}}>
                <span className="font-medium text-sm" style={{color: 'var(--color-text-secondary)'}}>{labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span className="text-sm text-right max-w-[60%]" style={{color: 'var(--color-text)'}}>
                  {key === 'assigned_to' ? resolveUser(val as string) :
                   key === 'company_id' ? resolveCompany(val as string) :
                   key === 'contact_id' ? resolveContact(val as string) :
                   key === 'created_by' ? resolveUser(val as string) :
                   key === 'pipeline_stage_id' ? stageName(val as string) :
                   key === 'amount' ? formatCurrency(val as number) :
                   key === 'probability' ? (val != null ? `${val}%` : '-') :
                   key === 'duration_minutes' ? (val != null ? `${val}m` : '-') :
                   key === 'interaction_type' || key === 'task_type' ? <span className={`badge ${typeColors[val as string] || 'badge-neutral'}`}>{String(val)}</span> :
                   key === 'priority' ? <span className={`badge ${priorityColors[val as string] || 'badge-neutral'}`}>{String(val)}</span> :
                   key === 'status' ? <span className={`badge ${statusColors[val as string] || 'badge-neutral'}`}>{String(val)}</span> :
                   key === 'direction' ? <span className={`badge ${val === 'inbound' ? 'bg-sky-100 text-sky-800' : 'badge-warning'}`}>{String(val)}</span> :
                   key === 'is_won' ? (
                     <span className={`badge ${item.is_lost ? 'badge-danger' : val ? 'badge-success' : 'badge-info'}`}>
                       {item.is_lost ? 'Lost' : val ? 'Won' : 'Open'}
                     </span>
                   ) :
                   key === 'interaction_date' || key === 'expected_close_date' || key === 'follow_up_date' || key === 'due_date' ? formatDate(val as string) :
                   key === 'tags' && Array.isArray(val) ? val.map((tag, i) => <span key={i} className="badge mr-1">{tag}</span>) :
                   val != null ? String(val) : '-'}
                </span>
              </div>
            ))}
          </div>

          {(isContact || isDeal) && (
            <div className="mt-4 space-y-4 border-t pt-4" style={{borderColor: 'var(--color-border)'}}>
              {isContact && relatedDeals.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Related Deals ({relatedDeals.length})</h4>
                  <div className="space-y-1">
                    {relatedDeals.map(d => (
                      <div key={d.id} className="flex items-center justify-between text-xs p-2 rounded" style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)'}}>
                        <span className="font-medium">{d.deal_name}</span>
                        <span className="badge" style={{backgroundColor: stageColor(d.pipeline_stage_id) + '20', color: stageColor(d.pipeline_stage_id)}}>{stageName(d.pipeline_stage_id)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {relatedTasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Tasks & Activity ({relatedTasks.length})</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {relatedTasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded" style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)'}}>
                        <span className="font-medium truncate mr-2">{t.subject}</span>
                        <span className={`badge shrink-0 ${statusColors[t.status] || 'badge-neutral'}`}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {relatedInteractions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Interaction History ({relatedInteractions.length})</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {relatedInteractions.map(i => (
                      <div key={i.id} className="flex items-center justify-between text-xs p-2 rounded" style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)'}}>
                        <span className="font-medium truncate mr-2">{i.subject}</span>
                        <span className="text-gray-500 shrink-0">{formatDate(i.interaction_date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {relatedTasks.length === 0 && relatedInteractions.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No activity records found. Stage changes, won/lost status, and escalations are automatically logged here.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            {isDeal && !item.is_won && !item.is_lost && (
              <>
                <button className="btn-sm" style={{ backgroundColor: '#22c55e', color: 'white' }} onClick={() => markDealWon(itemId)}>
                  <Check size={14} /> Mark Won
                </button>
                <button className="btn-sm" style={{ backgroundColor: '#ef4444', color: 'white' }} onClick={() => markDealLost(itemId)}>
                  <X size={14} /> Mark Lost
                </button>
              </>
            )}
            <button className="btn-secondary btn-sm" onClick={() => setDetailItem(null)}>{t('common.close')}</button>
          </div>
        </div>
      </div>
    );
  }

  function renderWhatsAppSection() {
    const waMsgsByPhone: Record<string, any[]> = {};
    waMessages.forEach((m: any) => {
      const key = m.phone_number || m.from_number || m.to_number;
      if (!key) return;
      if (!waMsgsByPhone[key]) waMsgsByPhone[key] = [];
      waMsgsByPhone[key].push(m);
    });
    const filteredPhones = waContacts.filter(c => !search || c.contactName.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));
    return (<>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><MessageCircle size={14} /> New WhatsApp Message</h3>
            <select className="input mb-2 text-sm" value={waSendForm.phone} onChange={e => setWaSendForm({ ...waSendForm, phone: e.target.value })}>
              <option value="">Select contact...</option>
              {waContacts.map(c => <option key={c.phone} value={c.phone}>{c.contactName} ({c.phone})</option>)}
            </select>
            <select className="input mb-2 text-sm" value={waSendForm.project_id} onChange={e => setWaSendForm({ ...waSendForm, project_id: e.target.value })}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
            </select>
            <textarea className="input mb-2 text-sm" rows={3} placeholder="Message text..." value={waSendForm.message} onChange={e => setWaSendForm({ ...waSendForm, message: e.target.value })} />
            <button className="btn-primary btn-sm" disabled={!waSendForm.phone || !waSendForm.message || waSending}
              onClick={async () => {
                if (!waSendForm.phone || !waSendForm.message) return;
                setWaSending(true);
                try {
                  await supabase.from('crm_whatsapp_messages').insert({
                    phone_number: waSendForm.phone, direction: 'outbound', message_body: waSendForm.message, status: 'sent',
                    project_id: waSendForm.project_id || null,
                  });
                  toast.success('Message sent');
                  setWaSendForm({ phone: '', message: '', project_id: '' });
                  loadAll();
                } catch { toast.error('Send failed'); }
                finally { setWaSending(false); }
              }}>
              <Send size={14} /> {waSending ? 'Sending...' : 'Send'}
            </button>
          </div>
          <div className="card p-4 overflow-y-auto max-h-80">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Smartphone size={14} /> WhatsApp Contacts</h3>
            {filteredPhones.length === 0 ? (
              <p className="text-xs text-gray-400">No contacts with phone numbers</p>
            ) : filteredPhones.map(c => {
              const msgs = waMsgsByPhone[c.phone] || [];
              const lastMsg = msgs[0];
              return (
                <div key={c.phone} className="flex items-center justify-between py-1.5 border-b text-xs" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.contactName}</p>
                    <p className="text-gray-400">{c.phone}</p>
                    {lastMsg && (
                      <p className="text-gray-500 truncate mt-0.5 flex items-center gap-1">
                        {lastMsg.media_url ? (
                          <button onClick={() => setWaPreviewFile({ url: lastMsg.media_url, fileName: 'media', mimeType: '' })}
                            className="shrink-0 p-0.5 rounded hover:bg-gray-100 transition-colors">
                            {lastMsg.media_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? <Image size={12} style={{ color: 'var(--color-primary)' }} /> : <Paperclip size={12} style={{ color: 'var(--color-text-secondary)' }} />}
                          </button>
                        ) : null}
                        <span className="truncate">{lastMsg.message_body}</span>
                      </p>
                    )}
                  </div>
                  <span className={`badge text-[10px] ${msgs.length > 0 ? 'badge-success' : 'badge-neutral'}`}>{msgs.length}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Recent Messages ({waMessages.length})</h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {waMessages.slice(0, 50).map((m: any) => {
              const contact = waContacts.find(c => c.phone === (m.phone_number || m.from_number || m.to_number));
              return (
                <div key={m.id} className="flex items-start gap-2 p-2 rounded text-xs" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: m.direction === 'inbound' ? '#e0f2fe' : '#fef3c7', color: m.direction === 'inbound' ? '#0284c7' : '#d97706' }}>
                    {m.direction === 'inbound' ? '←' : '→'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{contact?.contactName || m.phone_number || m.from_number || m.to_number}</p>
                    <p className="text-gray-500 truncate flex items-center gap-1">
                      {m.media_url ? (
                        <button onClick={() => setWaPreviewFile({ url: m.media_url, fileName: 'media', mimeType: '' })}
                          className="shrink-0 p-0.5 rounded hover:bg-gray-100 transition-colors">
                          {m.media_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? <Image size={12} style={{ color: 'var(--color-primary)' }} /> : <Paperclip size={12} style={{ color: 'var(--color-text-secondary)' }} />}
                        </button>
                      ) : null}
                      <span className="truncate">{m.message_body}</span>
                    </p>
                    <p className="text-gray-400 mt-0.5">{new Date(m.created_at).toLocaleString()} &middot; <span className="capitalize">{m.status}</span>{m.project_id ? ` · ${projectMap[m.project_id] || ''}` : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {waPreviewFile && <FilePreviewModal url={waPreviewFile.url} fileName={waPreviewFile.fileName} mimeType={waPreviewFile.mimeType} onClose={() => setWaPreviewFile(null)} />}
    </>);
  }

  function handleExport() {
    let data: Record<string, unknown>[];
    let name: string;
    switch (activeTab) {
      case 'contacts': data = filteredContacts as unknown as Record<string, unknown>[]; name = 'crm_contacts'; break;
      case 'companies': data = filteredCompanies as unknown as Record<string, unknown>[]; name = 'crm_companies'; break;
      case 'deals': data = filteredDeals as unknown as Record<string, unknown>[]; name = 'crm_deals'; break;
      case 'interactions': data = filteredInteractions as unknown as Record<string, unknown>[]; name = 'crm_interactions'; break;
      case 'tasks': data = filteredTasks as unknown as Record<string, unknown>[]; name = 'crm_tasks'; break;
      case 'whatsapp': return;
      default: return;
    }
    if (data.length) exportCSV(data, `${name}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const importColumns = activeTab === 'contacts'
    ? [{ key: 'first_name', label: 'First Name', required: true }, { key: 'last_name', label: 'Last Name', required: true }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }]
    : activeTab === 'companies'
    ? [{ key: 'company_name', label: 'Company Name', required: true }, { key: 'trading_name', label: 'Trading Name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }]
    : activeTab === 'deals'
    ? [{ key: 'deal_name', label: 'Deal Name', required: true }, { key: 'amount', label: 'Amount', type: 'number' as const }]
    : activeTab === 'interactions'
    ? [{ key: 'interaction_type', label: 'Interaction Type' }, { key: 'subject', label: 'Subject', required: true }]
    : [{ key: 'task_type', label: 'Task Type' }, { key: 'subject', label: 'Subject', required: true }];

  function getImportConfig(): SyncConfig {
    switch (activeTab) {
      case 'contacts':
        return { table: 'crm_contacts', columns: importColumns, defaults: { pipeline_stage_id: stages[0]?.id }, fkResolvers: [], uniqueKeys: [] };
      case 'companies':
        return { table: 'crm_companies', columns: importColumns, fkResolvers: [], uniqueKeys: [] };
      case 'deals':
        return { table: 'crm_deals', columns: importColumns, defaults: { pipeline_stage_id: stages[0]?.id }, fkResolvers: [], uniqueKeys: [] };
      case 'interactions':
        return { table: 'crm_interactions', columns: importColumns, defaults: { interaction_type: 'note' }, fkResolvers: [], uniqueKeys: [] };
      case 'tasks':
        return { table: 'crm_tasks', columns: importColumns, defaults: { task_type: 'call' }, fkResolvers: [], uniqueKeys: [] };
      default:
        return { table: '', columns: [], fkResolvers: [], uniqueKeys: [] };
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={handleExport}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          {hasPermission('crm', 'create') && <button className="btn-primary btn-sm" onClick={openCreateModal}>
            <Plus size={16} /> Add {activeTab === 'deals' ? 'Deal' : activeTab === 'interactions' ? 'Interaction' : activeTab === 'tasks' ? 'Task' : activeTab.slice(0, -1)}
          </button>}
        </div>
      </div>

      {pipelineKpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pipelineKpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="stat-glass cursor-pointer" onClick={() => navigate('/analytics')}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${k.color}15`, color: k.color }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-base font-bold">{k.value}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{k.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{borderBottom: '1px solid var(--color-border)'}}>
        <div className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearch(''); setDetailItem(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? '' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={isActive ? {borderColor: 'var(--color-primary)', color: 'var(--color-primary)'} : undefined}
              >
                <Icon size={16} />
                {t(`crm.tabs.${tab.key}`)}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab !== 'whatsapp' && (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <select className="select text-sm" style={{ width: '150px' }} value={filterProject} onChange={e => { setFilterProject(e.target.value); setPage(1); }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_code}</option>)}
          </select>
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        {activeTab === 'deals' && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button className={`btn-sm ${dealView === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDealView('kanban')}><LayoutGrid size={14} /> Kanban</button>
            <button className={`btn-sm ${dealView === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDealView('list')}><Table2 size={14} /> List</button>
          </div>
        )}
      </div>
      )}

      {activeTab === 'contacts' && renderContactsSection()}
      {activeTab === 'companies' && renderCompaniesSection()}
      {activeTab === 'deals' && (dealView === 'kanban' ? renderDealsKanban() : renderDealsList())}
      {activeTab === 'interactions' && renderInteractionsSection()}
      {activeTab === 'tasks' && renderTasksSection()}
      {activeTab === 'whatsapp' && renderWhatsAppSection()}

      {showForm && renderCreateEditModal()}
      {detailItem && renderDetailModal()}
      {showImport && <CsvImportModal moduleName={`CRM ${activeTab}`} config={getImportConfig()} onClose={() => { setShowImport(false); loadAll(); }} />}
      {deleting && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${deleting.label}"?`}
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleting.table, deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
