/**
 * Real-time Booking Hold Expiration Verification Tests
 * Verifies that abandoned pending/hold bookings are excluded IMMEDIATELY
 * once `created_at + BOOKING_HOLD_MINUTES` (or `hold_expires_at`) elapses,
 * with ZERO dependence on the daily cron job.
 */
import assert from 'node:assert/strict';
import {
  checkAvailableRooms,
  createBookingDraft,
  lookupBookingByCode,
  isBookingHoldActive,
  isHoldExpiredAt,
  getHoldExpiryTimestampMs,
} from '../lib/bookingService.js';
import { isBookingBlockingRoom, isLocalHoldExpired } from '../src/utils/bookingHold.js';
import type { Booking } from '../src/types.js';

async function runTests() {
  const holdMinutes = 15;
  const t0 = new Date('2026-08-01T10:00:00.000Z').getTime();
  const tWithinHold = t0 + 10 * 60 * 1000; // +10m (active)
  const tExpired = t0 + 16 * 60 * 1000; // +16m (past 15m hold, NO cron executed)

  // 1. Pure hold expiry helpers: created_at + BOOKING_HOLD_MINUTES with NULL hold_expires_at
  const noExplicitExpiryRow = {
    status: 'pending_payment',
    hold_expires_at: null,
    created_at: new Date(t0).toISOString(),
  };
  assert.equal(getHoldExpiryTimestampMs(noExplicitExpiryRow, holdMinutes), t0 + 15 * 60 * 1000);
  assert.equal(isBookingHoldActive(noExplicitExpiryRow, tWithinHold, holdMinutes), true);
  assert.equal(isHoldExpiredAt(noExplicitExpiryRow, tWithinHold, holdMinutes), false);
  assert.equal(isBookingHoldActive(noExplicitExpiryRow, tExpired, holdMinutes), false);
  assert.equal(isHoldExpiredAt(noExplicitExpiryRow, tExpired, holdMinutes), true);

  // 2. Confirmed / paid bookings are NEVER expired by hold timeout
  const confirmedRow = {
    status: 'confirmed',
    hold_expires_at: new Date(t0 + 15 * 60 * 1000).toISOString(),
    created_at: new Date(t0).toISOString(),
  };
  assert.equal(isBookingHoldActive(confirmedRow, tExpired, holdMinutes), true);
  assert.equal(isHoldExpiredAt(confirmedRow, tExpired, holdMinutes), false);

  // 3. Client-side utility (src/utils/bookingHold.ts)
  const clientHoldBooking: Booking = {
    id: 'bk-test-client-1',
    code: 'SGL-TEST-01',
    customerName: 'Khách Test',
    customerPhone: '0909000111',
    customerEmail: 'test@example.com',
    checkIn: '2026-08-05',
    checkOut: '2026-08-07',
    nights: 2,
    roomId: 'rm-103',
    roomNumber: '103',
    roomTypeName: 'Bungalow Vòm Ocean View (Cụm Home 1)',
    totalPrice: 1300000,
    depositPercent: 30,
    depositAmount: 390000,
    paymentStatus: 'pending_deposit',
    channel: 'direct',
    createdAt: new Date(t0).toISOString(),
    holdExpiresAt: new Date(t0 + 15 * 60 * 1000).toISOString(),
  };
  assert.equal(isLocalHoldExpired(clientHoldBooking, tWithinHold, holdMinutes), false);
  assert.equal(isBookingBlockingRoom(clientHoldBooking, '2026-08-05', '2026-08-07', tWithinHold, holdMinutes), true);
  assert.equal(isLocalHoldExpired(clientHoldBooking, tExpired, holdMinutes), true);
  assert.equal(isBookingBlockingRoom(clientHoldBooking, '2026-08-05', '2026-08-07', tExpired, holdMinutes), false);

  // 4. Service-level end-to-end simulation (Demo store without calling cron)
  // Temporarily clear Supabase env vars so we deterministically test the in-memory hold flow with simulated clock
  const savedUrl = process.env.SUPABASE_URL;
  const savedViteUrl = process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;

  try {
    const checkIn = '2026-08-05';
    const checkOut = '2026-08-07';
    const roomTypeId = 'type-home1-single';

    const baseline = await checkAvailableRooms(roomTypeId, checkIn, checkOut, {
      nowMs: t0,
      holdMinutes,
    });
    const baselineCount = baseline.availableRooms.length;
    assert.equal(baselineCount, 4, 'Baseline Bungalow Vòm Ocean View in mock inventory should be 4');

    // Create 2 abandoned holds (simulating user clicking "Tiến hành giữ phòng" twice and closing modal)
    const hold1 = await createBookingDraft(
      {
        roomTypeId,
        checkIn,
        checkOut,
        guestName: 'Khách 1',
        phone: '0901111222',
      },
      { nowMs: t0, holdMinutes }
    );
    const hold2 = await createBookingDraft(
      {
        roomTypeId,
        checkIn,
        checkOut,
        guestName: 'Khách 2',
        phone: '0903333444',
      },
      { nowMs: t0 + 1000, holdMinutes }
    );
    assert.notEqual(hold1.booking.roomId, hold2.booking.roomId, 'Two concurrent holds must lock different rooms');

    // During active 15-minute window: available drops 4 -> 2
    const duringHold = await checkAvailableRooms(roomTypeId, checkIn, checkOut, {
      nowMs: tWithinHold,
      holdMinutes,
    });
    assert.equal(duringHold.availableRooms.length, baselineCount - 2, 'Active holds must drop availability 4 -> 2');

    // After 16 minutes WITHOUT running cron: available recovers 2 -> 4 immediately!
    const afterExpiryNoCron = await checkAvailableRooms(roomTypeId, checkIn, checkOut, {
      nowMs: tExpired,
      holdMinutes,
    });
    assert.equal(
      afterExpiryNoCron.availableRooms.length,
      baselineCount,
      'Expired holds must release back to 4 immediately without cron!'
    );

    // Lookup also reflects expired status immediately without cron
    const lookedUp = await lookupBookingByCode(hold1.booking.code, '0901111222', {
      nowMs: tExpired,
      holdMinutes,
    });
    assert.equal(lookedUp?.status, 'expired', 'Lookup must report expired status immediately once hold lapses');

    // A new guest can immediately book the released room without cron
    const hold3 = await createBookingDraft(
      {
        roomTypeId,
        checkIn,
        checkOut,
        guestName: 'Khách 3',
        phone: '0905555666',
      },
      { nowMs: tExpired, holdMinutes }
    );
    assert.equal(hold3.booking.roomId, hold1.booking.roomId, 'Released room must be immediately assignable again');

    console.log(
      `PASS: Baseline=${baselineCount} -> 2 active holds=${duringHold.availableRooms.length} -> After ${holdMinutes + 1}m (no cron)=${afterExpiryNoCron.availableRooms.length} -> Re-assigned room ${hold3.booking.roomNumber}`
    );
  } finally {
    if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
    if (savedViteUrl !== undefined) process.env.VITE_SUPABASE_URL = savedViteUrl;
  }
}

runTests().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
