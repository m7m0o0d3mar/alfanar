import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bed, Bath, Maximize, Building2, Home, SlidersHorizontal, X } from 'lucide-react';
import { publicApi, type PublicUnit } from '../services/publicApi';
import { useT } from '../hooks/useTranslation';

const UNIT_TYPE_FILTERS = ['apartment', 'villa', 'office', 'shop', 'penthouse', 'duplex', 'studio', 'plot'];

export default function PublicPropertiesPage() {
  const t = useT();
  const navigate = useNavigate();
  const [units, setUnits] = useState<PublicUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [projects, setProjects] = useState<{ id: string; name_en: string; name_ar: string | null }[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    Promise.all([
      publicApi.listPublishedUnits({ limit: 50 }),
      publicApi.getProjects(),
    ]).then(([unitsData, projectsData]) => {
      setUnits(unitsData);
      setProjects(projectsData);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = units.filter(u => {
    if (search && !u.unit_code.toLowerCase().includes(search.toLowerCase()) &&
      !u.projects?.name_en.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && u.unit_type !== typeFilter) return false;
    if (projectFilter && u.project_id !== projectFilter) return false;
    return true;
  });

  const formatPrice = (price: number | null, currency: string | null) => {
    if (!price) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'SAR', maximumFractionDigits: 0 }).format(price);
  };

  const getUnitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      apartment: 'Apartment', villa: 'Villa', office: 'Office',
      shop: 'Shop', penthouse: 'Penthouse', duplex: 'Duplex',
      studio: 'Studio', plot: 'Plot', warehouse: 'Warehouse',
    };
    return labels[type] || type;
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/public-properties" className="flex items-center gap-2">
            <Building2 size={20} style={{ color: 'var(--color-primary)' }} />
            <span className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{t('public_portal.title')}</span>
          </Link>
          <Link to="/login" className="text-xs" style={{ color: 'var(--color-primary)' }}>
            {t('public_portal.login')}
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>{t('public_portal.heading')}</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t('public_portal.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('public_portal.search_placeholder')}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-sm btn-secondary flex items-center gap-1.5"
          >
            <SlidersHorizontal size={14} />
            {t('public_portal.filters')}
          </button>
        </div>

        {showFilters && (
          <div className="p-4 rounded-lg mb-4 border flex flex-wrap items-center gap-3" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{t('public_portal.type')}</label>
              <select
                value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="text-xs rounded border px-2 py-1.5"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="">{t('public_portal.all_types')}</option>
                {UNIT_TYPE_FILTERS.map(tp => (
                  <option key={tp} value={tp}>{getUnitTypeLabel(tp)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{t('public_portal.project')}</label>
              <select
                value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
                className="text-xs rounded border px-2 py-1.5"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="">{t('public_portal.all_projects')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name_en}</option>
                ))}
              </select>
            </div>
            {(typeFilter || projectFilter) && (
              <button onClick={() => { setTypeFilter(''); setProjectFilter(''); }} className="btn-xs btn-secondary flex items-center gap-1 mt-4">
                <X size={12} /> {t('common.clear')}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-b-2 rounded-full" style={{ borderColor: 'var(--color-primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Home size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('public_portal.no_properties')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(unit => (
              <div
                key={unit.id}
                onClick={() => navigate(`/public-properties/${unit.id}`)}
                className="rounded-xl border overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
                style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
              >
                <div className="h-40 bg-gradient-to-br from-blue-100 to-blue-50 relative flex items-center justify-center">
                  <Building2 size={40} style={{ color: 'var(--color-primary)', opacity: 0.3 }} />
                  <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                    background: unit.status === 'available' ? 'rgba(34,197,94,0.15)' : 'rgba(255,159,28,0.15)',
                    color: unit.status === 'available' ? 'rgb(34,197,94)' : 'rgb(255,159,28)',
                  }}>
                    {unit.status}
                  </span>
                  {unit.unit_type && (
                    <span className="absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                      background: 'rgba(99,102,241,0.12)',
                      color: 'var(--color-primary)',
                    }}>
                      {getUnitTypeLabel(unit.unit_type)}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{unit.unit_code}</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {unit.projects?.name_en || ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>
                      {formatPrice(unit.price, unit.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {unit.bedrooms > 0 && (
                      <span className="flex items-center gap-1"><Bed size={13} />{unit.bedrooms}</span>
                    )}
                    {unit.bathrooms > 0 && (
                      <span className="flex items-center gap-1"><Bath size={13} />{unit.bathrooms}</span>
                    )}
                    {unit.area_sqm && (
                      <span className="flex items-center gap-1"><Maximize size={13} />{unit.area_sqm} m²</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t py-6 mt-12" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('public_portal.footer')}
        </div>
      </footer>
    </div>
  );
}
