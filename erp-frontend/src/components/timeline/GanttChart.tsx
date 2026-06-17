import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, AlertTriangle, Clock, Flag,
} from 'lucide-react';
import type { ScheduleTask, TaskDependency, ScheduleFilter } from '../../types';

interface WbsRow {
  id: string;
  label: string;
  type: 'project' | 'phase' | 'wbs' | 'task';
  level: number;
  depth: number;
  parent_id?: string;
  children: WbsRow[];
  tasks?: ScheduleTask[];
  task?: ScheduleTask;
  start_date?: string;
  end_date?: string;
  progress?: number;
  status?: string;
  priority?: string;
  is_critical?: boolean;
  is_baseline?: boolean;
  expandable?: boolean;
}

interface GanttChartProps {
  projects: { id: string; name_en: string; start_date: string; end_date: string; progress_percent: number; status: string }[];
  phases: { id: string; project_id: string; phase_code: string; name_en: string; start_date: string; end_date: string; progress_percent: number; status: string }[];
  wbsNodes: { id: string; project_id: string; wbs_code: string; parent_id: string | null; level: number; name_en: string; weight_percent: number }[];
  tasks: ScheduleTask[];
  dependencies: TaskDependency[];
  filter: ScheduleFilter;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ScaleCells({ dateRange, scale, dayWidth, daysBetween, addDays }: {
  dateRange: { start: Date; end: Date };
  scale: string;
  dayWidth: number;
  daysBetween: (a: Date, b: Date) => number;
  addDays: (d: Date, n: number) => Date;
}) {
  const cells: JSX.Element[] = [];
  let d = new Date(dateRange.start);
  while (d < dateRange.end) {
    const dw = scale === 'week' ? 7 : 1;
    const w = dw * dayWidth;
    cells.push(
      <div
        key={d.toISOString()}
        className="absolute top-0 text-[9px] flex items-center justify-center border-l"
        style={{
          left: daysBetween(dateRange.start, d) * dayWidth,
          width: w, height: 20,
          color: 'var(--color-text-muted)',
          borderColor: 'var(--color-border)',
        }}
      >
        {scale === 'week' ? `W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}` : d.getDate()}
      </div>
    );
    d = addDays(d, dw);
  }
  return <>{cells}</>;
}

const statusColors: Record<string, string> = {
  pending: '#94a3b8', open: '#3b82f6', in_progress: '#eab308',
  review: '#f97316', completed: '#22c55e', cancelled: '#ef4444',
  on_hold: '#a855f7', planning: '#f59e0b', active: '#16a34a',
};

const priorityColors: Record<string, string> = {
  low: '#94a3b8', medium: '#3b82f6', high: '#f97316', critical: '#ef4444',
};

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function GanttChart({ projects, phases, wbsNodes, tasks, dependencies, filter }: GanttChartProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const scale = filter.scale || 'week';

  // Compute date range
  const dateRange = useMemo(() => {
    let min = new Date();
    let max = new Date();
    min.setMonth(min.getMonth() - 1);
    max.setMonth(max.getMonth() + 6);

    for (const p of projects) {
      const s = parseDate(p.start_date); if (s && s < min) min = s;
      const e = parseDate(p.end_date); if (e && e > max) max = e;
    }
    for (const t of tasks) {
      const s = parseDate(t.start_date); if (s && s < min) min = s;
      const e = parseDate(t.end_date); if (e && e > max) max = e;
    }

    min.setDate(1);
    max.setDate(1);
    max.setMonth(max.getMonth() + 1);
    return { start: min, end: max, totalDays: daysBetween(min, max) };
  }, [projects, tasks]);

  const dayWidth = scale === 'day' ? 32 : scale === 'week' ? 24 : 8;

  // Build flat rows from hierarchy
  const rows = useMemo(() => {
    const result: WbsRow[] = [];

    for (const proj of projects) {
      const projectTasks = tasks.filter(t => t.project_id === proj.id);
      const projectPhases = phases.filter(p => p.project_id === proj.id);
      const projectWbs = wbsNodes.filter(w => w.project_id === proj.id);

      const projRow: WbsRow = {
        id: proj.id, label: proj.name_en, type: 'project', level: 0, depth: 0,
        start_date: proj.start_date, end_date: proj.end_date,
        progress: proj.progress_percent, status: proj.status,
        expandable: true, children: [],
      };
      const projExpanded = expanded.has(proj.id);

      if (projectPhases.length > 0) {
        for (const ph of projectPhases) {
          const phTasks = projectTasks.filter(t => t.division === ph.phase_code || t.activity?.startsWith(ph.phase_code));
          const phRow: WbsRow = {
            id: ph.id, label: `${ph.phase_code} - ${ph.name_en}`, type: 'phase', level: 1, depth: 1,
            parent_id: proj.id,
            start_date: ph.start_date, end_date: ph.end_date,
            progress: ph.progress_percent, status: ph.status,
            expandable: true, children: [],
          };
          const phExpanded = projExpanded && expanded.has(ph.id);

          const phaseWbs = projectWbs.filter(w => w.wbs_code.startsWith(ph.phase_code) || w.level === 1);
          for (const wbs of phaseWbs) {
            const wbsTasks = projectTasks.filter(t => t.wbs_id === wbs.id);
            const wbsRow: WbsRow = {
              id: wbs.id, label: `${wbs.wbs_code} - ${wbs.name_en}`, type: 'wbs', level: 2, depth: 2,
              parent_id: ph.id, tasks: wbsTasks,
              expandable: wbsTasks.length > 0, children: [],
            };
            const wbsExpanded = phExpanded && expanded.has(wbs.id);

            if (wbsExpanded && wbsTasks.length > 0) {
              for (const tk of wbsTasks) {
                wbsRow.children.push({
                  id: tk.id, label: `${tk.task_code} - ${tk.title_en}`, type: 'task', level: 3, depth: 3,
                  parent_id: wbs.id, task: tk,
                  start_date: tk.start_date, end_date: tk.end_date,
                  progress: tk.progress, status: tk.status, priority: tk.priority,
                  is_critical: tk.is_critical,
                  expandable: false, children: [],
                });
              }
            }
            if (phExpanded) phRow.children.push(wbsRow);
          }

          if (phExpanded && phRow.children.length === 0 && phTasks.length > 0) {
            for (const tk of phTasks) {
              phRow.children.push({
                id: tk.id, label: `${tk.task_code} - ${tk.title_en}`, type: 'task', level: 2, depth: 2,
                parent_id: ph.id, task: tk,
                start_date: tk.start_date, end_date: tk.end_date,
                progress: tk.progress, status: tk.status, priority: tk.priority,
                is_critical: tk.is_critical,
                expandable: false, children: [],
              });
            }
          }
          if (projExpanded) projRow.children.push(phRow);
        }
      } else if (projectWbs.length > 0) {
        for (const wbs of projectWbs) {
          if (wbs.parent_id) continue;
          const wbsTasks = projectTasks.filter(t => t.wbs_id === wbs.id);
          const wbsRow: WbsRow = {
            id: wbs.id, label: `${wbs.wbs_code} - ${wbs.name_en}`, type: 'wbs', level: 1, depth: 1,
            parent_id: proj.id, tasks: wbsTasks,
            expandable: wbsTasks.length > 0, children: [],
          };
          const wbsExpanded = projExpanded && expanded.has(wbs.id);
          if (wbsExpanded && wbsTasks.length > 0) {
            for (const tk of wbsTasks) {
              wbsRow.children.push({
                id: tk.id, label: `${tk.task_code} - ${tk.title_en}`, type: 'task', level: 2, depth: 2,
                parent_id: wbs.id, task: tk,
                start_date: tk.start_date, end_date: tk.end_date,
                progress: tk.progress, status: tk.status, priority: tk.priority,
                is_critical: tk.is_critical,
                expandable: false, children: [],
              });
            }
          }
          if (projExpanded) projRow.children.push(wbsRow);
        }
      } else if (projectTasks.length > 0) {
        for (const tk of projectTasks) {
          projRow.children.push({
            id: tk.id, label: `${tk.task_code} - ${tk.title_en}`, type: 'task', level: 1, depth: 1,
            parent_id: proj.id, task: tk,
            start_date: tk.start_date, end_date: tk.end_date,
            progress: tk.progress, status: tk.status, priority: tk.priority,
            is_critical: tk.is_critical,
            expandable: false, children: [],
          });
        }
      }
      result.push(projRow);
    }
    return result;
  }, [projects, phases, wbsNodes, tasks, expanded]);

  // Flatten rows for rendering
  const flatRows = useMemo(() => {
    const flat: (WbsRow & { indent: number })[] = [];
    function walk(items: WbsRow[], indent: number) {
      for (const item of items) {
        flat.push({ ...item, indent });
        if (item.children && item.children.length > 0) {
          walk(item.children, indent + 1);
        }
      }
    }
    walk(rows, 0);
    return flat;
  }, [rows]);

  // Scroll sync
  const handleTreeScroll = useCallback(() => {
    if (ganttRef.current && treeRef.current) {
      ganttRef.current.scrollTop = treeRef.current.scrollTop;
    }
  }, []);
  const handleGanttScroll = useCallback(() => {
    if (treeRef.current && ganttRef.current) {
      treeRef.current.scrollTop = ganttRef.current.scrollTop;
    }
  }, []);

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Month labels + week/day grid
  const timelineHeaders = useMemo(() => {
    const headers: { label: string; left: number; width: number }[] = [];
    let cursor = dateRange.start;
    while (cursor < dateRange.end) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const days = daysBetween(cursor, monthEnd < dateRange.end ? monthEnd : dateRange.end);
      headers.push({
        label: `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`,
        left: daysBetween(dateRange.start, cursor) * dayWidth,
        width: days * dayWidth,
      });
      cursor = monthEnd;
    }
    return headers;
  }, [dateRange, dayWidth]);

  // Get bar position for a task
  const getBarStyle = (task: ScheduleTask) => {
    const start = parseDate(task.start_date) || dateRange.start;
    const end = parseDate(task.end_date) || addDays(start, 30);
    const left = Math.max(0, daysBetween(dateRange.start, start) * dayWidth);
    const width = Math.max(dayWidth, daysBetween(start, end) * dayWidth);
    return { left, width };
  };

  // Get baseline bar position
  const getBaselineStyle = (task: ScheduleTask) => {
    const start = parseDate(task.baseline_start);
    const end = parseDate(task.baseline_end);
    if (!start || !end) return null;
    const left = Math.max(0, daysBetween(dateRange.start, start) * dayWidth);
    const width = Math.max(dayWidth, daysBetween(start, end) * dayWidth);
    return { left, width };
  };

  // Task bar by ID lookup
  const taskMap = useMemo(() => {
    const map = new Map<string, ScheduleTask>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  // Dependency lines
  const depLines = useMemo(() => {
    if (!svgRef.current) return [];
    const lines: { x1: number; y1: number; x2: number; y2: number; type: string; color: string }[] = [];
    const rowMap = new Map<string, number>();
    flatRows.forEach((r, i) => {
      if (r.task) rowMap.set(r.id, i);
    });

    for (const dep of dependencies) {
      const predRow = flatRows.findIndex(r => r.id === dep.predecessor_id);
      const succRow = flatRows.findIndex(r => r.id === dep.successor_id);
      if (predRow === -1 || succRow === -1) continue;

      const pred = taskMap.get(dep.predecessor_id);
      const succ = taskMap.get(dep.successor_id);
      if (!pred || !succ) continue;

      const predEnd = parseDate(pred.end_date) || addDays(parseDate(pred.start_date) || dateRange.start, 30);
      const succStart = parseDate(succ.start_date) || predEnd;

      const rowH = 36;
      const x1 = daysBetween(dateRange.start, parseDate(pred.end_date) || predEnd) * dayWidth;
      const x2 = daysBetween(dateRange.start, parseDate(succ.start_date) || succStart) * dayWidth;
      const y1 = predRow * rowH + rowH / 2 + 44;
      const y2 = succRow * rowH + rowH / 2 + 44;

      lines.push({
        x1, y1, x2, y2,
        type: dep.dependency_type,
        color: '#94a3b8',
      });
    }
    return lines;
  }, [dependencies, flatRows, taskMap, dateRange, dayWidth]);

  const rowHeight = 36;
  const headerHeight = 44;
  const treeWidth = 340;
  const totalWidth = dateRange.totalDays * dayWidth + 20;
  const totalHeight = flatRows.length * rowHeight + headerHeight;

  return (
    <div className="glass-card overflow-hidden" style={{ borderRadius: '12px' }}>
      {/* Timeline header */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="shrink-0" style={{ width: treeWidth }}>
          <div className="h-[44px] flex items-center px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Work Breakdown Structure
          </div>
        </div>
        <div className="overflow-hidden" style={{ flex: 1 }}>
          <div style={{ width: totalWidth, position: 'relative', height: headerHeight }}>
            {timelineHeaders.map((h, i) => (
              <div
                key={i}
                className="absolute top-0 h-full flex items-center px-2 text-[11px] font-medium border-l"
                style={{
                  left: h.left, width: h.width,
                  color: 'var(--color-text-muted)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {h.label}
              </div>
            ))}
            <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: 20 }}>
              {scale !== 'month' && <ScaleCells dateRange={dateRange} scale={scale} dayWidth={dayWidth} daysBetween={daysBetween} addDays={addDays} />}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex" style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}>
        {/* WBS Tree */}
        <div
          ref={treeRef}
          className="overflow-y-auto overflow-x-hidden shrink-0 border-r"
          style={{ width: treeWidth, borderColor: 'var(--color-border)' }}
          onScroll={handleTreeScroll}
        >
          {flatRows.map((row) => (
            <div
              key={row.id}
              className="flex items-center border-b text-sm truncate"
              style={{
                height: rowHeight,
                borderColor: 'var(--color-border)',
                paddingLeft: 12 + row.indent * 20,
                background: row.type === 'project' ? 'var(--color-surface-hover, rgba(255,255,255,0.03))' : undefined,
              }}
            >
              {row.expandable ? (
                <button className="shrink-0 mr-1 p-0.5 rounded hover:bg-white/10" onClick={() => toggleExpand(row.id)}>
                  {expanded.has(row.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              {row.type === 'project' && <Flag size={12} className="mr-1.5 shrink-0" style={{ color: statusColors[row.status || 'active'] || '#16a34a' }} />}
              {row.type === 'task' && row.is_critical && <AlertTriangle size={12} className="mr-1.5 shrink-0 text-red-500" />}
              <span className="truncate text-xs font-medium" style={{ color: row.type === 'project' ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                {row.label}
              </span>
            </div>
          ))}
        </div>

        {/* Gantt Area */}
        <div
          ref={ganttRef}
          className="overflow-auto flex-1"
          onScroll={handleGanttScroll}
        >
          <div style={{ width: totalWidth, height: totalHeight, position: 'relative' }}>
            {/* Grid lines */}
            {timelineHeaders.map((h, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l"
                style={{
                  left: h.left, width: 0,
                  borderColor: 'var(--color-border)',
                  opacity: 0.3,
                }}
              />
            ))}

            {/* Today line */}
            {new Date() >= dateRange.start && new Date() <= dateRange.end && (
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: daysBetween(dateRange.start, new Date()) * dayWidth,
                  width: 1, background: '#ef4444',
                  zIndex: 20, pointerEvents: 'none',
                }}
              />
            )}

            {/* Task bars */}
            {flatRows.map((row, idx) => {
              if (!row.task && row.type !== 'task') return null;
              const task = row.task;
              if (!task) return null;

              const bar = getBarStyle(task);
              const baselineBar = getBaselineStyle(task);
              const isLate = task.total_float !== undefined && task.total_float < 0;
              const statusColor = statusColors[task.status || 'pending'] || '#94a3b8';
              const priorityColor = priorityColors[task.priority || 'medium'] || '#3b82f6';
              const y = idx * rowHeight + headerHeight + 4;

              return (
                <div key={task.id} style={{ position: 'absolute', top: y, left: 0, right: 0, height: rowHeight }}>
                  {/* Baseline bar */}
                  {baselineBar && (
                    <div
                      className="absolute rounded-sm opacity-30"
                      style={{
                        left: baselineBar.left,
                        width: baselineBar.width,
                        height: 6,
                        top: 2,
                        background: '#6b7280',
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Main bar */}
                  <div
                    className="absolute rounded cursor-pointer transition-all hover:opacity-80 group"
                    style={{
                      left: bar.left,
                      width: bar.width,
                      height: 20,
                      top: rowHeight / 2 - 10 + 2,
                      background: statusColor,
                      zIndex: 2,
                      minWidth: 4,
                      opacity: task.status === 'completed' ? 0.7 : 1,
                      boxShadow: task.is_critical ? `0 0 0 2px ${statusColor}44` : 'none',
                    }}
                    onMouseEnter={() => setHoveredTask(task.id)}
                    onMouseLeave={() => setHoveredTask(null)}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-s"
                      style={{
                        width: `${task.progress}%`,
                        background: 'rgba(255,255,255,0.25)',
                        zIndex: 3,
                      }}
                    />

                    {/* Label inside bar */}
                    {bar.width > 60 && (
                      <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium text-white truncate z-10">
                        {task.title_en}
                      </span>
                    )}
                  </div>

                  {/* Hover tooltip */}
                  {hoveredTask === task.id && (
                    <div
                      className="absolute z-50 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl p-2.5 pointer-events-none"
                      style={{
                        left: bar.left + bar.width / 2,
                        top: -60,
                        transform: 'translateX(-50%)',
                        minWidth: 180,
                      }}
                    >
                      <div className="font-semibold mb-1">{task.task_code} - {task.title_en}</div>
                      <div className="flex justify-between gap-4">
                        <span>Start: {task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}</span>
                        <span>End: {task.end_date ? new Date(task.end_date).toLocaleDateString() : '-'}</span>
                      </div>
                      <div className="flex justify-between gap-4 mt-0.5">
                        <span>Progress: {task.progress}%</span>
                        <span>Float: {task.total_float ?? '-'}</span>
                      </div>
                      <div className="flex justify-between gap-4 mt-0.5">
                        <span>Priority: {task.priority || '-'}</span>
                        <span>{task.is_critical ? '🔴 Critical' : ''} {task.status}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Dependency arrows */}
            <svg
              ref={svgRef}
              className="absolute top-0 left-0 pointer-events-none"
              width={totalWidth}
              height={totalHeight}
              style={{ zIndex: 5 }}
            >
              {depLines.map((line, i) => (
                <g key={i}>
                  <path
                    d={`M${line.x1},${line.y1} C${line.x1 + Math.abs(line.x2 - line.x1) / 2},${line.y1} ${line.x2 - Math.abs(line.x2 - line.x1) / 2},${line.y2} ${line.x2},${line.y2}`}
                    stroke={line.color}
                    strokeWidth={1.5}
                    fill="none"
                    strokeDasharray={line.type !== 'FS' ? '4,3' : undefined}
                  />
                  <polygon
                    points={`${line.x2},${line.y2} ${line.x2 - 5},${line.y2 - 4} ${line.x2 - 5},${line.y2 + 4}`}
                    fill={line.color}
                  />
                  <text x={(line.x1 + line.x2) / 2} y={(line.y1 + line.y2) / 2 - 6} textAnchor="middle" fontSize="9" fill={line.color}>
                    {line.type}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Footer summary */}
      <div
        className="flex items-center gap-4 px-4 py-2 border-t text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: statusColors.completed }} />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: statusColors.in_progress }} />
          In Progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: statusColors.pending }} />
          Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: statusColors.on_hold }} />
          On Hold
        </span>
        <span className="flex items-center gap-1 font-semibold text-red-500">
          <AlertTriangle size={12} />
          Critical
        </span>
        <span className="flex items-center gap-1 ml-auto">
          Tasks: <strong>{tasks.length}</strong>
        </span>
        <span className="flex items-center gap-1">
          Critical: <strong className="text-red-500">{tasks.filter(t => t.is_critical).length}</strong>
        </span>
        <span className="flex items-center gap-1">
          Dependencies: <strong>{dependencies.length}</strong>
        </span>
      </div>
    </div>
  );
}
