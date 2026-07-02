import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useTranslation';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { fileUploadsApi, documentFoldersApi } from '../services/api';
import FilePreviewModal from '../components/FilePreviewModal';
import { Search, Folder, FileText, Upload, Download, Trash2, Eye, Grid3X3, List, MoreHorizontal, Image, FileArchive, ExternalLink, Plus, Home, ChevronRight, Tag, User, Clock, HardDrive, Filter, X, AlertCircle, Star, Share2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import { useDropzone } from 'react-dropzone';

interface FileItem {
  id: string; file_name: string; file_size: number; mime_type: string;
  storage_path: string; public_url: string | null; folder: string;
  tags: string[]; uploaded_by: string; reference_type: string;
  reference_id: string; is_public: boolean; created_at: string;
}

interface FolderInfo {
  id: string; name_en: string; name_ar: string; parent_id: string | null;
  icon: string; sort_order: number;
}

interface UserProfile {
  id: string; full_name_en: string; avatar_url?: string;
}

const MIME_ICONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/': 'image',
  'video/': 'video',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml': 'excel',
  'application/zip': 'zip',
  'application/x-rar': 'zip',
};

function formatSize(bytes: number): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function getFileIcon(mime: string): string {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.includes('pdf')) return 'pdf';
  if (mime?.includes('word') || mime?.includes('document')) return 'word';
  if (mime?.includes('sheet') || mime?.includes('excel')) return 'excel';
  if (mime?.includes('zip') || mime?.includes('rar')) return 'zip';
  return 'file';
}

export default function DocumentsPage() {
  const { hasPermission } = useAuth();
  const t = useT();
  const toast = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1); const pageSize = 20;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentFolder, setCurrentFolder] = useState<string>('/');
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'All Files' }]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderNameAr, setNewFolderNameAr] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterUploader, setFilterUploader] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, images: 0, documents: 0, others: 0, totalSize: 0 });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [filesRes, foldersRes, usersRes] = await Promise.all([
        supabase.from('file_uploads').select('*').order('created_at', { ascending: false }),
        documentFoldersApi.list(),
        supabase.from('user_profiles').select('id, full_name_en').order('full_name_en'),
      ]);
      setFiles((filesRes.data || []) as FileItem[]);
      setFolders((foldersRes || []) as FolderInfo[]);
      setUsers((usersRes.data || []) as UserProfile[]);

      const f = (filesRes.data || []) as FileItem[];
      setStats({
        total: f.length,
        images: f.filter(x => x.mime_type?.startsWith('image/')).length,
        documents: f.filter(x => x.mime_type?.includes('pdf') || x.mime_type?.includes('word') || x.mime_type?.includes('sheet')).length,
        others: f.filter(x => !x.mime_type?.startsWith('image/') && !x.mime_type?.includes('pdf') && !x.mime_type?.includes('word') && !x.mime_type?.includes('sheet')).length,
        totalSize: f.reduce((s, x) => s + (x.file_size || 0), 0),
      });
    } catch (err) { console.error('Failed to load documents:', err); toast.error('Failed to load'); }
    setLoading(false);
  }

  const sortedFolders = [...folders].sort((a, b) => a.sort_order - b.sort_order);

  const filtered = files.filter(f => {
    if (search && !f.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (currentFolder !== '/') {
      const folderMatch = f.folder === currentFolder || f.folder?.startsWith(currentFolder + '/');
      if (!folderMatch) return false;
    }
    if (filterType) {
      if (filterType === 'images' && !f.mime_type?.startsWith('image/')) return false;
      if (filterType === 'pdf' && !f.mime_type?.includes('pdf')) return false;
      if (filterType === 'office' && !f.mime_type?.includes('word') && !f.mime_type?.includes('sheet')) return false;
    }
    if (filterUploader && f.uploaded_by !== filterUploader) return false;
    if (filterDateFrom && f.created_at < filterDateFrom) return false;
    if (filterDateTo && f.created_at > filterDateTo + 'T23:59:59') return false;
    return true;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function navigateToFolder(folderId: string | null, folderName: string) {
    const path = folderId ? (folders.find(f => f.id === folderId)?.name_en || folderName) : '/';
    setCurrentFolder(folderId ? path : '/');
    setFolderPath(prev => {
      if (!folderId) return [{ id: null, name: 'All Files' }];
      const existingIdx = prev.findIndex(p => p.id === folderId);
      if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
      return [...prev, { id: folderId, name: folderName }];
    });
    setPage(1);
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    let success = 0;
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      try {
        const path = currentFolder === '/' ? '/' : currentFolder;
        await fileUploadsApi.upload(file, path);
        success++;
      } catch (err) { console.error('Upload failed:', err); }
      setUploadProgress(Math.round(((i + 1) / acceptedFiles.length) * 100));
    }
    setUploading(false);
    setUploadProgress(0);
    if (success > 0) { toast.success(`${success} file(s) uploaded`); loadAll(); }
  }, [currentFolder, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, noClick: true, noKeyboard: true,
  });

  async function createFolder() {
    if (!newFolderName.trim()) { toast.error('Folder name required'); return; }
    try {
      await supabase.from('document_folders').insert({
        name_en: newFolderName.trim(),
        name_ar: newFolderNameAr.trim() || null,
        parent_id: null,
        sort_order: folders.length + 1,
      });
      toast.success('Folder created');
      setShowNewFolderModal(false);
      setNewFolderName(''); setNewFolderNameAr('');
      const foldersRes = await documentFoldersApi.list();
      setFolders((foldersRes || []) as FolderInfo[]);
    } catch (err) { toast.error('Failed to create folder'); }
  }

  async function deleteFile(id: string) {
    try {
      const file = files.find(f => f.id === id);
      if (file) await fileUploadsApi.remove(id);
      toast.success('File deleted');
      setDeleting(null);
      loadAll();
    } catch { toast.error('Delete failed'); setDeleting(null); }
  }

  function getUserName(id: string): string {
    return users.find(u => u.id === id)?.full_name_en || id?.slice(0, 8);
  }

  function getFileUrl(file: FileItem): string {
    if (file.public_url) return file.public_url;
    const { data } = supabase.storage.from('documents').getPublicUrl(file.storage_path);
    return data?.publicUrl || '';
  }

  return (
    <div className="page-enter space-y-6" {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="rounded-2xl p-12 text-center border-2 border-dashed" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-primary)' }}>
            <Upload size={48} className="mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
            <p className="text-lg font-semibold">Drop files here to upload</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{t('nav.documents')}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>{stats.total} files · {formatSize(stats.totalSize)}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-sm btn-secondary" onClick={() => setShowNewFolderModal(true)}><Folder size={14} /> New Folder</button>
          {hasPermission('documents', 'create') && (
            <button className="btn-primary btn-sm" onClick={() => setShowUploadModal(true)}><Upload size={16} /> Upload</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-glass p-3 rounded-xl">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}><FileText size={14} /> All Files</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{stats.total}</div>
        </div>
        <div className="stat-glass p-3 rounded-xl">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}><Image size={14} /> Images</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{stats.images}</div>
        </div>
        <div className="stat-glass p-3 rounded-xl">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}><FileText size={14} /> Documents</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{stats.documents}</div>
        </div>
        <div className="stat-glass p-3 rounded-xl">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}><HardDrive size={14} /> Storage</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{formatSize(stats.totalSize)}</div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Folder sidebar */}
        <div className="w-56 flex-shrink-0 hidden md:block">
          <div className="card p-3 space-y-1">
            <button
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${currentFolder === '/' ? '' : 'hover:opacity-80'}`}
              style={{ background: currentFolder === '/' ? 'var(--color-primary)' : 'transparent', color: currentFolder === '/' ? '#fff' : 'var(--color-text)' }}
              onClick={() => navigateToFolder(null, 'All Files')}
            ><Home size={16} /> All Files</button>
            {sortedFolders.map(f => (
              <button
                key={f.id}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${currentFolder === f.name_en ? '' : 'hover:opacity-80'}`}
                style={{ background: currentFolder === f.name_en ? 'var(--color-primary)' : 'transparent', color: currentFolder === f.name_en ? '#fff' : 'var(--color-text)' }}
                onClick={() => navigateToFolder(f.id, f.name_en)}
              ><Folder size={16} /> {f.name_en}</button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Breadcrumb + view toggle */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 text-sm flex-wrap">
              {folderPath.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} />}
                  <button
                    className="hover:underline"
                    style={{ color: i === folderPath.length - 1 ? 'var(--color-text)' : 'var(--color-text-secondary)' }}
                    onClick={() => navigateToFolder(p.id, p.name)}
                  >{p.name}</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <button className={`btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}><Grid3X3 size={14} /></button>
              <button className={`btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}><List size={14} /></button>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
              <input className="input ps-9" placeholder="Search files..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="input max-w-[130px]" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="images">Images</option>
              <option value="pdf">PDF</option>
              <option value="office">Office</option>
            </select>
            <select className="input max-w-[150px]" value={filterUploader} onChange={e => { setFilterUploader(e.target.value); setPage(1); }}>
              <option value="">All Uploaders</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name_en}</option>)}
            </select>
            {(filterType || filterUploader || filterDateFrom || filterDateTo || search) && (
              <button className="btn-sm btn-secondary" onClick={() => { setFilterType(''); setFilterUploader(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch(''); }}>
                <X size={14} /> Clear
              </button>
            )}
          </div>

          {/* File grid/list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8" style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
              <FileText size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No files found</p>
              <p className="text-sm mt-1">Drop files here or click Upload to add files</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {paginated.map(f => (
                <div key={f.id} className="card p-3 rounded-xl hover:shadow-lg transition-shadow cursor-pointer group relative" onClick={() => setPreviewFile(f)}>
                  {/* Thumbnail */}
                  <div className="aspect-square rounded-lg mb-2 flex items-center justify-center overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                    {f.mime_type?.startsWith('image/') ? (
                      <img src={getFileUrl(f)} alt={f.file_name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <FileText size={36} style={{ color: 'var(--color-text-secondary)' }} />
                    )}
                  </div>
                  {/* Info */}
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>{f.file_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{formatSize(f.file_size)}</span>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{getUserName(f.uploaded_by)}</span>
                  </div>
                  {/* Actions overlay */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button className="btn-sm !p-1 bg-white shadow rounded" onClick={e => { e.stopPropagation(); window.open(getFileUrl(f), '_blank'); }}><ExternalLink size={12} /></button>
                    <button className="btn-sm !p-1 bg-white shadow rounded" style={{ color: 'var(--color-danger)' }} onClick={e => { e.stopPropagation(); setDeleting(f.id); }}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Type</th><th>Size</th><th>Folder</th><th>Uploaded By</th><th>Date</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(f => (
                      <tr key={f.id} className="hover:opacity-80 cursor-pointer" onClick={() => setPreviewFile(f)}>
                        <td className="font-medium">
                          <div className="flex items-center gap-2">
                            {f.mime_type?.startsWith('image/') ? <Image size={16} style={{ color: '#22c55e' }} /> : <FileText size={16} style={{ color: 'var(--color-text-secondary)' }} />}
                            <span className="truncate max-w-[250px]">{f.file_name}</span>
                          </div>
                        </td>
                        <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{f.mime_type || '-'}</td>
                        <td className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatSize(f.file_size)}</td>
                        <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{f.folder || '/'}</td>
                        <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{getUserName(f.uploaded_by)}</td>
                        <td className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{f.created_at ? new Date(f.created_at).toLocaleDateString() : '-'}</td>
                        <td>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button className="btn-sm btn-secondary" onClick={() => window.open(getFileUrl(f), '_blank')}><ExternalLink size={14} /></button>
                            <button className="btn-sm btn-secondary" onClick={() => { const a = document.createElement('a'); a.href = getFileUrl(f); a.download = f.file_name; a.click(); }}><Download size={14} /></button>
                            {hasPermission('documents', 'delete') && (
                              <button className="btn-sm btn-secondary" style={{ color: 'var(--color-danger)' }} onClick={() => setDeleting(f.id)}><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </div>
      </div>

      {/* Upload modal */}
      {showUploadModal && <UploadModal onClose={() => setShowUploadModal(false)} onUploaded={loadAll} currentFolder={currentFolder} />}

      {/* Preview modal */}
      {previewFile && (
        <FilePreviewModal
          url={getFileUrl(previewFile)}
          fileName={previewFile.file_name}
          mimeType={previewFile.mime_type}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* New folder modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowNewFolderModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Folder</h3>
            <div className="space-y-3">
              <div><label className="label">Name (English)</label><input className="input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="e.g. Contracts" /></div>
              <div><label className="label">Name (Arabic)</label><input className="input" value={newFolderNameAr} onChange={e => setNewFolderNameAr(e.target.value)} placeholder="e.g. العقود" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary btn-sm" onClick={createFolder}>Create</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowNewFolderModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleting && (
        <ConfirmDialog
          title="Delete File"
          message="Are you sure you want to delete this file? This cannot be undone."
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => deleteFile(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="fixed bottom-6 right-6 z-50 card p-4 rounded-xl shadow-2xl w-72">
          <div className="flex items-center gap-2 mb-2">
            <Upload size={16} className="animate-pulse" style={{ color: 'var(--color-primary)' }} />
            <span className="text-sm font-medium">Uploading...</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-bg)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: 'var(--color-primary)' }} />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{uploadProgress}%</p>
        </div>
      )}
    </div>
  );
}

function UploadModal({ onClose, onUploaded, currentFolder }: { onClose: () => void; onUploaded: () => void; currentFolder: string }) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: accepted => setFiles(prev => [...prev, ...accepted]),
    noClick: true,
  });

  async function uploadAll() {
    if (files.length === 0) return;
    setUploading(true);
    let success = 0;
    for (const file of files) {
      try {
        await fileUploadsApi.upload(file, currentFolder === '/' ? '/' : currentFolder);
        success++;
      } catch (err) { console.error('Upload failed:', err); }
    }
    setUploading(false);
    if (success > 0) { toast.success(`${success} file(s) uploaded`); onUploaded(); }
    onClose();
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()} {...getRootProps()}>
        <input {...getInputProps()} ref={fileInputRef} />
        <h3 className="text-lg font-semibold mb-4">Upload Files</h3>

        {/* Drop zone */}
        {files.length === 0 && (
          <div className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:opacity-80 transition-opacity" style={{ borderColor: isDragActive ? 'var(--color-primary)' : 'var(--color-border)' }}>
            <Upload size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-secondary)' }} />
            <p className="font-medium">Drop files here</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>or click to browse</p>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg text-sm" style={{ background: 'var(--color-bg)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} style={{ color: 'var(--color-text-secondary)' }} />
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatSize(f.size)}</span>
                </div>
                <button className="btn-sm !p-1" style={{ color: 'var(--color-danger)' }} onClick={() => removeFile(i)}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button className="btn-sm btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Plus size={14} /> Add Files
          </button>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary btn-sm" onClick={uploadAll} disabled={uploading || files.length === 0}>
              {uploading ? 'Uploading...' : `Upload ${files.length > 0 ? `(${files.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
