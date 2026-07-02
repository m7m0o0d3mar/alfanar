import { ChevronRight, Globe, Home, Building2, Layers, MapPin } from 'lucide-react';

interface BreadcrumbItem {
  level: string;
  id: string;
  label: string;
}

interface Props {
  items: BreadcrumbItem[];
  onNavigate: (level: string, id: string) => void;
  onReset: () => void;
}

const levelIcons: Record<string, React.ReactNode> = {
  project: <Globe size={12} />, block: <Building2 size={12} />,
  building: <Home size={12} />, floor: <Layers size={12} />, unit: <MapPin size={12} />,
};

export default function MapHierarchyBreadcrumb({ items, onNavigate, onReset }: Props) {
  return (
    <div className="flex items-center gap-1 text-xs flex-wrap">
      <button onClick={onReset}
        className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors font-medium ${
          items.length === 0 ? 'gradient-primary text-white' : 'hover:bg-white/10'
        }`}
        style={items.length === 0 ? {} : { color: 'var(--color-text-secondary)' }}>
        <Globe size={12} /> All Projects
      </button>
      {items.map((item, i) => (
        <span key={`${item.level}-${item.id}`} className="flex items-center gap-1">
          <ChevronRight size={11} style={{ color: 'var(--color-text-muted)' }} />
          <button onClick={() => onNavigate(item.level, item.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors font-medium ${
              i === items.length - 1 ? 'gradient-primary text-white' : 'hover:bg-white/10'
            }`}
            style={i !== items.length - 1 ? { color: 'var(--color-text-secondary)' } : {}}>
            {levelIcons[item.level]}
            <span className="truncate max-w-[120px]">{item.label || (item.level.charAt(0).toUpperCase() + item.level.slice(1))}</span>
          </button>
        </span>
      ))}
    </div>
  );
}
