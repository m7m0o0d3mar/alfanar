import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { mapLayerImagesApi, type MapLayerImage } from '../services/mapsApi';
import { Image, X, Upload, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  projectId?: string;
  blockId?: string;
  buildingId?: string;
  floorId?: string;
  editable?: boolean;
  onUpdate?: () => void;
}

export default function MapImageLayer({ projectId, blockId, buildingId, floorId, editable, onUpdate }: Props) {
  const map = useMap();
  const [images, setImages] = useState<MapLayerImage[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const overlaysRef = useRef<L.ImageOverlay[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data: MapLayerImage[] = [];
      if (projectId) data = await mapLayerImagesApi.listByProject(projectId);
      if (blockId) data = await mapLayerImagesApi.listByBlock(blockId);
      if (buildingId) data = await mapLayerImagesApi.listByBuilding(buildingId);
      if (floorId) data = await mapLayerImagesApi.listByFloor(floorId);
      if (!cancelled) setImages(data);
    })();
    return () => { cancelled = true; };
  }, [projectId, blockId, buildingId, floorId]);

  useEffect(() => {
    const existing = overlaysRef.current;
    existing.forEach(o => map.removeLayer(o));
    overlaysRef.current = [];

    for (const img of images) {
      const b = img.image_bounds;
      if (!b.north || !b.south || !b.east || !b.west) continue;
      const bounds: L.LatLngBoundsExpression = [[b.south, b.west], [b.north, b.east]];
      const overlay = L.imageOverlay(img.image_url, bounds, { opacity: img.opacity });
      overlay.addTo(map);
      overlaysRef.current.push(overlay);
    }

    return () => {
      overlaysRef.current.forEach(o => map.removeLayer(o));
      overlaysRef.current = [];
    };
  }, [map, images]);

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `map_images/${Date.now()}_${file.name}`;
      const { error: upErr } = await import('../services/supabase').then(s =>
        s.supabase.storage.from('map_layer_images').upload(path, file, { contentType: file.type })
      );
      if (upErr) throw upErr;
      const { data: urlData } = await import('../services/supabase').then(s =>
        s.supabase.storage.from('map_layer_images').getPublicUrl(path)
      );
      const publicUrl = urlData?.publicUrl || '';
      if (!publicUrl) throw new Error('No public URL');

      const bounds = map.getBounds();
      await mapLayerImagesApi.upsert({
        project_id: projectId || undefined,
        block_id: blockId || undefined,
        building_id: buildingId || undefined,
        floor_id: floorId || undefined,
        name_en: file.name.replace(/\.[^.]+$/, ''),
        image_url: publicUrl,
        image_bounds: { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() },
        opacity: 0.8,
        sort_order: images.length,
      });
      onUpdate?.();
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
    e.target.value = '';
  }

  async function deleteImage(id: string) {
    await mapLayerImagesApi.remove(id);
    onUpdate?.();
  }

  async function setOpacity(id: string, opacity: number) {
    await mapLayerImagesApi.upsert({ id, opacity });
    onUpdate?.();
  }

  return (
    <>
      {editable && (
        <div className="absolute bottom-12 right-2 z-[1000]">
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5 text-xs flex items-center gap-1 hover:bg-white transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Image size={12} /> {images.length > 0 ? `${images.length} layers` : 'Images'}
            {showPanel ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>

          {showPanel && (
            <div className="absolute bottom-full right-0 mb-1 w-56 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg max-h-64 overflow-y-auto">
              <div className="p-2 border-b space-y-1" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Image Layers</p>
                {images.length === 0 && (
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>No images for this level</p>
                )}
                {images.map(img => (
                  <div key={img.id} className="flex items-center gap-1.5 py-0.5 group">
                    <img src={img.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                    <span className="flex-1 truncate text-[10px]">{img.name_en}</span>
                    <input type="range" min="0" max="1" step="0.1" value={img.opacity}
                      onChange={e => setOpacity(img.id, parseFloat(e.target.value))}
                      className="w-12 h-1" style={{ accentColor: 'var(--color-primary)' }} />
                    <button onClick={() => deleteImage(img.id)} className="opacity-0 group-hover:opacity-100 text-red-500">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-1.5">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadImage} />
                <button className="btn-primary btn-xs w-full flex items-center justify-center gap-1" disabled={uploading}
                  onClick={() => fileRef.current?.click()}>
                  <Upload size={10} /> {uploading ? 'Uploading...' : 'Add Image Overlay'}
                </button>
                <p className="text-[9px] text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Image will be placed on current map view
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
