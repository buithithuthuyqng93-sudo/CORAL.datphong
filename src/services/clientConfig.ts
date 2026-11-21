/**
 * Client Configuration Helper
 * Strictly restricted to client-safe, public environment variables.
 * Under NO circumstances does this file access, import, or bundle SUPABASE_SERVICE_ROLE_KEY or any server secrets.
 */

function cleanClientEnv(raw?: string): string {
  return (raw || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function normalizeClientSupabaseUrl(raw?: string): string {
  const cleaned = cleanClientEnv(raw);
  if (!cleaned) return '';

  const dashboardMatch = cleaned.match(
    /^https?:\/\/(?:app\.)?supabase\.(?:com|io)\/(?:dashboard\/)?project\/([a-z0-9]{10,40})/i
  );
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (/^(?:www\.|app\.)?supabase\.(?:com|io)$/i.test(parsed.hostname)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function isClientSupabaseConfigured(): boolean {
  // Support both modern Supabase Publishable Key (sb_publishable_...) and legacy anon key (eyJ...)
  const url = normalizeClientSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
  const publishableKey = cleanClientEnv(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  return Boolean(url && publishableKey);
}

export function getClientSupabaseConfig(): {
  url: string;
  hasKey: boolean;
  keyType: 'publishable' | 'anon' | 'none';
  isConfigured: boolean;
} {
  const url = normalizeClientSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
  const pubKey = cleanClientEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const anonKey = cleanClientEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

  if (!url || (!pubKey && !anonKey)) {
    return {
      url: '',
      hasKey: false,
      keyType: 'none',
      isConfigured: false,
    };
  }

  return {
    url,
    hasKey: true,
    keyType: pubKey ? 'publishable' : 'anon',
    isConfigured: true,
  };
}
