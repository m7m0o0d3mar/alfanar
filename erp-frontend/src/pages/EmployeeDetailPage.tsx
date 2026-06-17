import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Edit3, Mail, Phone, MapPin, CreditCard, DollarSign, Calendar, Briefcase } from 'lucide-react';

interface Employee {
  id: string; employee_code: string; full_name_en: string; full_name_ar: string;
  job_title: string; department: string; phone: string; email: string;
  nationality: string; employee_type: string; status: string;
  hire_date: string; basic_salary: number | null; iqama_number: string;
  contract_type: string; project_id: string;
}

  interface PayrollRun {
    id: string; payroll_code: string; period_start: string; net_salary: number; status: string; payroll_run_id: string;
  }

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payrolls, setPayrolls] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      supabase.from('employees').select('*').eq('id', id).single(),
      supabase.from('payroll_details').select('*, payroll_run:payroll_run_id(payroll_code, period_start, status)').eq('employee_id', id).order('payroll_run_id', { ascending: false }),
    ]).then(([empRes, payRes]) => {
      setEmployee(empRes.data as Employee | null);
      setForm(empRes.data as Employee || {});
      const details = (payRes.data || []) as any[];
      setPayrolls(details.map((d: any) => ({
        id: d.id, payroll_code: d.payroll_run?.payroll_code || '', period_start: d.payroll_run?.period_start || '',
        net_salary: d.net_salary || 0, status: d.payroll_run?.status || 'draft', payroll_run_id: d.payroll_run_id,
      })));
      setLoading(false);
    });
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('employees').update(form).eq('id', id);
      if (error) throw error;
      toast.success('Employee updated');
      setEditing(false);
      const { data } = await supabase.from('employees').select('*').eq('id', id).single();
      setEmployee(data as Employee | null);
    } catch (err: unknown) {
      console.error('Employee update failed:', err);
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" /></div>;
  if (!employee) return <div className="text-center py-20 text-gray-400">Employee not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/hr')} className="btn-sm btn-secondary">
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <button className="btn-sm btn-secondary" onClick={() => setEditing(!editing)}>
          <Edit3 size={14} /> {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{employee.full_name_en}</h1>
            <p className="text-sm text-gray-500 font-mono mt-1">{employee.employee_code}</p>
            {employee.full_name_ar && <p className="text-sm text-gray-400 text-right" dir="rtl">{employee.full_name_ar}</p>}
          </div>
          <span className={`badge text-xs ${employee.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{employee.status}</span>
        </div>
      </div>

      {editing ? (
        <div className="card space-y-4">
          <h3 className="font-semibold">Edit Employee</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Full Name (EN)</label><input className="input" value={form.full_name_en || ''} onChange={(e) => setForm({ ...form, full_name_en: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Full Name (AR)</label><input className="input text-right" dir="rtl" value={form.full_name_ar || ''} onChange={(e) => setForm({ ...form, full_name_ar: e.target.value })} /></div>
            <div><label className="label">Job Title</label><input className="input" value={form.job_title || ''} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
            <div><label className="label">Department</label><input className="input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Hire Date</label><input type="date" className="input" value={form.hire_date || ''} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><label className="label">Basic Salary</label><input type="number" className="input" value={form.basic_salary ?? ''} onChange={(e) => setForm({ ...form, basic_salary: e.target.value ? parseFloat(e.target.value) : null })} /></div>
            <div><label className="label">Iqama Number</label><input className="input" value={form.iqama_number || ''} onChange={(e) => setForm({ ...form, iqama_number: e.target.value })} /></div>
            <div><label className="label">Contract Type</label>
              <select className="input" value={form.contract_type || 'full_time'} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                {['full_time','part_time','temporary','contract','probation'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="label">Employee Type</label>
              <select className="input" value={form.employee_type || 'staff'} onChange={(e) => setForm({ ...form, employee_type: e.target.value })}>
                {['staff','labor','supervisor','engineer','manager','admin','other'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['active','inactive','terminated','on_leave'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Nationality</label><input className="input" value={form.nationality || ''} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Briefcase size={16} /> Employment</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Job Title</span><span>{employee.job_title || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Department</span><span>{employee.department || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Employee Type</span><span className="capitalize">{employee.employee_type}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Contract Type</span><span className="capitalize">{employee.contract_type?.replace('_', ' ') || '-'}</span></div>
            </div>
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><CreditCard size={16} /> Personal</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><Phone size={12} /> Phone</span><span>{employee.phone || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><Mail size={12} /> Email</span><span>{employee.email || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><MapPin size={12} /> Nationality</span><span>{employee.nationality || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1"><CreditCard size={12} /> Iqama</span><span>{employee.iqama_number || '-'}</span></div>
            </div>
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} /> Dates</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Hire Date</span><span>{employee.hire_date || '-'}</span></div>
            </div>
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><DollarSign size={16} /> Compensation</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Basic Salary</span><span>{employee.basic_salary ? `${employee.basic_salary.toLocaleString()} SAR` : '-'}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Payroll History</h3>
        {payrolls.length === 0 ? (
          <p className="text-sm text-gray-400">No payroll records found</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Payroll Code</th><th>Period</th><th>Net Salary</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.payroll_code}</td>
                    <td className="text-sm">{p.period_start}</td>
                    <td className="text-sm">{p.net_salary ? `${Number(p.net_salary).toLocaleString()} SAR` : '-'}</td>
                    <td><span className={`badge text-xs capitalize ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
