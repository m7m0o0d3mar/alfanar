import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useProjectFilter(): [string, (v: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectId, setProjectId] = useState(searchParams.get('project_id') || '');

  useEffect(() => {
    const fromUrl = searchParams.get('project_id') || '';
    if (fromUrl !== projectId) setProjectId(fromUrl);
  }, [searchParams]);

  const setFilter = (v: string) => {
    setProjectId(v);
    if (v) {
      setSearchParams(prev => { prev.set('project_id', v); return prev; }, { replace: true });
    } else {
      setSearchParams(prev => { prev.delete('project_id'); return prev; }, { replace: true });
    }
  };

  return [projectId, setFilter];
}
