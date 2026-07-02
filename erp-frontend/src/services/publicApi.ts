import { supabase } from './supabase';

export interface PublicUnit {
  id: string; project_id: string; unit_code: string; unit_type: string;
  floor_number: number | null; area_sqm: number | null; area_built: number | null;
  bedrooms: number; bathrooms: number; status: string; price: number | null;
  currency: string; handover_date: string | null;
  virtual_tour_url: string | null; virtual_tour_type: string | null;
  is_published: boolean; published_at: string | null;
  projects: { id: string; name_en: string; name_ar: string | null; project_type: string | null; location: string | null; latitude: number | null; longitude: number | null } | null;
  block_id: string | null;
  blocks: { id: string; name_en: string; name_ar: string | null } | null;
}

export interface PublicMedia {
  id: string; url: string; thumbnail_url: string | null; media_type: string;
  caption: string | null; sort_order: number; is_featured: boolean;
}

export interface PublicVirtualTour {
  id: string; title: string; tour_url: string; tour_type: string;
  thumbnail_url: string | null;
}

export interface PublicFloor {
  id: string; building_id: string; floor_number: number;
  name_en: string | null; name_ar: string | null; plan_image: string | null;
  room_data: Record<string, unknown>[];
}

export const publicApi = {
  listPublishedUnits: async (options?: { projectId?: string; unitType?: string; minBedrooms?: number; maxPrice?: number; search?: string; limit?: number; offset?: number }) => {
    let q = supabase
      .from('units')
      .select('*, projects(id, name_en, name_ar, project_type, location, latitude, longitude), blocks(id, name_en, name_ar)')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (options?.projectId) q = q.eq('project_id', options.projectId);
    if (options?.unitType) q = q.eq('unit_type', options.unitType);
    if (options?.minBedrooms) q = q.gte('bedrooms', options.minBedrooms);
    if (options?.maxPrice) q = q.lte('price', options.maxPrice);
    if (options?.search) q = q.or(`unit_code.ilike.%${options.search}%,projects.name_en.ilike.%${options.search}%,projects.name_ar.ilike.%${options.search}%`);
    if (options?.limit) q = q.limit(options.limit);
    if (options?.offset) q = q.range(options.offset, options.offset + (options.limit ?? 20) - 1);

    const { data, error } = await q;
    if (error) { console.error('publicApi.listPublishedUnits error:', error); return []; }
    return (data || []) as PublicUnit[];
  },

  getPublishedUnit: async (id: string) => {
    const { data, error } = await supabase
      .from('units')
      .select('*, projects(id, name_en, name_ar, project_type, location, latitude, longitude), blocks(id, name_en, name_ar)')
      .eq('id', id)
      .eq('is_published', true)
      .single();
    if (error) { console.error('publicApi.getPublishedUnit error:', error); return null; }
    return data as PublicUnit | null;
  },

  getUnitMedia: async (unitId: string) => {
    const { data } = await supabase
      .from('property_media')
      .select('*')
      .eq('unit_id', unitId)
      .eq('is_published', true)
      .order('sort_order');
    return (data || []) as PublicMedia[];
  },

  getUnitTours: async (unitId: string) => {
    const { data } = await supabase
      .from('virtual_tours')
      .select('*')
      .eq('unit_id', unitId)
      .eq('is_published', true)
      .order('sort_order');
    return (data || []) as PublicVirtualTour[];
  },

  getUnitFloors: async (buildingId: string) => {
    const { data } = await supabase
      .from('floors')
      .select('*')
      .eq('building_id', buildingId)
      .order('floor_number');
    return (data || []) as PublicFloor[];
  },

  getProjects: async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name_en, name_ar')
      .eq('is_active', true)
      .order('name_en');
    return (data || []) as { id: string; name_en: string; name_ar: string | null }[];
  },
};
