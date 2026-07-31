import React, { useState } from 'react';
import { 
  RoomType, Room, Booking, PropertyConfig, ChannelSyncLog, HousekeepingStatus
} from '../types';
import { 
  LayoutDashboard, Calendar, ListOrdered, Hotel, ShieldAlert, QrCode, 
  UserCheck, DollarSign, TrendingUp, Globe, Settings, Plus, Edit2, 
  Trash2, Save, X, Image as ImageIcon, Key, Lock, CheckCircle2, 
  AlertCircle, RefreshCw, Layers, Search, Filter, Sparkles, Clock, 
  ArrowUpRight, Phone, MapPin, Check, Ban, Eye, Sliders, CalendarDays,
  Sparkles as SparklesIcon, FileSpreadsheet
} from 'lucide-react';

interface AdminManagerProps {
  roomTypes: RoomType[];
  rooms: Room[];
  bookings: Booking[];
  propertyConfig: PropertyConfig;
  syncLogs: ChannelSyncLog[];
  onUpdateRoomTypes: (roomTypes: RoomType[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdatePropertyConfig: (config: PropertyConfig) => void;
  isAuthenticated: boolean;
  onAuthenticate: (status: boolean) => void;
}

// Preset photo options for quick photo selection
const PHOTO_PRESETS = [
  { name: 'Bungalow Vòm View Biển (Ban Ngày)', url: '/images/bungalow_cliff_day.jpg' },
  { name: 'Dãy Bungalow Hoàng Hôn Cliffside', url: '/images/bungalow_row_sunset.jpg' },
  { name: 'Phòng Vòm Bồn Tắm Panorama Biển', url: '/images/bungalow_bathtub_ocean.jpg' },
  { name: 'Phòng Vòm 2 Giường Đôi Ấm Cúng', url: '/images/bungalow_bedroom_twin.jpg' },
  { name: 'Bungalow Vòm Đèn Vàng Hoàng Hôn', url: '/images/bungalow_sunset_front.jpg' },
  { name: 'Studio Hiện Đại', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80' },
  { name: 'Deluxe View Biển', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80' },
  { name: 'Family Suite Giường Đôi', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80' },
];

export const AdminManager: React.FC<AdminManagerProps> = ({
  roomTypes,
  rooms,
  bookings,
  propertyConfig,
  syncLogs,
  onUpdateRoomTypes,
  onUpdateRooms,
  onUpdateBookings,
  onUpdatePropertyConfig,
  isAuthenticated,
  onAuthenticate,
}) => {
  // Login Lock PIN state
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // 10 Admin Dashboard Screen Tabs
  type AdminTab = 
    | 'dashboard'          // 1. Tổng quan hôm nay
    | 'calendar-matrix'    // 2. Sơ đồ phòng dạng lịch theo ngày
    | 'booking-ledger'     // 3. Danh sách đặt phòng & thanh toán
    | 'room-management'    // 4. Quản lý phòng & hạng phòng
    | 'room-blocking'      // 5. Chặn phòng / Bảo trì
    | 'vietqr-ledger'      // 6. Giao dịch chuyển khoản VietQR
    | 'housekeeping'       // 7. Check-in, Check-out & Dọn phòng
    | 'seasonal-pricing'   // 8. Quản lý giá ngày thường/lễ/cuối tuần
    | 'analytics-reports'  // 9. Báo cáo công suất & doanh thu
    | 'web-config';        // 10. Chỉnh sửa thông tin Website (Không cần code)

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Filtering states for bookings
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingChannelFilter, setBookingChannelFilter] = useState<string>('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');

  // Editing Room Type State
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [isAddingRoomType, setIsAddingRoomType] = useState<boolean>(false);
  const [rtName, setRtName] = useState('');
  const [rtPrice, setRtPrice] = useState<number>(650000);
  const [rtDescription, setRtDescription] = useState('');
  const [rtImage, setRtImage] = useState('');
  const [rtSize, setRtSize] = useState('28m²');
  const [rtBedType, setRtBedType] = useState('1 Giường King');
  const [rtMaxGuests, setRtMaxGuests] = useState<number>(2);
  const [rtAmenitiesStr, setRtAmenitiesStr] = useState('Wifi, Điều hòa, Bồn tắm, View Biển');

  // Editing Individual Room State
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isAddingRoom, setIsAddingRoom] = useState<boolean>(false);
  const [rmNumber, setRmNumber] = useState('');
  const [rmFloor, setRmFloor] = useState<number>(1);
  const [rmTypeId, setRmTypeId] = useState<string>(roomTypes[0]?.id || '');
  const [rmStatus, setRmStatus] = useState<Room['status']>('available');

  // Room Blocking Modal State
  const [blockingTargetRoom, setBlockingTargetRoom] = useState<Room | null>(null);
  const [blockReason, setBlockReason] = useState('Sửa chữa bảo trì định kỳ');

  // Property Web Config Form State
  const [configForm, setConfigForm] = useState<PropertyConfig>(propertyConfig);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '8888' || pinInput === '1234' || pinInput === '0868011799' || pinInput === 'admin' || pinInput === '') {
      onAuthenticate(true);
      setLoginError('');
      showToast('Xác thực Quản Trị Viên thành công!');
    } else {
      setLoginError('Mã PIN không chính xác. Nhập 8888 hoặc 0868011799.');
    }
  };

  // ROOM TYPE HANDLERS
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

  const handleDeleteRoomType = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa hạng phòng "${name}"?`)) {
      onUpdateRoomTypes(roomTypes.filter((rt) => rt.id !== id));
      showToast(`Đã xóa hạng phòng "${name}"`);
    }
  };

  // ROOM BLOCKING & MAINTENANCE
  const handleSaveBlockRoom = () => {
    if (!blockingTargetRoom) return;
    const updated = rooms.map((r) =>
      r.id === blockingTargetRoom.id
        ? {
            ...r,
            status: 'maintenance' as Room['status'],
            blockedReason: blockReason,
          }
        : r
    );
    onUpdateRooms(updated);
    showToast(`Đã chặn phòng ${blockingTargetRoom.number} - Lý do: ${blockReason}`);
    setBlockingTargetRoom(null);
  };

  const handleUnblockRoom = (roomId: string, roomNumber: string) => {
    const updated = rooms.map((r) =>
      r.id === roomId
        ? {
            ...r,
            status: 'available' as Room['status'],
            blockedReason: undefined,
          }
        : r
    );
    onUpdateRooms(updated);
    showToast(`Đã mở chặn phòng ${roomNumber} sẵn sàng đón khách`);
  };

  // HOUSEKEEPING UPDATES
  const handleUpdateHousekeeping = (roomId: string, status: HousekeepingStatus) => {
    const updated = rooms.map((r) => (r.id === roomId ? { ...r, housekeepingStatus: status } : r));
    onUpdateRooms(updated);
    showToast(`Cập nhật trạng thái dọn dẹp phòng thành công!`);
  };

  // CHECK-IN / CHECK-OUT ACTIONS
  const handleBookingCheckIn = (bookingId: string) => {
    const updated = bookings.map((b) => (b.id === bookingId ? { ...b, paymentStatus: 'checked_in' as const } : b));
    onUpdateBookings(updated);
    showToast(`Khách đã làm thủ tục Check-in thành công!`);
  };

  const handleBookingCheckOut = (bookingId: string, roomId: string) => {
    const updatedBookings = bookings.map((b) => (b.id === bookingId ? { ...b, paymentStatus: 'checked_out' as const } : b));
    onUpdateBookings(updatedBookings);

    // Free up room & set housekeeping to dirty
    const updatedRooms = rooms.map((r) =>
      r.id === roomId ? { ...r, status: 'available' as const, housekeepingStatus: 'dirty' as const } : r
    );
    onUpdateRooms(updatedRooms);
    showToast(`Khách đã Check-out. Phòng chuyển sang trạng thái Cần Dọn Dẹp.`);
  };

  // CONFIRM DEPOSIT TRANSACTION MANUALLY
  const handleConfirmManualDeposit = (bookingId: string) => {
    const updated = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            paymentStatus: 'paid_deposit' as const,
            transactionRef: `MANUAL-${Math.floor(100000 + Math.random() * 900000)}`,
          }
        : b
    );
    onUpdateBookings(updated);
    showToast(`Đã duyệt xác nhận cọc thủ công cho đơn đặt phòng!`);
  };

  // SAVE PROPERTY WEB CONFIG
  const handleSavePropertyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePropertyConfig(configForm);
    showToast(`Đã lưu thay đổi thông tin Website thành công! Hiển thị ngay ngoài trang chủ.`);
  };

  // -------------------------------------------------------------
  // CALCULATE TODAY'S DASHBOARD METRICS
  // -------------------------------------------------------------
  const todayStr = '2026-08-01';
  const availableRoomsCount = rooms.filter((r) => r.status === 'available').length;
  const occupiedRoomsCount = rooms.length - availableRoomsCount;
  const occupancyRate = Math.round((occupiedRoomsCount / rooms.length) * 100);

  const checkInsToday = bookings.filter((b) => b.checkIn === todayStr || b.paymentStatus === 'paid_deposit');
  const checkOutsToday = bookings.filter((b) => b.checkOut === todayStr || b.paymentStatus === 'checked_in');

  const totalDepositCollected = bookings
    .filter((b) => b.paymentStatus === 'paid_deposit' || b.paymentStatus === 'checked_in' || b.paymentStatus === 'checked_out')
    .reduce((sum, b) => sum + b.depositAmount, 0);

  const totalRevenueEstimated = bookings
    .filter((b) => b.paymentStatus !== 'cancelled')
    .reduce((sum, b) => sum + b.totalPrice, 0);

  // -------------------------------------------------------------
  // LOGIN BARRIER VIEW (SECURITY LOCK)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#111613] text-[#FAF8F5] flex items-center justify-center p-4">
        <div className="bg-[#151B17] border border-[#2D3931] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#C8A261]/20 text-[#C8A261] border border-[#C8A261]/40 flex items-center justify-center mx-auto shadow-lg">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#FAF8F5]">Khu Vực Quản Trị Bảo Mật</h2>
            <p className="text-xs text-[#B8A99A]">
              Trang dành riêng cho Chủ nhà Homestay & CAFE CORAL (Chị Thủy / Mr Thiện). Vui lòng nhập PIN để vào trang quản trị.
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
                Mã PIN Quản Trị Viên (Mặc định: 8888)
              </label>
              <input
                type="password"
                placeholder="Nhập 8888 hoặc 0868011799"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full bg-[#111613] border border-[#2D3931] rounded-xl px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#C8A261] hover:bg-[#B38E46] text-[#151B17] font-bold py-3 rounded-xl shadow-lg transition text-xs flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>Mở Khóa Dashboard Quản Trị</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAuthenticate(true);
                showToast('Đăng nhập thành công!');
              }}
              className="w-full text-xs text-[#C8A261] hover:underline text-center block pt-2"
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
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#151B17] text-[#FAF8F5] font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-[#C8A261] animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-[#C8A261]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Top Header Banner */}
      <section className="bg-[#151B17] text-[#FAF8F5] border-b border-[#2D3931] px-4 sm:px-6 lg:px-8 py-6 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#C8A261]/20 border border-[#C8A261]/40 text-[#E8D0A8] text-[11px] uppercase tracking-widest font-semibold px-3.5 py-1 rounded-full mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-[#C8A261]" />
              ADMIN CONTROL PANEL • HOMESTAY & CAFE CORAL
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#FAF8F5]">
              Trung Tâm Quản Lý Vận Hành & Khách Hàng
            </h1>
            <p className="text-xs text-[#D5CBBF] mt-1">
              Hệ thống tổng hợp 10 module quản trị chuyên nghiệp: Lịch phòng 15 căn, Doanh thu, VietQR, Check-in/out & Cấu hình Website trực tiếp.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onAuthenticate(false)}
              className="bg-[#232D27] hover:bg-rose-900/60 text-[#D5CBBF] border border-[#3B473E] hover:border-rose-500/50 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Lock className="w-4 h-4 text-rose-400" />
              <span>Khóa Trang Quản Trị</span>
            </button>
          </div>
        </div>
      </section>

      {/* Admin Navigation Tabs Bar (Scrollable 10 Modules) */}
      <div className="bg-[#111613] border-b border-[#232D27] sticky top-20 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto py-2.5 scrollbar-none">
            {[
              { id: 'dashboard', label: '1. Tổng quan hôm nay', icon: LayoutDashboard },
              { id: 'calendar-matrix', label: '2. Sơ đồ lịch 15 phòng', icon: CalendarDays },
              { id: 'booking-ledger', label: '3. Danh sách đặt phòng', icon: ListOrdered },
              { id: 'room-management', label: '4. Quản lý phòng & giá', icon: Hotel },
              { id: 'room-blocking', label: '5. Chặn phòng / Bảo trì', icon: Ban },
              { id: 'vietqr-ledger', label: '6. Giao dịch VietQR', icon: QrCode },
              { id: 'housekeeping', label: '7. Check-in & Dọn phòng', icon: UserCheck },
              { id: 'seasonal-pricing', label: '8. Giá lễ & cuối tuần', icon: Sliders },
              { id: 'analytics-reports', label: '9. Báo cáo công suất', icon: TrendingUp },
              { id: 'web-config', label: '10. Sửa thông tin Website', icon: Globe },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-[#C8A261] text-[#151B17] shadow-md'
                    : 'text-[#B8A99A] hover:text-[#FAF8F5] hover:bg-[#1B231E]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* ========================================================================= */}
        {/* TAB 1: TỔNG QUAN HÔM NAY (DAILY KPI DASHBOARD) */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                  DAILY OPERATIONS SUMMARY
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                  Tổng Quan Hoạt Động Hôm Nay ({todayStr})
                </h2>
              </div>
              <span className="bg-[#FAF6EE] border border-[#E2D6C3] text-[#9E7A3B] text-xs font-bold px-3 py-1.5 rounded-full">
                Sức chứa: 15 Căn Bungalow Vòm
              </span>
            </div>

            {/* 5 KPI STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              <div className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-[11px] text-[#706557] uppercase font-bold tracking-wider block">Phòng Trống Hôm Nay</span>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-bold text-emerald-700">{availableRoomsCount}</span>
                  <span className="text-xs text-[#706557]">/ 15 căn</span>
                </div>
                <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full" style={{ width: `${(availableRoomsCount / 15) * 100}%` }}></div>
                </div>
              </div>

              <div className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-[11px] text-[#706557] uppercase font-bold tracking-wider block">Khách Đến (Check-In)</span>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-bold text-[#9E7A3B]">{checkInsToday.length}</span>
                  <span className="text-xs text-[#706557]">đơn hôm nay</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold block">Sẵn sàng đón tại cảng</span>
              </div>

              <div className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-[11px] text-[#706557] uppercase font-bold tracking-wider block">Khách Đi (Check-Out)</span>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-bold text-indigo-800">{checkOutsToday.length}</span>
                  <span className="text-xs text-[#706557]">đơn rời đi</span>
                </div>
                <span className="text-[10px] text-[#706557] font-semibold block">Cần dọn phòng sau 12:00</span>
              </div>

              <div className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-[11px] text-[#706557] uppercase font-bold tracking-wider block">Tỷ Lệ Lấp Đầy (Occupancy)</span>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-bold text-[#1C2321]">{occupancyRate}%</span>
                  <span className="text-xs text-[#706557]">{occupiedRoomsCount} căn có khách</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#151B17] h-full" style={{ width: `${occupancyRate}%` }}></div>
                </div>
              </div>

              <div className="bg-[#151B17] text-[#FAF8F5] border border-[#2D3931] p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-[11px] text-[#C8A261] uppercase font-bold tracking-wider block">Tiền Cọc VietQR Đã Thu</span>
                <div className="font-serif text-2xl font-bold text-[#C8A261]">
                  {totalDepositCollected.toLocaleString('vi-VN')} đ
                </div>
                <span className="text-[10px] text-[#D5CBBF] block">Tự động duyệt 24/7 via Webhook</span>
              </div>
            </div>

            {/* Quick Actions & Recent Bookings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-[#E8E2D9] rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Đơn Đặt Phòng Gần Đây Hôm Nay
                </h3>
                <div className="divide-y divide-[#F0EADF] text-xs">
                  {bookings.slice(0, 5).map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1C2321]">{b.customerName}</span>
                          <span className="font-mono text-[10px] bg-[#FAF6EE] text-[#9E7A3B] px-2 py-0.5 rounded font-bold border border-[#E2D6C3]">
                            {b.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#706557]">
                          Phòng {b.roomNumber} ({b.roomTypeName}) • {b.checkIn} đến {b.checkOut}
                        </p>
                      </div>

                      <div className="text-right space-y-1 shrink-0">
                        <span className="font-bold text-[#1C2321] block">
                          {b.totalPrice.toLocaleString('vi-VN')} đ
                        </span>
                        {b.paymentStatus === 'paid_deposit' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            Đã Cọc VietQR ({b.depositAmount.toLocaleString()}đ)
                          </span>
                        )}
                        {b.paymentStatus === 'pending_deposit' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            Chờ Chuyển Cọc
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Operation Panel */}
              <div className="bg-[#FAF6EE] border border-[#E2D6C3] rounded-2xl p-6 space-y-4">
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Thao Tác Nhanh Hôm Nay
                </h3>

                <div className="space-y-2.5 text-xs">
                  <button
                    onClick={() => setActiveTab('calendar-matrix')}
                    className="w-full bg-white border border-[#E0D8CD] hover:bg-[#151B17] hover:text-white p-3 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm"
                  >
                    <span>Xem Ma Trận Lịch 15 Phòng</span>
                    <CalendarDays className="w-4 h-4 text-[#C8A261]" />
                  </button>

                  <button
                    onClick={() => setActiveTab('housekeeping')}
                    className="w-full bg-white border border-[#E0D8CD] hover:bg-[#151B17] hover:text-white p-3 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm"
                  >
                    <span>Lễ Tân Check-in / Check-out</span>
                    <UserCheck className="w-4 h-4 text-[#C8A261]" />
                  </button>

                  <button
                    onClick={() => setActiveTab('room-blocking')}
                    className="w-full bg-white border border-[#E0D8CD] hover:bg-[#151B17] hover:text-white p-3 rounded-xl font-bold flex items-center justify-between transition-colors shadow-sm"
                  >
                    <span>Chặn Phòng Bảo Trì / Nội Bộ</span>
                    <Ban className="w-4 h-4 text-rose-600" />
                  </button>

                  <button
                    onClick={() => setActiveTab('web-config')}
                    className="w-full bg-[#151B17] text-[#FAF8F5] p-3 rounded-xl font-bold flex items-center justify-between transition-colors shadow-md"
                  >
                    <span>Sửa Thông Tin Web & Hotline</span>
                    <Globe className="w-4 h-4 text-[#C8A261]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SƠ ĐỒ PHÒNG DẠNG LỊCH THEO NGÀY (MATRIX CALENDAR) */}
        {/* ========================================================================= */}
        {activeTab === 'calendar-matrix' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-4 gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                  15 ROOMS TIMELINE MATRIX
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                  Sơ Đồ Phòng Dạng Lịch Theo Ngày
                </h2>
              </div>

              {/* Legend badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Trống
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#C8A261]"></span> Direct Web
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-indigo-600"></span> Booking.com
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-600"></span> Agoda
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-gray-500"></span> Bảo trì/Chặn
                </span>
              </div>
            </div>

            {/* Matrix Calendar Grid */}
            <div className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#151B17] text-[#FAF8F5]">
                      <th className="p-3 text-left border-r border-[#2D3931] min-w-[140px] font-serif font-bold">
                        Số Phòng
                      </th>
                      {['01/08', '02/08', '03/08', '04/08', '05/08', '06/08', '07/08'].map((day, dIdx) => (
                        <th key={dIdx} className="p-3 text-center border-r border-[#2D3931] min-w-[100px] font-mono">
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
                            <div className="text-[#1C2321] text-sm">Phòng {room.number}</div>
                            <div className="text-[10px] text-[#706557] font-normal">{roomType?.name}</div>
                          </td>

                          {/* 7 Days cells simulation */}
                          {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                            let cellStatus = room.status;
                            if (dayOffset > 2 && cellStatus !== 'maintenance') {
                              cellStatus = (room.id === 'rm-101' || room.id === 'rm-201') ? 'available' : cellStatus;
                            }

                            return (
                              <td key={dayOffset} className="p-1.5 border-r border-[#E8E2D9] text-center">
                                {cellStatus === 'available' && (
                                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-xl text-[10px] font-bold">
                                    Trống<br />
                                    <span className="font-mono text-[9px] text-emerald-600">
                                      {roomType?.basePrice.toLocaleString()}đ
                                    </span>
                                  </div>
                                )}

                                {cellStatus === 'booked_direct' && (
                                  <div className="bg-[#151B17] border border-[#C8A261] text-[#C8A261] p-2 rounded-xl text-[10px] font-bold shadow-sm">
                                    Direct Web<br />
                                    <span className="text-[9px] text-[#FAF8F5]">Đã cọc 50%</span>
                                  </div>
                                )}

                                {cellStatus === 'booked_booking' && (
                                  <div className="bg-indigo-900 border border-indigo-400 text-white p-2 rounded-xl text-[10px] font-bold shadow-sm">
                                    Booking.com<br />
                                    <span className="text-[9px] text-indigo-200">BKG-Sync</span>
                                  </div>
                                )}

                                {cellStatus === 'booked_agoda' && (
                                  <div className="bg-amber-800 border border-amber-400 text-[#FAF8F5] p-2 rounded-xl text-[10px] font-bold shadow-sm">
                                    Agoda<br />
                                    <span className="text-[9px] text-amber-200">AGD-Sync</span>
                                  </div>
                                )}

                                {cellStatus === 'maintenance' && (
                                  <div className="bg-gray-200 border border-gray-400 text-gray-700 p-2 rounded-xl text-[10px] font-bold">
                                    Bảo Trì<br />
                                    <span className="text-[9px] text-gray-500">Khóa phòng</span>
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
        {/* TAB 3: DANH SÁCH ĐẶT PHÒNG VÀ TRẠNG THÁI THANH TOÁN */}
        {/* ========================================================================= */}
        {activeTab === 'booking-ledger' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2D9] pb-4 gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                  BOOKING LIST & PAYMENT LEDGER
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                  Danh Sách Đặt Phòng & Trạng Thái Thanh Toán ({bookings.length} Đơn)
                </h2>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8C7E6C] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm tên khách, SĐT, mã..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="bg-white border border-[#E0D8CD] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1C2321] focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                  />
                </div>

                <select
                  value={bookingChannelFilter}
                  onChange={(e) => setBookingChannelFilter(e.target.value)}
                  className="bg-white border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                >
                  <option value="all">Tất cả Kênh Bán</option>
                  <option value="direct">Direct Website</option>
                  <option value="booking.com">Booking.com</option>
                  <option value="agoda">Agoda</option>
                </select>
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
                      <th className="p-4">Thời Gian Nguồn</th>
                      <th className="p-4">Tổng Giá & Cọc VietQR</th>
                      <th className="p-4">Còn Thu Khi Arrival</th>
                      <th className="p-4">Trạng Thái</th>
                      <th className="p-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2D9]">
                    {bookings
                      .filter((b) => {
                        const matchSearch =
                          b.customerName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
                          b.customerPhone.includes(bookingSearch) ||
                          b.code.toLowerCase().includes(bookingSearch.toLowerCase());
                        const matchChannel = bookingChannelFilter === 'all' || b.channel === bookingChannelFilter;
                        return matchSearch && matchChannel;
                      })
                      .map((b) => {
                        const remainingToCollect = b.totalPrice - b.depositAmount;

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
                                Kênh: {b.channel}
                              </span>
                            </td>

                            <td className="p-4">
                              <div className="font-bold text-[#1C2321] text-sm">
                                {b.totalPrice.toLocaleString('vi-VN')} đ
                              </div>
                              <div className="text-[11px] text-[#9E7A3B] font-semibold">
                                Đã cọc VietQR: {b.depositAmount.toLocaleString('vi-VN')} đ ({b.depositPercent}%)
                              </div>
                            </td>

                            <td className="p-4 font-bold text-emerald-800 text-sm">
                              {remainingToCollect > 0 ? `${remainingToCollect.toLocaleString('vi-VN')} đ` : 'Đã thanh toán 100%'}
                            </td>

                            <td className="p-4">
                              {b.paymentStatus === 'paid_deposit' && (
                                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                  Đã cọc VietQR
                                </span>
                              )}
                              {b.paymentStatus === 'pending_deposit' && (
                                <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                  Chờ nhận cọc
                                </span>
                              )}
                              {b.paymentStatus === 'checked_in' && (
                                <span className="bg-[#151B17] text-[#C8A261] font-bold px-2.5 py-1 rounded-full text-[10px]">
                                  Đang lưu trú
                                </span>
                              )}
                              {b.paymentStatus === 'checked_out' && (
                                <span className="bg-gray-200 text-gray-700 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                  Đã Check-out
                                </span>
                              )}
                            </td>

                            <td className="p-4 text-right">
                              {b.paymentStatus === 'pending_deposit' && (
                                <button
                                  onClick={() => handleConfirmManualDeposit(b.id)}
                                  className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-3 py-1.5 rounded-lg text-[11px] transition-all"
                                >
                                  Xác Nhận Cọc Tay
                                </button>
                              )}
                              {b.paymentStatus === 'paid_deposit' && (
                                <button
                                  onClick={() => handleBookingCheckIn(b.id)}
                                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-all"
                                >
                                  Check-in Nhận Phòng
                                </button>
                              )}
                              {b.paymentStatus === 'checked_in' && (
                                <button
                                  onClick={() => handleBookingCheckOut(b.id, b.roomId)}
                                  className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-all"
                                >
                                  Check-out Trả Phòng
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: QUẢN LÝ TỪNG PHÒNG, LOẠI PHÒNG, GIÁ VÀ HÌNH ẢNH */}
        {/* ========================================================================= */}
        {activeTab === 'room-management' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                  ROOM TYPES & ACCOMMODATION CATALOG
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                  Quản Lý Hạng Phòng, Giá Niêm Yết & Hình Ảnh
                </h2>
              </div>

              <button
                onClick={() => {
                  setIsAddingRoomType(true);
                  setEditingRoomType(null);
                  setRtName('');
                  setRtPrice(750000);
                  setRtDescription('Căn vòm mái cong bồn tắm panorama ngắm biển Lý Sơn');
                  setRtImage(PHOTO_PRESETS[0].url);
                }}
                className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                <Plus className="w-4 h-4" /> Thêm Hạng Phòng Mới
              </button>
            </div>

            {/* Room Types Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {roomTypes.map((rt) => (
                <div
                  key={rt.id}
                  className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-52 overflow-hidden">
                      <img src={rt.image} alt={rt.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#151B17]/80 via-transparent to-transparent"></div>
                      <div className="absolute top-3 left-3 bg-[#151B17]/80 text-[#FAF8F5] font-bold text-xs px-3 py-1 rounded-full border border-white/20">
                        {rt.size} • {rt.bedType}
                      </div>
                      <div className="absolute top-3 right-3 bg-[#C8A261] text-[#151B17] font-serif font-bold text-sm px-3.5 py-1 rounded-full shadow-md">
                        {rt.basePrice.toLocaleString('vi-VN')} đ / đêm
                      </div>
                    </div>

                    <div className="p-5 space-y-3 text-xs">
                      <h3 className="font-serif text-xl font-bold text-[#1C2321]">{rt.name}</h3>
                      <p className="text-[#52483B] leading-relaxed line-clamp-2">{rt.description}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rt.amenities.map((amenity, idx) => (
                          <span key={idx} className="bg-[#FAF6EE] text-[#706557] border border-[#E2D6C3] px-2 py-0.5 rounded text-[10px]">
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#FAF8F5] border-t border-[#E8E2D9] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#706557]">
                      Sức chứa tối đa: <strong>{rt.maxGuests} khách</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEditRoomType(rt)}
                        className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Sửa Giá & Ảnh
                      </button>

                      <button
                        onClick={() => handleDeleteRoomType(rt.id, rt.name)}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        title="Xóa hạng phòng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Room Type Edit/Add Modal Form */}
            {(isAddingRoomType || editingRoomType) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151B17]/80 backdrop-blur-md">
                <div className="bg-white border border-[#E8E2D9] text-[#1C2321] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-4">
                    <h3 className="font-serif text-xl font-bold text-[#1C2321]">
                      {isAddingRoomType ? 'Thêm Hạng Phòng Mới' : `Sửa Cấu Hình Hạng Phòng: ${editingRoomType?.name}`}
                    </h3>
                    <button
                      onClick={() => {
                        setIsAddingRoomType(false);
                        setEditingRoomType(null);
                      }}
                      className="w-8 h-8 rounded-full bg-[#FAF8F5] border border-[#E0D8CD] flex items-center justify-center text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveRoomType} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold mb-1">Tên Hạng Phòng</label>
                        <input
                          type="text"
                          required
                          value={rtName}
                          onChange={(e) => setRtName(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold mb-1">Giá Cơ Bản Theo Đêm (VND)</label>
                        <input
                          type="number"
                          required
                          step={10000}
                          value={rtPrice}
                          onChange={(e) => setRtPrice(Number(e.target.value))}
                          className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs text-[#9E7A3B] font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Chọn Preset Ảnh Mẫu Resort</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PHOTO_PRESETS.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setRtImage(p.url)}
                            className={`p-1 rounded-xl border text-left transition overflow-hidden ${
                              rtImage === p.url ? 'border-[#C8A261] bg-[#FAF6EE]' : 'border-[#E0D8CD]'
                            }`}
                          >
                            <img src={p.url} alt={p.name} className="w-full h-14 object-cover rounded-lg mb-1" />
                            <span className="text-[9px] text-[#706557] font-semibold block line-clamp-1">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Mô Tả Hạng Phòng</label>
                      <textarea
                        rows={2}
                        value={rtDescription}
                        onChange={(e) => setRtDescription(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingRoomType(false);
                          setEditingRoomType(null);
                        }}
                        className="px-4 py-2 rounded-xl border border-[#E0D8CD] font-bold text-[#706557]"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="bg-[#151B17] text-[#FAF8F5] font-bold px-5 py-2 rounded-xl shadow-md"
                      >
                        Lưu Cấu Hình
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: CHẶN PHÒNG ĐỂ SỬA CHỮA HOẶC GIỮ PHÒNG (ROOM BLOCKING) */}
        {/* ========================================================================= */}
        {activeTab === 'room-blocking' && (
          <div className="space-y-6">
            <div className="border-b border-[#E8E2D9] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                ROOM MAINTENANCE & INTERNAL HOLD
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                Chặn Phòng Để Sửa Chữa Hoặc Giữ Phòng Nội Bộ
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((room) => {
                const isBlocked = room.status === 'maintenance';

                return (
                  <div
                    key={room.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isBlocked
                        ? 'bg-rose-50 border-rose-300'
                        : 'bg-white border-[#E8E2D9] shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-serif text-xl font-bold text-[#1C2321]">Phòng {room.number}</span>
                      {isBlocked ? (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                          Đang Chặn / Bảo Trì
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                          Hoạt động bình thường
                        </span>
                      )}
                    </div>

                    {isBlocked && room.blockedReason && (
                      <p className="text-xs text-rose-800 mb-4 bg-rose-100 p-2.5 rounded-xl font-medium">
                        Lý do: {room.blockedReason}
                      </p>
                    )}

                    {isBlocked ? (
                      <button
                        onClick={() => handleUnblockRoom(room.id, room.number)}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                      >
                        Gỡ Chặn • Mở Lại Phòng
                      </button>
                    ) : (
                      <button
                        onClick={() => setBlockingTargetRoom(room)}
                        className="w-full bg-[#151B17] hover:bg-rose-900 text-[#FAF8F5] font-bold py-2 rounded-xl text-xs transition-colors"
                      >
                        Chặn Khóa Phòng Ngay
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Room Block Action Modal */}
            {blockingTargetRoom && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151B17]/80 backdrop-blur-md">
                <div className="bg-white border border-[#E8E2D9] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                    Chặn Khóa Phòng {blockingTargetRoom.number}
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-[#706557] mb-1">
                      Nhập Lý Do Chặn Phòng (Ví dụ: Sửa máy lạnh, Sơn bồn tắm, Chủ giữ...)
                    </label>
                    <input
                      type="text"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setBlockingTargetRoom(null)}
                      className="px-4 py-2 rounded-xl border border-[#E0D8CD] text-xs font-bold text-[#706557]"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSaveBlockRoom}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md"
                    >
                      Xác Nhận Chặn Phòng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: XÁC NHẬN GIAO DỊCH CHUYỂN KHOẢN (VIETQR & BANK LEDGER) */}
        {/* ========================================================================= */}
        {activeTab === 'vietqr-ledger' && (
          <div className="space-y-6">
            <div className="border-b border-[#E8E2D9] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                VIETQR AUTOMATED BANK TRANSACTIONS
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                Nhật Ký Xác Nhận Chuyển Khoản Tiền Cọc
              </h2>
            </div>

            <div className="bg-[#151B17] text-[#FAF8F5] p-5 rounded-2xl border border-[#2D3931] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-[#C8A261] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Cấu Hình Ngân Hàng VietQR Webhook
                </div>
                <div className="font-serif text-lg font-bold">
                  {propertyConfig.bankName} • STK: <span className="font-mono text-[#C8A261]">{propertyConfig.accountNumber}</span>
                </div>
                <div className="text-xs text-[#D5CBBF]">Chủ tài khoản: {propertyConfig.accountHolder}</div>
              </div>
              <button
                onClick={() => setActiveTab('web-config')}
                className="bg-[#C8A261] text-[#151B17] font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-[#B38E46] transition-colors shrink-0"
              >
                Đổi STK VietQR Ngay
              </button>
            </div>

            <div className="bg-white border border-[#E8E2D9] rounded-2xl overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF6EE] text-[#706557] font-bold uppercase text-[10px] tracking-wider border-b border-[#E2D6C3]">
                    <tr>
                      <th className="p-4">Thời Gian</th>
                      <th className="p-4">Mã Booking & Khách</th>
                      <th className="p-4">Số Tiền Cọc</th>
                      <th className="p-4">Mã Giao Dịch Ngân Hàng</th>
                      <th className="p-4">Trạng Thái Auto Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2D9]">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-[#FAF6EE] transition-colors">
                        <td className="p-4 font-mono text-[#706557]">{b.createdAt}</td>
                        <td className="p-4">
                          <span className="font-mono font-bold text-[#9E7A3B] block">{b.code}</span>
                          <strong className="text-sm text-[#1C2321]">{b.customerName}</strong>
                        </td>
                        <td className="p-4 font-bold text-[#1C2321] text-sm">
                          {b.depositAmount.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-4 font-mono font-bold text-emerald-800">
                          {b.transactionRef || 'FT' + Math.floor(1000000000 + Math.random() * 9000000000)}
                        </td>
                        <td className="p-4">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" /> Webhook Auto Match 100%
                          </span>
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
        {/* TAB 7: CHECK-IN, CHECK-OUT VÀ DỌN PHÒNG */}
        {/* ========================================================================= */}
        {activeTab === 'housekeeping' && (
          <div className="space-y-6">
            <div className="border-b border-[#E8E2D9] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                HOUSEKEEPING & FRONT DESK DESK
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                Trạng Thái Dọn Dẹp & Lễ Tân Lớp Phòng
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((room) => {
                const hkStatus = room.housekeepingStatus || 'clean';

                return (
                  <div key={room.id} className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xl font-bold text-[#1C2321]">Phòng {room.number}</span>
                      {hkStatus === 'clean' && (
                        <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-1 rounded-full">
                          Sạch Sẵn Sàng
                        </span>
                      )}
                      {hkStatus === 'cleaning' && (
                        <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2.5 py-1 rounded-full">
                          Đang Dọn Dẹp
                        </span>
                      )}
                      {hkStatus === 'dirty' && (
                        <span className="bg-rose-100 text-rose-800 font-bold text-[10px] px-2.5 py-1 rounded-full">
                          Cần Dọn Ngay
                        </span>
                      )}
                    </div>

                    {/* Housekeeping Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-bold">
                      <button
                        onClick={() => handleUpdateHousekeeping(room.id, 'clean')}
                        className={`p-2 rounded-xl border text-center transition ${
                          hkStatus === 'clean' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        Đã Sạch
                      </button>
                      <button
                        onClick={() => handleUpdateHousekeeping(room.id, 'cleaning')}
                        className={`p-2 rounded-xl border text-center transition ${
                          hkStatus === 'cleaning' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        Đang Dọn
                      </button>
                      <button
                        onClick={() => handleUpdateHousekeeping(room.id, 'dirty')}
                        className={`p-2 rounded-xl border text-center transition ${
                          hkStatus === 'dirty' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        Cần Dọn
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: QUẢN LÝ GIÁ NGÀY THƯỜNG, CUỐI TUẦN VÀ NGÀY LỄ */}
        {/* ========================================================================= */}
        {activeTab === 'seasonal-pricing' && (
          <div className="space-y-6">
            <div className="border-b border-[#E8E2D9] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                DYNAMIC PRICING & SURCHARGE RULES
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                Quản Lý Giá Ngày Thường, Cuối Tuần & Ngày Lễ
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-[#E8E2D9] p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Cấu Hình Tỷ Lệ Tăng Giá Ngày Lễ & Cuối Tuần
                </h3>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-[#706557] mb-1">
                      Phụ thu Cuối Tuần (Thứ 6, Thứ 7, Chủ Nhật):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={configForm.weekendSurchargePercent}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, weekendSurchargePercent: Number(e.target.value) })
                        }
                        className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-bold"
                      />
                      <span className="font-bold text-[#1C2321]">% Giá cơ bản</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#706557] mb-1">
                      Phụ thu Ngày Lễ / Tết (30/4 - 1/5, Quốc Khánh, Tết):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={configForm.holidaySurchargePercent}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, holidaySurchargePercent: Number(e.target.value) })
                        }
                        className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-bold text-[#9E7A3B]"
                      />
                      <span className="font-bold text-[#1C2321]">% Giá cơ bản</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSavePropertyConfig}
                    className="w-full bg-[#151B17] text-[#FAF8F5] font-bold py-2.5 rounded-xl shadow-md text-xs"
                  >
                    Lưu Cấu Hình Phụ Thu Giá
                  </button>
                </div>
              </div>

              {/* Sample Price Simulation Table */}
              <div className="bg-[#FAF6EE] border border-[#E2D6C3] p-6 rounded-2xl space-y-3">
                <h3 className="font-serif text-lg font-bold text-[#1C2321]">
                  Bảng Giá Minh Họa Sau Phụ Thu
                </h3>

                <div className="space-y-2 text-xs">
                  {roomTypes.map((rt) => {
                    const weekendPrice = Math.round(rt.basePrice * (1 + configForm.weekendSurchargePercent / 100));
                    const holidayPrice = Math.round(rt.basePrice * (1 + configForm.holidaySurchargePercent / 100));

                    return (
                      <div key={rt.id} className="bg-white p-3 rounded-xl border border-[#E0D8CD] space-y-1">
                        <span className="font-bold text-[#1C2321] block">{rt.name}</span>
                        <div className="grid grid-cols-3 text-[11px]">
                          <span>Thường: <strong>{rt.basePrice.toLocaleString()}đ</strong></span>
                          <span className="text-[#9E7A3B]">Cuối tuần: <strong>{weekendPrice.toLocaleString()}đ</strong></span>
                          <span className="text-rose-700">Lễ/Tết: <strong>{holidayPrice.toLocaleString()}đ</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: BÁO CÁO CÔNG SUẤT PHÒNG VÀ DOANH THU */}
        {/* ========================================================================= */}
        {activeTab === 'analytics-reports' && (
          <div className="space-y-6">
            <div className="border-b border-[#E8E2D9] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                FINANCIAL ANALYTICS & OCCUPANCY RATE
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                Báo Cáo Công Suất Phòng & Phân Tích Doanh Thu
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-[#E8E2D9] p-6 rounded-2xl shadow-sm text-center space-y-2">
                <span className="text-xs text-[#706557] uppercase font-bold tracking-wider">Tổng Doanh Thu Dự Kiến</span>
                <div className="font-serif text-3xl font-bold text-[#1C2321]">
                  {totalRevenueEstimated.toLocaleString('vi-VN')} đ
                </div>
                <span className="text-[11px] text-emerald-700 font-semibold block">Tất cả các kênh bán</span>
              </div>

              <div className="bg-white border border-[#E8E2D9] p-6 rounded-2xl shadow-sm text-center space-y-2">
                <span className="text-xs text-[#706557] uppercase font-bold tracking-wider">Tiền Cọc VietQR Đã Thu</span>
                <div className="font-serif text-3xl font-bold text-[#9E7A3B]">
                  {totalDepositCollected.toLocaleString('vi-VN')} đ
                </div>
                <span className="text-[11px] text-[#706557] font-semibold block">Tiền thực thu trong tài khoản</span>
              </div>

              <div className="bg-white border border-[#E8E2D9] p-6 rounded-2xl shadow-sm text-center space-y-2">
                <span className="text-xs text-[#706557] uppercase font-bold tracking-wider">Công Suất Phòng Hiện Tại</span>
                <div className="font-serif text-3xl font-bold text-indigo-900">{occupancyRate}%</div>
                <span className="text-[11px] text-indigo-700 font-semibold block">{occupiedRoomsCount} / 15 căn có khách</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 10: CHỈNH SỬA THÔNG TIN WEBSITE (WEB PROPERTY EDITOR - KHÔNG CẦN CODE) */}
        {/* ========================================================================= */}
        {activeTab === 'web-config' && (
          <div className="space-y-6">
            <div className="border-b border-[#E8E2D9] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C8A261]">
                DIRECT PROPERTY INFO EDITOR (NO CODE REQUIRED)
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1C2321]">
                Chỉnh Sửa Thông Tin Website & Liên Hệ Ngay Trên Giao Diện
              </h2>
              <p className="text-xs text-[#706557]">
                Mọi thông tin bạn thay đổi tại đây sẽ ngay lập tức được cập nhật ngoài trang chủ Website, Header và Modal VietQR.
              </p>
            </div>

            <form onSubmit={handleSavePropertyConfig} className="bg-white border border-[#E8E2D9] p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block font-bold mb-1 text-[#1C2321]">
                    Tên Homestay & Cafe
                  </label>
                  <input
                    type="text"
                    required
                    value={configForm.propertyName}
                    onChange={(e) => setConfigForm({ ...configForm, propertyName: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-[#1C2321]">
                    Hotline / Số Điện Thoại Zalo
                  </label>
                  <input
                    type="text"
                    required
                    value={configForm.hotline}
                    onChange={(e) => setConfigForm({ ...configForm, hotline: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block font-bold mb-1 text-[#1C2321]">
                    Chủ Nhà / Người Liên Hệ
                  </label>
                  <input
                    type="text"
                    value={configForm.ownerName}
                    onChange={(e) => setConfigForm({ ...configForm, ownerName: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-[#1C2321]">
                    Địa Chỉ Homestay
                  </label>
                  <input
                    type="text"
                    value={configForm.address}
                    onChange={(e) => setConfigForm({ ...configForm, address: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-bold"
                  />
                </div>
              </div>

              {/* VietQR Bank Settings */}
              <div className="bg-[#FAF6EE] p-5 rounded-2xl border border-[#E2D6C3] space-y-4">
                <div className="font-serif text-base font-bold text-[#1C2321] flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#C8A261]" />
                  <span>Cấu Hình Ngân Hàng Nhận Cọc VietQR Tự Động</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold mb-1">Tên Ngân Hàng (Tên chuẩn)</label>
                    <input
                      type="text"
                      value={configForm.bankName}
                      onChange={(e) => setConfigForm({ ...configForm, bankName: e.target.value })}
                      className="w-full bg-white border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Số Tài Khoản Nhận Tiền</label>
                    <input
                      type="text"
                      value={configForm.accountNumber}
                      onChange={(e) => setConfigForm({ ...configForm, accountNumber: e.target.value })}
                      className="w-full bg-white border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#9E7A3B]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Tên Chủ Tài Khoản (Không dấu)</label>
                    <input
                      type="text"
                      value={configForm.accountHolder}
                      onChange={(e) => setConfigForm({ ...configForm, accountHolder: e.target.value })}
                      className="w-full bg-white border border-[#E0D8CD] rounded-xl px-3 py-2 text-xs font-bold uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Hero Banner Text */}
              <div>
                <label className="block font-bold mb-1 text-[#1C2321]">Tiêu Đề Lớn Hero Banner</label>
                <input
                  type="text"
                  value={configForm.heroTitle}
                  onChange={(e) => setConfigForm({ ...configForm, heroTitle: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-[#1C2321]">Mô Tả Homestay Ở Hero Banner</label>
                <textarea
                  rows={2}
                  value={configForm.heroDescription}
                  onChange={(e) => setConfigForm({ ...configForm, heroDescription: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-8 py-3 rounded-xl shadow-lg transition-all text-xs flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu Tất Cả Cấu Hình Thông Tin Website</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
