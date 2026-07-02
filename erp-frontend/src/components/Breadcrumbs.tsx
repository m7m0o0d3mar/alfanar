import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useT } from '../hooks/useTranslation';
import { usePageRegistry } from '../hooks/usePageRegistry';
import { supabase } from '../services/supabase';
import { ChevronRight, ChevronLeft, Home } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const routeLabels: Record<string, string> = {
  '': 'nav.dashboard',
  projects: 'nav.projects',
  units: 'nav.units',
  execution: 'nav.execution',
  wir: 'execution.wir',
  tasks: 'execution.tasks',
  quality: 'nav.quality',
  hse: 'nav.hse',
  hr: 'nav.hr',
  employees: 'hr.employees',
  procurement: 'nav.procurement',
  finance: 'nav.finance',
  sales: 'nav.sales',
  technical: 'nav.technical',
  documents: 'nav.documents',
  approvals: 'nav.approvals',
  settings: 'nav.settings',
  admin: 'nav.admin_section',
  users: 'nav.admin_users',
  roles: 'nav.admin_roles',
  branding: 'nav.admin_branding',
  sql: 'nav.admin_sql',
  warehouse: 'nav.warehouse',
};

function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function resolveUUID(seg: string, prevSeg: string): Promise<string | null> {
  const entityMap: Record<string, { table: string; nameField: string }> = {
    projects: { table: 'projects', nameField: 'name_en' },
    employees: { table: 'employees', nameField: 'full_name_en' },
    wir: { table: 'work_requests', nameField: 'title_en' },
    tasks: { table: 'work_tasks', nameField: 'title_en' },
    units: { table: 'units', nameField: 'unit_code' },
    tickets: { table: 'technical_tickets', nameField: 'title_en' },
  };
  const entity = entityMap[prevSeg];
  if (!entity) return null;
  try {
    const { data } = await supabase.from(entity.table).select(entity.nameField).eq('id', seg).single();
    if (data) return String((data as unknown as Record<string, unknown>)[entity.nameField] ?? '');
  } catch { console.error('Breadcrumbs: failed to resolve UUID', seg); }
  return null;
}

export default function Breadcrumbs() {
  const t = useT();
  const { pathname } = useLocation();
  const { language } = useTheme();
  const pages = usePageRegistry();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const segments = pathname.split('/').filter(Boolean);
  const Chevron = language === 'ar' ? ChevronLeft : ChevronRight;

  useEffect(() => {
    let cancelled = false;
    const loadLabels = async () => {
      const result: Record<string, string> = {};
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (isUUID(seg)) {
          const prev = segments[i - 1] || '';
          const name = await resolveUUID(seg, prev);
          if (name) result[seg] = name;
        }
      }
      if (!cancelled) setLabels(result);
    };
    loadLabels();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (pathname === '/') return null;

  const crumbs = segments.map((seg, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/');
    const isUuid = isUUID(seg);
    let label: string;
    let labelKey: string | undefined;
    if (isUuid) {
      label = labels[seg] || seg.slice(0, 8) + '...';
    } else {
      labelKey = routeLabels[seg];
      label = labelKey ? t(labelKey) : seg.replace(/-/g, ' ').replace(/_/g, ' ');
    }
    if (!labelKey && !isUuid) {
      const matched = pages.find(p => p.path && path.startsWith(p.path));
      if (matched) {
        label = language === 'ar' && matched.name_ar ? matched.name_ar : (matched.name_en || matched.code);
      }
    }
    return { path, label };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
      <Link to="/" aria-label="Home" className="hover:text-primary transition-colors">
        <Home size={14} />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <Chevron size={14} style={{ color: 'var(--color-text-muted)' }} />
          {i === crumbs.length - 1 ? (
            <span style={{ color: 'var(--color-text)' }} className="font-medium">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-primary transition-colors truncate max-w-[160px]">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
