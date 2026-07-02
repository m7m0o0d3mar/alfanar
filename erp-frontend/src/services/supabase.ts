import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing VITE_SUPABASE_URL env var. Copy erp-frontend/.env.example to .env and fill in your values.');
if (!supabaseAnonKey) throw new Error('Missing VITE_SUPABASE_ANON_KEY env var. Copy erp-frontend/.env.example to .env and fill in your values.');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
