// KPI Engine - Generic KPI computation
// Deploy: supabase functions deploy kpi-engine --no-verify-jwt

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { module_code, project_id, period } = await req.json();

  if (!module_code) {
    return new Response(JSON.stringify({ error: 'module_code required' }), { status: 400 });
  }

  // Get all active KPIs for this module
  const { data: kpis } = await supabase
    .from('kpi_definitions')
    .select('*')
    .eq('module_code', module_code)
    .eq('is_active', true);

  if (!kpis || kpis.length === 0) {
    return new Response(JSON.stringify({ kpis: [] }));
  }

  const results = [];

  for (const kpi of kpis) {
    try {
      let value = 0;
      const cfg = kpi.config_json || {};
      const table = cfg.table || `${module_code}`;

      switch (kpi.formula_type) {
        case 'count': {
          let q = supabase.from(table as string).select('id', { count: 'exact', head: true });
          if (project_id) q = q.eq('project_id', project_id);
          if (cfg.filter) {
            Object.entries(cfg.filter as Record<string, unknown>).forEach(([k, v]) => {
              q = q.eq(k, v);
            });
          }
          const { count } = await q;
          value = count || 0;
          break;
        }

        case 'sum': {
          let q = supabase.from(table as string).select(cfg.field as string);
          if (project_id) q = q.eq('project_id', project_id);
          const { data: rows } = await q;
          value = (rows || []).reduce((acc: number, r: Record<string, unknown>) =>
            acc + (Number(r[cfg.field as string]) || 0), 0);
          break;
        }

        case 'ratio': {
          const { data: numRows } = await supabase
            .from(table as string)
            .select(cfg.numerator_field as string);
          const { data: denomRows } = await supabase
            .from(table as string)
            .select(cfg.denominator_field as string);
          const num = (numRows || []).reduce((a: number, r: Record<string, unknown>) =>
            a + (Number(r[cfg.numerator_field as string]) || 0), 0);
          const den = (denomRows || []).reduce((a: number, r: Record<string, unknown>) =>
            a + (Number(r[cfg.denominator_field as string]) || 0), 0);
          value = den ? (num / den) * 100 : 0;
          break;
        }

        case 'avg_duration': {
          let q = supabase.from(table as string).select(`${cfg.start_field}, ${cfg.end_field}`);
          if (project_id) q = q.eq('project_id', project_id);
          if (cfg.filter) {
            Object.entries(cfg.filter as Record<string, unknown>).forEach(([k, v]) => {
              q = q.eq(k, v);
            });
          }
          const { data: rows } = await q;
          const durations = (rows || [])
            .map((r: Record<string, unknown>) => {
              const start = new Date(r[cfg.start_field as string] as string);
              const end = new Date(r[cfg.end_field as string] as string);
              return end.getTime() - start.getTime();
            })
            .filter((d: number) => !isNaN(d));
          value = durations.length
            ? (durations.reduce((a: number, b: number) => a + b, 0) / durations.length) / (1000 * 60 * 60 * 24)
            : 0;
          break;
        }

        case 'custom':
          value = cfg.static_value || 0;
          break;
      }

      // Store KPI log
      const periodDate = period || new Date().toISOString().slice(0, 10);
      await supabase.from('kpi_logs').insert({
        kpi_id: kpi.id,
        value: Math.round(value * 100) / 100,
        period: periodDate,
        context_id: project_id || null,
      });

      results.push({
        kpi_id: kpi.id,
        code: kpi.code,
        name_en: kpi.name_en,
        name_ar: kpi.name_ar,
        value: Math.round(value * 100) / 100,
        unit: kpi.unit,
        target: kpi.target_value,
        formula_type: kpi.formula_type,
      });
    } catch (err) {
      results.push({
        kpi_id: kpi.id,
        code: kpi.code,
        error: (err as Error).message,
      });
    }
  }

  return new Response(JSON.stringify({ kpis: results }));
});
