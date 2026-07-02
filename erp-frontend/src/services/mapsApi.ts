import { supabase } from './supabase';

export interface MapLayerImage {
  id: string;
  project_id?: string;
  block_id?: string;
  building_id?: string;
  floor_id?: string;
  name_en: string;
  name_ar?: string;
  image_url: string;
  image_bounds: { north: number; south: number; east: number; west: number };
  opacity: number;
  sort_order: number;
  is_active: boolean;
}

export interface GeometryImport {
  id: string;
  project_id: string;
  import_type: 'geojson' | 'csv' | 'draw' | 'form' | 'template';
  source_name?: string;
  raw_data?: any;
  processed_count: number;
  error_count: number;
  status: string;
  created_at: string;
}

export const mapLayerImagesApi = {
  listByProject: async (projectId: string) => {
    const { data } = await supabase.from('map_layer_images').select('*').eq('project_id', projectId).eq('is_active', true).order('sort_order');
    return (data || []) as MapLayerImage[];
  },
  listByBlock: async (blockId: string) => {
    const { data } = await supabase.from('map_layer_images').select('*').eq('block_id', blockId).eq('is_active', true).order('sort_order');
    return (data || []) as MapLayerImage[];
  },
  listByBuilding: async (buildingId: string) => {
    const { data } = await supabase.from('map_layer_images').select('*').eq('building_id', buildingId).eq('is_active', true).order('sort_order');
    return (data || []) as MapLayerImage[];
  },
  listByFloor: async (floorId: string) => {
    const { data } = await supabase.from('map_layer_images').select('*').eq('floor_id', floorId).eq('is_active', true).order('sort_order');
    return (data || []) as MapLayerImage[];
  },
  upsert: async (img: Partial<MapLayerImage>) => {
    if (img.id) {
      const { error } = await supabase.from('map_layer_images').update(img).eq('id', img.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('map_layer_images').insert(img);
      if (error) throw error;
    }
  },
  remove: async (id: string) => {
    await supabase.from('map_layer_images').delete().eq('id', id);
  },
};

export const geometryImportsApi = {
  create: async (imp: Partial<GeometryImport>) => {
    const { data, error } = await supabase.from('geometry_imports').insert(imp).select().single();
    if (error) throw error;
    return data as GeometryImport;
  },
  update: async (id: string, imp: Partial<GeometryImport>) => {
    const { error } = await supabase.from('geometry_imports').update(imp).eq('id', id);
    if (error) throw error;
  },
};

export interface HierarchyState {
  projectId?: string;
  blockId?: string;
  buildingId?: string;
  floorId?: string;
  unitId?: string;
}

export interface MapViewConfig {
  id?: string;
  name_en: string;
  name_ar?: string;
  hierarchy_state: HierarchyState | null;
  filters: Record<string, any> | null;
  viewport: { center?: [number, number]; zoom?: number; bounds?: any } | null;
  layers: Record<string, any> | null;
}
