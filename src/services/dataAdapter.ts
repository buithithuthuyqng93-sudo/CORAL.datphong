import { Booking, RoomType, Room } from '../types';
import { CORAL_ROOM_TYPES, INITIAL_ROOMS, INITIAL_BOOKINGS } from '../data/mockData';

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

/**
 * Checks available rooms for selected date range
 */
export async function apiCheckAvailability(roomTypeId?: string, checkIn?: string, checkOut?: string) {
  try {
    const params = new URLSearchParams();
    if (roomTypeId) params.append('roomTypeId', roomTypeId);
    if (checkIn) params.append('checkIn', checkIn);
    if (checkOut) params.append('checkOut', checkOut);

    const res = await fetch(`/api/availability?${params.toString()}`);
    if (!res.ok) throw new Error('API server returned error');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('[DataAdapter] Fallback to local mock availability:', err);
    return {
      isDemo: true,
      roomTypes: CORAL_ROOM_TYPES,
      availableRooms: INITIAL_ROOMS.filter((r) => r.status === 'available'),
    };
  }
}

/**
 * Submits a new booking draft & holds the room
 */
export async function apiCreateBooking(payload: CreateBookingPayload) {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Tạo đơn đặt phòng thất bại');
    }

    return {
      success: true,
      booking: json.data as Booking,
      isDemo: json.isDemo,
    };
  } catch (err: any) {
    console.warn('[DataAdapter] Falling back to local booking creation:', err.message);

    // Local fallback for demo mode
    const targetRoomType = CORAL_ROOM_TYPES.find((r) => r.id === payload.roomTypeId) || CORAL_ROOM_TYPES[0];
    const dIn = new Date(payload.checkIn);
    const dOut = new Date(payload.checkOut);
    const nights = Math.max(1, Math.ceil((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)));
    const totalPrice = targetRoomType.basePrice * nights;
    const depositAmount = totalPrice * 0.5;
    const randomCode = `CRL-${Math.floor(1000 + Math.random() * 9000)}`;

    const fallbackBooking: Booking = {
      id: `local-${Date.now()}`,
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
      depositPercent: 50,
      depositAmount,
      paymentStatus: 'pending_deposit',
      channel: 'direct',
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      booking: fallbackBooking,
      isDemo: true,
    };
  }
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
