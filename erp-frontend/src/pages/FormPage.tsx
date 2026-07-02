import { useParams, useSearchParams } from 'react-router-dom';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import { useT } from '../hooks/useTranslation';
import { ArrowLeft } from 'lucide-react';

export default function FormPage() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const t = useT();

  if (!code) return <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>No form code specified</div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-sm btn-secondary" onClick={() => window.history.back()}>
          <ArrowLeft size={14} /> {t('common.back')}
        </button>
        <h1 className="text-xl font-bold">{t('form_builder.title')}: {code}</h1>
      </div>
      <div className="card p-6">
        <DynamicFormRenderer
          formCode={code}
          projectId={searchParams.get('project_id') || undefined}
          onSuccess={() => {
            window.history.back();
          }}
          onCancel={() => { window.history.back(); }}
        />
      </div>
    </div>
  );
}
