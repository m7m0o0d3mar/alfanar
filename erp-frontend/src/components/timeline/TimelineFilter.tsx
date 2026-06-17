import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import type { ScheduleFilter } from '../../types';

interface TimelineFilterProps {
  filter: ScheduleFilter;
  onChange: (filter: ScheduleFilter) => void;
  projects: { id: string; name_en: string }[];
  assignees: { id: string; name: string }[];
}

const STATUSES = ['', 'pending', 'open', 'in_progress', 'review', 'completed', 'cancelled', 'on_hold'];
const PRIORITIES = ['', 'low', 'medium', 'high', 'critical'];
const LEVELS: { value: ScheduleFilter['level']; label: string }[] = [
  { value: 'project', label: 'Project' },
  { value: 'phase', label: 'Phase' },
  { value: 'wbs', label: 'WBS' },
  { value: 'task', label: 'Task' },
];
const SCALES: { value: ScheduleFilter['scale']; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export default function TimelineFilter({ filter, onChange, projects, assignees }: TimelineFilterProps) {
  const [showMore, setShowMore] = useState(false);

  const toggleArray = (key: 'status' | 'priority', value: string) => {
    const arr = filter[key] || [];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onChange({ ...filter, [key]: next.length > 0 ? next : undefined });
  };

  const clearFilters = () => {
    onChange({ scale: filter.scale, level: filter.level });
  };

  const hasFilters = filter.status || filter.priority || filter.assigned_to || filter.search || filter.is_critical;

  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search tasks..."
            className="input"
            style={{ paddingLeft: '2rem', paddingTop: '0.375rem', paddingBottom: '0.375rem', fontSize: '0.8125rem' }}
            value={filter.search || ''}
            onChange={(e) => onChange({ ...filter, search: e.target.value || undefined })}
          />
          {filter.search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => onChange({ ...filter, search: undefined })}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Level */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                (filter.level || 'task') === l.value ? 'bg-primary/20 text-primary' : 'hover:bg-white/5'
              }`}
              style={{ color: (filter.level || 'task') === l.value ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
              onClick={() => onChange({ ...filter, level: l.value })}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Scale */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
          {SCALES.map((s) => (
            <button
              key={s.value}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                (filter.scale || 'week') === s.value ? 'bg-primary/20 text-primary' : 'hover:bg-white/5'
              }`}
              style={{ color: (filter.scale || 'week') === s.value ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
              onClick={() => onChange({ ...filter, scale: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Project selector */}
        <select
          className="input text-xs"
          style={{ width: '160px', padding: '0.375rem 0.5rem' }}
          value={filter.project_id || ''}
          onChange={(e) => onChange({ ...filter, project_id: e.target.value || undefined })}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name_en}</option>
          ))}
        </select>

        {/* Filter toggle */}
        <button
          className={`btn btn-sm ${hasFilters ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowMore(!showMore)}
        >
          <Filter size={14} />
          Filters
          {hasFilters && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-white inline-block" />}
        </button>

        {/* Clear */}
        {hasFilters && (
          <button className="btn btn-sm btn-secondary" onClick={clearFilters}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {showMore && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Status:</span>
            {STATUSES.filter(Boolean).map((s) => {
              const active = filter.status?.includes(s);
              return (
                <button
                  key={s}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    active ? 'bg-white/20 text-white' : 'hover:bg-white/5'
                  }`}
                  style={{ color: active ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                  onClick={() => toggleArray('status', s)}
                >
                  {s.replace('_', ' ')}
                </button>
              );
            })}
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Priority:</span>
            {PRIORITIES.filter(Boolean).map((p) => {
              const active = filter.priority?.includes(p);
              return (
                <button
                  key={p}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    active ? 'bg-white/20 text-white' : 'hover:bg-white/5'
                  }`}
                  style={{ color: active ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                  onClick={() => toggleArray('priority', p)}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Assignee:</span>
            <select
              className="input text-xs"
              style={{ width: '140px', padding: '0.25rem 0.5rem' }}
              value={filter.assigned_to?.[0] || ''}
              onChange={(e) => onChange({ ...filter, assigned_to: e.target.value ? [e.target.value] : undefined })}
            >
              <option value="">All</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Critical toggle */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
            <input
              type="checkbox"
              className="accent-primary"
              checked={filter.is_critical || false}
              onChange={(e) => onChange({ ...filter, is_critical: e.target.checked || undefined })}
            />
            Critical only
          </label>
        </div>
      )}
    </div>
  );
}
