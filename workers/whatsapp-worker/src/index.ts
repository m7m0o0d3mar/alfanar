import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  WHATSAPP_API_VERSION: string;
  WHATSAPP_BASE_URL: string;
  WHATSAPP_VERIFY_TOKEN: string;
}

interface WhatsAppAccount {
  id: string;
  user_id: string;
  phone_number: string;
  business_account_id?: string;
  access_token?: string;
  is_connected: boolean;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    try {
      switch (url.pathname) {
        case '/health':
          return new Response(JSON.stringify({ status: 'ok', service: 'erp-whatsapp-worker' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        case '/webhook': {
          if (request.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');

            if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
              return new Response(challenge, { status: 200, headers: corsHeaders });
            }
            return new Response('Verification failed', { status: 403, headers: corsHeaders });
          }

          if (request.method === 'POST') {
            const body = await request.json() as {
              object: string;
              entry: Array<{
                id: string;
                changes: Array<{
                  value: {
                    messaging_product: string;
                    metadata: { phone_number_id: string; display_phone_number: string };
                    messages?: Array<{
                      from: string;
                      id: string;
                      timestamp: string;
                      text?: { body: string };
                      type: string;
                    }>;
                    statuses?: Array<{
                      id: string;
                      status: string;
                      timestamp: string;
                      recipient_id: string;
                    }>;
                  };
                  field: string;
                }>;
              }>;
            };

            if (body.object === 'whatsapp_business_account') {
              for (const entry of body.entry) {
                for (const change of entry.changes) {
                  const value = change.value;

                  if (value.messages) {
                    for (const msg of value.messages) {
                      const phoneNumberId = value.metadata.phone_number_id;

                      const { data: accounts } = await supabase
                        .from('user_whatsapp_accounts')
                        .select('*')
                        .eq('phone_number', value.metadata.display_phone_number)
                        .limit(1);

                      const account = accounts?.[0];
                      if (!account) continue;

                      await supabase.from('whatsapp_messages').insert({
                        account_id: account.id,
                        direction: 'inbound',
                        from_number: msg.from,
                        to_number: value.metadata.display_phone_number,
                        body: msg.text?.body || '',
                        message_type: msg.type || 'text',
                        wa_message_id: msg.id,
                        status: 'received',
                        received_at: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
                        is_read: false,
                      });

                      await supabase.from('crm_whatsapp_messages').insert({
                        phone_number: msg.from,
                        direction: 'inbound',
                        message_body: msg.text?.body || '',
                        status: 'received',
                        source: 'whatsapp_webhook',
                      });
                    }
                  }

                  if (value.statuses) {
                    for (const status of value.statuses) {
                      await supabase
                        .from('whatsapp_messages')
                        .update({
                          status: status.status,
                          delivered_at: status.status === 'delivered' ? new Date(parseInt(status.timestamp) * 1000).toISOString() : undefined,
                          read_at: status.status === 'read' ? new Date(parseInt(status.timestamp) * 1000).toISOString() : undefined,
                        })
                        .eq('wa_message_id', status.id);
                    }
                  }
                }
              }
            }

            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        case '/send': {
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405, headers: corsHeaders });
          }

          const body = await request.json() as {
            accountId: string;
            to: string;
            text: string;
            messageId?: string;
          };

          const { data: account } = await supabase
            .from('user_whatsapp_accounts')
            .select('*')
            .eq('id', body.accountId)
            .single<WhatsAppAccount>();

          if (!account || !account.access_token || !account.business_account_id) {
            return new Response(JSON.stringify({ error: 'WhatsApp account not configured for sending' }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          try {
            const waResponse = await fetch(
              `${env.WHATSAPP_BASE_URL}/${env.WHATSAPP_API_VERSION}/${account.business_account_id}/messages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${account.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: body.to,
                  type: 'text',
                  text: { body: body.text },
                }),
              }
            );

            const waData = await waResponse.json();

            if (!waResponse.ok) {
              return new Response(JSON.stringify({ error: waData }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            const waMessageId = waData.messages?.[0]?.id;

            if (body.messageId) {
              await supabase
                .from('whatsapp_messages')
                .update({
                  status: 'sent',
                  wa_message_id: waMessageId,
                  sent_at: new Date().toISOString(),
                })
                .eq('id', body.messageId);
            }

            return new Response(JSON.stringify({ success: true, waMessageId }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (sendErr: any) {
            return new Response(JSON.stringify({ error: sendErr.message || 'Send failed' }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        default:
          return new Response('Not found', { status: 404, headers: corsHeaders });
      }
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
} satisfies ExportedHandler<Env>;
