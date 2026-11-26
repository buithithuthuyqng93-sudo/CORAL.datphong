import { getSupabaseServerClient, isSupabaseConfigured } from './supabaseServer.js';
import { CORAL_ROOM_TYPES, INITIAL_ROOMS } from '../src/data/mockData.js';

export const DEFAULT_BOOKING_HOLD_MINUTES = 15;

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

export interface HoldTimeRecord {
  status?: string | null;
  paymentStatus?: string | null;
  hold_expires_at?: string | null;
  holdExpiresAt?: string | null;
  expires_at?: string | null;
  expiresAt?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
}

export interface AvailabilityOptions {
  nowMs?: number;
  holdMinutes?: number;
}

interface DemoHoldBookingRecord {
  id: string;
  temporary_order_code: string;
  confirmation_code: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  check_in_date: string;
  check_out_date: string;
  number_of_nights: number;
  assigned_room_id: string;
  room_number: string;
  room_type_id: string;
  room_type_name: string;
  total_amount: number;
  required_payment_amount: number;
  remaining_amount: number;
  status: string;
  created_at: string;
  hold_expires_at: string;
}

// In-memory store strictly for Demo mode (when Supabase is not configured)
const demoHoldBookings: DemoHoldBookingRecord[] = [];

/**
 * Reads configured hold duration from BOOKING_HOLD_MINUTES (defaults to 15 minutes).
 */
export function getBookingHoldMinutes(overrideMinutes?: number): number {
  if (typeof overrideMinutes === 'number' && Number.isFinite(overrideMinutes) && overrideMinutes > 0) {
    return overrideMinutes;
  }
  const parsed = Number(process.env.BOOKING_HOLD_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BOOKING_HOLD_MINUTES;
}

/**
 * Identifies any pending/temporary hold booking status across DB and client models.
 */
export function isPendingHoldStatus(status?: string | null): boolean {
  const normalized = (status || '').trim().toLowerCase();
  return (
    normalized === 'pending_payment' ||
    normalized === 'pending_deposit' ||
    normalized === 'pending' ||
    normalized === 'temp_hold' ||
    normalized === 'hold'
  );
}

/**
 * Identifies non-blocking terminal booking statuses.
 */
export function isInactiveBookingStatus(status?: string | null): boolean {
  const normalized = (status || '').trim().toLowerCase();
  return (
    normalized === 'cancelled' ||
    normalized === 'expired' ||
    normalized === 'checked_out' ||
    normalized === 'no_show' ||
    normalized === 'released'
  );
}

function parseTimestampMs(raw?: string | null): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const ms = new Date(trimmed).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Computes the strict expiration timestamp (ms) for a pending/hold booking or booking_hold row.
 * Enforces BOTH `hold_expires_at` / `expires_at` AND `created_at + BOOKING_HOLD_MINUTES`
 * so a hold can NEVER outlive `created_at + BOOKING_HOLD_MINUTES` even if cron hasn't run
 * or `hold_expires_at` was omitted.
 */
export function getHoldExpiryTimestampMs(
  record: HoldTimeRecord,
  holdMinutes = getBookingHoldMinutes()
): number {
  const explicitMs =
    parseTimestampMs(record.hold_expires_at) ??
    parseTimestampMs(record.holdExpiresAt) ??
    parseTimestampMs(record.expires_at) ??
    parseTimestampMs(record.expiresAt);

  const createdMs =
    parseTimestampMs(record.created_at) ??
    parseTimestampMs(record.createdAt);

  const createdBasedExpiryMs =
    createdMs !== null ? createdMs + holdMinutes * 60 * 1000 : null;

  if (explicitMs !== null && createdBasedExpiryMs !== null) {
    return Math.min(explicitMs, createdBasedExpiryMs);
  }
  if (explicitMs !== null) {
    return explicitMs;
  }
  if (createdBasedExpiryMs !== null) {
    return createdBasedExpiryMs;
  }
  // Fail-safe: missing both timestamps -> treat as expired so room is never stuck forever
  return 0;
}

/**
 * Returns true if a booking record should currently block room inventory at `nowMs`.
 * - Terminal statuses (cancelled, expired, checked_out, no_show) -> false
 * - Confirmed / paid / checked_in / payment_review -> true
 * - Pending / hold statuses -> true ONLY while expiryMs > nowMs (real-time check, zero cron dependency)
 */
export function isBookingHoldActive(
  record: HoldTimeRecord,
  nowMs = Date.now(),
  holdMinutes = getBookingHoldMinutes()
): boolean {
  const status = record.status ?? record.paymentStatus;
  if (isInactiveBookingStatus(status)) {
    return false;
  }
  if (isPendingHoldStatus(status)) {
    return getHoldExpiryTimestampMs(record, holdMinutes) > nowMs;
  }
  // Non-pending blocking statuses: payment_review, deposit_paid, paid_deposit, confirmed, checked_in
  return true;
}

/**
 * Returns true if a pending/hold booking has passed its hold window at `nowMs`.
 */
export function isHoldExpiredAt(
  record: HoldTimeRecord,
  nowMs = Date.now(),
  holdMinutes = getBookingHoldMinutes()
): boolean {
  const status = record.status ?? record.paymentStatus;
  if (!isPendingHoldStatus(status)) {
    return false;
  }
  return getHoldExpiryTimestampMs(record, holdMinutes) <= nowMs;
}

/**
 * Checks [checkInA, checkOutA) overlap with [checkInB, checkOutB)
 */
export function isDateRangeOverlap(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string
): boolean {
  return checkInA < checkOutB && checkOutA > checkInB;
}

/**
 * Filters a list of booking rows down to only those actively blocking rooms at `nowMs`.
 */
export function filterActiveBlockingBookings<T extends HoldTimeRecord>(
  bookings: T[],
  nowMs = Date.now(),
  holdMinutes = getBookingHoldMinutes()
): T[] {
  return bookings.filter((b) => isBookingHoldActive(b, nowMs, holdMinutes));
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
 * Generates temporary booking code: SGL-YYMMDD-XXXX
 * e.g. SGL-260731-A8K4
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
  return `SGL-${yy}${mm}${dd}-${randomStr}`;
}

/**
 * Lazily marks overdue holds as expired in DB for a room type (or globally).
 * Used as defensive hygiene right before calling DB RPCs so older deployed SQL functions
 * can never be blocked by uncleaned expired holds even if daily cron hasn't run yet.
 */
async function cleanupStaleHoldsInDb(
  roomTypeId?: string,
  nowMs = Date.now(),
  holdMinutes = getBookingHoldMinutes()
): Promise<number> {
  if (!isSupabaseConfigured()) {
    let expiredCount = 0;
    for (const b of demoHoldBookings) {
      if (roomTypeId && b.room_type_id !== roomTypeId) continue;
      if (isHoldExpiredAt(b, nowMs, holdMinutes)) {
        b.status = 'expired';
        expiredCount++;
      }
    }
    return expiredCount;
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date(nowMs).toISOString();
  const createdCutoffIso = new Date(nowMs - holdMinutes * 60 * 1000).toISOString();

  let holdsQuery = supabase
    .from('booking_holds')
    .update({ status: 'expired', updated_at: nowIso })
    .eq('status', 'active')
    .or(`expires_at.lte.${nowIso},created_at.lte.${createdCutoffIso}`);

  if (roomTypeId) {
    holdsQuery = holdsQuery.eq('room_type_id', roomTypeId);
  }
  await holdsQuery;

  let bookingsQuery = supabase
    .from('bookings')
    .update({ status: 'expired', updated_at: nowIso })
    .eq('status', 'pending_payment')
    .or(`hold_expires_at.lte.${nowIso},created_at.lte.${createdCutoffIso}`);

  if (roomTypeId) {
    bookingsQuery = bookingsQuery.eq('room_type_id', roomTypeId);
  }

  const { data, error } = await bookingsQuery.select('id');
  if (error) {
    console.warn('[BookingService] Lazy stale hold cleanup warning:', error.message);
    return 0;
  }
  return data?.length || 0;
}

function buildAvailabilityByType(
  allActiveRooms: Array<{ id: string; room_type_id?: string; roomTypeId?: string }>,
  freeRooms: Array<{ id: string; room_type_id?: string; roomTypeId?: string }>
): Record<string, { availableCount: number; totalActiveRooms: number; availableRoomIds: string[] }> {
  const summary: Record<string, { availableCount: number; totalActiveRooms: number; availableRoomIds: string[] }> = {};

  for (const r of allActiveRooms) {
    const rtId = r.room_type_id || r.roomTypeId || 'unknown';
    if (!summary[rtId]) {
      summary[rtId] = { availableCount: 0, totalActiveRooms: 0, availableRoomIds: [] };
    }
    summary[rtId].totalActiveRooms += 1;
  }

  for (const r of freeRooms) {
    const rtId = r.room_type_id || r.roomTypeId || 'unknown';
    if (!summary[rtId]) {
      summary[rtId] = { availableCount: 0, totalActiveRooms: 0, availableRoomIds: [] };
    }
    summary[rtId].availableCount += 1;
    summary[rtId].availableRoomIds.push(r.id);
  }

  return summary;
}

/**
 * Checks room availability for a given room type and date range.
 * Real-time filters out all expired pending/hold bookings (`hold_expires_at <= now` OR
 * `created_at + BOOKING_HOLD_MINUTES <= now`) at query time with ZERO dependence on cron.
 */
export async function checkAvailableRooms(
  roomTypeId?: string,
  checkIn?: string,
  checkOut?: string,
  options?: AvailabilityOptions
) {
  const nowMs = options?.nowMs ?? Date.now();
  const holdMinutes = getBookingHoldMinutes(options?.holdMinutes);

  if (!isSupabaseConfigured()) {
    // Demo mode with real-time hold expiration filtering
    const availableTypes = roomTypeId
      ? CORAL_ROOM_TYPES.filter((r) => r.id === roomTypeId)
      : CORAL_ROOM_TYPES;

    const baseRooms = INITIAL_ROOMS.filter(
      (r) =>
        r.status === 'available' &&
        r.isActive !== false &&
        (!roomTypeId || r.roomTypeId === roomTypeId)
    );

    const busyRoomIds = new Set<string>();
    if (checkIn && checkOut) {
      for (const b of demoHoldBookings) {
        if (!isDateRangeOverlap(b.check_in_date, b.check_out_date, checkIn, checkOut)) continue;
        if (!isBookingHoldActive(b, nowMs, holdMinutes)) continue;
        if (b.assigned_room_id) {
          busyRoomIds.add(b.assigned_room_id);
        }
      }
    }

    const freeRooms = baseRooms.filter((r) => !busyRoomIds.has(r.id));
    return {
      isDemo: true,
      holdMinutes,
      checkedAt: new Date(nowMs).toISOString(),
      roomTypes: availableTypes,
      availableRooms: freeRooms,
      availabilityByType: buildAvailabilityByType(baseRooms, freeRooms),
    };
  }

  const supabase = getSupabaseServerClient();

  // Query active room types
  let rtQuery = supabase.from('room_types').select('*').eq('active', true);
  if (roomTypeId) {
    rtQuery = rtQuery.eq('id', roomTypeId);
  }
  const { data: roomTypes, error: rtError } = await rtQuery;

  if (rtError) {
    throw new Error(`Database query error: ${rtError.message}`);
  }

  // Fetch active commercial rooms (filtered by roomTypeId when specified)
  let roomsQuery = supabase
    .from('rooms')
    .select('*')
    .eq('active', true)
    .not('status', 'in', '(maintenance,inactive)');

  if (roomTypeId) {
    roomsQuery = roomsQuery.eq('room_type_id', roomTypeId);
  }

  const { data: allRooms, error: roomsError } = await roomsQuery;

  if (roomsError) {
    throw new Error(`Rooms query error: ${roomsError.message}`);
  }

  const activeRooms = allRooms || [];

  if (checkIn && checkOut) {
    const nowIso = new Date(nowMs).toISOString();
    const createdCutoffIso = new Date(nowMs - holdMinutes * 60 * 1000).toISOString();

    // Query overlapping bookings, active unexpired booking_holds, allocations, and room_blocks in parallel.
    // All expired pending/hold records are excluded at query time using BOTH hold_expires_at and created_at + BOOKING_HOLD_MINUTES,
    // completely independent of whether the daily cron job has cleaned up the DB.
    const [
      { data: overlappingBookings, error: bookingsErr },
      { data: activeUnexpiredHolds, error: holdsErr },
      { data: overlappingAllocations, error: allocErr },
      { data: overlappingBlocks, error: blocksErr },
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, assigned_room_id, hold_expires_at, created_at, status')
        .in('status', ['pending_payment', 'payment_review', 'deposit_paid', 'confirmed', 'checked_in'])
        .lt('check_in_date', checkOut)
        .gt('check_out_date', checkIn),
      supabase
        .from('booking_holds')
        .select('room_id, booking_id, expires_at, created_at, status')
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .gt('created_at', createdCutoffIso)
        .lt('check_in_date', checkOut)
        .gt('check_out_date', checkIn),
      supabase
        .from('booking_room_allocations')
        .select('room_id, booking_id, bookings(status, hold_expires_at, created_at)')
        .lt('check_in_date', checkOut)
        .gt('check_out_date', checkIn),
      supabase
        .from('room_blocks')
        .select('room_id')
        .lt('start_date', checkOut)
        .gt('end_date', checkIn),
    ]);

    if (bookingsErr) {
      throw new Error(`Bookings availability query error: ${bookingsErr.message}`);
    }
    if (holdsErr) {
      console.warn('[Availability] booking_holds query warning:', holdsErr.message);
    }
    if (allocErr) {
      console.warn('[Availability] booking_room_allocations query warning:', allocErr.message);
    }
    if (blocksErr) {
      console.warn('[Availability] room_blocks query warning:', blocksErr.message);
    }

    const busyRoomIds = new Set<string>();
    const expiredBookingIds = new Set<string>();

    // 1. Real-time filter on overlapping bookings (excludes expired pending_payment holds immediately)
    for (const b of overlappingBookings || []) {
      if (!isBookingHoldActive(b, nowMs, holdMinutes)) {
        if (b.id) expiredBookingIds.add(b.id);
        continue;
      }
      if (b.assigned_room_id) {
        busyRoomIds.add(b.assigned_room_id);
      }
    }

    // 2. Real-time filter on booking_holds (enforces BOTH expires_at AND created_at + BOOKING_HOLD_MINUTES)
    for (const h of activeUnexpiredHolds || []) {
      if (h.booking_id && expiredBookingIds.has(h.booking_id)) {
        continue;
      }
      const holdExpiryMs = getHoldExpiryTimestampMs(h, holdMinutes);
      if (holdExpiryMs > nowMs && h.room_id) {
        busyRoomIds.add(h.room_id);
      }
    }

    // 3. Real-time filter on booking_room_allocations (ignores allocations tied to expired/cancelled bookings)
    for (const a of (overlappingAllocations || []) as Array<{
      room_id?: string | null;
      booking_id?: string | null;
      bookings?: HoldTimeRecord | HoldTimeRecord[] | null;
    }>) {
      if (!a.room_id) continue;
      if (a.booking_id && expiredBookingIds.has(a.booking_id)) continue;

      const parentBooking = Array.isArray(a.bookings) ? a.bookings[0] : a.bookings;
      if (parentBooking && !isBookingHoldActive(parentBooking, nowMs, holdMinutes)) {
        continue;
      }
      busyRoomIds.add(a.room_id);
    }

    // 4. Manual room blocks (maintenance / owner blocks)
    for (const rb of overlappingBlocks || []) {
      if (rb.room_id) {
        busyRoomIds.add(rb.room_id);
      }
    }

    const freeRooms = activeRooms.filter((r) => !busyRoomIds.has(r.id));
    return {
      isDemo: false,
      holdMinutes,
      checkedAt: new Date(nowMs).toISOString(),
      roomTypes,
      availableRooms: freeRooms,
      availabilityByType: buildAvailabilityByType(activeRooms, freeRooms),
    };
  }

  return {
    isDemo: false,
    holdMinutes,
    checkedAt: new Date(nowMs).toISOString(),
    roomTypes,
    availableRooms: activeRooms,
    availabilityByType: buildAvailabilityByType(activeRooms, activeRooms),
  };
}

/**
 * Creates a new booking draft and reserves an available room atomically.
 * Automatically ignores/releases expired holds (`hold_expires_at <= now` OR `created_at + BOOKING_HOLD_MINUTES <= now`)
 * before assigning a room, never waiting for the daily cron job.
 */
export async function createBookingDraft(
  input: CreateBookingInput,
  options?: AvailabilityOptions
) {
  const nowMs = options?.nowMs ?? Date.now();
  const holdMinutes = getBookingHoldMinutes(options?.holdMinutes);
  const nights = calculateNights(input.checkIn, input.checkOut);
  const tempCode = generateTemporaryOrderCode();

  if (!isSupabaseConfigured()) {
    // Demo Mode: enforce real availability + real-time expired-hold release
    const availability = await checkAvailableRooms(
      input.roomTypeId,
      input.checkIn,
      input.checkOut,
      { nowMs, holdMinutes }
    );

    const targetRoomType =
      CORAL_ROOM_TYPES.find((r) => r.id === input.roomTypeId) || CORAL_ROOM_TYPES[0];
    const freeRoom = availability.availableRooms[0] as { id: string; number?: string; room_code?: string } | undefined;

    if (!freeRoom) {
      throw new Error('Hết phòng trống cho hạng phòng này trong khoảng ngày đã chọn');
    }

    const totalPrice = targetRoomType.basePrice * nights;
    const depositAmount = Math.ceil(totalPrice * 0.30); // 30% deposit rule
    const createdAtIso = new Date(nowMs).toISOString();
    const holdExpiresAtIso = new Date(nowMs + holdMinutes * 60 * 1000).toISOString();
    const roomNumber = freeRoom.number || freeRoom.room_code || '101';

    const demoRecord: DemoHoldBookingRecord = {
      id: `demo-${nowMs}-${Math.floor(Math.random() * 1000)}`,
      temporary_order_code: tempCode,
      confirmation_code: null,
      guest_name: input.guestName,
      guest_phone: input.phone,
      guest_email: input.email || '',
      check_in_date: input.checkIn,
      check_out_date: input.checkOut,
      number_of_nights: nights,
      assigned_room_id: freeRoom.id,
      room_number: roomNumber,
      room_type_id: targetRoomType.id,
      room_type_name: targetRoomType.name,
      total_amount: totalPrice,
      required_payment_amount: depositAmount,
      remaining_amount: totalPrice - depositAmount,
      status: 'pending_payment',
      created_at: createdAtIso,
      hold_expires_at: holdExpiresAtIso,
    };

    demoHoldBookings.push(demoRecord);

    return {
      isDemo: true,
      booking: {
        id: demoRecord.id,
        code: tempCode,
        temporaryOrderCode: tempCode,
        customerName: input.guestName,
        customerPhone: input.phone,
        customerEmail: input.email || '',
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        nights,
        roomId: freeRoom.id,
        roomNumber,
        roomTypeName: targetRoomType.name,
        totalPrice,
        depositPercent: 30,
        depositAmount,
        remainingAmount: totalPrice - depositAmount,
        paymentStatus: 'pending_deposit',
        channel: 'direct',
        createdAt: createdAtIso,
        holdExpiresAt: holdExpiresAtIso,
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
  const rawDepositVal = Number(roomType.deposit_value);
  const depositPercent =
    Number.isFinite(rawDepositVal) && rawDepositVal >= 0 && rawDepositVal <= 100
      ? rawDepositVal
      : 30;
  const depositAmount = Math.ceil((totalPrice * depositPercent) / 100);

  // Release any overdue holds for this room type immediately before room assignment
  // (protects even if production DB still runs an older fn_check_and_hold_room definition)
  await cleanupStaleHoldsInDb(input.roomTypeId, nowMs, holdMinutes);

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
 * Searches for a booking by Code + Phone/Email (Prevents bulk enumeration).
 * Reflects real-time hold expiration even before cron updates the DB row.
 */
export async function lookupBookingByCode(
  code: string,
  phoneOrEmail: string,
  options?: AvailabilityOptions
) {
  if (!code || !phoneOrEmail) {
    throw new Error('Vui lòng nhập Mã đặt phòng và Số điện thoại hoặc Email');
  }

  const nowMs = options?.nowMs ?? Date.now();
  const holdMinutes = getBookingHoldMinutes(options?.holdMinutes);
  const searchCode = code.trim().toUpperCase();
  const searchContact = phoneOrEmail.trim().toLowerCase();

  if (!isSupabaseConfigured()) {
    const demoMatch = demoHoldBookings.find(
      (b) =>
        (b.temporary_order_code.toUpperCase() === searchCode ||
          (b.confirmation_code && b.confirmation_code.toUpperCase() === searchCode)) &&
        (b.guest_phone.trim().toLowerCase() === searchContact ||
          (b.guest_email && b.guest_email.trim().toLowerCase() === searchContact))
    );
    if (!demoMatch) return null;
    if (isHoldExpiredAt(demoMatch, nowMs, holdMinutes)) {
      return { ...demoMatch, status: 'expired', is_hold_expired: true };
    }
    return demoMatch;
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

  if (!matched) return null;

  if (isHoldExpiredAt(matched, nowMs, holdMinutes)) {
    return {
      ...matched,
      status: 'expired',
      is_hold_expired: true,
    };
  }

  return matched;
}

/**
 * Periodic DB hygiene cleanup (called by daily Vercel Cron /api/cron).
 * Availability does NOT depend on this function; it keeps DB status columns tidy.
 */
export async function expireOverdueHolds(options?: AvailabilityOptions) {
  const nowMs = options?.nowMs ?? Date.now();
  const holdMinutes = getBookingHoldMinutes(options?.holdMinutes);

  if (!isSupabaseConfigured()) {
    const expiredCount = await cleanupStaleHoldsInDb(undefined, nowMs, holdMinutes);
    return { expiredCount, method: 'demo' as const };
  }

  const supabase = getSupabaseServerClient();

  // Primary path: atomic Postgres RPC that cleans up both booking_holds and bookings
  const { data: rpcCount, error: rpcError } = await supabase.rpc('fn_cleanup_expired_holds');

  // Also sweep any pending_payment holds where hold_expires_at was NULL but created_at + BOOKING_HOLD_MINUTES elapsed
  const extraCleaned = await cleanupStaleHoldsInDb(undefined, nowMs, holdMinutes);

  if (!rpcError) {
    const primaryCount = typeof rpcCount === 'number' ? rpcCount : Number(rpcCount || 0);
    return {
      expiredCount: primaryCount + extraCleaned,
      method: 'rpc:fn_cleanup_expired_holds' as const,
    };
  }

  console.warn('[Expire Holds] RPC fn_cleanup_expired_holds unavailable, falling back to table updates:', rpcError.message);

  return {
    expiredCount: extraCleaned,
    method: 'fallback:table_update' as const,
  };
}
