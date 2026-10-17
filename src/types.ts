export type RoomStatus = 'available' | 'booked_direct' | 'booked_booking' | 'booked_agoda' | 'maintenance' | 'locked' | 'inactive';
export type HousekeepingStatus = 'clean' | 'cleaning' | 'dirty' | 'inspecting';

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
  cleaningTimeMinutes?: number;
}

export interface Room {
  id: string;
  number: string; // e.g., "101", "202", "BG-01"
  floor: number;
  area?: string; // Khu vực: 'Tầng 1 - Vòm Hướng Biển', 'Khu Vách Núi Hoàng Hôn'
  roomTypeId: string;
  status: RoomStatus;
  housekeepingStatus?: HousekeepingStatus;
  currentBookingId?: string;
  notes?: string;
  blockedUntil?: string;
  blockedReason?: string;
  isActive?: boolean;
}

export type PaymentStatus = 
  | 'pending_deposit' 
  | 'temp_hold' 
  | 'paid_deposit' 
  | 'confirmed' 
  | 'cancelled' 
  | 'checked_in' 
  | 'checked_out' 
  | 'no_show';

export type BookingChannel = 
  | 'direct' 
  | 'booking.com' 
  | 'agoda' 
  | 'pms' 
  | 'zalo' 
  | 'facebook' 
  | 'phone' 
  | 'walk_in' 
  | 'other';

export interface Booking {
  id: string;
  code: string; // e.g., "SGL-8921"
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm
  checkOutTime?: string; // HH:mm
  nights: number;
  numGuests?: number;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  totalPrice: number;
  discountAmount?: number;
  depositPercent: number; // 30, 40, 50, 100
  depositAmount: number;
  paidAmount?: number; // Tổng tiền đã thu thực tế
  paymentStatus: PaymentStatus;
  channel: BookingChannel;
  sourceNote?: string;
  createdAt: string;
  transactionRef?: string;
  notes?: string;
  createdBy?: string; // Người tạo đơn (Chủ homestay, Lễ tân Thủy, v.v.)
  holdExpiresAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalStays: number;
  totalSpent: number;
  lastStayDate?: string;
  tier: 'vip' | 'regular' | 'new' | 'flagged';
  notes?: string;
  zaloContact?: string;
  createdAt: string;
}

export interface CashTransaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: 
    | 'deposit' 
    | 'room_balance' 
    | 'cafe_beverage' 
    | 'bike_rental' 
    | 'island_tour' 
    | 'laundry' 
    | 'supplies' 
    | 'utilities' 
    | 'staff_salary' 
    | 'other';
  amount: number;
  title: string;
  bookingCode?: string;
  performedBy: string;
  paymentMethod: 'vietqr' | 'cash' | 'card' | 'bank_transfer';
  notes?: string;
}

export interface StaffUser {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'receptionist' | 'housekeeping';
  pin: string;
  phone: string;
  isActive: boolean;
}

export interface PropertyConfig {
  propertyName: string;
  slogan?: string;
  tagline: string;
  address: string;
  googleMapsUrl?: string;
  hotline: string;
  email?: string;
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
  cancellationPolicy?: string;
  depositPolicy?: string;
  socialLinks?: {
    facebook?: string;
    zalo?: string;
    tiktok?: string;
    instagram?: string;
    googleMaps?: string;
  };
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
