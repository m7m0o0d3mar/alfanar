import { Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, Sun } from 'lucide-react';

interface Summary {
  total: number; present: number; late: number; absent: number;
  half_day: number; overtime: number; total_hours: number; avg_hours: number;
}

interface Props {
  summary: Summary;
  employeeName: string;
}

export default function AttendanceDashboard({ summary, employeeName }: Props) {
  const attendanceRate = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;
  const totalDays = summary.total || 1;

  return (
    <div className="space-y-5">
      {/* Welcome + Attendance Rate */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Welcome back{employeeName ? `, ${employeeName}` : ''}</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {summary.present} days present out of {summary.total} this month
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: attendanceRate >= 90 ? 'var(--color-success)' : attendanceRate >= 75 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
              {attendanceRate}%
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Attendance Rate</div>
          </div>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-4">
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${attendanceRate}%`,
            background: attendanceRate >= 90
              ? 'var(--color-success)'
              : attendanceRate >= 75
                ? 'var(--color-warning)'
                : 'var(--color-danger)',
          }} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-glass text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{summary.present}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Present</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {summary.total > 0 ? Math.round((summary.present / totalDays) * 100) : 0}%
          </p>
        </div>
        <div className="stat-glass text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock size={18} style={{ color: 'var(--color-warning)' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{summary.late}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Late</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {summary.total > 0 ? Math.round((summary.late / totalDays) * 100) : 0}%
          </p>
        </div>
        <div className="stat-glass text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <XCircle size={18} style={{ color: 'var(--color-danger)' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{summary.absent}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Absent</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {summary.total > 0 ? Math.round((summary.absent / totalDays) * 100) : 0}%
          </p>
        </div>
        <div className="stat-glass text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp size={18} style={{ color: 'var(--color-info, #3b82f6)' }} />
          </div>
          <p className="text-2xl font-bold">{summary.total_hours.toFixed(0)}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total Hours</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {summary.avg_hours.toFixed(1)}h / day
          </p>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Sun size={14} style={{ color: 'var(--color-warning)' }} /> Day Breakdown
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Full days</span>
              <span className="font-medium">{summary.present}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Half days</span>
              <span className="font-medium">{summary.half_day}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Overtime</span>
              <span className="font-medium">{summary.overtime}</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} style={{ color: 'var(--color-success)' }} /> Hours
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Total hours</span>
              <span className="font-medium">{summary.total_hours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Daily average</span>
              <span className="font-medium">{summary.avg_hours.toFixed(1)}h</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} /> Alerts
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Late arrivals</span>
              <span className="font-medium">{summary.late}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Absences</span>
              <span className="font-medium">{summary.absent}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
