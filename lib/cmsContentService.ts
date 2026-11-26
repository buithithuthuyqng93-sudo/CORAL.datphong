import { getSupabaseServerClient, isSupabaseConfigured } from './supabaseServer.js';
import type { AdminSession } from './authService.js';
import { recordAuditEvent } from './staffAccountService.js';
import { CORAL_ROOM_TYPES } from '../src/data/mockData.js';
import { EXPERIENCE_SERVICES_SEED } from '../src/data/serviceCatalog.js';
import type { CmsContentItem, CmsContentType, RoomType } from '../src/types.js';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

// In-memory store strictly for Demo mode (when Supabase is not configured)
let demoCmsStore: Record<CmsContentType, CmsContentItem[]> | null = null;

export function isValidContentType(raw?: string | null): raw is CmsContentType {
  return raw === 'room' || raw === 'service';
}

export function slugifyText(input: string, fallbackId: string): string {
  const normalized = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return normalized || fallbackId.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

/**
 * Validates image URLs so unsafe schemes (javascript:, vbscript:, data:text/html) are rejected.
 */
export function isSafeImageUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//') && !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function dedupeImages(primary?: string | null, gallery?: unknown): string[] {
  const result: string[] = [];
  const pushIfValid = (url: unknown) => {
    if (typeof url !== 'string') return;
    const clean = url.trim();
    if (!clean) return;
    if (!isSafeImageUrl(clean) && !clean.startsWith('data:image/')) return;
    if (!result.includes(clean)) result.push(clean);
  };

  pushIfValid(primary);
  if (Array.isArray(gallery)) {
    for (const item of gallery) {
      pushIfValid(item);
    }
  }
  return result;
}

function normalizeAmenities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0 && item.length <= 200);
}

function inferHasBalcony(sizeStr?: string, desc?: string, amenities?: string[]): boolean {
  const combined = `${sizeStr || ''} ${desc || ''} ${(amenities || []).join(' ')}`.toLowerCase();
  if (combined.includes('không ban công') || combined.includes('khong ban cong')) return false;
  if (combined.includes('ban công') || combined.includes('ban cong') || combined.includes('sân thượng') || combined.includes('terrace')) {
    return true;
  }
  return true;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

/**
 * Converts a generic CMS room item into the unified RoomType shape consumed by
 * SeagullWebsite, BookingPortal, and AdminManager.
 */
export function cmsItemToRoomType(item: CmsContentItem): RoomType {
  const attrs = item.attributes || {};
  const images = dedupeImages(item.images?.[0], item.images);
  const coverImage = images[0] || '/images/bungalow-cliff-day.jpg';
  const amenities = normalizeAmenities(attrs.amenities);
  const size = String(attrs.size || attrs.areaSqm || '21m²').trim() || '21m²';
  const bedrooms = clampNumber(attrs.bedrooms, 1, 0, 20);
  const bathrooms = clampNumber(attrs.bathrooms, 1, 0, 20);
  const hasBalcony =
    typeof attrs.hasBalcony === 'boolean'
      ? attrs.hasBalcony
      : inferHasBalcony(size, item.description, amenities);
  const depositPercent = clampNumber(attrs.depositPercent, 30, 0, 100);
  const maxGuests = clampNumber(attrs.maxGuests, 2, 1, 30);
  const bedType = String(attrs.bedType || '1 Giường King Mái Vòm').trim() || '1 Giường King Mái Vòm';

  return {
    id: item.id,
    slug: item.slug,
    name: item.title,
    description: item.description,
    basePrice: Math.max(0, Math.round(Number(item.price) || 0)),
    depositPercent,
    maxGuests,
    image: coverImage,
    galleryImages: images,
    size,
    bedrooms,
    bathrooms,
    hasBalcony,
    bedType,
    amenities,
    active: item.active !== false,
    attributes: {
      ...attrs,
      size,
      areaSqm: size,
      bedrooms,
      bathrooms,
      hasBalcony,
      bedType,
      maxGuests,
      depositPercent,
      amenities,
    },
  };
}

/**
 * Maps a Supabase `room_types` row + optional extended CMS metadata into a generic CmsContentItem.
 */
function mapDbRoomRowToCmsItem(
  row: any,
  extendedMeta?: Record<string, any> | null
): CmsContentItem {
  const extAttrs =
    (extendedMeta?.attributes && typeof extendedMeta.attributes === 'object'
      ? extendedMeta.attributes
      : null) ||
    (row.attributes && typeof row.attributes === 'object' ? row.attributes : null) ||
    {};

  const rowAmenities = normalizeAmenities(row.amenities);
  const amenities =
    rowAmenities.length > 0 ? rowAmenities : normalizeAmenities(extAttrs.amenities);

  const rowImages = dedupeImages(row.image, row.gallery_images);
  const extImages = dedupeImages(extendedMeta?.images?.[0], extendedMeta?.images);
  const images = rowImages.length > 0 ? rowImages : extImages;

  const size = String(row.size_sqm || extAttrs.size || extAttrs.areaSqm || '21m²').trim();
  const bedrooms = clampNumber(extAttrs.bedrooms, 1, 0, 20);
  const bathrooms = clampNumber(extAttrs.bathrooms, 1, 0, 20);
  const hasBalcony =
    typeof extAttrs.hasBalcony === 'boolean'
      ? extAttrs.hasBalcony
      : inferHasBalcony(size, row.description, amenities);
  const depositPercent = clampNumber(
    row.deposit_value ?? extAttrs.depositPercent,
    30,
    0,
    100
  );
  const maxGuests = clampNumber(row.capacity_adults ?? extAttrs.maxGuests, 2, 1, 30);
  const bedType = String(row.bed_type || extAttrs.bedType || '1 Giường King Mái Vòm').trim();

  return {
    id: String(row.id),
    contentType: 'room',
    title: String(row.name || ''),
    slug: String(row.slug || slugifyText(row.name || '', row.id)),
    description: String(row.description || ''),
    price: Math.max(0, Math.round(Number(row.base_price) || 0)),
    images: images.length > 0 ? images : ['/images/bungalow-cliff-day.jpg'],
    attributes: {
      ...extAttrs,
      size,
      areaSqm: size,
      bedrooms,
      bathrooms,
      hasBalcony,
      bedType,
      maxGuests,
      depositPercent,
      amenities,
    },
    sortOrder: Number.isFinite(Number(extendedMeta?.sortOrder))
      ? Number(extendedMeta?.sortOrder)
      : undefined,
    active: row.active !== false,
    updatedAt: row.updated_at || extendedMeta?.updatedAt || undefined,
    updatedBy: extendedMeta?.updatedBy || undefined,
  };
}

function getDemoCmsStore(): Record<CmsContentType, CmsContentItem[]> {
  if (!demoCmsStore) {
    const roomItems: CmsContentItem[] = CORAL_ROOM_TYPES.map((rt, idx) => ({
      id: rt.id,
      contentType: 'room',
      title: rt.name,
      slug: slugifyText(rt.name, rt.id),
      description: rt.description,
      price: rt.basePrice,
      images: dedupeImages(rt.image, rt.galleryImages),
      attributes: {
        size: rt.size,
        areaSqm: rt.size,
        bedrooms: rt.bedrooms ?? 1,
        bathrooms: rt.bathrooms ?? 1,
        hasBalcony: rt.hasBalcony ?? inferHasBalcony(rt.size, rt.description, rt.amenities),
        bedType: rt.bedType,
        maxGuests: rt.maxGuests,
        depositPercent: rt.depositPercent ?? 30,
        amenities: rt.amenities,
      },
      sortOrder: idx + 1,
      active: rt.id !== 'type-home5-heritage',
      updatedAt: new Date().toISOString(),
    }));

    const serviceItems: CmsContentItem[] = EXPERIENCE_SERVICES_SEED.map((svc, idx) => ({
      ...svc,
      images: dedupeImages(svc.images?.[0], svc.images).slice(0, 3),
      attributes: { ...(svc.attributes || {}) },
      sortOrder: svc.sortOrder ?? idx + 1,
      active: svc.active !== false,
      updatedAt: new Date().toISOString(),
    }));

    demoCmsStore = {
      room: roomItems,
      service: serviceItems,
    };
  }
  return demoCmsStore;
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

/**
 * Loads extended CMS metadata maps for a content type from `cms_contents` (if deployed)
 * and `site_content` (`cms:<contentType>:<id>`) so live Supabase works seamlessly
 * even before optional schema upgrades are executed.
 */
async function loadExtendedCmsMap(contentType: CmsContentType): Promise<Map<string, any>> {
  const supabase = getSupabaseServerClient();
  const prefix = `cms:${contentType}:`;
  const result = new Map<string, any>();

  // 1. Read from `site_content` fallback store (guaranteed present in production schema)
  const { data: siteRows, error: siteErr } = await supabase
    .from('site_content')
    .select('content_key, text_value, metadata, updated_by, updated_at')
    .like('content_key', `${prefix}%`);

  if (!siteErr && Array.isArray(siteRows)) {
    for (const row of siteRows) {
      const id = String(row.content_key || '').slice(prefix.length);
      if (!id) continue;
      const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      result.set(id, {
        ...meta,
        id,
        contentType,
        updatedBy: row.updated_by || meta.updatedBy,
        updatedAt: row.updated_at || meta.updatedAt,
      });
    }
  }

  // 2. Overlay from dedicated `cms_contents` table if present
  const { data: cmsRows, error: cmsErr } = await supabase
    .from('cms_contents')
    .select('*')
    .eq('content_type', contentType);

  if (!cmsErr && Array.isArray(cmsRows)) {
    for (const row of cmsRows) {
      result.set(String(row.id), {
        id: String(row.id),
        contentType,
        title: row.title,
        slug: row.slug,
        description: row.description,
        price: Number(row.price) || 0,
        images: Array.isArray(row.images) ? row.images : [],
        attributes: row.attributes && typeof row.attributes === 'object' ? row.attributes : {},
        sortOrder: row.sort_order,
        active: row.active !== false,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
      });
    }
  } else if (cmsErr && !isMissingTableOrColumnError(cmsErr)) {
    console.warn('[CMS Service] cms_contents query warning:', cmsErr.message);
  }

  return result;
}

/**
 * Lists CMS items generically for `'room' | 'service'`.
 * For `'room'`, also returns `roomTypes` mapped from the exact same live records.
 */
export async function listCmsContent(
  contentType: CmsContentType,
  options?: { includeInactive?: boolean }
): Promise<{
  isDemo: boolean;
  contentType: CmsContentType;
  items: CmsContentItem[];
  roomTypes?: RoomType[];
}> {
  const includeInactive = Boolean(options?.includeInactive);

  if (!isSupabaseConfigured()) {
    const store = getDemoCmsStore();
    const items = store[contentType].filter((item) => includeInactive || item.active !== false);
    return {
      isDemo: true,
      contentType,
      items,
      ...(contentType === 'room' ? { roomTypes: items.map(cmsItemToRoomType) } : {}),
    };
  }

  const supabase = getSupabaseServerClient();

  if (contentType === 'room') {
    let query = supabase.from('room_types').select('*').order('id', { ascending: true });
    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const [{ data: roomRows, error: roomErr }, extendedMap] = await Promise.all([
      query,
      loadExtendedCmsMap('room'),
    ]);

    if (roomErr) {
      throw new Error(`Không thể tải danh sách hạng phòng từ database: ${roomErr.message}`);
    }

    const items = (roomRows || []).map((row: any) =>
      mapDbRoomRowToCmsItem(row, extendedMap.get(String(row.id)) || null)
    );

    items.sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });

    return {
      isDemo: false,
      contentType: 'room',
      items,
      roomTypes: items.map(cmsItemToRoomType),
    };
  }

  // Generic `'service'` (or future CMS content types) path
  const extendedMap = await loadExtendedCmsMap(contentType);
  const itemsById = new Map<string, CmsContentItem>();

  // Start with the 5 Experience Services seed so /dich-vu and Admin > Quản lý Dịch vụ
  // always have complete records ready to edit even before the first Admin save.
  if (contentType === 'service') {
    for (const seed of EXPERIENCE_SERVICES_SEED) {
      itemsById.set(seed.id, {
        ...seed,
        images: dedupeImages(seed.images?.[0], seed.images).slice(0, 3),
        attributes: { ...(seed.attributes || {}) },
      });
    }
  }

  for (const [, raw] of extendedMap.entries()) {
    const fallbackSeed = itemsById.get(String(raw.id));
    const parsedImages = dedupeImages(raw.images?.[0], raw.images);
    const mergedImages =
      parsedImages.length > 0
        ? (contentType === 'service' ? parsedImages.slice(0, 3) : parsedImages)
        : (fallbackSeed?.images || []);

    const item: CmsContentItem = {
      id: String(raw.id),
      contentType,
      title: String(raw.title || fallbackSeed?.title || ''),
      slug: String(raw.slug || fallbackSeed?.slug || slugifyText(raw.title || '', raw.id)),
      description: String(raw.description ?? fallbackSeed?.description ?? ''),
      price: Math.max(0, Math.round(Number(raw.price ?? fallbackSeed?.price ?? 0) || 0)),
      images: mergedImages,
      attributes: {
        ...(fallbackSeed?.attributes || {}),
        ...(raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : {}),
      },
      sortOrder: Number.isFinite(Number(raw.sortOrder))
        ? Number(raw.sortOrder)
        : fallbackSeed?.sortOrder,
      active: raw.active !== false,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
    };
    itemsById.set(item.id, item);
  }

  const items = Array.from(itemsById.values()).filter((item) => includeInactive || item.active !== false);
  items.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.id.localeCompare(b.id));

  return {
    isDemo: false,
    contentType,
    items,
  };
}

export interface SaveCmsContentInput {
  id: string;
  contentType: CmsContentType;
  title: string;
  slug?: string;
  description: string;
  price: number;
  images: string[];
  attributes?: Record<string, any>;
  sortOrder?: number;
  active?: boolean;
}

/**
 * Saves/updates a generic CMS item (`'room' | 'service'`).
 * For `'room'`, atomically updates `public.room_types` (so `/booking` & `/api/availability`
 * get updated price, deposit %, images, description immediately) AND persists extended CMS
 * attributes (`bedrooms`, `bathrooms`, `hasBalcony`, etc.) to `site_content` + `cms_contents`.
 */
export async function saveCmsContent(
  input: SaveCmsContentInput,
  actor: AdminSession
): Promise<{
  isDemo: boolean;
  item: CmsContentItem;
  roomType?: RoomType;
}> {
  if (!isValidContentType(input.contentType)) {
    throw new Error('Loại nội dung CMS không hợp lệ (chỉ hỗ trợ room hoặc service).');
  }

  const cleanId = String(input.id || '').trim();
  if (!cleanId || !/^[a-zA-Z0-9_-]{2,64}$/.test(cleanId)) {
    throw new Error('Mã định danh nội dung không hợp lệ.');
  }

  const title = String(input.title || '').trim();
  if (title.length < 2 || title.length > 255) {
    throw new Error('Tiêu đề phải từ 2 đến 255 ký tự.');
  }

  const description = String(input.description || '').trim();
  if (description.length > 5000) {
    throw new Error('Mô tả vượt quá giới hạn 5.000 ký tự.');
  }

  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price < 0 || price > 500_000_000) {
    throw new Error('Giá bán không hợp lệ (phải là số >= 0).');
  }

  const rawImages = Array.isArray(input.images) ? input.images : [];
  const validImages = dedupeImages(rawImages[0], rawImages);
  if (rawImages.length > 0 && validImages.length === 0) {
    throw new Error('Đường dẫn hình ảnh không hợp lệ.');
  }

  const rawAttrs = input.attributes && typeof input.attributes === 'object' ? input.attributes : {};
  const nowIso = new Date().toISOString();
  const slug = slugifyText(input.slug || title, cleanId);
  const active = input.active !== false;

  // Normalize room-specific attributes when contentType === 'room'
  let normalizedAttributes: Record<string, any> = { ...rawAttrs };
  if (input.contentType === 'room') {
    const size = String(rawAttrs.size || rawAttrs.areaSqm || '21m²').trim().slice(0, 50) || '21m²';
    const bedrooms = Math.round(clampNumber(rawAttrs.bedrooms, 1, 0, 20));
    const bathrooms = Math.round(clampNumber(rawAttrs.bathrooms, 1, 0, 20));
    const hasBalcony = Boolean(rawAttrs.hasBalcony);
    const depositPercent = Math.round(clampNumber(rawAttrs.depositPercent, 30, 0, 100));
    const maxGuests = Math.round(clampNumber(rawAttrs.maxGuests, 2, 1, 30));
    const bedType =
      String(rawAttrs.bedType || '1 Giường King Mái Vòm').trim().slice(0, 100) ||
      '1 Giường King Mái Vòm';
    const amenities = normalizeAmenities(rawAttrs.amenities);

    normalizedAttributes = {
      ...rawAttrs,
      size,
      areaSqm: size,
      bedrooms,
      bathrooms,
      hasBalcony,
      depositPercent,
      maxGuests,
      bedType,
      amenities,
    };
  }

  const finalImages =
    validImages.length > 0
      ? (input.contentType === 'service' ? validImages.slice(0, 3) : validImages)
      : [input.contentType === 'service' ? '/assets/services/tour-tham-quan-dao.jpg' : '/images/bungalow-cliff-day.jpg'];

  const savedItem: CmsContentItem = {
    id: cleanId,
    contentType: input.contentType,
    title,
    slug,
    description,
    price,
    images: finalImages,
    attributes: normalizedAttributes,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : undefined,
    active,
    updatedAt: nowIso,
    updatedBy: actor.username,
  };

  if (!isSupabaseConfigured()) {
    const store = getDemoCmsStore();
    const list = store[input.contentType];
    const existingIdx = list.findIndex((x) => x.id === cleanId);
    const previousData = existingIdx >= 0 ? list[existingIdx] : null;
    if (existingIdx >= 0) {
      list[existingIdx] = savedItem;
    } else {
      list.push(savedItem);
    }

    await recordAuditEvent(actor, {
      action: 'CMS_CONTENT_SAVED',
      entityType: `cms_${input.contentType}`,
      entityId: cleanId,
      previousData: previousData ? { title: previousData.title, price: previousData.price } : null,
      newData: { title: savedItem.title, price: savedItem.price, imagesCount: savedItem.images.length },
    });

    return {
      isDemo: true,
      item: savedItem,
      ...(input.contentType === 'room' ? { roomType: cmsItemToRoomType(savedItem) } : {}),
    };
  }

  const supabase = getSupabaseServerClient();
  let previousSnapshot: Record<string, any> | null = null;

  if (input.contentType === 'room') {
    const { data: existingRow } = await supabase
      .from('room_types')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (existingRow) {
      previousSnapshot = {
        name: existingRow.name,
        base_price: existingRow.base_price,
        deposit_value: existingRow.deposit_value,
        image: existingRow.image,
      };
    }

    const roomUpdatePayload = {
      name: title,
      description,
      base_price: price,
      deposit_type: 'percentage',
      deposit_value: normalizedAttributes.depositPercent ?? 30,
      size_sqm: normalizedAttributes.size || '21m²',
      bed_type: normalizedAttributes.bedType || '1 Giường King Mái Vòm',
      capacity_adults: normalizedAttributes.maxGuests ?? 2,
      amenities: normalizedAttributes.amenities || [],
      image: savedItem.images[0],
      gallery_images: savedItem.images,
      active,
      updated_at: nowIso,
    };

    if (existingRow) {
      const { error: updateErr } = await supabase
        .from('room_types')
        .update(roomUpdatePayload)
        .eq('id', cleanId);

      if (updateErr) {
        throw new Error(`Lỗi cập nhật hạng phòng trong database: ${updateErr.message}`);
      }
    } else {
      const { error: insertErr } = await supabase.from('room_types').insert({
        id: cleanId,
        slug,
        ...roomUpdatePayload,
      });

      if (insertErr) {
        throw new Error(`Lỗi tạo mới hạng phòng trong database: ${insertErr.message}`);
      }
    }
  }

  // Persist generic CMS snapshot into `site_content` (guaranteed available in production Supabase)
  const siteContentKey = `cms:${input.contentType}:${cleanId}`;
  const { error: siteUpsertErr } = await supabase.from('site_content').upsert(
    {
      content_key: siteContentKey,
      content_type: 'json',
      text_value: savedItem.images[0] || '',
      metadata: {
        id: savedItem.id,
        contentType: savedItem.contentType,
        title: savedItem.title,
        slug: savedItem.slug,
        description: savedItem.description,
        price: savedItem.price,
        images: savedItem.images,
        attributes: savedItem.attributes,
        sortOrder: savedItem.sortOrder ?? null,
        active: savedItem.active,
        updatedBy: actor.username,
        updatedAt: nowIso,
      },
      updated_by: actor.username,
      updated_at: nowIso,
    },
    { onConflict: 'content_key' }
  );

  if (siteUpsertErr) {
    console.warn('[CMS Service] site_content mirror warning:', siteUpsertErr.message);
  }

  // Also persist into dedicated `cms_contents` table when present in Supabase
  const { error: cmsUpsertErr } = await supabase.from('cms_contents').upsert(
    {
      id: savedItem.id,
      content_type: savedItem.contentType,
      title: savedItem.title,
      slug: savedItem.slug,
      description: savedItem.description,
      price: savedItem.price,
      images: savedItem.images,
      attributes: savedItem.attributes,
      sort_order: savedItem.sortOrder ?? 100,
      active: savedItem.active,
      updated_by: actor.username,
      updated_at: nowIso,
    },
    { onConflict: 'id' }
  );

  if (cmsUpsertErr && !isMissingTableOrColumnError(cmsUpsertErr)) {
    console.warn('[CMS Service] cms_contents upsert warning:', cmsUpsertErr.message);
  }

  await recordAuditEvent(actor, {
    action: 'CMS_CONTENT_SAVED',
    entityType: `cms_${input.contentType}`,
    entityId: cleanId,
    previousData: previousSnapshot,
    newData: {
      title: savedItem.title,
      price: savedItem.price,
      depositPercent: savedItem.attributes.depositPercent ?? null,
      bedrooms: savedItem.attributes.bedrooms ?? null,
      bathrooms: savedItem.attributes.bathrooms ?? null,
      hasBalcony: savedItem.attributes.hasBalcony ?? null,
      imagesCount: savedItem.images.length,
    },
  });

  return {
    isDemo: false,
    item: savedItem,
    ...(input.contentType === 'room' ? { roomType: cmsItemToRoomType(savedItem) } : {}),
  };
}

export interface UploadCmsImageInput {
  contentType: CmsContentType;
  itemId: string;
  fileBase64: string;
  filename: string;
  mimeType: string;
  altText?: string;
}

/**
 * Uploads an image for a CMS item (`'room' | 'service'`) to Supabase Storage bucket `site-media`
 * and returns its public URL.
 */
export async function uploadCmsImage(
  input: UploadCmsImageInput,
  actor: AdminSession
): Promise<{
  isDemo: boolean;
  publicUrl: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
}> {
  if (!isValidContentType(input.contentType)) {
    throw new Error('Loại nội dung CMS không hợp lệ.');
  }

  const safeItemId = String(input.itemId || 'general')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 64);

  const mimeType = String(input.mimeType || '').trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    throw new Error('Chỉ chấp nhận định dạng ảnh JPG, JPEG, PNG hoặc WebP.');
  }

  if (!input.fileBase64 || typeof input.fileBase64 !== 'string') {
    throw new Error('Thiếu dữ liệu ảnh tải lên.');
  }

  const rawBase64 = input.fileBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const buffer = Buffer.from(rawBase64, 'base64');

  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Kích thước ảnh không hợp lệ (tối đa 8MB).');
  }

  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const ext = extMap[mimeType] || '.jpg';

  const baseFilename = String(input.filename || 'photo')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 48) || 'photo';

  const storagePath = `cms/${input.contentType}/${safeItemId}/${baseFilename}-${Date.now()}${ext}`;

  if (!isSupabaseConfigured()) {
    const dataUrl = `data:${mimeType};base64,${rawBase64}`;
    return {
      isDemo: true,
      publicUrl: dataUrl,
      storagePath,
      mimeType,
      fileSize: buffer.length,
    };
  }

  const supabase = getSupabaseServerClient();

  const { error: uploadError } = await supabase.storage
    .from('site-media')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Không thể tải ảnh lên Supabase Storage (bucket site-media): ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('site-media')
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData.publicUrl;

  // Best-effort log in media_assets table
  await supabase
    .from('media_assets')
    .insert({
      storage_bucket: 'site-media',
      storage_path: storagePath,
      public_url: publicUrl,
      original_filename: `${baseFilename}${ext}`,
      mime_type: mimeType,
      file_size: buffer.length,
      alt_text: String(input.altText || '').slice(0, 255),
      category: `cms_${input.contentType}`,
      entity_type: `cms_${input.contentType}`,
      entity_id: safeItemId,
      uploaded_by: actor.username,
      active: true,
    })
    .then(() => undefined, () => undefined);

  await recordAuditEvent(actor, {
    action: 'CMS_IMAGE_UPLOADED',
    entityType: `cms_${input.contentType}`,
    entityId: safeItemId,
    newData: { storagePath, publicUrl, fileSize: buffer.length },
  });

  return {
    isDemo: false,
    publicUrl,
    storagePath,
    mimeType,
    fileSize: buffer.length,
  };
}
