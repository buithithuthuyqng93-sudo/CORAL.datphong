import { getSupabaseServerClient, isSupabaseConfigured } from '../../api/lib/supabaseServer';

export interface MediaAsset {
  id: string;
  storageBucket: string;
  storagePath: string;
  publicUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  altText?: string;
  category: string;
  entityType?: string;
  entityId?: string;
  displayOrder?: number;
  active: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteContentItem {
  id: string;
  contentKey: string;
  contentType: 'image' | 'text' | 'json';
  mediaAssetId?: string;
  mediaAsset?: MediaAsset | null;
  textValue?: string;
  metadata?: {
    focalPoint?: { x: number; y: number };
    altText?: string;
    mobileUrl?: string;
    overlayOpacity?: number;
    [key: string]: any;
  };
  updatedBy?: string;
  updatedAt?: string;
}

export interface MediaHistoryRecord {
  id: string;
  contentKey: string;
  previousMediaAssetId?: string;
  previousUrl?: string;
  newMediaAssetId?: string;
  newUrl?: string;
  changedBy: string;
  changedAt: string;
}

// Local storage fallback key for Demo Mode
const LOCAL_STORAGE_SITE_CONTENT_KEY = 'coral_demo_site_content_v1';
const LOCAL_STORAGE_MEDIA_HISTORY_KEY = 'coral_demo_media_history_v1';
const LOCAL_STORAGE_ROOM_GALLERIES_KEY = 'coral_demo_room_galleries_v1';

// Default static fallbacks for site content keys
export const DEFAULT_SITE_CONTENT: Record<string, Partial<SiteContentItem>> = {
  'homepage.hero.desktop': {
    contentKey: 'homepage.hero.desktop',
    textValue: '/images/coral-hero.jpg',
    metadata: { focalPoint: { x: 50, y: 50 }, altText: 'Toàn cảnh Homestay & CAFE CORAL Lý Sơn', overlayOpacity: 0.3 },
  },
  'homepage.hero.mobile': {
    contentKey: 'homepage.hero.mobile',
    textValue: '/images/coral-hero.jpg',
    metadata: { focalPoint: { x: 50, y: 50 }, altText: 'Toàn cảnh Homestay & CAFE CORAL Lý Sơn trên di động' },
  },
  'homepage.logo': {
    contentKey: 'homepage.logo',
    textValue: '/images/coral-hero.jpg',
    metadata: { altText: 'Logo Homestay & CAFE CORAL Lý Sơn' },
  },
  'homepage.about.image': {
    contentKey: 'homepage.about.image',
    textValue: '/images/bungalow-row-sunset.jpg',
    metadata: { altText: 'Dãy Bungalow Vòm Vách Núi Hoàng Hôn' },
  },
  'homepage.cafe.image': {
    contentKey: 'homepage.cafe.image',
    textValue: '/images/bungalow-sunset-front.jpg',
    metadata: { altText: 'Khu Cà Phê Vòm Ngắm Hoàng Hôn Đại Dương' },
  },
  'homepage.location.image': {
    contentKey: 'homepage.location.image',
    textValue: '/images/bungalow-cliff-day.jpg',
    metadata: { altText: 'Vị trí vách núi ngắm hoàng hôn Lý Sơn' },
  },
};

/**
 * Validates image file type and size before uploading
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSizeBytes = 8 * 1024 * 1024; // 8MB

  if (!file) {
    return { valid: false, error: 'Chưa chọn tệp hình ảnh' };
  }

  // Real MIME type check
  if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Định dạng tệp không được hỗ trợ (${file.type || 'không xác định'}). Chỉ chấp nhận JPG, JPEG, PNG, hoặc WebP.`,
    };
  }

  if (file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Dung lượng tệp (${sizeMb}MB) vượt quá giới hạn cho phép là 8MB. Vui lòng nén ảnh trước khi tải lên.`,
    };
  }

  return { valid: true };
}

/**
 * Sanitizes filename: converts Vietnamese to unsigned, removes special chars, appends timestamp
 */
export function sanitizeFilename(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));

  // Remove Vietnamese diacritics
  const cleanName = nameWithoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);

  return `${cleanName}-${timestamp}-${randomSuffix}${ext}`;
}

/**
 * Reads local demo site content from localStorage
 */
function getLocalDemoSiteContent(): Record<string, SiteContentItem> {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SITE_CONTENT_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('[MediaService] Error reading demo site content from localStorage:', e);
  }
  return {};
}

/**
 * Saves local demo site content to localStorage
 */
function saveLocalDemoSiteContent(data: Record<string, SiteContentItem>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SITE_CONTENT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[MediaService] Error saving demo site content to localStorage:', e);
  }
}

/**
 * Reads local demo media history from localStorage
 */
export function getLocalDemoMediaHistory(contentKey: string): MediaHistoryRecord[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_MEDIA_HISTORY_KEY);
    if (saved) {
      const all: MediaHistoryRecord[] = JSON.parse(saved);
      return all.filter((h) => h.contentKey === contentKey);
    }
  } catch (e) {
    console.warn('[MediaService] Error reading media history:', e);
  }
  return [];
}

/**
 * Saves local demo media history record
 */
function saveLocalDemoMediaHistory(record: MediaHistoryRecord) {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_MEDIA_HISTORY_KEY);
    const historyList: MediaHistoryRecord[] = saved ? JSON.parse(saved) : [];
    historyList.unshift(record);
    localStorage.setItem(LOCAL_STORAGE_MEDIA_HISTORY_KEY, JSON.stringify(historyList));
  } catch (e) {
    console.warn('[MediaService] Error saving media history:', e);
  }
}

/**
 * Fetches site content items (all or single key)
 */
export async function fetchSiteContentMap(): Promise<Record<string, SiteContentItem>> {
  const localDemo = getLocalDemoSiteContent();

  if (!isSupabaseConfigured()) {
    // Return local demo merged with static defaults
    const result: Record<string, SiteContentItem> = {};
    Object.keys(DEFAULT_SITE_CONTENT).forEach((key) => {
      const def = DEFAULT_SITE_CONTENT[key];
      result[key] = localDemo[key] || {
        id: `demo-${key}`,
        contentKey: key,
        contentType: 'image',
        textValue: def.textValue,
        metadata: def.metadata,
        updatedAt: new Date().toISOString(),
      };
    });
    return result;
  }

  try {
    const res = await fetch('/api/media?action=get-all');
    if (!res.ok) throw new Error('API fetch failed');
    const json = await res.json();

    if (json.success && json.contentMap) {
      return json.contentMap;
    }
  } catch (err) {
    console.warn('[MediaService] Fallback to local site content due to API error:', err);
  }

  // Fallback if API fails
  const result: Record<string, SiteContentItem> = {};
  Object.keys(DEFAULT_SITE_CONTENT).forEach((key) => {
    const def = DEFAULT_SITE_CONTENT[key];
    result[key] = localDemo[key] || {
      id: `demo-${key}`,
      contentKey: key,
      contentType: 'image',
      textValue: def.textValue,
      metadata: def.metadata,
      updatedAt: new Date().toISOString(),
    };
  });
  return result;
}

/**
 * Converts File object to base64 Data URL for instant local preview or demo storage
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads media file and updates site content mapping
 */
export async function uploadAndSaveSiteContentImage(params: {
  file: File;
  contentKey: string;
  category: string;
  altText?: string;
  metadata?: Record<string, any>;
  updatedBy?: string;
}): Promise<{ success: boolean; imageUrl?: string; siteContent?: SiteContentItem; isDemo?: boolean; error?: string }> {
  const { file, contentKey, category, altText = '', metadata = {}, updatedBy = 'admin' } = params;

  // 1. Validate file
  const val = validateImageFile(file);
  if (!val.valid) {
    return { success: false, error: val.error };
  }

  const cleanFilename = sanitizeFilename(file.name);

  // If in Demo Mode (Supabase not configured), process via client-side base64 DataURL
  if (!isSupabaseConfigured()) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const localMap = getLocalDemoSiteContent();
      const existing = localMap[contentKey] || DEFAULT_SITE_CONTENT[contentKey];

      const previousUrl = existing?.textValue || DEFAULT_SITE_CONTENT[contentKey]?.textValue || '';

      const updatedItem: SiteContentItem = {
        id: `demo-${Date.now()}`,
        contentKey,
        contentType: 'image',
        textValue: dataUrl,
        metadata: {
          ...existing?.metadata,
          ...metadata,
          altText: altText || existing?.metadata?.altText || file.name,
          originalFilename: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
        updatedBy,
        updatedAt: new Date().toISOString(),
      };

      localMap[contentKey] = updatedItem;
      saveLocalDemoSiteContent(localMap);

      // Save history record
      saveLocalDemoMediaHistory({
        id: `hist-${Date.now()}`,
        contentKey,
        previousUrl,
        newUrl: dataUrl,
        changedBy: updatedBy,
        changedAt: new Date().toISOString(),
      });

      return {
        success: true,
        imageUrl: dataUrl,
        siteContent: updatedItem,
        isDemo: true,
      };
    } catch (err: any) {
      return { success: false, error: `Lỗi xử lý ảnh trong Chế độ Demo: ${err.message}` };
    }
  }

  // Production Mode: Send file via FormData to backend API endpoint
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contentKey', contentKey);
    formData.append('category', category);
    formData.append('altText', altText);
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('updatedBy', updatedBy);

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Lỗi khi tải ảnh lên máy chủ');
    }

    return {
      success: true,
      imageUrl: json.publicUrl,
      siteContent: json.siteContent,
      isDemo: false,
    };
  } catch (err: any) {
    console.error('[MediaService Upload Error]:', err);
    return { success: false, error: err.message || 'Không thể tải ảnh lên Supabase Storage' };
  }
}

/**
 * Restores previous image from media history
 */
export async function restorePreviousSiteContentImage(contentKey: string): Promise<{ success: boolean; restoredUrl?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    const history = getLocalDemoMediaHistory(contentKey);
    if (history.length === 0 || !history[0].previousUrl) {
      // Fallback to static default
      const defaultUrl = DEFAULT_SITE_CONTENT[contentKey]?.textValue || '/images/coral-hero.jpg';
      const localMap = getLocalDemoSiteContent();
      if (localMap[contentKey]) {
        localMap[contentKey].textValue = defaultUrl;
        localMap[contentKey].updatedAt = new Date().toISOString();
        saveLocalDemoSiteContent(localMap);
      }
      return { success: true, restoredUrl: defaultUrl };
    }

    const lastRecord = history[0];
    const previousUrl = lastRecord.previousUrl;

    const localMap = getLocalDemoSiteContent();
    if (localMap[contentKey]) {
      localMap[contentKey].textValue = previousUrl;
      localMap[contentKey].updatedAt = new Date().toISOString();
      saveLocalDemoSiteContent(localMap);
    }

    return { success: true, restoredUrl: previousUrl };
  }

  try {
    const res = await fetch('/api/media/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentKey }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Khôi phục ảnh thất bại');
    }

    return { success: true, restoredUrl: json.restoredUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
