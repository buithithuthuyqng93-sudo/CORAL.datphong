import type { Booking } from '../types';

export const DEFAULT_HOLD_MINUTES = 15;

export function isPendingHoldPaymentStatus(status?: string | null): boolean {
  const s = (status || '').trim().toLowerCase();
  return (
    s === 'pending_deposit' ||
    s === 'temp_hold' ||
    s === 'pending_payment' ||
    s === 'pending' ||
    s === 'hold'
  );
}

export function isTerminalPaymentStatus(status?: string | null): boolean {
  const s = (status || '').trim().toLowerCase();
  return s === 'cancelled' || s === 'checked_out' || s === 'no_show' || s === 'expired';
}

function parseTimestampMs(raw?: string | null): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  // Support both ISO strings and legacy "YYYY-MM-DD HH:mm" timestamps
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : trimmed;
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Computes the strict expiration timestamp (ms) for a local/client booking hold.
 * Enforces BOTH `holdExpiresAt` AND `createdAt + holdMinutes`.
 */
export function getLocalHoldExpiryMs(
  booking: Pick<Booking, 'holdExpiresAt' | 'createdAt'>,
  holdMinutes = DEFAULT_HOLD_MINUTES
): number {
  const explicitMs = parseTimestampMs(booking.holdExpiresAt);
  const createdMs = parseTimestampMs(booking.createdAt);
  const createdExpiryMs = createdMs !== null ? createdMs + holdMinutes * 60 * 1000 : null;

  if (explicitMs !== null && createdExpiryMs !== null) {
    return Math.min(explicitMs, createdExpiryMs);
  }
  if (explicitMs !== null) return explicitMs;
  if (createdExpiryMs !== null) return createdExpiryMs;
  return 0;
}

/**
 * Returns true if a pending/hold booking has already expired at `nowMs`.
 */
export function isLocalHoldExpired(
  booking: Pick<Booking, 'paymentStatus' | 'holdExpiresAt' | 'createdAt'>,
  nowMs = Date.now(),
  holdMinutes = DEFAULT_HOLD_MINUTES
): boolean {
  if (!isPendingHoldPaymentStatus(booking.paymentStatus)) {
    return false;
  }
  return getLocalHoldExpiryMs(booking, holdMinutes) <= nowMs;
}

/**
 * Checks [checkInA, checkOutA) overlap with [checkInB, checkOutB).
 */
export function isDateRangeOverlapping(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string
): boolean {
  return checkInA < checkOutB && checkOutA > checkInB;
}

/**
 * Returns true if a booking actively blocks its assigned room for [checkIn, checkOut) at `nowMs`.
 * Automatically excludes cancelled, checked_out, no_show, and EXPIRED pending/hold bookings.
 */
export function isBookingBlockingRoom(
  booking: Booking,
  checkIn: string,
  checkOut: string,
  nowMs = Date.now(),
  holdMinutes = DEFAULT_HOLD_MINUTES
): boolean {
  if (isTerminalPaymentStatus(booking.paymentStatus)) {
    return false;
  }
  if (isLocalHoldExpired(booking, nowMs, holdMinutes)) {
    return false;
  }
  if (!booking.checkIn || !booking.checkOut) {
    return true;
  }
  return isDateRangeOverlapping(booking.checkIn, booking.checkOut, checkIn, checkOut);
}
