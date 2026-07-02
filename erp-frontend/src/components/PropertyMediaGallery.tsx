import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { X, Upload, Trash2, Star, ChevronLeft, ChevronRight, Image, Play, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface MediaItem {
  id: string;
  unit_id?: string;
  project_id?: string;
  url: string;
  thumbnail_url?: string;
  media_type: 'image' | 'video' | 'floorplan' | 'document';
  caption?: string;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
  created_at: string;
}

interface PropertyMediaGalleryProps {
  unitId?: string;
  projectId?: string;
  readOnly?: boolean;
  title?: string;
}

export default function PropertyMediaGallery({ unitId, projectId, readOnly = false, title = 'Media Gallery' }: PropertyMediaGalleryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (unitId || projectId) loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, projectId]);

  async function loadMedia() {
    setLoading(true);
    let query = supabase.from('property_media').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    if (unitId) query = query.eq('unit_id', unitId);
    if (projectId) query = query.eq('project_id', projectId);
    const { data } = await query;
    setMedia((data as MediaItem[]) || []);
    setLoading(false);
  }

  async function uploadMedia(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop();
        const path = `${unitId || projectId || 'general'}/${Date.now()}_${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('property_media').upload(path, file, { contentType: file.type });
        if (uploadErr) { toast.error(`Upload failed for ${file.name}: ${uploadErr.message}`); continue; }
        const { data: urlData } = supabase.storage.from('property_media').getPublicUrl(path);
        if (!urlData?.publicUrl) continue;
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const record: any = {
          url: urlData.publicUrl,
          media_type: isImage ? 'image' : isVideo ? 'video' : 'document',
          sort_order: media.length + i,
        };
        if (unitId) record.unit_id = unitId;
        if (projectId) record.project_id = projectId;
        await supabase.from('property_media').insert(record);
      }
      toast.success(`${files.length} file(s) uploaded`);
      loadMedia();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function deleteMedia(id: string) {
    await supabase.from('property_media').delete().eq('id', id);
    toast.success('Media deleted');
    loadMedia();
  }

  async function setFeatured(id: string) {
    await supabase.from('property_media').update({ is_featured: true }).eq('id', id);
    if (unitId) await supabase.from('property_media').update({ is_featured: false }).eq('unit_id', unitId).neq('id', id);
    loadMedia();
  }

  const images = media.filter(m => m.media_type === 'image');
  const videos = media.filter(m => m.media_type === 'video');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Image size={16} /> {title} ({media.length})</h3>
        {!readOnly && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => { uploadMedia(e.target.files); e.target.value = ''; }} />
            <button className="btn-sm btn-secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" /></div>
      ) : media.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          <Image size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No media yet</p>
          {!readOnly && <button className="btn-sm btn-secondary mt-2" onClick={() => fileRef.current?.click()}>Upload photos</button>}
        </div>
      ) : (
        <>
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((item, idx) => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden border cursor-pointer" style={{ borderColor: 'var(--color-border)', aspectRatio: '4/3' }}
                  onClick={() => setLightboxIndex(idx)}>
                  <img src={item.thumbnail_url || item.url} alt={item.caption || 'Media'} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    {!readOnly && (
                      <>
                        {!item.is_featured && <button onClick={(e) => { e.stopPropagation(); setFeatured(item.id); }} className="p-1 bg-white/90 rounded text-yellow-500 hover:bg-white"><Star size={12} /></button>}
                        <button onClick={(e) => { e.stopPropagation(); deleteMedia(item.id); }} className="p-1 bg-white/90 rounded text-red-500 hover:bg-white"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                  {item.is_featured && <div className="absolute top-1 left-1 bg-yellow-400 text-white p-0.5 rounded"><Star size={10} /></div>}
                  {item.caption && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1"><p className="text-white text-[10px] truncate">{item.caption}</p></div>}
                </div>
              ))}
            </div>
          )}

          {videos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Videos ({videos.length})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {videos.map(item => (
                  <div key={item.id} className="relative rounded-lg overflow-hidden border group cursor-pointer" style={{ borderColor: 'var(--color-border)', aspectRatio: '4/3' }}
                    onClick={() => window.open(item.url, '_blank')}>
                    <img src={item.thumbnail_url || item.url} alt={item.caption || 'Video'} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center"><Play size={28} className="text-white opacity-70" fill="white" /></div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      {!readOnly && <button onClick={(e) => { e.stopPropagation(); deleteMedia(item.id); }} className="p-1 bg-white/90 rounded text-red-500 hover:bg-white"><Trash2 size={12} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-10" onClick={() => setLightboxIndex(null)}><X size={24} /></button>
          {images.length > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10 p-2"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev === null ? 0 : (prev - 1 + images.length) % images.length); }}>
                <ChevronLeft size={32} />
              </button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10 p-2"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev === null ? 0 : (prev + 1) % images.length); }}>
                <ChevronRight size={32} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm z-10">
                {lightboxIndex + 1} / {images.length}
              </div>
            </>
          )}
          <img src={images[lightboxIndex]?.url} alt="Gallery" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
