import { QRCodeSVG } from 'qrcode.react';
import { Download, X, ExternalLink } from 'lucide-react';

interface QRCodeModalProps {
  show: boolean;
  onClose: () => void;
  value: string;
  title: string;
  subtitle?: string;
}

export default function QRCodeModal({ show, onClose, value, title, subtitle }: QRCodeModalProps) {
  if (!show) return null;

  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 4;
      canvas.height = img.height * 4;
      ctx!.scale(4, 4);
      ctx!.fillStyle = '#fff';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `qr_${title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors"><X size={18} /></button>
        </div>
        {subtitle && <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
        <div className="flex justify-center p-4 bg-white rounded-xl">
          <QRCodeSVG id="qr-code-svg" value={value} size={220} level="M" includeMargin />
        </div>
        <p className="text-xs text-center mt-3 break-all" style={{ color: 'var(--color-text-muted)' }}>{value}</p>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5" onClick={handleDownload}>
            <Download size={14} /> Download PNG
          </button>
          <a href={value} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm flex items-center justify-center gap-1.5">
            <ExternalLink size={14} /> Open
          </a>
        </div>
      </div>
    </div>
  );
}
