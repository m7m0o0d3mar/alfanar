import { supabase } from './supabase';

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export interface AiResponse {
  answer: string;
  target_modules: string[];
  context_size: number;
}

export async function askAi(question: string, project_id?: string): Promise<AiResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  const session = await supabase.auth.getSession();

  const res = await fetch(AI_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.data?.session?.access_token || ''}`,
    },
    body: JSON.stringify({
      user_id: user?.id,
      role: user?.user_metadata?.role || 'user',
      question,
      project_id,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'AI request failed');
  }

  return res.json();
}
