import { FileX2, Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  /** Wrap in <tr><td> for use inside <table> */
  asTableRow?: boolean;
}

export default function EmptyState({ title, description, actionLabel, onAction, icon, asTableRow }: EmptyStateProps) {
  const inner = (
    <div className="empty-state">
      <div className="text-[var(--color-text-muted)] mb-4">
        {icon || <FileX2 size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="text-base font-semibold mb-1" style={{color: 'var(--color-text-secondary)'}}>
        {title || 'No records found'}
      </h3>
      {description && (
        <p className="text-sm max-w-md mb-6" style={{color: 'var(--color-text-muted)'}}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button className="btn-primary btn-sm" onClick={onAction}>
          <Plus size={16} /> {actionLabel}
        </button>
      )}
    </div>
  );
  if (asTableRow) return <tr><td colSpan={99}>{inner}</td></tr>;
  return inner;
}
