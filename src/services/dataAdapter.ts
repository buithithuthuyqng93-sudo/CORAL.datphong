import { Booking, RoomType, Room, CmsContentItem, CmsContentType } from '../types';
import { SEAGULL_ROOM_TYPES, INITIAL_ROOMS, INITIAL_BOOKINGS } from '../data/mockData';

export interface CreateBookingPayload {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  phone: string;
  email?: string;
  adults?: number;
  children?: number;
  notes?: string;
}

export interface AvailabilityApiResponse {
  isDemo: boolean;
  holdMinutes?: number;
  checkedAt?: string;
  roomTypes: any[];
  availableRooms: any[];
  availabilityByType?: Record<
    string,
    { availableCount: number; totalActiveRooms: number; availableRoomIds: string[] }
  >;
}

/**
 * Checks available rooms for selected date range (always real-time, never cached)
 */
export async function apiCheckAvailability(
  roomTypeId?: string,
  checkIn?: string,
  checkOut?: string
): Promise<AvailabilityApiResponse> {
  try {
    const params = new URLSearchParams();
    if (roomTypeId) params.append('roomTypeId', roomTypeId);
    if (checkIn) params.append('checkIn', checkIn);
    if (checkOut) params.append('checkOut', checkOut);

    const res = await fetch(`/api/availability?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) throw new Error('API server returned error');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('[DataAdapter] Fallback to local mock availability:', err);
    return {
      isDemo: true,
      holdMinutes: 15,
      roomTypes: SEAGULL_ROOM_TYPES,
      availableRooms: INITIAL_ROOMS.filter((r) => r.status === 'available' && r.isActive !== false),
    };
  }
}

/**
 * Submits a new booking draft & holds the room
 */
export async function apiCreateBooking(payload: CreateBookingPayload) {
  let res: Response;
  try {
    res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
  } catch (networkErr: any) {
    console.warn('[DataAdapter] Network unavailable, falling back to local booking creation:', networkErr?.message);

    // Local fallback strictly when API server is unreachable
    const targetRoomType = SEAGULL_ROOM_TYPES.find((r) => r.id === payload.roomTypeId) || SEAGULL_ROOM_TYPES[0];
    const dIn = new Date(payload.checkIn);
    const dOut = new Date(payload.checkOut);
    const nights = Math.max(1, Math.ceil((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)));
    const totalPrice = targetRoomType.basePrice * nights;
    const depositAmount = Math.ceil(totalPrice * 0.30); // Confirmed 30% deposit rule
    const randomCode = `SGL-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = Date.now();

    const fallbackBooking: Booking = {
      id: `local-${now}`,
      code: randomCode,
      customerName: payload.guestName,
      customerPhone: payload.phone,
      customerEmail: payload.email || '',
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      nights,
      roomId: 'rm-101',
      roomNumber: '101',
      roomTypeName: targetRoomType.name,
      totalPrice,
      depositPercent: 30,
      depositAmount,
      paymentStatus: 'pending_deposit',
      channel: 'direct',
      createdAt: new Date(now).toISOString(),
      holdExpiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    };

    return {
      success: true,
      booking: fallbackBooking,
      isDemo: true,
    };
  }

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Tạo đơn đặt phòng thất bại');
  }

  return {
    success: true,
    booking: json.data as Booking,
    isDemo: Boolean(json.isDemo),
  };
}

/**
 * Tra cứu đơn đặt phòng theo mã đơn + SĐT/Email
 */
export async function apiLookupBooking(code: string, contact: string) {
  try {
    const params = new URLSearchParams({ code, contact });
    const res = await fetch(`/api/bookings/lookup?${params.toString()}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Không tìm thấy đơn đặt phòng');
    }
    return json.data;
  } catch (err: any) {
    console.warn('[DataAdapter] Local lookup check:', err.message);
    const cleanCode = code.trim().toUpperCase();
    const cleanContact = contact.trim().toLowerCase();
    const found = INITIAL_BOOKINGS.find(
      (b) =>
        b.code.toUpperCase() === cleanCode &&
        (b.customerPhone.includes(cleanContact) || b.customerEmail.toLowerCase().includes(cleanContact))
    );
    return found || null;
  }
}

/**
 * Resends booking confirmation email via admin endpoint
 */
export async function apiAdminResendEmail(bookingId: string) {
  try {
    const res = await fetch('/api/admin/resend-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Resyncs booking row to Google Sheets via admin endpoint
 */
export async function apiAdminResyncSheet(bookingId: string) {
  try {
    const res = await fetch('/api/admin/resync-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// GENERIC CMS API ADAPTER (contentType: 'room' | 'service')
// ============================================================================

export interface CmsListApiResponse {
  success: boolean;
  isDemo: boolean;
  contentType: CmsContentType;
  items: CmsContentItem[];
  roomTypes?: RoomType[];
  error?: string;
}

export interface SaveCmsPayload {
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

export function roomTypeToCmsPayload(rt: RoomType): SaveCmsPayload {
  const images = Array.from(
    new Set([rt.image, ...(rt.galleryImages || [])].map((u) => (u || '').trim()).filter(Boolean))
  );
  return {
    id: rt.id,
    contentType: 'room',
    title: rt.name,
    slug: rt.slug,
    description: rt.description,
    price: rt.basePrice,
    images,
    active: rt.active !== false,
    attributes: {
      ...(rt.attributes || {}),
      size: rt.size,
      areaSqm: rt.size,
      bedrooms: rt.bedrooms ?? 1,
      bathrooms: rt.bathrooms ?? 1,
      hasBalcony: rt.hasBalcony ?? true,
      bedType: rt.bedType,
      maxGuests: rt.maxGuests,
      depositPercent: rt.depositPercent ?? 30,
      amenities: rt.amenities || [],
    },
  };
}

export async function apiListCmsContent(
  contentType: CmsContentType,
  options?: { includeInactive?: boolean; token?: string | null }
): Promise<CmsListApiResponse> {
  const params = new URLSearchParams({ type: contentType });
  if (options?.includeInactive) {
    params.append('includeInactive', 'true');
  }
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache',
  };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`/api/cms?${params.toString()}`, {
    cache: 'no-store',
    headers,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Không thể tải dữ liệu CMS');
  }
  return json as CmsListApiResponse;
}

export async function apiSaveCmsContent(
  payload: SaveCmsPayload,
  token: string
): Promise<{
  success: boolean;
  isDemo: boolean;
  item: CmsContentItem;
  roomType?: RoomType;
}> {
  const res = await fetch('/api/cms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({ action: 'save', item: payload }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Không thể lưu thay đổi CMS');
  }
  return json;
}

export async function apiUploadCmsImage(
  payload: {
    contentType: CmsContentType;
    itemId: string;
    fileBase64: string;
    filename: string;
    mimeType: string;
    altText?: string;
  },
  token: string
): Promise<{
  success: boolean;
  isDemo: boolean;
  publicUrl: string;
  storagePath: string;
}> {
  const res = await fetch('/api/cms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({
      action: 'upload-image',
      ...payload,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Tải ảnh lên thất bại');
  }
  return json;
}

