import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Maximize2,
  BedDouble,
  Bath,
  Users,
  Wind,
  Check,
  Expand,
  CalendarCheck,
  Phone,
} from 'lucide-react';
import type { PropertyConfig, RoomType, BookingSearchQuery } from '../types';

export function getRoomDetailSlug(room: RoomType): string {
  if (room.slug && room.slug.trim()) {
    return room.slug.trim();
  }
  const normalized = (room.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || room.id;
}

export function findRoomBySlugOrId(roomTypes: RoomType[], param: string): RoomType | undefined {
  if (!param) return undefined;
  const decoded = decodeURIComponent(param).trim().toLowerCase();
  return roomTypes.find((rt) => {
    if (rt.id.toLowerCase() === decoded) return true;
    if (rt.slug && rt.slug.trim().toLowerCase() === decoded) return true;
    return getRoomDetailSlug(rt).toLowerCase() === decoded;
  });
}

function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + days);
  return formatLocalIsoDate(base);
}

interface SeagullRoomDetailPageProps {
  room?: RoomType;
  otherRooms?: RoomType[];
  propertyConfig?: PropertyConfig;
  onBackToRooms: () => void;
  onSelectOtherRoom: (room: RoomType) => void;
  onOpenLightbox: (room: RoomType, startIndex?: number) => void;
  onBookRoom: (query: BookingSearchQuery) => void;
}

export const SeagullRoomDetailPage: React.FC<SeagullRoomDetailPageProps> = ({
  room,
  otherRooms = [],
  propertyConfig,
  onBackToRooms,
  onSelectOtherRoom,
  onOpenLightbox,
  onBookRoom,
}) => {
  const todayIso = formatLocalIsoDate(new Date());
  const [checkIn, setCheckIn] = useState<string>(() => addDaysIso(todayIso, 1));
  const [checkOut, setCheckOut] = useState<string>(() => addDaysIso(todayIso, 3));
  const [adults, setAdults] = useState<number>(() => Math.min(2, Math.max(1, room?.maxGuests || 2)));
  const [children, setChildren] = useState<number>(0);
  const [dateError, setDateError] = useState<string>('');

  // Keep default adult count sensible if user switches between room detail pages
  useEffect(() => {
    if (room?.maxGuests && adults > room.maxGuests) {
      setAdults(Math.max(1, room.maxGuests));
    }
    setDateError('');
  }, [room?.id]);

  if (!room) {
    return (
      <main className="subpage-main">
        <section className="section" style={{ paddingTop: '4.5rem', paddingBottom: '5rem', textAlign: 'center' }}>
          <span className="eyebrow">PHÒNG Ở · SEAGULL LÝ SƠN</span>
          <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', color: '#17384A', marginBottom: '0.75rem' }}>
            Không tìm thấy hạng phòng này
          </h1>
          <p style={{ color: '#60727B', maxWidth: '520px', margin: '0 auto 2rem', lineHeight: 1.65 }}>
            Hạng phòng bạn đang tìm có thể đã được cập nhật hoặc tạm ngưng nhận đặt. Mời bạn xem
            danh sách các hạng phòng hiện có tại Seagull Lý Sơn.
          </p>
          <button type="button" className="button" onClick={onBackToRooms}>
            ← Quay lại danh sách Phòng ở
          </button>
        </section>
      </main>
    );
  }

  const photos = Array.from(
    new Set<string>([room.image, ...(room.galleryImages || [])].map((u) => (u || '').trim()).filter(Boolean))
  );
  const coverPhoto = photos[0] || '';
  const secondaryPhotos = photos.slice(1, 3);
  const extraCount = Math.max(0, photos.length - 3);

  const depositPercent = room.depositPercent ?? 30;
  const maxGuestsLimit = Math.max(room.maxGuests || 2, 1);

  const nights = (() => {
    const d1 = new Date(`${checkIn}T00:00:00`);
    const d2 = new Date(`${checkOut}T00:00:00`);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  })();

  const effectiveNights = nights > 0 ? nights : 1;
  const totalPrice = room.basePrice * effectiveNights;
  const depositAmount = Math.ceil((totalPrice * depositPercent) / 100);
  const remainingAmount = Math.max(0, totalPrice - depositAmount);

  const cleanHotline = (propertyConfig?.hotline || '0868 011 799').split('-')[0].trim();
  const checkInTime = propertyConfig?.checkInTime || '14:00';
  const checkOutTime = propertyConfig?.checkOutTime || '12:00';

  const handleCheckInChange = (nextIn: string) => {
    setCheckIn(nextIn);
    setDateError('');
    if (nextIn && (!checkOut || checkOut <= nextIn)) {
      setCheckOut(addDaysIso(nextIn, 1));
    }
  };

  const handleCheckOutChange = (nextOut: string) => {
    setCheckOut(nextOut);
    setDateError('');
  };

  const handleBookNowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');

    if (!checkIn || !checkOut) {
      setDateError('Vui lòng chọn ngày nhận phòng và ngày trả phòng.');
      return;
    }
    if (checkOut <= checkIn) {
      setDateError('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.');
      return;
    }

    onBookRoom({
      roomTypeId: room.id,
      checkin: checkIn,
      checkout: checkOut,
      adults,
      children,
    });
  };

  const realAmenities = (room.amenities || []).map((a) => String(a || '').trim()).filter(Boolean);
  const realDescription = (room.description || '').trim();

  return (
    <main className="subpage-main room-detail-page" data-room-detail-id={room.id}>
      <div className="section room-detail-container">
        {/* Top Breadcrumb / Back navigation */}
        <div className="room-detail-topbar">
          <button type="button" className="room-detail-back" onClick={onBackToRooms}>
            <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Quay lại Phòng ở</span>
          </button>
          <nav className="room-detail-crumb" aria-label="Đường dẫn trang">
            <span>Phòng ở</span>
            <span aria-hidden="true">/</span>
            <strong>{room.name}</strong>
          </nav>
        </div>

        {/* 1. TOP PHOTO STRIP (Cover + Secondary Photos with Lightbox Zoom) */}
        <section className="room-detail-gallery-wrap" aria-label={`Bộ ảnh ${room.name}`}>
          <div className={`room-detail-gallery ${secondaryPhotos.length > 0 ? 'has-secondary' : 'single-photo'}`}>
            {coverPhoto && (
              <button
                type="button"
                className="room-detail-photo-main"
                onClick={() => onOpenLightbox(room, 0)}
                aria-label={`Phóng to ảnh chính ${room.name}`}
              >
                <img
                  src={coverPhoto}
                  alt={room.name}
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
                <span className="room-detail-zoom-hint">
                  <Expand size={14} aria-hidden="true" />
                  <span>{photos.length > 1 ? `Xem tất cả ${photos.length} ảnh` : 'Phóng to ảnh'}</span>
                </span>
              </button>
            )}

            {secondaryPhotos.length > 0 && (
              <div className="room-detail-photo-side">
                {secondaryPhotos.map((src, idx) => {
                  const photoIndex = idx + 1;
                  const isLastVisible = idx === secondaryPhotos.length - 1;
                  return (
                    <button
                      key={`${src}-${photoIndex}`}
                      type="button"
                      className="room-detail-photo-sub"
                      onClick={() => onOpenLightbox(room, photoIndex)}
                      aria-label={`Phóng to ảnh ${photoIndex + 1} của ${room.name}`}
                    >
                      <img
                        src={src}
                        alt={`${room.name} - Ảnh ${photoIndex + 1}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                      {isLastVisible && extraCount > 0 && (
                        <span className="room-detail-more-overlay">+{extraCount} ảnh</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 2. TITLE + PRICE/NIGHT DIRECTLY UNDER PHOTO STRIP */}
        <header className="room-detail-header">
          <div className="room-detail-title-col">
            <span className="eyebrow">SEAGULL LÝ SƠN · HẠNG PHÒNG</span>
            <h1>{room.name}</h1>
            {room.bedType && <p className="room-detail-bedtype">{room.bedType}</p>}
          </div>

          <div className="room-detail-price-col">
            <div className="room-detail-price-value">
              {room.basePrice.toLocaleString('vi-VN')} đ <small>/ đêm</small>
            </div>
            <div className="room-detail-price-sub">
              Đặt cọc giữ phòng {depositPercent}% qua VietQR tự động
            </div>
          </div>
        </header>

        {/* 3. ICON SPECS ROW (Area · Bedrooms · Bathrooms · Max Guests · Balcony) */}
        <section className="room-detail-specs-bar" aria-label="Thông số hạng phòng">
          {room.size && (
            <div className="room-spec-item">
              <Maximize2 size={18} strokeWidth={1.9} aria-hidden="true" />
              <div>
                <span className="room-spec-label">Diện tích</span>
                <strong>{room.size}</strong>
              </div>
            </div>
          )}

          {typeof room.bedrooms === 'number' && (
            <div className="room-spec-item">
              <BedDouble size={18} strokeWidth={1.9} aria-hidden="true" />
              <div>
                <span className="room-spec-label">Phòng ngủ</span>
                <strong>{room.bedrooms} phòng ngủ</strong>
              </div>
            </div>
          )}

          {typeof room.bathrooms === 'number' && (
            <div className="room-spec-item">
              <Bath size={18} strokeWidth={1.9} aria-hidden="true" />
              <div>
                <span className="room-spec-label">Phòng tắm</span>
                <strong>{room.bathrooms} phòng tắm</strong>
              </div>
            </div>
          )}

          {typeof room.maxGuests === 'number' && (
            <div className="room-spec-item">
              <Users size={18} strokeWidth={1.9} aria-hidden="true" />
              <div>
                <span className="room-spec-label">Sức chứa</span>
                <strong>Tối đa {room.maxGuests} khách</strong>
              </div>
            </div>
          )}

          {typeof room.hasBalcony === 'boolean' && (
            <div className="room-spec-item">
              <Wind size={18} strokeWidth={1.9} aria-hidden="true" />
              <div>
                <span className="room-spec-label">Ban công</span>
                <strong>{room.hasBalcony ? 'Có ban công' : 'Không ban công'}</strong>
              </div>
            </div>
          )}
        </section>

        {/* 4. TWO-COLUMN MAIN BODY: DESCRIPTION & AMENITIES (LEFT) + STICKY BOOKING BOX (RIGHT) */}
        <div className="room-detail-body-grid">
          <div className="room-detail-main-col">
            {/* Description (Strictly authentic data from RoomType) */}
            {realDescription && (
              <section className="room-detail-block">
                <h2>Mô tả</h2>
                <p className="room-detail-description">{realDescription}</p>
              </section>
            )}

            {/* Amenities Checklist (Strictly authentic data from RoomType) */}
            {realAmenities.length > 0 && (
              <section className="room-detail-block">
                <h2>Tiện nghi phòng</h2>
                <ul className="room-amenities-checklist">
                  {realAmenities.map((amenity, idx) => (
                    <li key={idx}>
                      <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                      <span>{amenity}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Factual Stay Info (from propertyConfig) */}
            <section className="room-detail-block room-detail-policy-strip">
              <h2>Thông tin nhận &amp; trả phòng</h2>
              <div className="room-policy-grid">
                <div>
                  <span className="room-spec-label">Giờ nhận phòng</span>
                  <strong>Từ {checkInTime}</strong>
                </div>
                <div>
                  <span className="room-spec-label">Giờ trả phòng</span>
                  <strong>Trước {checkOutTime}</strong>
                </div>
                <div>
                  <span className="room-spec-label">Đặt cọc trực tuyến</span>
                  <strong>{depositPercent}% tổng tiền phòng</strong>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT STICKY BOOKING CARD */}
          <aside className="room-detail-sticky-col" aria-label="Khung đặt phòng nhanh">
            <form className="room-booking-card" onSubmit={handleBookNowSubmit} noValidate>
              <div className="room-booking-card-head">
                <div>
                  <span className="room-booking-rate">
                    {room.basePrice.toLocaleString('vi-VN')} đ
                  </span>
                  <span className="room-booking-per"> / đêm</span>
                </div>
                <span className="room-booking-nights-label">
                  {nights > 0 ? `${nights} đêm` : 'Chọn ngày'}
                </span>
              </div>

              <div className="room-booking-fields">
                <div className="room-booking-date-row">
                  <div className="room-booking-field">
                    <label htmlFor="detailCheckIn">Ngày nhận phòng</label>
                    <input
                      id="detailCheckIn"
                      name="checkin"
                      type="date"
                      min={todayIso}
                      value={checkIn}
                      onChange={(e) => handleCheckInChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="room-booking-field">
                    <label htmlFor="detailCheckOut">Ngày trả phòng</label>
                    <input
                      id="detailCheckOut"
                      name="checkout"
                      type="date"
                      min={checkIn ? addDaysIso(checkIn, 1) : addDaysIso(todayIso, 1)}
                      value={checkOut}
                      onChange={(e) => handleCheckOutChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="room-booking-date-row">
                  <div className="room-booking-field">
                    <label htmlFor="detailAdults">Người lớn</label>
                    <select
                      id="detailAdults"
                      name="adults"
                      value={adults}
                      onChange={(e) => setAdults(Number(e.target.value))}
                    >
                      {Array.from({ length: Math.max(maxGuestsLimit, 4) }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} người lớn
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="room-booking-field">
                    <label htmlFor="detailChildren">Trẻ em</label>
                    <select
                      id="detailChildren"
                      name="children"
                      value={children}
                      onChange={(e) => setChildren(Number(e.target.value))}
                    >
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n} trẻ em
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {dateError && (
                <p className="room-booking-error" role="alert">
                  {dateError}
                </p>
              )}

              {/* Price & Deposit Breakdown */}
              <div className="room-booking-breakdown">
                <div className="room-booking-row">
                  <span>
                    {room.basePrice.toLocaleString('vi-VN')} đ × {effectiveNights} đêm
                  </span>
                  <strong>{totalPrice.toLocaleString('vi-VN')} đ</strong>
                </div>
                <div className="room-booking-row is-deposit">
                  <span>Tiền cọc giữ phòng ({depositPercent}%)</span>
                  <strong>{depositAmount.toLocaleString('vi-VN')} đ</strong>
                </div>
                <div className="room-booking-row is-muted">
                  <span>Thanh toán khi nhận phòng ({100 - depositPercent}%)</span>
                  <span>{remainingAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <button type="submit" className="room-booking-submit">
                <CalendarCheck size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>Đặt phòng ngay</span>
              </button>

              <div className="room-booking-support">
                <Phone size={13} aria-hidden="true" />
                <span>
                  Cần tư vấn nhanh? Gọi <a href="tel:0868011799">{cleanHotline}</a>
                </span>
              </div>
            </form>
          </aside>
        </div>

        {/* 5. OTHER REAL ROOM TYPES (Same unified roomTypes source) */}
        {otherRooms.length > 0 && (
          <section className="room-detail-others" aria-label="Các hạng phòng khác">
            <div className="room-detail-others-head">
              <h2>Các hạng phòng khác tại Seagull</h2>
              <button type="button" className="room-detail-back" onClick={onBackToRooms}>
                Xem tất cả phòng →
              </button>
            </div>
            <div className="room-detail-others-grid">
              {otherRooms.slice(0, 3).map((other) => (
                <article key={other.id} className="room-other-card">
                  <button
                    type="button"
                    className="room-other-thumb"
                    onClick={() => onSelectOtherRoom(other)}
                    aria-label={`Xem chi tiết ${other.name}`}
                  >
                    <img
                      src={other.image}
                      alt={other.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                  <div className="room-other-body">
                    <h3>{other.name}</h3>
                    <div className="room-other-price">
                      {other.basePrice.toLocaleString('vi-VN')} đ <small>/ đêm</small>
                    </div>
                    <button
                      type="button"
                      className="service-consult-link"
                      onClick={() => onSelectOtherRoom(other)}
                    >
                      <span>Xem chi tiết</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
