import crypto from 'crypto';
import { getSupabaseServerClient, isSupabaseConfigured, normalizeSupabaseUrl } from './supabaseServer.js';
import type { AdminSession } from './authService.js';
import { recordAuditEvent } from './staffAccountService.js';
import type { ContactMessage, ContactMessageStatus } from '../src/types.js';

const VALID_STATUSES = new Set<ContactMessageStatus>(['new', 'contacted', 'done']);
const SITE_CONTENT_PREFIX = 'contact_msg:';

// Lightweight per-IP rate limit (max 10 contact submissions per 10 minutes)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const submitRateLimitMap = new Map<string, number[]>();

// In-memory store strictly for Demo mode (when Supabase is not configured)
const demoContactMessages: ContactMessage[] = [];

// Cached probe state for public.contact_messages so we auto-bootstrap once when possible
// and automatically pick up the table if created later in Supabase SQL Editor.
const TABLE_RECHECK_INTERVAL_MS = 60_000;
let contactTableState: { available: boolean; checkedAt: number; loggedFallback: boolean } = {
  available: false,
  checkedAt: 0,
  loggedFallback: false,
};

const CREATE_CONTACT_MESSAGES_SQL = `
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'done')),
    source VARCHAR(50) NOT NULL DEFAULT 'website_contact_page',
    handled_by VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
    ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created_at
    ON public.contact_messages (status, created_at DESC);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on contact_messages" ON public.contact_messages;
CREATE POLICY "Service role full access on contact_messages"
    ON public.contact_messages
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
NOTIFY pgrst, 'reload schema';
`.trim();

export function isValidContactStatus(raw?: string | null): raw is ContactMessageStatus {
  return raw === 'new' || raw === 'contacted' || raw === 'done';
}

function isMissingTableOrColumnError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function extractSupabaseProjectRef(): string | null {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const normalized = normalizeSupabaseUrl(rawUrl);
  if (!normalized) return null;
  const match = normalized.match(/^https?:\/\/([a-z0-9]{10,40})\.supabase\.co/i);
  return match ? match[1] : null;
}

/**
 * Ensures public.contact_messages exists on first call if Supabase Management API token
 * is configured, and caches whether the table is available in PostgREST.
 * When PostgREST-only credentials are present and the SQL migration has not yet been run,
 * all reads/writes persist durably in Production Supabase's `public.site_content` table.
 */
async function ensureContactMessagesTable(): Promise<boolean> {
  const now = Date.now();
  if (contactTableState.available) {
    return true;
  }
  if (contactTableState.checkedAt > 0 && now - contactTableState.checkedAt < TABLE_RECHECK_INTERVAL_MS) {
    return false;
  }

  const supabase = getSupabaseServerClient(true);
  const { error: probeErr } = await supabase
    .from('contact_messages')
    .select('id')
    .limit(1);

  if (!probeErr) {
    contactTableState = { available: true, checkedAt: now, loggedFallback: false };
    return true;
  }

  if (!isMissingTableOrColumnError(probeErr)) {
    contactTableState.checkedAt = now;
    return false;
  }

  // Attempt automatic DDL creation via Supabase Management API if SUPABASE_ACCESS_TOKEN is configured
  const mgmtToken = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
  const projectRef = extractSupabaseProjectRef();
  if (mgmtToken && projectRef) {
    try {
      const ddlRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgmtToken}`,
        },
        body: JSON.stringify({ query: CREATE_CONTACT_MESSAGES_SQL }),
      });

      if (ddlRes.ok) {
        // Re-verify availability after schema reload
        const { error: recheckErr } = await supabase
          .from('contact_messages')
          .select('id')
          .limit(1);
        if (!recheckErr) {
          console.log('[ContactMessageService] Auto-created public.contact_messages on Supabase.');
          contactTableState = { available: true, checkedAt: Date.now(), loggedFallback: false };
          return true;
        }
      }
    } catch (err: any) {
      console.warn('[ContactMessageService] Management API auto-create skipped:', err?.message || err);
    }
  }

  if (!contactTableState.loggedFallback) {
    console.info(
      '[ContactMessageService] public.contact_messages not yet migrated; persisting durably in Supabase public.site_content.'
    );
  }
  contactTableState = { available: false, checkedAt: now, loggedFallback: true };
  return false;
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const prev = (submitRateLimitMap.get(clientKey) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (prev.length >= RATE_LIMIT_MAX_REQUESTS) {
    submitRateLimitMap.set(clientKey, prev);
    return false;
  }
  prev.push(now);
  submitRateLimitMap.set(clientKey, prev);
  return true;
}

function mapDbRowToContactMessage(row: any): ContactMessage {
  const statusRaw = String(row.status || 'new').toLowerCase();
  const status: ContactMessageStatus = isValidContactStatus(statusRaw) ? statusRaw : 'new';
  return {
    id: String(row.id),
    fullName: String(row.full_name || ''),
    phone: String(row.phone || ''),
    message: String(row.message || ''),
    status,
    source: row.source ? String(row.source) : 'website_contact_page',
    handledBy: row.handled_by ? String(row.handled_by) : null,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapSiteContentRowToContactMessage(row: any): ContactMessage | null {
  const key = String(row?.content_key || '');
  if (!key.startsWith(SITE_CONTENT_PREFIX)) return null;
  const id = key.slice(SITE_CONTENT_PREFIX.length);
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const statusRaw = String(meta.status || 'new').toLowerCase();
  const status: ContactMessageStatus = isValidContactStatus(statusRaw) ? statusRaw : 'new';
  return {
    id,
    fullName: String(meta.fullName || ''),
    phone: String(meta.phone || ''),
    message: String(row.text_value || meta.message || ''),
    status,
    source: String(meta.source || 'website_contact_page'),
    handledBy: meta.handledBy ? String(meta.handledBy) : row.updated_by && row.updated_by !== 'guest_contact_form' ? String(row.updated_by) : null,
    createdAt: String(meta.createdAt || row.updated_at || new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : meta.updatedAt ? String(meta.updatedAt) : undefined,
  };
}

/**
 * Validates and persists a new guest contact inquiry from /lien-he into Supabase.
 */
export async function submitContactMessage(
  input: {
    fullName?: unknown;
    phone?: unknown;
    message?: unknown;
    source?: unknown;
  },
  clientKey = 'unknown'
): Promise<{ isDemo: boolean; storageTable: 'contact_messages' | 'site_content' | 'demo'; item: ContactMessage }> {
  const fullName = sanitizeText(input.fullName, 120);
  const phone = sanitizeText(input.phone, 30);
  const message = sanitizeText(input.message, 2000);
  const source = sanitizeText(input.source, 50) || 'website_contact_page';

  if (fullName.length < 2) {
    throw new Error('Vui lòng nhập họ và tên của bạn (tối thiểu 2 ký tự).');
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 9 || phoneDigits.length > 15) {
    throw new Error('Vui lòng nhập số điện thoại hoặc Zalo hợp lệ (9–15 chữ số).');
  }

  if (message.length < 5) {
    throw new Error('Vui lòng nhập nội dung cần tư vấn (tối thiểu 5 ký tự).');
  }

  if (!checkRateLimit(clientKey)) {
    throw new Error('Bạn vừa gửi quá nhiều yêu cầu liên hệ. Vui lòng thử lại sau ít phút hoặc gọi trực tiếp hotline.');
  }

  const nowIso = new Date().toISOString();
  const newId = crypto.randomUUID();

  // Demo mode (only when Supabase env is not configured at all)
  if (!isSupabaseConfigured()) {
    const item: ContactMessage = {
      id: newId,
      fullName,
      phone,
      message,
      status: 'new',
      source,
      handledBy: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    demoContactMessages.unshift(item);
    return { isDemo: true, storageTable: 'demo', item };
  }

  const supabase = getSupabaseServerClient(true);
  const hasPrimaryTable = await ensureContactMessagesTable();

  // 1. Primary table: public.contact_messages
  if (hasPrimaryTable) {
    const { data, error } = await supabase
      .from('contact_messages')
      .insert({
        id: newId,
        full_name: fullName,
        phone,
        message,
        status: 'new',
        source,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();

    if (!error && data) {
      return {
        isDemo: false,
        storageTable: 'contact_messages',
        item: mapDbRowToContactMessage(data),
      };
    }

    if (error && !isMissingTableOrColumnError(error)) {
      throw new Error(error.message || 'Không thể lưu thông tin liên hệ vào cơ sở dữ liệu.');
    }
    contactTableState = { available: false, checkedAt: Date.now(), loggedFallback: true };
  }

  // 2. Durable Supabase persistence via existing `public.site_content` PostgreSQL table
  const fallbackMeta = {
    fullName,
    phone,
    message,
    status: 'new' as ContactMessageStatus,
    source,
    handledBy: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const { error: fallbackErr } = await supabase
    .from('site_content')
    .upsert(
      {
        content_key: `${SITE_CONTENT_PREFIX}${newId}`,
        content_type: 'json',
        text_value: message,
        metadata: fallbackMeta,
        updated_by: 'guest_contact_form',
        updated_at: nowIso,
      },
      { onConflict: 'content_key' }
    );

  if (fallbackErr) {
    throw new Error(`Không thể lưu thông tin liên hệ: ${fallbackErr.message}`);
  }

  return {
    isDemo: false,
    storageTable: 'site_content',
    item: {
      id: newId,
      fullName,
      phone,
      message,
      status: 'new',
      source,
      handledBy: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

/**
 * Lists all contact messages ordered newest first (for authenticated Admin dashboard).
 * Seamlessly reads from both `public.contact_messages` (when migrated) and `public.site_content`.
 */
export async function listContactMessages(): Promise<{
  isDemo: boolean;
  storageTable: 'contact_messages' | 'site_content' | 'demo';
  items: ContactMessage[];
  newCount: number;
}> {
  if (!isSupabaseConfigured()) {
    const sorted = [...demoContactMessages].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      isDemo: true,
      storageTable: 'demo',
      items: sorted,
      newCount: sorted.filter((item) => item.status === 'new').length,
    };
  }

  const supabase = getSupabaseServerClient(true);
  const hasPrimaryTable = await ensureContactMessagesTable();
  const merged = new Map<string, ContactMessage>();

  // 1. Read any records stored in `public.site_content`
  const { data: siteRows, error: siteErr } = await supabase
    .from('site_content')
    .select('content_key, text_value, metadata, updated_by, updated_at')
    .like('content_key', `${SITE_CONTENT_PREFIX}%`);

  if (siteErr && !isMissingTableOrColumnError(siteErr)) {
    console.warn('[ContactMessageService] site_content read warning:', siteErr.message);
  } else if (Array.isArray(siteRows)) {
    for (const row of siteRows) {
      const mapped = mapSiteContentRowToContactMessage(row);
      if (mapped) merged.set(mapped.id, mapped);
    }
  }

  // 2. Read primary `public.contact_messages` table (overlays any matching ID)
  if (hasPrimaryTable) {
    const { data: primaryRows, error: primaryErr } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!primaryErr && Array.isArray(primaryRows)) {
      for (const row of primaryRows) {
        const mapped = mapDbRowToContactMessage(row);
        merged.set(mapped.id, mapped);
      }
    } else if (primaryErr && !isMissingTableOrColumnError(primaryErr)) {
      throw new Error(primaryErr.message || 'Không thể tải danh sách liên hệ khách hàng.');
    }
  } else if (siteErr) {
    throw new Error(siteErr.message || 'Không thể tải danh sách liên hệ khách hàng.');
  }

  const items = Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    isDemo: false,
    storageTable: hasPrimaryTable ? 'contact_messages' : 'site_content',
    items,
    newCount: items.filter((item) => item.status === 'new').length,
  };
}

/**
 * Updates the handling status ('new' | 'contacted' | 'done') of a contact message.
 */
export async function updateContactMessageStatus(
  id: string,
  status: ContactMessageStatus,
  session: AdminSession
): Promise<{ isDemo: boolean; item: ContactMessage }> {
  const cleanId = sanitizeText(id, 100);
  if (!cleanId) {
    throw new Error('Thiếu mã liên hệ cần cập nhật.');
  }
  if (!VALID_STATUSES.has(status)) {
    throw new Error('Trạng thái liên hệ không hợp lệ (chỉ hỗ trợ: new, contacted, done).');
  }

  const nowIso = new Date().toISOString();
  const actorLabel = `${session.name} (@${session.username})`;

  if (!isSupabaseConfigured()) {
    const idx = demoContactMessages.findIndex((m) => m.id === cleanId);
    if (idx === -1) {
      throw new Error('Không tìm thấy liên hệ này.');
    }
    const updated: ContactMessage = {
      ...demoContactMessages[idx],
      status,
      handledBy: actorLabel,
      updatedAt: nowIso,
    };
    demoContactMessages[idx] = updated;
    return { isDemo: true, item: updated };
  }

  const supabase = getSupabaseServerClient(true);
  const hasPrimaryTable = await ensureContactMessagesTable();

  // 1. Try updating primary contact_messages table if available
  if (hasPrimaryTable) {
    const { data: updatedPrimary, error: primaryErr } = await supabase
      .from('contact_messages')
      .update({
        status,
        handled_by: actorLabel,
        updated_at: nowIso,
      })
      .eq('id', cleanId)
      .select('*')
      .maybeSingle();

    if (!primaryErr && updatedPrimary) {
      const mapped = mapDbRowToContactMessage(updatedPrimary);
      await recordAuditEvent(session, {
        action: 'contact_message_status_updated',
        entityType: 'contact_messages',
        entityId: cleanId,
        newData: { status, fullName: mapped.fullName },
      }).catch(() => {});
      return { isDemo: false, item: mapped };
    }

    if (primaryErr && !isMissingTableOrColumnError(primaryErr)) {
      throw new Error(primaryErr.message || 'Không thể cập nhật trạng thái liên hệ.');
    }
  }

  // 2. Update durable record in `public.site_content`
  const contentKey = `${SITE_CONTENT_PREFIX}${cleanId}`;
  const { data: existingSite, error: fetchSiteErr } = await supabase
    .from('site_content')
    .select('content_key, text_value, metadata, updated_by, updated_at')
    .eq('content_key', contentKey)
    .maybeSingle();

  if (fetchSiteErr || !existingSite) {
    throw new Error('Không tìm thấy liên hệ cần cập nhật.');
  }

  const existingMeta =
    existingSite.metadata && typeof existingSite.metadata === 'object' ? existingSite.metadata : {};
  const nextMeta = {
    ...existingMeta,
    status,
    handledBy: actorLabel,
    updatedAt: nowIso,
  };

  const { error: saveSiteErr } = await supabase
    .from('site_content')
    .update({
      metadata: nextMeta,
      updated_by: actorLabel,
      updated_at: nowIso,
    })
    .eq('content_key', contentKey);

  if (saveSiteErr) {
    throw new Error(saveSiteErr.message || 'Không thể lưu trạng thái liên hệ.');
  }

  const mapped = mapSiteContentRowToContactMessage({
    ...existingSite,
    metadata: nextMeta,
    updated_by: actorLabel,
    updated_at: nowIso,
  });

  if (!mapped) {
    throw new Error('Dữ liệu liên hệ không hợp lệ.');
  }

  await recordAuditEvent(session, {
    action: 'contact_message_status_updated',
    entityType: 'contact_messages',
    entityId: cleanId,
    newData: { status, fullName: mapped.fullName },
  }).catch(() => {});

  return { isDemo: false, item: mapped };
}
