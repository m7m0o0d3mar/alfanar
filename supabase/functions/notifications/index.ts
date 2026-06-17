// Notifications & Google Apps Script Webhook Target
// Deploy: supabase functions deploy notifications --no-verify-jwt

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { type, module_code, record_id, message } = await req.json();

  // Store notification
  const { data: notif } = await supabase
    .from('activity_log')
    .insert({
      action: `notification_${type}`,
      module_code,
      record_id,
      metadata: { type, message },
    })
    .select()
    .single();

  // Return data for Google Apps Script webhook to pick up
  return new Response(JSON.stringify({
    id: notif?.id,
    type,
    module_code,
    record_id,
    message,
    timestamp: new Date().toISOString(),
    // GAS webhook URL - set in environment
    webhook_url: Deno.env.get('GAS_WEBHOOK_URL') || null,
  }));
});
