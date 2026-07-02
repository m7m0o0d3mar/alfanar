import { useState } from 'react';
import { Maximize2, Minimize2, ExternalLink, Loader2 } from 'lucide-react';

interface VirtualTourEmbedProps {
  url: string;
  title?: string;
  tourType?: 'matterport' | 'zillow3d' | 'custom3d' | 'kuula' | 'other';
  height?: number;
  className?: string;
}

export default function VirtualTourEmbed({
  url, title, tourType = 'matterport', height = 400, className = '',
}: VirtualTourEmbedProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function getEmbedUrl(tourUrl: string, type: string): string | null {
    try {
      if (type === 'matterport') {
        const match = tourUrl.match(/matterport\.com\/(?:show|models)\/([a-zA-Z0-9_-]+)/);
        if (match) return `https://my.matterport.com/show/?m=${match[1]}&play=1`;
        if (tourUrl.includes('my.matterport.com')) return tourUrl;
      }
      if (type === 'zillow3d' || type === 'kuula') {
        return tourUrl;
      }
      return tourUrl;
    } catch { return tourUrl; }
  }

  const embedUrl = getEmbedUrl(url, tourType);
  if (!embedUrl || error) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed ${className}`}
        style={{ height, borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
        <ExternalLink size={20} />
        <span className="text-sm">Open Virtual Tour</span>
      </a>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden border ${className}`} style={{ borderColor: 'var(--color-border)' }}>
      <div style={{ height: fullscreen ? '100dvh' : height }} className="relative bg-black">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <Loader2 size={24} className="animate-spin text-white/60" />
          </div>
        )}
        <iframe
          src={embedUrl}
          title={title || 'Virtual Tour'}
          className="w-full h-full border-0"
          allowFullScreen
          loading="lazy"
          allow="xr-spatial-tracking; gyroscope; accelerometer"
          onLoad={() => setLoading(false)}
          onError={() => setError(true)}
        />
      </div>
      <div className="absolute top-2 right-2 flex gap-1">
        <button className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded text-xs transition-colors"
          onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded text-xs transition-colors" title="Open in new tab">
          <ExternalLink size={14} />
        </a>
      </div>
      {title && (
        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {title}
        </div>
      )}
    </div>
  );
}
