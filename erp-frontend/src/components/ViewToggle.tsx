import { LayoutGrid, List, CalendarRange } from 'lucide-react';

export type ViewMode = 'table' | 'kanban' | 'gantt';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  views?: ViewMode[];
}

export default function ViewToggle({ value, onChange, views = ['table', 'kanban', 'gantt'] }: ViewToggleProps) {
  const icons: Record<ViewMode, typeof List> = {
    table: List,
    kanban: LayoutGrid,
    gantt: CalendarRange,
  };

  return (
    <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ backgroundColor: 'var(--color-bg)' }}>
      {views.map((v) => {
        const Icon = icons[v];
        const isActive = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Icon size={14} />
            <span className="hidden sm:inline capitalize">{v}</span>
          </button>
        );
      })}
    </div>
  );
}
