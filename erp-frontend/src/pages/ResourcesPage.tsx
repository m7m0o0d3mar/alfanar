import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useT } from '../hooks/useTranslation';
import { Users, Wrench, HardHat, Briefcase, Plus } from 'lucide-react';
import ViewToggle from '../components/ViewToggle';
import Pagination from '../components/Pagination';

type TabKey = 'people' | 'equipment' | 'contractors';

interface ResourcePerson {
  id: string; full_name_en: string; job_title: string; employee_type: string;
}

interface ResourceEquipment {
  id: string; name: string; type: string; status: string;
}

interface ResourceContractor {
  id: string; company_id: string; contractor_type: string; is_approved: boolean;
  companies?: { name_en: string };
}

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'people', label: 'People', icon: Users },
  { key: 'equipment', label: 'Equipment', icon: Wrench },
  { key: 'contractors', label: 'Contractors', icon: HardHat },
];

export default function ResourcesPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabKey>('people');
  const [people, setPeople] = useState<ResourcePerson[]>([]);
  const [equipment, setEquipment] = useState<ResourceEquipment[]>([]);
  const [contractors, setContractors] = useState<ResourceContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [view, setView] = useState<'table' | 'kanban' | 'gantt'>('table');

  useEffect(() => { setPage(1); }, [activeTab]);
  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('employees').select('id, full_name_en, job_title, employee_type').limit(50).then(r => ({ data: r.data || [], error: r.error })),
      supabase.from('equipment').select('id, name, type, status').limit(50).then(r => ({ data: r.data || [], error: r.error })),
      supabase.from('contractors').select('*, companies(name_en)').limit(50).then(r => ({ data: r.data || [], error: r.error })),
    ]).then(([empRes, eqRes, conRes]) => {
      if (!empRes.error && empRes.data) setPeople(empRes.data);
      if (!eqRes.error && eqRes.data) setEquipment(eqRes.data);
      if (!conRes.error && conRes.data) setContractors(conRes.data);
      setLoading(false);
    });
  }, []);

  const ActiveIcon = tabs.find((t) => t.key === activeTab)!.icon;

  return (
    <div className="page-enter space-y-4">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
            <Briefcase size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1>Resources</h1>
            <p>Manage people, equipment, and contractors</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={setView} views={['table', 'kanban']} />
          <button className="btn btn-primary btn-sm">
            <Plus size={14} />
            Add {tabs.find((t) => t.key === activeTab)?.label}
          </button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`tab ${isActive ? 'tab-active' : ''}`}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : activeTab === 'people' ? (
        <>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {people.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No people assigned yet</td></tr>
              ) : people.slice((page - 1) * pageSize, page * pageSize).map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.full_name_en}</td>
                  <td><span className="badge badge-neutral">{p.job_title || p.employee_type || '—'}</span></td>
                  <td><button className="btn btn-xs btn-ghost">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={people.length} onChange={setPage} />
        </>
      ) : activeTab === 'equipment' ? (
        <>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {equipment.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No equipment registered</td></tr>
              ) : equipment.slice((page - 1) * pageSize, page * pageSize).map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.name}</td>
                  <td>{e.type || '—'}</td>
                  <td><span className={`badge ${e.status === 'available' ? 'badge-success' : e.status === 'in_use' ? 'badge-warning' : 'badge-neutral'}`}>{e.status}</span></td>
                  <td><button className="btn btn-xs btn-ghost">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={equipment.length} onChange={setPage} />
        </>
      ) : (
        <>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Company</th><th>Contract Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {contractors.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No contractors registered</td></tr>
              ) : contractors.slice((page - 1) * pageSize, page * pageSize).map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.companies?.name_en || c.company_id?.slice(0, 8) || '—'}</td>
                  <td>{c.contractor_type || '—'}</td>
                  <td><span className={`badge ${c.is_approved ? 'badge-success' : 'badge-neutral'}`}>{c.is_approved ? 'Active' : 'Inactive'}</span></td>
                  <td><button className="btn btn-xs btn-ghost">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={contractors.length} onChange={setPage} />
        </>
      )}
    </div>
  );
}
