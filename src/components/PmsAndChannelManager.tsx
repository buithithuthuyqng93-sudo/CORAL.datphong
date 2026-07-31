import React, { useState } from 'react';
import { LayoutGrid, RefreshCw, Lock, CheckCircle2, AlertCircle, Globe, Smartphone, Shield, Zap, Sparkles, Plus, Trash2 } from 'lucide-react';
import { Room, Booking, ChannelSyncLog, RoomStatus, RoomType } from '../types';

interface PmsAndChannelManagerProps {
  roomTypes: RoomType[];
  rooms: Room[];
  bookings: Booking[];
  syncLogs: ChannelSyncLog[];
  onSimulateOtaBooking: (channel: 'booking.com' | 'agoda') => void;
  onResetAllRooms: () => void;
}

export const PmsAndChannelManager: React.FC<PmsAndChannelManagerProps> = ({
  roomTypes,
  rooms,
  bookings,
  syncLogs,
  onSimulateOtaBooking,
  onResetAllRooms,
}) => {
  const [activeFloorFilter, setActiveFloorFilter] = useState<number | 'all'>('all');

  const filteredRooms = activeFloorFilter === 'all' 
    ? rooms 
    : rooms.filter((r) => r.floor === activeFloorFilter);

  const getStatusBadge = (status: RoomStatus) => {
    switch (status) {
      case 'available':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
          dot: 'bg-emerald-400',
          label: 'Phòng Trống',
        };
      case 'booked_direct':
        return {
          bg: 'bg-teal-500/20 border-teal-500/40 text-teal-200',
          dot: 'bg-teal-400',
          label: 'Cọc Direct (Website)',
        };
      case 'booked_booking':
        return {
          bg: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
          dot: 'bg-indigo-400',
          label: 'Locked Booking.com',
        };
      case 'booked_agoda':
        return {
          bg: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
          dot: 'bg-amber-400',
          label: 'Locked Agoda',
        };
      default:
        return {
          bg: 'bg-slate-800 border-slate-700 text-slate-400',
          dot: 'bg-slate-500',
          label: 'Đang Bảo Trì',
        };
    }
  };

  const getRoomTypeName = (typeId: string) => {
    return roomTypes.find((t) => t.id === typeId)?.name || 'Hạng phòng';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Title Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-teal-950 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs px-3 py-1 rounded-full font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>PMS & Channel Manager 2-Way Sync Engine</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">Quản Lý Sơ Đồ 15 Phòng Coral Homestay</h2>
          <p className="text-xs text-slate-400 mt-1">
            Đồng bộ 2 chiều tức thì giữa Website Direct, Booking.com & Agoda. Phòng đã cọc hoặc đặt qua OTA tự động đóng trên tất cả các kênh trong vòng 2 giây.
          </p>
        </div>

        {/* Action Controls for Demo */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSimulateOtaBooking('booking.com')}
            className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Giả Lập Booking Từ Booking.com
          </button>

          <button
            onClick={() => onSimulateOtaBooking('agoda')}
            className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Giả Lập Booking Từ Agoda
          </button>

          <button
            onClick={onResetAllRooms}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 border border-slate-700"
            title="Mở lại toàn bộ 15 phòng"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Sơ Đồ
          </button>
        </div>
      </div>

      {/* Room Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400">Phòng Trống (Available)</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">
              {rooms.filter((r) => r.status === 'available').length}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400">Cọc Website Direct</p>
            <p className="text-2xl font-extrabold text-teal-300 mt-1">
              {rooms.filter((r) => r.status === 'booked_direct').length}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-teal-400"></div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400">Đã Khóa Booking.com</p>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">
              {rooms.filter((r) => r.status === 'booked_booking').length}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400">Đã Khóa Agoda</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-1">
              {rooms.filter((r) => r.status === 'booked_agoda').length}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
        </div>
      </div>

      {/* Main 15 Room Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-base text-white">Sơ Đồ Lưới 15 Phòng Thật (Live Grid)</h3>
          </div>

          {/* Floor filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveFloorFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeFloorFilter === 'all' ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả 15 phòng
            </button>
            <button
              onClick={() => setActiveFloorFilter(1)}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeFloorFilter === 1 ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tầng 1 (Studio)
            </button>
            <button
              onClick={() => setActiveFloorFilter(2)}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeFloorFilter === 2 ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tầng 2 (Deluxe)
            </button>
            <button
              onClick={() => setActiveFloorFilter(3)}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeFloorFilter === 3 ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tầng 3 & Sân Vườn
            </button>
          </div>
        </div>

        {/* Room Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {filteredRooms.map((room) => {
            const statusInfo = getStatusBadge(room.status);
            const isBooked = room.status !== 'available';

            return (
              <div
                key={room.id}
                className={`p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${statusInfo.bg}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-black text-white">Phòng {room.number}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.dot}`}></span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-300 line-clamp-1">
                    {getRoomTypeName(room.roomTypeId)}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-700/40 text-[10px] space-y-1">
                  <span className="font-semibold block">{statusInfo.label}</span>
                  {isBooked ? (
                    <span className="text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" /> Tự động khóa 2-way OTA
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đang sẵn sàng đón khách
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Channel Sync Stream Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-teal-400 animate-spin" />
              <h3 className="font-bold text-base text-white">Nhật Ký Đồng Bộ Realtime (Channel Manager Stream)</h3>
            </div>
            <span className="text-[11px] text-teal-400 font-mono">2-Way Sync Protocol Active</span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 text-xs">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-300">Phòng {log.roomNumber}</span>
                    <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      {log.channel}
                    </span>
                    <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-200 font-medium">{log.action}</p>
                  <p className="text-slate-400 text-[11px]">{log.details}</p>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
                  Synced ✓
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Way Channel Matrix Status */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-base text-white">Trạng Thái Hiển Thị Trên Các Kênh</h3>
            <p className="text-xs text-slate-400">Kiểm tra đồng bộ phòng trên Website, Booking.com & Agoda</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-teal-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-teal-400" /> Website Coral Homestay (Direct)
                </span>
                <span className="text-emerald-400 font-bold">100% Khóa Tức Thì</span>
              </div>
              <p className="text-slate-400 text-[11px]">Cập nhật ngay lập tức khi khách bấm cọc VietQR.</p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-400" /> Booking.com OTA Channel
                </span>
                <span className="text-emerald-400 font-bold">Đã Kết Nối XML/iCal</span>
              </div>
              <p className="text-slate-400 text-[11px]">Đồng bộ tồn phòng (Inventory) & giá phòng tự động 2 chiều.</p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-amber-400" /> Agoda YCS Channel
                </span>
                <span className="text-emerald-400 font-bold">Đã Kết Nối XML/iCal</span>
              </div>
              <p className="text-slate-400 text-[11px]">Đồng bộ đặt phòng và khóa phòng tránh trùng lịch 100%.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
