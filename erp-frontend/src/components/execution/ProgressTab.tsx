import { TrendingUp, CheckCircle, Clock, XCircle, Download, Upload } from 'lucide-react';
import EmptyState from '../EmptyState';

interface ProgressBreakdownItem {
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

interface ComputedProgress {
  percent: number; completed: number; total: number;
  breakdown: ProgressBreakdownItem[];
  divisionBreakdown: DivisionBreakdownItem[];
}

interface WorkRequest {
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

interface Project {
  id: string; name_en: string; project_code: string;
}

interface Props {
  projects: Project[];
  progressProjectId: string;
  onProjectChange: (id: string) => void;
  computedProgress: ComputedProgress;
  units: { id: string; project_id: string; unit_code: string; unit_type: string; zone: string; block: string }[];
  progressWrs: WorkRequest[];
  approvedWrs: WorkRequest[];
  pendingWrs: WorkRequest[];
  rejectedWrs: WorkRequest[];
  onExport: () => void;
  onImport: () => void;
  onNavigateWir: (id: string) => void;
}

export default function ProgressTab({
  projects, progressProjectId, onProjectChange, computedProgress,
  units, progressWrs, approvedWrs, pendingWrs, rejectedWrs,
  onExport, onImport, onNavigateWir,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div className="max-w-sm flex-1">
          <select className="input" value={progressProjectId} onChange={(e) => onProjectChange(e.target.value)}>
            <option value="">-- Select Project --</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>)}
          </select>
        </div>
        {progressProjectId && (
          <div className="flex gap-2 shrink-0">
            <button className="btn-sm btn-secondary" onClick={onExport}><Download size={14} /> Export CSV</button>
            <button className="btn-sm btn-secondary" onClick={onImport}><Upload size={14} /> Import CSV</button>
          </div>
        )}
      </div>

      {!progressProjectId ? (
        <EmptyState title="Select a Project" description="Choose a project above to view progress." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg" style={{backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)'}}><TrendingUp size={20} /></div>
                <div>
                  <div className="text-2xl font-bold">{progressWrs.length}</div>
                  <div className="text-xs text-gray-500">Total Work Requests</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg" style={{backgroundColor: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)'}}><CheckCircle size={20} /></div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{approvedWrs.length}</div>
                  <div className="text-xs text-gray-500">Approved</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg" style={{backgroundColor: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', color: 'var(--color-warning)'}}><Clock size={20} /></div>
                <div>
                  <div className="text-2xl font-bold text-amber-700">{pendingWrs.length}</div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg" style={{backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)'}}><XCircle size={20} /></div>
                <div>
                  <div className="text-2xl font-bold text-red-700">{rejectedWrs.length}</div>
                  <div className="text-xs text-gray-500">Rejected</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Project Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>{computedProgress.percent}% complete ({computedProgress.completed} of {computedProgress.total} units)</span>
                  <span>{computedProgress.percent}%</span>
                </div>
                <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${computedProgress.percent}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500">Weighted Units Completed</div>
                  <div className="text-lg font-semibold">{computedProgress.completed} / {computedProgress.total}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500">Weighted Progress</div>
                  <div className="text-lg font-semibold">{computedProgress.percent}%</div>
                </div>
              </div>
            </div>
          </div>

          {computedProgress.divisionBreakdown.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Progress by Division</h3>
              {computedProgress.divisionBreakdown.map(div => (
                <div key={div.division} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">{div.division}</h4>
                    <span className="text-sm font-medium">{div.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${div.percent}%` }} />
                  </div>
                  <div className="space-y-3">
                    {div.subDivisions.map(sub => (
                      <div key={sub.sub_division}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">{sub.sub_division}</span>
                          <span className="text-gray-500">{sub.percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${sub.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {computedProgress.breakdown.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Activity Progress Breakdown</h3>
              <div className="table-wrap">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>Division</th>
                      <th>Sub-Division</th>
                      <th>Activity</th>
                      <th>WBS</th>
                      <th>Weight %</th>
                      <th>Units Done</th>
                      <th>Total Units</th>
                      <th>Progress %</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedProgress.breakdown.map(item => (
                      <tr key={item.wbs_code || item.activity}>
                        <td>{item.division}</td>
                        <td className="text-gray-500">{item.sub_division || '-'}</td>
                        <td>{item.activity}</td>
                        <td className="font-mono text-xs">{item.wbs_code}</td>
                        <td>{item.activity_weight}%</td>
                        <td>{item.units_completed}</td>
                        <td>{item.total_units}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{backgroundColor: 'color-mix(in srgb, var(--color-text) 10%, transparent)'}}>
                              <div className="h-full rounded-full" style={{
                                width: `${item.progress_percent}%`,
                                backgroundColor: item.progress_percent >= 100 ? 'var(--color-success)' : item.progress_percent > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)'
                              }} />
                            </div>
                            <span>{item.progress_percent}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge text-xs ${item.status === 'completed' ? 'badge-success' : item.status === 'in_progress' ? 'badge-info' : 'badge-neutral'}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card space-y-3">
              <h4 className="font-semibold text-green-700 flex items-center gap-2"><CheckCircle size={16} /> Approved ({approvedWrs.length})</h4>
              {approvedWrs.length === 0 ? (
                <p className="text-sm text-gray-400">No approved requests</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {approvedWrs.map(wr => (
                    <div key={wr.id} className="p-2 border rounded-lg text-sm hover:bg-green-50 cursor-pointer" onClick={() => onNavigateWir(wr.id)}>
                      <div className="font-mono text-xs text-gray-500">{wr.wir_no}</div>
                      <div className="font-medium truncate">{wr.activity || '-'}</div>
                      <div className="text-xs text-gray-400">Unit: {wr.unit_id ? (units.find(u => u.id === wr.unit_id)?.unit_code || '-') : '-'}</div>
                      <div className="text-xs text-gray-400">{wr.inspection_date || '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card space-y-3">
              <h4 className="font-semibold text-amber-700 flex items-center gap-2"><Clock size={16} /> Pending ({pendingWrs.length})</h4>
              {pendingWrs.length === 0 ? (
                <p className="text-sm text-gray-400">No pending requests</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {pendingWrs.map(wr => (
                    <div key={wr.id} className="p-2 border rounded-lg text-sm hover:bg-amber-50 cursor-pointer" onClick={() => onNavigateWir(wr.id)}>
                      <div className="font-mono text-xs text-gray-500">{wr.wir_no}</div>
                      <div className="font-medium truncate">{wr.activity || '-'}</div>
                      <span className={`badge text-xs mt-1 ${
                        wr.status === 'pending_qc' ? 'badge-warning' :
                        wr.status === 'pending_consultant' ? 'badge-info' :
                        'bg-purple-100 text-purple-700'
                      }`}>{wr.status}</span>
                      <div className="text-xs text-gray-400 mt-1">{wr.request_date || '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card space-y-3">
              <h4 className="font-semibold text-red-700 flex items-center gap-2"><XCircle size={16} /> Rejected ({rejectedWrs.length})</h4>
              {rejectedWrs.length === 0 ? (
                <p className="text-sm text-gray-400">No rejected requests</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {rejectedWrs.map(wr => (
                    <div key={wr.id} className="p-2 border rounded-lg text-sm hover:bg-red-50 cursor-pointer" onClick={() => onNavigateWir(wr.id)}>
                      <div className="font-mono text-xs text-gray-500">{wr.wir_no}</div>
                      <div className="font-medium truncate">{wr.activity || '-'}</div>
                      <div className="text-xs text-red-600 mt-1">Reason: {wr.rejection_reason || 'N/A'}</div>
                      <div className="text-xs text-gray-400">{wr.inspection_date || '-'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
