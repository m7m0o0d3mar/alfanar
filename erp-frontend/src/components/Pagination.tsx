import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

const btnStyle = (active: boolean): React.CSSProperties => ({
  minWidth: '2rem', height: '2rem', borderRadius: 'var(--radius-btn)',
  backgroundColor: active ? 'var(--color-primary)' : 'transparent',
  color: active ? 'white' : 'var(--color-text-secondary)',
  border: active ? 'none' : '1px solid var(--color-border)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.875rem',
});

export default function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const pages: (string | number)[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" style={btnStyle(false)} onClick={() => onChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          typeof p === 'string'
            ? <span key={`e${i}`} className="px-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>...</span>
            : <button key={p} type="button" style={btnStyle(p === page)} onClick={() => onChange(p)}>{p}</button>
        )}
        <button type="button" style={btnStyle(false)} onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
