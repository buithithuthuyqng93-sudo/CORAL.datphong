import React from 'react';
import { ArrowRight, ArrowLeft, RefreshCw, QrCode, Globe, ShieldCheck, Database, Smartphone, CheckCircle2, Lock } from 'lucide-react';

export const ArchitectureDiagram: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-2">
        <h2 className="text-2xl font-extrabold text-white">Sơ Đồ Kiến Trúc Luồng Hoạt Động Hệ Thống Trọn Bộ</h2>
        <p className="text-xs text-slate-400">
          Giải thích cơ chế vận hành tự động từ lúc Khách bấm cọc VietQR cho đến khi Khóa phòng trên Booking.com & Agoda
        </p>
      </div>

      {/* Visual Flow Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
        {/* Step 1 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 relative">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-xs border border-teal-500/30">
            01
          </div>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Globe className="w-4 h-4 text-teal-400" />
            <span>Website Direct (Thuỷ)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Khách truy cập website Homestay & Cà Phê Seagull, chọn ngày, chọn loại phòng trong 27 phòng, hệ thống tự tính 30% tiền cọc.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-teal-300 font-mono">
            Output: Mã Đặt Phòng SGL-8921 + Số Tiền Cọc 30%
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 relative">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
            02
          </div>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Cổng VietQR Webhook</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Mã QR hiển thị chuẩn VietQR. Khách mở App Ngân hàng quét thanh toán. Cổng SePAY/Casso tự nhận diện biến động số dư.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-emerald-300 font-mono">
            Webhook Event: Paid = True (3 giây)
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 relative">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs border border-indigo-500/30">
            03
          </div>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>PMS Core Lễ Tân</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Hệ thống nhận biến động cọc, tự động cập nhật trạng thái phòng trên sơ đồ 27 phòng từ [Trống] sang [Đã Đặt Cọc Direct].
          </p>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-indigo-300 font-mono">
            Room Status: LOCKED in PMS
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 relative">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs border border-amber-500/30">
            04
          </div>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>Channel Manager OTA</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Gửi lệnh API tới Booking.com XML & Agoda YCS API, khóa ngay lập tức phòng tương ứng để ngăn chặn Overbooking 100%.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-amber-300 font-mono">
            OTA Status: CLOSED / ZERO INV
          </div>
        </div>
      </div>

      {/* 2-Way Flow Explanation */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950/30 to-slate-900 p-6 rounded-2xl border border-teal-500/30 space-y-3">
        <div className="flex items-center gap-2 text-teal-300 font-bold text-sm">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          <span>Chiều Ngược Lại (Khi Khách Đặt Qua Booking.com hoặc Agoda):</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Khi có khách tây hoặc khách vần đặt phòng trên Booking.com / Agoda, Channel Manager tự bắt tín hiệu đẩy về PMS Lễ Tân trong vòng <strong>2 giây</strong>, tự động khóa phòng đó trên Website trực tiếp của Seagull Homestay để không ai đặt trùng được.
        </p>
      </div>
    </div>
  );
};
