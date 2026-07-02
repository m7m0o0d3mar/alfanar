import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MORE_ITEMS } from './MobileNav';

interface MobileMoreMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMoreMenu({ open, onClose }: MobileMoreMenuProps) {
  const navigate = useNavigate();
  const { canAccessModule } = useAuth();

  if (!open) return null;

  const visibleItems = MORE_ITEMS.filter(item => {
    if (!item.module) return true;
    return canAccessModule(item.module);
  });

  return (
    <>
      <div className="fixed inset-0 z-40 md:hidden" onClick={onClose}
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 40%, transparent)' }}
      />
      <div
        className="fixed bottom-16 left-2 right-2 z-50 md:hidden rounded-2xl border shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="p-2">
          <p className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            More
          </p>
          <div className="grid grid-cols-3 gap-1">
            {visibleItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); onClose(); }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-text)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
