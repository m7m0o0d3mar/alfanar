import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', variant = 'danger', onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  const accentColor = variant === 'danger' ? 'var(--color-danger)' :
    variant === 'warning' ? 'var(--color-warning)' : 'var(--color-primary)';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full" style={{background: `color-mix(in srgb, ${accentColor} 15%, transparent)`}}>
            <AlertTriangle size={22} style={{color: accentColor}} />
          </div>
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <p className="text-sm mb-6" style={{color: 'var(--color-text-secondary)'}}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn-sm px-4 text-white font-semibold rounded-full"
            style={{background: accentColor}}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
