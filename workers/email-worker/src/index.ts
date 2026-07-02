import { createClient } from '@supabase/supabase-js';

interface Env {
  EMAIL: SendEmail;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  display_name?: string;
  provider: string;
  is_verified: boolean;
}

interface EmailMessage {
  id: string;
  account_id: string;
  folder: string;
  subject: string;
  body_html?: string;
  body_text?: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  cc_emails?: string[];
  bcc_emails?: string[];
  status: string;
  sent_at?: string;
  received_at?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || 'https://alfanar-erp.pages.dev';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    try {
      switch (url.pathname) {
        case '/health':
          return new Response(JSON.stringify({ status: 'ok', service: 'erp-email-worker' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        case '/send': {
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405, headers: corsHeaders });
          }
          const body = await request.json() as {
            messageId: string;
            accountId: string;
            to: string[];
            cc?: string[];
            bcc?: string[];
            subject: string;
            html?: string;
            text?: string;
            attachments?: { filename: string; content: string; type: string }[];
          };

          const { data: account } = await supabase
            .from('email_accounts')
            .select('*')
            .eq('id', body.accountId)
            .single<EmailAccount>();

          if (!account) {
            return new Response(JSON.stringify({ error: 'Account not found' }), {
              status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          let sendResponse;
          try {
            sendResponse = await env.EMAIL.send({
              from: { email: account.email, name: account.display_name || account.email },
              to: body.to,
              cc: body.cc,
              bcc: body.bcc,
              subject: body.subject,
              html: body.html || body.text || '',
              text: body.text || body.html?.replace(/<[^>]*>/g, '') || '',
              attachments: body.attachments?.map(a => ({
                filename: a.filename,
                content: a.content,
                type: a.type,
                disposition: 'attachment' as const,
              })),
            });

            await supabase
              .from('email_messages')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                message_id: sendResponse.messageId,
              })
              .eq('id', body.messageId);

            return new Response(JSON.stringify({ success: true, messageId: sendResponse.messageId }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (sendErr: any) {
            await supabase
              .from('email_messages')
              .update({ status: 'failed', error_message: sendErr.message || 'Send failed' })
              .eq('id', body.messageId);

            return new Response(JSON.stringify({ error: sendErr.message || 'Send failed' }), {
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        case '/webhook/inbound': {
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405, headers: corsHeaders });
          }
          const emailData = await request.json() as {
            from: string;
            to: string;
            subject: string;
            html?: string;
            text?: string;
            received_at: string;
          };

          const { data: accounts } = await supabase
            .from('email_accounts')
            .select('*')
            .or(`email.eq.${emailData.to},email.eq.${emailData.from}`)
            .limit(1);

          const targetAccount = accounts?.[0];
          if (!targetAccount) {
            return new Response(JSON.stringify({ error: 'No matching account' }), {
              status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          await supabase.from('email_messages').insert({
            account_id: targetAccount.id,
            folder: 'inbox',
            subject: emailData.subject,
            body_html: emailData.html || null,
            body_text: emailData.text || null,
            from_email: emailData.from,
            to_emails: [emailData.to],
            status: 'received',
            received_at: emailData.received_at || new Date().toISOString(),
          });

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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

  async email(message: EmailMessage, env: Env) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const raw = await new Response(message.raw).text();

    const { data: accounts } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('email', message.to)
      .limit(1);

    const account = accounts?.[0];
    if (!account) return;

    await supabase.from('email_messages').insert({
      account_id: account.id,
      folder: 'inbox',
      subject: message.headers.get('subject') || '(No Subject)',
      body_html: raw,
      from_email: message.from,
      to_emails: [message.to],
      status: 'received',
      received_at: new Date().toISOString(),
    });
  },
} satisfies ExportedHandler<Env>;
