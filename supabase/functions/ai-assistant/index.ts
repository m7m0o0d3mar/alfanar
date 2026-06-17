// AI Assistant - Unified API for AI queries
// Deploy: supabase functions deploy ai-assistant --no-verify-jwt

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// LLM Provider agnostic - swap endpoint/token as needed
const LLM_ENDPOINT = Deno.env.get('LLM_ENDPOINT') || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const LLM_API_KEY = Deno.env.get('LLM_API_KEY') || '';

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { user_id, role, question, project_id } = await req.json();

  if (!question) {
    return new Response(JSON.stringify({ error: 'Question is required' }), { status: 400 });
  }

  // 1. Determine target module from question
  const moduleMap: Record<string, string[]> = {
    wir: ['wir', 'ncr', 'inspection', 'inspect', 'work request', 'quality'],
    rfi: ['rfi', 'technical', 'design', 'shop drawing', 'submittal'],
    hse: ['hse', 'safety', 'incident', 'accident', 'observation'],
    hr: ['hr', 'employee', 'attendance', 'payroll', 'salary', 'worker'],
    sales: ['sales', 'lead', 'customer', 'unit sale', 'payment', 'installment'],
    procurement: ['procurement', 'purchase', 'po', 'pr', 'supplier', 'inventory'],
    finance: ['finance', 'invoice', 'budget', 'cost', 'payment'],
    projects: ['project', 'progress', 'status', 'phase', 'kpi'],
  };

  let targetModules = ['projects'];
  const q = question.toLowerCase();
  for (const [mod, keywords] of Object.entries(moduleMap)) {
    if (keywords.some((kw) => q.includes(kw))) {
      targetModules = [mod];
      break;
    }
  }

  // 2. Fetch relevant data from Supabase (RLS enforced by user context)
  let contextData: Record<string, unknown> = {};

  if (targetModules.includes('wir')) {
    let query = supabase.from('work_requests').select('*').order('created_at', { ascending: false }).limit(20);
    if (project_id) query = query.eq('project_id', project_id);
    const { data } = await query;
    contextData.wir_summary = data || [];
  }

  if (targetModules.includes('projects')) {
    let query = supabase.from('projects').select('*');
    if (project_id) query = query.eq('id', project_id);
    const { data } = await query;
    contextData.projects = data || [];
  }

  if (targetModules.includes('rfi')) {
    let query = supabase.from('technical_tickets').select('*').limit(20);
    if (project_id) query = query.eq('project_id', project_id);
    const { data } = await query;
    contextData.rfis = data || [];
  }

  if (targetModules.includes('hr')) {
    const { data: emp } = await supabase.from('employees').select('count').limit(1);
    const { data: att } = await supabase.from('attendance').select('*').limit(10);
    contextData.employees_count = emp?.length || 0;
    contextData.recent_attendance = att || [];
  }

  if (targetModules.includes('sales')) {
    let q2 = supabase.from('unit_sales').select('*, customers(*), units(*)').limit(20);
    if (project_id) q2 = q2.eq('project_id', project_id);
    const { data } = await q2;
    contextData.sales = data || [];
  }

  // 3. Build prompt for LLM
  const systemPrompt = `You are an AI assistant for a Construction ERP system.
User role: ${role || 'unknown'}
Target module: ${targetModules.join(', ')}
Project context: ${project_id || 'all projects'}

Answer the user's question based ONLY on the provided data.
If data is insufficient, say so clearly.
Respond in the same language as the question (Arabic or English).
Keep answers concise and actionable.
Include specific numbers and statuses when available.`;

  const userPrompt = `Context Data:\n${JSON.stringify(contextData, null, 2)}\n\nUser Question: ${question}\n\nProvide a helpful, data-driven response.`;

  // 4. Call LLM (provider-agnostic)
  let answer = 'AI response unavailable. Please check LLM configuration.';

  try {
    const llmResponse = await fetch(LLM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': LLM_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`,
          }],
        }],
      }),
    });

    if (llmResponse.ok) {
      const llmData = await llmResponse.json();
      answer = llmData?.candidates?.[0]?.content?.parts?.[0]?.text || answer;
    }
  } catch (_err) {
    answer = '⚠️ AI service unavailable. Configure LLM_ENDPOINT and LLM_API_KEY.';
  }

  // 5. Log query
  await supabase.from('activity_log').insert({
    user_id,
    action: 'ai_query',
    module_code: targetModules[0],
    metadata: { question, targetModules, project_id },
  });

  return new Response(JSON.stringify({
    answer,
    target_modules: targetModules,
    context_size: JSON.stringify(contextData).length,
  }));
});
