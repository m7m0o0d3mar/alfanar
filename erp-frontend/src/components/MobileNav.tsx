import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Warehouse,
  HardHat,
  MoreHorizontal,
  FileText,
  ShoppingCart,
  Users,
  CheckSquare,
  ClipboardList,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, module: null },
  { path: '/projects', label: 'Projects', icon: Building2, module: null },
  { path: '/execution', label: 'Execution', icon: HardHat, module: 'execution' },
  { path: '/warehouse', label: 'Warehouse', icon: Warehouse, module: 'warehouse' },
  { path: '/more', label: 'More', icon: MoreHorizontal, module: null, isMore: true },
];

const MORE_ITEMS = [
  { path: '/procurement', label: 'Procurement', icon: ShoppingCart, module: 'procurement' },
  { path: '/hr', label: 'HR', icon: Users, module: 'hr' },
  { path: '/approvals', label: 'Approvals', icon: CheckSquare, module: 'approvals' },
  { path: '/daily-reports', label: 'Reports', icon: ClipboardList, module: 'reports' },
  { path: '/communication', label: 'Messaging', icon: MessageSquare, module: 'communication' },
  { path: '/quality', label: 'Quality', icon: FileText, module: 'quality' },
];

interface MobileNavProps {
  onMoreOpen: () => void;
  isMoreOpen: boolean;
}

export default function MobileNav({ onMoreOpen, isMoreOpen }: MobileNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessModule } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.isMore) return true;
    if (!item.module) return true;
    return canAccessModule(item.module);
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map(item => {
          const isActive = item.isMore
            ? isMoreOpen
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => {
                if (item.isMore) {
                  onMoreOpen();
                } else {
                  navigate(item.path);
                }
              }}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-colors relative"
              style={{
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              {isActive && (
                <span
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { MORE_ITEMS };
