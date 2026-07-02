import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type HierarchyLevel = 'project' | 'block' | 'building' | 'floor' | 'unit';
export type ViewMode = '2d' | '3d' | 'split';
export type TileLayerType = 'street' | 'satellite' | 'terrain';
export type DrawMode = 'none' | 'polygon' | 'rectangle' | 'marker' | 'edit';

export interface BreadcrumbItem {
  level: HierarchyLevel;
  id: string;
  label: string;
}

interface MapHierarchyState {
  projectId: string | null;
  blockId: string | null;
  buildingId: string | null;
  floorId: string | null;
  unitId: string | null;
  selectedType: string;
  selectedId: string;
  viewMode: ViewMode;
  tileLayer: TileLayerType;
  drawMode: DrawMode;
  showHierarchy: boolean;
  showProperties: boolean;
  showLegend: boolean;
  searchQuery: string;
  statusFilter: string;
  breadcrumb: BreadcrumbItem[];
}

interface MapHierarchyContextType extends MapHierarchyState {
  navigateTo: (level: HierarchyLevel, id: string, label: string) => void;
  navigateUp: () => void;
  setViewMode: (mode: ViewMode) => void;
  setTileLayer: (layer: TileLayerType) => void;
  setDrawMode: (mode: DrawMode) => void;
  setShowHierarchy: (v: boolean) => void;
  setShowProperties: (v: boolean) => void;
  setShowLegend: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (f: string) => void;
  clearSelection: () => void;
  resetToAllProjects: () => void;
}

const MapHierarchyContext = createContext<MapHierarchyContextType | null>(null);

export function MapHierarchyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MapHierarchyState>({
    projectId: null, blockId: null, buildingId: null, floorId: null, unitId: null,
    selectedType: '', selectedId: '', viewMode: '2d', tileLayer: 'street',
    drawMode: 'none', showHierarchy: true, showProperties: false, showLegend: true,
    searchQuery: '', statusFilter: 'all', breadcrumb: [],
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((partial: Partial<MapHierarchyState>) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      stateRef.current = next;
      return next;
    });
  }, []);

  const navigateTo = useCallback((level: HierarchyLevel, id: string, label: string) => {
    const bc: BreadcrumbItem[] = [];
    if (level === 'block' || level === 'building' || level === 'floor' || level === 'unit') {
      if (stateRef.current.projectId) bc.push({ level: 'project', id: stateRef.current.projectId, label: '' });
    }
    if (level === 'building' || level === 'floor' || level === 'unit') {
      if (stateRef.current.blockId) {
        const blk = document.querySelector(`[data-block-id="${stateRef.current.blockId}"]`);
        bc.push({ level: 'block', id: stateRef.current.blockId, label: blk?.textContent || 'Block' });
      }
    }
    if (level === 'floor' || level === 'unit') {
      if (stateRef.current.buildingId) {
        bc.push({ level: 'building', id: stateRef.current.buildingId, label: '' });
      }
    }
    bc.push({ level, id, label });

    const ids: Partial<MapHierarchyState> = {};
    ids.selectedType = level;
    ids.selectedId = id;
    if (level === 'project') { ids.projectId = id; ids.blockId = null; ids.buildingId = null; ids.floorId = null; ids.unitId = null; }
    else if (level === 'block') { ids.blockId = id; ids.buildingId = null; ids.floorId = null; ids.unitId = null; }
    else if (level === 'building') { ids.buildingId = id; ids.floorId = null; ids.unitId = null; }
    else if (level === 'floor') { ids.floorId = id; ids.unitId = null; }
    else if (level === 'unit') { ids.unitId = id; }

    patch({ ...ids, breadcrumb: bc, showProperties: true });
  }, [patch]);

  const navigateUp = useCallback(() => {
    const bc = stateRef.current.breadcrumb;
    if (bc.length <= 1) return;
    const prev = bc[bc.length - 2];
    navigateTo(prev.level, prev.id, prev.label);
  }, [navigateTo]);

  const resetToAllProjects = useCallback(() => {
    patch({
      selectedType: '', selectedId: '', projectId: null, blockId: null,
      buildingId: null, floorId: null, unitId: null, showProperties: false,
      breadcrumb: [],
    });
  }, [patch]);

  const clearSelection = useCallback(() => {
    patch({ selectedType: '', selectedId: '', showProperties: false });
  }, [patch]);

  const value: MapHierarchyContextType = {
    ...state, navigateTo, navigateUp, setViewMode: (m) => patch({ viewMode: m }),
    setTileLayer: (t) => patch({ tileLayer: t }), setDrawMode: (d) => patch({ drawMode: d }),
    setShowHierarchy: (v) => patch({ showHierarchy: v }),
    setShowProperties: (v) => patch({ showProperties: v }),
    setShowLegend: (v) => patch({ showLegend: v }),
    setSearchQuery: (q) => patch({ searchQuery: q }),
    setStatusFilter: (f) => patch({ statusFilter: f }),
    clearSelection, resetToAllProjects,
  };

  return (
    <MapHierarchyContext.Provider value={value}>
      {children}
    </MapHierarchyContext.Provider>
  );
}

export function useMapHierarchy() {
  const ctx = useContext(MapHierarchyContext);
  if (!ctx) throw new Error('useMapHierarchy must be used within MapHierarchyProvider');
  return ctx;
}
