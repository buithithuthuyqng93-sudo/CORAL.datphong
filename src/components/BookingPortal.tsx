import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Users, Check, Sparkles, MapPin, Phone, ShieldCheck, 
  ArrowLeft, Search, Eye, Maximize2, Coffee, Tv, Bath, Wind, Flame, 
  CheckCircle2, Clock, Info, AlertCircle, FileText, QrCode, Loader2
} from 'lucide-react';
import { SeagullWingsIcon } from './SeagullWingsIcon';
import { RoomType, Room, Booking, PropertyConfig } from '../types';
import { useSiteContent } from '../context/SiteContentContext';
import { apiCheckAvailability, apiCreateBooking } from '../services/dataAdapter';
import { isBookingBlockingRoom } from '../utils/bookingHold';

interface BookingPortalProps {
  roomTypes: RoomType[];
  rooms: Room[];
  bookings: Booking[];
  propertyConfig: PropertyConfig;
  onInitiateBooking: (bookingData: Omit<Booking, 'id' | 'code' | 'createdAt' | 'paymentStatus'>) => Booking;
  onSyncExternalBooking?: (booking: Booking) => void;
  onOpenPaymentModal: (booking: Booking, room: Room) => void;
  activeConfirmedBooking?: Booking | null;
  onNavigateToWebsite: () => void;
  preselectedRoomTypeId?: string;
  availabilityRefreshKey?: number;
}

export const BookingPortal: React.FC<BookingPortalProps> = ({
  roomTypes,
  rooms,
  bookings,
  propertyConfig,
  onInitiateBooking,
  onSyncExternalBooking,
  onOpenPaymentModal,
  activeConfirmedBooking,
  onNavigateToWebsite,
  preselectedRoomTypeId,
  availabilityRefreshKey = 0,
}) => {
  const { getMediaUrl } = useSiteContent();

  const cleanHotline = (propertyConfig?.hotline || '0868011799 - 0981065065').replace(/\s*\([^)]*\)/g, '').trim();
  const ownerLabel = propertyConfig?.ownerName && !propertyConfig.ownerName.includes('Thủy')
    ? propertyConfig.ownerName
    : 'Mr Thiện / Ms Điền';

  const parseBookingQueryParams = () => {
    const defaults = { checkIn: '2026-08-05', checkOut: '2026-08-07', guestCount: 2, childrenCount: 0 };
    if (typeof window === 'undefined') return defaults;
    const sp = new URLSearchParams(window.location.search);
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const rawIn = sp.get('checkin') || sp.get('checkIn') || '';
    const rawOut = sp.get('checkout') || sp.get('checkOut') || '';
    const rawAdults = sp.get('adults');
    const rawChildren = sp.get('children');

    let nextIn = defaults.checkIn;
    let nextOut = defaults.checkOut;

    if (isoRe.test(rawIn)) {
      nextIn = rawIn;
      if (isoRe.test(rawOut) && rawOut > rawIn) {
        nextOut = rawOut;
      } else {
        const d = new Date(`${rawIn}T00:00:00`);
        if (!Number.isNaN(d.getTime())) {
          d.setDate(d.getDate() + 1);
          nextOut = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
    } else if (isoRe.test(rawOut) && rawOut > defaults.checkIn) {
      nextOut = rawOut;
    }

    const parsedAdults = rawAdults !== null ? Number.parseInt(rawAdults, 10) : NaN;
    const parsedChildren = rawChildren !== null ? Number.parseInt(rawChildren, 10) : NaN;
    const validAdults = Number.isFinite(parsedAdults) && parsedAdults >= 1 ? Math.min(20, parsedAdults) : null;
    const validChildren = Number.isFinite(parsedChildren) && parsedChildren >= 0 ? Math.min(20, parsedChildren) : 0;

    const nextGuests = validAdults !== null ? validAdults + validChildren : defaults.guestCount;
    const nextChildren = validAdults !== null ? validChildren : 0;

    return {
      checkIn: nextIn,
      checkOut: nextOut,
      guestCount: nextGuests,
      childrenCount: nextChildren,
    };
  };

  const initialQuery = parseBookingQueryParams();

  // Search filter states
  const [checkIn, setCheckIn] = useState(initialQuery.checkIn);
  const [checkOut, setCheckOut] = useState(initialQuery.checkOut);
  const [guestCount, setGuestCount] = useState(initialQuery.guestCount);
  const [childrenCount, setChildrenCount] = useState(initialQuery.childrenCount);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const syncFromUrl = () => {
      const sp = new URLSearchParams(window.location.search);
      if (!sp.has('checkin') && !sp.has('checkIn') && !sp.has('checkout') && !sp.has('checkOut') && !sp.has('adults')) {
        return;
      }
      const next = parseBookingQueryParams();
      setCheckIn(next.checkIn);
      setCheckOut(next.checkOut);
      setGuestCount(next.guestCount);
      setChildrenCount(next.childrenCount);
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  // Live server availability state (real-time expired-hold excluded on backend)
  const [liveAvailableRooms, setLiveAvailableRooms] = useState<Room[] | null>(null);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState<boolean>(false);
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());

  // Room modal & selection
  const [detailModalRoomType, setDetailModalRoomType] = useState<RoomType | null>(null);
  const [detailModalActiveImage, setDetailModalActiveImage] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(() => {
    if (preselectedRoomTypeId) {
      return roomTypes.find((r) => r.id === preselectedRoomTypeId) || null;
    }
    return null;
  });

  // Keep preselected or active roomType synced when live CMS roomTypes hydrate or change
  useEffect(() => {
    if (selectedRoomType) {
      const updated = roomTypes.find((r) => r.id === selectedRoomType.id);
      if (updated && updated !== selectedRoomType) {
        setSelectedRoomType(updated);
      }
    } else if (preselectedRoomTypeId) {
      const matched = roomTypes.find((r) => r.id === preselectedRoomTypeId);
      if (matched) {
        setSelectedRoomType(matched);
      }
    }
  }, [roomTypes, preselectedRoomTypeId]);

  // Booking Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Lookup Booking State
  const [lookupTab, setLookupTab] = useState<boolean>(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [foundBooking, setFoundBooking] = useState<Booking | null>(null);
  const [lookupError, setLookupError] = useState('');

  // Fetch real-time availability from backend API (excludes expired holds immediately at query time)
  const fetchLiveAvailability = useCallback(async () => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    const result = await apiCheckAvailability(undefined, checkIn, checkOut);
    setNowTickMs(Date.now());
    if (result && !result.isDemo && Array.isArray(result.availableRooms)) {
      const mappedRooms: Room[] = result.availableRooms.map((r: any) => ({
        id: r.id,
        number: r.room_code || r.number || r.id,
        floor: Number(r.floor_or_area ?? r.floor ?? 1),
        area: r.area_label || r.area,
        roomTypeId: r.room_type_id || r.roomTypeId,
        status: 'available',
        housekeepingStatus: r.housekeeping_status || r.housekeepingStatus || 'clean',
        isActive: r.active !== false,
      }));
      setLiveAvailableRooms(mappedRooms);
      setIsLiveBackend(true);
    } else {
      setLiveAvailableRooms(null);
      setIsLiveBackend(false);
    }
  }, [checkIn, checkOut]);

  useEffect(() => {
    fetchLiveAvailability();
  }, [fetchLiveAvailability, availabilityRefreshKey]);

  // Auto-refresh availability every 30s so expired 15-min holds release on screen without page reload
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTickMs(Date.now());
      fetchLiveAvailability();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLiveAvailability]);

  // Calculate nights
  const calculateNights = () => {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diffTime = Math.max(0, d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };
  const nights = calculateNights();

  // Inventory filtering:
  // - Production: uses live /api/availability rooms (real-time expired-hold excluded on server)
  // - Local/Demo fallback: excludes active overlapping bookings while auto-releasing expired holds
  const getAvailableRoomsList = (typeId: string): Room[] => {
    if (isLiveBackend && liveAvailableRooms) {
      return liveAvailableRooms.filter((r) => r.roomTypeId === typeId && r.isActive !== false);
    }

    const busyRoomIds = new Set(
      bookings
        .filter((b) => isBookingBlockingRoom(b, checkIn, checkOut, nowTickMs))
        .map((b) => b.roomId)
    );

    return rooms.filter(
      (r) =>
        r.roomTypeId === typeId &&
        r.status === 'available' &&
        r.isActive !== false &&
        !busyRoomIds.has(r.id)
    );
  };

  const getAvailableRoomsCount = (typeId: string) => {
    return getAvailableRoomsList(typeId).length;
  };

  const handleStartBooking = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setFormError('');
    const formEl = document.getElementById('booking-drawer');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim() || !customerPhone.trim()) {
      setFormError('Vui lòng điền họ tên và số điện thoại liên hệ.');
      return;
    }

    if (!selectedRoomType) {
      setFormError('Vui lòng chọn một hạng bungalow để tiếp tục.');
      return;
    }

    const availableRooms = getAvailableRoomsList(selectedRoomType.id);
    if (availableRooms.length === 0) {
      setFormError('Rất tiếc, hạng phòng này vừa hết phòng trống trong khoảng thời gian này.');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      // Create booking hold via backend API (which real-time filters expired holds before assigning)
      const apiRes = await apiCreateBooking({
        roomTypeId: selectedRoomType.id,
        checkIn,
        checkOut,
        guestName: customerName.trim(),
        phone: customerPhone.trim(),
        email: customerEmail.trim() || undefined,
        adults: childrenCount > 0 ? Math.max(1, guestCount - childrenCount) : guestCount,
        children: childrenCount,
        notes: customerNotes.trim() || undefined,
      });

      if (apiRes.success && !apiRes.isDemo && apiRes.booking) {
        const createdBooking = apiRes.booking;
        const matchedRoom: Room =
          availableRooms.find((r) => r.id === createdBooking.roomId) || {
            id: createdBooking.roomId,
            number: createdBooking.roomNumber,
            floor: 1,
            roomTypeId: selectedRoomType.id,
            status: 'available',
            isActive: true,
          };

        if (onSyncExternalBooking) {
          onSyncExternalBooking(createdBooking);
        }
        onOpenPaymentModal(createdBooking, matchedRoom);
        // Refresh real-time availability immediately after holding
        fetchLiveAvailability();
        return;
      }

      // Demo mode fallback
      const targetRoom = availableRooms[0];
      const totalPrice = selectedRoomType.basePrice * nights;
      const depositPercent = selectedRoomType.depositPercent ?? 30;
      const depositAmount = Math.ceil((totalPrice * depositPercent) / 100);

      const newBooking = onInitiateBooking({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || `${customerPhone.trim()}@guest.seagull`,
        checkIn,
        checkOut,
        nights,
        roomId: targetRoom.id,
        roomNumber: targetRoom.number,
        roomTypeName: selectedRoomType.name,
        totalPrice,
        depositPercent,
        depositAmount,
        channel: 'direct',
      });

      onOpenPaymentModal(newBooking, targetRoom);
    } catch (err: any) {
      setFormError(err?.message || 'Không thể giữ phòng lúc này. Vui lòng thử lại.');
      fetchLiveAvailability();
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleLookupBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setFoundBooking(null);

    const cleanCode = lookupCode.trim().toUpperCase();
    const cleanPh = lookupPhone.trim();

    if (!cleanCode || !cleanPh) {
      setLookupError('Vui lòng nhập cả Mã Đặt Phòng và Số Điện Thoại.');
      return;
    }

    const match = bookings.find(
      (b) => b.code.toUpperCase() === cleanCode && b.customerPhone.includes(cleanPh)
    );

    if (match) {
      setFoundBooking(match);
    } else {
      setLookupError('Không tìm thấy đơn đặt phòng với thông tin trên.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2321] font-sans pb-24 selection:bg-[#C8A261] selection:text-[#151B17]">
      {/* ------------------------------------------------------------- */}
      {/* 1. BOOKING ENGINE HEADER */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-[#151B17] text-[#FAF8F5] border-b border-[#2C3831] shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left: Brand Logo & Back to Website Link */}
            <div className="flex items-center gap-4">
              <button
                onClick={onNavigateToWebsite}
                className="flex items-center gap-1.5 text-xs text-[#E8D0A8] hover:text-white bg-[#232D27] hover:bg-[#2D3931] border border-[#3B473E] px-3 py-2 rounded-xl transition-all"
                title="Quay lại trang giới thiệu thương hiệu"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Về Website Seagull</span>
              </button>

              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={onNavigateToWebsite}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E2C799] via-[#C8A261] to-[#9E7A3B] flex items-center justify-center text-[#151B17] font-bold shadow-md shadow-[#C8A261]/25">
                  <SeagullWingsIcon className="w-5 h-5 text-[#151B17]" />
                </div>
                <div>
                  <h1 className="font-serif text-lg sm:text-xl font-bold uppercase tracking-wide">
                    SEAGULL LÝ SƠN
                  </h1>
                  <span className="text-[10px] text-[#C8A261] font-bold uppercase tracking-wider block">
                    Cổng Đặt Phòng Trực Tuyến
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Hotline Support & Booking Lookup Toggle */}
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => setLookupTab(!lookupTab)}
                className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  lookupTab
                    ? 'bg-[#C8A261] text-[#151B17]'
                    : 'bg-[#1E2721] text-[#D5CBBF] hover:text-white border border-[#2D3931]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tra Cứu Đơn</span>
              </button>

              <div className="hidden md:flex items-center gap-1.5 text-[#B8A99A]">
                <Phone className="w-3.5 h-3.5 text-[#C8A261]" />
                <span>Hotline: <strong className="text-white">{cleanHotline}</strong> ({ownerLabel})</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. ENVIRONMENT NOTICE BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-[#1C2321] text-[#FAF8F5] border-b border-[#2D3931] px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C8A261] animate-pulse" />
            <span className="text-[#E8D0A8]">
              <strong>Quy chuẩn đặt cọc 30%:</strong> Khóa phòng tức thì 15 phút qua VietQR tự động. 70% thanh toán khi check-in.
            </span>
          </div>
          <span className="text-[11px] text-[#A39687]">
            Miễn phí xe điện đón tại cảng An Vĩnh cho khách đặt phòng trước 24 giờ.
          </span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* ------------------------------------------------------------- */}
        {/* LOOKUP MODAL DRAWER */}
        {/* ------------------------------------------------------------- */}
        {lookupTab && (
          <div className="bg-white border border-[#E8E2D9] rounded-2xl p-6 shadow-xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#C8A261]" />
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Tra Cứu Thông Tin Đơn Đặt Phòng
                </h3>
              </div>
              <button
                onClick={() => setLookupTab(false)}
                className="text-xs text-[#706557] hover:text-[#1C2321] underline"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleLookupBooking} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#706557] uppercase mb-1">
                  Mã đơn đặt phòng (Ví dụ: SGL-...)
                </label>
                <input
                  type="text"
                  placeholder="SGL-260801-XXXX"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-[#C8A261]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#706557] uppercase mb-1">
                  Số điện thoại khách hàng
                </label>
                <input
                  type="text"
                  placeholder="0981xxxxxx"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#C8A261]"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-[#151B17] hover:bg-[#C8A261] text-white hover:text-[#151B17] font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  <span>Tra Cứu Ngay</span>
                </button>
              </div>
            </form>

            {lookupError && (
              <p className="text-xs text-rose-600 font-bold">{lookupError}</p>
            )}

            {foundBooking && (
              <div className="bg-[#FAF8F5] border border-[#E2D6C3] rounded-xl p-4 text-xs space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-[#9E7A3B]">
                    Mã đơn: {foundBooking.code}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    foundBooking.paymentStatus === 'paid_deposit' || foundBooking.paymentStatus === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {foundBooking.paymentStatus === 'paid_deposit' ? 'Đã Cọc 30% VietQR'
                      : foundBooking.paymentStatus === 'confirmed' ? 'Đã Xác Nhận'
                      : 'Chờ Thanh Toán Cọc'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[#706557]">
                  <div>Khách: <strong className="text-[#1C2321]">{foundBooking.customerName}</strong></div>
                  <div>Hạng phòng: <strong className="text-[#1C2321]">{foundBooking.roomTypeName} (Phòng {foundBooking.roomNumber})</strong></div>
                  <div>Thời gian: <strong className="text-[#1C2321]">{foundBooking.checkIn} → {foundBooking.checkOut} ({foundBooking.nights} đêm)</strong></div>
                  <div>Tổng tiền: <strong className="text-[#1C2321]">{foundBooking.totalPrice.toLocaleString('vi-VN')} đ</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 3. DATES & GUEST SEARCH FILTER BAR */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-white border border-[#E8E2D9] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261] block">
                BƯỚC 1: CHỌN NGÀY LƯU TRÚ & SỐ KHÁCH
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                Tìm Phòng Trống Seagull Lý Sơn
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#706557] font-medium">Lưu trú:</span>
              <span className="bg-[#FAF8F5] border border-[#E0D8CD] px-3 py-1 rounded-xl text-xs font-bold text-[#9E7A3B]">
                {nights} Đêm Nghỉ Dưỡng
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#706557] uppercase mb-1">
                Ngày nhận phòng (Check-in)
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#C8A261]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#706557] uppercase mb-1">
                Ngày trả phòng (Check-out)
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#C8A261]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#706557] uppercase mb-1">
                Số lượng khách
                {childrenCount > 0 && (
                  <span className="ml-1.5 normal-case font-semibold text-[#9E7A3B]">
                    ({Math.max(1, guestCount - childrenCount)} người lớn · {childrenCount} trẻ em)
                  </span>
                )}
              </label>
              <select
                value={guestCount}
                onChange={(e) => {
                  setGuestCount(Number(e.target.value));
                  setChildrenCount(0);
                }}
                className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#C8A261]"
              >
                <option value={1}>1 Khách (Đi một mình)</option>
                <option value={2}>2 Khách (Cặp đôi / Bạn bè)</option>
                <option value={3}>3 Khách</option>
                <option value={4}>4 Khách (Gia đình / Nhóm nhỏ)</option>
                {guestCount > 4 && (
                  <option value={guestCount}>{guestCount} Khách (Gia đình / Nhóm)</option>
                )}
              </select>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 4. ROOM SUITES INVENTORY LIST */}
        {/* ------------------------------------------------------------- */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1C2321]">
              Danh Mục Hạng Bungalow Mái Vòm
            </h3>
            <span className="text-xs text-[#706557]">
              Giá áp dụng cho {nights} đêm • Đã bao gồm cọc 30%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roomTypes.filter((rt) => rt.active !== false).map((rt) => {
              const availableCount = getAvailableRoomsCount(rt.id);
              const totalPrice = rt.basePrice * nights;
              const depositPercent = rt.depositPercent ?? 30;
              const depositAmount = Math.ceil((totalPrice * depositPercent) / 100);
              const isSelected = selectedRoomType?.id === rt.id;
              const specSummary = [
                rt.size,
                `${rt.bedrooms ?? 1} phòng ngủ`,
                `${rt.bathrooms ?? 1} phòng tắm`,
                (rt.hasBalcony ?? true) ? 'Có ban công' : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={rt.id}
                  className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-xl ${
                    isSelected ? 'border-[#C8A261] ring-2 ring-[#C8A261]/30' : 'border-[#E8E2D9]'
                  }`}
                >
                  <div>
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img 
                        src={rt.image} 
                        alt={rt.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-[#151B17]/90 backdrop-blur-sm text-[#E8D0A8] text-[10px] font-bold px-3 py-1 rounded-full border border-[#C8A261]/40">
                        {rt.name}
                      </div>

                      <div className="absolute top-3 right-3">
                        {availableCount > 0 ? (
                          <span className="bg-emerald-700/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                            Còn {availableCount} căn trống
                          </span>
                        ) : (
                          <span className="bg-rose-700/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                            Hết phòng ngày này
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 right-3 bg-[#151B17]/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl border border-white/20 text-right">
                        <span className="text-[10px] text-[#C8A261] block">Giá {nights} đêm</span>
                        <strong className="text-base font-serif text-[#FAF8F5] tabular-nums">
                          {totalPrice.toLocaleString('vi-VN')} đ
                        </strong>
                        <span className="text-[10px] text-emerald-400 block font-semibold tabular-nums">
                          Cọc {depositPercent}%: {depositAmount.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-3.5">
                      <div>
                        <h4 className="font-serif text-lg font-bold text-[#1C2321]">{rt.name}</h4>
                        <p className="text-[11px] font-semibold text-[#9E7A3B] mt-0.5">{specSummary}</p>
                        <p className="text-xs text-[#706557] mt-1.5 leading-relaxed">{rt.description}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {rt.amenities.map((am, idx) => (
                          <span key={idx} className="bg-[#FAF8F5] border border-[#E8E2D9] px-2 py-0.5 rounded text-[#6B5F50]">
                            {am}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 border-t border-[#F0EBE1] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalRoomType(rt);
                        setDetailModalActiveImage(rt.image);
                      }}
                      className="text-xs text-[#9E7A3B] hover:text-[#C8A261] font-bold flex items-center gap-1 underline"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Chi tiết phòng</span>
                    </button>

                    {availableCount > 0 ? (
                      <button
                        onClick={() => handleStartBooking(rt)}
                        className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-700 text-white shadow-emerald-700/20'
                            : 'bg-[#151B17] hover:bg-[#C8A261] text-white hover:text-[#151B17]'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Đã Chọn Hạng Này</span>
                          </>
                        ) : (
                          <span>Chọn Đặt Phòng</span>
                        )}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="bg-gray-200 text-gray-500 font-bold text-xs px-4 py-2.5 rounded-xl cursor-not-allowed"
                      >
                        Hết Phòng
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 5. GUEST DETAILS & DEPOSIT CONFIRMATION FORM */}
        {/* ------------------------------------------------------------- */}
        {selectedRoomType && (() => {
          const selectedDepositPercent = selectedRoomType.depositPercent ?? 30;
          const selectedTotal = selectedRoomType.basePrice * nights;
          const selectedDepositAmount = Math.ceil((selectedTotal * selectedDepositPercent) / 100);
          const selectedRemainingAmount = selectedTotal - selectedDepositAmount;
          const remainingPercent = Math.max(0, 100 - selectedDepositPercent);

          return (
          <section id="booking-drawer" className="bg-white border-2 border-[#C8A261] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E8E2D9] gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#9E7A3B] block">
                  BƯỚC 2: THÔNG TIN KHÁCH HÀNG & XÁC NHẬN CỌC {selectedDepositPercent}%
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#1C2321]">
                  Đặt Hạng Phòng: {selectedRoomType.name}
                </h3>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#706557] block">Số đêm: {nights} đêm</span>
                <strong className="text-lg font-serif text-[#C8A261] tabular-nums">
                  {selectedTotal.toLocaleString('vi-VN')} đ
                </strong>
              </div>
            </div>

            {/* Price Snapshot & Deposit Calculation Breakdown */}
            <div className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-2xl p-4 sm:p-5 text-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-[#706557] block font-bold uppercase text-[10px]">1. Tổng Giá Tiền Phòng</span>
                <strong className="text-base text-[#1C2321] font-serif tabular-nums">
                  {selectedTotal.toLocaleString('vi-VN')} đ
                </strong>
                <p className="text-[10px] text-[#A39687] tabular-nums">
                  {selectedRoomType.basePrice.toLocaleString('vi-VN')}đ × {nights} đêm
                </p>
              </div>

              <div className="space-y-1 bg-white p-3 rounded-xl border border-[#C8A261]/40">
                <span className="text-[#9E7A3B] block font-bold uppercase text-[10px]">
                  2. Tiền Cọc Tối Thiểu ({selectedDepositPercent}%)
                </span>
                <strong className="text-lg text-[#9E7A3B] font-serif tabular-nums">
                  {selectedDepositAmount.toLocaleString('vi-VN')} đ
                </strong>
                <p className="text-[10px] text-emerald-700 font-bold">
                  Thanh toán qua VietQR để khóa phòng 15 phút
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[#706557] block font-bold uppercase text-[10px]">
                  3. Số Tiền Còn Lại Khi Check-in ({remainingPercent}%)
                </span>
                <strong className="text-base text-[#1C2321] font-serif tabular-nums">
                  {selectedRemainingAmount.toLocaleString('vi-VN')} đ
                </strong>
                <p className="text-[10px] text-[#A39687]">
                  Thanh toán khi làm thủ tục nhận phòng
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">
                    Họ và tên khách hàng <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#C8A261] focus:outline-none font-semibold text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">
                    Số điện thoại / Zalo <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0981xxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#C8A261] focus:outline-none font-semibold text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">
                    Địa chỉ Email (Nhận mã xác nhận)
                  </label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#C8A261] focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">
                  Ghi chú hoặc yêu cầu đưa đón tại cảng An Vĩnh (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chúng tôi đến chuyến tàu 08:30 sáng, cần xe điện đón tại Cảng..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#C8A261] focus:outline-none text-xs"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-[#706557]">
                  Nhấn xác nhận để sinh mã <strong>VietQR MB Bank</strong> và giữ phòng trong <strong>15 phút</strong>.
                </span>

                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="w-full sm:w-auto bg-gradient-to-r from-[#C8A261] to-[#E2C799] hover:from-[#B38D4F] hover:to-[#C8A261] disabled:opacity-60 text-[#151B17] font-bold text-xs uppercase tracking-wider px-8 py-3.5 rounded-xl shadow-xl shadow-[#C8A261]/25 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  {isSubmittingBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>ĐANG KIỂM TRA & GIỮ PHÒNG...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>TIẾN HÀNH GIỮ PHÒNG &amp; QUÉT MÃ CỌC {selectedDepositPercent}%</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
          );
        })()}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 6. ROOM DETAIL MODAL */}
      {/* ------------------------------------------------------------- */}
      {detailModalRoomType && (() => {
        const modalGallery = Array.from(
          new Set([detailModalRoomType.image, ...(detailModalRoomType.galleryImages || [])].filter(Boolean))
        );
        const currentModalImg = detailModalActiveImage || detailModalRoomType.image;
        const modalSpecs = [
          detailModalRoomType.size,
          `${detailModalRoomType.bedrooms ?? 1} phòng ngủ`,
          `${detailModalRoomType.bathrooms ?? 1} phòng tắm`,
          (detailModalRoomType.hasBalcony ?? true) ? 'Có ban công' : 'Không ban công',
          detailModalRoomType.bedType,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E8E2D9] space-y-4 animate-fadeIn">
            <div className="relative aspect-[16/10] bg-slate-100">
              <img 
                src={currentModalImg} 
                alt={detailModalRoomType.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setDetailModalRoomType(null)}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full transition-all"
              >
                ✕
              </button>
            </div>

            {modalGallery.length > 1 && (
              <div className="px-6 flex items-center gap-2 overflow-x-auto pb-1">
                {modalGallery.map((imgUrl, idx) => (
                  <button
                    key={`${imgUrl}-${idx}`}
                    type="button"
                    onClick={() => setDetailModalActiveImage(imgUrl)}
                    className={`w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      currentModalImg === imgUrl ? 'border-[#C8A261]' : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`${detailModalRoomType.name} ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="p-6 pt-2 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-[#1C2321]">
                    {detailModalRoomType.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#C8A261] font-mono font-bold tabular-nums">
                      {detailModalRoomType.basePrice.toLocaleString('vi-VN')} đ / đêm
                    </span>
                    <span className="text-xs text-[#706557]">
                      · Cọc {detailModalRoomType.depositPercent ?? 30}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#3D5461] mt-1">{modalSpecs}</p>
                </div>
                <button
                  onClick={() => {
                    handleStartBooking(detailModalRoomType);
                    setDetailModalRoomType(null);
                  }}
                  className="bg-[#C8A261] hover:bg-[#B38D4F] text-[#151B17] font-bold text-xs px-5 py-2.5 rounded-xl shrink-0"
                >
                  Chọn Hạng Này
                </button>
              </div>

              <p className="text-xs text-[#6B5F50] leading-relaxed">
                {detailModalRoomType.description}
              </p>

              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-[#1C2321] block">Tiện nghi phòng bao gồm:</span>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#6B5F50]">
                  {detailModalRoomType.amenities.map((am, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#C8A261] shrink-0" />
                      <span>{am}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
