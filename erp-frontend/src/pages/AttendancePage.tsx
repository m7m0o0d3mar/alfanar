import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import {
  Clock, CheckCircle, XCircle, MapPin,
  Download, ArrowRightFromLine, ArrowLeftToLine,
  BarChart3, List, Smartphone, LayoutDashboard,
  CalendarDays, Sun, Moon, AlertTriangle, Navigation,
} from 'lucide-react';
import type { AttendanceRecord, AttendanceSummary } from '../types';
import { exportCSV } from '../utils/csv';
import Pagination from '../components/Pagination';
import AttendanceDashboard from '../components/attendance/AttendanceDashboard';
import AttendanceCalendar from '../components/attendance/AttendanceCalendar';

export default function AttendancePage() {
  const { user } = useAuth();
  const t = useT();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clock' | 'records' | 'reports'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name_en: string; employee_code: string; project_id?: string }[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allMonthlyRecords, setAllMonthlyRecords] = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [summary, setSummary] = useState<AttendanceSummary>({
    total: 0, present: 0, late: 0, absent: 0, half_day: 0, overtime: 0,
    total_hours: 0, avg_hours: 0,
  });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 25;
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [clocking, setClocking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const GEOFENCE_RADIUS = 200;
  const [projectLocation, setProjectLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [geofenceDistance, setGeofenceDistance] = useState<number | null>(null);
  const [geofenceOk, setGeofenceOk] = useState<boolean | null>(null);
  const cancelled = useRef(false);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    cancelled.current = false;
    loadEmployees();
    return () => { cancelled.current = true; };
  }, []);

  useEffect(() => {
    cancelled.current = false;
    if (selectedEmployee) { loadToday(); loadMonthly(); loadRecords(); }
    return () => { cancelled.current = true; };
  }, [selectedEmployee, search, page]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'reports' && selectedEmployee) loadReport();
    return () => { cancelled.current = true; };
  }, [activeTab, reportMonth, search, page]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'dashboard' && selectedEmployee) loadMonthly();
    return () => { cancelled.current = true; };
  }, [activeTab]);

  useEffect(() => { setPage(1); setSearch(''); }, [activeTab]);

  useEffect(() => {
    cancelled.current = false;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled.current) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          fetchLocationName(lat, lng);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
    return () => { cancelled.current = true; };
  }, []);

  // Geofence check when location or project location changes
  useEffect(() => {
    if (location && projectLocation) {
      const d = haversineDistance(location.lat, location.lng, projectLocation.lat, projectLocation.lng);
      setGeofenceDistance(Math.round(d));
      setGeofenceOk(d <= GEOFENCE_RADIUS);
    } else {
      setGeofenceDistance(null);
      setGeofenceOk(null);
    }
  }, [location, projectLocation]);

  async function fetchLocationName(lat: number, lng: number) {
    try {
      const controller = new AbortController();
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`, { signal: controller.signal });
      const data = await res.json();
      if (!cancelled.current) setLocationName(data.display_name?.slice(0, 100) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch { if (!cancelled.current) setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`); }
  }

  function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function loadProjectLocation(projectId: string) {
    try {
      const { data } = await supabase
        .from('projects')
        .select('id, name_en, lat, lng')
        .eq('id', projectId)
        .single();
      if (cancelled.current) return;
      if (data && data.lat && data.lng) {
        setProjectLocation({ lat: Number(data.lat), lng: Number(data.lng), name: data.name_en });
      } else {
        setProjectLocation(null);
      }
    } catch { if (!cancelled.current) setProjectLocation(null); }
  }

  async function loadEmployees() {
    try {
      const d = (await supabase.from('employees').select('id, full_name_en, employee_code, project_id').eq('status', 'active').order('full_name_en')).data || [];
      if (cancelled.current) return;
      setEmployees(d);
      if (d.length > 0 && !selectedEmployee) {
        const match = d.find((e) => e.full_name_en?.toLowerCase().includes((user?.full_name_en || '').toLowerCase()));
        const emp = match || d[0];
        if (cancelled.current) return;
        setSelectedEmployee(emp.id);
        setSelectedEmployeeName(emp.full_name_en || '');
        if (emp.project_id) loadProjectLocation(emp.project_id);
      }
    } catch {}
  }

  async function loadToday() {
    if (!selectedEmployee) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', selectedEmployee)
        .gte('check_in', today)
        .lt('check_in', new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 10))
        .order('check_in', { ascending: false })
        .limit(1);
      if (cancelled.current) return;
      const rec = data?.[0] || null;
      setTodayRecord(rec);
      setCheckedIn(!!rec && !rec.check_out);
    } catch {}
  }

  /** Load ALL records for the current month (for calendar + dashboard) */
  async function loadMonthly() {
    if (!selectedEmployee) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', selectedEmployee)
        .gte('check_in', start)
        .lt('check_in', new Date(new Date(end).setDate(new Date(end).getDate() + 1)).toISOString().slice(0, 10))
        .order('check_in', { ascending: false });
      if (cancelled.current) return;
      const all: AttendanceRecord[] = data || [];
      setAllMonthlyRecords(all);
      const sum: AttendanceSummary = {
        total: all.length,
        present: all.filter((r) => r.status === 'present').length,
        late: all.filter((r) => r.status === 'late').length,
        absent: all.filter((r) => r.status === 'absent').length,
        half_day: all.filter((r) => r.status === 'half_day').length,
        overtime: all.filter((r) => r.status === 'overtime').length,
        total_hours: all.reduce((s, r) => s + Number(r.total_hours || 0), 0),
        avg_hours: all.length > 0 ? all.reduce((s, r) => s + Number(r.total_hours || 0), 0) / all.length : 0,
      };
      setSummary(sum);
    } catch {}
  }

  async function loadRecords() {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: false })
        .eq('employee_id', selectedEmployee)
        .gte('check_in', today)
        .lt('check_in', new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 10));
      if (search) {
        query = query.or(`status.ilike.%${search}%,check_in_location.ilike.%${search}%`);
      }
      const { data, count } = await query
        .order('check_in', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (cancelled.current) return;
      setRecords(data || []);
      if (count !== null) setTotalRecords(count);
    } catch {} finally { if (!cancelled.current) setLoading(false); }
  }

  async function loadReport() {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const startDate = reportMonth + '-01';
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().slice(0, 10);
      let query = supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: false })
        .eq('employee_id', selectedEmployee)
        .gte('check_in', startDate)
        .lt('check_in', new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1)).toISOString().slice(0, 10));
      if (search) {
        query = query.or(`status.ilike.%${search}%,check_in_location.ilike.%${search}%`);
      }
      const { data, count } = await query
        .order('check_in', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (cancelled.current) return;
      setRecords(data || []);
      if (count !== null) setTotalRecords(count);
    } catch {} finally { if (!cancelled.current) setLoading(false); }
  }

  async function handleCheckIn() {
    if (!selectedEmployee || clocking) return;
    if (geofenceOk !== null && location && projectLocation && !geofenceOk) {
      return;
    }
    setClocking(true);
    try {
      const { error } = await supabase.from('attendance_records').insert({
        employee_id: selectedEmployee,
        check_in: new Date().toISOString(),
        check_in_location: locationName,
        check_in_lat: location?.lat,
        check_in_lng: location?.lng,
        check_in_method: 'manual',
        status: new Date().getHours() >= 9 ? 'late' : 'present',
      });
      if (!error) { await loadToday(); await loadMonthly(); await loadRecords(); }
    } finally { setClocking(false); }
  }

  async function handleCheckOut() {
    if (!selectedEmployee || !todayRecord || clocking) return;
    setClocking(true);
    try {
      const checkIn = new Date(todayRecord.check_in);
      const checkOut = new Date();
      const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      const overtime = hours > 8 ? hours - 8 : 0;
      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out: checkOut.toISOString(),
          check_out_location: locationName,
          check_out_lat: location?.lat,
          check_out_lng: location?.lng,
          check_out_method: 'manual',
          total_hours: Math.round(hours * 100) / 100,
          overtime_hours: Math.round(overtime * 100) / 100,
          status: overtime > 0 ? 'overtime' : (new Date().getHours() >= 9 ? 'late' : 'present'),
        })
        .eq('id', todayRecord.id);
      if (!error) { await loadToday(); await loadMonthly(); await loadRecords(); }
    } finally { setClocking(false); }
  }

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const exportReport = () => exportCSV(records as unknown as Record<string, unknown>[], `attendance_${reportMonth}.csv`);

  const now = currentTime;
  const hours = now.getHours();
  const shiftIcon = hours >= 5 && hours < 12 ? Sun : hours >= 12 && hours < 17 ? Sun : Moon;
  const shiftLabel = hours >= 5 && hours < 12 ? 'Morning Shift' : hours >= 12 && hours < 17 ? 'Afternoon Shift' : 'Night Shift';
  const shiftClass = hours >= 5 && hours < 12 ? 'shift-morning' : hours >= 12 && hours < 17 ? 'shift-afternoon' : 'shift-night';

  function handleEmployeeChange(id: string) {
    setSelectedEmployee(id);
    const emp = employees.find(e => e.id === id);
    setSelectedEmployeeName(emp?.full_name_en || '');
    setProjectLocation(null);
    setGeofenceDistance(null);
    setGeofenceOk(null);
    setPage(1);
    if (emp?.project_id) loadProjectLocation(emp.project_id);
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Employee time tracking & check-in system</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select text-sm"
            style={{ width: '220px' }}
            value={selectedEmployee}
            onChange={(e) => handleEmployeeChange(e.target.value)}
          >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name_en} ({e.employee_code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'dashboard' ? 'tab-active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={16} /> Dashboard
        </button>
        <button className={`tab ${activeTab === 'clock' ? 'tab-active' : ''}`} onClick={() => setActiveTab('clock')}>
          <Clock size={16} /> Clock
        </button>
        <button className={`tab ${activeTab === 'records' ? 'tab-active' : ''}`} onClick={() => setActiveTab('records')}>
          <List size={16} /> Records
        </button>
        <button className={`tab ${activeTab === 'reports' ? 'tab-active' : ''}`} onClick={() => setActiveTab('reports')}>
          <BarChart3 size={16} /> Reports
        </button>
      </div>

      {/* ===== DASHBOARD TAB ===== */}
      {activeTab === 'dashboard' && (
        <AttendanceDashboard summary={summary} employeeName={selectedEmployeeName} />
      )}

      {/* ===== CLOCK TAB ===== */}
      {activeTab === 'clock' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Clock-in Widget */}
            <div className="glass-card p-6 text-center">
              {/* Live Time */}
              <div className="mb-4">
                <div className="text-4xl font-bold tabular-nums tracking-tight">
                  {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* Shift indicator */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className={`shift-badge ${shiftClass}`}>
                  {shiftIcon === Sun ? <Sun size={14} /> : shiftIcon === Moon ? <Moon size={14} /> : <Sun size={14} />}
                  {shiftLabel}
                </span>
              </div>

              <h2 className="text-lg font-semibold mb-5">
                {checkedIn ? 'You are checked in' : 'Ready to check in?'}
              </h2>

              <div className="flex flex-col items-center gap-4">
                <div
                  className={`attendance-clock ${checkedIn ? 'checked-in' : ''} ${!checkedIn && geofenceOk === false ? 'opacity-40 cursor-not-allowed' : ''}`}
                  onClick={!checkedIn && geofenceOk === false ? undefined : (checkedIn ? handleCheckOut : handleCheckIn)}
                >
                  {clocking ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
                  ) : checkedIn ? (
                    <>
                      <ArrowLeftToLine size={28} style={{ color: 'var(--color-success)' }} />
                      <span className="text-sm font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
                        Check Out
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowRightFromLine size={28} style={{ color: 'var(--color-primary)' }} />
                      <span className="text-sm font-semibold mt-1" style={{ color: 'var(--color-primary)' }}>
                        Check In
                      </span>
                    </>
                  )}
                </div>

                {location && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    <MapPin size={14} />
                    <span className="truncate max-w-xs">{locationName}</span>
                  </div>
                )}

                {/* Geofence status */}
                {projectLocation && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                    geofenceOk === null ? 'opacity-50' :
                    geofenceOk ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    <Navigation size={12} />
                    <span>
                      {geofenceOk === null
                        ? 'Checking location...'
                        : geofenceOk
                          ? `Within site area (${geofenceDistance}m)`
                          : `Outside geofence — ${geofenceDistance}m from ${projectLocation.name}`
                      }
                    </span>
                  </div>
                )}

                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {checkedIn
                    ? `Checked in at ${todayRecord ? formatTime(todayRecord.check_in) : '--'}`
                    : todayRecord
                      ? `Last check-out: ${formatTime(todayRecord.check_out || '')}`
                      : 'No activity today'
                  }
                </p>
              </div>
            </div>

            {/* Today's Activity */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Today's Activity</h3>
              {loading ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
              ) : records.length === 0 ? (
                <div className="empty-state py-8">
                  <Clock size={32} className="empty-state-icon" />
                  <p className="empty-state-title">No records today</p>
                  <p className="empty-state-desc">Use the clock above to check in</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice((page - 1) * pageSize, page * pageSize).map((r) => (
                        <tr key={r.id}>
                          <td className="text-xs font-mono">{formatTime(r.check_in)}</td>
                          <td>
                            <span className="badge badge-info">{r.check_in_method || 'manual'}</span>
                          </td>
                          <td className="text-xs max-w-[200px] truncate">{r.check_in_location || '--'}</td>
                          <td>
                            <span className={`badge capitalize ${
                              r.status === 'present' ? 'badge-success' :
                              r.status === 'late' ? 'badge-warning' :
                              r.status === 'absent' ? 'badge-danger' :
                              r.status === 'overtime' ? 'badge-info' : 'badge-neutral'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="text-xs">
                            {r.total_hours ? `${r.total_hours}h` : '--'}
                            {r.overtime_hours ? <span className="text-xs ml-1" style={{ color: 'var(--color-warning)' }}>(+{r.overtime_hours})</span> : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination page={page} pageSize={pageSize} total={totalRecords} onChange={setPage} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Monthly Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Days</span>
                  <span className="font-semibold">{summary.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-1"><CheckCircle size={14} style={{ color: 'var(--color-success)' }} /> Present</span>
                  <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{summary.present}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-1"><Clock size={14} style={{ color: 'var(--color-warning)' }} /> Late</span>
                  <span className="font-semibold" style={{ color: 'var(--color-warning)' }}>{summary.late}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-1"><XCircle size={14} style={{ color: 'var(--color-danger)' }} /> Absent</span>
                  <span className="font-semibold" style={{ color: 'var(--color-danger)' }}>{summary.absent}</span>
                </div>
                <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Hours</span>
                    <span className="font-semibold text-lg">{summary.total_hours.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Daily Avg</span>
                    <span className="text-sm">{summary.avg_hours.toFixed(1)}h</span>
                  </div>
                </div>
              </div>
            </div>

            {projectLocation && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold mb-3">Site Location</h3>
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{projectLocation.name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {projectLocation.lat.toFixed(6)}, {projectLocation.lng.toFixed(6)}
                    </p>
                    {geofenceDistance !== null && (
                      <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${
                        geofenceOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        <Navigation size={12} />
                        {geofenceDistance}m · {geofenceOk ? 'Inside' : 'Outside'} radius
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button className="btn btn-primary btn-sm w-full justify-start" onClick={() => setActiveTab('dashboard')}>
                  <LayoutDashboard size={14} /> View Dashboard
                </button>
                <button className="btn btn-secondary btn-sm w-full justify-start" onClick={() => setActiveTab('reports')}>
                  <BarChart3 size={14} /> Monthly Report
                </button>
                <button className="btn btn-secondary btn-sm w-full justify-start">
                  <CalendarDays size={14} /> View Calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECORDS TAB ===== */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Calendar */}
          <AttendanceCalendar
            records={allMonthlyRecords}
            year={new Date().getFullYear()}
            month={new Date().getMonth()}
          />

          {/* Today's records table */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Today's Records</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  className="input"
                  style={{ width: '200px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <button className="btn btn-secondary btn-sm" onClick={exportReport}>
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Duration</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No records</td></tr>
                  ) : (
                    records.slice((page - 1) * pageSize, page * pageSize).map((r) => (
                      <tr key={r.id}>
                        <td className="text-xs font-medium">{formatDate(r.check_in)}</td>
                        <td className="text-xs font-mono">{formatTime(r.check_in)}</td>
                        <td className="text-xs font-mono">{r.check_out ? formatTime(r.check_out) : '--'}</td>
                        <td className="text-xs">{r.total_hours ? `${r.total_hours}h` : '--'}</td>
                        <td className="text-xs max-w-[150px] truncate">{r.check_in_location || '--'}</td>
                        <td>
                          <span className={`badge capitalize text-xs ${
                            r.status === 'present' ? 'badge-success' :
                            r.status === 'late' ? 'badge-warning' :
                            r.status === 'absent' ? 'badge-danger' : 'badge-neutral'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={totalRecords} onChange={setPage} />
          </div>
        </div>
      )}

      {/* ===== REPORTS TAB ===== */}
      {activeTab === 'reports' && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold">Monthly Attendance Report</h3>
              <input
                type="month"
                className="input"
                style={{ width: '180px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exportReport}>
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="stat-glass text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{summary.present}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Present</p>
            </div>
            <div className="stat-glass text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{summary.late}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Late</p>
            </div>
            <div className="stat-glass text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{summary.absent}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Absent</p>
            </div>
            <div className="stat-glass text-center">
              <p className="text-2xl font-bold">{summary.total_hours.toFixed(0)}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Hours</p>
            </div>
          </div>

          {/* Calendar in reports */}
          <div className="mb-6">
            <AttendanceCalendar
              records={allMonthlyRecords}
              year={new Date(reportMonth + '-01').getFullYear()}
              month={new Date(reportMonth + '-01').getMonth()}
            />
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Overtime</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No records for this month</td></tr>
                ) : (
                  records.slice((page - 1) * pageSize, page * pageSize).map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs font-medium">{formatDate(r.check_in)}</td>
                      <td className="text-xs font-mono">{formatTime(r.check_in)}</td>
                      <td className="text-xs font-mono">{r.check_out ? formatTime(r.check_out) : '--'}</td>
                      <td className="text-xs">{r.total_hours?.toFixed(1) || '--'}h</td>
                      <td className="text-xs">{r.overtime_hours ? `${r.overtime_hours.toFixed(1)}h` : '--'}</td>
                      <td>
                        <span className={`badge capitalize text-xs ${
                          r.status === 'present' ? 'badge-success' :
                          r.status === 'late' ? 'badge-warning' :
                          r.status === 'absent' ? 'badge-danger' :
                          r.status === 'overtime' ? 'badge-info' : 'badge-neutral'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-xs max-w-[120px] truncate">{r.check_in_location || '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={totalRecords} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
