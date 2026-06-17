// WIR & NCR Management Edge Functions
// Deploy: supabase functions deploy wir --no-verify-jwt

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface WirInput {
  action: 'create' | 'submit' | 'inspect' | 'mark_ncr' | 'close_ncr' | 'list' | 'kpi';
  wir_id?: string;
  project_id?: string;
  unit_id?: string;
  contract_id?: string;
  task_id?: string;
  data?: Record<string, unknown>;
  user_id?: string;
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const input: WirInput = await req.json();
  const { action, wir_id, project_id, data, user_id } = input;

  const now = new Date().toISOString();

  switch (action) {
    case 'create': {
      const { data: wir, error } = await supabase
        .from('work_requests')
        .insert({
          project_id,
          unit_id: input.unit_id,
          contract_id: input.contract_id,
          task_id: input.task_id,
          wir_no: data?.wir_no || `WIR-${Date.now()}`,
          title_en: data?.title_en,
          title_ar: data?.title_ar,
          description: data?.description,
          requested_by: user_id,
          status: 'draft',
        })
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      return new Response(JSON.stringify(wir));
    }

    case 'submit': {
      // Validate no duplicate submission
      const { data: existing } = await supabase
        .from('work_requests')
        .select('status')
        .eq('id', wir_id)
        .single();
      if (!existing || existing.status !== 'draft') {
        return new Response(JSON.stringify({ error: 'WIR already submitted or not in draft' }), { status: 400 });
      }
      const { data: wir, error } = await supabase
        .from('work_requests')
        .update({ status: 'submitted', updated_at: now })
        .eq('id', wir_id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

      // Audit trail
      await supabase.from('audit_trail').insert({
        module_code: 'execution',
        record_id: wir_id,
        action: 'submitted',
        new_status: 'submitted',
        performed_by: user_id,
      });
      return new Response(JSON.stringify(wir));
    }

    case 'inspect': {
      const result = data?.result; // pass / fail / ncr
      const update: Record<string, unknown> = {
        status: result === 'pass' ? 'approved' : result === 'ncr' ? 'ncr' : 'rejected',
        inspected_by: user_id,
        updated_at: now,
      };
      if (result === 'ncr') {
        update.is_ncr = true;
        update.ncr_reason = data?.ncr_reason;
        update.rework_required = data?.rework_required || false;
      }
      const { data: wir, error } = await supabase
        .from('work_requests')
        .update(update)
        .eq('id', wir_id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

      await supabase.from('audit_trail').insert({
        module_code: 'execution',
        record_id: wir_id,
        action: 'status_changed',
        new_status: result === 'pass' ? 'approved' : 'ncr',
        changes: update,
        performed_by: user_id,
      });
      return new Response(JSON.stringify(wir));
    }

    case 'close_ncr': {
      const { data: wir, error } = await supabase
        .from('work_requests')
        .update({
          status: 'closed',
          rework_closed: true,
          updated_at: now,
        })
        .eq('id', wir_id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

      await supabase.from('audit_trail').insert({
        module_code: 'execution',
        record_id: wir_id,
        action: 'status_changed',
        new_status: 'closed',
        performed_by: user_id,
        comment: 'NCR closed after rework',
      });
      return new Response(JSON.stringify(wir));
    }

    case 'list': {
      let q = supabase.from('work_requests').select('*, work_request_lines(*)');
      if (project_id) q = q.eq('project_id', project_id);
      if (data?.status) q = q.eq('status', data.status);
      if (data?.is_ncr !== undefined) q = q.eq('is_ncr', data.is_ncr);
      q = q.order('created_at', { ascending: false }).limit(100);
      const { data: list } = await q;
      return new Response(JSON.stringify(list || []));
    }

    case 'kpi': {
      const pid = project_id;
      const [totalWir, ncrCount, openWir, approvedWir] = await Promise.all([
        supabase.from('work_requests').select('id', { count: 'exact', head: true }).eq('project_id', pid),
        supabase.from('work_requests').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('is_ncr', true),
        supabase.from('work_requests').select('id', { count: 'exact', head: true }).eq('project_id', pid).in('status', ['draft', 'submitted']),
        supabase.from('work_requests').select('id', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'approved'),
      ]);
      return new Response(JSON.stringify({
        total_wirs: totalWir.count || 0,
        ncr_count: ncrCount.count || 0,
        ncr_rate: totalWir.count ? (((ncrCount.count || 0) / totalWir.count) * 100).toFixed(1) : '0',
        open_wirs: openWir.count || 0,
        approved_wirs: approvedWir.count || 0,
        acceptance_rate: totalWir.count ? (((approvedWir.count || 0) / totalWir.count) * 100).toFixed(1) : '0',
      }));
    }

    default:
      return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  }
});
