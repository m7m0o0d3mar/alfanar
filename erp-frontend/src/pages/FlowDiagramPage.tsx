import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useT } from '../hooks/useTranslation';
import { flowDiagramsApi, type FlowDiagram } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ReactFlow, addEdge, useNodesState, useEdgesState, Controls, Background,
  MiniMap, useReactFlow, ReactFlowProvider, Handle, Position,
  BackgroundVariant,
  type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Database, Globe, Monitor, ExternalLink, Save, Download, Plus, Trash2,
  Layout, Settings, Copy, RotateCw, Undo2, Search,
} from 'lucide-react';

type FlowNodeType = 'table' | 'page' | 'api' | 'external';

interface FlowNodeData {
  label: string;
  color?: string;
  sublabel?: string;
  columns?: Array<{ name: string; type: string }>;
  [key: string]: unknown;
}

interface HistoryEntry {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

const NODE_COLORS: Record<string, string> = {
  table: '#0ea5e9',
  page: '#8b5cf6',
  api: '#f59e0b',
  external: '#6b7280',
};

const EDGE_TYPES = ['default', 'straight', 'step', 'smoothstep'] as const;

function TypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  if (type === 'table') return <Database size={size} />;
  if (type === 'page') return <Monitor size={size} />;
  if (type === 'api') return <Globe size={size} />;
  return <ExternalLink size={size} />;
}

function BaseNode({ data, selected, type }: NodeProps) {
  const d = data as FlowNodeData;
  const color = d.color || NODE_COLORS[type] || '#6b7280';
  const columns = d.columns;
  return (
    <div
      className="rounded-xl shadow-lg border-2 min-w-[180px] transition-shadow duration-200"
      style={{
        borderColor: selected ? color : 'transparent',
        boxShadow: selected ? `0 0 0 2px ${color}40, 0 8px 32px ${color}20` : '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: '#fff' }}
      >
        <TypeIcon type={type} />
        <span className="font-semibold text-sm truncate">{d.label}</span>
        {!!d.sublabel && <span className="text-[10px] opacity-70 ml-auto">{String(d.sublabel)}</span>}
      </div>
      {columns && columns.length > 0 && (
        <div className="px-3 py-1.5 text-xs space-y-0.5" style={{ background: 'var(--color-card)', color: 'var(--color-text-secondary)' }}>
          {columns.slice(0, 10).map(col => (
            <div key={col.name} className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="font-mono">{col.name}</span>
              <span className="opacity-60 ml-auto text-[10px]">{col.type.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz')}</span>
            </div>
          ))}
          {columns.length > 10 && (
            <div className="text-center opacity-50 pt-0.5 text-[10px]">+{columns.length - 10} more</div>
          )}
        </div>
      )}
      {!!d.sublabel && (
        <div className="px-3 py-1 text-xs border-t opacity-70" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          {String(d.sublabel)}
        </div>
      )}
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: color, border: '2px solid white', borderRadius: 3 }} />
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: color, border: '2px solid white', borderRadius: 3 }} />
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8, background: color, border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: color, border: '2px solid white' }} />
    </div>
  );
}

function TableNode(props: NodeProps) { return <BaseNode {...props} type="table" />; }
function PageNode(props: NodeProps) { return <BaseNode {...props} type="page" />; }
function ApiNode(props: NodeProps) { return <BaseNode {...props} type="api" />; }
function ExternalNode(props: NodeProps) { return <BaseNode {...props} type="external" />; }

const nodeTypes = { table: TableNode, page: PageNode, api: ApiNode, external: ExternalNode };

const TABLE_TYPES: { type: FlowNodeType; label: string; labelAr: string; color: string; desc: string }[] = [
  { type: 'table', label: 'Database Table', labelAr: 'جدول قاعدة بيانات', color: '#0ea5e9', desc: 'Stores structured data rows' },
  { type: 'page', label: 'UI Page', labelAr: 'صفحة واجهة', color: '#8b5cf6', desc: 'Frontend page or view' },
  { type: 'api', label: 'API / Service', labelAr: 'خدمة / API', color: '#f59e0b', desc: 'Backend endpoint or microservice' },
  { type: 'external', label: 'External System', labelAr: 'نظام خارجي', color: '#6b7280', desc: 'Third-party integration' },
];

function generateId() { return `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function edgeId() { return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function FlowDiagramInner() {
  const t = useT();
  const { effectiveRole } = useAuth();
  const reactFlow = useReactFlow();
  const [diagrams, setDiagrams] = useState<FlowDiagram[]>([]);
  const [activeDiagram, setActiveDiagram] = useState<string | null>(null);
  const [diagramName, setDiagramName] = useState('');
  const [diagramNameAr, setDiagramNameAr] = useState('');
  const [diagramDesc, setDiagramDesc] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSublabel, setEditSublabel] = useState('');
  const [editEdgeLabel, setEditEdgeLabel] = useState('');
  const [editEdgeType, setEditEdgeType] = useState<string>('default');
  const [editEdgeAnimated, setEditEdgeAnimated] = useState(true);
  const [nodeColor, setNodeColor] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showPalette, setShowPalette] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const pushHistoryRef = useRef(() => {});
  pushHistoryRef.current = () => {
    undoStack.current.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    redoStack.current = [];
  };

  function undo() {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }

  function redo() {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    setNodes(next.nodes);
    setEdges(next.edges);
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  useEffect(() => { if (effectiveRole === 'admin') loadDiagrams(); else setLoading(false); }, [effectiveRole]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDiagrams() {
    setLoading(true);
    try {
      const data = await flowDiagramsApi.list();
      setDiagrams(data);
      if (data.length > 0 && !activeDiagram) {
        loadDiagram(data[0]);
      }
    } catch { console.error('Failed to load diagrams'); }
    setLoading(false);
  }

  function loadDiagram(d: FlowDiagram) {
    setActiveDiagram(d.id!);
    setDiagramName(d.name_en);
    setDiagramNameAr(d.name_ar || '');
    setDiagramDesc(d.description_en || '');
    const config = d.config || { nodes: [], edges: [] };
    setNodes(config.nodes as Node<FlowNodeData>[]);
    setEdges(config.edges as Edge[]);
    undoStack.current = [];
    redoStack.current = [];
  }

  const onConnect = useCallback((connection: Connection) => {
    pushHistoryRef.current();
    setEdges(eds => addEdge({ ...connection, id: edgeId(), animated: editEdgeAnimated, type: editEdgeType as any, style: { stroke: 'var(--color-primary)', strokeWidth: 2 } }, eds));
    setSelectedEdge(null);
  }, [setEdges, editEdgeAnimated, editEdgeType]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow') as FlowNodeType | '';
    if (!type) return;
    pushHistoryRef.current();
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    const position = reactFlow.screenToFlowPosition({ x: event.clientX - (bounds?.left || 0), y: event.clientY - (bounds?.top || 0) });
    const color = NODE_COLORS[type];
    const newId = generateId();
    const newNode: Node<FlowNodeData> = {
      id: newId,
      type,
      position,
      data: { label: `${type}_${nodes.length + 1}`, color, columns: [] },
    };
    setNodes(nds => [...nds, newNode]);
  }, [reactFlow, nodes.length, setNodes]);

  function onNodeClick(_: React.MouseEvent, node: Node) {
    const nd = node as Node<FlowNodeData>;
    setSelectedNode(nd);
    setSelectedEdge(null);
    setEditLabel(nd.data.label);
    setEditSublabel((nd.data.sublabel as string) || '');
    setNodeColor(nd.data.color || NODE_COLORS[nd.type as FlowNodeType] || '#6b7280');
  }

  function onEdgeClick(_: React.MouseEvent, edge: Edge) {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setEditEdgeLabel((edge.label as string) || '');
    setEditEdgeType((edge.type as string) || 'default');
    setEditEdgeAnimated(edge.animated ?? true);
  }

  function onPaneClick() {
    setSelectedNode(null);
    setSelectedEdge(null);
  }

  function updateSelectedNode() {
    if (!selectedNode) return;
    pushHistoryRef.current();
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: editLabel, sublabel: editSublabel, color: nodeColor } as FlowNodeData } : n));
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, label: editLabel, sublabel: editSublabel, color: nodeColor } as FlowNodeData } : null);
  }

  function updateSelectedEdge() {
    if (!selectedEdge) return;
    pushHistoryRef.current();
    setEdges(eds => eds.map(e => e.id === selectedEdge.id ? { ...e, label: editEdgeLabel, type: editEdgeType as any, animated: editEdgeAnimated } : e));
    setSelectedEdge(prev => prev ? { ...prev, label: editEdgeLabel, type: editEdgeType as any, animated: editEdgeAnimated } : null);
  }

  function deleteSelected() {
    if (selectedNode) {
      pushHistoryRef.current();
      setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
      setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
    if (selectedEdge) {
      pushHistoryRef.current();
      setEdges(eds => eds.filter(e => e.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
  }

  function duplicateNode() {
    if (!selectedNode) return;
    pushHistoryRef.current();
    const newId = generateId();
    const newNode: Node<FlowNodeData> = {
      ...selectedNode,
      id: newId,
      position: { x: selectedNode.position.x + 60, y: selectedNode.position.y + 60 },
      selected: false,
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNode(newNode);
  }

  function autoLayout() {
    pushHistoryRef.current();
    const marginX = 280;
    const marginY = 120;
    const startX = 80;
    const startY = 80;
    const typeOrder: Record<string, number> = { table: 0, api: 1, page: 2, external: 3 };
    const grouped: Record<string, Node<FlowNodeData>[]> = { table: [], api: [], page: [], external: [] };
    for (const n of nodes) {
      const t = n.type as FlowNodeType;
      if (grouped[t]) grouped[t].push(n); else grouped.external.push(n);
    }
    const sortedTypes = Object.entries(grouped).sort(([a], [b]) => (typeOrder[a] ?? 99) - (typeOrder[b] ?? 99));
    let x = startX;
    setNodes(nds => {
      const updated = [...nds];
      for (const [, typeNodes] of sortedTypes) {
        let y = startY;
        for (const n of typeNodes) {
          const idx = updated.findIndex(u => u.id === n.id);
          if (idx !== -1) updated[idx] = { ...updated[idx], position: { x, y } };
          y += marginY;
        }
        x += marginX;
      }
      return updated;
    });
  }

  async function handleSave() {
    if (!diagramName.trim() || !activeDiagram) return;
    setSaving(true);
    try {
      const viewport = reactFlow.getViewport();
      const nds = nodes.map(n => ({ ...n, position: { x: n.position.x, y: n.position.y } }));
      const config = { nodes: nds, edges, viewport };
      await flowDiagramsApi.upsert({
        id: activeDiagram,
        name_en: diagramName,
        name_ar: diagramNameAr || undefined,
        description_en: diagramDesc || undefined,
        config: config as unknown as FlowDiagram['config'],
      });
      await loadDiagrams();
    } catch (e) { console.error('Save failed', e); }
    setSaving(false);
  }

  async function newDiagram() {
    const id = crypto.randomUUID();
    setActiveDiagram(id);
    setDiagramName('');
    setDiagramNameAr('');
    setDiagramDesc('');
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setSelectedEdge(null);
    undoStack.current = [];
    redoStack.current = [];
  }

  function exportImage() {
    const svg = document.querySelector('.react-flow__renderer svg') as SVGElement | null;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName || 'flow-diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredTypes = useMemo(() => {
    if (!paletteSearch) return TABLE_TYPES;
    const q = paletteSearch.toLowerCase();
    return TABLE_TYPES.filter(t => t.label.toLowerCase().includes(q) || t.labelAr.includes(q) || t.desc.toLowerCase().includes(q));
  }, [paletteSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 mx-auto" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
          <div className="text-sm opacity-60" style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading') || 'Loading...'}</div>
        </div>
      </div>
    );
  }

  const isEditMode = activeDiagram !== null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between px-6 py-3 border-b gap-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
        <div className="flex items-center gap-3">
          <Layout size={20} style={{ color: 'var(--color-primary)' }} />
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <input
                className="bg-transparent border-b text-lg font-semibold outline-none px-1"
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                value={diagramName}
                onChange={e => setDiagramName(e.target.value)}
                placeholder={t('admin.flow_diagram_name') || 'Diagram Name'}
              />
              <select
                className="text-sm rounded-lg px-2 py-1 border outline-none"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                value={activeDiagram || ''}
                onChange={e => {
                  const d = diagrams.find(x => x.id === e.target.value);
                  if (d) loadDiagram(d);
                }}
              >
                {diagrams.map(d => <option key={d.id} value={d.id!}>{d.name_en}</option>)}
              </select>
            </div>
          ) : (
            <span className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{t('admin.flow_diagram') || 'Flow Diagram'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm" onClick={() => setShowPalette(!showPalette)} title="Toggle palette">
            <Database size={14} /> {t('admin.nodes') || 'Nodes'}
          </button>
          <button className="btn-secondary btn-sm" onClick={autoLayout} title="Auto layout nodes" disabled={nodes.length === 0}>
            <RotateCw size={14} /> {t('admin.auto_layout') || 'Layout'}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setSnapToGrid(!snapToGrid)} title="Toggle snap to grid">
            <Copy size={14} /> {snapToGrid ? 'Snap' : 'Free'}
          </button>
          <button className="btn-secondary btn-sm" onClick={exportImage} disabled={nodes.length === 0}>
            <Download size={14} /> SVG
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowSidebar(!showSidebar)}>
            <Settings size={14} /> {t('admin.properties') || 'Props'}
          </button>
          <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving || !diagramName.trim() || !activeDiagram}>
            <Save size={14} /> {saving ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showPalette && (
          <div className="w-60 border-r p-3 overflow-y-auto flex-shrink-0 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('admin.node_types') || 'Node Types'}
                </h3>
                <button className="btn-secondary btn-sm !p-1" onClick={newDiagram} title={t('admin.new') || 'New'}>
                  <Plus size={12} />
                </button>
              </div>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
                <input
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border outline-none"
                  style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                  placeholder={t('common.search') || 'Search...'}
                  value={paletteSearch}
                  onChange={e => setPaletteSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {filteredTypes.map(nt => (
                <div
                  key={nt.type}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('application/reactflow', nt.type); e.dataTransfer.effectAllowed = 'move'; }}
                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-grab active:cursor-grabbing border text-sm transition-all hover:opacity-80 hover:shadow-sm"
                  style={{ borderColor: `${nt.color}40`, background: `${nt.color}10`, color: 'var(--color-text)' }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: nt.color }}>
                    <TypeIcon type={nt.type} size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-xs leading-tight">{nt.label}</div>
                    <div className="text-[10px] opacity-50">{nt.desc}</div>
                  </div>
                </div>
              ))}
              {filteredTypes.length === 0 && (
                <div className="text-xs text-center py-4 opacity-50" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('common.no_results') || 'No results'}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={reactFlowWrapper} className="flex-1 relative">
          {!isEditMode && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center pointer-events-auto max-w-md p-8 rounded-2xl" style={{ background: 'var(--color-card)', border: '1px dashed var(--color-border)' }}>
                <Layout size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-secondary)' }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  {t('admin.flow_diagram_empty') || 'Create a Flow Diagram'}
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('admin.flow_diagram_empty_desc') || 'Drag nodes from the palette onto the canvas, connect them with edges, and save your diagram. Press Ctrl+Z to undo, Ctrl+Shift+Z to redo.'}
                </p>
                <button className="btn-primary" onClick={newDiagram}>
                  <Plus size={16} /> {t('admin.new_diagram') || 'New Diagram'}
                </button>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            deleteKeyCode="Delete"
            onKeyDown={e => { const ke = e as unknown as KeyboardEvent; if (ke.key === 'Delete') deleteSelected(); }}
            fitView
            snapToGrid={snapToGrid}
            snapGrid={[20, 20]}
          >
            <Controls showInteractive={false} />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />
            <MiniMap
              nodeStrokeWidth={3}
              style={{ borderRadius: '12px', border: '1px solid var(--color-border)' }}
              nodeColor={n => (n.data as FlowNodeData)?.color || NODE_COLORS[n.type as FlowNodeType] || '#888'}
              maskColor="var(--color-bg)"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        {showSidebar && (
          <div className="w-80 border-l p-4 overflow-y-auto flex-shrink-0 space-y-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {selectedNode ? (t('admin.node_properties') || 'Node Properties') :
                 selectedEdge ? (t('admin.edge_properties') || 'Edge Properties') :
                 (t('admin.diagram_properties') || 'Diagram Properties')}
              </h3>
              <div className="flex gap-1">
                <button className="btn-secondary !p-1" onClick={undo} disabled={undoStack.current.length === 0} title="Undo (Ctrl+Z)">
                  <Undo2 size={12} />
                </button>
                <button className="btn-secondary !p-1" onClick={redo} disabled={redoStack.current.length === 0} title="Redo (Ctrl+Y)">
                  <RotateCw size={12} />
                </button>
              </div>
            </div>

            {selectedNode && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.label') || 'Label'}</label>
                  <input className="w-full input px-2 py-1.5 text-sm rounded-lg border outline-none mt-1" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                    value={editLabel} onChange={e => setEditLabel(e.target.value)} onBlur={updateSelectedNode} onKeyDown={e => { if (e.key === 'Enter') updateSelectedNode(); }} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.description') || 'Description'}</label>
                  <input className="w-full input px-2 py-1.5 text-sm rounded-lg border outline-none mt-1" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                    value={editSublabel} onChange={e => setEditSublabel(e.target.value)} onBlur={updateSelectedNode} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.color') || 'Color'}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" className="w-9 h-9 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--color-border)' }}
                      value={nodeColor} onChange={e => setNodeColor(e.target.value)} onBlur={updateSelectedNode} />
                    <input className="flex-1 input px-2 py-1.5 text-xs rounded-lg border outline-none font-mono" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                      value={nodeColor} onChange={e => setNodeColor(e.target.value)} onBlur={updateSelectedNode} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>ID</label>
                  <div className="text-xs font-mono mt-1 px-2 py-1 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>{selectedNode.id}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary btn-sm flex-1" onClick={duplicateNode}>
                    <Copy size={14} /> {t('common.duplicate') || 'Duplicate'}
                  </button>
                  <button className="btn-secondary btn-sm flex-1" onClick={deleteSelected}>
                    <Trash2 size={14} /> {t('common.delete') || 'Delete'}
                  </button>
                </div>
              </div>
            )}

            {selectedEdge && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.label') || 'Label'}</label>
                  <input className="w-full input px-2 py-1.5 text-sm rounded-lg border outline-none mt-1" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                    value={editEdgeLabel} onChange={e => setEditEdgeLabel(e.target.value)} onBlur={updateSelectedEdge} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.edge_style') || 'Style'}</label>
                  <select className="w-full px-2 py-1.5 text-sm rounded-lg border outline-none mt-1" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                    value={editEdgeType} onChange={e => { setEditEdgeType(e.target.value); setTimeout(updateSelectedEdge, 0); }}>
                    {EDGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.animated') || 'Animated'}</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={editEdgeAnimated} onChange={e => { setEditEdgeAnimated(e.target.checked); setTimeout(updateSelectedEdge, 0); }} />
                    <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" style={{ background: editEdgeAnimated ? 'var(--color-primary)' : 'var(--color-border)' }} />
                  </label>
                </div>
                <div className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <div>Source: <span className="font-mono opacity-70">{selectedEdge.source}</span></div>
                  <div>Target: <span className="font-mono opacity-70">{selectedEdge.target}</span></div>
                </div>
                <button className="btn-secondary btn-sm w-full" onClick={deleteSelected}>
                  <Trash2 size={14} /> {t('common.delete') || 'Delete'}
                </button>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('admin.name_ar') || 'Name (Arabic)'}</label>
                  <input className="w-full input px-2 py-1.5 text-sm rounded-lg border outline-none mt-1" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                    value={diagramNameAr} onChange={e => setDiagramNameAr(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t('common.description') || 'Description'}</label>
                  <textarea className="w-full input px-2 py-1.5 text-sm rounded-lg border outline-none mt-1 resize-none" rows={3} style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                    value={diagramDesc} onChange={e => setDiagramDesc(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                    <div className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{nodes.length}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('common.nodes') || 'Nodes'}</div>
                  </div>
                  <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                    <div className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{edges.length}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{t('common.edges') || 'Edges'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FlowDiagramPage() {
  return (
    <ReactFlowProvider>
      <FlowDiagramInner />
    </ReactFlowProvider>
  );
}
