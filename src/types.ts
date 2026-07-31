export type RoomStatus = 'available' | 'booked_direct' | 'booked_booking' | 'booked_agoda' | 'maintenance';
export type HousekeepingStatus = 'clean' | 'cleaning' | 'dirty';

export interface RoomType {
  id: string;
  name: string;
  description: string;
  basePrice: number; // VND per night
  maxGuests: number;
  image: string;
  galleryImages?: string[];
  size: string; // e.g. "28m²"
  bedType: string;
  amenities: string[];
}

export interface Room {
  id: string;
  number: string; // e.g., "101", "202"
  floor: number;
  roomTypeId: string;
  status: RoomStatus;
  housekeepingStatus?: HousekeepingStatus;
  currentBookingId?: string;
  notes?: string;
  blockedUntil?: string;
  blockedReason?: string;
}

export type PaymentStatus = 'pending_deposit' | 'paid_deposit' | 'cancelled' | 'checked_in' | 'checked_out';
export type BookingChannel = 'direct' | 'booking.com' | 'agoda' | 'pms';

export interface Booking {
  id: string;
  code: string; // e.g., "CRL-8921"
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  totalPrice: number;
  depositPercent: number; // 30, 40, 50, 100
  depositAmount: number;
  paymentStatus: PaymentStatus;
  channel: BookingChannel;
  createdAt: string;
  transactionRef?: string;
  notes?: string;
}

export interface PropertyConfig {
  propertyName: string;
  tagline: string;
  address: string;
  hotline: string;
  ownerName: string;
  zaloPhone: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountHolder: string;
  heroTitle: string;
  heroDescription: string;
  announcementBar: string;
  checkInTime: string;
  checkOutTime: string;
  weekendSurchargePercent: number;
  holidaySurchargePercent: number;
  defaultDepositPercent: number;
}

export interface ChannelSyncLog {
  id: string;
  timestamp: string;
  channel: 'Direct Website' | 'Booking.com' | 'Agoda' | 'PMS Local';
  action: string;
  roomNumber: string;
  status: 'synced' | 'pending' | 'error';
  details: string;
}

export interface SolutionModule {
  name: string;
  role: string;
  importance: 'Bắt buộc' | 'Khuyên dùng' | 'Tùy chọn';
  description: string;
  estimatedCostVnd: string;
}

export interface PackageComparison {
  id: string;
  providerName: string;
  packageName: string;
  targetMarket: string;
  setupFee: number;
  monthlyFee: number;
  annualFee: number; // VND
  includesPMS: boolean;
  includesBookingEngine: boolean;
  includesVietQR: boolean;
  includesChannelManager: boolean;
  otaChannelsSupported: string[];
  pros: string[];
  cons: string[];
  isTopRecommendation?: boolean;
}
