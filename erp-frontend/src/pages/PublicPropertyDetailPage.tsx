import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bed, Bath, MapPin, Home, Maximize, DollarSign, Calendar, Tag, Building2, Image, Video, Grid3x3 } from 'lucide-react';
import { publicApi, type PublicUnit, type PublicMedia, type PublicVirtualTour, type PublicFloor } from '../services/publicApi';
import { useT } from '../hooks/useTranslation';
import VirtualTourEmbed from '../components/VirtualTourEmbed';
import InteractiveFloorPlan from '../components/InteractiveFloorPlan';

type Tab = 'info' | 'media' | 'tour' | 'floor_plan';

export default function PublicPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const [unit, setUnit] = useState<PublicUnit | null>(null);
  const [media, setMedia] = useState<PublicMedia[]>([]);
  const [tours, setTours] = useState<PublicVirtualTour[]>([]);
  const [floors, setFloors] = useState<PublicFloor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [selectedImage, setSelectedImage] = useState<PublicMedia | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    publicApi.getPublishedUnit(id).then(async (u) => {
      if (!u) { setUnit(null); setLoading(false); return; }
      setUnit(u);
      const [mediaData, toursData] = await Promise.all([
        publicApi.getUnitMedia(u.id),
        publicApi.getUnitTours(u.id),
      ]);
      setMedia(mediaData);
      setTours(toursData);
      if (u.block_id) {
        const floorData = await publicApi.getUnitFloors(u.block_id);
        setFloors(floorData);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const formatPrice = (price: number | null, currency: string | null) => {
    if (!price) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'SAR', maximumFractionDigits: 0 }).format(price);
  };

  const featuredMedia = media.filter(m => m.is_featured);
  const defaultMedia = media.filter(m => !m.is_featured);
  const sortedMedia = [...featuredMedia, ...defaultMedia];

  if (loading) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-b-2 rounded-full" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    </div>
  );

  if (!unit) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Home size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-lg font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('public_portal.property_not_found')}</p>
        <button onClick={() => navigate('/public-properties')} className="btn-primary btn-sm mt-4">{t('public_portal.back_to_listing')}</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/public-properties')} className="btn-xs btn-secondary">
            <ArrowLeft size={14} />
          </button>
          <Building2 size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{unit.unit_code}</span>
          <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{
            background: unit.status === 'available' ? 'rgba(34,197,94,0.15)' : 'rgba(255,159,28,0.15)',
            color: unit.status === 'available' ? 'rgb(34,197,94)' : 'rgb(255,159,28)',
          }}>{unit.status}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="card p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>{unit.unit_code}</h1>
              <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <MapPin size={14} />
                {unit.projects?.name_en || ''}
                {unit.projects?.location ? ` — ${unit.projects.location}` : ''}
              </p>
              {unit.blocks && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  <Building2 size={12} className="inline mr-1" />{unit.blocks.name_en}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatPrice(unit.price, unit.currency)}
              </div>
              {unit.area_sqm && (
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{unit.area_sqm} sqm</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {unit.bedrooms > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                  <Bed size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div><div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{unit.bedrooms}</div><div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('public_portal.bedrooms')}</div></div>
              </div>
            )}
            {unit.bathrooms > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                  <Bath size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div><div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{unit.bathrooms}</div><div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('public_portal.bathrooms')}</div></div>
              </div>
            )}
            {unit.area_sqm && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                  <Maximize size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div><div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{unit.area_sqm}</div><div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>sqm</div></div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                <Tag size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div><div className="text-xs font-medium capitalize" style={{ color: 'var(--color-text)' }}>{unit.unit_type}</div><div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('public_portal.type')}</div></div>
            </div>
            {unit.handover_date && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                  <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div><div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{new Date(unit.handover_date).toLocaleDateString()}</div><div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{t('public_portal.handover')}</div></div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--color-border)' }}>
          {([
            { key: 'info' as Tab, icon: Home, label: t('public_portal.info') },
            { key: 'media' as Tab, icon: Image, label: t('public_portal.media') },
            { key: 'tour' as Tab, icon: Video, label: t('public_portal.virtual_tour') },
            { key: 'floor_plan' as Tab, icon: Grid3x3, label: t('public_portal.floor_plan') },
          ]).filter(tab => {
            if (tab.key === 'media' && sortedMedia.length === 0) return false;
            if (tab.key === 'tour' && tours.length === 0 && !unit.virtual_tour_url) return false;
            if (tab.key === 'floor_plan' && floors.length === 0) return false;
            return true;
          }).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-t flex items-center gap-1 ${activeTab === tab.key ? 'gradient-primary text-white' : ''}`}
              style={activeTab !== tab.key ? { color: 'var(--color-text-secondary)' } : {}}>
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Home size={15} /> {t('public_portal.specifications')}</h3>
              <div className="text-xs space-y-2" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="flex justify-between py-1"><span>{t('public_portal.unit_code')}</span><span className="font-mono" style={{ color: 'var(--color-text)' }}>{unit.unit_code}</span></div>
                <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.type')}</span><span className="capitalize" style={{ color: 'var(--color-text)' }}>{unit.unit_type}</span></div>
                <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.status')}</span><span className="capitalize" style={{ color: 'var(--color-text)' }}>{unit.status}</span></div>
                <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.project')}</span><span style={{ color: 'var(--color-text)' }}>{unit.projects?.name_en || '—'}</span></div>
                {unit.floor_number !== null && <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.floor')}</span><span style={{ color: 'var(--color-text)' }}>{unit.floor_number}</span></div>}
              </div>
            </div>
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-text)' }}><DollarSign size={15} /> {t('public_portal.pricing')}</h3>
              <div className="text-xs space-y-2" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="flex justify-between py-1"><span>{t('public_portal.price')}</span><span className="font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(unit.price, unit.currency)}</span></div>
                <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.area')}</span><span style={{ color: 'var(--color-text)' }}>{unit.area_sqm ? `${unit.area_sqm} sqm` : '—'}</span></div>
                {unit.area_built && <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.built_up')}</span><span style={{ color: 'var(--color-text)' }}>{unit.area_built} sqm</span></div>}
                <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.bedrooms')}</span><span style={{ color: 'var(--color-text)' }}>{unit.bedrooms}</span></div>
                <div className="flex justify-between py-1 border-t" style={{ borderColor: 'var(--color-border)' }}><span>{t('public_portal.bathrooms')}</span><span style={{ color: 'var(--color-text)' }}>{unit.bathrooms}</span></div>
              </div>
            </div>
            <div className="card p-4 space-y-3 md:col-span-2">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{t('public_portal.description')}</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {unit.unit_type} in {unit.projects?.name_en || ''}{unit.blocks ? `, ${unit.blocks.name_en}` : ''}.
                {unit.bedrooms > 0 ? ` ${unit.bedrooms} bedroom(s), ${unit.bathrooms} bathroom(s).` : ''}
                {unit.area_sqm ? ` Total area: ${unit.area_sqm} sqm.` : ''}
                {unit.handover_date ? ` Handover: ${new Date(unit.handover_date).toLocaleDateString()}.` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="card p-4">
            {sortedMedia.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                <Image size={40} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('public_portal.no_media')}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {sortedMedia.map(m => (
                    <div key={m.id} className="relative group cursor-pointer rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => setSelectedImage(m)}>
                      {m.media_type === 'video' ? (
                        <div className="aspect-video flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
                          <Video size={24} style={{ color: 'var(--color-primary)' }} />
                        </div>
                      ) : (
                        <img src={m.thumbnail_url || m.url} alt={m.caption || ''}
                          className="w-full aspect-video object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      {m.caption && (
                        <div className="absolute bottom-0 left-0 right-0 p-1.5 text-[10px] font-medium truncate"
                          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white' }}>
                          {m.caption}
                        </div>
                      )}
                      {m.is_featured && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(255,193,7,0.85)', color: '#000' }}>
                          Featured
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Lightbox */}
                {selectedImage && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}
                    onClick={() => setSelectedImage(null)}>
                    <button className="absolute top-4 right-4 text-white text-xl font-bold px-3 py-1 rounded hover:bg-white/20">&times;</button>
                    {selectedImage.media_type === 'video' ? (
                      <video src={selectedImage.url} controls className="max-w-[90vw] max-h-[85vh] rounded" />
                    ) : (
                      <img src={selectedImage.url} alt={selectedImage.caption || ''} className="max-w-[90vw] max-h-[85vh] object-contain rounded" />
                    )}
                    {selectedImage.caption && (
                      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm px-4 py-1.5 rounded" style={{ background: 'rgba(0,0,0,0.6)' }}>
                        {selectedImage.caption}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Virtual Tour Tab */}
        {activeTab === 'tour' && (
          <div className="card p-4">
            {tours.length > 0 ? (
              <div className="space-y-4">
                {tours.map(tour => (
                  <div key={tour.id}>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{tour.title}</h4>
                    <VirtualTourEmbed url={tour.tour_url} tourType={tour.tour_type as any} title={tour.title} height={500} />
                  </div>
                ))}
              </div>
            ) : unit.virtual_tour_url ? (
              <VirtualTourEmbed url={unit.virtual_tour_url} tourType={(unit.virtual_tour_type || 'matterport') as any} title={unit.unit_code} height={500} />
            ) : (
              <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                <Video size={40} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('public_portal.no_tour')}</p>
              </div>
            )}
          </div>
        )}

        {/* Floor Plan Tab */}
        {activeTab === 'floor_plan' && (
          <div className="card p-4">
            {(() => {
              const unitFloor = floors.find(f => f.floor_number === unit.floor_number);
              const floor = unitFloor || floors[0];
              if (!floor?.plan_image) {
                return (
                  <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                    <Grid3x3 size={40} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{t('public_portal.no_floor_plan')}</p>
                  </div>
                );
              }
              interface RawRoom { id: string; label: string; x: number; y: number; width: number; height: number; type: string; area_sqm?: number; unit_id?: string; price?: number; }
              const rawRooms = (floor.room_data || []) as unknown as RawRoom[];
              const rooms = rawRooms.map(r => ({
                id: r.id,
                name_en: r.label,
                room_type: r.type,
                area_sqm: r.area_sqm,
                polygon: [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]] as [number, number][],
                price: r.price,
                unit_id: r.unit_id,
              }));
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {floor.name_en || `Floor ${floor.floor_number}`}
                    </span>
                    {floors.length > 1 && (
                      <select className="text-xs border rounded px-2 py-1" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        value={floor.id} onChange={e => {
                          const sel = floors.find(f => f.id === e.target.value);
                          if (sel) setActiveTab('floor_plan');
                        }}>
                        {floors.map(f => (
                          <option key={f.id} value={f.id}>{f.name_en || `Floor ${f.floor_number}`}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <InteractiveFloorPlan
                    imageUrl={floor.plan_image}
                    hotspots={rooms}
                    onUnitClick={(uid) => navigate(`/public-properties/${uid}`)}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <footer className="border-t py-6 mt-12" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('public_portal.footer')}
        </div>
      </footer>
    </div>
  );
}
