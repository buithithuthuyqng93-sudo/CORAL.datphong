import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Users, Check, Sparkles, MapPin, Phone, ShieldCheck, QrCode, 
  ChevronRight, ChevronLeft, Info, Eye, Maximize2, Coffee, Tv, Bath, Wind, 
  Flame, SlidersHorizontal, CheckCircle2, Star, Waves, Compass
} from 'lucide-react';
import { RoomType, Room, Booking, PropertyConfig } from '../types';

interface GuestBookingEngineProps {
  roomTypes: RoomType[];
  rooms: Room[];
  bookings: Booking[];
  onInitiateBooking: (bookingData: Omit<Booking, 'id' | 'code' | 'createdAt' | 'paymentStatus'>) => Booking;
  onOpenPaymentModal: (booking: Booking, room: Room) => void;
  activeConfirmedBooking?: Booking | null;
  propertyConfig?: PropertyConfig;
}

export const GuestBookingEngine: React.FC<GuestBookingEngineProps> = ({
  roomTypes,
  rooms,
  bookings,
  onInitiateBooking,
  onOpenPaymentModal,
  activeConfirmedBooking,
  propertyConfig,
}) => {
  // Date & Filter states
  const [checkIn, setCheckIn] = useState('2026-08-05');
  const [checkOut, setCheckOut] = useState('2026-08-07');
  const [guestCount, setGuestCount] = useState(2);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Room photo gallery index tracker per room type (typeId -> activeIndex)
  const [activePhotoIndices, setActivePhotoIndices] = useState<Record<string, number>>({});

  // Room details modal / booking drawer state
  const [detailModalRoomType, setDetailModalRoomType] = useState<RoomType | null>(null);
  const [activeDetailPhotoIndex, setActiveDetailPhotoIndex] = useState(0);

  // Booking Form State
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [depositPercent, setDepositPercent] = useState<number>(50); // Default 50%
  const [formError, setFormError] = useState('');

  // Calculate stay duration
  const calculateNights = () => {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diffTime = Math.max(0, d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const nights = calculateNights();

  // Filter available rooms count for each room type
  const getAvailableRoomsCount = (typeId: string) => {
    return rooms.filter((r) => r.roomTypeId === typeId && r.status === 'available').length;
  };

  const getAvailableRoomsList = (typeId: string) => {
    return rooms.filter((r) => r.roomTypeId === typeId && r.status === 'available');
  };

  // Image slider handlers for card
  const handleNextPhoto = (e: React.MouseEvent, typeId: string, totalPhotos: number) => {
    e.stopPropagation();
    setActivePhotoIndices((prev) => {
      const current = prev[typeId] || 0;
      return { ...prev, [typeId]: (current + 1) % totalPhotos };
    });
  };

  const handlePrevPhoto = (e: React.MouseEvent, typeId: string, totalPhotos: number) => {
    e.stopPropagation();
    setActivePhotoIndices((prev) => {
      const current = prev[typeId] || 0;
      return { ...prev, [typeId]: (current - 1 + totalPhotos) % totalPhotos };
    });
  };

  const handleStartBooking = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setFormError('');
  };

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setFormError('Vui lòng điền họ tên và số điện thoại liên hệ.');
      return;
    }

    if (!selectedRoomType) return;

    const availableRooms = getAvailableRoomsList(selectedRoomType.id);
    if (availableRooms.length === 0) {
      setFormError('Rất tiếc, hạng phòng này vừa hết phòng trống trong khoảng thời gian này.');
      return;
    }

    // Pick first available room
    const targetRoom = availableRooms[0];
    const totalPrice = selectedRoomType.basePrice * nights;
    const depositAmount = Math.round((totalPrice * depositPercent) / 100);

    const newBooking = onInitiateBooking({
      customerName,
      customerPhone,
      customerEmail: customerEmail || `${customerPhone}@guest.coral`,
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
  };

  // Category filter matching logic
  const filteredRoomTypes = roomTypes.filter((rt) => {
    if (activeCategoryFilter === 'all') return true;
    if (activeCategoryFilter === 'ocean') return rt.name.toLowerCase().includes('ocean') || rt.description.toLowerCase().includes('biển');
    if (activeCategoryFilter === 'bathtub') return rt.name.toLowerCase().includes('bồn tắm') || rt.description.toLowerCase().includes('bồn tắm');
    if (activeCategoryFilter === 'family') return rt.name.toLowerCase().includes('family') || rt.maxGuests >= 3;
    if (activeCategoryFilter === 'sunset') return rt.name.toLowerCase().includes('sunset') || rt.description.toLowerCase().includes('hoàng hôn');
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2321] pb-24 font-sans">
      {/* 1. HERO RESORT HEADER (La Siesta Luxury Aesthetic) */}
      <section className="relative min-h-[500px] lg:min-h-[580px] flex items-center justify-center overflow-hidden bg-[#151B17]">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/coral_homestay_cafe_hero.jpg"
            alt="Homestay & CAFE CORAL Lý Sơn"
            className="w-full h-full object-cover object-center scale-105 filter brightness-[0.78] contrast-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151B17] via-[#151B17]/50 to-[#151B17]/30"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#151B17_90%)] opacity-70"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-[#FAF8F5]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 bg-[#C8A261]/25 border border-[#C8A261]/50 text-[#E8D0A8] text-[11px] uppercase tracking-[0.25em] font-semibold px-4.5 py-1.5 rounded-full backdrop-blur-md shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-[#C8A261]" />
              Lý Sơn Island • Cliffside Bungalow & Coffee
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-wider text-[#FAF8F5] leading-tight uppercase drop-shadow-md">
              HOMESTAY & CAFE CORAL
            </h1>

            <p className="font-light text-sm sm:text-base text-[#D5CBBF] max-w-2xl mx-auto leading-relaxed drop-shadow-sm">
              Tận hưởng không gian kiến trúc mái vòm độc bản nhô ra vách núi ngắm trọn vẹn bình minh & hoàng hôn đại dương Lý Sơn. Đặt phòng trực tiếp bảo đảm giá tốt nhất và cọc tự động qua VietQR.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#C5B8A8] pt-3">
              <span className="flex items-center gap-1.5 bg-[#151B17]/60 px-3 py-1.5 rounded-full border border-[#2D3931]/80 backdrop-blur-sm">
                <MapPin className="w-4 h-4 text-[#C8A261]" /> Đặc khu Lý Sơn - Quảng Ngãi
              </span>
              <span className="flex items-center gap-1.5 bg-[#151B17]/60 px-3 py-1.5 rounded-full border border-[#2D3931]/80 backdrop-blur-sm">
                <Phone className="w-4 h-4 text-[#C8A261]" /> Hotline / Zalo: <strong className="text-[#FAF8F5]">0868011799 (Mr Thiện)</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-[#151B17]/60 px-3 py-1.5 rounded-full border border-[#2D3931]/80 backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Khóa phòng tức thì 100%
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. FLOATING SEARCH & FILTER BAR (La Siesta Sticky/Floating Style) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/95 backdrop-blur-md border border-[#E8E2D9] rounded-2xl p-5 shadow-2xl shadow-[#151B17]/10"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#706557] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C8A261]" /> Check-In (Nhận phòng)
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-semibold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#706557] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C8A261]" /> Check-Out (Trả phòng)
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-semibold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#706557] mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#C8A261]" /> Số Khách
              </label>
              <select
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-semibold focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
              >
                <option value={1}>1 Khách lớn</option>
                <option value={2}>2 Khách (Cặp đôi)</option>
                <option value={3}>3 Khách</option>
                <option value={4}>4 Khách (Gia đình)</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <div className="bg-[#151B17] text-[#FAF8F5] rounded-xl p-3 text-center border border-[#2D3931]">
                <span className="text-[10px] text-[#B8A99A] uppercase tracking-wider block">Thời gian lưu trú</span>
                <span className="font-serif text-lg font-bold text-[#C8A261]">{nights} Đêm Lãng Mạn</span>
              </div>
            </div>
          </div>

          {/* Quick Room Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pt-4 mt-4 border-t border-[#F0EADF] scrollbar-none">
            <span className="text-[11px] font-bold text-[#8C7E6C] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C8A261]" /> Lọc theo hạng phòng:
            </span>

            {[
              { id: 'all', label: 'Tất cả 15 Căn' },
              { id: 'ocean', label: 'Bungalow View Biển' },
              { id: 'bathtub', label: 'Deluxe Bồn Tắm Panorama' },
              { id: 'family', label: 'Family Dome 2 Giường' },
              { id: 'sunset', label: 'Cliffside Sunset' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveCategoryFilter(filter.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeCategoryFilter === filter.id
                    ? 'bg-[#C8A261] text-[#151B17] shadow-sm font-bold'
                    : 'bg-[#FAF8F5] text-[#52483B] border border-[#E0D8CD] hover:bg-[#F2ECE1]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 3. CONFIRMED BOOKING BANNER (If Paid) */}
      {activeConfirmedBooking && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-[#182B21] via-[#15231B] to-[#151B17] border-2 border-[#C8A261]/60 rounded-2xl p-6 text-[#FAF8F5] shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-[#C8A261] text-[#151B17] text-[10px] font-bold px-3.5 py-1 rounded-bl-xl uppercase tracking-widest">
              Xác Nhận Đặt Phòng
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#E2C799] font-serif text-xl font-bold">
                  <CheckCircle2 className="w-6 h-6 text-[#C8A261]" />
                  <span>XÁC NHẬN CỌC THÀNH CÔNG - CORAL HOMESTAY</span>
                </div>
                <p className="text-xs text-[#D5CBBF] leading-relaxed">
                  Mã Đặt Phòng: <span className="font-mono font-bold text-[#C8A261] text-sm bg-[#151B17] px-2 py-0.5 rounded border border-[#C8A261]/30">{activeConfirmedBooking.code}</span> | 
                  Khách hàng: <strong>{activeConfirmedBooking.customerName}</strong> ({activeConfirmedBooking.customerPhone})
                </p>
                <p className="text-xs text-emerald-300">
                  Phòng <strong>{activeConfirmedBooking.roomNumber}</strong> ({activeConfirmedBooking.roomTypeName}) đã được 
                  <strong className="text-emerald-400"> Khóa Tự Động</strong> trên toàn bộ kênh bán Coral Homestay, Booking.com và Agoda.
                </p>
              </div>

              <div className="bg-[#111613] p-4 rounded-xl border border-[#2A372E] text-xs space-y-1.5 shrink-0">
                <div className="flex justify-between gap-6">
                  <span className="text-[#B8A99A]">Đã thanh toán cọc VietQR:</span>
                  <span className="font-bold text-[#C8A261] text-sm">{activeConfirmedBooking.depositAmount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between gap-6 border-t border-[#232D27] pt-1.5">
                  <span className="text-[#B8A99A]">Thanh toán còn lại khi nhận phòng:</span>
                  <span className="font-bold text-[#FAF8F5]">
                    {(activeConfirmedBooking.totalPrice - activeConfirmedBooking.depositAmount).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 4. RESORT HIGHLIGHTS BANNER */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C8A261]">
            EXCLUSIVELY AT CORAL RESORT LÝ SƠN
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C2321] mt-1">
            Trải Nghiệm Nghỉ Dưỡng Mái Vòm Độc Bản
          </h2>
          <div className="w-12 h-0.5 bg-[#C8A261] mx-auto mt-3"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Waves,
              title: 'Cliffside Ocean View',
              desc: 'Tọa lạc vách núi cao nhô thẳng ra biển, đón gió lộng và hoàng hôn rực rỡ.',
            },
            {
              icon: Bath,
              title: 'Bồn Tắm Panorama',
              desc: 'Thư giãn trong bồn tắm oval sát kính vòm hướng tầm mắt ra đại dương xanh.',
            },
            {
              icon: Compass,
              title: 'Đón Tàu Cảng Lý Sơn',
              desc: 'Hỗ trợ xe rước tận cảng An Vĩnh & tư vấn tour lặn ngắm san hô độc quyền.',
            },
            {
              icon: ShieldCheck,
              title: 'Khóa Phòng Auto VietQR',
              desc: 'Đặt phòng trực tiếp bảo đảm có phòng ngay, đóng lịch tức thì trên Agoda.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#E8E2D9] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-center space-y-2.5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border border-[#E2D6C3] text-[#C8A261] flex items-center justify-center mx-auto">
                <item.icon className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-base font-bold text-[#1C2321]">{item.title}</h3>
              <p className="text-xs text-[#6B5F50] leading-relaxed font-light">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. MAIN ROOMS & SUITES SHOWCASE GRID (La Siesta Inspired) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#E8E2D9] pb-4 mb-8 gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C8A261]">
              DISCOVER OUR ACCOMMODATIONS
            </span>
            <h2 className="font-serif text-3xl font-bold text-[#1C2321]">
              Danh Sách Hạng Phòng & Bungalow
            </h2>
          </div>
          <p className="text-xs text-[#7A6E5F] font-medium italic">
            *Đặt trực tiếp tại website để tiết kiệm 15% so với các kênh đặt phòng OTA
          </p>
        </div>

        <div className="space-y-12">
          {filteredRoomTypes.map((roomType, index) => {
            const availableCount = getAvailableRoomsCount(roomType.id);
            const isAvailable = availableCount > 0;
            const totalPriceForNights = roomType.basePrice * nights;
            const rackPrice = Math.round(roomType.basePrice * 1.18); // Show strikethrough rack rate

            // Photos array for slider
            const photos = roomType.galleryImages && roomType.galleryImages.length > 0 
              ? roomType.galleryImages 
              : [roomType.image];

            const photoIdx = activePhotoIndices[roomType.id] || 0;
            const currentPhoto = photos[photoIdx];

            return (
              <motion.div
                key={roomType.id}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white border border-[#E5DFD5] rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 grid grid-cols-1 lg:grid-cols-12 group"
              >
                {/* Left Photo Showcase with Gallery Slider */}
                <div className="lg:col-span-7 relative bg-[#151B17] min-h-[320px] lg:min-h-[420px] overflow-hidden flex flex-col justify-between">
                  {/* Photo Display */}
                  <img
                    src={currentPhoto}
                    alt={`${roomType.name} - Photo ${photoIdx + 1}`}
                    className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#151B17]/80 via-transparent to-[#151B17]/30"></div>

                  {/* Top Badges */}
                  <div className="relative z-10 p-4 flex items-center justify-between">
                    <span className="bg-[#151B17]/80 backdrop-blur-md text-[#EAE4DC] border border-[#3B473E] text-xs px-3 py-1 rounded-full font-medium tracking-wide">
                      {roomType.size} • {roomType.bedType}
                    </span>

                    {isAvailable ? (
                      <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        Còn {availableCount} căn trống
                      </span>
                    ) : (
                      <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                        Đã Kín Lịch
                      </span>
                    )}
                  </div>

                  {/* Gallery Controls & Thumbnails Hover */}
                  <div className="relative z-10 p-4 flex items-center justify-between">
                    {/* Photo Dots Indicator */}
                    <div className="flex items-center gap-1.5 bg-[#151B17]/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                      {photos.map((_, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePhotoIndices((prev) => ({ ...prev, [roomType.id]: pIdx }));
                          }}
                          className={`w-2 h-2 rounded-full transition-all ${
                            pIdx === photoIdx ? 'bg-[#C8A261] w-5' : 'bg-white/40 hover:bg-white/80'
                          }`}
                        />
                      ))}
                      <span className="text-[10px] text-[#D5CBBF] ml-1 font-mono">
                        {photoIdx + 1}/{photos.length}
                      </span>
                    </div>

                    {/* Prev / Next Arrows */}
                    {photos.length > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handlePrevPhoto(e, roomType.id, photos.length)}
                          className="w-8 h-8 rounded-full bg-[#151B17]/80 border border-white/20 text-white hover:bg-[#C8A261] hover:text-[#151B17] flex items-center justify-center transition-colors"
                          title="Ảnh trước"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleNextPhoto(e, roomType.id, photos.length)}
                          className="w-8 h-8 rounded-full bg-[#151B17]/80 border border-white/20 text-white hover:bg-[#C8A261] hover:text-[#151B17] flex items-center justify-center transition-colors"
                          title="Ảnh tiếp theo"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Info & Pricing Details (Editorial Luxury Style) */}
                <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C8A261] bg-[#FAF6EE] px-2.5 py-0.5 rounded border border-[#E2D6C3]">
                        Bungalow Hướng Biển
                      </span>
                      <span className="text-[11px] text-[#8C7E6C] font-semibold">
                        Sức chứa max: {roomType.maxGuests} Khách
                      </span>
                    </div>

                    <h3 className="font-serif text-2xl font-bold text-[#1C2321] group-hover:text-[#9E7A3B] transition-colors">
                      {roomType.name}
                    </h3>

                    <p className="text-xs sm:text-sm text-[#5B5043] leading-relaxed font-light">
                      {roomType.description}
                    </p>

                    {/* Amenity Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {roomType.amenities.map((amenity, aIdx) => (
                        <span
                          key={aIdx}
                          className="bg-[#FAF8F5] text-[#4A4034] border border-[#E8E2D9] px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1"
                        >
                          <Check className="w-3 h-3 text-[#C8A261]" /> {amenity}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Box & Action Buttons */}
                  <div className="pt-4 border-t border-[#F0EADF] space-y-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#8C7E6C] line-through font-mono">
                            {rackPrice.toLocaleString('vi-VN')} đ
                          </span>
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            Giảm 15% Trực Tiếp
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-serif text-2xl font-bold text-[#1C2321]">
                            {roomType.basePrice.toLocaleString('vi-VN')} đ
                          </span>
                          <span className="text-xs text-[#706557]">/ đêm</span>
                        </div>
                        {nights > 1 && (
                          <p className="text-[11px] text-[#706557] mt-0.5">
                            Tổng {nights} đêm: <strong className="text-[#1C2321]">{totalPriceForNights.toLocaleString('vi-VN')} đ</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setDetailModalRoomType(roomType);
                          setActiveDetailPhotoIndex(0);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl border border-[#C8A261] text-[#9E7A3B] hover:bg-[#FAF6EE] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Xem Chi Tiết</span>
                      </button>

                      <button
                        onClick={() => handleStartBooking(roomType)}
                        disabled={!isAvailable}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                          isAvailable
                            ? 'bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17]'
                            : 'bg-[#E5DFD5] text-[#A39687] cursor-not-allowed shadow-none'
                        }`}
                      >
                        <span>{isAvailable ? 'Đặt Phòng Ngay' : 'Hết Phòng'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 6. ROOM DETAIL MODAL (La Siesta Style Showcase Lightbox) */}
      <AnimatePresence>
        {detailModalRoomType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151B17]/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E8E2D9] text-[#1C2321] rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C8A261]">
                    ACCOMMODATION DETAILS
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#1C2321]">
                    {detailModalRoomType.name}
                  </h3>
                </div>
                <button
                  onClick={() => setDetailModalRoomType(null)}
                  className="w-9 h-9 rounded-full bg-[#FAF8F5] border border-[#E0D8CD] hover:bg-[#151B17] hover:text-white flex items-center justify-center transition-colors text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Photo Lightbox */}
              <div className="space-y-3">
                <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-[#151B17]">
                  <img
                    src={
                      (detailModalRoomType.galleryImages && detailModalRoomType.galleryImages[activeDetailPhotoIndex]) ||
                      detailModalRoomType.image
                    }
                    alt={detailModalRoomType.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-3 py-1 rounded-full font-mono">
                    {activeDetailPhotoIndex + 1} / {(detailModalRoomType.galleryImages?.length || 1)}
                  </div>
                </div>

                {/* Thumbnails */}
                {detailModalRoomType.galleryImages && detailModalRoomType.galleryImages.length > 1 && (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {detailModalRoomType.galleryImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveDetailPhotoIndex(i)}
                        className={`relative w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          activeDetailPhotoIndex === i ? 'border-[#C8A261] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Specs & Description */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="md:col-span-2 space-y-4 text-xs sm:text-sm text-[#52483B] leading-relaxed">
                  <p>{detailModalRoomType.description}</p>

                  <div>
                    <h4 className="font-serif text-base font-bold text-[#1C2321] mb-2">
                      Tiện Nghi & Trang Thiết Bị Nổi Bật:
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {detailModalRoomType.amenities.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-[#1C2321]">
                          <CheckCircle2 className="w-4 h-4 text-[#C8A261] shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#FAF6EE] p-4 rounded-2xl border border-[#E2D6C3] space-y-1 text-xs">
                    <p className="font-bold text-[#1C2321]">Quy định Check-in & Check-out:</p>
                    <p className="text-[#6B5F50]">• Nhận phòng (Check-in): Từ 14:00 | Trả phòng (Check-out): Trước 12:00</p>
                    <p className="text-[#6B5F50]">• Miễn phí đón tại cảng An Vĩnh cho khách đặt trước 24 giờ qua Zalo 0868011799.</p>
                  </div>
                </div>

                {/* Booking Callout */}
                <div className="bg-[#151B17] text-[#FAF8F5] p-6 rounded-2xl border border-[#2D3931] flex flex-col justify-between space-y-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A261] block">
                      GIÁ ƯU ĐÃI TRỰC TIẾP
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="font-serif text-3xl font-bold text-[#FAF8F5]">
                        {detailModalRoomType.basePrice.toLocaleString('vi-VN')} đ
                      </span>
                      <span className="text-xs text-[#B8A99A]">/ đêm</span>
                    </div>
                    <p className="text-xs text-[#D5CBBF] mt-2">
                      Đã bao gồm thuế, phí dịch vụ & cọc VietQR giữ phòng tự động 100%.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const targetType = detailModalRoomType;
                      setDetailModalRoomType(null);
                      handleStartBooking(targetType);
                    }}
                    className="w-full bg-[#C8A261] hover:bg-[#B38E46] text-[#151B17] font-bold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs transition-colors"
                  >
                    <span>Tiến Hành Đặt Căn Phù Hợp</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. BOOKING FORM DRAWER / MODAL */}
      <AnimatePresence>
        {selectedRoomType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151B17]/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E8E2D9] text-[#1C2321] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A261]">
                    DIRECT BOOKING ENGINE
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#1C2321]">
                    Thông Tin Đặt Phòng
                  </h3>
                  <p className="text-xs text-[#706557]">Hạng phòng chọn: <strong className="text-[#1C2321]">{selectedRoomType.name}</strong></p>
                </div>
                <button
                  onClick={() => setSelectedRoomType(null)}
                  className="w-8 h-8 rounded-full bg-[#FAF8F5] border border-[#E0D8CD] hover:bg-[#151B17] hover:text-white flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-xl font-medium">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmitBooking} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#1C2321] font-bold mb-1">
                      Họ và Tên Khách Hàng <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn An"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-medium focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[#1C2321] font-bold mb-1">
                      Số Điện Thoại / Zalo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="0912 xxx xxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-medium focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#1C2321] font-bold mb-1">
                    Email Nhận Xác Nhận (Không bắt buộc)
                  </label>
                  <input
                    type="email"
                    placeholder="khachhang@gmail.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D8CD] rounded-xl px-3.5 py-2.5 text-xs text-[#1C2321] font-medium focus:ring-2 focus:ring-[#C8A261] focus:outline-none"
                  />
                </div>

                {/* Deposit Percentage Picker */}
                <div className="bg-[#FAF6EE] p-4.5 rounded-2xl border border-[#E2D6C3] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1C2321]">Tỷ Lệ Đặt Cọc Giữ Phòng:</span>
                    <span className="text-[#9E7A3B] font-bold text-sm">{depositPercent}% Giá Trị</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[30, 40, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDepositPercent(pct)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                          depositPercent === pct
                            ? 'bg-[#151B17] text-[#FAF8F5] border-[#151B17] shadow-md'
                            : 'bg-white text-[#52483B] border-[#E0D8CD] hover:bg-[#F2ECE1]'
                        }`}
                      >
                        {pct}% {pct === 50 && '(Khuyên dùng)'}
                      </button>
                    ))}
                  </div>

                  {/* Amount breakdown */}
                  <div className="space-y-1.5 pt-2 text-[#52483B] border-t border-[#E2D6C3]">
                    <div className="flex justify-between">
                      <span>Tổng tiền phòng ({nights} đêm):</span>
                      <span className="font-bold text-[#1C2321]">
                        {(selectedRoomType.basePrice * nights).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex justify-between text-[#9E7A3B] font-bold text-sm pt-1 border-t border-[#E2D6C3]">
                      <span>Số tiền cần chuyển cọc qua VietQR:</span>
                      <span>
                        {Math.round((selectedRoomType.basePrice * nights * depositPercent) / 100).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-[11px] text-emerald-800 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Sau khi bấm thanh toán, hệ thống sẽ mở mã VietQR động chính xác. Khi nhận cọc thành công, phòng sẽ tự động khóa kín tức thì trên Agoda & Booking.com.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRoomType(null)}
                    className="px-4 py-2.5 rounded-xl text-[#706557] hover:text-[#1C2321] bg-[#FAF8F5] hover:bg-[#F2ECE1] font-bold border border-[#E0D8CD]"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="bg-[#151B17] hover:bg-[#C8A261] text-[#FAF8F5] hover:text-[#151B17] font-bold px-6 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all"
                  >
                    <span>Thanh Toán Cọc Qua VietQR</span>
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
