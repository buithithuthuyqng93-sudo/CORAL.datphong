import React, { useState, useEffect } from 'react';
import { SeagullWebsite } from './components/SeagullWebsite';
import { BookingPortal } from './components/BookingPortal';
import { AdminManager } from './components/AdminManager';
import { VietQRModal } from './components/VietQRModal';
import { SiteContentProvider } from './context/SiteContentContext';

import { Room, RoomStatus, RoomType, Booking, ChannelSyncLog, PropertyConfig, Customer, CashTransaction, StaffUser } from './types';
import { 
  INITIAL_ROOMS, INITIAL_BOOKINGS, INITIAL_SYNC_LOGS, CORAL_ROOM_TYPES, 
  INITIAL_PROPERTY_CONFIG, INITIAL_CUSTOMERS, INITIAL_TRANSACTIONS, INITIAL_STAFF 
} from './data/mockData';

export type AppRoute = 'website' | 'booking' | 'admin';

export function getInitialRoute(): AppRoute {
  if (typeof window === 'undefined') return 'admin';
  const path = window.location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const viewParam = searchParams.get('view') || searchParams.get('tab') || searchParams.get('page');

  if (path.startsWith('/admin') || viewParam === 'admin' || window.location.hash === '#/admin') {
    return 'admin';
  }
  if (path.startsWith('/booking') || viewParam === 'booking' || window.location.hash === '#/booking') {
    return 'booking';
  }
  if (path === '/website' || viewParam === 'website' || window.location.hash === '#/website') {
    return 'website';
  }
  // Default to guest website so user sees the newly created website immediately
  return 'website';
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);
  const [preselectedRoomTypeId, setPreselectedRoomTypeId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('roomType') || undefined;
    }
    return undefined;
  });

  // Sync route on popstate (browser back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (route: AppRoute, roomTypeId?: string) => {
    let targetUrl = '/';
    if (route === 'booking') {
      targetUrl = roomTypeId ? `/booking?roomType=${encodeURIComponent(roomTypeId)}` : '/booking';
      setPreselectedRoomTypeId(roomTypeId);
    } else if (route === 'admin') {
      targetUrl = '/admin';
    }
    window.history.pushState(null, '', targetUrl);
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Core App State with automatic migration to Seagull 20 rooms & (Mr Thiện / Ms Điền)
  const cleanConfig = (cfg: any): PropertyConfig => {
    let hotline = cfg.hotline || '0868011799 - 0981065065';
    // Remove any parenthesized names embedded in hotline (e.g. (Chị Thủy / Mr Thiện))
    hotline = hotline.replace(/\s*\([^)]*\)/g, '').trim();
    if (!hotline) hotline = '0868011799 - 0981065065';

    // Owner name confirmed: Mr Thiện / Ms Điền
    let ownerName = 'Mr Thiện / Ms Điền';
    if (cfg.ownerName && !/thủy/i.test(cfg.ownerName)) {
      ownerName = cfg.ownerName;
    }

    let announcementBar = (cfg.announcementBar || INITIAL_PROPERTY_CONFIG.announcementBar)
      .replace(/\s*\([^)]*căn[^)]*\)/gi, '')
      .replace(/\s*\(22\s*căn[^)]*\)/gi, '')
      .replace(/\s*\(20\s*căn[^)]*\)/gi, '')
      .replace(/22\s*căn/gi, '')
      .replace(/20\s*căn/gi, '27 căn')
      .replace(/chị\s*thủy/gi, 'Mr Thiện / Ms Điền')
      .trim();

    let heroDescription = (cfg.heroDescription || INITIAL_PROPERTY_CONFIG.heroDescription)
      .replace(/22\s*căn\s*/gi, '')
      .replace(/20\s*căn\s*/gi, '27 căn ')
      .replace(/chị\s*thủy/gi, 'Mr Thiện / Ms Điền')
      .trim();

    return {
      ...cfg,
      propertyName: 'SEAGULL LÝ SƠN',
      slogan: cfg.slogan || 'Nơi chữa lành tâm hồn bạn.',
      tagline: 'SEAGULL LÝ SƠN — Homestay & Cà Phê • Nơi chữa lành tâm hồn bạn',
      address: 'Thôn Đông An Vĩnh, Đặc khu Lý Sơn, Tỉnh Quảng Ngãi (Thửa 432, Tờ bản đồ số 27)',
      heroTitle: 'SEAGULL LÝ SƠN — HOMESTAY & CÀ PHÊ',
      announcementBar: announcementBar || 'SEAGULL LÝ SƠN — Homestay & Cà Phê • Thôn Đông An Vĩnh',
      heroDescription: heroDescription || INITIAL_PROPERTY_CONFIG.heroDescription,
      hotline,
      ownerName,
      zaloPhone: cfg.zaloPhone || '0868011799 - 0981065065',
      accountHolder: 'SEAGULL HOMESTAY - BUI THI THU THUY',
      seasonPricing: cfg.seasonPricing || INITIAL_PROPERTY_CONFIG.seasonPricing,
    };
  };

  const [propertyConfig, setPropertyConfig] = useState<PropertyConfig>(() => {
    try {
      const savedV4 = localStorage.getItem('property_config_v4');
      if (savedV4) {
        const parsed = JSON.parse(savedV4);
        return cleanConfig(parsed);
      }
      const savedV3 = localStorage.getItem('property_config_v3') || localStorage.getItem('property_config_v2');
      if (savedV3) {
        const parsed = JSON.parse(savedV3);
        const cleaned = cleanConfig(parsed);
        localStorage.setItem('property_config_v4', JSON.stringify(cleaned));
        return cleaned;
      }
    } catch {
      // ignore
    }
    const initialClean = cleanConfig(INITIAL_PROPERTY_CONFIG);
    try {
      localStorage.setItem('property_config_v4', JSON.stringify(initialClean));
    } catch {}
    return initialClean;
  });

  const handleUpdatePropertyConfig = (newConfig: PropertyConfig) => {
    const cleaned = cleanConfig(newConfig);
    setPropertyConfig(cleaned);
    try {
      localStorage.setItem('property_config_v4', JSON.stringify(cleaned));
      localStorage.setItem('property_config_v3', JSON.stringify(cleaned));
    } catch (e) {
      console.warn('Could not save propertyConfig to localStorage', e);
    }
  };

  const [roomTypes, setRoomTypes] = useState<RoomType[]>(() => {
    try {
      const saved = localStorage.getItem('seagull_room_types_v3_27');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // Seed and persist latest 27-room types
    try {
      localStorage.setItem('seagull_room_types_v3_27', JSON.stringify(CORAL_ROOM_TYPES));
    } catch {}
    return CORAL_ROOM_TYPES;
  });

  const handleUpdateRoomTypes = (newTypes: RoomType[]) => {
    setRoomTypes(newTypes);
    try {
      localStorage.setItem('seagull_room_types_v3_27', JSON.stringify(newTypes));
    } catch (e) {
      console.warn('Could not save roomTypes to localStorage', e);
    }
  };

  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const savedV5 = localStorage.getItem('seagull_rooms_v5_27');
      if (savedV5) {
        const parsed = JSON.parse(savedV5);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // Initialize with standardized 27-room inventory
      localStorage.setItem('seagull_rooms_v5_27', JSON.stringify(INITIAL_ROOMS));
    } catch {
      // fallback
    }
    return INITIAL_ROOMS;
  });

  const handleUpdateRooms = (newRooms: Room[]) => {
    setRooms(newRooms);
    try {
      localStorage.setItem('seagull_rooms_v5_27', JSON.stringify(newRooms));
    } catch (e) {
      console.warn('Could not save rooms to localStorage', e);
    }
  };

  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [syncLogs, setSyncLogs] = useState<ChannelSyncLog[]>(INITIAL_SYNC_LOGS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [transactions, setTransactions] = useState<CashTransaction[]>(INITIAL_TRANSACTIONS);
  
  const [staffList, setStaffList] = useState<StaffUser[]>(() => {
    try {
      const saved = localStorage.getItem('seagull_staff_list_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_STAFF;
  });

  const handleUpdateStaffList = (newStaff: StaffUser[]) => {
    setStaffList(newStaff);
    try {
      localStorage.setItem('seagull_staff_list_v2', JSON.stringify(newStaff));
    } catch (e) {
      console.warn('Could not save staffList to localStorage', e);
    }
  };

  // Security Auth Lock State - starts locked unless authenticated session token exists
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem('seagull_admin_authenticated');
      const token = sessionStorage.getItem('seagull_admin_token');
      return stored === 'true' && Boolean(token);
    } catch {
      return false;
    }
  });

  const handleSetAdminAuthenticated = (status: boolean) => {
    setIsAdminAuthenticated(status);
    try {
      if (status) {
        sessionStorage.setItem('seagull_admin_authenticated', 'true');
      } else {
        sessionStorage.removeItem('seagull_admin_authenticated');
        sessionStorage.removeItem('seagull_admin_token');
        sessionStorage.removeItem('seagull_admin_role');
        sessionStorage.removeItem('seagull_admin_name');
        sessionStorage.removeItem('seagull_admin_username');
        sessionStorage.removeItem('seagull_admin_userid');
      }
    } catch {}
  };

  // Modal payment state
  const [paymentModalState, setPaymentModalState] = useState<{
    booking: Booking;
    room: Room;
  } | null>(null);

  // Active confirmed booking to show success banner on Guest Website
  const [activeConfirmedBooking, setActiveConfirmedBooking] = useState<Booking | null>(null);

  // Initiate a new booking draft
  const handleInitiateBooking = (bookingData: Omit<Booking, 'id' | 'code' | 'createdAt' | 'paymentStatus'>): Booking => {
    const bookingCode = `SGL-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 16);

    const newBooking: Booking = {
      ...bookingData,
      id: `bk-${Date.now()}`,
      code: bookingCode,
      createdAt: timestamp,
      paymentStatus: 'pending_deposit',
    };

    setBookings((prev) => [newBooking, ...prev]);
    return newBooking;
  };

  // Open VietQR payment modal
  const handleOpenPaymentModal = (booking: Booking, room: Room) => {
    setPaymentModalState({ booking, room });
  };

  // Confirm VietQR payment (Auto Webhook simulation)
  const handleConfirmPayment = (bookingId: string) => {
    if (!paymentModalState) return;

    const { booking, room } = paymentModalState;
    const nowStr = new Date().toLocaleTimeString('vi-VN');

    // 1. Update booking status
    const updatedBooking: Booking = {
      ...booking,
      paymentStatus: 'paid_deposit',
      transactionRef: `FT${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    };

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updatedBooking : b)));

    // 2. Lock room status in PMS to 'booked_direct'
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, status: 'booked_direct', currentBookingId: bookingId } : r))
    );

    // 3. Add real-time Channel Sync Log
    const newLog: ChannelSyncLog = {
      id: `log-${Date.now()}`,
      timestamp: `${new Date().toISOString().substring(0, 10)} ${nowStr}`,
      channel: 'Direct Website',
      action: `Thanh toán cọc VietQR thành công (${updatedBooking.depositAmount.toLocaleString()}đ)`,
      roomNumber: room.number,
      status: 'synced',
      details: `Đã tự động gửi tín hiệu khóa phòng ${room.number} trên Booking.com & Agoda thành công trong 1.5s.`,
    };

    setSyncLogs((prev) => [newLog, ...prev]);

    // 4. Record income transaction
    const newTx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: `${new Date().toISOString().substring(0, 10)} ${nowStr}`,
      type: 'income',
      category: 'deposit',
      amount: updatedBooking.depositAmount,
      title: `Tiền cọc VietQR trực tiếp đơn ${updatedBooking.code} (${updatedBooking.customerName})`,
      bookingCode: updatedBooking.code,
      performedBy: 'Hệ Thống VietQR Tự Động',
      paymentMethod: 'vietqr',
    };
    setTransactions((prev) => [newTx, ...prev]);

    // 5. Record/update customer
    setCustomers((prev) => {
      const existing = prev.find((c) => c.phone === updatedBooking.customerPhone);
      if (existing) {
        return prev.map((c) =>
          c.phone === updatedBooking.customerPhone
            ? { ...c, totalStays: c.totalStays + 1, totalSpent: c.totalSpent + updatedBooking.totalPrice, lastStayDate: updatedBooking.checkIn }
            : c
        );
      }
      return [
        {
          id: `cust-${Date.now()}`,
          name: updatedBooking.customerName,
          phone: updatedBooking.customerPhone,
          email: updatedBooking.customerEmail,
          totalStays: 1,
          totalSpent: updatedBooking.totalPrice,
          lastStayDate: updatedBooking.checkIn,
          tier: 'new',
          zaloContact: updatedBooking.customerPhone,
          createdAt: new Date().toISOString().substring(0, 10),
        },
        ...prev,
      ];
    });

    // 6. Set active confirmed booking for guest view banner
    setActiveConfirmedBooking(updatedBooking);

    // 7. Close modal
    setPaymentModalState(null);
  };

  // Handle Manual Booking from Admin
  const handleManualBooking = (newBooking: Booking, paidAmount?: number) => {
    setBookings((prev) => [newBooking, ...prev]);

    // Lock room
    setRooms((prev) =>
      prev.map((r) =>
        r.id === newBooking.roomId ? { ...r, status: 'booked_direct', currentBookingId: newBooking.id } : r
      )
    );

    // Record cash transaction if deposit/paid amount exists
    if (paidAmount && paidAmount > 0) {
      const newTx: CashTransaction = {
        id: `tx-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'income',
        category: 'deposit',
        amount: paidAmount,
        title: `Tiền cọc đặt thủ công ${newBooking.code} (${newBooking.customerName})`,
        bookingCode: newBooking.code,
        performedBy: newBooking.createdBy || 'Lễ Tân Thủy',
        paymentMethod: 'cash',
      };
      setTransactions((prev) => [newTx, ...prev]);
    }

    // Record customer
    setCustomers((prev) => {
      const existing = prev.find((c) => c.phone === newBooking.customerPhone);
      if (existing) {
        return prev.map((c) =>
          c.phone === newBooking.customerPhone
            ? { ...c, totalStays: c.totalStays + 1, totalSpent: c.totalSpent + newBooking.totalPrice, lastStayDate: newBooking.checkIn }
            : c
        );
      }
      return [
        {
          id: `cust-${Date.now()}`,
          name: newBooking.customerName,
          phone: newBooking.customerPhone,
          email: newBooking.customerEmail,
          totalStays: 1,
          totalSpent: newBooking.totalPrice,
          lastStayDate: newBooking.checkIn,
          tier: 'new',
          zaloContact: newBooking.customerPhone,
          createdAt: new Date().toISOString().substring(0, 10),
        },
        ...prev,
      ];
    });

    // Add log
    const newLog: ChannelSyncLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      channel: 'PMS Local',
      action: `Đặt phòng thủ công (${newBooking.code}) - ${newBooking.customerName}`,
      roomNumber: newBooking.roomNumber,
      status: 'synced',
      details: `Đơn tạo từ ${newBooking.sourceNote || newBooking.channel}. Đã cập nhật PMS và khóa lịch phòng ${newBooking.roomNumber}.`,
    };
    setSyncLogs((prev) => [newLog, ...prev]);
  };

  // Simulate an incoming OTA booking (from Booking.com or Agoda)
  const handleSimulateOtaBooking = (channel: 'booking.com' | 'agoda') => {
    // Find first available room
    const availableRoom = rooms.find((r) => r.status === 'available' && r.isActive !== false);
    if (!availableRoom) {
      alert(`Tất cả ${rooms.filter(r => r.isActive !== false).length} phòng đang kinh doanh của Seagull Homestay đều đã kín lịch!`);
      return;
    }

    const roomType = roomTypes.find((t) => t.id === availableRoom.roomTypeId);
    const roomTypeName = roomType ? roomType.name : 'Phòng Tiêu Chuẩn';
    const channelName = channel === 'booking.com' ? 'Booking.com' : 'Agoda';
    const statusType = channel === 'booking.com' ? 'booked_booking' : 'booked_agoda';

    const bookingCode = channel === 'booking.com' ? `BKG-${Math.floor(1000 + Math.random() * 9000)}` : `AGD-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowStr = new Date().toLocaleTimeString('vi-VN');

    // 1. Update room status
    handleUpdateRooms(
      rooms.map((r) => (r.id === availableRoom.id ? { ...r, status: statusType } : r))
    );

    // 2. Add OTA booking record
    const otaBooking: Booking = {
      id: `bk-ota-${Date.now()}`,
      code: bookingCode,
      customerName: channel === 'booking.com' ? 'Alex Johnson (Khách OTA)' : 'Nguyễn Hoàng Yến (Agoda)',
      customerPhone: '+84 909 xxx xxx',
      customerEmail: 'ota.guest@partner.com',
      checkIn: '2026-08-05',
      checkOut: '2026-08-07',
      nights: 2,
      roomId: availableRoom.id,
      roomNumber: availableRoom.number,
      roomTypeName: roomTypeName,
      totalPrice: (roomType?.basePrice || 650000) * 2,
      depositPercent: 100,
      depositAmount: (roomType?.basePrice || 650000) * 2,
      paymentStatus: 'paid_deposit',
      channel: channel,
      createdAt: new Date().toISOString().substring(0, 10),
    };

    setBookings((prev) => [otaBooking, ...prev]);

    // 3. Add Channel Sync Log
    const newLog: ChannelSyncLog = {
      id: `log-${Date.now()}`,
      timestamp: `${new Date().toISOString().substring(0, 10)} ${nowStr}`,
      channel: channel === 'booking.com' ? 'Booking.com' : 'Agoda',
      action: `Khách đặt thành công từ ${channelName}`,
      roomNumber: availableRoom.number,
      status: 'synced',
      details: `Channel Manager đã nhận XML. Tự động khóa phòng ${availableRoom.number} trên Website Direct & các OTA còn lại.`,
    };

    setSyncLogs((prev) => [newLog, ...prev]);
  };

  // Reset all rooms to available
  const handleResetAllRooms = () => {
    handleUpdateRooms(rooms.map((r) => ({ ...r, status: 'available', currentBookingId: undefined })));
    setSyncLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        channel: 'PMS Local',
        action: `Reset toàn bộ sơ đồ ${rooms.length} phòng`,
        roomNumber: 'Tất cả',
        status: 'synced',
        details: `Đã mở lại toàn bộ ${rooms.length} phòng trên Website, Booking.com và Agoda.`,
      },
      ...prev,
    ]);
  };

  const activeRoomsCount = rooms.filter((r) => r.isActive !== false).length;

  return (
    <SiteContentProvider>
      <div className="min-h-screen bg-[#FAF8F5] font-sans antialiased selection:bg-[#C8A261] selection:text-[#151B17]">
        {/* ============================================================= */}
        {/* 1. WEBSITE SEAGULL THƯƠNG HIỆU (/) */}
        {/* ============================================================= */}
        {currentRoute === 'website' && (
          <SeagullWebsite
            propertyConfig={propertyConfig}
            roomTypes={roomTypes}
            onNavigateToBooking={(roomTypeId) => navigateTo('booking', roomTypeId)}
          />
        )}

        {/* ============================================================= */}
        {/* 2. SEAGULL BOOKING ENGINE (/booking) */}
        {/* ============================================================= */}
        {currentRoute === 'booking' && (
          <BookingPortal
            roomTypes={roomTypes}
            rooms={rooms}
            bookings={bookings}
            propertyConfig={propertyConfig}
            onInitiateBooking={handleInitiateBooking}
            onOpenPaymentModal={handleOpenPaymentModal}
            activeConfirmedBooking={activeConfirmedBooking}
            onNavigateToWebsite={() => navigateTo('website')}
            preselectedRoomTypeId={preselectedRoomTypeId}
          />
        )}

        {/* ============================================================= */}
        {/* 3. SEAGULL ADMIN DASHBOARD (/admin) */}
        {/* ============================================================= */}
        {currentRoute === 'admin' && (
          <AdminManager
            roomTypes={roomTypes}
            rooms={rooms}
            bookings={bookings}
            propertyConfig={propertyConfig}
            syncLogs={syncLogs}
            customers={customers}
            transactions={transactions}
            staffList={staffList}
            onUpdateRoomTypes={handleUpdateRoomTypes}
            onUpdateRooms={handleUpdateRooms}
            onUpdateBookings={setBookings}
            onUpdatePropertyConfig={handleUpdatePropertyConfig}
            onUpdateCustomers={setCustomers}
            onUpdateTransactions={setTransactions}
            onUpdateStaffList={handleUpdateStaffList}
            onManualBooking={handleManualBooking}
            isAuthenticated={isAdminAuthenticated}
            onAuthenticate={handleSetAdminAuthenticated}
            onNavigateToWebsite={() => navigateTo('website')}
          />
        )}

        {/* VietQR Payment Modal */}
        {paymentModalState && (
          <VietQRModal
            booking={paymentModalState.booking}
            room={paymentModalState.room}
            onClose={() => setPaymentModalState(null)}
            onConfirmPayment={handleConfirmPayment}
            propertyConfig={propertyConfig}
          />
        )}

        {/* Floating Quick Navigation Switcher (Public routes only — staff access /admin directly via URL) */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#0E2A47]/95 backdrop-blur-md text-white px-3 py-1.5 rounded-full shadow-2xl border border-[#C8A261]/40 flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => navigateTo('website')}
            className={`px-3 py-1.5 rounded-full transition-all ${
              currentRoute === 'website'
                ? 'bg-[#C8A261] text-[#0E2A47] font-bold shadow'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            🏠 Website Khách
          </button>
          <button
            onClick={() => navigateTo('booking')}
            className={`px-3 py-1.5 rounded-full transition-all ${
              currentRoute === 'booking'
                ? 'bg-[#C8A261] text-[#0E2A47] font-bold shadow'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            📅 Đặt Phòng (/booking)
          </button>
        </div>
      </div>
    </SiteContentProvider>
  );
}
