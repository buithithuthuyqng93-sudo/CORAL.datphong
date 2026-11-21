import { createClient } from '@supabase/supabase-js';

function cleanEnvValue(raw?: string): string {
  if (!raw) return '';
  return raw.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

/**
 * Normalizes a Supabase project URL so accidental dashboard URLs, subpaths (/rest/v1),
 * trailing slashes, or surrounding quotes never trigger "Invalid path specified in request URL".
 */
export function normalizeSupabaseUrl(raw?: string): string {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) return '';

  // Auto-convert pasted Supabase Dashboard URLs:
  // e.g. https://supabase.com/dashboard/project/<project_ref>/...
  const dashboardMatch = cleaned.match(
    /^https?:\/\/(?:app\.)?supabase\.(?:com|io)\/(?:dashboard\/)?project\/([a-z0-9]{10,40})/i
  );
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    // Reject bare marketing/dashboard domains without project ref
    if (/^(?:www\.|app\.)?supabase\.(?:com|io)$/i.test(parsed.hostname)) {
      return '';
    }
    // Strip any accidental subpath (e.g. /rest/v1, /auth/v1, /storage/v1)
    return parsed.origin;
  } catch {
    return '';
  }
}

function getSupabaseEnv() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseUrl = normalizeSupabaseUrl(rawUrl);
  const supabaseServiceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabasePublishableOrAnonKey = cleanEnvValue(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY
  );
  return { supabaseUrl, rawUrl: cleanEnvValue(rawUrl), supabaseServiceKey, supabasePublishableOrAnonKey };
}

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseServiceKey, supabasePublishableOrAnonKey } = getSupabaseEnv();
  return Boolean(supabaseUrl && (supabaseServiceKey || supabasePublishableOrAnonKey));
}

export function isServiceRoleConfigured(): boolean {
  const { supabaseUrl, supabaseServiceKey } = getSupabaseEnv();
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export function getSupabaseServerClient(preferAdmin = true) {
  const { supabaseUrl, supabaseServiceKey, supabasePublishableOrAnonKey } = getSupabaseEnv();
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL hoặc VITE_SUPABASE_URL chưa hợp lệ (phải có dạng https://<project-ref>.supabase.co)');
  }

  // If preferAdmin is requested and service key is available, use it (for webhooks / backend cron)
  // Otherwise, fallback safely to publishable/anon key for low-privilege read or connection test
  const key = (preferAdmin && supabaseServiceKey) ? supabaseServiceKey : (supabasePublishableOrAnonKey || supabaseServiceKey);
  if (!key) {
    throw new Error('SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SERVICE_ROLE_KEY is required');
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Actively checks live database connection with a real query.
 * Does NOT assume connected just because environment variables exist.
 */
export async function checkSupabaseLiveConnection(): Promise<{
  connected: boolean;
  isConfigured: boolean;
  latencyMs?: number;
  message: string;
  error?: string;
  tablesFound?: string[];
}> {
  const { rawUrl, supabaseUrl } = getSupabaseEnv();
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      isConfigured: false,
      message: rawUrl && !supabaseUrl
        ? 'URL Supabase chưa đúng định dạng API (cần dạng https://<project-ref>.supabase.co, không phải trang chủ supabase.com)'
        : 'Chưa cấu hình biến môi trường SUPABASE_URL (hoặc VITE_SUPABASE_URL) và Publishable/Anon Key',
    };
  }

  const start = Date.now();
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('homestay_settings')
      .select('id, property_name')
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      if (error.code === '42P01') {
        return {
          connected: true,
          isConfigured: true,
          latencyMs,
          message: 'Kết nối PostgreSQL Supabase thành công, nhưng bảng homestay_settings chưa được tạo (Cần chạy supabase_production_schema_FINAL.sql).',
          error: error.message,
        };
      }
      return {
        connected: false,
        isConfigured: true,
        latencyMs,
        message: 'Lỗi khi truy vấn cơ sở dữ liệu Supabase',
        error: error.message,
      };
    }

    return {
      connected: true,
      isConfigured: true,
      latencyMs,
      message: 'Kết nối cơ sở dữ liệu Supabase PostgreSQL thực tế thành công!',
      tablesFound: data ? ['homestay_settings'] : [],
    };
  } catch (err: any) {
    return {
      connected: false,
      isConfigured: true,
      latencyMs: Date.now() - start,
      message: 'Không thể kết nối đến máy chủ Supabase',
      error: err.message,
    };
  }
}
