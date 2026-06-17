import { useMemo } from 'react';

interface AttendanceRecord {
  id: string;
  check_in: string;
  check_out?: string;
  status: string;
  total_hours?: number;
  overtime_hours?: number;
}

interface Props {
  records: AttendanceRecord[];
  year: number;
  month: number; // 0-indexed
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_ORDER = ['present', 'overtime', 'late', 'half_day', 'absent'];

export default function AttendanceCalendar({ records, year, month }: Props) {
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Build a lookup: date string → record
    const recordMap = new Map<string, AttendanceRecord>();
    for (const r of records) {
      const d = new Date(r.check_in);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // Keep highest-priority status per day (present > overtime > late > half_day > absent)
      const existing = recordMap.get(key);
      if (!existing || STATUS_ORDER.indexOf(r.status) < STATUS_ORDER.indexOf(existing.status)) {
        recordMap.set(key, r);
      }
    }

    // Build grid
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const weeks: { day: number; dateStr: string; record?: AttendanceRecord; isToday: boolean; isOtherMonth: boolean }[][] = [];
    let week: typeof weeks[number] = [];

    // Leading empty cells
    for (let i = 0; i < startPad; i++) {
      week.push({ day: 0, dateStr: '', isToday: false, isOtherMonth: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const record = recordMap.get(dateStr);
      week.push({ day: d, dateStr, record, isToday, isOtherMonth: false });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    // Trailing empty cells
    if (week.length > 0) {
      while (week.length < 7) {
        week.push({ day: 0, dateStr: '', isToday: false, isOtherMonth: true });
      }
      weeks.push(week);
    }

    return weeks;
  }, [records, year, month]);

  const statusClass = (status: string) => {
    switch (status) {
      case 'present': return 'day-present';
      case 'late': return 'day-late';
      case 'absent': return 'day-absent';
      case 'overtime': return 'day-overtime';
      case 'half_day': return 'day-half_day';
      default: return '';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return 'var(--color-success)';
      case 'late': return 'var(--color-warning)';
      case 'absent': return 'var(--color-danger)';
      case 'overtime': return '#3b82f6';
      case 'half_day': return '#f59e0b';
      default: return 'transparent';
    }
  };

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold mb-4">
        {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </h3>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {[
          { label: 'Present', color: 'var(--color-success)' },
          { label: 'Late', color: 'var(--color-warning)' },
          { label: 'Absent', color: 'var(--color-danger)' },
          { label: 'Overtime', color: '#3b82f6' },
          { label: 'Half Day', color: '#f59e0b' },
        ].map(item => (
          <span key={item.label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="attendance-calendar-grid">
        {DAY_NAMES.map(name => (
          <div key={name} className="attendance-calendar-header">{name}</div>
        ))}
        {weeks.flat().map((cell, idx) => {
          if (cell.isOtherMonth) {
            return <div key={idx} className="attendance-day-cell other-month" />;
          }
          // Weekend check (Fri=5, Sat=6 in Saudi week)
          const date = new Date(year, month, cell.day);
          const isWeekend = date.getDay() === 5 || date.getDay() === 6;
          const cls = [
            'attendance-day-cell',
            cell.isToday ? 'today' : '',
            cell.record ? statusClass(cell.record.status) : isWeekend ? 'day-weekend' : 'day-future',
          ].filter(Boolean).join(' ');

          return (
            <div key={idx} className={cls} title={cell.record ? `${cell.record.status}: ${cell.record.total_hours?.toFixed(1) || '0'}h` : ''}>
              <span>{cell.day}</span>
              {cell.record && <div className="day-dot" />}
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="flex justify-between mt-4 pt-3 border-t text-xs" style={{ borderColor: 'var(--color-border)' }}>
        {['present', 'late', 'absent', 'overtime', 'half_day'].map(status => {
          const count = records.filter(r => r.status === status).length;
          if (count === 0) return null;
          return (
            <div key={status} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(status) }} />
              <span className="capitalize" style={{ color: 'var(--color-text-secondary)' }}>{status.replace('_', ' ')}</span>
              <span className="font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
