import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { MapContainer, TileLayer, Marker, Popup, useMap, ScaleControl, GeoJSON, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  Building2, MapPin, List, ExternalLink, Search, Layers, Maximize2, Minimize2,
  Pencil, Eye, Trash2, Sun, Moon, QrCode, ChevronDown, ChevronRight,
  Home, Box, PanelRight, Download, Upload, Save, Plus, Edit3, X,
  RotateCw, ZoomIn, ZoomOut, Target, Grid3x3, Type, MousePointer, FileText,
  Ruler, Footprints, Camera, ChevronLeft,
} from 'lucide-react';
import QRCodeModal from '../components/QRCodeModal';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import MeasurementTool, { calculateDistance, calculateArea } from '../components/MeasurementTool';
import type { Measurement } from '../components/MeasurementTool';
import InteractiveFloorPlan from '../components/InteractiveFloorPlan';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  active: '#10b981', planning: '#3b82f6', completed: '#9ca3af',
  on_hold: '#f59e0b', cancelled: '#ef4444', draft: '#6b7280',
  in_progress: '#8b5cf6', under_construction: '#f97316',
};
const DEFAULT_STATUS_LABELS: Record<string, string> = {
  active: 'Active', planning: 'Planning', completed: 'Completed',
  on_hold: 'On Hold', cancelled: 'Cancelled', draft: 'Draft',
  in_progress: 'In Progress', under_construction: 'Under Construction',
};

const TILE_LAYERS = {
  street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', att: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', att: '&copy; Esri' },
  terrain: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', att: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>' },
};

type ViewMode = '2d' | '3d' | 'split';
type HierarchyLevel = 'project' | 'phase' | 'block' | 'building' | 'floor' | 'unit';
type DrawMode = 'none' | 'polygon' | 'rectangle' | 'marker' | 'edit';
type MeasureMode = 'none' | 'distance' | 'area';

interface RoomHotspot {
  id: string;
  name_en: string;
  name_ar?: string;
  room_type: string;
  area_sqm?: number;
  polygon: [number, number][];
  color?: string;
  status?: string;
  unit_code?: string;
  price?: number;
  unit_id?: string;
}

interface MapProject {
  id: string; project_code: string; name_en: string; status: string;
  progress_percent: number; location?: string; budget_amount?: number;
  latitude?: number; longitude?: number; lat?: number; lng?: number;
}
interface MapBlock {
  id: string; block_code: string; name_en: string; status: string;
  floor_count: number; total_units: number; progress_percent: number;
  geometry?: any; center_lat?: number; center_lng?: number; area_sqm?: number;
  color?: string; project_id: string;
}
interface MapBuilding {
  id: string; building_code: string; name_en: string; status: string;
  floors: number; geometry?: any; center_lat?: number; center_lng?: number;
  height_m?: number; color?: string; block_id?: string; project_id: string;
}
interface MapFloor {
  id: string; floor_number: number; name_en?: string; geometry?: any;
  plan_image?: string; plan_image_bounds?: any; area_sqm?: number; building_id: string; block_id?: string;
  room_data?: any; virtual_tour_url?: string; virtual_tour_type?: string;
}
interface MapUnit {
  id: string; unit_code: string; unit_type: string; floor_number?: number;
  status: string; area_sqm?: number; bedrooms?: number; price?: number;
  lat?: number; lng?: number; geometry?: any; floor_id?: string;
  block_id?: string; project_id: string;
}
interface MapAnnotation {
  id: string; name: string; annotation_type: string; geometry: any;
  style: Record<string, any>; color: string; created_at: string;
}
interface HierarchyNode {
  type: HierarchyLevel;
  id: string;
  label: string;
  labelAr?: string;
  children?: HierarchyNode[];
  data: any;
  expanded?: boolean;
}

function createDivIcon(status: string, label: string, size = 32, colors = DEFAULT_STATUS_COLORS) {
  const color = colors[status] || '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px ${color}66;border:2px solid #fff;color:#fff;font-weight:700;font-size:11px">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 4)],
  });
}

function UnitClusterLayer({ units, colors }: { units: MapUnit[]; colors: Record<string, string> }) {
  const map = useMap();
  useEffect(() => {
    if (units.length === 0) return;
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: L.MarkerCluster) => {
        const count = cluster.getChildCount();
        let color = '#3b82f6';
        if (count > 50) color = '#ef4444';
        else if (count > 10) color = '#f59e0b';
        return L.divIcon({
          html: `<div style="background:${color};width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;color:#fff;font-weight:700;font-size:13px;box-shadow:0 2px 8px ${color}66">${count}</div>`,
          className: '',
          iconSize: L.point(40, 40),
        });
      },
    });
    for (const u of units.slice(0, 500)) {
      if (!u.lat || !u.lng) continue;
      const icon = createDivIcon(u.status, 'U', 24, colors);
      const marker = L.marker([u.lat, u.lng], { icon });
      marker.bindPopup(`
        <div style="min-width:140px">
          <h3 style="font-weight:600;font-size:13px">Unit ${u.unit_code}</h3>
          <div style="margin-top:4px;font-size:12px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[u.status] || '#6b7280'};margin-right:4px"></span>
            <span style="text-transform:capitalize">${u.status || 'available'}</span>
            ${u.unit_type ? `<br/><span style="color:#6b7280">${u.unit_type}</span>` : ''}
            ${u.area_sqm ? `<br/>${u.area_sqm} m²` : ''}
            ${u.bedrooms != null ? `<br/>${u.bedrooms} BR` : ''}
            ${u.price ? `<br/><strong>${u.price.toLocaleString()} SAR</strong>` : ''}
          </div>
        </div>
      `);
      cluster.addLayer(marker);
    }
    map.addLayer(cluster);
    return () => { map.removeLayer(cluster); };
  }, [map, units]);
  return null;
}

function polygonCenter(geom: any): [number, number] {
  try {
    const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.type === 'MultiPolygon' ? geom.coordinates[0][0] : null;
    if (!coords || coords.length < 3) return [24.75, 46.75];
    let lat = 0, lng = 0, n = 0;
    for (const c of coords) { lat += c[1]; lng += c[0]; n++; }
    return [lat / n, lng / n];
  } catch { return [24.75, 46.75]; }
}

function polygonArea(geom: any): number {
  try { return L.geoJSON(geom).getBounds().getNorthEast().lat - L.geoJSON(geom).getBounds().getSouthWest().lat; } catch { return 0; }
}

// ---------- 3D Viewer Component ----------
function Map3DView({
  blocks, buildings, show, onSelect, statusColors: sc,
}: {
  blocks: MapBlock[]; buildings: MapBuilding[]; show: boolean; onSelect?: (type: string, id: string) => void; statusColors?: Record<string, string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    if (!show || !containerRef.current) return;
    let mounted = true;

    (async () => {
      try {
        const T: any = await import('three');
        // @ts-expect-error - three examples path resolved at runtime
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');
        if (!mounted || !containerRef.current) return;

        const container = containerRef.current;
        const w = container.clientWidth || 600;
        const h = container.clientHeight || 400;

        const scene = new T.Scene();
        scene.background = new T.Color(0x1a1a2e);

        const camera = new T.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(0, 20, 25);
        camera.lookAt(0, 0, 0);

        const renderer = new T.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI / 2.2;
        controls.target.set(0, 0, 0);

        // Lighting
        const ambient = new T.AmbientLight(0x404060, 0.6);
        scene.add(ambient);
        const dirLight = new T.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(10, 30, 10);
        dirLight.castShadow = true;
        scene.add(dirLight);
        const fillLight = new T.DirectionalLight(0x8888ff, 0.4);
        fillLight.position.set(-10, 10, -10);
        scene.add(fillLight);

        // Ground grid
        const gridHelper = new T.GridHelper(40, 20, 0x444466, 0x333355);
        scene.add(gridHelper);

        // Ground plane
        const groundGeo = new T.PlaneGeometry(40, 40);
        const groundMat = new T.MeshStandardMaterial({ color: 0x16213e, roughness: 0.8, metalness: 0.1 });
        const ground = new T.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        scene.add(ground);

        // Block boxes
        const raycasterTargets: any[] = [];
        const dc = sc || DEFAULT_STATUS_COLORS;
        const colors: Record<string, number> = {};
        for (const [k, v] of Object.entries(dc)) { colors[k] = parseInt(v.replace('#', ''), 16); }

        const items = [...blocks.map(b => ({ type: 'block' as const, data: b })), ...buildings.map(b => ({ type: 'building' as const, data: b }))];
        const blockSize = items.length > 0 ? Math.min(6, Math.max(3, 20 / Math.sqrt(items.length))) : 4;

        items.forEach((item, i) => {
          const d = item.data;
          const cols = Math.ceil(Math.sqrt(items.length));
          const row = Math.floor(i / cols);
          const col = i % cols;
          const x = (col - cols / 2) * blockSize * 1.3;
          const z = (row - cols / 2) * blockSize * 1.3;
          const floorH = 0.35;
          const roofH = 0.15;
          const floorCount = 'floor_count' in d ? (d as any).floor_count || 1 : 'floors' in d ? (d as any).floors || 1 : 1;
          const bw = blockSize * 0.85;
          const bd = blockSize * 0.6;
          const baseColor = colors[d.status] || 0x6b7280;
          const roofColor = 0x555555;

          // Per-floor stacked boxes with alternating shades
          const floorMeshes: any[] = [];
          for (let f = 0; f < floorCount; f++) {
            const shade = f % 2 === 0 ? 1.0 : 0.85;
            const r = ((baseColor >> 16) & 0xff) * shade;
            const g = ((baseColor >> 8) & 0xff) * shade;
            const bl = (baseColor & 0xff) * shade;
            const floorColor = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
            const fGeo = new T.BoxGeometry(bw * (1 - f * 0.01), floorH, bd * (1 - f * 0.01));
            const fMat = new T.MeshStandardMaterial({ color: floorColor, roughness: 0.5, metalness: 0.2 });
            const fMesh = new T.Mesh(fGeo, fMat);
            fMesh.position.set(x, f * floorH + floorH / 2, z);
            fMesh.castShadow = true;
            fMesh.receiveShadow = true;
            fMesh.userData = { type: item.type, id: d.id, label: d.name_en, floor: f + 1 };
            scene.add(fMesh);
            floorMeshes.push(fMesh);
            raycasterTargets.push(fMesh);

            // Horizontal edge lines per floor
            const fEdge = new T.EdgesGeometry(fGeo);
            const fEdgeMat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
            const fEdgeLine = new T.LineSegments(fEdge, fEdgeMat);
            fEdgeLine.position.copy(fMesh.position);
            scene.add(fEdgeLine);
          }

          // Roof cap (thinner, slightly overhanging, darker)
          const roofW = bw * 1.02;
          const roofD = bd * 1.02;
          const roofGeo = new T.BoxGeometry(roofW, roofH, roofD);
          const roofMat = new T.MeshStandardMaterial({ color: roofColor, roughness: 0.7, metalness: 0.1 });
          const roofMesh = new T.Mesh(roofGeo, roofMat);
          const totalH = floorCount * floorH;
          roofMesh.position.set(x, totalH + roofH / 2, z);
          roofMesh.castShadow = true;
          roofMesh.receiveShadow = true;
          roofMesh.userData = { type: item.type, id: d.id, label: d.name_en + ' roof' };
          scene.add(roofMesh);

          // Label sprite
          const canvas = document.createElement('canvas');
          canvas.width = 256; canvas.height = 64;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.roundRect(0, 0, 256, 64, 8);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(d.name_en, 128, 38);

          const texture = new T.CanvasTexture(canvas);
          const spriteMat = new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
          const sprite = new T.Sprite(spriteMat);
          sprite.position.set(x, totalH + roofH + 1.0, z);
          sprite.scale.set(4, 1, 1);
          scene.add(sprite);
        });

        // Click handler
        const raycaster = new T.Raycaster();
        const pointer = new T.Vector2();
        const onClick = (e: MouseEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects(raycasterTargets);
          if (hits.length > 0) {
            const obj = hits[0].object;
            if (obj.userData.type && obj.userData.id && onSelect) {
              onSelect(obj.userData.type, obj.userData.id);
            }
            // Highlight
            raycasterTargets.forEach(t => { if (t !== obj) { (t.material as any).emissive?.setHex(0x000000); } });
          }
        };
        renderer.domElement.addEventListener('click', onClick);

        // Animation loop
        let animId: number;
        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          animId = requestAnimationFrame(animate);
        };
        animate();

        sceneRef.current = { scene, camera, renderer, controls, animate };

        // Resize handler
        const onResize = () => {
          if (!containerRef.current) return;
          const w2 = containerRef.current.clientWidth || 600;
          const h2 = containerRef.current.clientHeight || 400;
          camera.aspect = w2 / h2;
          camera.updateProjectionMatrix();
          renderer.setSize(w2, h2);
        };
        window.addEventListener('resize', onResize);

        return () => {
          mounted = false;
          window.removeEventListener('resize', onResize);
          cancelAnimationFrame(animId);
          controls.dispose();
          renderer.dispose();
          if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
          sceneRef.current = null;
        };
      } catch (err) {
        console.error('3D init failed:', err);
      }
    })();

    return () => { mounted = false; };
  }, [show, blocks, buildings, onSelect]);

  if (!show) return null;
  return (
    <div ref={containerRef} className="h-full w-full" style={{ minHeight: 300 }} />
  );
}

// ---------- 3D Walkthrough (First-Person) ----------
function Walkthrough3DView({
  buildings, floors, show, selectedBldg, onBldgChange,
}: {
  buildings: MapBuilding[]; floors: MapFloor[]; show: boolean;
  selectedBldg?: string; onBldgChange?: (bldgId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bldgIndex, setBldgIndex] = useState(0);
  const [floorIndex, setFloorIndex] = useState(0);
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (selectedBldg && buildings.length > 0) {
      const idx = buildings.findIndex(b => b.id === selectedBldg);
      if (idx >= 0) setBldgIndex(idx);
    }
  }, [selectedBldg, buildings]);

  useEffect(() => {
    if (!show || !containerRef.current || buildings.length === 0) return;
    let mounted = true;

    (async () => {
      try {
        const T: any = await import('three');
        if (!mounted || !containerRef.current) return;

        const container = containerRef.current;
        const w = container.clientWidth || 600;
        const h = container.clientHeight || 400;

        const scene = new T.Scene();
        scene.background = new T.Color(0x111827);
        scene.fog = new T.Fog(0x111827, 20, 50);

        const camera = new T.PerspectiveCamera(60, w / h, 0.1, 100);
        camera.position.set(0, 2.5, 8);
        camera.lookAt(0, 2, 0);

        const renderer = new T.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        container.appendChild(renderer.domElement);

        // No orbit controls in walkthrough - use WASD instead
        // Lighting
        const ambient = new T.AmbientLight(0x404060, 0.5);
        scene.add(ambient);
        const dirLight = new T.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        scene.add(dirLight);
        const warmLight = new T.DirectionalLight(0xffeedd, 0.6);
        warmLight.position.set(-5, 10, -5);
        scene.add(warmLight);

        // Floor
        const floorGeo = new T.PlaneGeometry(30, 30);
        const floorMat = new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9, metalness: 0 });
        const floor = new T.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.01;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grid
        const gridHelper = new T.GridHelper(30, 20, 0x374151, 0x374151);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        // Build simple room enclosure from first building
        const bldg = buildings[bldgIndex];
        const bFloors = floors.filter(f => f.building_id === bldg.id).sort((a, b) => a.floor_number - b.floor_number);
        const curFloor = bFloors[floorIndex] || bFloors[0];
        const roomW = 6, roomD = 5, roomH = 3;

        // Walls
        const wallMat = new T.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.6, metalness: 0.1, side: T.DoubleSide });
        const wallPositions = [
          { pos: [0, roomH / 2, -roomD / 2], size: [roomW, roomH, 0.1] },
          { pos: [0, roomH / 2, roomD / 2], size: [roomW, roomH, 0.1] },
          { pos: [-roomW / 2, roomH / 2, 0], size: [0.1, roomH, roomD] },
          { pos: [roomW / 2, roomH / 2, 0], size: [0.1, roomH, roomD] },
        ];
        for (const wp of wallPositions) {
          const wall = new T.Mesh(new T.BoxGeometry(...wp.size), wallMat);
          wall.position.set(wp.pos[0], wp.pos[1], wp.pos[2]);
          wall.castShadow = true;
          wall.receiveShadow = true;
          scene.add(wall);
        }

        // Ceiling
        const ceilMat = new T.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.8 });
        const ceil = new T.Mesh(new T.BoxGeometry(roomW, 0.05, roomD), ceilMat);
        ceil.position.set(0, roomH, 0);
        scene.add(ceil);

        // Unit info labels as floating sprites
        if (curFloor?.room_data) {
          const rooms = curFloor.room_data as RoomHotspot[];
          rooms.forEach((r, i) => {
            const cx = (Math.max(...r.polygon.map(p => p[0])) + Math.min(...r.polygon.map(p => p[0]))) / 2;
            const cy = (Math.max(...r.polygon.map(p => p[1])) + Math.min(...r.polygon.map(p => p[1]))) / 2;
            const sx = (cx / 800 - 0.5) * roomW * 0.8;
            const sz = (cy / 600 - 0.5) * roomD * 0.8;

            const canvas = document.createElement('canvas');
            const s = 256;
            canvas.width = s; canvas.height = s;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.roundRect(8, 8, s - 16, s - 16, 12);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(r.name_en, s / 2, 50);
            ctx.font = '13px sans-serif';
            ctx.fillStyle = '#94a3b8';
            if (r.area_sqm) ctx.fillText(`${r.area_sqm} m²`, s / 2, 85);
            if (r.unit_code) { ctx.fillStyle = '#60a5fa'; ctx.fillText(r.unit_code, s / 2, 120); }

            const tex = new T.CanvasTexture(canvas);
            const spriteMat = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
            const sprite = new T.Sprite(spriteMat);
            sprite.position.set(sx, 0.6 + i * 0.01, sz);
            sprite.scale.set(1.5, 1.5, 1);
            scene.add(sprite);

            // Optional floor highlight
            const rColor = r.color || '#6366f1';
            const rHex = parseInt(rColor.replace('#', ''), 16);
            const hGeo = new T.PlaneGeometry(0.5, 0.5);
            const hMat = new T.MeshStandardMaterial({ color: rHex, transparent: true, opacity: 0.5, side: T.DoubleSide });
            const hMesh = new T.Mesh(hGeo, hMat);
            hMesh.rotation.x = -Math.PI / 2;
            hMesh.position.set(sx, 0.02, sz);
            scene.add(hMesh);
          });
        }

        // Label for current floor
        const lCanvas = document.createElement('canvas');
        lCanvas.width = 512; lCanvas.height = 64;
        const lCtx = lCanvas.getContext('2d')!;
        lCtx.fillStyle = 'rgba(99,102,241,0.9)';
        lCtx.roundRect(0, 0, 512, 64, 8);
        lCtx.fill();
        lCtx.fillStyle = '#ffffff';
        lCtx.font = 'bold 16px sans-serif';
        lCtx.textAlign = 'center';
        lCtx.fillText(`${bldg.name_en} - Floor ${curFloor?.floor_number || 1}`, 256, 38);
        const lTex = new T.CanvasTexture(lCanvas);
        const lMat = new T.SpriteMaterial({ map: lTex, transparent: true, depthTest: false });
        const lSprite = new T.Sprite(lMat);
        lSprite.position.set(0, roomH + 0.5, 0);
        lSprite.scale.set(5, 0.6, 1);
        scene.add(lSprite);

        // WASD + arrow controls
        const direction = new T.Vector3();
        const euler = new T.Euler(0, 0, 0, 'YXZ');

        document.addEventListener('keydown', (e) => keysRef.current.add(e.key.toLowerCase()));
        document.addEventListener('keyup', (e) => keysRef.current.delete(e.key.toLowerCase()));

        const clock = new T.Clock();
        let animId: number;
        const animate = () => {
          const dt = Math.min(clock.getDelta(), 0.05);
          const speed = 3.0;

          // Get camera direction
          euler.setFromQuaternion(camera.quaternion);
          const forward = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          const right = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          forward.y = 0; forward.normalize();
          right.y = 0; right.normalize();

          direction.set(0, 0, 0);
          const keys = keysRef.current;
          if (keys.has('w') || keys.has('arrowup')) direction.add(forward);
          if (keys.has('s') || keys.has('arrowdown')) direction.sub(forward);
          if (keys.has('a') || keys.has('arrowleft')) direction.sub(right);
          if (keys.has('d') || keys.has('arrowright')) direction.add(right);

          if (direction.length() > 0) {
            direction.normalize();
            camera.position.add(direction.multiplyScalar(speed * dt));
          }

          // Keep within bounds
          camera.position.x = Math.max(-roomW / 2 + 0.3, Math.min(roomW / 2 - 0.3, camera.position.x));
          camera.position.z = Math.max(-roomD / 2 + 0.3, Math.min(roomD / 2 - 0.3, camera.position.z));
          camera.position.y = 1.6;

          renderer.render(scene, camera);
          animId = requestAnimationFrame(animate);
        };
        animate();

        // Mouse look
        let isPointerLocked = false;
        const onPointerLockChange = () => { isPointerLocked = document.pointerLockElement === renderer.domElement; };
        document.addEventListener('pointerlockchange', onPointerLockChange);

        const onMouseMove = (e: MouseEvent) => {
          if (!isPointerLocked) return;
          const sensitivity = 0.002;
          euler.setFromQuaternion(camera.quaternion);
          euler.y -= e.movementX * sensitivity;
          euler.x -= e.movementY * sensitivity;
          euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
          camera.quaternion.setFromEuler(euler);
        };
        document.addEventListener('mousemove', onMouseMove);

        const onClickCanvas = () => {
          if (!isPointerLocked) renderer.domElement.requestPointerLock();
        };
        renderer.domElement.addEventListener('click', onClickCanvas);

        // Resize
        const onResize = () => {
          if (!containerRef.current) return;
          const w2 = containerRef.current.clientWidth || 600;
          const h2 = containerRef.current.clientHeight || 400;
          camera.aspect = w2 / h2;
          camera.updateProjectionMatrix();
          renderer.setSize(w2, h2);
        };
        window.addEventListener('resize', onResize);

        return () => {
          mounted = false;
          document.removeEventListener('pointerlockchange', onPointerLockChange);
          document.removeEventListener('mousemove', onMouseMove);
          renderer.domElement.removeEventListener('click', onClickCanvas);
          document.removeEventListener('keydown', () => {});
          document.removeEventListener('keyup', () => {});
          window.removeEventListener('resize', onResize);
          cancelAnimationFrame(animId);
          renderer.dispose();
          if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
      } catch (err) {
        console.error('Walkthrough init failed:', err);
      }
    })();

    return () => { mounted = false; };
  }, [show, buildings, floors, bldgIndex, floorIndex]);

  if (!show || buildings.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
        <p className="text-sm">Select a building to start the walkthrough</p>
      </div>
    );
  }

  const bldg = buildings[bldgIndex];
  const bFloors = floors.filter(f => f.building_id === bldg.id).sort((a, b) => a.floor_number - b.floor_number);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 text-xs">
          <Camera size={14} />
          <span>Walkthrough: <strong>{bldg.name_en}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          {/* Building navigation */}
          {buildings.length > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <button className="btn-xs btn-secondary" onClick={() => {
                const next = Math.max(0, bldgIndex - 1);
                setBldgIndex(next);
                setFloorIndex(0);
                if (onBldgChange) onBldgChange(buildings[next].id);
              }} disabled={bldgIndex === 0}>
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-mono px-1">{bldg.name_en}</span>
              <button className="btn-xs btn-secondary" onClick={() => {
                const next = Math.min(buildings.length - 1, bldgIndex + 1);
                setBldgIndex(next);
                setFloorIndex(0);
                if (onBldgChange) onBldgChange(buildings[next].id);
              }} disabled={bldgIndex >= buildings.length - 1}>
                <ChevronLeft size={12} className="rotate-180" />
              </button>
            </div>
          )}
          <span className="text-[10px] text-gray-500">Click to look · WASD to move</span>
          {bFloors.length > 1 && (
            <div className="flex items-center gap-1 ml-2">
              <button className="btn-xs btn-secondary" onClick={() => setFloorIndex(i => Math.max(0, i - 1))} disabled={floorIndex === 0}>
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-mono px-1">Floor {bFloors[floorIndex]?.floor_number || 1}/{bFloors.length}</span>
              <button className="btn-xs btn-secondary" onClick={() => setFloorIndex(i => Math.min(bFloors.length - 1, i + 1))} disabled={floorIndex >= bFloors.length - 1}>
                <ChevronLeft size={12} className="rotate-180" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div ref={containerRef} className="flex-1" style={{ minHeight: 200 }} />
    </div>
  );
}

// ---------- Hierarchy Tree ----------
function HierarchyTree({
  projects, blocks, buildings, onSelect, selectedId, expanded, onToggle, colors = DEFAULT_STATUS_COLORS,
}: {
  projects: MapProject[]; blocks: MapBlock[]; buildings: MapBuilding[];
  onSelect: (type: HierarchyLevel, id: string) => void;
  selectedId: string; expanded: Set<string>; onToggle: (id: string) => void;
  colors?: Record<string, string>;
}) {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();

  const nodes: HierarchyNode[] = projects
    .filter(p => !q || p.name_en.toLowerCase().includes(q) || p.project_code.toLowerCase().includes(q))
    .map(p => {
      const pBlocks = blocks.filter(b => b.project_id === p.id);
      return {
        type: 'project' as HierarchyLevel, id: p.id, label: p.name_en, data: p,
        expanded: expanded.has(`proj-${p.id}`),
        children: pBlocks.length > 0 ? pBlocks.map(b => {
          const bBuildings = buildings.filter(bd => bd.block_id === b.id);
          return {
            type: 'block' as HierarchyLevel, id: b.id, label: `${b.block_code} - ${b.name_en}`, data: b,
            expanded: expanded.has(`blk-${b.id}`),
            children: bBuildings.length > 0 ? bBuildings.map(bd => ({
              type: 'building' as HierarchyLevel, id: bd.id, label: bd.name_en, data: bd,
            })) : undefined,
          };
        }) : undefined,
      };
    });

  const renderNode = (node: HierarchyNode, depth: number) => {
    const isSel = selectedId === `${node.type}-${node.id}`;
    const hasChildren = node.children && node.children.length > 0;
    return (
      <div key={`${node.type}-${node.id}`}>
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-xs rounded-md transition-colors ${isSel ? 'gradient-primary text-white' : 'hover:bg-white/10'}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onSelect(node.type, node.id)}
        >
          {hasChildren ? (
            <span onClick={(e) => { e.stopPropagation(); onToggle(`${node.type === 'project' ? 'proj' : node.type === 'block' ? 'blk' : 'bld'}-${node.id}`); }}>
              {node.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          ) : <span className="w-3" />}
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colors[node.data.status] || '#6b7280' }} />
          <span className="truncate">{node.label}</span>
        </div>
        {node.expanded && node.children?.map(c => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input className="input text-xs w-full" style={{ padding: '0.25rem 0.5rem 0.25rem 1.5rem' }}
            placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {nodes.map(n => renderNode(n, 0))}
        {nodes.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No items found</p>
        )}
      </div>
    </div>
  );
}

// ---------- Property Panel ----------
function PropertyPanel({ selectedType, selectedId, onClose, onUpdate, onStartBounds }: {
  selectedType: string; selectedId: string; onClose: () => void; onUpdate: () => void; onStartBounds?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    setReports([]);
    const table = selectedType === 'project' ? 'projects' : selectedType === 'block' ? 'blocks' : selectedType === 'building' ? 'buildings' : selectedType === 'floor' ? 'floors' : selectedType === 'unit' ? 'units' : null;
    if (!table) { setLoading(false); return; }
    (async () => {
      try {
        const { data: d } = await supabase.from(table).select('*').eq('id', selectedId).single();
        setData(d);
        if (selectedType === 'project') {
          const { data: r } = await supabase.from('daily_reports').select('id, report_date, title, template:report_templates!template_id(name_en)').eq('project_id', selectedId).order('report_date', { ascending: false }).limit(5);
          setReports(r || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [selectedType, selectedId]);

  async function uploadFloorPlan(file: File) {
    if (!selectedId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${selectedId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('floorplans').upload(path, file, { contentType: file.type });
      if (uploadErr) { toast.error('Upload failed: ' + uploadErr.message); return; }
      const { data: urlData } = supabase.storage.from('floorplans').getPublicUrl(path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) { toast.error('Failed to get public URL'); return; }
      await supabase.from('floors').update({ plan_image: publicUrl } as any).eq('id', selectedId);
      toast.success('Floor plan uploaded');
      onUpdate();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  const fields = data ? Object.entries(data).filter(([k]) => !['id', 'geometry', 'created_at', 'updated_at', 'project_id', 'block_id', 'building_id', 'floor_id'].includes(k)) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-xs font-semibold capitalize">{selectedType} Properties</span>
        <button onClick={onClose} className="p-0.5 hover:opacity-70"><X size={12} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
        ) : (
          <>
            {fields.map(([k, v]) => (
              <div key={k}>
                <label className="text-xs font-medium capitalize" style={{ color: 'var(--color-text-muted)' }}>{k.replace(/_/g, ' ')}</label>
                <p className="text-xs" style={{ color: 'var(--color-text)' }}>{v == null ? '-' : String(v)}</p>
              </div>
            ))}
            {reports.length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Recent Reports ({reports.length})</label>
                {reports.map(r => (
                  <div key={r.id} className="flex items-center gap-1.5 py-0.5">
                    <span className="text-xs text-blue-600 cursor-pointer hover:underline truncate" onClick={() => navigate('/daily-reports')}>
                      {r.title || r.report_date}
                    </span>
                    <FileText size={10} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                ))}
              </div>
            )}
            {selectedType === 'project' && data && (
              <button className="btn-secondary btn-xs w-full mt-1 text-center flex items-center justify-center gap-1"
                onClick={() => navigate(`/daily-reports`)}>
                <FileText size={10} /> View All Reports
              </button>
            )}
            {selectedType === 'floor' && (
              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                <label className="text-xs font-medium block" style={{ color: 'var(--color-text-muted)' }}>Floor Plan</label>
                {data?.plan_image && (
                  <div className="relative rounded overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                    <img src={data.plan_image} alt="Floor plan" className="w-full h-24 object-cover" />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFloorPlan(f); e.target.value = ''; }} />
                <div className="flex gap-1">
                  <button className="btn-secondary btn-xs flex-1 flex items-center justify-center gap-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload size={10} /> {data?.plan_image ? 'Change' : 'Upload'}
                  </button>
                  {data?.plan_image && !data?.plan_image_bounds && onStartBounds && (
                    <button className="btn-primary btn-xs flex-1 flex items-center justify-center gap-1" onClick={onStartBounds}>
                      <Target size={10} /> Set Bounds
                    </button>
                  )}
                  {data?.plan_image && data?.plan_image_bounds && (
                    <button className="btn-primary btn-xs flex-1 flex items-center justify-center gap-1" onClick={onStartBounds}>
                      <Target size={10} /> Adjust Bounds
                    </button>
                  )}
                </div>
                {uploading && <p className="text-xs text-blue-600">Uploading...</p>}
              </div>
            )}
            {!fields.length && reports.length === 0 && selectedType !== 'floor' && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No properties</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Floor Plan Overlay ----------
function FloorPlanOverlay({ floors, selectedType, selectedId, boundsPoints }: {
  floors: MapFloor[]; selectedType: string; selectedId: string;
  boundsPoints: { lat: number; lng: number }[];
}) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);

  // Render overlays for floors with plan_image
  useEffect(() => {
    const overlays: L.ImageOverlay[] = [];
    for (const f of floors) {
      if (!f.plan_image || !f.plan_image_bounds) continue;
      const b = f.plan_image_bounds as any;
      if (!b.north || !b.south || !b.east || !b.west) continue;
      const bounds: L.LatLngBoundsExpression = [[b.south, b.west], [b.north, b.east]];
      const overlay = L.imageOverlay(f.plan_image, bounds, { opacity: 0.8 });
      overlay.addTo(map);
      overlays.push(overlay);
    }
    return () => { overlays.forEach(o => map.removeLayer(o)); };
  }, [map, floors]);

  // Bounds picker mode
  useEffect(() => {
    if (selectedType !== 'floor' || boundsPoints.length !== 2 || !selectedId) return;
    const ne = boundsPoints[0], sw = boundsPoints[1];
    const bounds: L.LatLngBoundsExpression = [[sw.lat, sw.lng], [ne.lat, ne.lng]];
    const rect = L.rectangle(bounds, { color: '#22c55e', weight: 2, fillOpacity: 0.1 });
    rect.addTo(map);
    supabase.from('floors').update({
      plan_image_bounds: { north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng }
    } as any).eq('id', selectedId).then();
    return () => { map.removeLayer(rect); };
  }, [map, boundsPoints, selectedType, selectedId]);

  // Cursor for bounds picking
  useEffect(() => {
    const container = map.getContainer();
    if (selectedType === 'floor' && boundsPoints.length < 2) {
      container.style.cursor = 'crosshair';
    } else { container.style.cursor = ''; }
    return () => { container.style.cursor = ''; };
  }, [map, selectedType, boundsPoints.length]);

  return null;
}

// ---------- Bounds Click Handler ----------
function BoundsClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => { onPick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// ---------- Measurement Click Handler ----------
function MeasureClickHandler({ onMeasure }: { onMeasure: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => { onMeasure(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// ---------- Measurement Layer (Render lines/polygons on map) ----------
function MeasurementLayer({ measurements }: { measurements: Measurement[] }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup>(new L.LayerGroup());

  useEffect(() => {
    const group = layerRef.current;
    group.clearLayers();
    for (const m of measurements) {
      if (m.points.length < 2) continue;
      const ll = m.points.map(p => [p[0], p[1]] as [number, number]);
      if (m.type === 'distance') {
        const polyline = L.polyline(ll, { color: m.color, weight: 3, dashArray: '8,6' });
        polyline.bindTooltip(m.label, { permanent: true, direction: 'center', className: 'measure-label' });
        group.addLayer(polyline);
        ll.forEach(p => {
          const circle = L.circleMarker(p, { radius: 5, color: m.color, fillColor: '#fff', fillOpacity: 1, weight: 2 });
          group.addLayer(circle);
        });
      } else if (m.type === 'area' && m.points.length >= 3) {
        const polygon = L.polygon(ll, { color: m.color, fillColor: m.color, fillOpacity: 0.15, weight: 2 });
        polygon.bindTooltip(m.label, { permanent: true, direction: 'center', className: 'measure-label' });
        group.addLayer(polygon);
        ll.forEach(p => {
          const circle = L.circleMarker(p, { radius: 5, color: m.color, fillColor: '#fff', fillOpacity: 1, weight: 2 });
          group.addLayer(circle);
        });
      }
    }
    group.addTo(map);
    return () => { map.removeLayer(group); };
  }, [map, measurements]);

  return null;
}

// ---------- Drawing Toolbar (Polygon + Marker) ----------
function DrawingToolbar({
  enabled, annotations, onSave, mode, setMode,
}: {
  enabled: boolean; annotations: MapAnnotation[]; onSave: (geoJson: any, type: string) => void;
  mode: DrawMode; setMode: (m: DrawMode) => void;
}) {
  const map = useMap();
  const drawnRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const ctrlRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || mode === 'none') {
      if (ctrlRef.current) {
        map.removeControl(ctrlRef.current); ctrlRef.current = null;
      }
      if (map.hasLayer(drawnRef.current)) map.removeLayer(drawnRef.current);
      return;
    }
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      try { await import('leaflet-draw'); } catch { return; }
      if (cancelled) return;
      const fg = drawnRef.current;
      map.addLayer(fg);

      const DrawControl = (L as any).Control?.Draw;
      if (!DrawControl) { if (map.hasLayer(fg)) map.removeLayer(fg); return; }

      const draw: Record<string, any> = {};
      if (mode === 'polygon' || mode === 'rectangle') {
        draw.polygon = mode === 'polygon' ? { allowIntersection: false, showArea: true } : false;
        draw.rectangle = mode === 'rectangle' ? true : false;
        draw.marker = true;
        draw.polyline = false;
        draw.circle = false;
        draw.circlemarker = false;
      } else if (mode === 'marker') {
        draw.marker = true;
        draw.polygon = false; draw.rectangle = false; draw.polyline = false; draw.circle = false;
      } else {
        draw.polygon = { allowIntersection: false, showArea: true };
        draw.marker = true;
        draw.polyline = true;
        draw.rectangle = true;
        draw.circle = { showRadius: true };
        draw.circlemarker = false;
      }

      const ctrl = new DrawControl({ edit: { featureGroup: fg }, draw: draw as any });
      if (cancelled) { if (map.hasLayer(fg)) map.removeLayer(fg); return; }
      ctrlRef.current = ctrl;
      map.addControl(ctrl);

      const handleCreate = (e: any) => {
        fg.addLayer(e.layer);
        const gt = e.layer instanceof L.Marker ? 'marker' : e.layer instanceof L.Polygon ? 'polygon' : e.layer instanceof L.Polyline ? 'polyline' : e.layer instanceof L.Rectangle ? 'rectangle' : e.layer instanceof L.Circle ? 'circle' : 'unknown';
        onSave(e.layer.toGeoJSON(), gt);
      };
      const handleEdit = () => {
        fg.eachLayer((layer: any) => {
          if (layer.edited) {
            const drawnGeo = fg.toGeoJSON() as any;
            if (drawnGeo.features?.length > 0) {
              onSave(drawnGeo.features[drawnGeo.features.length - 1], 'polygon');
            }
          }
        });
      };

      const DEvent = (L as any).Draw.Event;
      map.on(DEvent.CREATED, handleCreate);
      map.on(DEvent.EDITED, handleEdit);
      cleanup = () => {
        map.off(DEvent.CREATED, handleCreate);
        map.off(DEvent.EDITED, handleEdit);
        if (ctrlRef.current) { map.removeControl(ctrlRef.current); ctrlRef.current = null; }
        if (map.hasLayer(fg)) map.removeLayer(fg);
      };
    })();

    return () => { cancelled = true; if (cleanup) cleanup(); };
  }, [enabled, mode, map, onSave]);

  useEffect(() => {
    const fg = drawnRef.current;
    fg.clearLayers();
    annotations.forEach(a => {
      try {
        const layer = L.geoJSON(a.geometry, {
          style: { color: a.color || '#3388ff', fillOpacity: 0.2, weight: 2 },
          pointToLayer: (_f, ll) => L.marker(ll),
        });
        layer.eachLayer((l: any) => fg.addLayer(l));
      } catch { /* skip */ }
    });
  }, [annotations]);

  if (mode === 'none') return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5">
      {(['polygon', 'rectangle', 'marker'] as const).map(m => (
        <button key={m} onClick={() => setMode(mode === m ? 'none' : m)}
          className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          {m === 'polygon' ? 'Polygon' : m === 'rectangle' ? 'Rectangle' : 'Marker'}
        </button>
      ))}
      <span className="w-px bg-gray-200 mx-1" />
      <button onClick={() => setMode('none')} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-md">Done</button>
    </div>
  );
}

// ---------- Main Component ----------
export default function MapsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [projects, setProjects] = useState<MapProject[]>([]);
  const [blocks, setBlocks] = useState<MapBlock[]>([]);
  const [buildings, setBuildings] = useState<MapBuilding[]>([]);
  const [floors, setFloors] = useState<MapFloor[]>([]);
  const [units, setUnits] = useState<MapUnit[]>([]);
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fullscreen, setFullscreen] = useState(false);
  const [tileLayer, setTileLayer] = useState<'street' | 'satellite' | 'terrain'>('street');
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [showLegend, setShowLegend] = useState(true);
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedId, setSelectedId] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [qrModal, setQrModal] = useState<{ show: boolean; value: string; title: string }>({ show: false, value: '', title: '' });
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [showSaveView, setShowSaveView] = useState(false);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const [customStatusColors, setCustomStatusColors] = useState<Record<string, string>>({});
  const [customStatusLabels, setCustomStatusLabels] = useState<Record<string, string>>({});
  const [boundsPoints, setBoundsPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [measureMode, setMeasureMode] = useState<MeasureMode>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showInteractivePlan, setShowInteractivePlan] = useState(false);
  const [virtualTours, setVirtualTours] = useState<any[]>([]);

  const startBoundsPicking = useCallback(() => { setBoundsPoints([]); }, []);

  const onBoundsPick = useCallback((lat: number, lng: number) => {
    setBoundsPoints(prev => {
      if (prev.length >= 2) return [{ lat: prev[0].lat, lng: prev[0].lng }, { lat, lng }];
      return [...prev, { lat, lng }];
    });
  }, []);
  const statusColors = { ...DEFAULT_STATUS_COLORS, ...customStatusColors } as Record<string, string>;
  const statusLabels = { ...DEFAULT_STATUS_LABELS, ...customStatusLabels } as Record<string, string>;

  // Load custom status colors from template when selection changes
  useEffect(() => {
    if (!selectedId) { setCustomStatusColors({}); setCustomStatusLabels({}); return; }
    const table = selectedType === 'project' ? 'projects' : selectedType === 'block' ? 'blocks' : null;
    if (!table) { setCustomStatusColors({}); setCustomStatusLabels({}); return; }
    (async () => {
      try {
        const { data: item } = await supabase.from(table).select('status_template_id').eq('id', selectedId).single() as any;
        const templateId = item?.status_template_id;
        if (!templateId) { setCustomStatusColors({}); setCustomStatusLabels({}); return; }
        const { data: templateItems } = await supabase.from('status_template_items').select('status_key, label_en, label_ar, color').eq('template_id', templateId);
        if (templateItems && templateItems.length > 0) {
          const colors: Record<string, string> = {};
          const labels: Record<string, string> = {};
          for (const ti of templateItems) { colors[ti.status_key] = ti.color; labels[ti.status_key] = ti.label_en; }
          setCustomStatusColors(colors);
          setCustomStatusLabels(labels);
        } else { setCustomStatusColors({}); setCustomStatusLabels({}); }
      } catch { setCustomStatusColors({}); setCustomStatusLabels({}); }
    })();
  }, [selectedType, selectedId]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, blockRes, bldRes, floorRes, unitRes, annRes, viewsRes, vtRes] = await Promise.all([
        supabase.from('projects').select('id, project_code, name_en, status, progress_percent, location, budget_amount, latitude, longitude').eq('is_active', true).limit(500),
        supabase.from('blocks').select('*').limit(500),
        supabase.from('buildings').select('*').limit(500),
        supabase.from('floors').select('*').limit(500),
        supabase.from('units').select('id, unit_code, unit_type, floor_number, status, area_sqm, bedrooms, price, lat, lng, geometry, floor_id, block_id, project_id, is_active').eq('is_active', true).limit(1000),
        supabase.from('map_annotations').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('map_views').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('virtual_tours').select('*, units!left(unit_code)').limit(200),
      ]);

      if (projRes.data) setProjects(projRes.data as MapProject[]);
      if (blockRes.data) setBlocks(blockRes.data as MapBlock[]);
      if (bldRes.data) setBuildings(bldRes.data as MapBuilding[]);
      if (floorRes.data) setFloors(floorRes.data as MapFloor[]);
      if (unitRes.data) setUnits(unitRes.data as MapUnit[]);
      if (annRes.data) setAnnotations(annRes.data as MapAnnotation[]);
      if (viewsRes.data) setSavedViews(viewsRes.data);
      if (vtRes.data) setVirtualTours(vtRes.data);
    } catch (err) {
      console.error('Map data load failed:', err);
      toast.error('Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelect = useCallback((type: string, id: string) => {
    setSelectedType(type);
    setSelectedId(id);
    setShowProperties(true);
    setBoundsPoints([]);
    setShowInteractivePlan(false);
  }, []);

  const saveAnnotation = useCallback(async (geoJson: any, type: string) => {
    const name = `Annotation ${annotations.length + 1}`;
    const color = ['#3388ff', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'][annotations.length % 6];
    const { error } = await supabase.from('map_annotations').insert({
      name, annotation_type: type, geometry: geoJson, color,
      style: { weight: 2, fillOpacity: 0.2 },
    });
    if (!error) { await loadData(); toast.success('Annotation saved'); }
    else toast.error('Failed to save annotation');
  }, [annotations, loadData, toast]);

  const deleteAnnotation = useCallback(async (id: string) => {
    await supabase.from('map_annotations').delete().eq('id', id);
    await loadData();
  }, [loadData]);

  const saveCurrentView = useCallback(async () => {
    if (!viewName.trim()) return;
    const { error } = await supabase.from('map_views').insert({
      name_en: viewName,
      center_lat: 24.75, center_lng: 46.75, zoom: 11,
      layers: { tileLayer, statusFilter, viewMode },
      filters: { status: statusFilter },
    });
    if (!error) { toast.success('View saved'); setViewName(''); setShowSaveView(false); loadData(); }
  }, [viewName, tileLayer, statusFilter, viewMode, loadData, toast]);

  const loadView = useCallback((v: any) => {
    if (v.layers) {
      if (v.layers.tileLayer) setTileLayer(v.layers.tileLayer);
      if (v.layers.statusFilter) setStatusFilter(v.layers.statusFilter);
    }
    toast.info(`Loaded view: ${v.name_en}`);
  }, [toast]);

  const filteredProjects = projects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search && !p.name_en.toLowerCase().includes(search.toLowerCase()) && !p.project_code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const filteredBlocks = blocks.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const tile = TILE_LAYERS[tileLayer];
  const is3d = viewMode === '3d' || viewMode === 'split';

  const blockPolygons = filteredBlocks.filter(b => b.geometry).map(b => ({
    ...b,
    center: b.center_lat && b.center_lng ? [b.center_lat, b.center_lng] as [number, number] : polygonCenter(b.geometry),
  }));

  const projectMarkers = filteredProjects.filter(p => p.latitude && p.longitude);
  const unitMarkers = units.filter(u => u.lat && u.lng);

  return (
    <div className={`page-enter flex flex-col ${fullscreen ? 'fixed inset-0 z-[9999] bg-white' : 'h-[calc(100vh-8rem)]'}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-1.5 px-2 pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Interactive Map</h1>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            {(['2d', '3d', 'split'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === m ? 'gradient-primary text-white' : ''}`}
                style={viewMode !== m ? { color: 'var(--color-text-secondary)', background: 'var(--color-surface)' } : {}}>
                {m === '2d' ? <MapPin size={12} className="inline mr-1" /> : m === '3d' ? <Box size={12} className="inline mr-1" /> : <Grid3x3 size={12} className="inline mr-1" />}
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            {(['street', 'satellite', 'terrain'] as const).map(t => (
              <button key={t} onClick={() => setTileLayer(t)}
                className={`px-2 py-1 text-xs font-medium transition-colors ${tileLayer === t ? 'gradient-primary text-white' : ''}`}
                style={tileLayer !== t ? { color: 'var(--color-text-secondary)', background: 'var(--color-surface)' } : {}}>
                {t === 'street' ? <Sun size={11} className="inline mr-1" /> : t === 'satellite' ? <Moon size={11} className="inline mr-1" /> : <MapPin size={11} className="inline mr-1" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." className="input text-xs"
              style={{ width: '120px', padding: '0.25rem 0.5rem 0.25rem 1.5rem' }}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select text-xs" style={{ padding: '0.25rem 0.5rem' }}
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            {Object.entries(statusLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
          <button className={`btn-sm ${drawMode !== 'none' ? 'bg-blue-600 text-white' : 'btn-secondary'}`}
            onClick={() => setDrawMode(drawMode === 'none' ? 'polygon' : 'none')} title="Toggle drawing">
            <Pencil size={13} />
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowLegend(!showLegend)} title="Legend">
            <Eye size={13} />
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowHierarchy(!showHierarchy)} title="Hierarchy">
            <List size={13} />
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowSaveView(!showSaveView)} title="Save view">
            <Save size={13} />
          </button>
          <span className="w-px h-4" style={{ background: 'var(--color-border)' }} />
          <button className={`btn-sm ${measureMode !== 'none' ? 'bg-green-600 text-white' : 'btn-secondary'}`}
            onClick={() => setMeasureMode(measureMode === 'none' ? 'distance' : 'none')} title="Measure">
            <Ruler size={13} />
          </button>
          {(viewMode === '3d' || viewMode === 'split') && (
            <button className={`btn-sm ${showWalkthrough ? 'bg-purple-600 text-white' : 'btn-secondary'}`}
              onClick={() => setShowWalkthrough(!showWalkthrough)} title="Walkthrough">
              <Footprints size={13} />
            </button>
          )}
          {selectedType === 'floor' && (
            <button className={`btn-sm ${showInteractivePlan ? 'bg-indigo-600 text-white' : 'btn-secondary'}`}
              onClick={() => setShowInteractivePlan(!showInteractivePlan)} title="Interactive Floor Plan">
              <Grid3x3 size={13} />
            </button>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Save view input */}
      {showSaveView && (
        <div className="flex items-center gap-2 px-2 pb-1">
          <input className="input text-xs flex-1" style={{ maxWidth: 200, padding: '0.2rem 0.5rem' }}
            placeholder="View name..." value={viewName} onChange={e => setViewName(e.target.value)} />
          <button className="btn-primary btn-xs" onClick={saveCurrentView} disabled={!viewName.trim()}>Save</button>
          <button className="btn-secondary btn-xs" onClick={() => setShowSaveView(false)}>Cancel</button>
          {savedViews.length > 0 && (
            <select className="select text-xs" style={{ padding: '0.2rem 0.5rem', maxWidth: 160 }}
              onChange={e => { const v = savedViews.find(sv => sv.id === e.target.value); if (v) loadView(v); }} defaultValue="">
              <option value="" disabled>Load view...</option>
              {savedViews.map(v => <option key={v.id} value={v.id}>{v.name_en}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex gap-2 min-h-0 px-2 pb-2">
        {/* Hierarchy panel */}
        {showHierarchy && (viewMode === '2d' || viewMode === 'split') && (
          <div className="w-56 glass-card overflow-hidden shrink-0 rounded-lg">
            <HierarchyTree
              projects={projects} blocks={blocks} buildings={buildings}
              onSelect={handleSelect} selectedId={`${selectedType}-${selectedId}`}
              expanded={expandedNodes} onToggle={toggleNode} colors={statusColors}
            />
          </div>
        )}

        {/* 2D Map */}
        {(viewMode === '2d' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} glass-card overflow-hidden rounded-lg`}>
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
              </div>
            ) : (
              <div className="relative h-full">
                {/* Legend */}
                {showLegend && (
                  <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2.5 py-1.5 text-xs flex items-center gap-2">
                    <span className="font-medium text-gray-700">{filteredProjects.length} Projects</span>
                    <span className="w-px h-3 bg-gray-200" />
                    {Object.entries(statusColors).filter(([k]) => statusLabels[k]).map(([s, c]) => (
                      <div key={s} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                        <span className="text-gray-500 capitalize" style={{ fontSize: 10 }}>{statusLabels[s] || s}</span>
                      </div>
                    ))}
                  </div>
                )}

                <MapContainer center={[24.75, 46.75]} zoom={11} className="h-full w-full" style={{ background: '#f0f0f0' }} zoomControl={false}>
                  <TileLayer attribution={tile.att} url={tile.url} />
                  <ScaleControl position="bottomleft" imperial={false} />
                  <FocusOnSelect selectedType={selectedType} selectedId={selectedId} projects={projects} blocks={blocks} buildings={buildings} units={units} />

                  {/* Drawing toolbar */}
                  <DrawingToolbar enabled={drawMode !== 'none'} annotations={annotations} onSave={saveAnnotation} mode={drawMode} setMode={setDrawMode} />

                  {/* Block polygons */}
                  {blockPolygons.map(b => b.geometry && (
                    <GeoJSON key={b.id} data={b.geometry}
                      style={() => ({
                        color: b.color || statusColors[b.status] || '#3388ff',
                        fillColor: b.color || statusColors[b.status] || '#3388ff',
                        fillOpacity: hoveredBlock === b.id ? 0.35 : 0.15,
                        weight: hoveredBlock === b.id ? 3 : 2,
                      })}
                      eventHandlers={{
                        click: () => handleSelect('block', b.id),
                        mouseover: () => setHoveredBlock(b.id),
                        mouseout: () => setHoveredBlock(null),
                      }}
                    >
                      <Popup>
                        <div style={{ minWidth: 180 }}>
                          <h3 className="font-semibold text-gray-900 text-sm">{b.name_en}</h3>
                          <p className="text-xs font-mono text-gray-500">{b.block_code}</p>
                          <div className="mt-1.5 space-y-1 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[b.status] }} />
                              <span className="capitalize">{statusLabels[b.status] || b.status}</span>
                            </div>
                            {b.floor_count != null && <p>Floors: {b.floor_count}</p>}
                            {b.total_units != null && <p>Units: {b.total_units}</p>}
                            {b.progress_percent != null && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${b.progress_percent}%`, backgroundColor: statusColors[b.status] }} />
                                </div>
                                <span className="font-medium text-gray-600">{b.progress_percent}%</span>
                              </div>
                            )}
                            {b.area_sqm != null && <p>Area: {b.area_sqm.toLocaleString()} m²</p>}
                          </div>
                        </div>
                      </Popup>
                    </GeoJSON>
                  ))}

                  {/* Project markers */}
                  {projectMarkers.map(p => (
                    <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={createDivIcon(p.status, p.project_code.slice(-2), 32, statusColors)}>
                      <Popup>
                        <div style={{ minWidth: 200 }}>
                          <h3 className="font-semibold text-gray-900 text-sm">{p.name_en}</h3>
                          <p className="text-xs font-mono text-gray-500">{p.project_code}</p>
                          <div className="mt-2 space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[p.status] }} />
                              <span className="capitalize">{statusLabels[p.status] || p.status}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${p.progress_percent}%`, backgroundColor: statusColors[p.status] }} />
                              </div>
                              <span className="font-medium text-gray-600">{p.progress_percent}%</span>
                            </div>
                            {p.budget_amount != null && <p className="text-gray-500">Budget: {p.budget_amount.toLocaleString()} SAR</p>}
                          </div>
                          <button className="btn-primary btn-xs w-full mt-2 text-center flex items-center justify-center gap-1"
                            onClick={() => navigate(`/projects/${p.id}`)}>
                            <ExternalLink size={11} /> View Details
                          </button>
                          <button className="btn-secondary btn-xs w-full mt-1 text-center flex items-center justify-center gap-1"
                            onClick={() => setQrModal({ show: true, value: `${window.location.origin}/projects/${p.id}`, title: p.name_en })}>
                            <QrCode size={11} /> QR Code
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Unit markers with clustering */}
                  <UnitClusterLayer units={unitMarkers} colors={statusColors} />

                  {/* Floor plan overlays + bounds picking */}
                  <FloorPlanOverlay floors={floors} selectedType={selectedType} selectedId={selectedId} boundsPoints={boundsPoints} />
                  {boundsPoints.length < 2 && selectedType === 'floor' && (
                    <BoundsClickHandler onPick={onBoundsPick} />
                  )}
                  {measureMode !== 'none' && (
                    <MeasureClickHandler onMeasure={(lat, lng) => {
                      if (measureMode === 'distance') {
                        setMeasurements(prev => {
                          const last = prev.length > 0 ? prev[prev.length - 1] : null;
                          if (last && last.type === 'distance' && last.points.length < 2) {
                            // Continue current measurement
                            const pts: [number, number][] = [[lat, lng]];
                            const dist = calculateDistance(last.points[0], pts[0]);
                            return [...prev.slice(0, -1), { ...last, points: [...last.points, [lat, lng] as [number, number]], value: Math.round(dist), label: `${Math.round(dist)} m` }];
                          }
                          // Start new measurement
                          const id = `m-${Date.now()}`;
                          const color = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][prev.length % 5];
                          return [...prev, { id, type: 'distance' as const, points: [[lat, lng] as [number, number]], value: 0, label: 'Click second point', color }];
                        });
                      } else if (measureMode === 'area') {
                        setMeasurements(prev => {
                          const last = prev.length > 0 ? prev[prev.length - 1] : null;
                          if (last && last.type === 'area' && last.points.length < 3) {
                            const pts = [...last.points, [lat, lng] as [number, number]];
                            if (pts.length >= 3) {
                              const area = calculateArea(pts);
                              const label = area >= 10000 ? `${(area / 10000).toFixed(2)} ha` : `${Math.round(area)} m²`;
                              return [...prev.slice(0, -1), { ...last, points: pts, value: Math.round(area), label }];
                            }
                            return [...prev.slice(0, -1), { ...last, points: pts }];
                          }
                          const id = `m-${Date.now()}`;
                          const color = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][prev.length % 5];
                          return [...prev, { id, type: 'area' as const, points: [[lat, lng] as [number, number]], value: 0, label: 'Click 2 more points', color }];
                        });
                      }
                    }} />
                  )}

                  {/* Render measurement lines/polygons */}
                  {measurements.length > 0 && <MeasurementLayer measurements={measurements} />}

                  {/* Measurement tool UI overlay */}
                  {measureMode !== 'none' && (
                    <MeasurementTool
                      enabled={true}
                      mode={measureMode}
                      onModeChange={setMeasureMode}
                      onMapClick={() => {}}
                      measurements={measurements}
                      onMeasurementsChange={setMeasurements}
                    />
                  )}

                  {/* Bottom controls */}
                  <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2">
                    <MapCoordTracker />
                    {measureMode !== 'none' && measurements.length > 0 && (
                      <span className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5 text-[10px] text-gray-600">
                        {measurements.length} measurement{measurements.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <button onClick={() => setFullscreen(!fullscreen)} className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5 text-xs text-gray-600 hover:bg-white transition-colors">
                      {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                  </div>
                </MapContainer>

                {/* Annotation list overlay */}
                {annotations.length > 0 && (
                  <div className="absolute top-10 right-2 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg w-48 max-h-48 overflow-y-auto">
                    <div className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 border-b flex items-center gap-1.5">
                      <Pencil size={10} /> Annotations ({annotations.length})
                    </div>
                    {annotations.map(a => (
                      <div key={a.id} className="px-2.5 py-1 text-[10px] border-b last:border-0 hover:bg-gray-50 flex items-center justify-between group">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.color || '#3388ff' }} />
                        <span className="truncate flex-1 mx-1.5">{a.name || a.annotation_type}</span>
                        <button onClick={() => deleteAnnotation(a.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600"><Trash2 size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3D View */}
        {is3d && !showWalkthrough && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} glass-card overflow-hidden rounded-lg`}>
            <Map3DView blocks={filteredBlocks} buildings={buildings} show={true} onSelect={handleSelect} statusColors={statusColors} />
          </div>
        )}

        {/* 3D Walkthrough */}
        {is3d && showWalkthrough && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} glass-card overflow-hidden rounded-lg`}>
            <Walkthrough3DView buildings={buildings} floors={floors} show={true}
              selectedBldg={selectedType === 'building' ? selectedId : undefined}
              onBldgChange={(bid) => handleSelect('building', bid)} />
          </div>
        )}

        {/* Interactive Floor Plan */}
        {showInteractivePlan && selectedType === 'floor' && selectedId && (
          <div className={`${viewMode === 'split' || viewMode === '3d' ? 'w-1/2' : 'flex-1'} glass-card overflow-hidden rounded-lg`}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-sm font-semibold">Interactive Floor Plan</span>
              <div className="flex items-center gap-2">
                {(() => {
                  const floor = floors.find(f => f.id === selectedId);
                  const bldgFloors = floors.filter(f => floor ? f.building_id === floor.building_id : false).sort((a, b) => a.floor_number - b.floor_number);
                  const curIdx = bldgFloors.findIndex(f => f.id === selectedId);
                  return bldgFloors.length > 1 ? (
                    <div className="flex items-center gap-1">
                      <button className="btn-xs btn-secondary" disabled={curIdx <= 0}
                        onClick={() => { const prev = bldgFloors[curIdx - 1]; if (prev) handleSelect('floor', prev.id); }}>
                        <ChevronLeft size={12} />
                      </button>
                      <span className="text-[10px] font-mono px-1">Floor {curIdx + 1}/{bldgFloors.length}</span>
                      <button className="btn-xs btn-secondary" disabled={curIdx < 0 || curIdx >= bldgFloors.length - 1}
                        onClick={() => { const next = bldgFloors[curIdx + 1]; if (next) handleSelect('floor', next.id); }}>
                        <ChevronLeft size={12} className="rotate-180" />
                      </button>
                    </div>
                  ) : null;
                })()}
                <button className="btn-xs btn-secondary" onClick={() => setShowInteractivePlan(false)}><X size={12} /></button>
              </div>
            </div>
            <div className="p-2">
              {(() => {
                const floor = floors.find(f => f.id === selectedId);
                if (!floor?.plan_image) return <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No floor plan image uploaded</p>;
                const rooms = (floor.room_data || []) as RoomHotspot[];
                return (
                  <InteractiveFloorPlan
                    imageUrl={floor.plan_image}
                    hotspots={rooms}
                    onUnitClick={(uid) => navigate(`/units/${uid}`)}
                  />
                );
              })()}
            </div>
          </div>
        )}

        {/* Virtual Tour panel */}
        {selectedType === 'floor' && selectedId && virtualTours.length > 0 && !showInteractivePlan && (
          <div className="w-64 glass-card overflow-hidden shrink-0 rounded-lg">
            <div className="p-2 border-b text-xs font-semibold" style={{ borderColor: 'var(--color-border)' }}>
              Virtual Tours ({virtualTours.length})
            </div>
            <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
              {virtualTours.filter(vt => vt.floor_id === selectedId || vt.building_id === floors.find(f => f.id === selectedId)?.building_id).map(vt => (
                <div key={vt.id} className="text-xs p-1.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="font-medium">{vt.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 capitalize">{vt.tour_type}</div>
                  <a href={vt.tour_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-1 inline-block text-[10px]">Open Tour →</a>
                </div>
              ))}
              {virtualTours.filter(vt => vt.floor_id === selectedId || vt.building_id === floors.find(f => f.id === selectedId)?.building_id).length === 0 && (
                <p className="text-[10px] text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No tours for this floor</p>
              )}
            </div>
          </div>
        )}

        {/* Properties panel */}
        {showProperties && selectedId && (
          <div className="w-56 glass-card overflow-hidden shrink-0 rounded-lg">
            <PropertyPanel
              selectedType={selectedType}
              selectedId={selectedId}
              onClose={() => { setShowProperties(false); setSelectedId(''); }}
              onUpdate={loadData}
              onStartBounds={startBoundsPicking}
            />
          </div>
        )}
      </div>

      <QRCodeModal
        show={qrModal.show}
        onClose={() => setQrModal({ show: false, value: '', title: '' })}
        value={qrModal.value}
        title={qrModal.title}
        subtitle="Scan with your phone to open this project"
      />
    </div>
  );
}

// ---------- Auto Focus on Selected Item ----------
function FocusOnSelect({ selectedType, selectedId, projects, blocks, buildings, units }: {
  selectedType: string; selectedId: string;
  projects: MapProject[]; blocks: MapBlock[]; buildings: MapBuilding[]; units: MapUnit[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId || !selectedType) return;
    let lat = 24.75, lng = 46.75, zoom = 15;
    if (selectedType === 'project') {
      const p = projects.find(x => x.id === selectedId);
      if (p) { lat = p.latitude || p.lat || 24.75; lng = p.longitude || p.lng || 46.75; zoom = 14; }
    } else if (selectedType === 'block') {
      const b = blocks.find(x => x.id === selectedId);
      if (b) {
        if (b.center_lat && b.center_lng) { lat = b.center_lat; lng = b.center_lng; zoom = 16; }
        else if (b.geometry) { const c = polygonCenter(b.geometry); lat = c[0]; lng = c[1]; zoom = 16; }
      }
    } else if (selectedType === 'building') {
      const b = buildings.find(x => x.id === selectedId);
      if (b) { lat = b.center_lat || 24.75; lng = b.center_lng || 46.75; zoom = 17; }
    } else if (selectedType === 'unit') {
      const u = units.find(x => x.id === selectedId);
      if (u) { lat = u.lat || 24.75; lng = u.lng || 46.75; zoom = 18; }
    }
    map.flyTo([lat, lng], zoom, { duration: 1 });
  }, [map, selectedType, selectedId, projects, blocks, buildings, units]);
  return null;
}

// ---------- Coordinate Tracker ----------
function MapCoordTracker() {
  const map = useMap();
  const [coord, setCoord] = useState('');
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => setCoord(`${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
    map.on('mousemove', handler);
    return () => { map.off('mousemove', handler); };
  }, [map]);
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5 text-[10px] font-mono text-gray-600">
      {coord || '24.7500, 46.7500'}
    </div>
  );
}
