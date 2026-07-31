import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and keys from environment
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && (supabaseServiceKey || supabaseAnonKey));
}

export function getSupabaseServerClient() {
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or VITE_SUPABASE_URL is required in environment variables');
  }

  // Prefer service role key on server side to bypass RLS for admin/webhook operations
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY is required');
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
