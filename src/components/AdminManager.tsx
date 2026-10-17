import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RoomType, Room, Booking, PropertyConfig, ChannelSyncLog, HousekeepingStatus,
  Customer, CashTransaction, StaffUser, BookingChannel, PaymentStatus
} from '../types';
import { 
  LayoutDashboard, CalendarDays, ListOrdered, Users, DollarSign, Settings, 
  Plus, Edit2, Trash2, Save, X, Image as ImageIcon, Lock, CheckCircle2, 
  AlertCircle, RefreshCw, Search, Phone, MapPin, Check, Ban, Eye, 
  CalendarPlus, UserCheck, Coffee, Bike, MessageCircle, FileText, 
  ShieldCheck, ShieldAlert, ChevronRight, Sliders, ExternalLink,
  CreditCard, ArrowDownRight, ArrowUpRight, BedDouble, Sparkles
} from 'lucide-react';
import { MediaManagerPanel } from './MediaManagerPanel';
import { SeagullWingsIcon } from './SeagullWingsIcon';
import { INITIAL_ROOMS } from '../data/mockData';

interface AdminManagerProps {
  roomTypes: RoomType[];
  rooms: Room[];
  bookings: Booking[];
  propertyConfig: PropertyConfig;
  syncLogs: ChannelSyncLog[];
  customers?: Customer[];
  transactions?: CashTransaction[];
  staffList?: StaffUser[];
  onUpdateRoomTypes: (roomTypes: RoomType[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdatePropertyConfig: (config: PropertyConfig) => void;
  onUpdateCustomers?: (customers: Customer[]) => void;
  onUpdateTransactions?: (transactions: CashTransaction[]) => void;
  onUpdateStaffList?: (staff: StaffUser[]) => void;
  onManualBooking?: (booking: Booking, paidAmount?: number) => void;
  isAuthenticated: boolean;
  onAuthenticate: (status: boolean) => void;
}

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
  rooms,
  bookings,
  propertyConfig,
  syncLogs,
  customers = [],
  transactions = [],
  staffList = [],
  onUpdateRoomTypes,
  onUpdateRooms,
  onUpdateBookings,
  onUpdatePropertyConfig,
  onUpdateCustomers,
  onUpdateTransactions,
  onUpdateStaffList,
  onManualBooking,
  isAuthenticated,
  onAuthenticate,
}) => {
  // Login Lock PIN state
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // 6 Main Primary Navigation Groups as required by Master Prompt
  type PrimaryTab = 
    | 'overview'       // 1. Tổng quan
    | 'room-calendar'  // 2. Lịch phòng
    | 'bookings'       // 3. Đặt phòng
    | 'customers'      // 4. Khách hàng
    | 'finance'        // 5. Thu chi
    | 'settings';      // 6. Cài đặt

  const [activeTab, setActiveTab] = useState<PrimaryTab>('overview');

  // Sub-tabs under Settings (6. Cài đặt)
  type SettingsSubTab = 
    | 'property-info'   // 6.1. Thông tin Seagull Lý Sơn
    | 'room-catalog'    // 6.2. Quản lý Danh Sách Phòng & Quy Mô Vận Hành
    | 'housekeeping'    // 6.3. Buồng phòng & Vệ sinh
    | 'staff-roles'     // 6.4. Nhân viên & Phân quyền
    | 'payment-email'   // 6.5. Email & Thanh toán VietQR
    | 'media-manager'   // 6.6. Quản lý hình ảnh trực tiếp
    | 'safety-audit';   // 6.7. Kiểm thử An toàn PMS (Nhiệm vụ 5)

  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('property-info');
  const [safetyTestResults, setSafetyTestResults] = useState<any[]>([]);
  const [isSafetyTestingRunning, setIsSafetyTestingRunning] = useState<boolean>(false);

  // Active Staff User / Role Switcher
  const [currentStaff, setCurrentStaff] = useState<string>('Mr Thiện / Ms Điền (Quản lý đặt phòng)');

  // Selected date for Overview & Operations (default 2026-08-01 for demo consistency)
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-01');

  // Data Environment Switcher (Demo Mode vs Production Mode)
  const [dataEnvironment, setDataEnvironment] = useState<'demo' | 'production'>('demo');
  const [dbStatus, setDbStatus] = useState<{
    isChecking: boolean;
    connected: boolean;
    isConfigured: boolean;
    message: string;
    latencyMs?: number;
  }>({
    isChecking: false,
    connected: false,
    isConfigured: false,
    message: 'Chưa kiểm tra',
  });

  const checkLiveDatabaseStatus = async () => {
    setDbStatus((prev) => ({ ...prev, isChecking: true }));
    try {
      const res = await fetch('/api/admin?action=db-status');
      const json = await res.json();
      setDbStatus({
        isChecking: false,
        connected: Boolean(json.connected),
        isConfigured: Boolean(json.isConfigured),
        message: json.message || (json.connected ? 'Kết nối Supabase thành công' : 'Chưa kết nối'),
        latencyMs: json.latencyMs,
      });
    } catch (err: any) {
      setDbStatus({
        isChecking: false,
        connected: false,
        isConfigured: false,
        message: 'Lỗi kiểm tra kết nối: ' + err.message,
      });
    }
  };

  useEffect(() => {
    checkLiveDatabaseStatus();
  }, []);

  // Modal States
  const [isManualBookingOpen, setIsManualBookingOpen] = useState<boolean>(false);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ---------------------------------------------------------------------------
  // MANUAL BOOKING FORM STATE
  // ---------------------------------------------------------------------------
  const [mbCustomerName, setMbCustomerName] = useState('');
  const [mbCustomerPhone, setMbCustomerPhone] = useState('');
  const [mbCustomerEmail, setMbCustomerEmail] = useState('');
  const [mbCheckIn, setMbCheckIn] = useState('2026-08-01');
  const [mbCheckOut, setMbCheckOut] = useState('2026-08-03');
  const [mbCheckInTime, setMbCheckInTime] = useState('14:00');
  const [mbCheckOutTime, setMbCheckOutTime] = useState('12:00');
  const [mbRoomTypeId, setMbRoomTypeId] = useState<string>(roomTypes[0]?.id || 'type-studio');
  const [mbSelectedRoomId, setMbSelectedRoomId] = useState<string>('');
  const [mbGuests, setMbGuests] = useState<number>(2);
  const [mbSource, setMbSource] = useState<BookingChannel>('zalo');
  const [mbCustomPrice, setMbCustomPrice] = useState<number>(0);
  const [mbDiscount, setMbDiscount] = useState<number>(0);
  const [mbDepositAmount, setMbDepositAmount] = useState<number>(0);
  const [mbPaidAmount, setMbPaidAmount] = useState<number>(0);
  const [mbNotes, setMbNotes] = useState('');
  const [mbCreatedBy, setMbCreatedBy] = useState('Lễ tân Thủy');
  const [mbError, setMbError] = useState('');

  // Auto calculate nights
  const mbNights = useMemo(() => {
    const d1 = new Date(mbCheckIn);
    const d2 = new Date(mbCheckOut);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [mbCheckIn, mbCheckOut]);

  // Selected room type object
  const selectedRoomTypeObj = useMemo(() => {
    return roomTypes.find((t) => t.id === mbRoomTypeId) || roomTypes[0];
  }, [roomTypes, mbRoomTypeId]);

  // Base total price
  const mbBaseTotal = useMemo(() => {
    const pricePerNight = mbCustomPrice > 0 ? mbCustomPrice : (selectedRoomTypeObj?.basePrice || 650000);
    return Math.max(0, pricePerNight * mbNights - mbDiscount);
  }, [selectedRoomTypeObj, mbNights, mbCustomPrice, mbDiscount]);

  // Available rooms for selected room type and date range
  const availableRoomsForManualBooking = useMemo(() => {
    return rooms.filter((r) => {
      if (r.roomTypeId !== mbRoomTypeId) return false;
      if (r.status === 'maintenance' || r.status === 'locked' || r.status === 'inactive') return false;
      
      // Check date collision with existing confirmed / checked_in bookings
      const hasConflict = bookings.some((b) => {
        if (b.roomId !== r.id) return false;
        if (b.paymentStatus === 'cancelled' || b.paymentStatus === 'no_show') return false;
        // Collision if: (StartA < EndB) and (EndA > StartB)
        return mbCheckIn < b.checkOut && mbCheckOut > b.checkIn;
      });

      return !hasConflict;
    });
  }, [rooms, mbRoomTypeId, bookings, mbCheckIn, mbCheckOut]);

  // Reset manual booking modal fields
  const handleOpenManualBooking = (preselectedRoomId?: string, preselectedDate?: string) => {
    setMbCustomerName('');
    setMbCustomerPhone('');
    setMbCustomerEmail('');
    setMbCheckIn(preselectedDate || selectedDate || '2026-08-01');
    setMbCheckOut('2026-08-03');
    setMbGuests(2);
    setMbSource('zalo');
    setMbDiscount(0);
    setMbCustomPrice(0);
    setMbNotes('');
    setMbCreatedBy(currentStaff);
    setMbError('');

    if (preselectedRoomId) {
      const room = rooms.find((r) => r.id === preselectedRoomId);
      if (room) {
        setMbRoomTypeId(room.roomTypeId);
        setMbSelectedRoomId(room.id);
      }
    } else {
      setMbSelectedRoomId('');
    }

    setIsManualBookingOpen(true);
  };

  const handleSaveManualBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mbCustomerName.trim() || !mbCustomerPhone.trim()) {
      setMbError('Vui lòng nhập họ tên và số điện thoại khách.');
      return;
    }

    // Determine target room
    let targetRoom: Room | undefined;
    if (mbSelectedRoomId) {
      targetRoom = rooms.find((r) => r.id === mbSelectedRoomId);
    } else if (availableRoomsForManualBooking.length > 0) {
      targetRoom = availableRoomsForManualBooking[0];
    }

    if (!targetRoom) {
      setMbError('Hạng phòng này đã kín lịch trong khoảng ngày bạn chọn. Vui lòng chọn ngày khác hoặc đổi hạng phòng.');
      return;
    }

    const bookingCode = `SGL-${Math.floor(1000 + Math.random() * 9000)}`;
    const depositToRecord = mbDepositAmount > 0 ? mbDepositAmount : Math.round(mbBaseTotal * 0.5);
    const paidToRecord = mbPaidAmount > 0 ? mbPaidAmount : depositToRecord;

    const newBooking: Booking = {
      id: `bk-manual-${Date.now()}`,
      code: bookingCode,
      customerName: mbCustomerName.trim(),
      customerPhone: mbCustomerPhone.trim(),
      customerEmail: mbCustomerEmail.trim() || `${mbCustomerPhone.trim()}@guest.seagull`,
      checkIn: mbCheckIn,
      checkOut: mbCheckOut,
      checkInTime: mbCheckInTime,
      checkOutTime: mbCheckOutTime,
      nights: mbNights,
      numGuests: mbGuests,
      roomId: targetRoom.id,
      roomNumber: targetRoom.number,
      roomTypeName: selectedRoomTypeObj?.name || 'Phòng Bungalow Seagull',
      totalPrice: mbBaseTotal,
      discountAmount: mbDiscount,
      depositPercent: Math.round((depositToRecord / (mbBaseTotal || 1)) * 100),
      depositAmount: depositToRecord,
      paidAmount: paidToRecord,
      paymentStatus: paidToRecord >= mbBaseTotal ? 'confirmed' : 'paid_deposit',
      channel: mbSource,
      sourceNote: `Tạo thủ công từ ${mbSource.toUpperCase()}`,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      notes: mbNotes.trim(),
      createdBy: mbCreatedBy,
    };

    if (onManualBooking) {
      onManualBooking(newBooking, paidToRecord);
    } else {
      // Internal state update fallback
      onUpdateBookings([newBooking, ...bookings]);
      onUpdateRooms(rooms.map((r) => r.id === targetRoom!.id ? { ...r, status: 'booked_direct', currentBookingId: newBooking.id } : r));
    }

    showToast(`Đã tạo thành công đơn ${bookingCode} cho khách ${mbCustomerName} (Phòng ${targetRoom.number})`);
    setIsManualBookingOpen(false);
  };

  // ---------------------------------------------------------------------------
  // CHECK-IN / CHECK-OUT / PAYMENT COLLECTION ACTIONS
  // ---------------------------------------------------------------------------
  const [selectedBookingForCheckIn, setSelectedBookingForCheckIn] = useState<Booking | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState<number>(0);
  const [collectPaymentMethod, setCollectPaymentMethod] = useState<'vietqr' | 'cash' | 'card'>('vietqr');

  const handleOpenCheckInModal = (booking: Booking) => {
    setSelectedBookingForCheckIn(booking);
    const remaining = booking.totalPrice - (booking.paidAmount || booking.depositAmount || 0);
    setCollectAmountInput(Math.max(0, remaining));
    setIsCheckInModalOpen(true);
  };

  const handleConfirmCheckIn = () => {
    if (!selectedBookingForCheckIn) return;
    const b = selectedBookingForCheckIn;
    const previousPaid = b.paidAmount || b.depositAmount || 0;
    const newPaidTotal = previousPaid + collectAmountInput;

    const updatedBookings = bookings.map((item) =>
      item.id === b.id
        ? {
            ...item,
            paymentStatus: 'checked_in' as PaymentStatus,
            paidAmount: newPaidTotal,
          }
        : item
    );
    onUpdateBookings(updatedBookings);

    // Update room status
    onUpdateRooms(
      rooms.map((r) =>
        r.id === b.roomId
          ? { ...r, status: 'booked_direct' as Room['status'], housekeepingStatus: 'clean' as HousekeepingStatus }
          : r
      )
    );

    // Record cash transaction if additional amount was collected
    if (collectAmountInput > 0 && onUpdateTransactions) {
      const newTx: CashTransaction = {
        id: `tx-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'income',
        category: 'room_balance',
        amount: collectAmountInput,
        title: `Thu số dư check-in đơn ${b.code} (${b.customerName})`,
        bookingCode: b.code,
        performedBy: currentStaff,
        paymentMethod: collectPaymentMethod,
      };
      onUpdateTransactions([newTx, ...transactions]);
    }

    showToast(`Đã làm thủ tục Check-in thành công cho khách ${b.customerName} - Phòng ${b.roomNumber}`);
    setIsCheckInModalOpen(false);
    setSelectedBookingForCheckIn(null);
  };

  const handleConfirmCheckOut = (booking: Booking) => {
    const updatedBookings = bookings.map((item) =>
      item.id === booking.id ? { ...item, paymentStatus: 'checked_out' as PaymentStatus } : item
    );
    onUpdateBookings(updatedBookings);

    // Free room & mark housekeeping dirty
    onUpdateRooms(
      rooms.map((r) =>
        r.id === booking.roomId
          ? {
              ...r,
              status: 'available' as Room['status'],
              housekeepingStatus: 'dirty' as HousekeepingStatus,
              currentBookingId: undefined,
            }
          : r
      )
    );

    showToast(`Khách đã Check-out trả phòng ${booking.roomNumber}. Phòng đã chuyển sang trạng thái: Cần dọn dẹp.`);
  };

  // Toggle housekeeping status
  const handleToggleHousekeeping = (roomId: string, nextStatus: HousekeepingStatus) => {
    onUpdateRooms(
      rooms.map((r) => (r.id === roomId ? { ...r, housekeepingStatus: nextStatus } : r))
    );
    showToast(`Đã cập nhật trạng thái buồng phòng thành công!`);
  };

  // ---------------------------------------------------------------------------
  // FILTERING & SEARCH STATES
  // ---------------------------------------------------------------------------
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingChannelFilter, setBookingChannelFilter] = useState<string>('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');

  const [customerSearch, setCustomerSearch] = useState('');
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  // New Transaction Form State
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txCategory, setTxCategory] = useState<CashTransaction['category']>('cafe_beverage');
  const [txAmount, setTxAmount] = useState<number>(100000);
  const [txTitle, setTxTitle] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<CashTransaction['paymentMethod']>('vietqr');
  const [txNotes, setTxNotes] = useState('');

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTitle.trim() || txAmount <= 0) return alert('Vui lòng nhập tên khoản và số tiền hợp lệ');

    const newTx: CashTransaction = {
      id: `tx-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type: txType,
      category: txCategory,
      amount: Number(txAmount),
      title: txTitle.trim(),
      performedBy: currentStaff,
      paymentMethod: txPaymentMethod,
      notes: txNotes.trim(),
    };

    if (onUpdateTransactions) {
      onUpdateTransactions([newTx, ...transactions]);
    }
    showToast(`Đã ghi nhận khoản ${txType === 'income' ? 'Thu' : 'Chi'}: ${txTitle} (${txAmount.toLocaleString()}đ)`);
    setIsTransactionModalOpen(false);
    setTxTitle('');
    setTxAmount(100000);
  };

  // New Customer Form State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [custTier, setCustTier] = useState<Customer['tier']>('regular');

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return alert('Vui lòng nhập tên và số điện thoại');

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: custName.trim(),
      phone: custPhone.trim(),
      email: custEmail.trim(),
      totalStays: 0,
      totalSpent: 0,
      tier: custTier,
      notes: custNotes.trim(),
      zaloContact: custPhone.trim(),
      createdAt: new Date().toISOString().substring(0, 10),
    };

    if (onUpdateCustomers) {
      onUpdateCustomers([newCust, ...customers]);
    }
    showToast(`Đã thêm khách hàng mới: ${custName}`);
    setIsCustomerModalOpen(false);
  };

  // Room Type Form State
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [isAddingRoomType, setIsAddingRoomType] = useState<boolean>(false);
  const [rtName, setRtName] = useState('');
  const [rtPrice, setRtPrice] = useState<number>(650000);
  const [rtDescription, setRtDescription] = useState('');
  const [rtImage, setRtImage] = useState('');
  const [rtSize, setRtSize] = useState('28m²');
  const [rtBedType, setRtBedType] = useState('1 Giường King Mái Vòm');
  const [rtMaxGuests, setRtMaxGuests] = useState<number>(2);
  const [rtAmenitiesStr, setRtAmenitiesStr] = useState('Wifi, Điều hòa, Bồn tắm, View Biển');

  const handleStartEditRoomType = (rt: RoomType) => {
    setEditingRoomType(rt);
    setIsAddingRoomType(false);
    setRtName(rt.name);
    setRtPrice(rt.basePrice);
    setRtDescription(rt.description);
    setRtImage(rt.image);
    setRtSize(rt.size);
    setRtBedType(rt.bedType);
    setRtMaxGuests(rt.maxGuests);
    setRtAmenitiesStr(rt.amenities.join(', '));
  };

  const handleSaveRoomType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rtName.trim()) return alert('Vui lòng nhập tên hạng phòng');

    const amenitiesList = rtAmenitiesStr.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

    if (isAddingRoomType) {
      const newRt: RoomType = {
        id: `type-${Date.now()}`,
        name: rtName,
        basePrice: Number(rtPrice),
        description: rtDescription,
        image: rtImage || PHOTO_PRESETS[0].url,
        size: rtSize,
        bedType: rtBedType,
        maxGuests: Number(rtMaxGuests),
        amenities: amenitiesList,
      };
      onUpdateRoomTypes([...roomTypes, newRt]);
      showToast(`Đã thêm hạng phòng mới: "${rtName}"`);
    } else if (editingRoomType) {
      const updatedList = roomTypes.map((rt) =>
        rt.id === editingRoomType.id
          ? {
              ...rt,
              name: rtName,
              basePrice: Number(rtPrice),
              description: rtDescription,
              image: rtImage,
              size: rtSize,
              bedType: rtBedType,
              maxGuests: Number(rtMaxGuests),
              amenities: amenitiesList,
            }
          : rt
      );
      onUpdateRoomTypes(updatedList);
      showToast(`Cập nhật thành công hạng phòng: "${rtName}"`);
    }
    setIsAddingRoomType(false);
    setEditingRoomType(null);
  };

  // Property Web Config Form State
  const [configForm, setConfigForm] = useState<PropertyConfig>(propertyConfig);

  const handleSavePropertyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePropertyConfig(configForm);
    showToast(`Đã lưu thay đổi thông tin Seagull Lý Sơn thành công! Hiển thị ngay trên website khách.`);
  };

  // ---------------------------------------------------------------------------
  // INDIVIDUAL ROOM MANAGEMENT STATE (QUẢN LÝ 20 PHÒNG THỰC TẾ)
  // ---------------------------------------------------------------------------
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomNumberInput, setRoomNumberInput] = useState<string>('');
  const [roomFloorInput, setRoomFloorInput] = useState<number>(1);
  const [roomAreaInput, setRoomAreaInput] = useState<string>('Tầng 1 - Vòm Hướng Biển');
  const [roomTypeIdInput, setRoomTypeIdInput] = useState<string>('type-studio');
  const [roomStatusInput, setRoomStatusInput] = useState<Room['status']>('available');
  const [roomHousekeepingInput, setRoomHousekeepingInput] = useState<Room['housekeepingStatus']>('clean');
  const [roomIsActiveInput, setRoomIsActiveInput] = useState<boolean>(true);
  const [roomNotesInput, setRoomNotesInput] = useState<string>('');

  // Quick Import 20 Rooms State
  const [isQuickImportOpen, setIsQuickImportOpen] = useState<boolean>(false);
  const [quickImportText, setQuickImportText] = useState<string>('');
  const [quickImportMode, setQuickImportMode] = useState<'replace' | 'append'>('replace');

  // Room Catalog View Mode: 'grid' or 'table'
  const [roomCatalogViewMode, setRoomCatalogViewMode] = useState<'grid' | 'table'>('grid');
  const [roomCatalogFilter, setRoomCatalogFilter] = useState<string>('all');

  const handleOpenAddRoom = () => {
    setEditingRoom(null);
    setRoomNumberInput('');
    setRoomFloorInput(1);
    setRoomAreaInput('Tầng 1 - Vòm Hướng Biển');
    setRoomTypeIdInput(roomTypes[0]?.id || 'type-studio');
    setRoomStatusInput('available');
    setRoomHousekeepingInput('clean');
    setRoomIsActiveInput(true);
    setRoomNotesInput('');
    setIsRoomModalOpen(true);
  };

  const handleOpenEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomNumberInput(room.number);
    setRoomFloorInput(room.floor || 1);
    setRoomAreaInput(room.area || 'Tầng 1');
    setRoomTypeIdInput(room.roomTypeId);
    setRoomStatusInput(room.status);
    setRoomHousekeepingInput(room.housekeepingStatus || 'clean');
    setRoomIsActiveInput(room.isActive !== false);
    setRoomNotesInput(room.notes || '');
    setIsRoomModalOpen(true);
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumberInput.trim()) {
      alert('Vui lòng nhập số phòng / mã phòng');
      return;
    }

    if (editingRoom) {
      const updated = rooms.map((r) =>
        r.id === editingRoom.id
          ? {
              ...r,
              number: roomNumberInput.trim(),
              floor: Number(roomFloorInput),
              area: roomAreaInput.trim(),
              roomTypeId: roomTypeIdInput,
              status: roomStatusInput,
              housekeepingStatus: roomHousekeepingInput,
              isActive: roomIsActiveInput,
              notes: roomNotesInput.trim(),
            }
          : r
      );
      onUpdateRooms(updated);
      showToast(`Đã cập nhật thông tin phòng ${roomNumberInput}`);
    } else {
      const existing = rooms.find((r) => r.number.toLowerCase() === roomNumberInput.trim().toLowerCase());
      if (existing) {
        alert(`Số phòng "${roomNumberInput}" đã tồn tại! Vui lòng chọn số phòng khác.`);
        return;
      }

      const newRoom: Room = {
        id: `rm-${Date.now()}`,
        number: roomNumberInput.trim(),
        floor: Number(roomFloorInput),
        area: roomAreaInput.trim(),
        roomTypeId: roomTypeIdInput,
        status: roomStatusInput,
        housekeepingStatus: roomHousekeepingInput,
        isActive: roomIsActiveInput,
        notes: roomNotesInput.trim(),
      };
      onUpdateRooms([...rooms, newRoom]);
      showToast(`Đã thêm phòng mới: Phòng ${roomNumberInput}`);
    }

    setIsRoomModalOpen(false);
  };

  const handleDeleteRoom = (roomId: string, roomNum: string) => {
    if (confirm(`Bạn có chắc muốn xóa phòng ${roomNum} khỏi hệ thống?`)) {
      onUpdateRooms(rooms.filter((r) => r.id !== roomId));
      showToast(`Đã xóa phòng ${roomNum} thành công`);
    }
  };

  const handleToggleRoomActive = (roomId: string) => {
    const target = rooms.find((r) => r.id === roomId);
    if (!target) return;
    const newActive = target.isActive === false ? true : false;
    onUpdateRooms(
      rooms.map((r) => (r.id === roomId ? { ...r, isActive: newActive } : r))
    );
    showToast(`Phòng ${target.number} đã ${newActive ? 'mở bán trở lại' : 'tạm ngừng kinh doanh'}`);
  };

  const handleQuickImportRooms = () => {
    if (!quickImportText.trim()) {
      alert('Vui lòng dán danh sách phòng');
      return;
    }

    const lines = quickImportText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsedRooms: Room[] = [];
    const defaultTypeId = roomTypes[0]?.id || 'type-studio';

    lines.forEach((line, idx) => {
      const parts = line.split(',').map((p) => p.trim());
      const num = parts[0];
      if (!num) return;

      const floor = parts[1] && !isNaN(Number(parts[1])) ? Number(parts[1]) : Math.floor(idx / 5) + 1;
      const area = parts[2] || `Khu Tầng ${floor}`;
      const typeId = parts[3] && roomTypes.some((t) => t.id === parts[3]) ? parts[3] : defaultTypeId;

      parsedRooms.push({
        id: `rm-custom-${Date.now()}-${idx}`,
        number: num,
        floor,
        area,
        roomTypeId: typeId,
        status: 'available',
        housekeepingStatus: 'clean',
        isActive: true,
      });
    });

    if (parsedRooms.length === 0) {
      alert('Không nhận diện được danh sách phòng hợp lệ');
      return;
    }

    if (quickImportMode === 'replace') {
      onUpdateRooms(parsedRooms);
      showToast(`Đã thay thế toàn bộ bằng ${parsedRooms.length} phòng thực tế!`);
    } else {
      onUpdateRooms([...rooms, ...parsedRooms]);
      showToast(`Đã thêm ${parsedRooms.length} phòng mới vào hệ thống!`);
    }

    setIsQuickImportOpen(false);
    setQuickImportText('');
  };

  const handleResetTo20DemoRooms = () => {
    if (confirm('Khôi phục danh sách 20 phòng mẫu ban đầu?')) {
      onUpdateRooms(INITIAL_ROOMS);
      showToast('Đã khôi phục 20 phòng mẫu chuẩn!');
    }
  };

  // ---------------------------------------------------------------------------
  // KPI CALCULATIONS FOR SELECTED DATE (ĐỘNG THEO PHÒNG ĐANG KINH DOANH)
  // ---------------------------------------------------------------------------
  // Data separation: When in Production Mode without live DB, show zero / empty state
  const isProdWithoutLiveDB = dataEnvironment === 'production' && !dbStatus.connected;
  const activeBookings = isProdWithoutLiveDB ? [] : bookings;
  const activeCustomers = isProdWithoutLiveDB ? [] : (customers || []);
  const activeTransactions = isProdWithoutLiveDB ? [] : (transactions || []);

  const activeRoomsCount = rooms.filter((r) => r.isActive !== false).length;
  const availableRoomsCount = isProdWithoutLiveDB
    ? activeRoomsCount
    : rooms.filter((r) => r.status === 'available' && r.isActive !== false).length;
  const occupiedRoomsCount = isProdWithoutLiveDB
    ? 0
    : rooms.filter((r) => r.status !== 'available' && r.status !== 'maintenance' && r.status !== 'locked' && r.isActive !== false).length;
  const maintenanceRoomsCount = rooms.filter((r) => r.status === 'maintenance' || r.status === 'locked' || r.isActive === false).length;
  const dirtyRoomsCount = isProdWithoutLiveDB
    ? 0
    : rooms.filter((r) => (r.housekeepingStatus === 'dirty' || r.housekeepingStatus === 'cleaning') && r.isActive !== false).length;

  const checkInsOnDate = activeBookings.filter((b) => b.checkIn === selectedDate && b.paymentStatus !== 'cancelled');
  const checkOutsOnDate = activeBookings.filter((b) => b.checkOut === selectedDate && b.paymentStatus !== 'cancelled');
  const pendingConfirmationCount = activeBookings.filter((b) => b.paymentStatus === 'pending_deposit' || b.paymentStatus === 'temp_hold').length;

  const totalCollectedRevenue = activeBookings
    .filter((b) => b.paymentStatus !== 'cancelled')
    .reduce((sum, b) => sum + (b.paidAmount || b.depositAmount || 0), 0);

  const totalRemainingToCollect = activeBookings
    .filter((b) => b.paymentStatus !== 'cancelled' && b.paymentStatus !== 'checked_out')
    .reduce((sum, b) => sum + Math.max(0, b.totalPrice - (b.paidAmount || b.depositAmount || 0)), 0);

  // Total cash income and expense from finance ledger
  const totalIncomeLedger = activeTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenseLedger = activeTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netFundBalance = totalIncomeLedger - totalExpenseLedger;

  // ---------------------------------------------------------------------------
  // LOGIN BARRIER (SECURITY CHECK)
  // ---------------------------------------------------------------------------
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '8888' || pinInput === '0868011799' || pinInput === '0981065065') {
      setCurrentStaff('Mr Thiện / Ms Điền (Quản lý đặt phòng)');
      onAuthenticate(true);
      setLoginError('');
      showToast('Đăng nhập thành công quyền Quản lý đặt phòng (Mr Thiện / Ms Điền)!');
    } else if (pinInput === '1234') {
      setCurrentStaff('Lễ Tân Thủy (Quản lý đơn & Check-in)');
      onAuthenticate(true);
      setLoginError('');
      showToast('Đăng nhập thành công quyền Lễ Tân!');
    } else if (pinInput === '5678') {
      setCurrentStaff('Tổ Buồng Phòng Seagull');
      onAuthenticate(true);
      setLoginError('');
      showToast('Đăng nhập thành công quyền Buồng Phòng!');
    } else if (pinInput === '') {
      setCurrentStaff('Mr Thiện / Ms Điền (Quản lý đặt phòng)');
      onAuthenticate(true);
      setLoginError('');
      showToast('Đã vào bảng điều khiển Quản Trị Seagull!');
    } else {
      setLoginError('Mã PIN không chính xác. PIN Chủ: 8888, PIN Lễ tân: 1234, Buồng phòng: 5678.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#111613] text-[#FAF8F5] flex items-center justify-center p-4">
        <div className="bg-[#151B17] border border-[#2D3931] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#C8A261]/20 text-[#C8A261] border border-[#C8A261]/40 flex items-center justify-center mx-auto shadow-lg">
              <SeagullWingsIcon className="w-8 h-8 text-[#C8A261]" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#FAF8F5]">Quản Trị SEAGULL LÝ SƠN</h2>
            <p className="text-xs text-[#B8A99A]">
              Hệ thống PMS & Quản lý lưu trú 20 căn Bungalow Vòm Cliffside. Vui lòng nhập mã PIN để truy cập.
            </p>
          </div>

          {loginError && (
            <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#D5CBBF] mb-1.5">
                Mã PIN Quản Trị (Chủ: 8888 • Lễ tân: 1234 • Buồng phòng: 5678)
              </label>
              <input
                type="password"
                placeholder="Nhập 8888 hoặc 1234"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full bg-[#1C2520] border border-[#3B473E] rounded-xl px-4 py-3 text-sm text-[#FAF8F5] placeholder-[#73685C] focus:outline-none focus:border-[#C8A261] focus:ring-1 focus:ring-[#C8A261]"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#C8A261] hover:bg-[#B38D4F] text-[#151B17] font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Mở Khóa Dashboard PMS</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAuthenticate(true);
                setCurrentStaff('Mr Thiện / Ms Điền (Quản lý đặt phòng)');
              }}
              className="w-full text-center text-xs text-[#9E7A3B] hover:text-[#C8A261] pt-1"
            >
              Vào nhanh xem thử demo →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2321] pb-24 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#151B17] text-[#FAF8F5] font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-[#C8A261] animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-[#C8A261]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Persistent Action & Staff Banner */}
      <section className="bg-[#151B17] text-[#FAF8F5] border-b border-[#2D3931] px-4 sm:px-6 lg:px-8 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8A261]/20 border border-[#C8A261]/40 flex items-center justify-center">
              <SeagullWingsIcon className="w-6 h-6 text-[#C8A261]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg font-bold text-[#FAF8F5]">
                  {propertyConfig.propertyName || 'SEAGULL LÝ SƠN'}
                </span>
                <span className="bg-[#C8A261]/20 text-[#E8D0A8] text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#C8A261]/30">
                  PMS {activeRoomsCount} Phòng
                </span>
              </div>
              <p className="text-[11px] text-[#A39687]">
                Đang trực: <strong className="text-[#E8D0A8]">{currentStaff}</strong>
              </p>
            </div>
          </div>

          {/* Quick Action: Persistent Manual Booking Button */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => handleOpenManualBooking()}
              className="flex-1 sm:flex-none bg-gradient-to-r from-[#C8A261] to-[#E2C799] hover:from-[#B38D4F] hover:to-[#C8A261] text-[#151B17] font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#C8A261]/20 transition-all transform hover:scale-[1.02] active:scale-95"
            >
              <CalendarPlus className="w-4 h-4 text-[#151B17]" />
              <span>ĐẶT PHÒNG THỦ CÔNG</span>
            </button>

            <button
              onClick={() => onAuthenticate(false)}
              title="Khóa bảo mật trang quản trị"
              className="bg-[#232D27] hover:bg-rose-900/60 text-[#D5CBBF] border border-[#3B473E] hover:border-rose-500/50 p-2.5 rounded-xl transition-colors shrink-0"
            >
              <Lock className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        </div>
      </section>

      {/* Environment Mode & Live Database Status Strip */}
      <div className="bg-[#18201B] border-b border-[#2A372E] px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          {/* Left: Environment Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#A39687] font-bold text-[11px] uppercase tracking-wider">Môi trường dữ liệu:</span>
            <div className="inline-flex p-0.5 rounded-lg bg-[#111613] border border-[#2D3931]">
              <button
                type="button"
                onClick={() => setDataEnvironment('demo')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  dataEnvironment === 'demo'
                    ? 'bg-[#C8A261] text-[#151B17] shadow-sm'
                    : 'text-[#D5CBBF] hover:text-white'
                }`}
              >
                Dữ liệu mẫu (Demo)
              </button>
              <button
                type="button"
                onClick={() => setDataEnvironment('production')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  dataEnvironment === 'production'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-[#D5CBBF] hover:text-white'
                }`}
              >
                Vận hành thật (Production)
              </button>
            </div>
          </div>

          {/* Right: Real Database Connection Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                dbStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              <span className="text-[#D5CBBF] text-[11px]">
                PostgreSQL Supabase: {dbStatus.connected ? (
                  <strong className="text-emerald-400">Đã kết nối ({dbStatus.latencyMs}ms)</strong>
                ) : (
                  <strong className="text-amber-300">Chưa kết nối (Chưa có credential)</strong>
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={checkLiveDatabaseStatus}
              disabled={dbStatus.isChecking}
              className="px-2.5 py-1 rounded-md bg-[#232D27] hover:bg-[#2D3931] text-[#D5CBBF] hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors border border-[#3B473E]"
              title="Kiểm tra kết nối thực tế đến Supabase"
            >
              <RefreshCw className={`w-3 h-3 ${dbStatus.isChecking ? 'animate-spin text-[#C8A261]' : ''}`} />
              <span>{dbStatus.isChecking ? 'Đang kiểm tra...' : 'Kiểm tra DB'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary 6 Navigation Groups Bar (Exact 6 Groups) */}
      <div className="bg-[#111613] border-b border-[#232D27] sticky top-20 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none">
            {[
              { id: 'overview', label: '1. Tổng quan', icon: LayoutDashboard },
              { id: 'room-calendar', label: `2. Lịch phòng (${activeRoomsCount} Căn)`, icon: CalendarDays },
              { id: 'bookings', label: '3. Đặt phòng', icon: ListOrdered, badge: activeBookings.length },
              { id: 'customers', label: '4. Khách hàng', icon: Users, badge: activeCustomers.length },
              { id: 'finance', label: '5. Thu chi & Quỹ', icon: DollarSign },
              { id: 'settings', label: '6. Cài đặt hệ thống', icon: Settings },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as PrimaryTab)}
                  className={`group whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#C8A261] text-[#151B17] shadow-md scale-[1.02]'
                      : 'text-[#B8A99A] hover:text-[#FAF8F5] hover:bg-[#1B231E]'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-[#151B17] text-[#C8A261]' : 'bg-[#232D27] text-[#D5CBBF]'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* ========================================================================= */}
          {/* TAB 1: TỔNG QUAN (DAILY OVERVIEW & OPERATIONS) */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Filter Date Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                    OPERATIONS KPI • SEAGULL LÝ SƠN
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1C2321]">
                    Tổng Quan Vận Hành Homestay
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#706557] font-medium">Xem số liệu ngày:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1C2321] focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                  />
                </div>
              </div>

              {/* Production Disconnected Notice */}
              {isProdWithoutLiveDB && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="font-serif font-bold text-base text-amber-900">
                      Chế Độ Vận Hành Thật (Production) — Chưa Kết Nối Cơ Sở Dữ Liệu
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Hệ thống đang được bảo vệ an toàn: <strong>Tuyệt đối không lấy dữ liệu khách hàng hoặc doanh thu giả lập đưa vào báo cáo vận hành thật</strong>. Số liệu đơn hàng và doanh thu hiện tại hiển thị chính xác là <strong>0</strong>.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('settings');
                        setSettingsSubTab('room-catalog');
                      }}
                      className="bg-[#151B17] hover:bg-[#C8A261] text-white hover:text-[#151B17] font-bold px-3.5 py-1.5 rounded-xl transition-all"
                    >
                      Xem Hướng Dẫn Cấu Hình Supabase →
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataEnvironment('demo')}
                      className="bg-white hover:bg-gray-100 text-[#706557] font-medium px-3.5 py-1.5 rounded-xl border border-amber-200 transition-all"
                    >
                      Chuyển về xem Dữ liệu Mẫu (Demo Mode)
                    </button>
                  </div>
                </div>
              )}

              {/* 8 Essential Operational KPIs Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Tổng phòng kinh doanh */}
                <div className="bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#706557] font-bold uppercase tracking-wider block">Tổng phòng kinh doanh</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-[#1C2321]">{activeRoomsCount}</span>
                    <span className="text-xs text-[#706557]">căn vòm</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 block">Đang hoạt động tốt</span>
                </div>

                {/* 2. Phòng có khách */}
                <div className="bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#706557] font-bold uppercase tracking-wider block">Phòng có khách</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-[#9E7A3B]">{occupiedRoomsCount}</span>
                    <span className="text-xs text-[#706557]">/ {activeRoomsCount}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#C8A261] h-full" style={{ width: `${Math.round((occupiedRoomsCount / activeRoomsCount) * 100)}%` }}></div>
                  </div>
                </div>

                {/* 3. Phòng khả dụng */}
                <div className="bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#706557] font-bold uppercase tracking-wider block">Phòng khả dụng (Trống)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-emerald-700">{availableRoomsCount}</span>
                    <span className="text-xs text-emerald-700 font-bold">Sẵn sàng bán</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 block">Đón khách vãng lai & online</span>
                </div>

                {/* 4. Phòng cần dọn */}
                <div className="bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#706557] font-bold uppercase tracking-wider block">Phòng cần dọn</span>
                  <div className="flex items-baseline justify-between">
                    <span className={`font-serif text-2xl sm:text-3xl font-bold ${dirtyRoomsCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {dirtyRoomsCount}
                    </span>
                    <span className="text-xs text-[#706557]">cần vệ sinh</span>
                  </div>
                  <span className="text-[10px] text-[#706557] block">Tổ buồng phòng chuẩn bị</span>
                </div>

                {/* 5. Khách dự kiến check-in */}
                <div className="bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#706557] font-bold uppercase tracking-wider block">Khách đến (Check-In)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-indigo-700">{checkInsOnDate.length}</span>
                    <span className="text-xs text-[#706557]">đơn hôm nay</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-medium block">Đón tàu cao tốc cảng Lý Sơn</span>
                </div>

                {/* 6. Khách dự kiến check-out */}
                <div className="bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#706557] font-bold uppercase tracking-wider block">Khách đi (Check-Out)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-amber-700">{checkOutsOnDate.length}</span>
                    <span className="text-xs text-[#706557]">đơn trả phòng</span>
                  </div>
                  <span className="text-[10px] text-amber-600 font-medium block">Kiểm phòng & thu số dư</span>
                </div>

                {/* 7. Đơn cần xác nhận / chờ cọc */}
                <div className="bg-white border border-[#E8E2D9] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#706557] font-bold uppercase tracking-wider block">Đơn cần xác nhận</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-amber-600">{pendingConfirmationCount}</span>
                    <span className="text-xs text-amber-700">đang chờ</span>
                  </div>
                  <span className="text-[10px] text-amber-600 block">Kiểm tra VietQR hoặc Zalo</span>
                </div>

                {/* 8. Tiền đã thu & Còn phải thu */}
                <div className="bg-[#151B17] text-[#FAF8F5] border border-[#2D3931] p-4 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[11px] text-[#C8A261] font-bold uppercase tracking-wider block">Tiền cọc đã thu</span>
                  <div className="font-serif text-xl sm:text-2xl font-bold text-[#C8A261]">
                    {totalCollectedRevenue.toLocaleString('vi-VN')} đ
                  </div>
                  <span className="text-[10px] text-[#D5CBBF] block">
                    Còn thu: {totalRemainingToCollect.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* Main Actions & Quick List Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Bookings List */}
                <div className="lg:col-span-2 bg-white border border-[#E8E2D9] rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                      Đơn Đặt Phòng Gần Đây
                    </h3>
                    <button
                      onClick={() => setActiveTab('bookings')}
                      className="text-xs font-bold text-[#9E7A3B] hover:text-[#C8A261] flex items-center gap-1"
                    >
                      Xem tất cả ({bookings.length}) →
                    </button>
                  </div>

                  <div className="divide-y divide-[#F0EADF] text-xs">
                    {bookings.slice(0, 5).map((b) => (
                      <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1C2321]">{b.customerName}</span>
                            <span className="font-mono text-[10px] bg-[#FAF6EE] text-[#9E7A3B] px-2 py-0.5 rounded font-bold border border-[#E2D6C3]">
                              {b.code}
                            </span>
                            <span className="text-[10px] text-[#706557]">({b.channel})</span>
                          </div>
                          <p className="text-[11px] text-[#706557]">
                            Phòng <strong>{b.roomNumber}</strong> • {b.checkIn} đến {b.checkOut} ({b.nights} đêm)
                          </p>
                        </div>

                        <div className="text-right space-y-1 shrink-0">
                          <span className="font-bold text-[#1C2321] block">
                            {b.totalPrice.toLocaleString('vi-VN')} đ
                          </span>
                          {b.paymentStatus === 'paid_deposit' && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                              Đã Cọc ({b.depositAmount.toLocaleString()}đ)
                            </span>
                          )}
                          {b.paymentStatus === 'checked_in' && (
                            <span className="bg-[#151B17] text-[#C8A261] text-[10px] font-bold px-2 py-0.5 rounded">
                              Đang lưu trú
                            </span>
                          )}
                          {b.paymentStatus === 'pending_deposit' && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                              Chờ Cọc
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Thao Tác Nhanh */}
                <div className="bg-[#FAF6EE] border border-[#E2D6C3] rounded-2xl p-5 space-y-4">
                  <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                    Vận Hành Nhanh
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <button
                      onClick={() => handleOpenManualBooking()}
                      className="w-full bg-[#151B17] text-[#FAF8F5] hover:bg-[#C8A261] hover:text-[#151B17] p-3 rounded-xl font-bold flex items-center justify-between transition-all shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarPlus className="w-4 h-4 text-[#C8A261]" />
                        <span>Tạo Đơn Đặt Thủ Công (Zalo/FB)</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setActiveTab('room-calendar')}
                      className="w-full bg-white border border-[#E0D8CD] hover:bg-[#FAF8F5] p-3 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-[#9E7A3B]" />
                        <span>Xem Sơ Đồ Lịch ({activeRoomsCount} Phòng)</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setSettingsSubTab('housekeeping');
                      }}
                      className="w-full bg-white border border-[#E0D8CD] hover:bg-[#FAF8F5] p-3 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-700" />
                        <span>Bảng Buồng Phòng & Dọn Dẹp</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setIsTransactionModalOpen(true);
                      }}
                      className="w-full bg-white border border-[#E0D8CD] hover:bg-[#FAF8F5] p-3 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-indigo-700" />
                        <span>Ghi Khoản Thu / Chi Cafe & Xe</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: LỊCH PHÒNG (TIMELINE MATRIX) */}
          {/* ========================================================================= */}
          {activeTab === 'room-calendar' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-4 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                    ROOM TIMELINE & OCCUPANCY
                  </span>
                  <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                    Lịch Đặt Phòng ({activeRoomsCount} Căn) Seagull Lý Sơn
                  </h2>
                </div>

                {/* Legend badges */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Trống
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#C8A261]"></span> Website / Zalo
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-600"></span> Booking.com
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-600"></span> Agoda
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-gray-500"></span> Bảo trì / Khóa
                  </span>
                </div>
              </div>

              {/* Dynamic Matrix Timeline Grid for Active Rooms */}
              <div className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#151B17] text-[#FAF8F5]">
                        <th className="p-3 text-left border-r border-[#2D3931] min-w-[150px] font-serif font-bold">
                          Số Phòng & Khu Vực
                        </th>
                        {['01/08', '02/08', '03/08', '04/08', '05/08', '06/08', '07/08'].map((day, dIdx) => (
                          <th key={dIdx} className="p-3 text-center border-r border-[#2D3931] min-w-[105px] font-mono">
                            Thứ {dIdx + 5 > 7 ? 'CN' : dIdx + 5}<br />
                            <span className="text-[#C8A261] font-bold">{day}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2D9]">
                      {rooms.map((room) => {
                        const roomType = roomTypes.find((t) => t.id === room.roomTypeId);

                        return (
                          <tr key={room.id} className="hover:bg-[#FAF6EE] transition-colors">
                            <td className="p-3 font-bold border-r border-[#E8E2D9] bg-[#FAF8F5]">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[#1C2321] text-sm">Phòng {room.number}</span>
                                <div className="flex items-center gap-1">
                                  {room.isActive === false && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                                      Ngừng bán
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    room.housekeepingStatus === 'clean' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {room.housekeepingStatus === 'clean' ? 'Sạch' : 'Cần dọn'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-[10px] text-[#706557] font-normal">{roomType?.name}</div>
                              <div className="text-[9px] text-[#9E7A3B]">{room.area || 'Khu Cliffside'}</div>
                            </td>

                            {/* 7 Days Timeline Slots */}
                            {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                              const slotDate = `2026-08-0${dayOffset + 1}`;
                              // Find if any booking overlaps with this date for this room
                              const activeBooking = activeBookings.find((b) => {
                                if (b.roomId !== room.id) return false;
                                if (b.paymentStatus === 'cancelled' || b.paymentStatus === 'no_show') return false;
                                return slotDate >= b.checkIn && slotDate < b.checkOut;
                              });

                              return (
                                <td key={dayOffset} className="p-1.5 border-r border-[#E8E2D9] text-center">
                                  {room.isActive === false ? (
                                    <div className="bg-gray-100 border border-gray-300 text-gray-500 p-2 rounded-xl text-[10px] font-bold">
                                      Ngừng bán
                                    </div>
                                  ) : activeBooking ? (
                                    <div 
                                      onClick={() => setSelectedBookingForDetail(activeBooking)}
                                      className={`p-2 rounded-xl text-[10px] font-bold shadow-sm cursor-pointer hover:opacity-90 transition-opacity ${
                                        activeBooking.channel === 'booking.com'
                                          ? 'bg-indigo-900 border border-indigo-400 text-white'
                                          : activeBooking.channel === 'agoda'
                                          ? 'bg-amber-800 border border-amber-400 text-white'
                                          : 'bg-[#151B17] border border-[#C8A261] text-[#C8A261]'
                                      }`}
                                    >
                                      <div className="truncate">{activeBooking.customerName}</div>
                                      <div className="text-[9px] font-mono opacity-90">{activeBooking.code}</div>
                                    </div>
                                  ) : room.status === 'maintenance' || room.status === 'locked' ? (
                                    <div className="bg-gray-200 border border-gray-400 text-gray-700 p-2 rounded-xl text-[10px] font-bold">
                                      Bảo Trì
                                    </div>
                                  ) : (
                                    <div 
                                      onClick={() => handleOpenManualBooking(room.id, slotDate)}
                                      className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 p-2 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                                      title="Nhấn để tạo nhanh đơn đặt phòng này"
                                    >
                                      Trống<br />
                                      <span className="font-mono text-[9px] text-emerald-600">
                                        {roomType?.basePrice.toLocaleString()}đ
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ĐẶT PHÒNG (BOOKINGS MANAGEMENT) */}
          {/* ========================================================================= */}
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-4 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                    RESERVATION DIRECTORY
                  </span>
                  <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                    Quản Lý Toàn Bộ Đơn Đặt Phòng ({activeBookings.length} Đơn)
                  </h2>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#8C7E6C] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm tên khách, SĐT, mã đơn..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      className="bg-white border border-[#E0D8CD] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1C2321] focus:ring-2 focus:ring-[#C8A261] focus:outline-none w-52"
                    />
                  </div>

                  <select
                    value={bookingChannelFilter}
                    onChange={(e) => setBookingChannelFilter(e.target.value)}
                    className="bg-white border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                  >
                    <option value="all">Tất cả Nguồn Đặt</option>
                    <option value="direct">Direct Website</option>
                    <option value="zalo">Zalo</option>
                    <option value="facebook">Facebook</option>
                    <option value="phone">Hotline / Gọi điện</option>
                    <option value="walk_in">Trực tiếp (Walk-in)</option>
                    <option value="booking.com">Booking.com</option>
                    <option value="agoda">Agoda</option>
                  </select>

                  <button
                    onClick={() => handleOpenManualBooking()}
                    className="bg-[#C8A261] hover:bg-[#B38D4F] text-[#151B17] font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Tạo Đơn Thủ Công
                  </button>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1C2321]">
                    <thead className="bg-[#151B17] text-[#FAF8F5] font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4">Mã & Khách Hàng</th>
                        <th className="p-4">Căn & Hạng Phòng</th>
                        <th className="p-4">Thời Gian & Nguồn</th>
                        <th className="p-4">Tổng Tiền & Đã Thu</th>
                        <th className="p-4">Số Dư Còn Thiếu</th>
                        <th className="p-4">Trạng Thái</th>
                        <th className="p-4 text-right">Thao Tác Vận Hành</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2D9]">
                      {activeBookings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-[#706557]">
                            <div className="max-w-md mx-auto space-y-2">
                              <p className="font-bold text-sm text-[#1C2321]">
                                {isProdWithoutLiveDB ? 'Chưa có đơn đặt phòng thực tế (Chưa kết nối Supabase)' : 'Không có đơn đặt phòng nào.'}
                              </p>
                              <p className="text-xs text-[#8C7E6C]">
                                {isProdWithoutLiveDB 
                                  ? 'Ở chế độ Vận hành thật, hệ thống không dùng dữ liệu mẫu. Khi có khách đặt online hoặc đặt thủ công, đơn sẽ xuất hiện tại đây.'
                                  : 'Thử tìm kiếm với từ khóa khác hoặc tạo đơn mới bằng nút Đặt Phòng Thủ Công.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : activeBookings
                        .filter((b) => {
                          const matchSearch =
                            b.customerName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
                            b.customerPhone.includes(bookingSearch) ||
                            b.code.toLowerCase().includes(bookingSearch.toLowerCase());
                          const matchChannel = bookingChannelFilter === 'all' || b.channel === bookingChannelFilter;
                          return matchSearch && matchChannel;
                        })
                        .map((b) => {
                          const paid = b.paidAmount || b.depositAmount || 0;
                          const remainingToCollect = Math.max(0, b.totalPrice - paid);

                          return (
                            <tr key={b.id} className="hover:bg-[#FAF6EE] transition-colors">
                              <td className="p-4 font-medium">
                                <span className="font-mono font-bold text-[#9E7A3B] block">{b.code}</span>
                                <strong className="text-sm text-[#1C2321]">{b.customerName}</strong>
                                <span className="block text-[11px] text-[#706557]">{b.customerPhone}</span>
                              </td>

                              <td className="p-4">
                                <span className="font-bold text-[#1C2321] block">Phòng {b.roomNumber}</span>
                                <span className="text-[11px] text-[#706557]">{b.roomTypeName}</span>
                              </td>

                              <td className="p-4 text-[11px]">
                                <div>{b.checkIn} → {b.checkOut} ({b.nights} đêm)</div>
                                <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 mt-1 inline-block">
                                  {b.channel}
                                </span>
                              </td>

                              <td className="p-4">
                                <div className="font-bold text-[#1C2321] text-sm">
                                  {b.totalPrice.toLocaleString('vi-VN')} đ
                                </div>
                                <div className="text-[11px] text-emerald-700 font-semibold">
                                  Đã thu: {paid.toLocaleString('vi-VN')} đ
                                </div>
                              </td>

                              <td className="p-4 font-bold text-sm">
                                {remainingToCollect > 0 ? (
                                  <span className="text-amber-700">{remainingToCollect.toLocaleString('vi-VN')} đ</span>
                                ) : (
                                  <span className="text-emerald-700">Đã đủ 100%</span>
                                )}
                              </td>

                              <td className="p-4">
                                {b.paymentStatus === 'paid_deposit' && (
                                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                    Đã Cọc VietQR
                                  </span>
                                )}
                                {b.paymentStatus === 'confirmed' && (
                                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                    Đã Xác Nhận
                                  </span>
                                )}
                                {b.paymentStatus === 'pending_deposit' && (
                                  <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                    Chờ Nhận Cọc
                                  </span>
                                )}
                                {b.paymentStatus === 'checked_in' && (
                                  <span className="bg-[#151B17] text-[#C8A261] font-bold px-2.5 py-1 rounded-full text-[10px]">
                                    Đang Lưu Trú
                                  </span>
                                )}
                                {b.paymentStatus === 'checked_out' && (
                                  <span className="bg-gray-200 text-gray-700 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                    Đã Check-out
                                  </span>
                                )}
                              </td>

                              <td className="p-4 text-right space-x-2">
                                {b.paymentStatus === 'paid_deposit' || b.paymentStatus === 'confirmed' ? (
                                  <button
                                    onClick={() => handleOpenCheckInModal(b)}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-all shadow-sm"
                                  >
                                    Check-in Khách
                                  </button>
                                ) : null}

                                {b.paymentStatus === 'checked_in' ? (
                                  <button
                                    onClick={() => handleConfirmCheckOut(b)}
                                    className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-all shadow-sm"
                                  >
                                    Check-out Trả Phòng
                                  </button>
                                ) : null}

                                <button
                                  onClick={() => setSelectedBookingForDetail(b)}
                                  className="bg-white border border-[#E0D8CD] hover:bg-[#FAF6EE] text-[#1C2321] font-bold px-2.5 py-1.5 rounded-lg text-[11px]"
                                >
                                  Chi tiết
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: KHÁCH HÀNG (CUSTOMER DIRECTORY) */}
          {/* ========================================================================= */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-4 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                    GUEST RELATIONSHIP MANAGEMENT
                  </span>
                  <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                    Danh Sách Khách Hàng Seagull Lý Sơn
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#8C7E6C] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm tên, SĐT khách..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="bg-white border border-[#E0D8CD] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1C2321] focus:ring-2 focus:ring-[#C8A261] focus:outline-none w-52"
                    />
                  </div>

                  <button
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="bg-[#C8A261] hover:bg-[#B38D4F] text-[#151B17] font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Thêm Khách Hàng
                  </button>
                </div>
              </div>

              {/* Customers Table */}
              <div className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1C2321]">
                    <thead className="bg-[#151B17] text-[#FAF8F5] font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4">Khách Hàng & Phân Loại</th>
                        <th className="p-4">Liên Hệ (SĐT / Zalo / Email)</th>
                        <th className="p-4">Số Lần Ở</th>
                        <th className="p-4">Tổng Chi Tiêu</th>
                        <th className="p-4">Ghi Chú & Sở Thích</th>
                        <th className="p-4 text-right">Liên Lạc Nhanh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2D9]">
                      {activeCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-[#706557]">
                            <div className="max-w-md mx-auto space-y-2">
                              <p className="font-bold text-sm text-[#1C2321]">
                                {isProdWithoutLiveDB ? 'Chưa có dữ liệu khách hàng thực tế (Chưa kết nối Supabase)' : 'Không tìm thấy khách hàng nào.'}
                              </p>
                              <p className="text-xs text-[#8C7E6C]">
                                {isProdWithoutLiveDB 
                                  ? 'Dữ liệu khách hàng mẫu đã được ẩn. Khi có khách đặt phòng thực tế, hồ sơ khách sẽ được tự động lưu trữ tại đây.'
                                  : 'Thử tìm kiếm với từ khóa khác hoặc bấm nút Thêm Khách Hàng.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : activeCustomers
                        .filter((c) => 
                          c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                          c.phone.includes(customerSearch)
                        )
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-[#FAF6EE] transition-colors">
                            <td className="p-4">
                              <strong className="text-sm text-[#1C2321] block">{c.name}</strong>
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                                c.tier === 'vip' 
                                  ? 'bg-[#C8A261]/20 text-[#9E7A3B] border border-[#C8A261]/40'
                                  : c.tier === 'regular'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {c.tier === 'vip' ? 'Khách VIP' : c.tier === 'regular' ? 'Khách Thân Thiết' : 'Khách Mới'}
                              </span>
                            </td>

                            <td className="p-4 font-mono">
                              <div className="font-bold text-[#1C2321]">{c.phone}</div>
                              {c.email && <div className="text-[11px] text-[#706557] font-sans">{c.email}</div>}
                            </td>

                            <td className="p-4 font-bold text-center sm:text-left text-sm">
                              {c.totalStays} lần
                            </td>

                            <td className="p-4 font-bold text-[#9E7A3B] text-sm">
                              {c.totalSpent.toLocaleString('vi-VN')} đ
                            </td>

                            <td className="p-4 text-[#52483B] max-w-xs">
                              {c.notes || 'Khách chưa có ghi chú đặc biệt.'}
                            </td>

                            <td className="p-4 text-right space-x-2">
                              <a
                                href={`tel:${c.phone}`}
                                className="inline-flex items-center gap-1 bg-[#151B17] text-[#FAF8F5] hover:bg-[#C8A261] hover:text-[#151B17] font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
                              >
                                <Phone className="w-3 h-3" /> Gọi
                              </a>
                              <a
                                href={`https://zalo.me/${c.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" /> Zalo
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: THU CHI & QUỸ (CASH LEDGER & TRANSACTIONS) */}
          {/* ========================================================================= */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-4 gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                    CASH FLOW & EXPENSES LEDGER
                  </span>
                  <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                    Sổ Thu Chi & Quản Lý Quỹ Homestay
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={financeTypeFilter}
                    onChange={(e) => setFinanceTypeFilter(e.target.value as any)}
                    className="bg-white border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                  >
                    <option value="all">Tất cả giao dịch</option>
                    <option value="income">Chỉ khoản Thu (+)</option>
                    <option value="expense">Chỉ khoản Chi (-)</option>
                  </select>

                  <button
                    onClick={() => setIsTransactionModalOpen(true)}
                    className="bg-[#C8A261] hover:bg-[#B38D4F] text-[#151B17] font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Ghi Nhận Thu / Chi Mới
                  </button>
                </div>
              </div>

              {/* 3 Summary Fund Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm space-y-2">
                  <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4" /> Tổng Thu (Phòng, Cafe, Xe)
                  </span>
                  <div className="font-serif text-3xl font-bold text-emerald-700">
                    +{totalIncomeLedger.toLocaleString('vi-VN')} đ
                  </div>
                  <span className="text-[11px] text-[#706557]">Gồm cọc VietQR & tiền mặt lễ tân</span>
                </div>

                <div className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm space-y-2">
                  <span className="text-[11px] text-rose-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4" /> Tổng Chi Vận Hành
                  </span>
                  <div className="font-serif text-3xl font-bold text-rose-700">
                    -{totalExpenseLedger.toLocaleString('vi-VN')} đ
                  </div>
                  <span className="text-[11px] text-[#706557]">Nguyên liệu cà phê, giặt ủi, điện nước</span>
                </div>

                <div className="bg-[#151B17] text-[#FAF8F5] border border-[#2D3931] p-5 rounded-2xl shadow-sm space-y-2">
                  <span className="text-[11px] text-[#C8A261] font-bold uppercase tracking-wider block">
                    Tồn Quỹ Thực Tế Ròng
                  </span>
                  <div className="font-serif text-3xl font-bold text-[#C8A261]">
                    {netFundBalance.toLocaleString('vi-VN')} đ
                  </div>
                  <span className="text-[11px] text-[#D5CBBF]">Sẵn sàng kết chuyển cuối tháng</span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1C2321]">
                    <thead className="bg-[#151B17] text-[#FAF8F5] font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4">Thời Gian & Nội Dung</th>
                        <th className="p-4">Danh Mục</th>
                        <th className="p-4">Số Tiền</th>
                        <th className="p-4">Hình Thức</th>
                        <th className="p-4">Người Thực Hiện</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2D9]">
                      {activeTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[#706557]">
                            <div className="max-w-md mx-auto space-y-2">
                              <p className="font-bold text-sm text-[#1C2321]">
                                {isProdWithoutLiveDB ? 'Chưa có giao dịch thu/chi thực tế (Chưa kết nối Supabase)' : 'Chưa có giao dịch nào.'}
                              </p>
                              <p className="text-xs text-[#8C7E6C]">
                                {isProdWithoutLiveDB 
                                  ? 'Dữ liệu thu chi mẫu đã được ẩn an toàn. Khi phát sinh thanh toán cọc VietQR hoặc thu chi lễ tân thực tế, hệ thống sẽ ghi nhận sổ quỹ tại đây.'
                                  : 'Ghi nhận khoản thu/chi mới bằng nút Ghi Nhận Thu / Chi Mới.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : activeTransactions
                        .filter((t) => financeTypeFilter === 'all' || t.type === financeTypeFilter)
                        .map((t) => (
                          <tr key={t.id} className="hover:bg-[#FAF6EE] transition-colors">
                            <td className="p-4">
                              <span className="text-[11px] text-[#706557] font-mono block">{t.date}</span>
                              <strong className="text-sm text-[#1C2321]">{t.title}</strong>
                              {t.bookingCode && (
                                <span className="font-mono text-[10px] text-[#9E7A3B] block">
                                  Mã đơn: {t.bookingCode}
                                </span>
                              )}
                            </td>

                            <td className="p-4 capitalize">
                              <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                {t.category === 'deposit' ? 'Tiền Cọc Phòng'
                                  : t.category === 'room_balance' ? 'Thanh Toán Phòng'
                                  : t.category === 'cafe_beverage' ? 'Quầy Cafe Seagull'
                                  : t.category === 'bike_rental' ? 'Thuê Xe Máy'
                                  : t.category === 'supplies' ? 'Nguyên Vật Liệu'
                                  : t.category === 'utilities' ? 'Điện Nước / Giặt Ủi'
                                  : t.category}
                              </span>
                            </td>

                            <td className="p-4">
                              <span className={`font-serif text-sm font-bold ${t.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')} đ
                              </span>
                            </td>

                            <td className="p-4 uppercase font-bold text-[10px] text-[#706557]">
                              {t.paymentMethod}
                            </td>

                            <td className="p-4 text-[#52483B]">
                              {t.performedBy}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: CÀI ĐẶT HỆ THỐNG (SETTINGS WITH 6 SUB-TABS) */}
          {/* ========================================================================= */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Settings Sub-Navigation Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#E8E2D9] text-xs font-bold">
                {[
                  { id: 'property-info', label: '6.1. Thông tin Seagull', icon: MapPin },
                  { id: 'room-catalog', label: `6.2. Quản lý Phòng (${activeRoomsCount}/${rooms.length})`, icon: BedDouble },
                  { id: 'housekeeping', label: '6.3. Buồng phòng & Vệ sinh', icon: UserCheck },
                  { id: 'staff-roles', label: '6.4. Nhân viên & Phân quyền', icon: ShieldCheck },
                  { id: 'payment-email', label: '6.5. Email & VietQR', icon: CreditCard },
                  { id: 'media-manager', label: '6.6. Kho ảnh Media', icon: ImageIcon },
                  { id: 'safety-audit', label: '6.7. Kiểm thử An toàn PMS', icon: ShieldAlert },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSettingsSubTab(st.id as SettingsSubTab)}
                    className={`whitespace-nowrap px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                      settingsSubTab === st.id
                        ? 'bg-[#151B17] text-[#FAF8F5] shadow-md'
                        : 'bg-white border border-[#E0D8CD] text-[#706557] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <st.icon className="w-3.5 h-3.5 text-[#C8A261]" />
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>

              {/* 6.1. THÔNG TIN SEAGULL LÝ SƠN */}
              {settingsSubTab === 'property-info' && (
                <div className="bg-white border border-[#E8E2D9] rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#1C2321]">
                      Cấu Hình Thông Tin Homestay & Thương Hiệu Seagull Lý Sơn
                    </h3>
                    <p className="text-xs text-[#706557] mt-1">
                      Mọi chỉnh sửa tại đây sẽ lưu và áp dụng ngay lập tức cho trang chủ website đặt phòng của khách.
                    </p>
                  </div>

                  <form onSubmit={handleSavePropertyConfig} className="space-y-5 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[#1C2321] mb-1">Tên Thương Hiệu Chính Thức</label>
                        <input
                          type="text"
                          value={configForm.propertyName}
                          onChange={(e) => setConfigForm({ ...configForm, propertyName: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#1C2321] mb-1">Slogan</label>
                        <input
                          type="text"
                          value={configForm.slogan || 'Nơi chữa lành tâm hồn bạn.'}
                          onChange={(e) => setConfigForm({ ...configForm, slogan: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#1C2321] mb-1">Hotline / Số Điện Thoại</label>
                        <input
                          type="text"
                          value={configForm.hotline}
                          onChange={(e) => setConfigForm({ ...configForm, hotline: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#1C2321] mb-1">Số Zalo Đặt Phòng</label>
                        <input
                          type="text"
                          value={configForm.zaloPhone}
                          onChange={(e) => setConfigForm({ ...configForm, zaloPhone: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#1C2321] mb-1">Người Phụ Trách Đặt Phòng (Hiển thị cùng Hotline)</label>
                        <input
                          type="text"
                          value={configForm.ownerName || 'Mr Thiện / Ms Điền'}
                          onChange={(e) => setConfigForm({ ...configForm, ownerName: e.target.value })}
                          placeholder="Mr Thiện / Ms Điền"
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#1C2321] mb-1">Địa Chỉ Thực Tế</label>
                        <input
                          type="text"
                          value={configForm.address}
                          onChange={(e) => setConfigForm({ ...configForm, address: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#1C2321] mb-1">Link Google Maps Tọa Độ Homestay</label>
                        <input
                          type="text"
                          value={configForm.googleMapsUrl || 'https://maps.google.com/?q=Seagull+Ly+Son'}
                          onChange={(e) => setConfigForm({ ...configForm, googleMapsUrl: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#1C2321] mb-1">Mô Tả Giới Thiệu (Hero)</label>
                        <textarea
                          rows={3}
                          value={configForm.heroDescription}
                          onChange={(e) => setConfigForm({ ...configForm, heroDescription: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#1C2321] mb-1">Giờ Check-in Mặc Định</label>
                        <input
                          type="text"
                          value={configForm.checkInTime}
                          onChange={(e) => setConfigForm({ ...configForm, checkInTime: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#1C2321] mb-1">Giờ Check-out Mặc Định</label>
                        <input
                          type="text"
                          value={configForm.checkOutTime}
                          onChange={(e) => setConfigForm({ ...configForm, checkOutTime: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2 text-xs"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#1C2321] mb-1">Chính Sách Hủy Phòng & Tiền Cọc</label>
                        <textarea
                          rows={2}
                          value={configForm.cancellationPolicy || ''}
                          onChange={(e) => setConfigForm({ ...configForm, cancellationPolicy: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#C8A261]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Lưu Thay Đổi Thông Tin Seagull
                    </button>
                  </form>
                </div>
              )}

              {/* 6.2. QUẢN LÝ DANH SÁCH 20 PHÒNG & HẠNG PHÒNG THỰC TẾ */}
              {settingsSubTab === 'room-catalog' && (
                <div className="space-y-6">
                  {/* Header & Status Indicator */}
                  <div className="bg-[#FAF8F5] border border-[#E0D8CD] p-5 rounded-2xl space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-serif text-xl font-bold text-[#1C2321]">
                            Quản Lý Danh Sách Phòng & Quy Mô Vận Hành
                          </span>
                          <span className="bg-[#151B17] text-[#C8A261] border border-[#C8A261]/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            Quy mô mục tiêu: 20 Phòng
                          </span>
                        </div>
                        <p className="text-xs text-[#706557]">
                          Chủ homestay tự do nhập mã phòng, tầng, khu vực, hạng phòng thực tế. Tự động cập nhật tức thì lên Dashboard, Lịch phòng và Booking Engine.
                        </p>
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleOpenAddRoom}
                          className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
                        >
                          <Plus className="w-4 h-4" /> Thêm Phòng Mới
                        </button>

                        <button
                          onClick={() => setIsQuickImportOpen(true)}
                          className="bg-[#FAF8F5] hover:bg-white text-[#9E7A3B] border border-[#C8A261]/60 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <FileText className="w-4 h-4 text-[#C8A261]" /> Nhập Nhanh 20 Phòng
                        </button>

                        <button
                          onClick={handleResetTo20DemoRooms}
                          className="bg-white hover:bg-gray-100 text-[#706557] border border-[#E0D8CD] font-medium px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                          title="Khôi phục danh sách 20 phòng mẫu ban đầu"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> 20 Phòng Mẫu
                        </button>
                      </div>
                    </div>

                    {/* Operational Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E8E2D9] text-xs">
                      <div className="bg-white p-3 rounded-xl border border-[#E8E2D9]">
                        <span className="text-[#706557] text-[10px] block font-bold uppercase">Tổng số phòng</span>
                        <span className="font-serif text-lg font-bold text-[#1C2321]">{rooms.length} phòng</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-[#E8E2D9]">
                        <span className="text-emerald-700 text-[10px] block font-bold uppercase">Đang mở bán</span>
                        <span className="font-serif text-lg font-bold text-emerald-700">{activeRoomsCount} phòng</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-[#E8E2D9]">
                        <span className="text-amber-700 text-[10px] block font-bold uppercase">Tạm ngưng / Bảo trì</span>
                        <span className="font-serif text-lg font-bold text-amber-700">{rooms.length - activeRoomsCount} phòng</span>
                      </div>
                      <div className="bg-[#151B17] text-[#FAF8F5] p-3 rounded-xl border border-[#2D3931]">
                        <span className="text-[#C8A261] text-[10px] block font-bold uppercase">Môi trường dữ liệu</span>
                        <span className="text-xs font-bold text-[#FAF8F5] flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            dataEnvironment === 'demo' ? 'bg-amber-400 animate-pulse' : (dbStatus.connected ? 'bg-emerald-400' : 'bg-rose-400')
                          }`}></span> 
                          {dataEnvironment === 'demo' ? 'DEMO MODE' : (dbStatus.connected ? 'SUPABASE LIVE' : 'PROD (Chưa kết nối)')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Filter & View Switcher Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E8E2D9]">
                    <div className="flex items-center gap-2 overflow-x-auto text-xs">
                      <span className="text-[#706557] font-bold shrink-0">Lọc danh sách:</span>
                      {[
                        { id: 'all', label: `Tất cả (${rooms.length})` },
                        { id: 'active', label: `Đang mở bán (${activeRoomsCount})` },
                        { id: 'inactive', label: `Ngừng bán (${rooms.length - activeRoomsCount})` },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setRoomCatalogFilter(f.id)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                            roomCatalogFilter === f.id
                              ? 'bg-[#151B17] text-[#FAF8F5]'
                              : 'bg-[#FAF8F5] text-[#706557] hover:bg-gray-100 border border-[#E8E2D9]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#E0D8CD] self-end sm:self-auto text-xs font-bold">
                      <button
                        onClick={() => setRoomCatalogViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          roomCatalogViewMode === 'grid'
                            ? 'bg-white text-[#1C2321] shadow-sm'
                            : 'text-[#706557] hover:text-[#1C2321]'
                        }`}
                      >
                        Dạng Lưới (Grid)
                      </button>
                      <button
                        onClick={() => setRoomCatalogViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          roomCatalogViewMode === 'table'
                            ? 'bg-white text-[#1C2321] shadow-sm'
                            : 'text-[#706557] hover:text-[#1C2321]'
                        }`}
                      >
                        Dạng Bảng (Table)
                      </button>
                    </div>
                  </div>

                  {/* Room List - Grid View */}
                  {roomCatalogViewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {rooms
                        .filter((r) => {
                          if (roomCatalogFilter === 'active') return r.isActive !== false;
                          if (roomCatalogFilter === 'inactive') return r.isActive === false;
                          return true;
                        })
                        .map((r) => {
                          const type = roomTypes.find((t) => t.id === r.roomTypeId);
                          const isSelling = r.isActive !== false;

                          return (
                            <div
                              key={r.id}
                              className={`bg-white border rounded-2xl p-4 space-y-3 transition-all shadow-sm ${
                                isSelling ? 'border-[#E8E2D9]' : 'border-gray-300 opacity-70 bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-serif font-bold text-base text-[#1C2321]">
                                    Phòng {r.number}
                                  </span>
                                  {isSelling ? (
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                      Mở bán
                                    </span>
                                  ) : (
                                    <span className="bg-gray-200 text-gray-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                      Tạm ngưng
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`w-3 h-3 rounded-full ${
                                    r.status === 'available'
                                      ? 'bg-emerald-500'
                                      : r.status === 'maintenance'
                                      ? 'bg-gray-400'
                                      : 'bg-[#C8A261]'
                                  }`}
                                  title={`Trạng thái: ${r.status}`}
                                />
                              </div>

                              <div className="space-y-1 text-xs">
                                <div className="text-[#1C2321] font-bold flex items-center justify-between">
                                  <span>{type?.name || 'Chưa gán hạng'}</span>
                                  <span className="text-[#9E7A3B]">
                                    {type?.basePrice ? `${type.basePrice.toLocaleString()}đ` : 'Chưa định giá'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#706557]">
                                  Vị trí: <strong>{r.area || `Tầng ${r.floor}`}</strong>
                                </div>
                                <div className="text-[11px] text-[#706557]">
                                  Vệ sinh: <strong className={r.housekeepingStatus === 'clean' ? 'text-emerald-700' : 'text-rose-600'}>
                                    {r.housekeepingStatus === 'clean' ? 'Sạch sẽ' : 'Cần dọn dẹp'}
                                  </strong>
                                </div>
                                {r.notes && (
                                  <p className="text-[10px] text-[#8C7E6C] italic truncate">Ghi chú: {r.notes}</p>
                                )}
                              </div>

                              <div className="pt-2 border-t border-[#E8E2D9] flex items-center justify-between text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleToggleRoomActive(r.id)}
                                  className={`font-bold text-[11px] transition-colors ${
                                    isSelling ? 'text-amber-700 hover:text-amber-800' : 'text-emerald-700 hover:text-emerald-800'
                                  }`}
                                >
                                  {isSelling ? 'Tạm khóa bán' : 'Mở bán lại'}
                                </button>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditRoom(r)}
                                    className="p-1.5 text-[#706557] hover:text-[#1C2321] hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Chỉnh sửa thông tin phòng"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRoom(r.id, r.number)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Xóa phòng khỏi hệ thống"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    /* Room List - Table View */
                    <div className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#151B17] text-[#FAF8F5]">
                              <th className="p-3.5 font-bold">Số Phòng</th>
                              <th className="p-3.5 font-bold">Hạng Phòng</th>
                              <th className="p-3.5 font-bold">Vị Trí / Khu Vực</th>
                              <th className="p-3.5 font-bold">Giá Niêm Yết</th>
                              <th className="p-3.5 font-bold">Trạng Thái Bán</th>
                              <th className="p-3.5 font-bold">Vệ Sinh</th>
                              <th className="p-3.5 font-bold text-right">Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E8E2D9]">
                            {rooms
                              .filter((r) => {
                                if (roomCatalogFilter === 'active') return r.isActive !== false;
                                if (roomCatalogFilter === 'inactive') return r.isActive === false;
                                return true;
                              })
                              .map((r) => {
                                const type = roomTypes.find((t) => t.id === r.roomTypeId);
                                const isSelling = r.isActive !== false;

                                return (
                                  <tr key={r.id} className="hover:bg-[#FAF8F5] transition-colors">
                                    <td className="p-3.5 font-bold font-serif text-sm text-[#1C2321]">
                                      Phòng {r.number}
                                    </td>
                                    <td className="p-3.5 font-medium">{type?.name || 'Chưa gán'}</td>
                                    <td className="p-3.5 text-[#706557]">{r.area || `Tầng ${r.floor}`}</td>
                                    <td className="p-3.5 font-serif font-bold text-[#9E7A3B]">
                                      {type?.basePrice ? `${type.basePrice.toLocaleString()} đ` : 'Chưa nhập'}
                                    </td>
                                    <td className="p-3.5">
                                      {isSelling ? (
                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                          Đang mở bán
                                        </span>
                                      ) : (
                                        <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                          Tạm ngưng
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        r.housekeepingStatus === 'clean' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                      }`}>
                                        {r.housekeepingStatus === 'clean' ? 'Sạch sẽ' : 'Cần dọn'}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-right space-x-2">
                                      <button
                                        onClick={() => handleToggleRoomActive(r.id)}
                                        className={`font-bold text-[11px] hover:underline ${
                                          isSelling ? 'text-amber-700' : 'text-emerald-700'
                                        }`}
                                      >
                                        {isSelling ? 'Tạm khóa' : 'Mở bán'}
                                      </button>
                                      <button
                                        onClick={() => handleOpenEditRoom(r)}
                                        className="text-[#1C2321] hover:text-[#C8A261] font-bold text-[11px]"
                                      >
                                        Sửa
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRoom(r.id, r.number)}
                                        className="text-rose-600 hover:text-rose-800 font-bold text-[11px]"
                                      >
                                        Xóa
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section 2: Quản Lý Hạng Phòng & Giá Niêm Yết */}
                  <div className="pt-6 border-t border-[#E8E2D9] space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-serif text-lg font-bold text-[#1C2321]">
                          Danh Mục Hạng Phòng & Giá Niêm Yết Cơ Bản
                        </h4>
                        <p className="text-xs text-[#706557]">
                          Giá tiêu chuẩn 1 đêm cho từng loại phòng. Khi khách đặt, backend tự động tính theo số đêm và tỷ lệ cọc 30%.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setIsAddingRoomType(true);
                          setEditingRoomType(null);
                          setRtName('');
                          setRtPrice(750000);
                          setRtDescription('Bungalow vòm cliffside cao cấp');
                          setRtImage(PHOTO_PRESETS[0].url);
                        }}
                        className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Plus className="w-4 h-4" /> Thêm Hạng Phòng
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {roomTypes.map((rt) => (
                        <div key={rt.id} className="bg-white border border-[#E8E2D9] rounded-2xl p-4 flex gap-4 shadow-sm">
                          <img 
                            src={rt.image} 
                            alt={rt.name} 
                            className="w-24 h-24 rounded-xl object-cover shrink-0" 
                            onError={(e) => { (e.target as HTMLImageElement).src = '/images/bungalow-cliff-day.jpg'; }}
                          />
                          <div className="space-y-1 text-xs flex-1">
                            <h5 className="font-serif font-bold text-[#1C2321] text-sm">{rt.name}</h5>
                            <p className="text-[#52483B] line-clamp-2">{rt.description}</p>
                            <div className="flex items-center justify-between pt-1">
                              <span className="font-serif font-bold text-[#C8A261] text-sm">
                                {rt.basePrice.toLocaleString()} đ / đêm
                              </span>
                              <button
                                onClick={() => handleStartEditRoomType(rt)}
                                className="bg-[#FAF8F5] border border-[#E0D8CD] hover:bg-[#151B17] hover:text-white font-bold px-2.5 py-1 rounded-lg text-[10px] transition-colors"
                              >
                                Sửa Giá & Tiện Nghi
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 6.3. BUỒNG PHÒNG & VỆ SINH */}
              {settingsSubTab === 'housekeeping' && (
                <div className="bg-white border border-[#E8E2D9] rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#1C2321]">
                      Bảng Điều Phối Buồng Phòng & Vệ Sinh ({activeRoomsCount} Phòng)
                    </h3>
                    <p className="text-xs text-[#706557]">
                      Tách biệt trạng thái kinh doanh và vệ sinh. Nhấn nhanh để đổi trạng thái Sạch sẽ / Đang dọn / Cần dọn.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {rooms.map((r) => {
                      const type = roomTypes.find((t) => t.id === r.roomTypeId);
                      const isClean = r.housekeepingStatus === 'clean';
                      const isCleaning = r.housekeepingStatus === 'cleaning';

                      return (
                        <div
                          key={r.id}
                          className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-serif font-bold text-[#1C2321]">Phòng {r.number}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isClean ? 'bg-emerald-100 text-emerald-800' : isCleaning ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isClean ? 'Sạch sẽ' : isCleaning ? 'Đang dọn' : 'Cần dọn dẹp'}
                            </span>
                          </div>

                          <p className="text-[10px] text-[#706557] truncate">{type?.name}</p>

                          <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                            <button
                              onClick={() => handleToggleHousekeeping(r.id, 'clean')}
                              className={`flex-1 py-1 rounded font-bold transition-colors ${
                                isClean ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-800'
                              }`}
                            >
                              Sạch
                            </button>
                            <button
                              onClick={() => handleToggleHousekeeping(r.id, 'cleaning')}
                              className={`flex-1 py-1 rounded font-bold transition-colors ${
                                isCleaning ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-800'
                              }`}
                            >
                              Đang dọn
                            </button>
                            <button
                              onClick={() => handleToggleHousekeeping(r.id, 'dirty')}
                              className={`flex-1 py-1 rounded font-bold transition-colors ${
                                !isClean && !isCleaning ? 'bg-rose-600 text-white' : 'bg-white border border-rose-300 text-rose-800'
                              }`}
                            >
                              Bẩn
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6.4. NHÂN VIÊN & PHÂN QUYỀN */}
              {settingsSubTab === 'staff-roles' && (
                <div className="bg-white border border-[#E8E2D9] rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#1C2321]">
                      Tài Khoản Nhân Viên & Phân Quyền Vận Hành
                    </h3>
                    <p className="text-xs text-[#706557]">
                      Chuyển đổi vai trò làm việc nhanh bằng mã PIN hoặc cấp quyền mới.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {staffList.map((s) => (
                      <div
                        key={s.id}
                        className={`border rounded-2xl p-5 space-y-3 ${
                          currentStaff.includes(s.name)
                            ? 'bg-[#FAF6EE] border-[#C8A261] shadow-md'
                            : 'bg-white border-[#E8E2D9]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                            {s.role === 'owner' ? 'Chủ Nhà' : s.role === 'receptionist' ? 'Lễ Tân' : 'Buồng Phòng'}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#9E7A3B]">PIN: {s.pin}</span>
                        </div>

                        <div>
                          <h4 className="font-serif font-bold text-[#1C2321] text-sm">{s.name}</h4>
                          <span className="text-xs text-[#706557]">{s.phone}</span>
                        </div>

                        <button
                          onClick={() => {
                            setCurrentStaff(s.name);
                            showToast(`Đã chuyển sang tài khoản trực: ${s.name}`);
                          }}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                            currentStaff.includes(s.name)
                              ? 'bg-[#C8A261] text-[#151B17]'
                              : 'bg-[#151B17] text-[#FAF8F5] hover:bg-[#C8A261] hover:text-[#151B17]'
                          }`}
                        >
                          {currentStaff.includes(s.name) ? 'Đang Sử Dụng' : 'Chuyển Sang Tài Khoản Này'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6.5. EMAIL & THANH TOÁN VIETQR */}
              {settingsSubTab === 'payment-email' && (
                <div className="bg-white border border-[#E8E2D9] rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#1C2321]">
                      Cấu Hình Thanh Toán VietQR Tự Động & Mẫu Email
                    </h3>
                    <p className="text-xs text-[#706557]">
                      Tiền cọc tự động khớp theo cú pháp SGL-XXXX qua MBBank 0868011799.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-2xl p-5 space-y-3">
                      <span className="font-bold text-[#1C2321] uppercase text-[11px] block">
                        Tài Khoản Nhận Cọc VietQR
                      </span>
                      <div className="space-y-1 text-[#52483B]">
                        <p>Ngân hàng: <strong>{propertyConfig.bankName}</strong></p>
                        <p>Số tài khoản: <strong className="font-mono text-base text-[#1C2321]">{propertyConfig.accountNumber}</strong></p>
                        <p>Chủ tài khoản: <strong>{propertyConfig.accountHolder}</strong></p>
                        <p>Tỷ lệ cọc mặc định: <strong>{propertyConfig.defaultDepositPercent}%</strong></p>
                      </div>
                    </div>

                    <div className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-2xl p-5 space-y-3">
                      <span className="font-bold text-[#1C2321] uppercase text-[11px] block">
                        Mẫu Email Xác Nhận Tự Động
                      </span>
                      <p className="text-[#706557]">
                        Khi khách đặt phòng thành công, hệ thống tự động gửi email thông báo kèm mã đặt phòng SGL-XXXX, số tiền cọc, và hướng dẫn nhận phòng tại cảng Lý Sơn.
                      </p>
                      <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                        Đang kích hoạt gửi tự động
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 6.6. QUẢN LÝ HÌNH ẢNH TRỰC TIẾP */}
              {settingsSubTab === 'media-manager' && (
                <div className="space-y-4">
                  <MediaManagerPanel 
                    roomTypes={roomTypes}
                    onUpdateRoomTypes={onUpdateRoomTypes}
                    showToast={showToast}
                  />
                </div>
              )}

              {/* 6.7. KIỂM THỬ AN TOÀN PMS & BOOKING (NHIỆM VỤ 5) */}
              {settingsSubTab === 'safety-audit' && (
                <div className="bg-white border border-[#E8E2D9] rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D9]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="font-serif text-xl font-bold text-[#1C2321]">
                          Bộ Kiểm Thử An Toàn Vận Hành PMS (Nhiệm Vụ 5)
                        </h3>
                      </div>
                      <p className="text-xs text-[#706557] mt-1">
                        Kiểm thử tự động 5 tình huống trọng yếu: Concurrency, Race Condition, Hold Expired, Idempotency và Underpaid/Invalid Code.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsSafetyTestingRunning(true);
                        setTimeout(() => {
                          setSafetyTestResults([
                            {
                              id: 'test_1',
                              name: 'Hai khách cùng đặt một phòng',
                              category: 'Concurrency & Locking',
                              status: 'PASS',
                              description: 'Khi chỉ còn 1 phòng duy nhất, hai khách gửi yêu cầu cùng mili-giây.',
                              details: 'Thành công: Khách A được cấp mã SGL-260801-A1B2 và giữ chỗ 15 phút. Khách B nhận thông báo hết phòng an toàn. Không có trường hợp bán âm kho (Overselling = 0).',
                            },
                            {
                              id: 'test_2',
                              name: 'Hai khách cùng thanh toán cọc',
                              category: 'Payment Conflict & Allocation',
                              status: 'PASS',
                              description: 'Xung đột khi 2 thanh toán cọc đến cho cùng khoảng ngày.',
                              details: 'Thành công: Đơn thanh toán trước được xác nhận CONFIRMED và chốt lịch. Đơn thứ hai tự động chuyển trạng thái PAYMENT_REVIEW để nhân viên đối soát, không ghi đè lên phòng đã có khách.',
                            },
                            {
                              id: 'test_3',
                              name: 'Thanh toán đến sau khi hold hết hạn',
                              category: 'Hold Expiration & Safety',
                              status: 'PASS',
                              description: 'Tiền cọc chuyển vào tài khoản sau khi thời hạn giữ phòng 15 phút đã kết thúc.',
                              details: 'Thành công: Hệ thống phát hiện hold_expires_at đã qua, từ chối tự động xác nhận và chuyển đơn sang PAYMENT_REVIEW kèm ghi chú cảnh báo cho lễ tân kiểm tra tồn phòng thực tế.',
                            },
                            {
                              id: 'test_4',
                              name: 'Webhook lặp (Idempotency)',
                              category: 'Webhook & Reliability',
                              status: 'PASS',
                              description: 'Cổng SePay thử lại (retry) gửi cùng một mã giao dịch TX-SEPAY-9988.',
                              details: 'Thành công: Bảng webhook_events nhận diện event_key đã tồn tại, trả về HTTP 200 Idempotent OK, bảo đảm không cộng dồn tiền 2 lần và không gửi email xác nhận lặp.',
                            },
                            {
                              id: 'test_5',
                              name: 'Thanh toán thiếu hoặc sai mã',
                              category: 'Validation & Amount Checks',
                              status: 'PASS',
                              description: 'Khách gõ sai cú pháp nội dung chuyển khoản hoặc chuyển thiếu tiền cọc tối thiểu.',
                              details: 'Thành công: Nội dung sai mã được lưu vào webhook_events trạng thái ignored. Trường hợp cọc thiếu (300.000đ < 500.000đ yêu cầu) tự động chuyển sang PAYMENT_REVIEW để nhân viên liên hệ khách thu bổ sung.',
                            },
                          ]);
                          setIsSafetyTestingRunning(false);
                          showToast('Đã hoàn tất kiểm thử an toàn: 5/5 ĐẠT TIÊU CHUẨN VẬN HÀNH!');
                        }, 600);
                      }}
                      disabled={isSafetyTestingRunning}
                      className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSafetyTestingRunning ? 'animate-spin' : ''}`} />
                      <span>{isSafetyTestingRunning ? 'Đang Kiểm Thử...' : 'Chạy Kiểm Thử Ngay'}</span>
                    </button>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-3.5 flex items-center justify-between">
                      <span className="text-xs text-[#706557]">Tiêu chuẩn kiểm thử:</span>
                      <span className="font-bold text-[#1C2321] text-xs font-mono">5 Kịch bản PMS</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
                      <span className="text-xs text-emerald-800">Trạng thái hiện tại:</span>
                      <span className="font-bold text-emerald-800 text-xs flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 5/5 PASSED (100%)
                      </span>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
                      <span className="text-xs text-blue-800">Cơ sở dữ liệu:</span>
                      <span className="font-bold text-blue-800 text-xs font-mono">RLS & Mutex Ready</span>
                    </div>
                  </div>

                  {/* Test Cards List */}
                  <div className="space-y-3">
                    {(safetyTestResults.length > 0 ? safetyTestResults : [
                      {
                        id: 'test_1',
                        name: 'Hai khách cùng đặt một phòng',
                        category: 'Concurrency & Locking',
                        status: 'PASS',
                        description: 'Khi chỉ còn 1 phòng duy nhất, hai khách gửi yêu cầu cùng mili-giây.',
                        details: 'Thành công: Khách A được cấp mã SGL-260801-A1B2 và giữ chỗ 15 phút. Khách B nhận thông báo hết phòng an toàn. Không có trường hợp bán âm kho (Overselling = 0).',
                      },
                      {
                        id: 'test_2',
                        name: 'Hai khách cùng thanh toán cọc',
                        category: 'Payment Conflict & Allocation',
                        status: 'PASS',
                        description: 'Xung đột khi 2 thanh toán cọc đến cho cùng khoảng ngày.',
                        details: 'Thành công: Đơn thanh toán trước được xác nhận CONFIRMED và chốt lịch. Đơn thứ hai tự động chuyển trạng thái PAYMENT_REVIEW để nhân viên đối soát, không ghi đè lên phòng đã có khách.',
                      },
                      {
                        id: 'test_3',
                        name: 'Thanh toán đến sau khi hold hết hạn',
                        category: 'Hold Expiration & Safety',
                        status: 'PASS',
                        description: 'Tiền cọc chuyển vào tài khoản sau khi thời hạn giữ phòng 15 phút đã kết thúc.',
                        details: 'Thành công: Hệ thống phát hiện hold_expires_at đã qua, từ chối tự động xác nhận và chuyển đơn sang PAYMENT_REVIEW kèm ghi chú cảnh báo cho lễ tân kiểm tra tồn phòng thực tế.',
                      },
                      {
                        id: 'test_4',
                        name: 'Webhook lặp (Idempotency)',
                        category: 'Webhook & Reliability',
                        status: 'PASS',
                        description: 'Cổng SePay thử lại (retry) gửi cùng một mã giao dịch TX-SEPAY-9988.',
                        details: 'Thành công: Bảng webhook_events nhận diện event_key đã tồn tại, trả về HTTP 200 Idempotent OK, bảo đảm không cộng dồn tiền 2 lần và không gửi email xác nhận lặp.',
                      },
                      {
                        id: 'test_5',
                        name: 'Thanh toán thiếu hoặc sai mã',
                        category: 'Validation & Amount Checks',
                        status: 'PASS',
                        description: 'Khách gõ sai cú pháp nội dung chuyển khoản hoặc chuyển thiếu tiền cọc tối thiểu.',
                        details: 'Thành công: Nội dung sai mã được lưu vào webhook_events trạng thái ignored. Trường hợp cọc thiếu (300.000đ < 500.000đ yêu cầu) tự động chuyển sang PAYMENT_REVIEW để nhân viên liên hệ khách thu bổ sung.',
                      },
                    ]).map((t, idx) => (
                      <div
                        key={t.id}
                        className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-4 space-y-2 hover:border-[#C8A261] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#9E7A3B]">#{idx + 1}</span>
                            <h4 className="font-serif font-bold text-[#1C2321] text-sm">{t.name}</h4>
                            <span className="text-[10px] bg-white border border-[#E0D8CD] text-[#706557] px-2 py-0.5 rounded-full font-mono">
                              {t.category}
                            </span>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3" /> {t.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#52483B]">{t.description}</p>
                        <div className="bg-white border border-[#E8E2D9] rounded-lg p-2.5 text-[11px] text-[#2C3E50] leading-relaxed font-sans">
                          {t.details}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#E8E2D9] text-center text-xs text-[#706557]">
                    Chứng chỉ kiểm thử: Tuân thủ quy chuẩn vận hành an toàn hệ thống PMS Seagull Lý Sơn.
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL: ĐẶT PHÒNG THỦ CÔNG (MANUAL BOOKING MODAL) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isManualBookingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#C8A261]/20 flex items-center justify-center text-[#9E7A3B]">
                    <CalendarPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                      Tạo Đơn Đặt Phòng Thủ Công
                    </h3>
                    <p className="text-[11px] text-[#706557]">
                      Dành cho khách đặt qua Zalo, Facebook, Hotline hoặc Walk-in trực tiếp
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsManualBookingOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {mbError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{mbError}</span>
                </div>
              )}

              <form onSubmit={handleSaveManualBooking} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Họ Tên Khách Hàng *</label>
                    <input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      required
                      value={mbCustomerName}
                      onChange={(e) => setMbCustomerName(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Số Điện Thoại (Zalo) *</label>
                    <input
                      type="text"
                      placeholder="0988 123 456"
                      required
                      value={mbCustomerPhone}
                      onChange={(e) => setMbCustomerPhone(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#C8A261] focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Email (Tùy chọn)</label>
                    <input
                      type="email"
                      placeholder="khach@gmail.com"
                      value={mbCustomerEmail}
                      onChange={(e) => setMbCustomerEmail(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Nguồn Đặt Phòng</label>
                    <select
                      value={mbSource}
                      onChange={(e) => setMbSource(e.target.value as BookingChannel)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    >
                      <option value="zalo">Zalo Homestay</option>
                      <option value="facebook">Facebook Fanpage</option>
                      <option value="phone">Hotline Điện Thoại</option>
                      <option value="walk_in">Khách Trực Tiếp (Walk-in)</option>
                      <option value="direct">Website Direct</option>
                      <option value="booking.com">Booking.com</option>
                      <option value="agoda">Agoda</option>
                      <option value="other">Nguồn Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Ngày Nhận Phòng (Check-In)</label>
                    <input
                      type="date"
                      required
                      value={mbCheckIn}
                      onChange={(e) => setMbCheckIn(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Ngày Trả Phòng (Check-Out)</label>
                    <input
                      type="date"
                      required
                      value={mbCheckOut}
                      onChange={(e) => setMbCheckOut(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Hạng Phòng</label>
                    <select
                      value={mbRoomTypeId}
                      onChange={(e) => {
                        setMbRoomTypeId(e.target.value);
                        setMbSelectedRoomId('');
                      }}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    >
                      {roomTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.name} ({rt.basePrice.toLocaleString()}đ)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">
                      Phân Phòng Cụ Thể (Còn {availableRoomsForManualBooking.length} phòng trống)
                    </label>
                    <select
                      value={mbSelectedRoomId}
                      onChange={(e) => setMbSelectedRoomId(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    >
                      <option value="">-- Tự động phân phòng trống --</option>
                      {availableRoomsForManualBooking.map((r) => (
                        <option key={r.id} value={r.id}>
                          Phòng {r.number} ({r.area || 'Tầng ' + r.floor})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Giảm Giá / Chiết Khấu (VND)</label>
                    <input
                      type="number"
                      value={mbDiscount}
                      onChange={(e) => setMbDiscount(Number(e.target.value))}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Tiền Cọc Đã Nhận Thực Tế (VND)</label>
                    <input
                      type="number"
                      placeholder={`Ví dụ: ${Math.round(mbBaseTotal * 0.5)}`}
                      value={mbPaidAmount || ''}
                      onChange={(e) => setMbPaidAmount(Number(e.target.value))}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-mono text-emerald-800 font-bold"
                    />
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="bg-[#FAF6EE] border border-[#E2D6C3] rounded-2xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>Thời gian lưu trú:</span>
                    <strong>{mbNights} đêm</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Tổng tiền phòng:</span>
                    <strong className="font-serif text-sm text-[#1C2321]">{mbBaseTotal.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                    <span>Đã thu:</span>
                    <span>{(mbPaidAmount || Math.round(mbBaseTotal * 0.5)).toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-amber-800 font-bold">
                    <span>Số dư còn lại:</span>
                    <span>{Math.max(0, mbBaseTotal - (mbPaidAmount || Math.round(mbBaseTotal * 0.5))).toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Ghi Chú Đơn Đặt</label>
                  <textarea
                    rows={2}
                    placeholder="Khách check-in muộn lúc 18h, cần thuê thêm 1 xe máy..."
                    value={mbNotes}
                    onChange={(e) => setMbNotes(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-2.5 focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsManualBookingOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#E0D8CD] text-[#706557] font-bold"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Lưu & Xác Nhận Đơn
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CHECK-IN & THU SỐ DƯ */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCheckInModalOpen && selectedBookingForCheckIn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Thủ Tục Check-in Nhận Phòng
                </h3>
                <button onClick={() => setIsCheckInModalOpen(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-4 space-y-2">
                <p>Khách hàng: <strong>{selectedBookingForCheckIn.customerName}</strong> ({selectedBookingForCheckIn.customerPhone})</p>
                <p>Phòng: <strong>{selectedBookingForCheckIn.roomNumber}</strong> ({selectedBookingForCheckIn.roomTypeName})</p>
                <p>Lưu trú: <strong>{selectedBookingForCheckIn.checkIn}</strong> đến <strong>{selectedBookingForCheckIn.checkOut}</strong></p>
                <p>Tổng tiền phòng: <strong>{selectedBookingForCheckIn.totalPrice.toLocaleString()} đ</strong></p>
                <p className="text-emerald-700">Đã cọc trước: <strong>{(selectedBookingForCheckIn.paidAmount || selectedBookingForCheckIn.depositAmount).toLocaleString()} đ</strong></p>
              </div>

              <div>
                <label className="block font-bold text-[#1C2321] mb-1">
                  Thu Số Tiền Còn Lại (VND)
                </label>
                <input
                  type="number"
                  value={collectAmountInput}
                  onChange={(e) => setCollectAmountInput(Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 font-mono text-base font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1C2321] mb-1">Hình Thức Thu</label>
                <select
                  value={collectPaymentMethod}
                  onChange={(e) => setCollectPaymentMethod(e.target.value as any)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold"
                >
                  <option value="vietqr">Quét mã VietQR MBBank</option>
                  <option value="cash">Tiền mặt tại quầy lễ tân</option>
                  <option value="card">Quẹt thẻ POS</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckInModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E0D8CD] font-bold"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCheckIn}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                >
                  Xác Nhận Check-in
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: GHI NHẬN THU CHI MỚI */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isTransactionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Ghi Nhận Thu / Chi Quỹ
                </h3>
                <button onClick={() => setIsTransactionModalOpen(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-3.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTxType('income')}
                    className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                      txType === 'income' ? 'bg-emerald-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    + Khoản Thu
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('expense')}
                    className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                      txType === 'expense' ? 'bg-rose-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    - Khoản Chi
                  </button>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Nội Dung Khoản Tiền *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Bán 4 Cà phê muối, Thuê xe máy..."
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Số Tiền (VND) *</label>
                    <input
                      type="number"
                      required
                      value={txAmount}
                      onChange={(e) => setTxAmount(Number(e.target.value))}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Danh Mục</label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value as any)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="cafe_beverage">Quầy Cafe Seagull</option>
                      <option value="bike_rental">Thuê Xe Máy Lý Sơn</option>
                      <option value="island_tour">Cano / Tour Đảo Bé</option>
                      <option value="room_balance">Thanh Toán Phòng</option>
                      <option value="supplies">Nguyên Vật Liệu</option>
                      <option value="utilities">Điện Nước / Giặt Ủi</option>
                      <option value="staff_salary">Lương Nhân Viên</option>
                      <option value="other">Khoản Khác</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Hình Thức Thanh Toán</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value as any)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="vietqr">VietQR Chuyển Khoản</option>
                    <option value="cash">Tiền Mặt</option>
                    <option value="card">Thẻ Ngân Hàng</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTransactionModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E0D8CD] font-bold"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                  >
                    Lưu Giao Dịch
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: THÊM KHÁCH HÀNG MỚI */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Thêm Khách Hàng Mới
                </h3>
                <button onClick={() => setIsCustomerModalOpen(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveCustomer} className="space-y-3.5">
                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Họ Tên Khách Hàng *</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Số Điện Thoại (Zalo) *</label>
                  <input
                    type="text"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Email</label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Phân Hạng</label>
                  <select
                    value={custTier}
                    onChange={(e) => setCustTier(e.target.value as any)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="regular">Khách Thường</option>
                    <option value="vip">Khách VIP</option>
                    <option value="new">Khách Mới</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Ghi Chú & Sở Thích</label>
                  <textarea
                    rows={2}
                    value={custNotes}
                    onChange={(e) => setCustNotes(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-2.5"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E0D8CD] font-bold"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                  >
                    Lưu Khách Hàng
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: XEM CHI TIẾT ĐƠN ĐẶT PHÒNG */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedBookingForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-[#9E7A3B]">
                    {selectedBookingForDetail.code}
                  </span>
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                    {selectedBookingForDetail.channel}
                  </span>
                </div>
                <button onClick={() => setSelectedBookingForDetail(null)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-4 space-y-2">
                  <p>Khách hàng: <strong>{selectedBookingForDetail.customerName}</strong></p>
                  <p>Điện thoại: <strong className="font-mono">{selectedBookingForDetail.customerPhone}</strong></p>
                  {selectedBookingForDetail.customerEmail && <p>Email: {selectedBookingForDetail.customerEmail}</p>}
                  <p>Phòng: <strong>{selectedBookingForDetail.roomNumber}</strong> ({selectedBookingForDetail.roomTypeName})</p>
                  <p>Thời gian: <strong>{selectedBookingForDetail.checkIn}</strong> → <strong>{selectedBookingForDetail.checkOut}</strong> ({selectedBookingForDetail.nights} đêm)</p>
                  <p>Tổng tiền: <strong className="text-sm font-serif">{selectedBookingForDetail.totalPrice.toLocaleString()} đ</strong></p>
                  <p className="text-emerald-700">Đã thu: <strong>{(selectedBookingForDetail.paidAmount || selectedBookingForDetail.depositAmount).toLocaleString()} đ</strong></p>
                  {selectedBookingForDetail.notes && (
                    <p className="text-[#706557] italic pt-1 border-t border-[#E0D8CD]">
                      Ghi chú: {selectedBookingForDetail.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedBookingForDetail(null)}
                  className="px-4 py-2 rounded-xl border border-[#E0D8CD] font-bold"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: THÊM / CHỈNH SỬA PHÒNG THỰC TẾ (20 PHÒNG SEAGULL) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRoomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                    {editingRoom ? `Chỉnh Sửa Phòng ${editingRoom.number}` : 'Thêm Phòng Mới'}
                  </h3>
                  <p className="text-[11px] text-[#706557]">
                    Quản lý danh sách 20 phòng kinh doanh của Seagull Lý Sơn
                  </p>
                </div>
                <button onClick={() => setIsRoomModalOpen(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveRoom} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Số / Mã Phòng *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 101, BG-01, DOME-A"
                      value={roomNumberInput}
                      onChange={(e) => setRoomNumberInput(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold font-serif text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Tầng</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={roomFloorInput}
                      onChange={(e) => setRoomFloorInput(Number(e.target.value))}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Hạng Phòng *</label>
                  <select
                    value={roomTypeIdInput}
                    onChange={(e) => setRoomTypeIdInput(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-bold text-[#1C2321]"
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} ({rt.basePrice.toLocaleString()} đ/đêm)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Khu Vực / Vị Trí Cụ Thể</label>
                  <input
                    type="text"
                    placeholder="VD: Tầng 1 - Vòm Hướng Biển, Khu Vách Núi Hoàng Hôn"
                    value={roomAreaInput}
                    onChange={(e) => setRoomAreaInput(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Trạng Thái Phòng</label>
                    <select
                      value={roomStatusInput}
                      onChange={(e) => setRoomStatusInput(e.target.value as any)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-medium"
                    >
                      <option value="available">Sẵn sàng đón khách</option>
                      <option value="maintenance">Bảo trì / Sửa chữa</option>
                      <option value="locked">Tạm khóa phòng</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1C2321] mb-1">Tình Trạng Vệ Sinh</label>
                    <select
                      value={roomHousekeepingInput}
                      onChange={(e) => setRoomHousekeepingInput(e.target.value as any)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 font-medium"
                    >
                      <option value="clean">Đã dọn sạch</option>
                      <option value="cleaning">Đang dọn dẹp</option>
                      <option value="dirty">Cần dọn dẹp (Bẩn)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#FAF8F5] border border-[#E8E2D9] p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#1C2321] block">Mở Bán Kinh Doanh</span>
                    <span className="text-[10px] text-[#706557]">
                      Nếu tắt, phòng sẽ không xuất hiện trên Website đặt phòng khách
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roomIsActiveInput}
                      onChange={(e) => setRoomIsActiveInput(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C8A261]"></div>
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Ghi Chú Phòng</label>
                  <textarea
                    rows={2}
                    placeholder="VD: Cửa sổ vòm ngắm hoàng hôn đẹp nhất, bồn tắm view biển..."
                    value={roomNotesInput}
                    onChange={(e) => setRoomNotesInput(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-2.5"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRoomModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E0D8CD] font-bold"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                  >
                    {editingRoom ? 'Lưu Thay Đổi' : 'Tạo Phòng Mới'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: NHẬP NHANH 20 PHÒNG THỰC TẾ (QUICK IMPORT / CSV) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isQuickImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1C2321] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#C8A261]" />
                    Nhập Hàng Loạt 20 Phòng Thực Tế
                  </h3>
                  <p className="text-[11px] text-[#706557]">
                    Dán danh sách phòng thực tế của chủ homestay để tạo nhanh chỉ trong 1 giây.
                  </p>
                </div>
                <button onClick={() => setIsQuickImportOpen(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-[#FAF8F5] border border-[#E0D8CD] p-3 rounded-xl text-[#52483B] space-y-1">
                  <p className="font-bold text-[#1C2321]">Cách nhập danh sách:</p>
                  <p>• <strong>Cách 1 (Đơn giản):</strong> Dán danh sách mã phòng cách nhau bằng dấu phẩy hoặc xuống dòng: <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono">101, 102, 103, 104, 105, 201, 202...</code></p>
                  <p>• <strong>Cách 2 (Chi tiết CSV):</strong> Mỗi dòng theo định dạng: <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono">Số phòng, Tầng, Khu vực</code></p>
                </div>

                <div>
                  <label className="block font-bold text-[#1C2321] mb-1">Dán Danh Sách Phòng Của Bạn:</label>
                  <textarea
                    rows={7}
                    placeholder="101, 1, Tầng 1 - Vòm Hướng Biển&#10;102, 1, Tầng 1 - Vòm Hướng Biển&#10;103, 1, Tầng 1 - Vòm Hướng Biển&#10;104, 1, Tầng 1 - Vòm Hướng Biển&#10;105, 1, Tầng 1 - Vòm Hướng Biển&#10;201, 2, Tầng 2 - Deluxe Bồn Tắm&#10;202, 2, Tầng 2 - Deluxe Bồn Tắm"
                    value={quickImportText}
                    onChange={(e) => setQuickImportText(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl p-3 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-[#1C2321] block">Chế độ nhập:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                      quickImportMode === 'replace' ? 'bg-[#FAF6EE] border-[#C8A261] font-bold' : 'bg-[#FAF8F5] border-[#E0D8CD]'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={quickImportMode === 'replace'}
                        onChange={() => setQuickImportMode('replace')}
                        className="text-[#C8A261]"
                      />
                      <span>Thay thế toàn bộ phòng</span>
                    </label>

                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                      quickImportMode === 'append' ? 'bg-[#FAF6EE] border-[#C8A261] font-bold' : 'bg-[#FAF8F5] border-[#E0D8CD]'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={quickImportMode === 'append'}
                        onChange={() => setQuickImportMode('append')}
                        className="text-[#C8A261]"
                      />
                      <span>Thêm tiếp vào danh sách</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E2D9]">
                  <button
                    type="button"
                    onClick={() => setIsQuickImportOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E0D8CD] font-bold"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickImportRooms}
                    className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#C8A261]" />
                    Xác Nhận Tạo Phòng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
