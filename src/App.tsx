import React, { useState } from 'react';
import { Header } from './components/Header';
import { GuestBookingEngine } from './components/GuestBookingEngine';
import { PmsAndChannelManager } from './components/PmsAndChannelManager';
import { AdminManager } from './components/AdminManager';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { VietQRModal } from './components/VietQRModal';

import { Room, RoomType, Booking, ChannelSyncLog, PropertyConfig } from './types';
import { INITIAL_ROOMS, INITIAL_BOOKINGS, INITIAL_SYNC_LOGS, CORAL_ROOM_TYPES, INITIAL_PROPERTY_CONFIG } from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState<'guest-website' | 'pms-channel' | 'admin-manager' | 'architecture'>('guest-website');

  // Core App State
  const [propertyConfig, setPropertyConfig] = useState<PropertyConfig>(INITIAL_PROPERTY_CONFIG);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(CORAL_ROOM_TYPES);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [syncLogs, setSyncLogs] = useState<ChannelSyncLog[]>(INITIAL_SYNC_LOGS);

  // Security Auth Lock State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(true);

  // Modal payment state
  const [paymentModalState, setPaymentModalState] = useState<{
    booking: Booking;
    room: Room;
  } | null>(null);

  // Active confirmed booking to show success banner on Guest Website
  const [activeConfirmedBooking, setActiveConfirmedBooking] = useState<Booking | null>(null);

  // Tab switcher with admin lock guard
  const handleSelectTab = (tab: 'guest-website' | 'pms-channel' | 'admin-manager' | 'architecture') => {
    setActiveTab(tab);
  };

  // Initiate a new booking draft
  const handleInitiateBooking = (bookingData: Omit<Booking, 'id' | 'code' | 'createdAt' | 'paymentStatus'>): Booking => {
    const bookingCode = `CRL-${Math.floor(1000 + Math.random() * 9000)}`;
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

    // 4. Set active confirmed booking for guest view banner
    setActiveConfirmedBooking(updatedBooking);

    // 5. Close modal
    setPaymentModalState(null);
  };

  // Simulate an incoming OTA booking (from Booking.com or Agoda)
  const handleSimulateOtaBooking = (channel: 'booking.com' | 'agoda') => {
    // Find first available room
    const availableRoom = rooms.find((r) => r.status === 'available');
    if (!availableRoom) {
      alert('Tất cả 15 phòng của Coral Homestay đều đã kín lịch!');
      return;
    }

    const roomType = roomTypes.find((t) => t.id === availableRoom.roomTypeId);
    const roomTypeName = roomType ? roomType.name : 'Phòng Tiêu Chuẩn';
    const channelName = channel === 'booking.com' ? 'Booking.com' : 'Agoda';
    const statusType = channel === 'booking.com' ? 'booked_booking' : 'booked_agoda';

    const bookingCode = channel === 'booking.com' ? `BKG-${Math.floor(1000 + Math.random() * 9000)}` : `AGD-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowStr = new Date().toLocaleTimeString('vi-VN');

    // 1. Update room status
    setRooms((prev) =>
      prev.map((r) => (r.id === availableRoom.id ? { ...r, status: statusType } : r))
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

  // Reset all 15 rooms to available
  const handleResetAllRooms = () => {
    setRooms((prev) => prev.map((r) => ({ ...r, status: 'available', currentBookingId: undefined })));
    setSyncLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        channel: 'PMS Local',
        action: 'Reset toàn bộ sơ đồ 15 phòng',
        roomNumber: 'Tất cả',
        status: 'synced',
        details: 'Đã mở lại toàn bộ 15 phòng trên Website, Booking.com và Agoda.',
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-teal-500 selection:text-slate-950">
      <Header
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        bookingCount={bookings.length}
        propertyConfig={propertyConfig}
        isAuthenticated={isAdminAuthenticated}
      />

      <main className="animate-fadeIn">
        {activeTab === 'guest-website' && (
          <GuestBookingEngine
            roomTypes={roomTypes}
            rooms={rooms}
            bookings={bookings}
            onInitiateBooking={handleInitiateBooking}
            onOpenPaymentModal={handleOpenPaymentModal}
            activeConfirmedBooking={activeConfirmedBooking}
            propertyConfig={propertyConfig}
          />
        )}

        {activeTab === 'pms-channel' && (
          <PmsAndChannelManager
            roomTypes={roomTypes}
            rooms={rooms}
            bookings={bookings}
            syncLogs={syncLogs}
            onSimulateOtaBooking={handleSimulateOtaBooking}
            onResetAllRooms={handleResetAllRooms}
          />
        )}

        {activeTab === 'admin-manager' && (
          <AdminManager
            roomTypes={roomTypes}
            rooms={rooms}
            bookings={bookings}
            propertyConfig={propertyConfig}
            syncLogs={syncLogs}
            onUpdateRoomTypes={setRoomTypes}
            onUpdateRooms={setRooms}
            onUpdateBookings={setBookings}
            onUpdatePropertyConfig={setPropertyConfig}
            isAuthenticated={isAdminAuthenticated}
            onAuthenticate={setIsAdminAuthenticated}
          />
        )}

        {activeTab === 'architecture' && <ArchitectureDiagram />}
      </main>

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
    </div>
  );
}
