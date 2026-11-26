import React, { useState, useMemo, useEffect } from 'react';
import { 
  RoomType, Room, Booking, PropertyConfig, ChannelSyncLog,
  Customer, CashTransaction, StaffUser, RoomStatus, PaymentStatus,
  BookingStayRecord, StayGuest, HousekeepingStatus, CmsContentItem
} from '../types';
import { INITIAL_STAY_RECORDS } from '../data/mockData';
import { EXPERIENCE_SERVICES_SEED } from '../data/serviceCatalog';
import { CheckInStayManager } from './CheckInStayManager';
import { SettingsManagerV2 } from './SettingsManagerV2';
import { CheckInFlowModal } from './CheckInFlowModal';
import { RoomCmsManager } from './RoomCmsManager';
import { ServiceCmsManager } from './ServiceCmsManager';
import { 
  LayoutDashboard, BedDouble, DollarSign, BarChart3, Settings, 
  Plus, Search, Lock, Unlock, CheckCircle2, AlertCircle, 
  Calendar, Clock, Download, UserCheck, LogOut, Coffee, 
  FileSpreadsheet, Phone, MapPin, CreditCard, Banknote, 
  QrCode, CalendarCheck, ChevronRight, Filter, ArrowLeft, 
  Eye, EyeOff, X, Tag, Sliders, ArrowUpRight, ArrowDownRight,
  Sparkles, Check, RefreshCw, Smartphone, Edit3, Trash2,
  Shield, User, Compass
} from 'lucide-react';
import { SeagullWingsIcon } from './SeagullWingsIcon';
import { isLocalHoldExpired } from '../utils/bookingHold';

interface AdminManagerProps {
  roomTypes: RoomType[];
  serviceItems?: CmsContentItem[];
  rooms: Room[];
  bookings: Booking[];
  propertyConfig: PropertyConfig;
  syncLogs?: ChannelSyncLog[];
  customers?: Customer[];
  transactions?: CashTransaction[];
  staffList?: StaffUser[];
  onUpdateRoomTypes: (roomTypes: RoomType[]) => void;
  onUpdateServiceItems?: (services: CmsContentItem[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdatePropertyConfig: (config: PropertyConfig) => void;
  onUpdateCustomers?: (customers: Customer[]) => void;
  onUpdateTransactions?: (transactions: CashTransaction[]) => void;
  onUpdateStaffList?: (staff: StaffUser[]) => void;
  onManualBooking?: (booking: Booking, paidAmount?: number) => void;
  isAuthenticated: boolean;
  onAuthenticate: (status: boolean) => void;
  onNavigateToWebsite?: () => void;
}

// Main Navigation Tabs
type AdminTab = 'overview' | 'rooms-bookings' | 'room-cms' | 'service-cms' | 'revenue' | 'reports' | 'settings';

// Preset photo options for quick photo selection
const PHOTO_PRESETS = [
  { name: 'Toàn Cảnh Homestay & Cafe Seagull (Hero)', url: '/images/coral-hero.jpg' },
  { name: 'Toàn Cảnh Cafe Seagull (Góc Ngang)', url: '/images/coral_homestay_cafe_hero.jpg' },
  { name: 'Bungalow Vòm View Biển (Ban Ngày)', url: '/images/bungalow-cliff-day.jpg' },
  { name: 'Dãy Bungalow Hoàng Hôn Cliffside', url: '/images/bungalow-row-sunset.jpg' },
  { name: 'Phòng Vòm Bồn Tắm Panorama Biển', url: '/images/bungalow-bathtub-ocean.jpg' },
  { name: 'Phòng Vòm 2 Giường Đôi Ấm Cúng', url: '/images/bungalow-bedroom-twin.jpg' },
  { name: 'Bungalow Vòm Đèn Vàng Hoàng Hôn', url: '/images/bungalow-sunset-front.jpg' },
];

export const AdminManager: React.FC<AdminManagerProps> = ({
  roomTypes,
  serviceItems = EXPERIENCE_SERVICES_SEED,
  rooms,
  bookings,
  propertyConfig,
  customers = [],
  transactions = [],
  staffList = [],
  onUpdateRoomTypes,
  onUpdateServiceItems,
  onUpdateRooms,
  onUpdateBookings,
  onUpdatePropertyConfig,
  onUpdateCustomers,
  onUpdateTransactions,
  onUpdateStaffList,
  onManualBooking,
  isAuthenticated,
  onAuthenticate,
  onNavigateToWebsite,
}) => {
  // Security & RBAC State (per-staff identity resolved from server signed token)
  const [userRole, setUserRole] = useState<'owner' | 'reception' | 'accountant'>(() => {
    try {
      const r = sessionStorage.getItem('seagull_admin_role');
      if (r === 'reception' || r === 'accountant' || r === 'owner') return r;
    } catch {}
    return 'reception';
  });
  const [rawUserRole, setRawUserRole] = useState<string>(() => {
    try {
      return sessionStorage.getItem('seagull_admin_role') || 'reception';
    } catch {
      return 'reception';
    }
  });
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [serverMode, setServerMode] = useState<'production' | 'staging' | 'demo' | null>(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loginError, setLoginError] = useState<string>('');
  const [currentStaff, setCurrentStaff] = useState<string>(() => {
    try {
      const n = sessionStorage.getItem('seagull_admin_name');
      if (n) return n;
    } catch {}
    return 'Nhân sự Seagull';
  });
  const [currentUsername, setCurrentUsername] = useState<string>(() => {
    try {
      return sessionStorage.getItem('seagull_admin_username') || '';
    } catch {
      return '';
    }
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin?action=db-status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.mode === 'production' || data?.mode === 'staging' || data?.mode === 'demo') {
          setServerMode(data.mode);
        }
      })
      .catch(() => {});
  }, []);

  // Helper to mask customer phone number for non-owner roles
  const maskPhone = (phone?: string) => {
    if (!phone) return '—';
    if (userRole === 'owner') return phone;
    const clean = phone.trim();
    if (clean.length <= 4) return '***';
    return clean.slice(0, 3) + '***' + clean.slice(-3);
  };

  // Helper to mask customer email
  const maskEmailAddress = (email?: string) => {
    if (!email) return '—';
    if (userRole === 'owner') return email;
    const atIdx = email.indexOf('@');
    if (atIdx <= 1) return '***@' + (email.split('@')[1] || 'domain.com');
    return email[0] + '***' + email[atIdx - 1] + email.substring(atIdx);
  };

  // Filter States for Rooms & Bookings tab
  const [roomFilterStatus, setRoomFilterStatus] = useState<string>('all');
  const [roomFilterCluster, setRoomFilterCluster] = useState<string>('all'); // 'all', 'home1', 'home2', 'home3'
  const [roomSearchQuery, setRoomSearchQuery] = useState<string>('');
  const [roomViewMode, setRoomViewMode] = useState<'grid' | 'table'>('grid');
  
  // Stay & Check-in Management States (V1.2)
  const [stayRecords, setStayRecords] = useState<BookingStayRecord[]>(() => {
    try {
      const saved = localStorage.getItem('seagull_stay_records_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_STAY_RECORDS;
  });

  const handleUpdateStayRecords = (newRecords: BookingStayRecord[]) => {
    setStayRecords(newRecords);
    try {
      localStorage.setItem('seagull_stay_records_v2', JSON.stringify(newRecords));
    } catch {}
  };

  // 3-Step Check-In Flow Modal State
  const [checkInModalData, setCheckInModalData] = useState<{
    record: BookingStayRecord;
    booking?: Booking;
    roomNumber?: string;
  } | null>(null);

  const [roomSectionMode, setRoomSectionMode] = useState<'rooms_grid' | 'checkin_stay'>('checkin_stay');

  // Revenue Tab Sub-State
  const [revenueSubTab, setRevenueSubTab] = useState<'all' | 'homestay' | 'coffee'>('all');
  const [revenuePeriod, setRevenuePeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Reports Tab Period
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Settings Sub-Section
  const [settingsSection, setSettingsSection] = useState<'price' | 'roomtypes' | 'photos' | 'policy' | 'contact' | 'account'>('price');

  // Manual Booking Modal State
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    roomId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    depositPercent: 30,
    paymentMethod: 'vietqr' as 'vietqr' | 'cash',
    paidDepositAmount: 0,
    notes: '',
  });

  // Coffee Menu & Quick Sales Mockup Data
  const [coffeeItems] = useState([
    { id: 'c1', name: 'Cà phê muối Lý Sơn', price: 45000, category: 'Cà phê đặc sản' },
    { id: 'c2', name: 'Cà phê cốt dừa vách đá', price: 50000, category: 'Cà phê đặc sản' },
    { id: 'c3', name: 'Dừa xiêm đảo Lý Sơn ướp lạnh', price: 40000, category: 'Giải khát' },
    { id: 'c4', name: 'Trà đào cam sả hoàng hôn', price: 45000, category: 'Trà trái cây' },
    { id: 'c5', name: 'Nước ép dưa hấu / chanh dây đảo', price: 45000, category: 'Nước ép' },
    { id: 'c6', name: 'Bạc xỉu ba tầng bọt mịn', price: 40000, category: 'Cà phê' },
  ]);

  const [coffeeOrders, setCoffeeOrders] = useState([
    { id: 'COF-801', time: '16:45', table: 'Bàn Vách Đá 02', items: '2 Cà phê muối, 1 Dừa xiêm', total: 130000, method: 'vietqr', status: 'completed' },
    { id: 'COF-802', time: '15:20', table: 'Phòng 102 (Home 1)', items: '2 Trà đào cam sả', total: 90000, method: 'cash', status: 'completed' },
    { id: 'COF-803', time: '14:10', table: 'Sân Ngắm Hoàng Hôn 05', items: '1 Cà phê cốt dừa, 1 Dưa xiêm', total: 90000, method: 'vietqr', status: 'completed' },
    { id: 'COF-804', time: '11:30', table: 'Bàn Vách Đá 01', items: '3 Cà phê muối Lý Sơn', total: 135000, method: 'vietqr', status: 'completed' },
    { id: 'COF-805', time: '09:15', table: 'Phòng 204 (Home 2)', items: '2 Bạc xỉu ba tầng', total: 80000, method: 'cash', status: 'completed' },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Secure Per-Staff Login handler (username/email + personal password verified against Supabase user_roles)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanUsername = usernameInput.trim();
    const cleanPassword = passwordInput.trim();

    if (!cleanUsername || !cleanPassword) {
      setLoginError('Vui lòng nhập đầy đủ Tên đăng nhập (hoặc Email) và Mật khẩu cá nhân.');
      return;
    }

    if (
      cleanPassword === '8888' ||
      cleanPassword === '1234' ||
      cleanPassword === '5678' ||
      cleanPassword === '0868011799' ||
      cleanPassword === '0981065065'
    ) {
      setLoginError('Mã PIN cũ (8888, 1234, 5678) đã bị vô hiệu hóa vì lý do bảo mật. Vui lòng đăng nhập bằng tài khoản cá nhân.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        const mappedUiRole: 'owner' | 'reception' | 'accountant' =
          data.role === 'owner' ? 'owner' : data.role === 'accountant' ? 'accountant' : 'reception';

        sessionStorage.setItem('seagull_admin_token', data.token);
        sessionStorage.setItem('seagull_admin_role', data.role);
        sessionStorage.setItem('seagull_admin_name', data.name);
        sessionStorage.setItem('seagull_admin_username', data.username || cleanUsername);
        if (data.userId) {
          sessionStorage.setItem('seagull_admin_userid', data.userId);
        }

        setUserRole(mappedUiRole);
        setRawUserRole(data.role);
        setCurrentStaff(data.name);
        setCurrentUsername(data.username || cleanUsername);
        setPasswordInput('');
        onAuthenticate(true);
        showToast(data.message || `Đăng nhập thành công: ${data.name} (@${data.username})`);
      } else {
        setLoginError(data.error || 'Sai tên đăng nhập hoặc mật khẩu. Vui lòng thử lại.');
      }
    } catch {
      setLoginError('Không thể kết nối máy chủ xác thực (/api/admin). Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('seagull_admin_token');
    sessionStorage.removeItem('seagull_admin_role');
    sessionStorage.removeItem('seagull_admin_name');
    sessionStorage.removeItem('seagull_admin_username');
    sessionStorage.removeItem('seagull_admin_userid');
    onAuthenticate(false);
    setPasswordInput('');
    setCurrentUsername('');
    showToast('Đã khóa phiên quản trị an toàn!');
  };

  // Helper calculations for 20 active dome rooms
  const activeRooms = useMemo(() => {
    return rooms.filter(r => r.isActive !== false);
  }, [rooms]);

  // Status mapping helper
  // Normalizing room status into 6 defined categories:
  // 1. Trống (available)
  // 2. Giữ chỗ / Chờ cọc (temp_hold / pending_deposit)
  // 3. Đã chốt (booked_direct / confirmed)
  // 4. Đang ở (checked_in / in-house)
  // 5. Đã khóa (locked)
  // 6. Bảo trì (maintenance)
  const getNormalizedStatus = (room: Room): {
    statusKey: 'available' | 'hold' | 'confirmed' | 'in_house' | 'locked' | 'maintenance';
    label: string;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
  } => {
    if (room.status === 'locked') {
      return { statusKey: 'locked', label: 'Đã khóa', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700', borderColor: 'border-slate-300' };
    }
    if (room.status === 'maintenance') {
      return { statusKey: 'maintenance', label: 'Bảo trì', badgeBg: 'bg-rose-50', badgeText: 'text-rose-700', borderColor: 'border-rose-300' };
    }
    // Check attached active booking if any (automatically excludes expired pending/hold bookings in real time)
    const nowMs = Date.now();
    const booking = bookings.find(
      (b) =>
        b.roomId === room.id &&
        b.paymentStatus !== 'cancelled' &&
        b.paymentStatus !== 'checked_out' &&
        b.paymentStatus !== 'no_show' &&
        !isLocalHoldExpired(b, nowMs)
    );
    if (booking) {
      if (booking.paymentStatus === 'checked_in') {
        return { statusKey: 'in_house', label: 'Đang ở', badgeBg: 'bg-blue-50', badgeText: 'text-blue-800', borderColor: 'border-blue-400' };
      }
      if (booking.paymentStatus === 'paid_deposit' || booking.paymentStatus === 'confirmed') {
        return { statusKey: 'confirmed', label: 'Đã chốt (Cọc 30%)', badgeBg: 'bg-sky-50', badgeText: 'text-sky-800', borderColor: 'border-sky-300' };
      }
      if (booking.paymentStatus === 'temp_hold' || booking.paymentStatus === 'pending_deposit') {
        return { statusKey: 'hold', label: 'Giữ chỗ (Chờ cọc)', badgeBg: 'bg-amber-50', badgeText: 'text-amber-800', borderColor: 'border-amber-300' };
      }
    }
    if (room.status === 'available') {
      return { statusKey: 'available', label: 'Trống', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-800', borderColor: 'border-emerald-300' };
    }
    return { statusKey: 'confirmed', label: 'Đã chốt', badgeBg: 'bg-sky-50', badgeText: 'text-sky-800', borderColor: 'border-sky-300' };
  };

  // KPI Calculations
  const kpiData = useMemo(() => {
    let availableCount = 0;
    let holdCount = 0;
    let confirmedToday = 0;
    let inHouseCount = 0;

    activeRooms.forEach(r => {
      const { statusKey } = getNormalizedStatus(r);
      if (statusKey === 'available') availableCount++;
      if (statusKey === 'hold') holdCount++;
      if (statusKey === 'confirmed') confirmedToday++;
      if (statusKey === 'in_house') inHouseCount++;
    });

    // Today revenue mockup: Homestay revenue + Coffee today
    const coffeeTodayRevenue = coffeeOrders.reduce((sum, o) => sum + o.total, 0);
    const homestayTodayRevenue = 4650000; // Realistic sample day
    const totalTodayRevenue = homestayTodayRevenue + coffeeTodayRevenue;

    return {
      availableCount,
      confirmedToday,
      inHouseCount,
      holdCount,
      totalTodayRevenue,
      homestayTodayRevenue,
      coffeeTodayRevenue,
    };
  }, [activeRooms, bookings, coffeeOrders]);

  // Quick Action: Toggle Lock / Unlock Room
  const handleToggleRoomLock = (room: Room) => {
    const newStatus: RoomStatus = room.status === 'locked' ? 'available' : 'locked';
    const updated = rooms.map(r => r.id === room.id ? { ...r, status: newStatus } : r);
    onUpdateRooms(updated);
    showToast(newStatus === 'locked' ? `Đã khóa phòng ${room.number}` : `Đã mở khóa phòng ${room.number}`);
  };

  // Open 3-Step Check-In Flow Modal
  const handleOpenCheckInModal = (target: Room | BookingStayRecord, roomNumberParam?: string) => {
    // Check role restrictions: Accountant has no access to guest ID documents
    if (userRole === 'accountant') {
      showToast('Tài khoản Kế toán không được phân quyền truy cập hồ sơ giấy tờ khách lưu trú.');
    }

    // 1. If target is already a BookingStayRecord
    if ('bookingId' in target) {
      const bRecord = target as BookingStayRecord;
      const attachedBooking = bookings.find(b => b.id === bRecord.bookingId || b.code === bRecord.bookingCode);
      setCheckInModalData({
        record: bRecord,
        booking: attachedBooking,
        roomNumber: roomNumberParam,
      });
      return;
    }

    // 2. If target is a Room
    const room = target as Room;
    const attachedBooking = bookings.find(b => b.roomId === room.id && b.paymentStatus !== 'cancelled' && b.paymentStatus !== 'checked_out')
      || bookings.find(b => b.roomId === room.id);

    if (!attachedBooking) {
      showToast(`Phòng ${room.number} hiện chưa có đơn đặt phòng nào. Hãy tạo đơn đặt phòng trước khi Check-in.`);
      return;
    }

    // Find existing stay record for this booking, or create a clean one
    let existingRecord = stayRecords.find(r => r.bookingId === attachedBooking.id || r.bookingCode === attachedBooking.code);
    if (!existingRecord) {
      const guestCount = attachedBooking.numGuests || 2;
      const defaultGuests: StayGuest[] = [
        {
          id: `gst-${Date.now()}-1`,
          fullName: attachedBooking.customerName,
          birthYear: 1993,
          gender: 'male',
          nationality: 'VN',
          nationalityName: 'Việt Nam',
          assignedRoomId: room.id,
          assignedRoomNumber: room.number,
          isPrimaryContact: true,
          isDocumentChecked: false,
          declarationStatus: 'unprocessed',
          documentNotes: 'Khách đại diện đặt phòng',
        }
      ];

      for (let i = 2; i <= guestCount; i++) {
        defaultGuests.push({
          id: `gst-${Date.now()}-${i}`,
          fullName: `Khách đi cùng ${i} (${attachedBooking.customerName})`,
          birthYear: 1995,
          gender: i % 2 === 0 ? 'female' : 'male',
          nationality: 'VN',
          nationalityName: 'Việt Nam',
          assignedRoomId: room.id,
          assignedRoomNumber: room.number,
          isPrimaryContact: false,
          isDocumentChecked: false,
          declarationStatus: 'unprocessed',
        });
      }

      existingRecord = {
        bookingId: attachedBooking.id,
        bookingCode: attachedBooking.code,
        customerName: attachedBooking.customerName,
        customerPhone: attachedBooking.customerPhone,
        customerEmail: attachedBooking.customerEmail,
        isGroupBooking: false,
        checkInDate: attachedBooking.checkIn,
        checkOutDate: attachedBooking.checkOut,
        totalExpectedGuests: guestCount,
        totalActualGuests: guestCount,
        roomAllocations: [
          {
            roomId: room.id,
            roomNumber: room.number,
            roomTypeName: attachedBooking.roomTypeName || 'Bungalow Mái Vòm View Biển',
            expectedGuests: guestCount,
            actualGuests: guestCount,
            isCheckedIn: false,
            isCheckedOut: false,
          }
        ],
        guests: defaultGuests,
        transferHistory: [],
        overallCheckInStatus: 'not_checked_in',
        overallDeclarationStatus: 'unprocessed',
        attentionRequired: false,
        attentionReasons: [],
        auditLogs: [
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            staffName: currentStaff,
            action: 'CREATED_STAY_RECORD',
            details: `Khởi tạo hồ sơ lưu trú từ đơn phòng ${attachedBooking.code} (Phòng ${room.number})`,
          }
        ]
      };

      handleUpdateStayRecords([existingRecord, ...stayRecords]);
    }

    setCheckInModalData({
      record: existingRecord,
      booking: attachedBooking,
      roomNumber: room.number,
    });
  };

  // Save updated stay record from modal and sync room/booking status
  const handleSaveCheckInRecord = (updatedRecord: BookingStayRecord, checkedRoomNumbers?: string) => {
    // 1. Update stay records list and persist
    const exists = stayRecords.some(r => r.bookingId === updatedRecord.bookingId);
    const updatedStayList = exists 
      ? stayRecords.map(r => r.bookingId === updatedRecord.bookingId ? updatedRecord : r)
      : [updatedRecord, ...stayRecords];
    handleUpdateStayRecords(updatedStayList);

    // 2. Identify all checked-in rooms from allocations
    const checkedInAllocations = updatedRecord.roomAllocations.filter(a => a.isCheckedIn);
    const checkedInRoomNumbers = checkedInAllocations.map(a => a.roomNumber);

    // 3. Update room status in rooms state
    const updatedRooms = rooms.map(room => {
      if (checkedInRoomNumbers.includes(room.number)) {
        return {
          ...room,
          status: 'booked_direct' as RoomStatus,
          currentBookingId: updatedRecord.bookingId,
          housekeepingStatus: 'clean' as HousekeepingStatus,
        };
      }
      return room;
    });
    onUpdateRooms(updatedRooms);

    // 4. Update booking payment status (if overall is fully checked-in)
    const booking = bookings.find(b => b.id === updatedRecord.bookingId || b.code === updatedRecord.bookingCode);
    if (booking) {
      const isAllDone = updatedRecord.overallCheckInStatus === 'fully_checked_in';
      const updatedBookings = bookings.map(b => 
        b.id === booking.id 
          ? { ...b, paymentStatus: (isAllDone ? 'checked_in' : b.paymentStatus) as PaymentStatus }
          : b
      );
      onUpdateBookings(updatedBookings);
    }

    setCheckInModalData(null);
  };

  // Quick Action: Check-In Room via 3-step modal
  const handleQuickCheckIn = (room: Room) => {
    handleOpenCheckInModal(room);
  };

  // Quick Action: Check-Out Room (Never mark clean automatically, move to dirty/cleaning)
  const handleQuickCheckOut = (room: Room) => {
    const booking = bookings.find(b => b.roomId === room.id && b.paymentStatus !== 'cancelled' && b.paymentStatus !== 'checked_out');
    if (booking) {
      const updatedBookings = bookings.map(b => b.id === booking.id ? { ...b, paymentStatus: 'checked_out' as PaymentStatus } : b);
      onUpdateBookings(updatedBookings);
    }
    // Room status moves to maintenance with housekeepingStatus: dirty (Chờ dọn dẹp vệ sinh)
    const updatedRooms = rooms.map(r => r.id === room.id ? { 
      ...r, 
      status: 'maintenance' as RoomStatus, 
      housekeepingStatus: 'dirty' as HousekeepingStatus,
      currentBookingId: undefined,
      notes: `Vừa Check-out lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Chờ buồng phòng dọn dẹp vệ sinh.`
    } : r);
    onUpdateRooms(updatedRooms);
    showToast(`Đã làm thủ tục Check-out phòng ${room.number}. Phòng đã chuyển sang trạng thái CHỜ DỌN DẸP (Dirty), chưa sẵn sàng đón khách.`);
  };

  // Manual Booking submission
  const handleManualBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.roomId) {
      alert('Vui lòng chọn phòng cần đặt');
      return;
    }
    const selectedRoom = rooms.find(r => r.id === manualForm.roomId);
    if (!selectedRoom) return;

    const rType = roomTypes.find(t => t.id === selectedRoom.roomTypeId);
    const pricePerNight = rType ? rType.basePrice : 750000;
    const checkInDate = new Date(manualForm.checkIn);
    const checkOutDate = new Date(manualForm.checkOut);
    const diffDays = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
    const totalPrice = pricePerNight * diffDays;
    const depositAmount = Math.round(totalPrice * (manualForm.depositPercent / 100));

    const newBooking: Booking = {
      id: `man-${Date.now()}`,
      code: `SGL-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: manualForm.customerName || 'Khách đặt trực tiếp',
      customerPhone: manualForm.customerPhone || '0981065065',
      customerEmail: manualForm.customerEmail || 'khach@seagull.com',
      checkIn: manualForm.checkIn,
      checkOut: manualForm.checkOut,
      nights: diffDays,
      numGuests: 2,
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.number,
      roomTypeName: rType?.name || 'Bungalow Mái Vòm',
      totalPrice,
      depositPercent: manualForm.depositPercent,
      depositAmount,
      paidAmount: manualForm.paidDepositAmount > 0 ? manualForm.paidDepositAmount : depositAmount,
      paymentStatus: 'paid_deposit',
      channel: 'walk_in',
      createdAt: new Date().toISOString(),
      notes: manualForm.notes || 'Bán phòng thủ công tại quầy lễ tân',
      createdBy: currentStaff,
    };

    if (onManualBooking) {
      onManualBooking(newBooking, newBooking.paidAmount);
    } else {
      onUpdateBookings([newBooking, ...bookings]);
      const updatedRooms = rooms.map(r => r.id === selectedRoom.id ? { ...r, status: 'booked_direct' as RoomStatus, currentBookingId: newBooking.id } : r);
      onUpdateRooms(updatedRooms);
    }

    setIsManualBookingOpen(false);
    showToast(`Đã bán phòng thủ công thành công! Mã đơn: ${newBooking.code}`);
  };

  // CSV Export function for reports
  const handleExportCSV = () => {
    const csvRows = [
      ['BÁO CÁO DOANH THU & ĐẶT PHÒNG - SEAGULL LÝ SƠN HOMESTAY & COFFEE'],
      ['Kỳ báo cáo:', reportPeriod.toUpperCase(), 'Ngày xuất:', new Date().toLocaleDateString('vi-VN')],
      [],
      ['Mã đơn', 'Khách hàng', 'SĐT', 'Phòng', 'Loại phòng', 'Check-in', 'Check-out', 'Tổng tiền (VND)', 'Đã cọc 30%', 'Còn lại 70%', 'Trạng thái', 'Kênh'],
    ];

    bookings.forEach(b => {
      csvRows.push([
        b.code,
        `"${b.customerName}"`,
        `"${maskPhone(b.customerPhone)}"`,
        b.roomNumber,
        `"${b.roomTypeName}"`,
        b.checkIn,
        b.checkOut,
        b.totalPrice.toString(),
        b.depositAmount.toString(),
        (b.totalPrice - (b.paidAmount || b.depositAmount)).toString(),
        b.paymentStatus,
        b.channel
      ]);
    });

    const csvContent = '\uFEFF' + csvRows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `seagull_bao_cao_${reportPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã tải xuống file báo cáo Excel/CSV thành công!');
  };

  // --------------------------------------------------------------------------
  // SCREEN 1: SECURE PER-STAFF AUTHENTICATION GUARD (USERNAME/EMAIL + PASSWORD)
  // --------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4 selection:bg-[#C8A261] selection:text-white">
        <div className="w-full max-w-md bg-white border border-[#E5DECE] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#0E2A47] via-[#C8A261] to-[#0E2A47]" />

          <div className="text-center space-y-3 mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0E2A47] text-[#C8A261] flex items-center justify-center shadow-lg shadow-[#0E2A47]/10">
              <SeagullWingsIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-[#0E2A47] uppercase tracking-wide">
                SEAGULL LÝ SƠN
              </h1>
              <p className="text-xs text-[#8C7E6C] font-medium mt-1">
                Đăng Nhập Tài Khoản Nhân Sự PMS • Nhật Ký Theo Từng Cá Nhân
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="block text-xs font-bold uppercase tracking-wider text-[#0E2A47] mb-1.5">
                Tên Đăng Nhập Hoặc Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#8C7E6C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="vd: owner, letan.truc, ketoan.lan@seagull.lyson"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl pl-10 pr-4 py-3 text-sm text-[#0E2A47] placeholder-[#A39687] focus:outline-none focus:border-[#C8A261] focus:ring-2 focus:ring-[#C8A261]/20 font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-bold uppercase tracking-wider text-[#0E2A47] mb-1.5">
                Mật Khẩu Cá Nhân
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8C7E6C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Nhập mật khẩu tài khoản của bạn..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl pl-10 pr-11 py-3 text-sm text-[#0E2A47] placeholder-[#A39687] focus:outline-none focus:border-[#C8A261] focus:ring-2 focus:ring-[#C8A261]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E6C] hover:text-[#0E2A47] p-1"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mt-2.5 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl text-[11px] text-[#6E6458] leading-relaxed">
              Vai trò phân quyền (Chủ cơ sở / Lễ tân / Kế toán) được áp tự động theo tài khoản cá nhân của bạn và mọi thao tác đều ghi nhận trong nhật ký kiểm toán.
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-[#0E2A47] hover:bg-[#163A5F] disabled:opacity-60 text-[#FAF8F5] font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-[#C8A261]" />
              <span>{isLoggingIn ? 'Đang Xác Thực...' : 'Đăng Nhập Hệ Thống Quản Trị'}</span>
            </button>

            {onNavigateToWebsite && (
              <button
                type="button"
                onClick={onNavigateToWebsite}
                className="w-full pt-3 border-t border-[#E5DECE] text-xs text-[#8C7E6C] hover:text-[#0E2A47] flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Website Khách Hàng (Trang chủ)</span>
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 2: MAIN BOUTIQUE MINIMAL ADMIN DASHBOARD (5 TABS)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E293B] font-sans antialiased flex flex-col lg:flex-row selection:bg-[#C8A261] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0E2A47] text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-[#C8A261]/50 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#C8A261]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 1. SIDEBAR (5 MỤC CHUẨN: TỔNG QUAN, PHÒNG, DOANH THU, BÁO CÁO, CÀI ĐẶT) */}
      {/* ------------------------------------------------------------------- */}
      <aside className="w-full lg:w-64 bg-[#0E2A47] text-white flex flex-col justify-between shrink-0 lg:h-screen lg:sticky lg:top-0 shadow-xl border-r border-[#163A5F]">
        <div>
          {/* Brand & Property Info */}
          <div className="p-5 border-b border-[#163A5F] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8A261] to-[#9E7A3B] flex items-center justify-center text-[#0E2A47] shadow-md shadow-[#C8A261]/20">
                <SeagullWingsIcon className="w-6 h-6 text-[#0E2A47]" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-sm tracking-wider uppercase text-white">
                  SEAGULL LÝ SƠN
                </h2>
                <p className="text-[10px] text-[#C8A261] font-semibold tracking-wider uppercase">
                  Homestay & Coffee
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Khóa quản trị"
              className="lg:hidden p-1.5 text-slate-400 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* User shift info */}
          <div className="px-5 py-3 bg-[#0A1E33] border-b border-[#163A5F] space-y-0.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#A39687] shrink-0">Nhân sự:</span>
              <span className="font-semibold text-[#E2C799] truncate text-[11px]">{currentStaff}</span>
            </div>
            {currentUsername && (
              <div className="text-[10px] text-slate-400 font-mono text-right truncate">
                @{currentUsername}
              </div>
            )}
          </div>

          {/* 5 Main Navigation Items */}
          <nav className="p-3 space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#C8A261] text-[#0E2A47] shadow-md shadow-[#C8A261]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#163A5F]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>1. Tổng quan</span>
            </button>

            <button
              onClick={() => setActiveTab('rooms-bookings')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'rooms-bookings'
                  ? 'bg-[#C8A261] text-[#0E2A47] shadow-md shadow-[#C8A261]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#163A5F]'
              }`}
            >
              <div className="flex items-center gap-3">
                <BedDouble className="w-4 h-4 shrink-0" />
                <span>2. Phòng & Đặt phòng</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'rooms-bookings' ? 'bg-[#0E2A47] text-[#C8A261]' : 'bg-[#163A5F] text-slate-300'
              }`}>
                {activeRooms.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('room-cms')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'room-cms'
                  ? 'bg-[#C8A261] text-[#0E2A47] shadow-md shadow-[#C8A261]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#163A5F]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Edit3 className="w-4 h-4 shrink-0" />
                <span>3. Quản lý Phòng</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'room-cms' ? 'bg-[#0E2A47] text-[#C8A261]' : 'bg-[#163A5F] text-slate-300'
              }`}>
                {roomTypes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('service-cms')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'service-cms'
                  ? 'bg-[#C8A261] text-[#0E2A47] shadow-md shadow-[#C8A261]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#163A5F]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Compass className="w-4 h-4 shrink-0" />
                <span>4. Quản lý Dịch vụ</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'service-cms' ? 'bg-[#0E2A47] text-[#C8A261]' : 'bg-[#163A5F] text-slate-300'
              }`}>
                {serviceItems.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('revenue')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'revenue'
                  ? 'bg-[#C8A261] text-[#0E2A47] shadow-md shadow-[#C8A261]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#163A5F]'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>5. Doanh thu</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'reports'
                  ? 'bg-[#C8A261] text-[#0E2A47] shadow-md shadow-[#C8A261]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#163A5F]'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>6. Báo cáo</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'settings'
                  ? 'bg-[#C8A261] text-[#0E2A47] shadow-md shadow-[#C8A261]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#163A5F]'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>7. Cài đặt</span>
            </button>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-[#163A5F] space-y-2">
          <button
            onClick={() => setIsManualBookingOpen(true)}
            className="w-full bg-[#C8A261] hover:bg-[#B38D4F] text-[#0E2A47] font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Bán Phòng Thủ Công</span>
          </button>

          {onNavigateToWebsite && (
            <button
              onClick={onNavigateToWebsite}
              className="w-full bg-[#0A1E33] hover:bg-[#163A5F] text-slate-300 hover:text-white text-xs font-semibold py-2 rounded-xl border border-[#163A5F] flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Xem Website Khách (/)</span>
            </button>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{activeRooms.length} Phòng Mở Bán (GĐ1)</span>
            </span>
            <button onClick={handleLogout} className="hover:text-rose-400 transition-colors">
              Khóa
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA */}
      {/* ------------------------------------------------------------------- */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        {/* ============================================================= */}
        {/* TOP SECURITY & RUNTIME AUDIT BANNER */}
        {/* ============================================================= */}
        <div className="mb-6 bg-white border border-[#E5DECE] rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {serverMode === 'production' ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>PRODUCTION LIVE</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>DEMO MODE</span>
              </span>
            )}
            <span className="text-[#0E2A47] font-medium">
              Phiên ký HMAC-SHA256 • Ghi nhận thao tác theo từng tài khoản nhân sự
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#D5CBBF]">
              <Shield className="w-3.5 h-3.5 text-[#C8A261]" />
              <span className="text-[#8C7E6C]">Tài khoản:</span>
              <strong className="text-[#0E2A47]">
                {currentStaff}
                {currentUsername ? ` (@${currentUsername})` : ''}
              </strong>
              <span className="text-[#8C7E6C]">·</span>
              <span className="font-bold text-[#0E2A47]">
                {rawUserRole === 'owner'
                  ? '👑 Chủ Cơ Sở'
                  : rawUserRole === 'accountant'
                  ? '📊 Kế Toán'
                  : rawUserRole === 'housekeeping'
                  ? '🧹 Buồng Phòng'
                  : rawUserRole === 'coffee_staff'
                  ? '☕ Quầy Cà Phê'
                  : '🛎️ Lễ Tân'}
              </span>
            </div>

            {userRole === 'reception' && (
              <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>PII Masking Đã Bật</span>
              </span>
            )}

            <button
              onClick={handleLogout}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline transition-colors ml-1"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E5DECE]">
          <div>
            <h1 className="text-xl lg:text-2xl font-serif font-bold text-[#0E2A47]">
              {activeTab === 'overview' && 'Tổng Quan Tình Hình Homestay & Cafe'}
              {activeTab === 'rooms-bookings' && 'Quản Lý Phòng & Danh Sách Đặt Phòng'}
              {activeTab === 'room-cms' && 'Quản Lý Phòng (CMS Ảnh, Giá & Thuộc Tính)'}
              {activeTab === 'service-cms' && 'Quản Lý Dịch Vụ (CMS Ảnh & Mô Tả Trải Nghiệm)'}
              {activeTab === 'revenue' && 'Báo Cáo Doanh Thu (Homestay & Coffee)'}
              {activeTab === 'reports' && 'Báo Cáo Hoạt Động & Xuất Dữ Liệu Excel'}
              {activeTab === 'settings' && 'Cài Đặt Hệ Thống & Bảng Giá'}
            </h1>
            <p className="text-xs text-[#8C7E6C] mt-0.5">
              Địa chỉ: {propertyConfig.address} • Hotline: {propertyConfig.hotline}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsManualBookingOpen(true)}
              className="bg-[#0E2A47] hover:bg-[#163A5F] text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 text-[#C8A261]" />
              <span>Tạo Booking Mới</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: TỔNG QUAN (4 KPI CARDS, BẢNG/LỊCH PHÒNG, DOANH THU NHANH, VIỆC CẦN LÀM) */}
        {/* ================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {/* Card 1: Phòng trống hôm nay */}
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm hover:border-[#C8A261] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E6C]">Phòng trống hôm nay</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <BedDouble className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#0E2A47]">{kpiData.availableCount}</span>
                  <span className="text-xs text-[#8C7E6C]">/ {activeRooms.length} phòng GĐ1</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">
                  Sẵn sàng đón khách mới
                </p>
              </div>

              {/* Card 2: Đã chốt hôm nay */}
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm hover:border-[#C8A261] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E6C]">Đã chốt hôm nay</span>
                  <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-sky-700">{kpiData.confirmedToday}</span>
                  <span className="text-xs text-[#8C7E6C]">phòng đã cọc</span>
                </div>
                <p className="text-[11px] text-sky-800 font-medium mt-1">
                  Cọc chuẩn 30% VietQR
                </p>
              </div>

              {/* Card 3: Đang lưu trú */}
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm hover:border-[#C8A261] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E6C]">Đang lưu trú</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-blue-900">{kpiData.inHouseCount}</span>
                  <span className="text-xs text-[#8C7E6C]">khách tại đảo</span>
                </div>
                <p className="text-[11px] text-blue-800 font-medium mt-1">
                  Đã check-in nhận phòng
                </p>
              </div>

              {/* Card 4: Doanh thu hôm nay */}
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm hover:border-[#C8A261] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E6C]">Doanh thu hôm nay</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[#0E2A47]">
                    {kpiData.totalTodayRevenue.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-xs font-bold text-[#C8A261]">đ</span>
                </div>
                <p className="text-[11px] text-[#8C7E6C] font-medium mt-1">
                  Phòng: {(kpiData.homestayTodayRevenue / 1000000).toFixed(1)}Tr • Cafe: {(kpiData.coffeeTodayRevenue / 1000).toFixed(0)}k
                </p>
              </div>
            </div>

            {/* Middle Section: Sơ đồ/Lịch phòng tương tác & Khối việc cần làm hôm nay */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bảng/Lịch Phòng Mái Vòm (2/3 width) */}
              <div className="lg:col-span-2 bg-white border border-[#E5DECE] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                      Bảng Trạng Thái {activeRooms.length} Phòng Giai Đoạn 1 Hôm Nay
                    </h3>
                    <p className="text-xs text-[#8C7E6C]">
                      Home 1 (7 phòng: 101-107) • Home 2 (6 phòng: 201-206) • Home 3 (8 phòng: 301-308) • Home 4 Lầu Cafe (6 phòng: 401-406)
                    </p>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">Trống</span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">Chờ cọc</span>
                    <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-semibold">Đã chốt</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">Đang ở</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">Đã khóa</span>
                  </div>
                </div>

                {/* Interactive Room Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                  {activeRooms.map(room => {
                    const statusInfo = getNormalizedStatus(room);
                    const booking = bookings.find(b => b.roomId === room.id && b.paymentStatus !== 'cancelled');

                    return (
                      <div
                        key={room.id}
                        className={`p-3 rounded-xl border transition-all ${statusInfo.borderColor} ${statusInfo.badgeBg} hover:shadow-md flex flex-col justify-between`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-[#0E2A47] block">
                              P.{room.number}
                            </span>
                            <span className="text-[10px] text-[#8C7E6C] line-clamp-1">
                              {room.area || 'Mái Vòm'}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusInfo.badgeBg} ${statusInfo.badgeText}`}>
                            {statusInfo.label}
                          </span>
                        </div>

                        {booking ? (
                          <div className="mt-2 pt-2 border-t border-black/5 text-[11px]">
                            <p className="font-semibold text-[#0E2A47] truncate">{booking.customerName}</p>
                            <p className="text-[10px] text-[#8C7E6C] flex items-center gap-1">
                              <span>{maskPhone(booking.customerPhone)}</span>
                              {userRole !== 'owner' && <Lock className="w-2.5 h-2.5 text-slate-400" title="Đã ẩn vì bảo mật" />}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2 pt-2 border-t border-black/5 text-[10px] text-emerald-700 font-medium">
                            {room.status === 'locked' ? 'Khóa tạm' : 'Có thể bán ngay'}
                          </div>
                        )}

                        <div className="mt-2.5 flex items-center justify-end gap-1.5 pt-1.5 border-t border-black/5">
                          <button
                            onClick={() => handleToggleRoomLock(room)}
                            title={room.status === 'locked' ? 'Mở khóa phòng' : 'Khóa phòng'}
                            className="p-1 rounded hover:bg-black/10 text-slate-600 text-[10px]"
                          >
                            {room.status === 'locked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>

                          {statusInfo.statusKey === 'confirmed' && (
                            <button
                              onClick={() => handleQuickCheckIn(room)}
                              className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold"
                            >
                              Check-in
                            </button>
                          )}

                          {statusInfo.statusKey === 'in_house' && (
                            <button
                              onClick={() => handleQuickCheckOut(room)}
                              className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-semibold"
                            >
                              Check-out
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Khối Việc Cần Làm Hôm Nay (1/3 width) */}
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-serif font-bold text-base text-[#0E2A47] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#C8A261]" />
                      Việc Cần Làm Hôm Nay
                    </h3>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      4 nhiệm vụ
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                        <span>Check-in 14:00 (2 phòng)</span>
                        <span className="text-[10px] text-blue-700 font-mono">P.103, P.201</span>
                      </div>
                      <p className="text-xs text-blue-800">
                        Khách đoàn tàu cao tốc An Vĩnh cập bến 13:30, chuẩn bị xe điện đón khách.
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                        <span>Chờ cọc 30% (1 đơn)</span>
                        <span className="text-[10px] text-amber-700 font-mono">15:00 hết hạn</span>
                      </div>
                      <p className="text-xs text-amber-800">
                        Đơn SGL-4821 đặt phòng Bungalow Vòm View Biển P.101, chờ quét mã VietQR.
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                        <span>Check-out 12:00 (1 phòng)</span>
                        <span className="text-[10px] text-emerald-700 font-mono">P.302</span>
                      </div>
                      <p className="text-xs text-emerald-800">
                        Khách trả phòng đón tàu về đất liền. Kiểm tra thanh toán nốt 70% và tiền cafe.
                      </p>
                    </div>

                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                        <span>Seagull Sunset Lounge (16:30)</span>
                        <span className="text-[10px] text-purple-700 font-mono">Coffee bar</span>
                      </div>
                      <p className="text-xs text-purple-800">
                        Chuẩn bị 20 trái dừa xiêm ướp lạnh và nguyên liệu Cà phê muối phục vụ ngắm hoàng hôn.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5DECE] text-center">
                  <button
                    onClick={() => setActiveTab('rooms-bookings')}
                    className="text-xs font-bold text-[#0E2A47] hover:text-[#C8A261] flex items-center justify-center gap-1 mx-auto transition-colors"
                  >
                    <span>Xem toàn bộ chi tiết phòng</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Khối Doanh Thu Nhanh (Homestay vs Coffee) */}
            <div className="bg-white border border-[#E5DECE] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                    Khối Doanh Thu Nhanh Hôm Nay
                  </h3>
                  <p className="text-xs text-[#8C7E6C]">
                    Tách bạch nguồn thu Homestay (Phòng + Cọc) và Quán Cà phê Seagull
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('revenue')}
                  className="text-xs font-bold text-[#0E2A47] hover:text-[#C8A261] flex items-center gap-1"
                >
                  <span>Mở bảng chi tiết doanh thu</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8C7E6C] font-semibold">
                    <span>1. Tiền Phòng Homestay</span>
                    <BedDouble className="w-4 h-4 text-[#0E2A47]" />
                  </div>
                  <div className="text-xl font-bold text-[#0E2A47]">
                    4.650.000 <span className="text-xs font-medium text-[#C8A261]">đ</span>
                  </div>
                  <div className="text-[11px] text-[#8C7E6C] flex justify-between">
                    <span>Đã nhận cọc 30%: 1.395.000 đ</span>
                    <span>Còn lại: 3.255.000 đ</span>
                  </div>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8C7E6C] font-semibold">
                    <span>2. Seagull Coffee & Drinks</span>
                    <Coffee className="w-4 h-4 text-[#C8A261]" />
                  </div>
                  <div className="text-xl font-bold text-[#0E2A47]">
                    {kpiData.coffeeTodayRevenue.toLocaleString('vi-VN')} <span className="text-xs font-medium text-[#C8A261]">đ</span>
                  </div>
                  <div className="text-[11px] text-[#8C7E6C] flex justify-between">
                    <span>VietQR: 355.000 đ</span>
                    <span>Tiền mặt: 170.000 đ</span>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-[#0E2A47] to-[#163A5F] text-white rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                    <span>Tổng Thu Thực Tế Hôm Nay</span>
                    <DollarSign className="w-4 h-4 text-[#C8A261]" />
                  </div>
                  <div className="text-xl font-bold text-[#C8A261]">
                    {kpiData.totalTodayRevenue.toLocaleString('vi-VN')} <span className="text-xs font-medium text-white">VNĐ</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    5 lượt giao dịch phát sinh qua VietQR tự động & Tiền mặt quầy
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: PHÒNG & ĐẶT PHÒNG */}
        {/* ================================================================= */}
        {activeTab === 'rooms-bookings' && (
          <div className="space-y-6">
            {/* Sub-view Navigation Bar: Check-in & Quản Lý Lưu Trú vs Sơ Đồ Phòng */}
            <div className="bg-white border border-[#E5DECE] rounded-2xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setRoomSectionMode('checkin_stay')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    roomSectionMode === 'checkin_stay'
                      ? 'bg-[#0E2A47] text-[#C8A261] shadow-xs'
                      : 'text-slate-600 hover:text-black hover:bg-slate-100'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Check-in & Quản Lý Lưu Trú (V1.1)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#C8A261] text-[#0E2A47] font-bold">
                    3 Tab Con
                  </span>
                </button>

                <button
                  onClick={() => setRoomSectionMode('rooms_grid')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    roomSectionMode === 'rooms_grid'
                      ? 'bg-[#0E2A47] text-[#C8A261] shadow-xs'
                      : 'text-slate-600 hover:text-black hover:bg-slate-100'
                  }`}
                >
                  <BedDouble className="w-4 h-4" />
                  <span>Sơ Đồ {activeRooms.length} Phòng Giai Đoạn 1</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
                    {activeRooms.length} Phòng
                  </span>
                </button>
              </div>

              <div className="text-xs text-[#8C7E6C] flex items-center gap-2 px-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  DEMO MODE
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Mô phỏng đồng bộ nội bộ (Chế độ Xem Thử)</span>
                </span>
              </div>
            </div>

            {/* Sub-view Content */}
            {roomSectionMode === 'checkin_stay' ? (
              <CheckInStayManager
                rooms={rooms}
                bookings={bookings}
                stayRecords={stayRecords}
                onUpdateStayRecords={handleUpdateStayRecords}
                onUpdateRooms={onUpdateRooms}
                onOpenCheckInModal={handleOpenCheckInModal}
                userRole={userRole}
                currentStaff={currentStaff}
                propertyConfig={propertyConfig}
                maskPhone={maskPhone}
              />
            ) : (
              <div className="space-y-6">
                {/* Room Scale & Capacity Audit Bar (Standardized 27 rooms for Phase 1) */}
                <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-[#0E2A47] flex items-center gap-1.5">
                      <BedDouble className="w-4 h-4 text-[#C8A261]" />
                      <span>Quy mô cơ sở Seagull:</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                      27 Phòng Kinh Doanh Mở Bán (Giai Đoạn Đầu)
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 font-semibold" title="Bao gồm Cụm 1 (7 căn: 101-107), Cụm 2 (6 căn: 201-206), Cụm 3 (8 căn: 301-308), Cụm 4 Lầu Cafe (6 căn: 401-406)">
                      4 Cụm Phòng Vận Hành (Home 1, 2, 3 & 4)
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-semibold" title="Cụm Home 5 gồm 5 phòng khu cải tạo hiện trạng 501-505">
                      5 Phòng Quy Hoạch GĐ2 (Home 5)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8C7E6C] font-semibold">
                    Tổng: 27 phòng kinh doanh GĐ1 • 32 phòng toàn cơ sở theo hồ sơ kỹ thuật
                  </div>
                </div>

                {/* Filter and Search Bar */}
            <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo số phòng, tên khách, số điện thoại..."
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl text-xs text-[#0E2A47] focus:outline-none focus:border-[#C8A261]"
                  />
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-2">
                  <div className="bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DECE] flex items-center">
                    <button
                      onClick={() => setRoomViewMode('grid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        roomViewMode === 'grid' ? 'bg-[#0E2A47] text-white shadow' : 'text-slate-600 hover:text-black'
                      }`}
                    >
                      Dạng Thẻ
                    </button>
                    <button
                      onClick={() => setRoomViewMode('table')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        roomViewMode === 'table' ? 'bg-[#0E2A47] text-white shadow' : 'text-slate-600 hover:text-black'
                      }`}
                    >
                      Dạng Bảng
                    </button>
                  </div>

                  <button
                    onClick={() => setIsManualBookingOpen(true)}
                    className="bg-[#C8A261] hover:bg-[#B38D4F] text-[#0E2A47] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Bán Phòng</span>
                  </button>
                </div>
              </div>

              {/* Status Pills Filter */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E5DECE]">
                <span className="text-[11px] font-bold text-[#8C7E6C] flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Trạng thái:
                </span>
                {[
                  { key: 'all', label: `Tất cả (${activeRooms.length})` },
                  { key: 'available', label: 'Trống' },
                  { key: 'hold', label: 'Giữ chỗ (Chờ cọc)' },
                  { key: 'confirmed', label: 'Đã chốt (Cọc 30%)' },
                  { key: 'in_house', label: 'Đang ở' },
                  { key: 'locked', label: 'Đã khóa' },
                  { key: 'maintenance', label: 'Bảo trì' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setRoomFilterStatus(item.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      roomFilterStatus === item.key
                        ? 'bg-[#0E2A47] text-[#C8A261] shadow-sm'
                        : 'bg-[#FAF8F5] text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode 1: Grid Cards */}
            {roomViewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeRooms
                  .filter(r => {
                    const statusInfo = getNormalizedStatus(r);
                    if (roomFilterStatus !== 'all' && statusInfo.statusKey !== roomFilterStatus) return false;
                    if (roomSearchQuery.trim()) {
                      const query = roomSearchQuery.toLowerCase();
                      const matchNumber = r.number.toLowerCase().includes(query);
                      const booking = bookings.find(b => b.roomId === r.id);
                      const matchName = booking?.customerName.toLowerCase().includes(query);
                      const matchPhone = booking?.customerPhone.includes(query);
                      return matchNumber || matchName || matchPhone;
                    }
                    return true;
                  })
                  .map(room => {
                    const statusInfo = getNormalizedStatus(room);
                    const booking = bookings.find(b => b.roomId === room.id && b.paymentStatus !== 'cancelled');
                    const rType = roomTypes.find(t => t.id === room.roomTypeId);

                    return (
                      <div
                        key={room.id}
                        className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${statusInfo.borderColor}`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-serif text-lg font-bold text-[#0E2A47]">
                                  P.{room.number}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  ({room.area || 'Mái Vòm'})
                                </span>
                              </div>
                              <p className="text-xs text-[#8C7E6C] line-clamp-1">
                                {rType?.name || 'Bungalow Vòm King'}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.badgeBg} ${statusInfo.badgeText}`}>
                              {statusInfo.label}
                            </span>
                          </div>

                          {/* Guest / Booking Info */}
                          {booking ? (
                            <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5DECE] space-y-1 text-xs my-2">
                              <div className="flex justify-between font-bold text-[#0E2A47]">
                                <span className="truncate">{booking.customerName}</span>
                                <span className="font-mono text-[11px] text-[#C8A261]">{booking.code}</span>
                              </div>
                              <div className="flex justify-between text-slate-500 text-[11px]">
                                <span className="flex items-center gap-1">
                                  <span>SĐT: {maskPhone(booking.customerPhone)}</span>
                                  {userRole !== 'owner' && <Lock className="w-2.5 h-2.5 text-slate-400" title="Ẩn vì bảo mật" />}
                                </span>
                                <span>{booking.nights} đêm</span>
                              </div>
                              <div className="flex justify-between text-[11px] pt-1 border-t border-black/5">
                                <span>Tổng: {booking.totalPrice.toLocaleString('vi-VN')} đ</span>
                                <span className="text-emerald-700 font-semibold">Cọc: {booking.depositAmount.toLocaleString('vi-VN')} đ</span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-4 text-center my-2 bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200 text-xs text-emerald-800">
                              Phòng đang trống • Có thể bán ngay
                            </div>
                          )}
                        </div>

                        {/* Quick action buttons */}
                        <div className="pt-3 border-t border-[#E5DECE] flex items-center justify-between text-xs">
                          <button
                            onClick={() => handleToggleRoomLock(room)}
                            className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                          >
                            {room.status === 'locked' ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Mở khóa</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Khóa phòng</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-1.5">
                            {!booking && room.status !== 'locked' && (
                              <button
                                onClick={() => {
                                  setManualForm(prev => ({ ...prev, roomId: room.id }));
                                  setIsManualBookingOpen(true);
                                }}
                                className="px-2.5 py-1 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-lg font-bold text-[11px]"
                              >
                                Bán phòng
                              </button>
                            )}

                            {statusInfo.statusKey === 'confirmed' && (
                              <button
                                onClick={() => handleQuickCheckIn(room)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px]"
                              >
                                Check-in
                              </button>
                            )}

                            {statusInfo.statusKey === 'in_house' && (
                              <button
                                onClick={() => handleQuickCheckOut(room)}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px]"
                              >
                                Check-out
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Mode 2: Table List */}
            {roomViewMode === 'table' && (
              <div className="bg-white border border-[#E5DECE] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] border-b border-[#E5DECE] text-[#8C7E6C] uppercase tracking-wider font-bold text-[11px]">
                      <tr>
                        <th className="p-3.5">Số phòng</th>
                        <th className="p-3.5">Cụm / Khu vực</th>
                        <th className="p-3.5">Loại phòng</th>
                        <th className="p-3.5">Trạng thái</th>
                        <th className="p-3.5">Khách đang đặt / ở</th>
                        <th className="p-3.5">SĐT</th>
                        <th className="p-3.5">Số tiền cọc 30%</th>
                        <th className="p-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DECE]">
                      {activeRooms.map(room => {
                        const statusInfo = getNormalizedStatus(room);
                        const booking = bookings.find(b => b.roomId === room.id && b.paymentStatus !== 'cancelled');
                        const rType = roomTypes.find(t => t.id === room.roomTypeId);

                        return (
                          <tr key={room.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                            <td className="p-3.5 font-bold text-[#0E2A47]">
                              P.{room.number}
                            </td>
                            <td className="p-3.5 text-slate-600">
                              {room.area || 'Mái Vòm'}
                            </td>
                            <td className="p-3.5 text-slate-800 font-medium">
                              {rType?.name || 'Bungalow Vòm King'}
                            </td>
                            <td className="p-3.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.badgeBg} ${statusInfo.badgeText}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="p-3.5 font-semibold text-[#0E2A47]">
                              {booking ? booking.customerName : '—'}
                            </td>
                            <td className="p-3.5 text-slate-600 font-mono text-xs">
                              {booking ? (
                                <span className="flex items-center gap-1">
                                  <span>{maskPhone(booking.customerPhone)}</span>
                                  {userRole !== 'owner' && <Lock className="w-2.5 h-2.5 text-slate-400" title="Ẩn vì bảo mật" />}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="p-3.5 font-mono text-emerald-800 font-semibold">
                              {booking ? `${booking.depositAmount.toLocaleString('vi-VN')} đ` : '—'}
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              <button
                                onClick={() => handleToggleRoomLock(room)}
                                className="text-slate-500 hover:text-black font-semibold text-[11px]"
                              >
                                {room.status === 'locked' ? 'Mở' : 'Khóa'}
                              </button>

                              {!booking && room.status !== 'locked' && (
                                <button
                                  onClick={() => {
                                    setManualForm(prev => ({ ...prev, roomId: room.id }));
                                    setIsManualBookingOpen(true);
                                  }}
                                  className="text-[#0E2A47] hover:text-[#C8A261] font-bold text-[11px]"
                                >
                                  Bán
                                </button>
                              )}

                              {statusInfo.statusKey === 'confirmed' && (
                                <button
                                  onClick={() => handleQuickCheckIn(room)}
                                  className="text-blue-600 hover:text-blue-800 font-bold text-[11px]"
                                >
                                  Check-in
                                </button>
                              )}

                              {statusInfo.statusKey === 'in_house' && (
                                <button
                                  onClick={() => handleQuickCheckOut(room)}
                                  className="text-rose-600 hover:text-rose-800 font-bold text-[11px]"
                                >
                                  Check-out
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: DOANH THU (3 SUB-TABS: HOMESTAY, COFFEE, TỔNG HỢP) */}
        {/* ================================================================= */}
        {activeTab === 'revenue' && (
          userRole === 'reception' ? (
            <div className="bg-white border border-[#E5DECE] rounded-3xl p-10 text-center max-w-xl mx-auto shadow-sm my-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#0E2A47]">
                Quyền Truy Cập Doanh Thu Bị Hạn Chế
              </h3>
              <p className="text-sm text-[#8C7E6C] leading-relaxed">
                Tài khoản hiện tại là <strong>Lễ Tân Ca Trực</strong>. Theo chính sách phân quyền bảo mật của Seagull, phân hệ Doanh thu Homestay & Coffee chỉ dành riêng cho <strong>Chủ cơ sở</strong> và <strong>Kế toán</strong>.
              </p>
              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-2xl text-xs text-slate-600 text-left space-y-1">
                <p className="font-bold text-[#0E2A47]">🔒 Cơ chế bảo mật đa tầng:</p>
                <p>• Dữ liệu thu chi và tiền cọc được kiểm tra quyền hạn nghiêm ngặt ở cấp Server & Database.</p>
                <p>• Lễ tân tập trung vào sơ đồ phòng, đón tiếp khách và nghiệp vụ check-in/out.</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-[#0E2A47] text-[#C8A261] px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#163A5F] transition-all"
              >
                Đổi Tài Khoản Chủ Cơ Sở / Kế Toán
              </button>
            </div>
          ) : (
          <div className="space-y-6">
            {/* Sub-tabs and Period Selector */}
            <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* 3 Tabs: Homestay, Coffee, Tổng hợp */}
              <div className="bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DECE] flex items-center">
                <button
                  onClick={() => setRevenueSubTab('all')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    revenueSubTab === 'all' ? 'bg-[#0E2A47] text-[#C8A261] shadow' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Toàn Bộ (Tổng hợp)
                </button>
                <button
                  onClick={() => setRevenueSubTab('homestay')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    revenueSubTab === 'homestay' ? 'bg-[#0E2A47] text-[#C8A261] shadow' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Homestay (Phòng)
                </button>
                <button
                  onClick={() => setRevenueSubTab('coffee')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    revenueSubTab === 'coffee' ? 'bg-[#0E2A47] text-[#C8A261] shadow' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Seagull Coffee
                </button>
              </div>

              {/* Period Selector: Ngày, Tuần, Tháng, Năm */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DECE]">
                {[
                  { key: 'today', label: 'Hôm nay' },
                  { key: 'week', label: 'Tuần này' },
                  { key: 'month', label: 'Tháng này' },
                  { key: 'year', label: 'Năm nay' },
                ].map(p => (
                  <button
                    key={p.key}
                    onClick={() => setRevenuePeriod(p.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      revenuePeriod === p.key ? 'bg-white text-[#0E2A47] shadow-sm font-bold' : 'text-slate-500 hover:text-black'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold block uppercase">Tổng Doanh Thu ({revenuePeriod})</span>
                <div className="text-2xl font-bold text-[#0E2A47] mt-1">
                  {revenueSubTab === 'coffee' ? '2.450.000 đ' : revenueSubTab === 'homestay' ? '28.900.000 đ' : '31.350.000 đ'}
                </div>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">
                  Đã ghi nhận vào sổ thu chi
                </p>
              </div>

              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold block uppercase">Tiền Cọc (30% Đã Thu)</span>
                <div className="text-2xl font-bold text-sky-700 mt-1">
                  {revenueSubTab === 'coffee' ? '0 đ' : '8.670.000 đ'}
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Khóa phòng thành công
                </p>
              </div>

              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold block uppercase">Tiền Còn Lại Chờ Thu (70%)</span>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {revenueSubTab === 'coffee' ? '0 đ' : '20.230.000 đ'}
                </div>
                <p className="text-[11px] text-amber-800 font-medium mt-1">
                  Thanh toán khi khách nhận phòng
                </p>
              </div>

              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold block uppercase">Phân Loại Hình Thức Thu</span>
                <div className="text-sm font-bold text-[#0E2A47] mt-1 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-normal">Chuyển khoản (VietQR):</span>
                    <span className="text-emerald-700">82%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-normal">Tiền mặt tại quầy:</span>
                    <span className="text-slate-800">18%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Transaction Table */}
            <div className="bg-white border border-[#E5DECE] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                    Sổ Ghi Nhận Doanh Thu Chi Tiết
                  </h3>
                  <p className="text-xs text-[#8C7E6C]">
                    Liệt kê các khoản thu Homestay và đơn order Coffee
                  </p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="bg-[#FAF8F5] hover:bg-[#E5DECE] text-[#0E2A47] border border-[#D5CBBF] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#C8A261]" />
                  <span>Xuất File</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#E5DECE] text-[#8C7E6C] uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Mã GD</th>
                      <th className="p-3">Thời gian</th>
                      <th className="p-3">Khoản mục</th>
                      <th className="p-3">Nội dung</th>
                      <th className="p-3">Số tiền</th>
                      <th className="p-3">Hình thức</th>
                      <th className="p-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DECE]">
                    {/* Coffee orders */}
                    {(revenueSubTab === 'all' || revenueSubTab === 'coffee') && coffeeOrders.map(o => (
                      <tr key={o.id} className="hover:bg-[#FAF8F5]">
                        <td className="p-3 font-mono font-bold text-[#0E2A47]">{o.id}</td>
                        <td className="p-3 text-slate-500">Hôm nay {o.time}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold text-[10px]">
                            Coffee & Drinks
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-800">{o.table} • {o.items}</td>
                        <td className="p-3 font-mono font-bold text-[#0E2A47]">{o.total.toLocaleString('vi-VN')} đ</td>
                        <td className="p-3 text-slate-600 uppercase font-semibold text-[10px]">{o.method === 'vietqr' ? 'VietQR MBBank' : 'Tiền mặt'}</td>
                        <td className="p-3 text-emerald-700 font-semibold">Đã thu</td>
                      </tr>
                    ))}

                    {/* Bookings */}
                    {(revenueSubTab === 'all' || revenueSubTab === 'homestay') && bookings.map(b => (
                      <tr key={b.id} className="hover:bg-[#FAF8F5]">
                        <td className="p-3 font-mono font-bold text-[#0E2A47]">{b.code}</td>
                        <td className="p-3 text-slate-500">{b.createdAt.slice(0, 10)}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold text-[10px]">
                            Homestay (Phòng {b.roomNumber})
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-800">{b.customerName} ({b.nights} đêm)</td>
                        <td className="p-3 font-mono font-bold text-[#0E2A47]">{b.totalPrice.toLocaleString('vi-VN')} đ</td>
                        <td className="p-3 text-slate-600 uppercase font-semibold text-[10px]">VietQR Cọc 30%</td>
                        <td className="p-3 text-emerald-700 font-semibold">Đã cọc ({b.depositAmount.toLocaleString('vi-VN')} đ)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

        {/* ================================================================= */}
        {/* TAB 4: BÁO CÁO (LỌC NGÀY/TUẦN/THÁNG/NĂM, XUẤT CSV, DOANH THU THEO LOẠI PHÒNG) */}
        {/* ================================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Report Header and Export */}
            <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                  Trung Tâm Báo Cáo & Xuất Dữ Liệu
                </h3>
                <p className="text-xs text-[#8C7E6C]">
                  Xuất file Excel/CSV chuẩn UTF-8 xem đầy đủ tiếng Việt trên Microsoft Excel & Google Sheets
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DECE]">
                  {[
                    { key: 'today', label: 'Hôm nay' },
                    { key: 'week', label: 'Tuần này' },
                    { key: 'month', label: 'Tháng này' },
                    { key: 'year', label: 'Năm nay' },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => setReportPeriod(p.key as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        reportPeriod === p.key ? 'bg-white text-[#0E2A47] shadow-sm font-bold' : 'text-slate-500 hover:text-black'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportCSV}
                  className="bg-[#0E2A47] hover:bg-[#163A5F] text-[#FAF8F5] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow"
                >
                  <Download className="w-4 h-4 text-[#C8A261]" />
                  <span>Xuất Excel / CSV</span>
                </button>
              </div>
            </div>

            {/* 4 Report Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold uppercase">Tổng Doanh Thu Báo Cáo</span>
                <div className="text-2xl font-bold text-[#0E2A47] mt-1">31.350.000 đ</div>
                <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">Tăng +18% so với kỳ trước</span>
              </div>

              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold uppercase">Tổng Số Lượt Đặt Phòng</span>
                <div className="text-2xl font-bold text-[#0E2A47] mt-1">{bookings.length + 18} lượt</div>
                <span className="text-[11px] text-slate-500 mt-1 block">Tỷ lệ hủy phòng: 0%</span>
              </div>

              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold uppercase">Công Suất Phòng Trung Bình</span>
                <div className="text-2xl font-bold text-sky-800 mt-1">68.5%</div>
                <span className="text-[11px] text-sky-700 mt-1 block">Cao điểm cuối tuần đạt 95%</span>
              </div>

              <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-sm">
                <span className="text-xs text-[#8C7E6C] font-semibold uppercase">Doanh Thu Trung Bình / Phòng</span>
                <div className="text-2xl font-bold text-[#C8A261] mt-1">785.000 đ</div>
                <span className="text-[11px] text-slate-500 mt-1 block">ADR (Average Daily Rate)</span>
              </div>
            </div>

            {/* Doanh thu theo loại phòng & Cụm */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-[#E5DECE] rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                  Doanh Thu Theo Loại Phòng (Home 1, 2, 3)
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#0E2A47]">Cụm Home 1 (7 Phòng Mái Vòm View Biển)</span>
                      <span className="text-[#0E2A47] font-bold">14.200.000 đ (45%)</span>
                    </div>
                    <div className="w-full bg-[#FAF8F5] rounded-full h-2.5 overflow-hidden">
                      <div className="bg-[#0E2A47] h-full rounded-full" style={{ width: '45%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#0E2A47]">Cụm Home 2 (6 Phòng Vòm Hoàng Hôn)</span>
                      <span className="text-[#0E2A47] font-bold">8.950.000 đ (29%)</span>
                    </div>
                    <div className="w-full bg-[#FAF8F5] rounded-full h-2.5 overflow-hidden">
                      <div className="bg-[#C8A261] h-full rounded-full" style={{ width: '29%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#0E2A47]">Cụm Home 3 (8 Phòng Panorama Núi & Biển)</span>
                      <span className="text-[#0E2A47] font-bold">8.200.000 đ (26%)</span>
                    </div>
                    <div className="w-full bg-[#FAF8F5] rounded-full h-2.5 overflow-hidden">
                      <div className="bg-[#163A5F] h-full rounded-full" style={{ width: '26%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E5DECE] rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                  Cơ Cấu Kênh Khách Hàng
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#0E2A47] block">1. Website Trực Tiếp (VietQR 30%)</span>
                      <span className="text-[11px] text-slate-500">Khách tự đặt phòng trên website /booking</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">72%</span>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#0E2A47] block">2. Zalo & Gọi Điện Trực Tiếp</span>
                      <span className="text-[11px] text-slate-500">Hotline 0868011799 - Lễ tân bán thủ công</span>
                    </div>
                    <span className="text-sm font-bold text-[#0E2A47]">23%</span>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#0E2A47] block">3. Khách Vãng Lai (Walk-in)</span>
                      <span className="text-[11px] text-slate-500">Đến trực tiếp quầy Seagull tại Đảo Lý Sơn</span>
                    </div>
                    <span className="text-sm font-bold text-[#8C7E6C]">5%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB: QUẢN LÝ PHÒNG (CMS) */}
        {/* ================================================================= */}
        {activeTab === 'room-cms' && (
          <RoomCmsManager
            roomTypes={roomTypes}
            userRole={userRole}
            onUpdateRoomTypes={onUpdateRoomTypes}
            showToast={showToast}
          />
        )}

        {/* ================================================================= */}
        {/* TAB: QUẢN LÝ DỊCH VỤ (CMS) */}
        {/* ================================================================= */}
        {activeTab === 'service-cms' && (
          <ServiceCmsManager
            services={serviceItems}
            userRole={userRole}
            onUpdateServices={(updated) => onUpdateServiceItems?.(updated)}
            showToast={showToast}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 6: CÀI ĐẶT HỆ THỐNG V2 (SETTINGS MANAGEMENT V2) */}
        {/* ================================================================= */}
        {activeTab === 'settings' && (
          <SettingsManagerV2
            roomTypes={roomTypes}
            rooms={rooms}
            bookings={bookings}
            propertyConfig={propertyConfig}
            staffList={staffList}
            userRole={userRole}
            currentStaff={currentStaff}
            currentUsername={currentUsername}
            onUpdateRoomTypes={onUpdateRoomTypes}
            onUpdatePropertyConfig={onUpdatePropertyConfig}
            onUpdateStaffList={onUpdateStaffList}
            showToast={showToast}
          />
        )}
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: BÁN PHÒNG THỦ CÔNG TẠI QUẦY */}
      {/* ------------------------------------------------------------------- */}
      {isManualBookingOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-[#E5DECE] shadow-2xl p-6 overflow-hidden space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DECE]">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0E2A47]">
                  Bán Phòng Thủ Công Tại Quầy
                </h3>
                <p className="text-xs text-[#8C7E6C]">
                  Tạo đơn trực tiếp cho khách gọi hotline hoặc đến quầy lễ tân
                </p>
              </div>
              <button
                onClick={() => setIsManualBookingOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualBookingSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#0E2A47] mb-1">Chọn Phòng Cần Bán *</label>
                <select
                  value={manualForm.roomId}
                  onChange={(e) => setManualForm({ ...manualForm, roomId: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-medium text-xs text-[#0E2A47]"
                  required
                >
                  <option value="">-- Chọn 1 trong {activeRooms.length} phòng kinh doanh mở bán --</option>
                  {activeRooms.filter(r => r.status === 'available').map(r => {
                    const rType = roomTypes.find(t => t.id === r.roomTypeId);
                    return (
                      <option key={r.id} value={r.id}>
                        Phòng {r.number} ({r.area || 'Mái vòm'}) - {rType?.name || 'Bungalow Vòm'} - {rType?.basePrice.toLocaleString('vi-VN')} đ/đêm
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0E2A47] mb-1">Tên Khách Hàng *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={manualForm.customerName}
                    onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#0E2A47] mb-1">Số Điện Thoại *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0981xxxxxx"
                    value={manualForm.customerPhone}
                    onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0E2A47] mb-1">Ngày Đến (Check-in)</label>
                  <input
                    type="date"
                    value={manualForm.checkIn}
                    onChange={(e) => setManualForm({ ...manualForm, checkIn: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#0E2A47] mb-1">Ngày Đi (Check-out)</label>
                  <input
                    type="date"
                    value={manualForm.checkOut}
                    onChange={(e) => setManualForm({ ...manualForm, checkOut: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0E2A47] mb-1">Tỷ Lệ Tiền Cọc</label>
                  <select
                    value={manualForm.depositPercent}
                    onChange={(e) => setManualForm({ ...manualForm, depositPercent: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-semibold"
                  >
                    <option value={30}>30% (Chuẩn chính sách)</option>
                    <option value={50}>50%</option>
                    <option value={100}>100% (Thu đủ)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#0E2A47] mb-1">Phương Thức Thanh Toán</label>
                  <select
                    value={manualForm.paymentMethod}
                    onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-semibold"
                  >
                    <option value="vietqr">Chuyển khoản VietQR</option>
                    <option value="cash">Tiền mặt tại quầy</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0E2A47] mb-1">Ghi Chú Đơn Phòng</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Khách đón tàu 13h, kê thêm 1 nệm phụ..."
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-[#E5DECE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualBookingOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-black font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0E2A47] hover:bg-[#163A5F] text-[#FAF8F5] font-bold rounded-xl shadow"
                >
                  Xác Nhận Bán Phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Step Check-In & Stay Declaration Flow Modal */}
      {checkInModalData && (
        <CheckInFlowModal
          isOpen={true}
          onClose={() => setCheckInModalData(null)}
          record={checkInModalData.record}
          booking={checkInModalData.booking}
          rooms={rooms}
          targetRoomNumber={checkInModalData.roomNumber}
          userRole={userRole}
          currentStaff={currentStaff}
          propertyConfig={propertyConfig}
          onSaveStayRecord={handleSaveCheckInRecord}
          showToast={showToast}
          maskPhone={maskPhone}
        />
      )}
    </div>
  );
};
