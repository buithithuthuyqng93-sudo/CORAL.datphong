import { getSupabaseServerClient, isSupabaseConfigured } from './supabaseServer';
import { CORAL_ROOM_TYPES, INITIAL_ROOMS } from '../../src/data/mockData';

export interface CreateBookingInput {
  roomTypeId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guestName: string;
  phone: string;
  email?: string;
  adults?: number;
  children?: number;
  notes?: string;
}

/**
 * Calculates number of nights between two date strings (YYYY-MM-DD)
 */
export function calculateNights(checkInStr: string, checkOutStr: string): number {
  const dIn = new Date(checkInStr);
  const dOut = new Date(checkOutStr);
  const diffTime = dOut.getTime() - dIn.getTime();
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

/**
 * Generates temporary booking code: CRL-YYMMDD-XXXX
 * e.g. CRL-260731-A8K4
 */
export function generateTemporaryOrderCode(): string {
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomStr = '';
  for (let i = 0; i < 4; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CRL-${yy}${mm}${dd}-${randomStr}`;
}

/**
 * Checks room availability for a given room type and date range
 */
export async function checkAvailableRooms(
  roomTypeId?: string,
  checkIn?: string,
  checkOut?: string
) {
  if (!isSupabaseConfigured()) {
    // Fallback in demo mode
    let availableTypes = CORAL_ROOM_TYPES;
    if (roomTypeId) {
      availableTypes = CORAL_ROOM_TYPES.filter((r) => r.id === roomTypeId);
    }
    return {
      isDemo: true,
      roomTypes: availableTypes,
      availableRooms: INITIAL_ROOMS.filter((r) => r.status === 'available'),
    };
  }

  const supabase = getSupabaseServerClient();

  // Query room types
  let rtQuery = supabase.from('room_types').select('*').eq('active', true);
  if (roomTypeId) {
    rtQuery = rtQuery.eq('id', roomTypeId);
  }
  const { data: roomTypes, error: rtError } = await rtQuery;

  if (rtError) {
    throw new Error(`Database query error: ${rtError.message}`);
  }

  // If checkIn and checkOut are provided, filter out occupied rooms
  let roomsQuery = supabase.from('rooms').select('*').eq('active', true).neq('status', 'maintenance');
  const { data: allRooms, error: roomsError } = await roomsQuery;

  if (roomsError) {
    throw new Error(`Rooms query error: ${roomsError.message}`);
  }

  if (checkIn && checkOut) {
    // Find occupied/held room IDs for the period
    const { data: overlappingBookings } = await supabase
      .from('bookings')
      .select('assigned_room_id, hold_expires_at, status')
      .in('status', ['pending_payment', 'deposit_paid', 'confirmed', 'checked_in'])
      .lt('check_in_date', checkOut)
      .gt('check_out_date', checkIn);

    const nowIso = new Date().toISOString();
    const busyRoomIds = new Set<string>();

    (overlappingBookings || []).forEach((b) => {
      // Exclude expired pending holds
      if (b.status === 'pending_payment' && b.hold_expires_at && b.hold_expires_at < nowIso) {
        return;
      }
      if (b.assigned_room_id) {
        busyRoomIds.add(b.assigned_room_id);
      }
    });

    const freeRooms = (allRooms || []).filter((r) => !busyRoomIds.has(r.id));
    return {
      isDemo: false,
      roomTypes,
      availableRooms: freeRooms,
    };
  }

  return {
    isDemo: false,
    roomTypes,
    availableRooms: allRooms || [],
  };
}

/**
 * Creates a new booking draft and reserves room atomically
 */
export async function createBookingDraft(input: CreateBookingInput) {
  const nights = calculateNights(input.checkIn, input.checkOut);
  const tempCode = generateTemporaryOrderCode();

  if (!isSupabaseConfigured()) {
    // Demo Mode fallback
    const targetRoomType = CORAL_ROOM_TYPES.find((r) => r.id === input.roomTypeId) || CORAL_ROOM_TYPES[0];
    const totalPrice = targetRoomType.basePrice * nights;
    const depositAmount = totalPrice * 0.5;

    return {
      isDemo: true,
      booking: {
        id: `demo-${Date.now()}`,
        code: tempCode,
        temporaryOrderCode: tempCode,
        customerName: input.guestName,
        customerPhone: input.phone,
        customerEmail: input.email || '',
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        nights,
        roomId: 'rm-101',
        roomNumber: '101',
        roomTypeName: targetRoomType.name,
        totalPrice,
        depositPercent: 50,
        depositAmount,
        remainingAmount: totalPrice - depositAmount,
        paymentStatus: 'pending_deposit',
        channel: 'direct',
        createdAt: new Date().toISOString(),
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    };
  }

  const supabase = getSupabaseServerClient();

  // Get room type price
  const { data: roomType, error: rtErr } = await supabase
    .from('room_types')
    .select('*')
    .eq('id', input.roomTypeId)
    .single();

  if (rtErr || !roomType) {
    throw new Error('Hạng phòng không tồn tại hoặc đã ngưng hoạt động');
  }

  const totalPrice = Number(roomType.base_price) * nights;
  const depositPercent = Number(roomType.deposit_value) || 50;
  const depositAmount = (totalPrice * depositPercent) / 100;
  const holdMinutes = Number(process.env.BOOKING_HOLD_MINUTES) || 15;

  // Call atomic RPC function to hold room
  const { data: holdResult, error: rpcErr } = await supabase.rpc('fn_check_and_hold_room', {
    p_room_type_id: input.roomTypeId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guest_name: input.guestName,
    p_guest_phone: input.phone,
    p_guest_email: input.email || '',
    p_adults: input.adults || 2,
    p_children: input.children || 0,
    p_temp_code: tempCode,
    p_total_price: totalPrice,
    p_deposit_amount: depositAmount,
    p_hold_minutes: holdMinutes,
  });

  if (rpcErr) {
    console.error('RPC Error:', rpcErr);
    throw new Error(`Lỗi khởi tạo đơn đặt phòng: ${rpcErr.message}`);
  }

  if (!holdResult || !holdResult.success) {
    throw new Error(holdResult?.message || 'Phòng đã được khách khác chọn trong khoảng thời gian này');
  }

  // Fetch created booking record
  const { data: bookingRecord, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', holdResult.booking_id)
    .single();

  if (bErr || !bookingRecord) {
    throw new Error('Không thể tải thông tin đơn đặt phòng vừa tạo');
  }

  return {
    isDemo: false,
    booking: {
      id: bookingRecord.id,
      code: bookingRecord.temporary_order_code,
      temporaryOrderCode: bookingRecord.temporary_order_code,
      confirmationCode: bookingRecord.confirmation_code,
      customerName: bookingRecord.guest_name,
      customerPhone: bookingRecord.guest_phone,
      customerEmail: bookingRecord.guest_email || '',
      checkIn: bookingRecord.check_in_date,
      checkOut: bookingRecord.check_out_date,
      nights: bookingRecord.number_of_nights,
      roomId: bookingRecord.assigned_room_id,
      roomNumber: holdResult.room_number,
      roomTypeName: bookingRecord.room_type_name,
      totalPrice: Number(bookingRecord.total_amount),
      depositPercent,
      depositAmount: Number(bookingRecord.required_payment_amount),
      remainingAmount: Number(bookingRecord.remaining_amount),
      paymentStatus: 'pending_deposit',
      channel: 'direct',
      createdAt: bookingRecord.created_at,
      holdExpiresAt: bookingRecord.hold_expires_at,
    },
  };
}

/**
 * Searches for a booking by Code + Phone/Email (Prevents bulk enumeration)
 */
export async function lookupBookingByCode(code: string, phoneOrEmail: string) {
  if (!code || !phoneOrEmail) {
    throw new Error('Vui lòng nhập Mã đặt phòng và Số điện thoại hoặc Email');
  }

  const searchCode = code.trim().toUpperCase();
  const searchContact = phoneOrEmail.trim().toLowerCase();

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseServerClient();

  // Search by temporary_order_code OR confirmation_code
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .or(`temporary_order_code.eq.${searchCode},confirmation_code.eq.${searchCode}`);

  if (error || !bookings || bookings.length === 0) {
    return null;
  }

  // Verify contact info match
  const matched = bookings.find(
    (b) =>
      b.guest_phone.trim().toLowerCase() === searchContact ||
      (b.guest_email && b.guest_email.trim().toLowerCase() === searchContact)
  );

  return matched || null;
}

/**
 * Expires hold reservations whose hold_expires_at has passed
 */
export async function expireOverdueHolds() {
  if (!isSupabaseConfigured()) {
    return { expiredCount: 0 };
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'expired' })
    .eq('status', 'pending_payment')
    .lt('hold_expires_at', nowIso)
    .select('id, temporary_order_code');

  if (error) {
    console.error('[Expire Holds] Error:', error);
    throw error;
  }

  return { expiredCount: data?.length || 0, expiredBookings: data };
}
