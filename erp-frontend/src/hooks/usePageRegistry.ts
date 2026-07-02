import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageRegistryApi } from '../services/api';
import type { PageRegistryEntry } from '../types';

let cache: PageRegistryEntry[] | null = null;
let cacheLoaded = false;
const listeners: Set<() => void> = new Set();

function notify() { listeners.forEach(fn => fn()); }

export function loadPageRegistry() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  pageRegistryApi.list(true).then(pages => {
    cache = pages;
    notify();
  }).catch(() => { cache = []; notify(); });
}

export function usePageRegistry() {
  const [pages, setPages] = useState<PageRegistryEntry[]>(cache ?? []);
  useEffect(() => {
    loadPageRegistry();
    if (!cache) {
      pageRegistryApi.list(true).then(p => { cache = p; setPages(p); }).catch(() => setPages([]));
    }
    const fn = () => setPages(cache ?? []);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return pages;
}

export function usePageTitle() {
  const location = useLocation();
  const pages = usePageRegistry();
  const path = location.pathname;
  const match = pages.find(p => p.path && path.startsWith(p.path));
  if (match) return match.name_en || match.code;
  return null;
}
