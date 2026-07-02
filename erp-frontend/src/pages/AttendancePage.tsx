import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { useToast } from '../context/ToastContext';
import {
  Clock, CheckCircle, XCircle, MapPin,
  Download, ArrowRightFromLine, ArrowLeftToLine,
  BarChart3, List, LayoutDashboard,
  Sun, Moon, Navigation,
  Eye, Map as MapIcon, Share2, Printer,
  Plus, Edit3, Trash2, Shield, AlertTriangle,
  Settings as SettingsIcon, Clock3,
  FileText, CheckSquare,
  XSquare, ExternalLink, Camera, QrCode,
  Mail, RefreshCw,
} from 'lucide-react';
import type { AttendanceRecord, AttendanceSummary, ShiftDefinition, EmployeeShift, OvertimeRule, AttendanceRequest, RandomVerification } from '../types';
import {
  shiftDefinitionsApi, employeeShiftsApi, overtimeRulesApi,
  attendanceRequestsApi, randomVerificationsApi,
} from '../services/api';
import { exportCSV } from '../utils/csv';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import AttendanceDashboard from '../components/attendance/AttendanceDashboard';
import AttendanceCalendar from '../components/attendance/AttendanceCalendar';

type TabKey = 'dashboard' | 'clock' | 'records' | 'reports' | 'shifts' | 'requests' | 'map' | 'settings';

function calculateOvertime(record: AttendanceRecord, _shift?: ShiftDefinition): number {
  const hours = record.total_hours || 0;
  const threshold = _shift ? 8 : 8;
  if (hours > threshold) {
    return hours - threshold;
  }
  return 0;
}

function getCurrentShift(shifts: ShiftDefinition[]): ShiftDefinition | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (const s of shifts) {
    const parts = s.start_time.split(':');
    const startMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    const endParts = s.end_time.split(':');
    let endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    if (endMinutes <= startMinutes) endMinutes += 1440;
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return s;
    if (endMinutes > 1440 && currentMinutes < endMinutes - 1440) return s;
  }
  return null;
}

function sendWhatsApp(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function sendEmail(subject: string, body: string) {
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
}

function printReport() {
  window.print();
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  leave: 'Leave',
  permission: 'Permission',
  remote: 'Remote Work',
  missed_punch: 'Missed Punch',
  correction: 'Correction',
  escalation: 'Escalation',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'Sick Leave',
  annual: 'Annual Leave',
  emergency: 'Emergency Leave',
  personal: 'Personal Leave',
  other: 'Other',
};

const VERIFICATION_TYPE_LABELS: Record<string, string> = {
  photo: 'Photo',
  location: 'Location',
  biometric: 'Biometric',
  qr_code: 'QR Code',
  pin: 'PIN Code',
};

export default function AttendancePage() {
  const { user, hasPermission } = useAuth();
  const t = useT();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name_en: string; employee_code: string; project_id?: string; project_name?: string; department_id?: string; department_name?: string }[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [projects, setProjects] = useState<{ id: string; project_code: string; name_en: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; code: string; name_en: string }[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  
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
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => {
    const d = new Date(); return d.toISOString().slice(0, 10);
  });
  const [clocking, setClocking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const GEOFENCE_RADIUS = 200;
  const [projectLocation, setProjectLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [geofenceDistance, setGeofenceDistance] = useState<number | null>(null);
  const [geofenceOk, setGeofenceOk] = useState<boolean | null>(null);
  const cancelled = useRef(false);

  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<(EmployeeShift & { shift_definitions?: ShiftDefinition })[]>([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Partial<ShiftDefinition> | null>(null);
  const [showAssignShiftModal, setShowAssignShiftModal] = useState(false);
  const [assignShiftEmployeeId, setAssignShiftEmployeeId] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignEffectiveFrom, setAssignEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [assignEffectiveTo, setAssignEffectiveTo] = useState('');

  const [attendanceRequests, setAttendanceRequests] = useState<AttendanceRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestFilters, setRequestFilters] = useState({ status: '', type: '', dateFrom: '', dateTo: '' });
  const [newRequest, setNewRequest] = useState<Partial<AttendanceRequest>>({
    request_type: 'leave',
    leave_type: 'annual',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    status: 'draft',
  });

  const [overtimeRules, setOvertimeRules] = useState<OvertimeRule[]>([]);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [editingOvertimeRule, setEditingOvertimeRule] = useState<Partial<OvertimeRule> | null>(null);
  const [defaultOvertimeRate, setDefaultOvertimeRate] = useState('1.5');
  const [defaultDeductionRate, setDefaultDeductionRate] = useState('1.0');

  const [mapRecords, setMapRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMapRecord, setSelectedMapRecord] = useState<AttendanceRecord | null>(null);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<RandomVerification | null>(null);
  const [verificationPin, setVerificationPin] = useState('');

  const [reportFilterProject, setReportFilterProject] = useState('');
  const [reportFilterDepartment, setReportFilterDepartment] = useState('');
  const [reportFilterShift, setReportFilterShift] = useState('');

  const [recordsFilterProject, setRecordsFilterProject] = useState('');
  const [recordsFilterDepartment, setRecordsFilterDepartment] = useState('');
  const [recordsFilterShift, setRecordsFilterShift] = useState('');

  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    cancelled.current = false;
    loadEmployees();
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cancelled.current = false;
    if (selectedEmployee) { loadToday(); loadMonthly(); loadRecords(); }
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, search, page]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'reports' && selectedEmployee) loadReport();
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportFrom, reportTo, search, page, reportFilterProject, reportFilterDepartment, reportFilterShift]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'dashboard' && selectedEmployee) loadMonthly();
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'shifts') { loadShifts(); loadEmployeeShifts(); }
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'requests') { loadRequests(); }
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, requestFilters]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'settings') loadOvertimeRules();
    return () => { cancelled.current = true; };
  }, [activeTab]);

  useEffect(() => {
    cancelled.current = false;
    if (activeTab === 'map') { loadMapRecords(); }
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (filterProject && selectedEmployee) {
      const emp = employees.find(e => e.id === selectedEmployee);
      if (emp && emp.project_id !== filterProject) {
        setSelectedEmployee('');
        setSelectedEmployeeName('');
        setProjectLocation(null);
        setGeofenceDistance(null);
        setGeofenceOk(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject]);

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

  useEffect(() => {
    if (selectedEmployee && activeTab === 'clock') checkRandomVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, activeTab]);

  useEffect(() => {
    if (selectedEmployee && activeTab === 'dashboard') loadPendingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, activeTab]);

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
      const [empRes, projRes, deptRes] = await Promise.all([
        supabase.from('employees').select('id, full_name_en, employee_code, project_id, department_id, email').eq('status', 'active').order('full_name_en'),
        supabase.from('projects').select('id, project_code, name_en').eq('is_active', true).order('project_code'),
        supabase.from('departments').select('id, code, name_en').eq('is_active', true).order('code'),
      ]);
      if (cancelled.current) return;
      const projMap = Object.fromEntries(((projRes.data || []) as { id: string; project_code: string }[]).map(p => [p.id, p]));
      const deptMap = Object.fromEntries(((deptRes.data || []) as { id: string; code: string; name_en: string }[]).map(d => [d.id, d]));
      const d = (empRes.data || []).map((e: any) => ({
        ...e,
        project_name: projMap[e.project_id || '']?.project_code || '',
        department_name: deptMap[e.department_id || '']?.name_en || '',
      }));
      setEmployees(d);
      setProjects((projRes.data || []) as { id: string; project_code: string; name_en: string }[]);
      setDepartments((deptRes.data || []) as { id: string; code: string; name_en: string }[]);
      if (d.length > 0 && !selectedEmployee) {
        let match = user?.email ? d.find((e) => e.email?.toLowerCase() === user.email!.toLowerCase()) : undefined;
        if (!match) match = d.find((e) => e.full_name_en?.toLowerCase().includes((user?.full_name_en || '').toLowerCase()));
        const emp = match || d[0];
        if (cancelled.current) return;
        setSelectedEmployee(emp.id);
        setSelectedEmployeeName(emp.full_name_en || '');
        if (emp.project_id) loadProjectLocation(emp.project_id);
      }
    } catch (err) {
      console.error('Load employees failed:', err);
    }
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
    } catch (err) {
      console.error('Load today failed:', err);
    }
  }

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
    } catch (err) {
      console.error('Load monthly failed:', err);
    }
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
    } catch (err) {
      console.error('Load records failed:', err);
    } finally { if (!cancelled.current) setLoading(false); }
  }

  async function loadReport() {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      let query = supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: false })
        .eq('employee_id', selectedEmployee)
        .gte('check_in', reportFrom)
        .lt('check_in', new Date(new Date(reportTo).setDate(new Date(reportTo).getDate() + 1)).toISOString().slice(0, 10));
      if (search) {
        query = query.or(`status.ilike.%${search}%,check_in_location.ilike.%${search}%`);
      }
      if (reportFilterProject) {
        query = query.eq('project_id', reportFilterProject);
      }
      const { data, count } = await query
        .order('check_in', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (cancelled.current) return;
      setRecords(data || []);
      if (count !== null) setTotalRecords(count);
    } catch (err) {
      console.error('Load report failed:', err);
    } finally { if (!cancelled.current) setLoading(false); }
  }

  async function handleCheckIn() {
    if (!selectedEmployee || clocking) return;
    if (geofenceOk !== null && location && projectLocation && !geofenceOk) return;
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
      if (error) {
        toast.error('Failed to check in');
      } else {
        toast.success('Checked in successfully');
        await loadToday(); await loadMonthly(); await loadRecords();
      }
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
      if (error) {
        toast.error('Failed to check out');
      } else {
        toast.success('Checked out successfully');
        await loadToday(); await loadMonthly(); await loadRecords();
      }
    } finally { setClocking(false); }
  }

  async function checkRandomVerification() {
    try {
      const pending = await randomVerificationsApi.list(selectedEmployee, true);
      if (cancelled.current) return;
      if (pending.length > 0) {
        setPendingVerification(pending[0]);
        setShowVerificationModal(true);
      }
    } catch { /* silent */ }
  }

  async function handleVerifyPin() {
    if (!pendingVerification || !verificationPin) return;
    try {
      await randomVerificationsApi.update(pendingVerification.id, {
        status: 'verified',
        responded_at: new Date().toISOString(),
        pin_code: verificationPin,
      });
      toast.success('Verification successful');
      setShowVerificationModal(false);
      setVerificationPin('');
      setPendingVerification(null);
    } catch (err) {
      toast.error('Verification failed');
      console.error(err);
    }
  }

  const now = currentTime;
  const hours = now.getHours();
  const ShiftIcon = hours >= 5 && hours < 12 ? Sun : hours >= 12 && hours < 17 ? Sun : Moon;
  const shiftLabel = hours >= 5 && hours < 12 ? 'Morning Shift' : hours >= 12 && hours < 17 ? 'Afternoon Shift' : 'Night Shift';

  const filteredEmployees = employees.filter(e => {
    if (filterProject && e.project_id !== filterProject) return false;
    if (filterDepartment && e.department_id !== filterDepartment) return false;
    return true;
  });

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

  const exportReport = () => exportCSV(records as unknown as Record<string, unknown>[], `attendance_report_${reportFrom}_${reportTo}.csv`);

  async function loadPendingRequests() {
    try {
      const reqs = await attendanceRequestsApi.list(selectedEmployee);
      const pending = reqs.filter(r => r.status === 'pending').length;
      setPendingRequestCount(pending);
    } catch { /* silent */ }
  }

  async function loadShifts() {
    try {
      const data = await shiftDefinitionsApi.list();
      if (!cancelled.current) setShifts(data);
    } catch (err) { console.error('Load shifts failed:', err); }
  }

  async function loadEmployeeShifts() {
    try {
      const data = await employeeShiftsApi.list(selectedEmployee || undefined);
      if (!cancelled.current) setEmployeeShifts(data);
    } catch (err) { console.error('Load employee shifts failed:', err); }
  }

  async function handleSaveShift() {
    if (!editingShift) return;
    try {
      await shiftDefinitionsApi.upsert(editingShift);
      toast.success('Shift saved');
      setShowShiftModal(false);
      setEditingShift(null);
      loadShifts();
    } catch (err) {
      toast.error('Failed to save shift');
      console.error(err);
    }
  }

  async function handleDeleteShift(id: string) {
    if (!confirm('Delete this shift definition?')) return;
    try {
      await shiftDefinitionsApi.remove(id);
      toast.success('Shift deleted');
      loadShifts();
    } catch (err) {
      toast.error('Failed to delete shift');
      console.error(err);
    }
  }

  async function handleAssignShift() {
    if (!assignShiftEmployeeId || !assignShiftId) return;
    try {
      await employeeShiftsApi.upsert({
        employee_id: assignShiftEmployeeId,
        shift_id: assignShiftId,
        effective_from: assignEffectiveFrom,
        effective_to: assignEffectiveTo || undefined,
      });
      toast.success('Shift assigned');
      setShowAssignShiftModal(false);
      setAssignShiftEmployeeId('');
      setAssignShiftId('');
      loadEmployeeShifts();
    } catch (err) {
      toast.error('Failed to assign shift');
      console.error(err);
    }
  }

  async function handleRemoveEmployeeShift(id: string) {
    if (!confirm('Remove this shift assignment?')) return;
    try {
      await employeeShiftsApi.remove(id);
      toast.success('Assignment removed');
      loadEmployeeShifts();
    } catch (err) {
      toast.error('Failed to remove assignment');
      console.error(err);
    }
  }

  async function loadRequests() {
    if (!selectedEmployee) return;
    try {
      const data = await attendanceRequestsApi.list(selectedEmployee);
      if (cancelled.current) return;
      let filtered = data;
      if (requestFilters.status) filtered = filtered.filter(r => r.status === requestFilters.status);
      if (requestFilters.type) filtered = filtered.filter(r => r.request_type === requestFilters.type);
      if (requestFilters.dateFrom) filtered = filtered.filter(r => r.start_date >= requestFilters.dateFrom);
      if (requestFilters.dateTo) filtered = filtered.filter(r => r.end_date <= requestFilters.dateTo);
      setAttendanceRequests(filtered);
    } catch (err) { console.error('Load requests failed:', err); }
  }

  async function handleCreateRequest() {
    if (!selectedEmployee || !newRequest.start_date || !newRequest.end_date) return;
    try {
      await attendanceRequestsApi.create({
        ...newRequest,
        employee_id: selectedEmployee,
        created_by: user?.id,
      });
      toast.success('Request created');
      setShowRequestModal(false);
      setNewRequest({
        request_type: 'leave',
        leave_type: 'annual',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        status: 'draft',
      });
      loadRequests();
    } catch (err) {
      toast.error('Failed to create request');
      console.error(err);
    }
  }

  async function handleApproveRequest(id: string) {
    try {
      await attendanceRequestsApi.update(id, { status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() });
      toast.success('Request approved');
      loadRequests();
    } catch (err) {
      toast.error('Failed to approve request');
      console.error(err);
    }
  }

  async function handleRejectRequest(id: string) {
    try {
      await attendanceRequestsApi.update(id, { status: 'rejected', approved_by: user?.id, approved_at: new Date().toISOString() });
      toast.success('Request rejected');
      loadRequests();
    } catch (err) {
      toast.error('Failed to reject request');
      console.error(err);
    }
  }

  async function handleDeleteRequest(id: string) {
    if (!confirm('Delete this request?')) return;
    try {
      await attendanceRequestsApi.remove(id);
      toast.success('Request deleted');
      loadRequests();
    } catch (err) {
      toast.error('Failed to delete request');
      console.error(err);
    }
  }

  async function loadOvertimeRules() {
    try {
      const data = await overtimeRulesApi.list();
      if (!cancelled.current) setOvertimeRules(data);
    } catch (err) { console.error('Load overtime rules failed:', err); }
  }

  async function handleSaveOvertimeRule() {
    if (!editingOvertimeRule) return;
    try {
      await overtimeRulesApi.upsert(editingOvertimeRule);
      toast.success('Overtime rule saved');
      setShowOvertimeModal(false);
      setEditingOvertimeRule(null);
      loadOvertimeRules();
    } catch (err) {
      toast.error('Failed to save rule');
      console.error(err);
    }
  }

  async function handleDeleteOvertimeRule(id: string) {
    if (!confirm('Delete this overtime rule?')) return;
    try {
      await overtimeRulesApi.remove(id);
      toast.success('Rule deleted');
      loadOvertimeRules();
    } catch (err) {
      toast.error('Failed to delete rule');
      console.error(err);
    }
  }

  async function loadMapRecords() {
    try {
      let query = supabase
        .from('attendance_records')
        .select('*')
        .not('check_in_lat', 'is', null)
        .not('check_in_lng', 'is', null)
        .order('check_in', { ascending: false })
        .limit(100);
      if (selectedEmployee) query = query.eq('employee_id', selectedEmployee);
      const { data } = await query;
      if (!cancelled.current) setMapRecords(data || []);
    } catch (err) { console.error('Load map records failed:', err); }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'present': return 'badge-success';
      case 'late': return 'badge-warning';
      case 'absent': return 'badge-danger';
      case 'overtime': return 'badge-info';
      case 'half_day': return 'badge-warning';
      default: return 'badge-neutral';
    }
  };

  const getRequestStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      case 'pending': return 'badge-warning';
      case 'draft': return 'badge-neutral';
      case 'cancelled': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  const mapCenter = useCallback(() => {
    if (selectedMapRecord && selectedMapRecord.check_in_lat && selectedMapRecord.check_in_lng) {
      return `${selectedMapRecord.check_in_lat},${selectedMapRecord.check_in_lng}`;
    }
    if (mapRecords.length > 0 && mapRecords[0].check_in_lat && mapRecords[0].check_in_lng) {
      return `${mapRecords[0].check_in_lat},${mapRecords[0].check_in_lng}`;
    }
    return '24.7136,46.6753';
  }, [selectedMapRecord, mapRecords]);

  const currentShift = getCurrentShift(shifts);

  function openMapPopup(lat: number | undefined | null, lng: number | undefined | null) {
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Employee time tracking & check-in system</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select text-sm"
            style={{ width: '150px' }}
            value={filterProject}
            onChange={(e) => { setFilterProject(e.target.value); setSelectedEmployee(''); }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_code}</option>
            ))}
          </select>
          <select
            className="select text-sm"
            style={{ width: '150px' }}
            value={filterDepartment}
            onChange={(e) => { setFilterDepartment(e.target.value); setSelectedEmployee(''); }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name_en}</option>
            ))}
          </select>
          <select
            className="select text-sm"
            style={{ width: '220px' }}
            value={selectedEmployee}
            onChange={(e) => handleEmployeeChange(e.target.value)}
          >
            {filteredEmployees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name_en} ({e.employee_code})</option>
            ))}
          </select>
        </div>
      </div>

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
        <button className={`tab ${activeTab === 'shifts' ? 'tab-active' : ''}`} onClick={() => setActiveTab('shifts')}>
          <Clock3 size={16} /> Shifts
        </button>
        <button className={`tab ${activeTab === 'requests' ? 'tab-active' : ''}`} onClick={() => setActiveTab('requests')}>
          <FileText size={16} /> Requests
        </button>
        <button className={`tab ${activeTab === 'map' ? 'tab-active' : ''}`} onClick={() => setActiveTab('map')}>
          <MapIcon size={16} /> Map
        </button>
        <button className={`tab ${activeTab === 'settings' ? 'tab-active' : ''}`} onClick={() => setActiveTab('settings')}>
          <SettingsIcon size={16} /> Settings
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          <AttendanceDashboard summary={summary} employeeName={selectedEmployeeName} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentShift && (
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Clock3 size={14} style={{ color: 'var(--color-primary)' }} /> Current Shift
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Shift</span>
                    <span className="font-medium">{currentShift.name_en} ({currentShift.code})</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Time</span>
                    <span className="font-medium">{currentShift.start_time} - {currentShift.end_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Grace</span>
                    <span className="font-medium">{currentShift.grace_minutes} min</span>
                  </div>
                  {currentShift.overtime_rate && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-secondary)' }}>OT Rate</span>
                      <span className="font-medium">{currentShift.overtime_rate}x</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="glass-card p-4">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Shield size={14} style={{ color: 'var(--color-info)' }} /> Verification Status
              </h4>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {pendingVerification ? (
                  <div className="flex items-center gap-2" style={{ color: 'var(--color-warning)' }}>
                    <AlertTriangle size={14} />
                    <span className="font-medium">Pending verification required</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2" style={{ color: 'var(--color-success)' }}>
                    <CheckCircle size={14} />
                    <span className="font-medium">No pending verification</span>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card p-4">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <FileText size={14} style={{ color: 'var(--color-warning)' }} /> Pending Requests
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{pendingRequestCount}</span>
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {pendingRequestCount === 1 ? 'request pending' : 'requests pending'}
                </span>
              </div>
              {pendingRequestCount > 0 && (
                <button className="btn btn-secondary btn-sm mt-3" onClick={() => setActiveTab('requests')}>
                  <Eye size={14} /> View Requests
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clock' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-6 text-center">
              <div className="mb-4">
                <div className="text-4xl font-bold tabular-nums tracking-tight">
                  {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-5">
                <span className="shift-badge shift-morning flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10">
                  <ShiftIcon size={14} />
                  {shiftLabel}
                </span>
                {currentShift && (
                  <span className="shift-badge px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: currentShift.color || 'var(--color-primary)', color: '#fff', opacity: 0.8 }}>
                    {currentShift.name_en} ({currentShift.start_time} - {currentShift.end_time})
                  </span>
                )}
              </div>

              {currentShift && (
                <div className="flex items-center justify-center gap-4 mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span>Grace: {currentShift.grace_minutes}min</span>
                  {currentShift.overtime_rate && <span>OT: {currentShift.overtime_rate}x</span>}
                  {currentShift.is_night_shift && <span>Night Shift</span>}
                </div>
              )}

              <h2 className="text-lg font-semibold mb-5">
                {checkedIn ? 'You are checked in' : 'Ready to check in?'}
              </h2>

              <div className="flex flex-col items-center gap-4">
                <div
                  className={`attendance-clock ${checkedIn ? 'checked-in' : ''} ${!checkedIn && geofenceOk === false ? 'opacity-40 cursor-not-allowed' : ''}`}
                  onClick={!checkedIn && geofenceOk === false ? undefined : hasPermission('attendance', 'edit') ? (checkedIn ? handleCheckOut : handleCheckIn) : undefined}
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
                    <button className="btn btn-secondary btn-sm ml-2" onClick={() => openMapPopup(location.lat, location.lng)}>
                      <MapIcon size={12} /> Map
                    </button>
                  </div>
                )}

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

                <div className="flex items-center gap-2 mt-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => printReport()}>
                    <Printer size={14} /> Print Today
                  </button>
                  {todayRecord && todayRecord.check_in_lat && todayRecord.check_in_lng && (
                    <button className="btn btn-secondary btn-sm" onClick={() => openMapPopup(todayRecord.check_in_lat, todayRecord.check_in_lng)}>
                      <MapIcon size={14} /> View on Map
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Today's Activity</h3>
              {loading ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
              ) : records.length === 0 ? (
                <EmptyState icon={<Clock size={32} />} title="No records today" description="Use the clock above to check in" />
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
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td className="text-xs font-mono">{formatTime(r.check_in)}</td>
                          <td>
                            <span className="badge badge-info">{r.check_in_method || 'manual'}</span>
                          </td>
                          <td className="text-xs max-w-[200px] truncate">{r.check_in_location || '--'}</td>
                          <td>
                            <span className={`badge capitalize ${getStatusBadgeClass(r.status)}`}>
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
            </div>
          </div>

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
                    <button className="btn btn-secondary btn-sm mt-2" onClick={() => openMapPopup(projectLocation.lat, projectLocation.lng)}>
                      <MapIcon size={12} /> View on Map
                    </button>
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
                <button className="btn btn-secondary btn-sm w-full justify-start" onClick={() => setActiveTab('requests')}>
                  <FileText size={14} /> New Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'records' && (
        <div className="space-y-4">
          <AttendanceCalendar
            records={allMonthlyRecords}
            year={new Date().getFullYear()}
            month={new Date().getMonth()}
          />

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Attendance Records</h3>
              <div className="flex items-center gap-2">
                <select
                  className="select text-sm"
                  style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={recordsFilterProject}
                  onChange={(e) => setRecordsFilterProject(e.target.value)}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_code}</option>
                  ))}
                </select>
                <select
                  className="select text-sm"
                  style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={recordsFilterDepartment}
                  onChange={(e) => setRecordsFilterDepartment(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name_en}</option>
                  ))}
                </select>
                <select
                  className="select text-sm"
                  style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={recordsFilterShift}
                  onChange={(e) => setRecordsFilterShift(e.target.value)}
                >
                  <option value="">All Shifts</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name_en}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search..."
                  className="input"
                  style={{ width: '160px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No records</td></tr>
                  ) : (
                    records.map((r) => (
                      <tr key={r.id}>
                        <td className="text-xs font-medium">{formatDate(r.check_in)}</td>
                        <td className="text-xs font-mono">{formatTime(r.check_in)}</td>
                        <td className="text-xs font-mono">{r.check_out ? formatTime(r.check_out) : '--'}</td>
                        <td className="text-xs">{r.total_hours ? `${r.total_hours}h` : '--'}</td>
                        <td className="text-xs max-w-[120px] truncate">{r.check_in_location || '--'}</td>
                        <td>
                          <span className={`badge capitalize text-xs ${getStatusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {r.check_in_lat && r.check_in_lng && (
                              <button className="btn btn-secondary btn-sm" onClick={() => openMapPopup(r.check_in_lat, r.check_in_lng)} title="View on map">
                                <MapIcon size={12} />
                              </button>
                            )}
                            {hasPermission('attendance', 'edit') && (
                              <button className="btn btn-secondary btn-sm" onClick={() => {
                                setNewRequest({
                                  request_type: 'correction',
                                  start_date: r.check_in.slice(0, 10),
                                  end_date: r.check_in.slice(0, 10),
                                  reason: `Correction for record ${r.id}`,
                                });
                                setActiveTab('requests');
                                setShowRequestModal(true);
                              }} title="Request correction">
                                <Edit3 size={12} />
                              </button>
                            )}
                          </div>
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

      {activeTab === 'reports' && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-semibold">Attendance Report</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>From</label>
                <input
                  type="date"
                  className="input"
                  style={{ width: '150px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                />
                <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>To</label>
                <input
                  type="date"
                  className="input"
                  style={{ width: '150px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                />
              </div>
              <select
                className="select text-sm"
                style={{ width: '130px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                value={reportFilterProject}
                onChange={(e) => setReportFilterProject(e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_code}</option>
                ))}
              </select>
              <select
                className="select text-sm"
                style={{ width: '130px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                value={reportFilterDepartment}
                onChange={(e) => setReportFilterDepartment(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name_en}</option>
                ))}
              </select>
              <select
                className="select text-sm"
                style={{ width: '130px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                value={reportFilterShift}
                onChange={(e) => setReportFilterShift(e.target.value)}
              >
                <option value="">All Shifts</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name_en}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary btn-sm" onClick={exportReport}>
                <Download size={14} /> Export CSV
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => printReport()}>
                <Printer size={14} /> Print
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => sendWhatsApp(
                `Attendance Report for ${selectedEmployeeName}\nPeriod: ${reportFrom} to ${reportTo}\nPresent: ${summary.present}, Late: ${summary.late}, Absent: ${summary.absent}, Total Hours: ${summary.total_hours.toFixed(1)}`
              )}>
                <Share2 size={14} /> WhatsApp
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => sendEmail(
                `Attendance Report - ${selectedEmployeeName}`,
                `Attendance Report for ${selectedEmployeeName}\nPeriod: ${reportFrom} to ${reportTo}\nPresent: ${summary.present}\nLate: ${summary.late}\nAbsent: ${summary.absent}\nTotal Hours: ${summary.total_hours.toFixed(1)}`
              )}>
                <Mail size={14} /> Email
              </button>
            </div>
          </div>

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

          <div className="mb-6">
            <AttendanceCalendar
              records={allMonthlyRecords}
              year={new Date(reportFrom || reportTo).getFullYear()}
              month={new Date(reportFrom || reportTo).getMonth()}
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
                  <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No records for this period</td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs font-medium">{formatDate(r.check_in)}</td>
                      <td className="text-xs font-mono">{formatTime(r.check_in)}</td>
                      <td className="text-xs font-mono">{r.check_out ? formatTime(r.check_out) : '--'}</td>
                      <td className="text-xs">{r.total_hours?.toFixed(1) || '--'}h</td>
                      <td className="text-xs">{r.overtime_hours ? `${r.overtime_hours.toFixed(1)}h` : '--'}</td>
                      <td>
                        <span className={`badge capitalize text-xs ${getStatusBadgeClass(r.status)}`}>
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

      {activeTab === 'shifts' && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Shift Definitions</h3>
              {hasPermission('attendance', 'edit') && (
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setEditingShift({
                    code: '',
                    name_en: '',
                    name_ar: '',
                    start_time: '08:00',
                    end_time: '17:00',
                    grace_minutes: 15,
                    is_night_shift: false,
                    is_active: true,
                    overtime_rate: 1.5,
                    deduction_rate: 1.0,
                    work_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                    color: '#3b82f6',
                  });
                  setShowShiftModal(true);
                }}>
                  <Plus size={14} /> New Shift
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name (EN)</th>
                    <th>Name (AR)</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Grace</th>
                    <th>Night</th>
                    <th>OT Rate</th>
                    <th>Work Days</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No shifts defined</td></tr>
                  ) : (
                    shifts.map((s) => (
                      <tr key={s.id}>
                        <td className="text-xs font-mono"
                          style={{ borderLeft: `3px solid ${s.color || 'var(--color-primary)'}` }}>
                          {s.code}
                        </td>
                        <td className="text-xs">{s.name_en}</td>
                        <td className="text-xs">{s.name_ar || '--'}</td>
                        <td className="text-xs font-mono">{s.start_time}</td>
                        <td className="text-xs font-mono">{s.end_time}</td>
                        <td className="text-xs">{s.grace_minutes}min</td>
                        <td className="text-xs">{s.is_night_shift ? <Moon size={14} /> : <Sun size={14} />}</td>
                        <td className="text-xs">{s.overtime_rate ? `${s.overtime_rate}x` : '--'}</td>
                        <td className="text-xs">{(s.work_days || []).join(', ')}</td>
                        <td>
                          <span className={`badge text-xs ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {hasPermission('attendance', 'edit') && (
                              <>
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                  setEditingShift(s);
                                  setShowShiftModal(true);
                                }}>
                                  <Edit3 size={12} />
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteShift(s.id)}>
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Employee Shift Assignments</h3>
              {hasPermission('attendance', 'edit') && (
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setAssignShiftEmployeeId(selectedEmployee);
                  setAssignShiftId('');
                  setAssignEffectiveFrom(new Date().toISOString().slice(0, 10));
                  setAssignEffectiveTo('');
                  setShowAssignShiftModal(true);
                }}>
                  <Plus size={14} /> Assign Shift
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Shift</th>
                    <th>Effective From</th>
                    <th>Effective To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeShifts.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No assignments</td></tr>
                  ) : (
                    employeeShifts.map((es) => {
                      const emp = employees.find(e => e.id === es.employee_id);
                      return (
                        <tr key={es.id}>
                          <td className="text-xs">{emp?.full_name_en || es.employee_id}</td>
                          <td className="text-xs font-medium">
                            <span style={{ color: es.shift_definitions?.color || 'var(--color-primary)' }}>
                              {es.shift_definitions?.name_en || es.shift_id}
                            </span>
                          </td>
                          <td className="text-xs">{es.effective_from}</td>
                          <td className="text-xs">{es.effective_to || 'Ongoing'}</td>
                          <td>
                            {hasPermission('attendance', 'edit') && (
                              <button className="btn btn-secondary btn-sm" onClick={() => handleRemoveEmployeeShift(es.id)}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Attendance Requests</h3>
              <div className="flex items-center gap-2">
                <select
                  className="select text-sm"
                  style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={requestFilters.status}
                  onChange={(e) => setRequestFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  className="select text-sm"
                  style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={requestFilters.type}
                  onChange={(e) => setRequestFilters(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="">All Types</option>
                  <option value="leave">Leave</option>
                  <option value="permission">Permission</option>
                  <option value="remote">Remote Work</option>
                  <option value="missed_punch">Missed Punch</option>
                  <option value="correction">Correction</option>
                  <option value="escalation">Escalation</option>
                </select>
                <input
                  type="date"
                  className="input"
                  style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={requestFilters.dateFrom}
                  onChange={(e) => setRequestFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  placeholder="From"
                />
                <input
                  type="date"
                  className="input"
                  style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={requestFilters.dateTo}
                  onChange={(e) => setRequestFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  placeholder="To"
                />
                <button className="btn btn-primary btn-sm" onClick={() => setShowRequestModal(true)}>
                  <Plus size={14} /> New Request
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRequests.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No requests found</td></tr>
                  ) : (
                    attendanceRequests.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="badge badge-info text-xs">
                            {REQUEST_TYPE_LABELS[r.request_type] || r.request_type}
                          </span>
                          {r.leave_type && (
                            <span className="text-[10px] ml-1" style={{ color: 'var(--color-text-muted)' }}>
                              ({LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type})
                            </span>
                          )}
                        </td>
                        <td className="text-xs font-medium">{r.title_en || '--'}</td>
                        <td className="text-xs">{r.start_date}</td>
                        <td className="text-xs">{r.end_date}</td>
                        <td className="text-xs max-w-[150px] truncate">{r.reason || '--'}</td>
                        <td>
                          <span className={`badge text-xs capitalize ${getRequestStatusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="text-xs">{formatDateTime(r.created_at)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {r.status === 'pending' && hasPermission('attendance', 'edit') && (
                              <>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleApproveRequest(r.id)} title="Approve">
                                  <CheckSquare size={12} style={{ color: 'var(--color-success)' }} />
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleRejectRequest(r.id)} title="Reject">
                                  <XSquare size={12} style={{ color: 'var(--color-danger)' }} />
                                </button>
                              </>
                            )}
                            {r.status === 'draft' && (
                              <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteRequest(r.id)} title="Delete">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Attendance Locations</h3>
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)', height: '400px' }}>
                {mapRecords.length > 0 ? (
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${mapCenter()}&zoom=14&size=600x400&maptype=roadmap&markers=color:red%7C${mapRecords.filter(r => r.check_in_lat && r.check_in_lng).slice(0, 50).map(r => `${r.check_in_lat},${r.check_in_lng}`).join('%7C')}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZR0B8O4Qw8hYI`}
                    alt="Attendance Map"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}>
                    <EmptyState icon={<MapIcon size={32} />} title="No location data" description="Check in records will appear here" />
                  </div>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Showing {mapRecords.length} records with location data
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Recent Locations</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {mapRecords.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No recent locations</p>
                ) : (
                  mapRecords.slice(0, 20).map((r) => {
                    const emp = employees.find(e => e.id === r.employee_id);
                    return (
                      <div
                        key={r.id}
                        className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedMapRecord?.id === r.id ? 'bg-primary/10' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => setSelectedMapRecord(r)}
                      >
                        <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{emp?.full_name_en || r.employee_id}</p>
                          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                            {formatDate(r.check_in)} at {formatTime(r.check_in)}
                          </p>
                          {r.check_in_lat && r.check_in_lng && (
                            <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                              {r.check_in_lat.toFixed(4)}, {r.check_in_lng.toFixed(4)}
                            </p>
                          )}
                          <span className={`badge text-[10px] capitalize ${getStatusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {selectedMapRecord && selectedMapRecord.check_in_lat && selectedMapRecord.check_in_lng && (
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold mb-2">Selected Location</h3>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Lat: {selectedMapRecord.check_in_lat.toFixed(6)}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Lng: {selectedMapRecord.check_in_lng.toFixed(6)}
                </p>
                <button className="btn btn-primary btn-sm mt-3" onClick={() => openMapPopup(selectedMapRecord.check_in_lat, selectedMapRecord.check_in_lng)}>
                  <ExternalLink size={12} /> Open in Google Maps
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Default Rates</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Default Overtime Rate (multiplier)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  className="input"
                  style={{ width: '200px', padding: '0.375rem 0.75rem' }}
                  value={defaultOvertimeRate}
                  onChange={(e) => setDefaultOvertimeRate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Default Deduction Rate (multiplier)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  className="input"
                  style={{ width: '200px', padding: '0.375rem 0.75rem' }}
                  value={defaultDeductionRate}
                  onChange={(e) => setDefaultDeductionRate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button className="btn btn-primary btn-sm" onClick={() => toast.success('Default rates saved')}>
                  <CheckCircle size={14} /> Save Defaults
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Overtime Rules</h3>
              {hasPermission('attendance', 'edit') && (
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setEditingOvertimeRule({
                    overtime_rate: 1.5,
                    max_overtime_hours: 4,
                    is_active: true,
                  });
                  setShowOvertimeModal(true);
                }}>
                  <Plus size={14} /> New Rule
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Shift</th>
                    <th>Employee</th>
                    <th>OT Rate</th>
                    <th>Max OT Hours</th>
                    <th>Effective</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overtimeRules.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No overtime rules defined</td></tr>
                  ) : (
                    overtimeRules.map((r) => {
                      const proj = projects.find(p => p.id === r.project_id);
                      const shift = shifts.find(s => s.id === r.shift_id);
                      const emp = employees.find(e => e.id === r.employee_id);
                      return (
                        <tr key={r.id}>
                          <td className="text-xs">{proj?.project_code || r.project_id || 'All'}</td>
                          <td className="text-xs">{shift?.name_en || r.shift_id || 'All'}</td>
                          <td className="text-xs">{emp?.full_name_en || r.employee_id || 'All'}</td>
                          <td className="text-xs font-medium">{r.overtime_rate}x</td>
                          <td className="text-xs">{r.max_overtime_hours ? `${r.max_overtime_hours}h` : '--'}</td>
                          <td className="text-xs">
                            {r.effective_from || '--'} {r.effective_to ? `→ ${r.effective_to}` : ''}
                          </td>
                          <td>
                            <span className={`badge text-xs ${r.is_active ? 'badge-success' : 'badge-neutral'}`}>
                              {r.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              {hasPermission('attendance', 'edit') && (
                                <>
                                  <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setEditingOvertimeRule(r);
                                    setShowOvertimeModal(true);
                                  }}>
                                    <Edit3 size={12} />
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteOvertimeRule(r.id)}>
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Deduction Rules</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Configure deduction rules for late arrivals, early departures, and absences.
              Deductions are calculated based on the employee's hourly rate multiplied by the deduction rate.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Late Arrival Deduction (hours)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="input"
                  style={{ width: '200px', padding: '0.375rem 0.75rem' }}
                  defaultValue="1"
                />
              </div>
              <div>
                <label className="label">Early Departure Deduction (hours)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="input"
                  style={{ width: '200px', padding: '0.375rem 0.75rem' }}
                  defaultValue="1"
                />
              </div>
              <div>
                <label className="label">Absence Deduction (days)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="input"
                  style={{ width: '200px', padding: '0.375rem 0.75rem' }}
                  defaultValue="1"
                />
              </div>
            </div>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => toast.success('Deduction rules saved')}>
              <CheckCircle size={14} /> Save Deduction Rules
            </button>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {showShiftModal && editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShiftModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">{editingShift.id ? 'Edit Shift' : 'New Shift'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Code</label>
                  <input className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.code || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Color</label>
                  <input type="color" className="input" style={{ width: '100%', height: '2.25rem', padding: '0.25rem' }}
                    value={editingShift.color || '#3b82f6'}
                    onChange={(e) => setEditingShift({ ...editingShift, color: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name (EN)</label>
                  <input className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.name_en || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, name_en: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Name (AR)</label>
                  <input className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.name_ar || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, name_ar: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Time</label>
                  <input type="time" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.start_time || '08:00'}
                    onChange={(e) => setEditingShift({ ...editingShift, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input type="time" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.end_time || '17:00'}
                    onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Grace Minutes</label>
                  <input type="number" min="0" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.grace_minutes || 15}
                    onChange={(e) => setEditingShift({ ...editingShift, grace_minutes: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Overtime Rate (x)</label>
                  <input type="number" step="0.1" min="1" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.overtime_rate || 1.5}
                    onChange={(e) => setEditingShift({ ...editingShift, overtime_rate: parseFloat(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Deduction Rate (x)</label>
                  <input type="number" step="0.1" min="0" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingShift.deduction_rate || 1}
                    onChange={(e) => setEditingShift({ ...editingShift, deduction_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox"
                      checked={editingShift.is_night_shift || false}
                      onChange={(e) => setEditingShift({ ...editingShift, is_night_shift: e.target.checked })}
                    />
                    Night Shift
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox"
                      checked={editingShift.is_active !== false}
                      onChange={(e) => setEditingShift({ ...editingShift, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              </div>
              <div>
                <label className="label">Work Days</label>
                <div className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const selected = (editingShift.work_days || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`px-3 py-1 text-xs rounded-full border ${
                          selected ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        onClick={() => {
                          const days = editingShift.work_days || [];
                          if (selected) {
                            setEditingShift({ ...editingShift, work_days: days.filter(d => d !== day) });
                          } else {
                            setEditingShift({ ...editingShift, work_days: [...days, day] });
                          }
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowShiftModal(false); setEditingShift(null); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveShift}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Shift Modal */}
      {showAssignShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAssignShiftModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">Assign Shift to Employee</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Employee</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={assignShiftEmployeeId}
                  onChange={(e) => setAssignShiftEmployeeId(e.target.value)}
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name_en} ({e.employee_code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Shift</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={assignShiftId}
                  onChange={(e) => setAssignShiftId(e.target.value)}
                >
                  <option value="">Select Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name_en} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Effective From</label>
                <input type="date" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={assignEffectiveFrom}
                  onChange={(e) => setAssignEffectiveFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Effective To (optional)</label>
                <input type="date" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={assignEffectiveTo}
                  onChange={(e) => setAssignEffectiveTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAssignShiftModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleAssignShift}>Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRequestModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">New Attendance Request</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Request Type</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={newRequest.request_type || 'leave'}
                  onChange={(e) => setNewRequest({ ...newRequest, request_type: e.target.value as any })}
                >
                  <option value="leave">Leave</option>
                  <option value="permission">Permission</option>
                  <option value="remote">Remote Work</option>
                  <option value="missed_punch">Missed Punch</option>
                  <option value="correction">Correction</option>
                  <option value="escalation">Escalation</option>
                </select>
              </div>
              {newRequest.request_type === 'leave' && (
                <div>
                  <label className="label">Leave Type</label>
                  <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={newRequest.leave_type || 'annual'}
                    onChange={(e) => setNewRequest({ ...newRequest, leave_type: e.target.value as any })}
                  >
                    <option value="sick">Sick Leave</option>
                    <option value="annual">Annual Leave</option>
                    <option value="emergency">Emergency Leave</option>
                    <option value="personal">Personal Leave</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Title</label>
                <input className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={newRequest.title_en || ''}
                  onChange={(e) => setNewRequest({ ...newRequest, title_en: e.target.value })}
                  placeholder="Brief title"
                />
              </div>
              <div>
                <label className="label">Reason</label>
                <textarea className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', minHeight: '64px' }}
                  value={newRequest.reason || ''}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                  placeholder="Explain the reason"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={newRequest.start_date || ''}
                    onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={newRequest.end_date || ''}
                    onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Time</label>
                  <input type="time" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={newRequest.start_time || ''}
                    onChange={(e) => setNewRequest({ ...newRequest, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input type="time" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={newRequest.end_time || ''}
                    onChange={(e) => setNewRequest({ ...newRequest, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Escalate To (optional)</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={newRequest.escalation_to || ''}
                  onChange={(e) => setNewRequest({ ...newRequest, escalation_to: e.target.value })}
                >
                  <option value="">No escalation</option>
                  {employees.filter(e => e.id !== selectedEmployee).map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={newRequest.status || 'draft'}
                  onChange={(e) => setNewRequest({ ...newRequest, status: e.target.value as any })}
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Submit for Approval</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowRequestModal(false); setNewRequest({
                request_type: 'leave', leave_type: 'annual',
                start_date: new Date().toISOString().slice(0, 10),
                end_date: new Date().toISOString().slice(0, 10),
                status: 'draft',
              }); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreateRequest}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Overtime Rule Modal */}
      {showOvertimeModal && editingOvertimeRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowOvertimeModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">{editingOvertimeRule.id ? 'Edit Overtime Rule' : 'New Overtime Rule'}</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Project (optional)</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={editingOvertimeRule.project_id || ''}
                  onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, project_id: e.target.value || undefined })}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_code} - {p.name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Shift (optional)</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={editingOvertimeRule.shift_id || ''}
                  onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, shift_id: e.target.value || undefined })}
                >
                  <option value="">All Shifts</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Employee (optional)</label>
                <select className="select" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                  value={editingOvertimeRule.employee_id || ''}
                  onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, employee_id: e.target.value || undefined })}
                >
                  <option value="">All Employees</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name_en}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">OT Rate (x)</label>
                  <input type="number" step="0.1" min="1" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingOvertimeRule.overtime_rate || 1.5}
                    onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, overtime_rate: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="label">Max OT Hours</label>
                  <input type="number" step="0.5" min="0" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingOvertimeRule.max_overtime_hours || ''}
                    onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, max_overtime_hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Effective From</label>
                  <input type="date" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingOvertimeRule.effective_from || ''}
                    onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, effective_from: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <label className="label">Effective To</label>
                  <input type="date" className="input" style={{ width: '100%', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                    value={editingOvertimeRule.effective_to || ''}
                    onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, effective_to: e.target.value || undefined })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox"
                  checked={editingOvertimeRule.is_active !== false}
                  onChange={(e) => setEditingOvertimeRule({ ...editingOvertimeRule, is_active: e.target.checked })}
                />
                <label className="text-sm">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowOvertimeModal(false); setEditingOvertimeRule(null); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveOvertimeRule}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Random Verification Modal */}
      {showVerificationModal && pendingVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowVerificationModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <Shield size={48} className="mx-auto mb-4" style={{ color: 'var(--color-warning)' }} />
            <h3 className="text-lg font-semibold mb-2">Random Verification Required</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Type: {VERIFICATION_TYPE_LABELS[pendingVerification.verification_type] || pendingVerification.verification_type}
            </p>
            {pendingVerification.verification_type === 'pin' && (
              <div className="mb-4">
                <label className="label">Enter PIN Code</label>
                <input type="text" className="input text-center text-lg tracking-widest"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '1.25rem', letterSpacing: '0.5em' }}
                  value={verificationPin}
                  onChange={(e) => setVerificationPin(e.target.value)}
                  placeholder="0000"
                  maxLength={6}
                />
              </div>
            )}
            {pendingVerification.verification_type === 'photo' && (
              <div className="mb-4">
                <label className="label">Take a photo to verify</label>
                <button className="btn btn-primary btn-sm w-full">
                  <Camera size={14} /> Capture Photo
                </button>
              </div>
            )}
            {pendingVerification.verification_type === 'location' && (
              <div className="mb-4">
                <label className="label">Verify your current location</label>
                <div className="flex items-center justify-center gap-2 text-sm" style={{ color: location ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {location ? (
                    <><CheckCircle size={14} /> Location acquired</>
                  ) : (
                    <><RefreshCw size={14} /> Acquiring location...</>
                  )}
                </div>
              </div>
            )}
            {pendingVerification.verification_type === 'qr_code' && (
              <div className="mb-4">
                <label className="label">Scan QR Code</label>
                <QrCode size={64} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
              </div>
            )}
            <div className="flex justify-center gap-3 mt-4">
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowVerificationModal(false); setVerificationPin(''); setPendingVerification(null); }}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleVerifyPin}>
                Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
