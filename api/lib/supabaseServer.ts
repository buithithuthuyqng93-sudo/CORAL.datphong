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
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      isConfigured: false,
      message: 'Chưa cấu hình biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY',
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
          message: 'Kết nối PostgreSQL Supabase thành công, nhưng bảng homestay_settings chưa được tạo (Cần chạy migration).',
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
