import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { exportCSV } from '../utils/csv';
import CsvImportModal from '../components/CsvImportModal';
import Pagination from '../components/Pagination';
import { type SyncConfig } from '../services/syncService';
import { Plus, Download, Upload, Eye, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string; employee_code: string; full_name_en: string; full_name_ar: string;
  job_title: string; department: string; phone: string; email: string;
  nationality: string; employee_type: string; status: string; project_id?: string; project_name?: string;
}

interface Project {
  id: string; name_en: string; project_code: string;
}

interface PayrollRun {
  id: string; project_id: string; payroll_code: string; period_start: string;
  period_end: string; status: string; total_salaries: number; total_amount: number; project_name?: string;
}

interface Department {
  id: string; code: string; name_en: string; name_ar: string; parent_id: string; manager_id: string;
}

interface EmpContract {
  id: string; contract_no: string; employee_id: string; contract_type: string; start_date: string; end_date: string; total_salary: number; status: string;
}

interface Shift {
  id: string; code: string; name_en: string; start_time: string; end_time: string; grace_minutes: number; is_night_shift: boolean;
}

interface Advance {
  id: string; advance_no: string; employee_id: string; type: string; amount: number; installment_count: number; status: string;
}

interface EmpDoc {
  id: string; employee_id: string; document_type: string; document_name: string; file_url: string; expiry_date: string; is_verified: boolean;
}

const defaultEmployeeForm = { project_id: '', employee_code: '', full_name_en: '', full_name_ar: '', job_title: '', department: '', phone: '', email: '', nationality: '', employee_type: 'staff', hire_date: new Date().toISOString().slice(0, 10), basic_salary: '', iqama_number: '', contract_type: 'full_time' };
const emptyPayrollForm = { project_id: '', payroll_code: '', period_start: new Date().toISOString().slice(0, 7) + '-01', period_end: '', status: 'draft' as string };
const emptyDepartmentForm = { code: '', name_en: '', name_ar: '', parent_id: '', manager_id: '' };
const emptyAdvanceForm = { advance_no: '', employee_id: '', type: 'salary_advance', amount: '', installment_count: '1' };

export default function HRPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [laborGroups, setLaborGroups] = useState<{ id: string; project_id: string; group_code: string; name_en: string; name_ar?: string; created_at?: string }[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'employees' | 'payroll' | 'labor_groups' | 'departments' | 'emp_contracts' | 'shifts' | 'advances' | 'emp_docs'>('employees');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(defaultEmployeeForm);
  const [payrollForm, setPayrollForm] = useState(emptyPayrollForm);
  const [totalAmount, setTotalAmount] = useState(0);
  const [groupForm, setGroupForm] = useState({ project_id: '', group_code: '', name_en: '' });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptForm, setDeptForm] = useState(emptyDepartmentForm);
  const [deptEditId, setDeptEditId] = useState<string | null>(null);
  const [contracts, setContracts] = useState<EmpContract[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
  const [docs, setDocs] = useState<EmpDoc[]>([]);
  const [employeesLookup, setEmployeesLookup] = useState<{ id: string; full_name_en: string; employee_code: string }[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); load(); }, [tab]);

  useEffect(() => {
    if (!payrollForm.period_start || !payrollForm.project_id) return;
    (async () => {
      try {
        const { data: emps } = await supabase.from('employees').select('basic_salary').eq('project_id', payrollForm.project_id);
        const sum = (emps || []).reduce((acc, e) => acc + (e.basic_salary || 0), 0);
        if (payrollForm.period_start && payrollForm.period_end) {
          const start = new Date(payrollForm.period_start);
          const end = new Date(payrollForm.period_end);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) { setTotalAmount(0); return; }
          const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const months = days / 30.44;
          setTotalAmount(Math.round(sum * months) || 0);
        } else {
          setTotalAmount(sum);
        }
      } catch (err) {
        console.error('Payroll calculation failed:', err);
        setTotalAmount(0);
      }
    })();
  }, [payrollForm.period_start, payrollForm.period_end, payrollForm.project_id]);

  async function load() {
    setLoading(true);
    try {
      const tbl = tab === 'employees' ? 'employees' : tab === 'payroll' ? 'payroll_runs' : tab === 'labor_groups' ? 'labor_groups' : tab === 'departments' ? 'departments' : tab === 'emp_contracts' ? 'employee_contracts' : tab === 'shifts' ? 'shift_definitions' : tab === 'advances' ? 'employee_advances' : 'employee_documents';
      let query = supabase.from(tbl).select('*');
      if (tab === 'employees') query = query.eq('status', 'active').order('full_name_en');
      else if (tab === 'payroll') query = query.order('period_start', { ascending: false });
      else if (tab === 'labor_groups') query = query.order('name_en');
      else if (tab === 'departments') query = query.order('name_en');
      else if (tab === 'emp_contracts') query = query.order('contract_no');
      else if (tab === 'shifts') query = query.order('name_en');
      else if (tab === 'advances') query = query.order('advance_no', { ascending: false });
      else if (tab === 'emp_docs') query = query.order('document_name');
      const [dataRes, projRes] = await Promise.all([
        query,
        supabase.from('projects').select('id, name_en, project_code').eq('is_active', true).order('name_en'),
      ]);
      if (tab === 'employees') {
        const projMap = Object.fromEntries(((projRes.data || []) as Project[]).map(p => [p.id, p]));
        setEmployees(((dataRes.data || []) as Employee[]).map(e => ({ ...e, project_name: projMap[e.project_id || '']?.project_code || '' })));
      } else if (tab === 'payroll') {
        const projMap = Object.fromEntries(((projRes.data || []) as Project[]).map(p => [p.id, p]));
        setPayrolls(((dataRes.data || []) as PayrollRun[]).map(r => ({ ...r, project_name: projMap[r.project_id || '']?.project_code || '' })));
      } else if (tab === 'labor_groups') {
        const projMap = Object.fromEntries(((projRes.data || []) as Project[]).map(p => [p.id, p]));
        setLaborGroups(((dataRes.data || []) as any[]).map((g: any) => ({ ...g, project_name: projMap[g.project_id || '']?.project_code || '' })));
      } else if (tab === 'departments') setDepartments((dataRes.data || []) as Department[]);
      else if (tab === 'emp_contracts') setContracts((dataRes.data || []) as EmpContract[]);
      else if (tab === 'shifts') setShifts((dataRes.data || []) as Shift[]);
      else if (tab === 'advances') setAdvances((dataRes.data || []) as Advance[]);
      else if (tab === 'emp_docs') setDocs((dataRes.data || []) as EmpDoc[]);
      setProjects((projRes.data || []) as Project[]);
      if (tab === 'departments' || tab === 'advances') {
        const { data: empData } = await supabase.from('employees').select('id, full_name_en, employee_code').order('full_name_en');
        setEmployeesLookup((empData || []) as { id: string; full_name_en: string; employee_code: string }[]);
      }
    } catch (err) {
      console.error('Failed to load HR data:', err);
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  const filteredEmployees = employees.filter((e) => !search ||
    ((e.full_name_en || '').toLowerCase().includes(search.toLowerCase()) ||
     (e.employee_code || '').toLowerCase().includes(search.toLowerCase())));
  const filteredPayrolls = payrolls.filter((p) => !search ||
    (p.payroll_code || '').toLowerCase().includes(search.toLowerCase()));
  const filteredLaborGroups = laborGroups.filter((g) => !search ||
    (g.group_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.name_en || '').toLowerCase().includes(search.toLowerCase()));
  const filteredDepartments = departments.filter((d) => !search ||
    (d.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.name_en || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.name_ar || '').toLowerCase().includes(search.toLowerCase()));
  const filteredContracts = contracts.filter((c) => !search ||
    (c.contract_no || '').toLowerCase().includes(search.toLowerCase()));
  const filteredShifts = shifts.filter((s) => !search ||
    (s.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.name_en || '').toLowerCase().includes(search.toLowerCase()));
  const filteredAdvances = advances.filter((a) => !search ||
    (a.advance_no || '').toLowerCase().includes(search.toLowerCase()));
  const filteredDocs = docs.filter((d) => !search ||
    (d.document_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.document_type || '').toLowerCase().includes(search.toLowerCase()));
  const filtered = tab === 'employees' ? filteredEmployees : tab === 'payroll' ? filteredPayrolls : tab === 'labor_groups' ? filteredLaborGroups : tab === 'departments' ? filteredDepartments : tab === 'emp_contracts' ? filteredContracts : tab === 'shifts' ? filteredShifts : tab === 'advances' ? filteredAdvances : filteredDocs;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function save() {
    setFormError('');
    if (!form.project_id) { setFormError('Project is required'); return; }
    if (!form.employee_code.trim()) { setFormError('Employee Code is required'); return; }
    if (!form.full_name_en.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('employees').insert({
        project_id: form.project_id, employee_code: form.employee_code,
        full_name_en: form.full_name_en, full_name_ar: form.full_name_ar || null,
        job_title: form.job_title || null, department: form.department || null,
        phone: form.phone || null, email: form.email || null,
        nationality: form.nationality || null, employee_type: form.employee_type,
        hire_date: form.hire_date || new Date().toISOString().slice(0, 10),
        basic_salary: form.basic_salary ? parseFloat(form.basic_salary) : null,
        iqama_number: form.iqama_number || null,
        contract_type: form.contract_type,
        status: 'active',
      });
      if (error) throw error;
      toast.success(`Employee "${form.full_name_en}" created`);
      setShowForm(false); setForm(defaultEmployeeForm); load();
    } catch (err: unknown) {
      console.error('HR save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveGroup() {
    setFormError('');
    if (!groupForm.project_id) { setFormError('Project is required'); return; }
    if (!groupForm.group_code.trim()) { setFormError('Group Code is required'); return; }
    if (!groupForm.name_en.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('labor_groups').insert({
        project_id: groupForm.project_id, group_code: groupForm.group_code,
        name_en: groupForm.name_en,
      });
      if (error) throw error;
      toast.success(`Group "${groupForm.group_code}" created`);
      setShowForm(false); setGroupForm({ project_id: '', group_code: '', name_en: '' }); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function savePayroll() {
    setFormError('');
    if (!payrollForm.project_id) { setFormError('Project is required'); return; }
    setSaving(true);
    try {
      const code = payrollForm.payroll_code.trim() || `PR-${payrollForm.period_start?.slice(0, 7) || '0000-00'}-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from('payroll_runs').insert({
        project_id: payrollForm.project_id, payroll_code: code,
        period_start: payrollForm.period_start, period_end: payrollForm.period_end || payrollForm.period_start,
        status: 'draft', total_amount: totalAmount, total_salaries: totalAmount, total_deductions: 0, total_allowances: 0, net_total: totalAmount,
      });
      if (error) throw error;
      toast.success(`Payroll "${code}" created`);
      setShowForm(false); setPayrollForm(emptyPayrollForm); load();
    } catch (err: unknown) {
      console.error('Payroll save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveDepartment() {
    setFormError('');
    if (!deptForm.code.trim()) { setFormError('Code is required'); return; }
    if (!deptForm.name_en.trim()) { setFormError('Name (EN) is required'); return; }
    setSaving(true);
    try {
      const payload = {
        code: deptForm.code,
        name_en: deptForm.name_en,
        name_ar: deptForm.name_ar || null,
        parent_id: deptForm.parent_id || null,
        manager_id: deptForm.manager_id || null,
      };
      if (deptEditId) {
        const { error } = await supabase.from('departments').update(payload).eq('id', deptEditId);
        if (error) throw error;
        toast.success(`Department "${deptForm.name_en}" updated`);
      } else {
        const { error } = await supabase.from('departments').insert(payload);
        if (error) throw error;
        toast.success(`Department "${deptForm.name_en}" created`);
      }
      setShowForm(false); setDeptEditId(null); setDeptForm(emptyDepartmentForm); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function saveAdvance() {
    setFormError('');
    if (!advanceForm.advance_no.trim()) { setFormError('Advance No is required'); return; }
    if (!advanceForm.employee_id) { setFormError('Employee is required'); return; }
    if (!advanceForm.amount) { setFormError('Amount is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('employee_advances').insert({
        advance_no: advanceForm.advance_no,
        employee_id: advanceForm.employee_id,
        type: advanceForm.type,
        amount: parseFloat(advanceForm.amount),
        installment_count: parseInt(advanceForm.installment_count, 10),
        status: 'pending',
      });
      if (error) throw error;
      toast.success(`Advance "${advanceForm.advance_no}" created`);
      setShowForm(false); setAdvanceForm(emptyAdvanceForm); load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFormError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  const columns = tab === 'employees'
    ? [
        { key: 'employee_code', label: 'Employee Code', required: true },
        { key: 'full_name_en', label: 'Full Name', required: true },
        { key: 'project_name', label: 'Project' },
        { key: 'job_title', label: 'Job Title' },
        { key: 'department', label: 'Department' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status' },
      ]
    : tab === 'payroll'
    ? [
        { key: 'payroll_code', label: 'Payroll Code', required: true },
        { key: 'project_name', label: 'Project' },
        { key: 'period_start', label: 'Period Start' },
        { key: 'period_end', label: 'Period End' },
        { key: 'total_amount', label: 'Total Amount', type: 'number' as const },
        { key: 'status', label: 'Status' },
      ]
    : tab === 'labor_groups'
    ? [
        { key: 'group_code', label: 'Group Code', required: true },
        { key: 'name_en', label: 'Name', required: true },
        { key: 'project_name', label: 'Project' },
        { key: 'supervisor_name', label: 'Supervisor' },
      ]
    : tab === 'departments'
    ? [
        { key: 'code', label: 'Code', required: true },
        { key: 'name_en', label: 'Name (EN)', required: true },
        { key: 'name_ar', label: 'Name (AR)' },
        { key: 'manager_id', label: 'Manager ID' },
      ]
    : tab === 'emp_contracts'
    ? [
        { key: 'contract_no', label: 'Contract No', required: true },
        { key: 'employee_id', label: 'Employee ID' },
        { key: 'contract_type', label: 'Type' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'total_salary', label: 'Salary', type: 'number' as const },
        { key: 'status', label: 'Status' },
      ]
    : tab === 'shifts'
    ? [
        { key: 'code', label: 'Code', required: true },
        { key: 'name_en', label: 'Name (EN)' },
        { key: 'start_time', label: 'Start Time' },
        { key: 'end_time', label: 'End Time' },
        { key: 'grace_minutes', label: 'Grace (min)' },
        { key: 'is_night_shift', label: 'Night' },
      ]
    : tab === 'advances'
    ? [
        { key: 'advance_no', label: 'Advance No', required: true },
        { key: 'employee_id', label: 'Employee ID' },
        { key: 'type', label: 'Type' },
        { key: 'amount', label: 'Amount', type: 'number' as const },
        { key: 'installment_count', label: 'Installments' },
        { key: 'status', label: 'Status' },
      ]
    : [
        { key: 'employee_id', label: 'Employee ID' },
        { key: 'document_type', label: 'Document Type' },
        { key: 'document_name', label: 'Document Name' },
        { key: 'file_url', label: 'File URL' },
        { key: 'expiry_date', label: 'Expiry Date' },
        { key: 'is_verified', label: 'Verified' },
      ];

  const importConfig: SyncConfig = tab === 'employees'
    ? {
        table: 'employees',
        columns: [
          { key: 'employee_code', label: 'Employee Code', required: true },
          { key: 'full_name_en', label: 'Full Name', required: true },
          { key: 'job_title', label: 'Job Title' },
          { key: 'department', label: 'Department' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
        defaults: { status: 'active', employee_type: 'staff' },
      }
    : tab === 'payroll'
    ? {
        table: 'payroll_runs',
        columns: [
          { key: 'payroll_code', label: 'Payroll Code', required: true },
          { key: 'period_start', label: 'Period Start' },
          { key: 'period_end', label: 'Period End' },
          { key: 'total_amount', label: 'Total Amount', type: 'number' as const },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
        defaults: { status: 'draft' },
      }
    : tab === 'labor_groups'
    ? {
        table: 'labor_groups',
        columns: [
          { key: 'group_code', label: 'Group Code', required: true },
          { key: 'name_en', label: 'Name', required: true },
          { key: 'supervisor_name', label: 'Supervisor' },
        ],
        fkResolvers: [{ column: 'project_id', table: 'projects', lookupField: 'project_code', targetField: 'id' }],
      }
    : tab === 'departments'
    ? {
        table: 'departments',
        columns: [
          { key: 'code', label: 'Code', required: true },
          { key: 'name_en', label: 'Name (EN)', required: true },
          { key: 'name_ar', label: 'Name (AR)' },
          { key: 'manager_id', label: 'Manager ID' },
        ],
      }
    : tab === 'emp_contracts'
    ? {
        table: 'employee_contracts',
        columns: [
          { key: 'contract_no', label: 'Contract No', required: true },
          { key: 'contract_type', label: 'Type' },
          { key: 'start_date', label: 'Start Date' },
          { key: 'end_date', label: 'End Date' },
          { key: 'total_salary', label: 'Salary', type: 'number' as const },
          { key: 'status', label: 'Status' },
        ],
      }
    : tab === 'shifts'
    ? {
        table: 'shift_definitions',
        columns: [
          { key: 'code', label: 'Code', required: true },
          { key: 'name_en', label: 'Name (EN)' },
          { key: 'start_time', label: 'Start Time' },
          { key: 'end_time', label: 'End Time' },
          { key: 'grace_minutes', label: 'Grace (min)' },
        ],
      }
    : tab === 'advances'
    ? {
        table: 'employee_advances',
        columns: [
          { key: 'advance_no', label: 'Advance No', required: true },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: 'Amount', type: 'number' as const },
          { key: 'installment_count', label: 'Installments' },
        ],
      }
    : {
        table: 'employee_documents',
        columns: [
          { key: 'document_type', label: 'Document Type' },
          { key: 'document_name', label: 'Document Name' },
          { key: 'file_url', label: 'File URL' },
          { key: 'expiry_date', label: 'Expiry Date' },
        ],
      };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.hr')}</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => { if (filtered.length) exportCSV(filtered as unknown as Record<string, unknown>[], `hr_${tab}_${new Date().toISOString().slice(0, 10)}.csv`); }}>
            <Download size={14} /> {t('admin.export_csv')}
          </button>
          <button className="btn-sm btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} /> {t('admin.import_csv')}
          </button>
          {hasPermission('hr', 'create') && <button className="btn-primary btn-sm" onClick={() => { setFormError(''); if (tab === 'payroll') setPayrollForm(emptyPayrollForm); else if (tab === 'labor_groups') setGroupForm({ project_id: '', group_code: '', name_en: '' }); else if (tab === 'departments') { setDeptForm(emptyDepartmentForm); setDeptEditId(null); } else if (tab === 'advances') setAdvanceForm(emptyAdvanceForm); else setForm(defaultEmployeeForm); setShowForm(true); }}>
            <Plus size={16} /> {tab === 'employees' ? 'New Employee' : tab === 'payroll' ? 'New Payroll Run' : tab === 'labor_groups' ? 'New Group' : tab === 'departments' ? 'New Department' : tab === 'advances' ? 'New Advance' : 'New'}
          </button>}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'employees' ? 'tab-active' : ''}`} onClick={() => setTab('employees')}>Employees</button>
        <button className={`tab ${tab === 'payroll' ? 'tab-active' : ''}`} onClick={() => setTab('payroll')}>Payroll</button>
        <button className={`tab ${tab === 'labor_groups' ? 'tab-active' : ''}`} onClick={() => setTab('labor_groups')}>Labor Groups</button>
        <button className={`tab ${tab === 'departments' ? 'tab-active' : ''}`} onClick={() => setTab('departments')}>Departments</button>
        <button className={`tab ${tab === 'emp_contracts' ? 'tab-active' : ''}`} onClick={() => setTab('emp_contracts')}>Contracts</button>
        <button className={`tab ${tab === 'shifts' ? 'tab-active' : ''}`} onClick={() => setTab('shifts')}>Shifts</button>
        <button className={`tab ${tab === 'advances' ? 'tab-active' : ''}`} onClick={() => setTab('advances')}>Advances</button>
        <button className={`tab ${tab === 'emp_docs' ? 'tab-active' : ''}`} onClick={() => setTab('emp_docs')}>Documents</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
        <input className="input ps-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.no_results')}</td></tr>
              ) : (
                paged.map((e: unknown) => {
                  const row = e as Record<string, string>;
                  return (
                    <tr key={row.id} className={tab === 'employees' ? 'clickable' : ''} onClick={tab === 'employees' ? () => navigate(`/hr/employees/${row.id}`) : undefined}>
                      {columns.map((c) => <td key={c.key} className={`text-sm ${c.key === 'email' ? 'min-w-[200px] break-all' : ''}`}>{row[c.key] ?? '-'}</td>)}
                      <td>
                        {tab === 'employees' ? (
                          <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/${row.id}`); }}><Eye size={14} /></button>
                        ) : tab === 'departments' ? (
                          <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setDeptForm({ code: row.code || '', name_en: row.name_en || '', name_ar: row.name_ar || '', parent_id: row.parent_id || '', manager_id: row.manager_id || '' }); setDeptEditId(row.id); setFormError(''); setShowForm(true); }}><Eye size={14} /></button>
                        ) : (
                          <button className="btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); toast.info('View details coming soon'); }}><Eye size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{tab === 'payroll' ? 'New Payroll Run' : tab === 'employees' ? 'New Employee' : tab === 'labor_groups' ? 'New Labor Group' : tab === 'departments' ? (deptEditId ? 'Edit Department' : 'New Department') : 'New Advance'}</h3>
            {formError && <div className="mb-4 p-3 rounded-lg text-sm" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)'}}>{formError}</div>}
            {tab === 'payroll' ? (
              <div className="space-y-4">
                <div><label className="label">Project *</label>
                  <select className="input" value={payrollForm.project_id} onChange={(e) => setPayrollForm({ ...payrollForm, project_id: e.target.value })}>
                    <option value="">-- Select Project --</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Payroll Code *</label><input className="input" value={payrollForm.payroll_code} onChange={(e) => setPayrollForm({ ...payrollForm, payroll_code: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Period Start</label><input type="date" className="input" value={payrollForm.period_start} onChange={(e) => setPayrollForm({ ...payrollForm, period_start: e.target.value })} /></div>
                  <div><label className="label">Period End</label><input type="date" className="input" value={payrollForm.period_end} onChange={(e) => setPayrollForm({ ...payrollForm, period_end: e.target.value })} /></div>
                </div>
                <div><label className="label">Total Amount (auto-calculated)</label><input type="text" className="input" style={{ backgroundColor: 'var(--color-surface)' }} value={`${totalAmount.toLocaleString()} SAR`} disabled /></div>
              </div>
            ) : tab === 'employees' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="label">Project *</label>
                  <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                    <option value="">-- Select Project --</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Employee Code *</label><input className="input" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></div>
                <div><label className="label">Type</label><select className="input" value={form.employee_type} onChange={(e) => setForm({ ...form, employee_type: e.target.value })}>
                  {['staff','labor','supervisor','engineer','manager','admin','other'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select></div>
                <div className="col-span-2"><label className="label">Full Name (EN) *</label><input className="input" value={form.full_name_en} onChange={(e) => setForm({ ...form, full_name_en: e.target.value })} /></div>
                <div className="col-span-2"><label className="label">Full Name (AR)</label><input className="input text-right" dir="rtl" value={form.full_name_ar} onChange={(e) => setForm({ ...form, full_name_ar: e.target.value })} /></div>
                <div><label className="label">Job Title</label><input className="input" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
                <div><label className="label">Department</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
                <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><label className="label">Hire Date</label><input type="date" className="input" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
                <div><label className="label">Basic Salary</label><input type="number" className="input" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} /></div>
                <div><label className="label">Iqama Number</label><input className="input" value={form.iqama_number} onChange={(e) => setForm({ ...form, iqama_number: e.target.value })} /></div>
                <div><label className="label">Contract Type</label>
                  <select className="input" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                    {['full_time','part_time','temporary','contract','probation'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><label className="label">Nationality</label><input className="input" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
              </div>
            ) : tab === 'labor_groups' ? (
              <div className="space-y-4">
                <div className="col-span-2"><label className="label">Project *</label>
                  <select className="input" value={groupForm.project_id} onChange={(e) => setGroupForm({ ...groupForm, project_id: e.target.value })}>
                    <option value="">-- Select Project --</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Group Code *</label><input className="input" value={groupForm.group_code} onChange={(e) => setGroupForm({ ...groupForm, group_code: e.target.value })} /></div>
                <div><label className="label">Name *</label><input className="input" value={groupForm.name_en} onChange={(e) => setGroupForm({ ...groupForm, name_en: e.target.value })} /></div>
              </div>
            ) : tab === 'departments' ? (
              <div className="space-y-4">
                <div><label className="label">Code *</label><input className="input" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} /></div>
                <div><label className="label">Name (EN) *</label><input className="input" value={deptForm.name_en} onChange={(e) => setDeptForm({ ...deptForm, name_en: e.target.value })} /></div>
                <div><label className="label">Name (AR)</label><input className="input text-right" dir="rtl" value={deptForm.name_ar} onChange={(e) => setDeptForm({ ...deptForm, name_ar: e.target.value })} /></div>
                <div><label className="label">Parent Department</label>
                  <select className="input" value={deptForm.parent_id} onChange={(e) => setDeptForm({ ...deptForm, parent_id: e.target.value })}>
                    <option value="">-- None --</option>
                    {departments.filter((d) => d.id !== deptEditId).map((d) => <option key={d.id} value={d.id}>{d.code} - {d.name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Manager</label>
                  <select className="input" value={deptForm.manager_id} onChange={(e) => setDeptForm({ ...deptForm, manager_id: e.target.value })}>
                    <option value="">-- None --</option>
                    {employeesLookup.map((emp) => <option key={emp.id} value={emp.id}>{emp.employee_code} - {emp.full_name_en}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div><label className="label">Advance No *</label><input className="input" value={advanceForm.advance_no} onChange={(e) => setAdvanceForm({ ...advanceForm, advance_no: e.target.value })} /></div>
                <div><label className="label">Employee *</label>
                  <select className="input" value={advanceForm.employee_id} onChange={(e) => setAdvanceForm({ ...advanceForm, employee_id: e.target.value })}>
                    <option value="">-- Select Employee --</option>
                    {employeesLookup.map((emp) => <option key={emp.id} value={emp.id}>{emp.employee_code} - {emp.full_name_en}</option>)}
                  </select>
                </div>
                <div><label className="label">Type</label>
                  <select className="input" value={advanceForm.type} onChange={(e) => setAdvanceForm({ ...advanceForm, type: e.target.value })}>
                    <option value="salary_advance">Salary Advance</option>
                    <option value="travel_advance">Travel Advance</option>
                    <option value="emergency_advance">Emergency Advance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div><label className="label">Amount *</label><input type="number" className="input" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} /></div>
                <div><label className="label">Installment Count</label><input type="number" className="input" value={advanceForm.installment_count} onChange={(e) => setAdvanceForm({ ...advanceForm, installment_count: e.target.value })} /></div>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={tab === 'payroll' ? savePayroll : tab === 'labor_groups' ? saveGroup : tab === 'departments' ? saveDepartment : tab === 'advances' ? saveAdvance : save} disabled={saving}>{saving ? 'Saving...' : t('common.save')}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal moduleName={`HR ${tab}`} config={importConfig} onClose={() => { setShowImport(false); load(); }} />}
    </div>
  );
}
