export type RoomStatus = 'available' | 'booked_direct' | 'booked_booking' | 'booked_agoda' | 'maintenance' | 'locked' | 'inactive';
export type HousekeepingStatus = 'clean' | 'cleaning' | 'dirty' | 'inspecting';

export type CmsContentType = 'room' | 'service';

export interface CmsRoomAttributes {
  size?: string;
  areaSqm?: string;
  bedrooms?: number;
  bathrooms?: number;
  hasBalcony?: boolean;
  bedType?: string;
  maxGuests?: number;
  depositPercent?: number;
  amenities?: string[];
}

export interface CmsContentItem {
  id: string;
  contentType: CmsContentType;
  title: string;
  slug: string;
  description: string;
  price: number;
  images: string[]; // images[0] is cover image, images[1..] are secondary gallery images
  attributes: Record<string, any>;
  sortOrder?: number;
  active: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface BookingSearchQuery {
  roomTypeId?: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
  children?: number;
}

export interface RoomType {
  id: string;
  slug?: string;
  name: string;
  description: string;
  basePrice: number; // VND per night
  depositPercent?: number; // Default 30%
  maxGuests: number;
  image: string;
  galleryImages?: string[];
  size: string; // e.g. "21m²"
  bedrooms?: number;
  bathrooms?: number;
  hasBalcony?: boolean;
  bedType: string;
  amenities: string[];
  cleaningTimeMinutes?: number;
  active?: boolean;
  attributes?: Record<string, any>;
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
  isGroupBooking?: boolean;
  groupName?: string;
  assignedRoomIds?: string[];
  assignedRoomNumbers?: string[];
}

// ----------------------------------------------------------------------------
// SEAGULL STAY & CHECK-IN MANAGEMENT (V1.1)
// ----------------------------------------------------------------------------
export type DeclarationStatus = 
  | 'unprocessed'          // Chưa thực hiện
  | 'in_progress'          // Đang xử lý
  | 'awaiting_verification'// Chờ đối chiếu
  | 'verified_completed'   // Đã xác nhận hoàn tất
  | 'needs_revision';      // Cần xử lý lại

export type DocumentCheckType = 'cccd' | 'passport' | 'birth_certificate' | 'other';

export interface StayGuest {
  id: string;
  fullName: string;
  birthYear?: number;
  gender: 'male' | 'female' | 'other';
  nationality: 'VN' | 'FOREIGN';
  nationalityName?: string; // Ví dụ: "Việt Nam", "Pháp", "Úc"
  assignedRoomId: string;
  assignedRoomNumber: string;
  isPrimaryContact?: boolean;
  // Ghi nhận nhân viên kiểm tra giấy tờ trực tiếp (Không lưu số định danh / CCCD)
  documentTypeVerified?: DocumentCheckType;
  isDocumentChecked: boolean;
  checkedByStaff?: string;
  checkedAt?: string;
  documentNotes?: string;
  // Theo dõi tiến độ thông báo/khai báo tạm trú
  declarationStatus: DeclarationStatus;
  declarationReferenceCode?: string; // Mã tham chiếu biên nhận nếu có (tùy chọn)
  declarationVerifiedBy?: string;
  declarationVerifiedAt?: string;
  declarationNotes?: string;
  verificationBasis?: string; // Căn cứ đối chiếu: Biên nhận Cổng TBLT KBTT / Giấy biên nhận CA xã / Tin nhắn DVC...
}

export interface RoomTransferHistory {
  id: string;
  guestId: string;
  guestName: string;
  fromRoomNumber: string;
  toRoomNumber: string;
  transferredAt: string;
  transferredBy: string;
  reason: string;
}

export interface BookingStayRoomAllocation {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  expectedGuests: number;
  actualGuests: number;
  isCheckedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  isCheckedOut: boolean;
  checkedOutAt?: string;
  checkedOutBy?: string;
}

export interface BookingStayRecord {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  isGroupBooking: boolean;
  groupName?: string;
  checkInDate: string;
  checkOutDate: string;
  totalExpectedGuests: number;
  totalActualGuests: number;
  roomAllocations: BookingStayRoomAllocation[];
  guests: StayGuest[];
  transferHistory: RoomTransferHistory[];
  overallCheckInStatus: 'not_checked_in' | 'partially_checked_in' | 'fully_checked_in' | 'checked_out';
  overallDeclarationStatus: DeclarationStatus;
  attentionRequired: boolean;
  attentionReasons: string[];
  notes?: string;
  auditLogs: {
    id: string;
    timestamp: string;
    staffName: string;
    action: string;
    details: string;
  }[];
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

export interface SeasonalPriceRule {
  id: string;
  name: string; // e.g. "Mùa Hè Du Lịch Biển", "Lễ 30/4 - 1/5", "Tết Nguyên Đán"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  roomTypeId: string; // 'all' or specific roomTypeId
  roomTypeName?: string;
  adjustmentType: 'fixed_price' | 'percentage';
  adjustmentValue: number; // e.g. 850000 VND or 25%
  note?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export interface PriceAuditLog {
  id: string;
  timestamp: string;
  staffName: string;
  roomTypeName: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface PolicyVersion {
  id: string;
  version: string; // e.g. "V2.0 (Hiện tại)", "V2.1 (Bản nháp)"
  status: 'draft' | 'approved';
  effectiveDate: string;
  depositPercent: number; // default 30%
  holdTimeMinutes: number; // default 15 mins
  cancellationPolicy: string;
  surchargeExtraAdult: number; // VND / night
  surchargeExtraChild: number; // VND / night
  earlyCheckInFee: number; // VND
  lateCheckOutFee: number; // VND
  draftNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface BankAuditLog {
  id: string;
  timestamp: string;
  staffName: string;
  action: string;
  oldBankInfo: string;
  newBankInfo: string;
  reason: string;
  confirmedByOwner: boolean;
}

export interface SettingsMediaItem {
  id: string;
  name: string;
  url: string;
  targetCategory: 'homepage' | 'cafe' | 'room_type';
  roomTypeId?: string;
  isPrimary?: boolean;
  altText: string;
  fileSizeKb?: number;
  uploadedAt: string;
  uploadedBy: string;
  isLocalDemo?: boolean;
}

export interface SeasonPricingConfig {
  peakSeasonSurchargePercent: number; // Phụ thu mùa cao điểm (Hè / Du lịch biển Lý Sơn)
  lowSeasonDiscountPercent: number; // Chiết khấu mùa thấp điểm (Mùa đông / biển động)
  weekendSurchargePercent: number; // Phụ thu cuối tuần (Thứ 6, Thứ 7)
  holidaySurchargePercent: number; // Phụ thu ngày lễ / Tết
  activeSeasonMode: 'regular' | 'peak' | 'low'; // Mùa áp dụng hiện tại
  seasonNotes?: string;
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
  bankBranch?: string;
  heroTitle: string;
  heroDescription: string;
  announcementBar: string;
  checkInTime: string;
  checkOutTime: string;
  weekendSurchargePercent: number;
  holidaySurchargePercent: number;
  defaultDepositPercent: number;
  holdTimeMinutes?: number;
  surchargeExtraAdult?: number;
  surchargeExtraChild?: number;
  seasonPricing?: SeasonPricingConfig;
  seasonalPriceRules?: SeasonalPriceRule[];
  priceAuditLogs?: PriceAuditLog[];
  policyVersions?: PolicyVersion[];
  bankAuditLogs?: BankAuditLog[];
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
