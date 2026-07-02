import { useState, useEffect, useRef } from 'react';
import { X, FileText, FileImage, FileVideo, File, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  url: string;
  fileName: string;
  mimeType?: string;
  onClose: () => void;
}

export default function FilePreviewModal({ url, fileName, mimeType, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [dxfSvg, setDxfSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const type = mimeType || '';

  const isImage = type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isVideo = type.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isPdf = type === 'application/pdf' || ext === 'pdf';
  const isDxf = ext === 'dxf';
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
  const isText = ['txt', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext);

  useEffect(() => {
    setLoading(true);
    setError('');

    if (isDxf) {
      import('dxf-parser').then((mod) => {
        fetch(url)
          .then((r) => r.text())
          .then((dxfText) => {
            const parser = new mod.default();
            const drawing = parser.parseSync(dxfText);
            const svgParts: string[] = [];
            const entities: any[] = drawing?.entities || [];
            for (const e of entities) {
              if (e.type === 'LINE' && e.vertices) {
                svgParts.push(`<line x1="${e.vertices[0]?.x}" y1="${-e.vertices[0]?.y}" x2="${e.vertices[1]?.x}" y2="${-e.vertices[1]?.y}" stroke="#3388ff" stroke-width="1.5" />`);
              } else if (e.type === 'LWPOLYLINE' && e.vertices) {
                const pts = e.vertices.map((v: any) => `${v.x},${-v.y}`).join(' ');
                svgParts.push(`<polyline points="${pts}" fill="none" stroke="#3388ff" stroke-width="1.5" />`);
              } else if (e.type === 'CIRCLE' && e.center) {
                svgParts.push(`<circle cx="${e.center.x}" cy="${-e.center.y}" r="${e.radius}" fill="none" stroke="#3388ff" stroke-width="1.5" />`);
              } else if (e.type === 'ARC' && e.center) {
                svgParts.push(`<path d="${describeArc(e.center.x, -e.center.y, e.radius, e.startAngle || 0, e.endAngle || 360)}" fill="none" stroke="#3388ff" stroke-width="1.5" />`);
              }
            }
            const bbox = calculateBbox(entities);
            const pad = 40;
            const w = Math.max((bbox.maxX - bbox.minX) + pad * 2, 400);
            const h = Math.max((bbox.maxY - bbox.minY) + pad * 2, 300);
            const viewBox = `${bbox.minX - pad} ${-bbox.maxY - pad} ${w} ${h}`;
            setDxfSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" style="background:#f8f9fa">${svgParts.join('\n')}</svg>`);
          }).catch(() => setError('Failed to load DXF file')).finally(() => setLoading(false));
      }).catch(() => { setError('DXF parser not available'); setLoading(false); });
    } else if (isPdf) {
      setLoading(false);
    } else if (isImage || isVideo) {
      setLoading(false);
    } else if (isOffice) {
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [url]);

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const s = polarToCartesian(cx, cy, r, endAngle);
    const e = polarToCartesian(cx, cy, r, startAngle);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
  }
  function calculateBbox(entities: any[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const e of entities) {
      for (const v of e.vertices || []) {
        if (v.x != null) { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); }
        if (v.y != null) { minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
      }
      if (e.center) {
        const r = e.radius || 0;
        minX = Math.min(minX, e.center.x - r); maxX = Math.max(maxX, e.center.x + r);
        minY = Math.min(minY, e.center.y - r); maxY = Math.max(maxY, e.center.y + r);
      }
    }
    if (!isFinite(minX)) { minX = -200; maxX = 200; minY = -200; maxY = 200; }
    return { minX, minY, maxX, maxY };
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm truncate">
          {isImage ? <FileImage size={16} /> : isVideo ? <FileVideo size={16} /> : isPdf ? <FileText size={16} /> : <File size={16} />}
          <span className="truncate max-w-md">{fileName}</span>
          <span className="text-xs opacity-60">({ext.toUpperCase()})</span>
        </div>
        <div className="flex items-center gap-2">
          {(isImage || isPdf) && (
            <>
              <button className="p-1 hover:bg-white/10 rounded" onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}><ZoomIn size={18} /></button>
              <button className="p-1 hover:bg-white/10 rounded" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}><ZoomOut size={18} /></button>
              <span className="text-xs opacity-60 mx-1">{Math.round(zoom * 100)}%</span>
            </>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white/10 rounded" download={fileName}><Download size={18} /></a>
          <button className="p-1 hover:bg-white/10 rounded" onClick={onClose}><X size={20} /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="text-center text-red-400">
            <p>{error}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="underline mt-2 inline-block">Download file</a>
          </div>
        ) : loading ? (
          <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
        ) : isImage ? (
          <img src={url} alt={fileName} style={{ transform: `scale(${zoom})`, maxWidth: '95vw', maxHeight: '85vh' }} className="object-contain transition-transform" />
        ) : isVideo ? (
          <video controls autoPlay className="max-w-[90vw] max-h-[80vh]" src={url}>
            <track kind="captions" />
          </video>
        ) : isPdf ? (
          <iframe src={`${url}#zoom=${Math.round(zoom * 100)}`} className="w-full h-full min-h-[80vh]" style={{ border: 'none' }} title={fileName} />
        ) : isDxf && dxfSvg ? (
          <div className="w-full h-full min-h-[70vh]" dangerouslySetInnerHTML={{ __html: dxfSvg }} />
        ) : isOffice ? (
          <div className="text-center space-y-3">
            <FileText size={64} className="mx-auto text-blue-400" />
            <p className="text-white text-lg">Preview not available in browser</p>
            <p className="text-gray-400 text-sm">{fileName}</p>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              download={fileName}>
              <Download size={16} /> Download & Open in {ext.startsWith('x') ? 'Excel' : ext.startsWith('d') ? 'Word' : ext.startsWith('p') ? 'PowerPoint' : 'Office'}
            </a>
          </div>
        ) : isText ? (
          <iframe src={url} className="w-full h-full min-h-[70vh] bg-white rounded-lg" style={{ border: 'none' }} title={fileName} />
        ) : (
          <div className="text-center space-y-3">
            <File size={64} className="mx-auto text-gray-400" />
            <p className="text-white text-lg">Cannot preview this file type</p>
            <p className="text-gray-400 text-sm">{fileName}</p>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download size={16} /> Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
