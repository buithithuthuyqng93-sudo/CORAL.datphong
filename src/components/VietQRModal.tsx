import React, { useState, useEffect } from 'react';
import { X, QrCode, Copy, CheckCircle2, ShieldCheck, ArrowRight, Loader2, Clock, Sparkles } from 'lucide-react';
import { Booking, Room, PropertyConfig } from '../types';

interface VietQRModalProps {
  booking: Booking;
  room: Room;
  onClose: () => void;
  onConfirmPayment: (bookingId: string) => void;
  propertyConfig?: PropertyConfig;
}

export const VietQRModal: React.FC<VietQRModalProps> = ({
  booking,
  room,
  onClose,
  onConfirmPayment,
  propertyConfig,
}) => {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [isSimulatingBank, setIsSimulatingBank] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(600); // 10 minutes countdown

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const bankInfo = {
    bankName: propertyConfig?.bankName || 'MBBank (Ngân Hàng Quân Đội)',
    bankBin: propertyConfig?.bankBin || '970422',
    accountNumber: propertyConfig?.accountNumber || '0868011799',
    accountHolder: propertyConfig?.accountHolder || 'CORAL HOMESTAY - BUI THI THU THUY',
  };

  // VietQR Quick Link URL
  const qrUrl = `https://img.vietqr.io/image/${bankInfo.bankBin}-${bankInfo.accountNumber}-compact2.png?amount=${booking.depositAmount}&addInfo=${encodeURIComponent(booking.code)}&accountName=${encodeURIComponent(bankInfo.accountHolder)}`;

  const handleCopy = (text: string, type: 'account' | 'content') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  const handleSimulateAutoBankConfirm = () => {
    setIsSimulatingBank(true);
    setTimeout(() => {
      setIsSimulatingBank(false);
      onConfirmPayment(booking.id);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151B17]/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-[#E8E2D9] text-[#1C2321] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#151B17] text-[#FAF8F5] px-6 py-4 border-b border-[#2D3931] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C8A261] text-[#151B17] flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A261] block">
                CORAL RESORT LÝ SƠN
              </span>
              <h3 className="font-serif text-lg font-bold text-[#FAF8F5]">Thanh Toán Cọc Giữ Phòng</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#D5CBBF] hover:text-white p-1.5 rounded-full hover:bg-[#253029] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#52483B]">
          {/* Summary Box */}
          <div className="bg-[#FAF6EE] rounded-2xl p-4 border border-[#E2D6C3] space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#706557]">Căn đã chọn:</span>
              <span className="font-bold text-[#1C2321]">Phòng {booking.roomNumber} ({booking.roomTypeName})</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#706557]">Thời gian lưu trú:</span>
              <span className="font-semibold text-[#1C2321]">{booking.checkIn} đến {booking.checkOut} ({booking.nights} đêm)</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-[#E2D6C3] pt-2">
              <span className="text-[#706557]">Tổng tiền phòng:</span>
              <span className="font-medium text-[#1C2321]">{booking.totalPrice.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-[#1C2321] border-t border-[#E2D6C3] pt-2">
              <span className="text-[#9E7A3B] flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> Tiền cọc VietQR ({booking.depositPercent}%):
              </span>
              <span className="text-[#9E7A3B] text-base font-serif">{booking.depositAmount.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          {/* Countdown & Auto Confirm Notice */}
          <div className="bg-[#151B17] text-[#FAF8F5] border border-[#2D3931] rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C8A261] animate-pulse" />
              <span className="text-[#D5CBBF] font-medium">Hệ thống giữ vị trí phòng trong:</span>
            </div>
            <span className="font-mono font-bold text-[#C8A261] text-sm bg-[#253029] px-3 py-1 rounded-lg border border-[#C8A261]/30">
              {formatTime(countdownSeconds)}
            </span>
          </div>

          {/* VietQR Image & Transfer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-[#FAF8F5] p-4 rounded-2xl border border-[#E0D8CD]">
            {/* QR Image */}
            <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-[#E8E2D9]">
              <img
                src={qrUrl}
                alt="VietQR Payment"
                className="w-44 h-44 object-contain rounded-md"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-[10px] text-[#706557] mt-1.5 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Quét bằng App Banking bất kỳ
              </span>
            </div>

            {/* Transfer Details */}
            <div className="space-y-2.5 text-xs">
              <div>
                <p className="text-[10px] text-[#8C7E6C] uppercase font-bold tracking-wider">Ngân hàng:</p>
                <p className="font-bold text-[#1C2321]">{bankInfo.bankName}</p>
              </div>

              <div>
                <p className="text-[10px] text-[#8C7E6C] uppercase font-bold tracking-wider">Chủ tài khoản:</p>
                <p className="font-bold text-[#9E7A3B]">{bankInfo.accountHolder}</p>
              </div>

              <div>
                <p className="text-[10px] text-[#8C7E6C] uppercase font-bold tracking-wider">Số tài khoản:</p>
                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-[#E0D8CD]">
                  <span className="font-mono font-bold text-[#1C2321]">{bankInfo.accountNumber}</span>
                  <button
                    onClick={() => handleCopy(bankInfo.accountNumber, 'account')}
                    className="text-[#706557] hover:text-[#1C2321] p-1"
                    title="Sao chép STK"
                  >
                    {copiedAccount ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-[#8C7E6C] uppercase font-bold tracking-wider">Nội dung chuyển cọc chuẩn:</p>
                <div className="flex items-center justify-between bg-[#FAF6EE] p-2 rounded-lg border border-[#E2D6C3]">
                  <span className="font-mono font-bold text-[#9E7A3B]">{booking.code}</span>
                  <button
                    onClick={() => handleCopy(booking.code, 'content')}
                    className="text-[#9E7A3B] hover:text-[#1C2321] p-1"
                    title="Sao chép nội dung"
                  >
                    {copiedContent ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Explanation of VietQR Webhook */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cơ chế Tự Động Khóa Lịch (VietQR Auto Webhook)</span>
            </div>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              Ngay khi tiền cọc <strong className="text-emerald-950">{booking.depositAmount.toLocaleString('vi-VN')}đ</strong> chuyển thành công với cú pháp <span className="font-mono font-bold">{booking.code}</span>, hệ thống sẽ chốt đơn và đóng lịch lập tức trên Booking.com & Agoda.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#FAF8F5] px-6 py-4 border-t border-[#E8E2D9] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-[#706557] hover:text-[#1C2321] bg-white border border-[#E0D8CD] font-bold"
          >
            Đóng / Đặt Sau
          </button>

          <button
            onClick={handleSimulateAutoBankConfirm}
            disabled={isSimulatingBank}
            className="w-full sm:w-auto flex-1 bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-5 py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition text-xs"
          >
            {isSimulatingBank ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#C8A261]" />
                <span>Ngân Hàng Đang Bắt Webhook & Đóng Phòng OTA...</span>
              </>
            ) : (
              <>
                <span>Mô Phỏng Đã Chuyển Tiền Cọc (Auto Webhook)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
