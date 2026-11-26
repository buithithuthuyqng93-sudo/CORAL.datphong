import React, { useState, useEffect } from 'react';
import { Ship, Bike, Wifi } from 'lucide-react';
import type { PropertyConfig, CmsContentItem } from '../types';
import { EXPERIENCE_SERVICES_SEED, UTILITY_SERVICES } from '../data/serviceCatalog';
import { apiListCmsContent } from '../services/dataAdapter';

export type WebsiteSubPage = 'home' | 'about' | 'services' | 'contact' | 'room-detail';

interface SubPageCommonProps {
  propertyConfig?: PropertyConfig;
  serviceItems?: CmsContentItem[];
  onUpdateServiceItems?: (items: CmsContentItem[]) => void;
  onNavigatePage: (page: WebsiteSubPage, anchorId?: string) => void;
  onNavigateToBooking?: (roomTypeId?: string) => void;
}

const GOOGLE_MAPS_EMBED_URL = 'https://maps.google.com/maps?cid=3047062392967181604&output=embed';
const GOOGLE_MAPS_SHARE_URL = 'https://maps.app.goo.gl/yaYH56pM37VPbjnv7';

// ============================================================================
// 1. TRANG GIỚI THIỆU (/gioi-thieu)
// ============================================================================
export const SeagullAboutPage: React.FC<SubPageCommonProps> = ({
  propertyConfig,
  onNavigatePage,
  onNavigateToBooking,
}) => {
  const address =
    propertyConfig?.address ||
    'Thôn Đông An Vĩnh, Đặc khu Lý Sơn, Tỉnh Quảng Ngãi (Thửa 432, Tờ bản đồ số 27)';

  return (
    <main className="subpage-main">
      {/* Editorial Intro Header */}
      <section className="subpage-hero">
        <div className="subpage-hero-media">
          <img
            src="/assets/lyson-harbor-real.jpg"
            alt="Góc nhìn thực tế từ Seagull Coffee & Homestay ra bến cảng Lý Sơn"
            style={{ objectPosition: 'center 35%' }}
            referrerPolicy="no-referrer"
          />
          <div className="subpage-hero-shade" />
        </div>
        <div className="subpage-hero-inner">
          <span className="eyebrow" style={{ color: '#E6D5B4' }}>
            GIỚI THIỆU · SEAGULL LÝ SƠN
          </span>
          <h1>Seagull Coffee &amp; Homestay Lý Sơn</h1>
          <p>
            Một khoảng bình yên giữa đảo ngọc — nơi kỳ nghỉ ven biển hòa cùng nhịp sống chậm rãi
            bên tách cà phê sáng nhìn ra bến cảng Lý Sơn.
          </p>
        </div>
      </section>

      {/* Brand Story */}
      <section className="section">
        <div className="about-story-grid">
          <div className="about-story-copy">
            <span className="eyebrow">01 / CÂU CHUYỆN THƯƠNG HIỆU</span>
            <h2>Nơi chữa lành tâm hồn bạn giữa biển trời Lý Sơn.</h2>
            <p>
              Tọa lạc tại <strong>{address}</strong>, Seagull Lý Sơn được hình thành từ mong muốn
              tạo nên một điểm dừng chân thật sự ấm áp và gần gũi với thiên nhiên đảo núi lửa.
              Những căn bungalow mái vòm gỗ nép mình bên vách đá bazan, mở rộng tầm mắt ra mặt
              biển An Vĩnh trong xanh và tiếng sóng vỗ dịu êm mỗi sớm mai.
            </p>
            <p>
              Tại Seagull, lưu trú và cà phê là hai nhịp thở gắn liền nhau: buổi sáng thức dậy
              đón gió biển ngay ban công riêng, ngồi nhâm nhi tách cà phê nhìn tàu thuyền cập bến
              cảng, và chiều xuống thả mình trên bãi biển san hô ngay dưới chân đồi.
            </p>
            <div className="about-meta-line">
              <span>27 căn phòng vận hành</span>
              <span aria-hidden="true">·</span>
              <span>Không gian Cà phê view biển</span>
              <span aria-hidden="true">·</span>
              <span>Thôn Đông An Vĩnh, Lý Sơn</span>
            </div>
          </div>

          <figure className="about-story-figure">
            <img
              src="/assets/seagull-hero.jpg?v=seagull2"
              alt="Phối cảnh toàn khu Seagull Coffee & Homestay Lý Sơn bên vách đá biển"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <figcaption>Phối cảnh dự kiến Seagull Coffee &amp; Homestay Lý Sơn</figcaption>
          </figure>
        </div>
      </section>

      {/* 3 Key Differentiators */}
      <section className="subpage-band">
        <div className="section" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
          <div className="section-heading">
            <span className="eyebrow">02 / ĐIỂM KHÁC BIỆT TẠI SEAGULL</span>
            <h2>Ba lý do khách chọn dừng chân ở Seagull</h2>
          </div>

          <div className="about-pillars-grid">
            <article className="editorial-card">
              <span className="editorial-num">01</span>
              <h3>Gần bến cảng Lý Sơn</h3>
              <p>
                Nằm ngay trục ven biển thôn Đông An Vĩnh, cách bến cảng Lý Sơn chỉ vài phút di
                chuyển. Seagull hỗ trợ đón khách tại cảng, giúp hành trình ra đảo nhẹ nhàng ngay từ
                phút đầu tiên.
              </p>
            </article>

            <article className="editorial-card">
              <span className="editorial-num">02</span>
              <h3>Không gian cà phê view biển</h3>
              <p>
                Góc cà phê mở nhìn thẳng ra đê chắn sóng và bến cảng Lý Sơn — nơi bạn có thể đọc
                một cuốn sách, nghe gió biển và ngắm hoàng hôn buông xuống mà chẳng cần đi đâu xa.
              </p>
            </article>

            <article className="editorial-card">
              <span className="editorial-num">03</span>
              <h3>Trải nghiệm đảo bản địa</h3>
              <p>
                Bãi biển san hô và hoạt động chèo SUP ngay dưới chân đồi homestay, kết hợp không
                gian nghỉ chất liệu gỗ ấm áp cho cặp đôi, gia đình và nhóm bạn khám phá Lý Sơn.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Real Moments Gallery (Reusing existing real site images only) */}
      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">03 / HÌNH ẢNH THỰC TẾ TẠI ĐẢO</span>
          <h2>Một thoáng bình yên ở Seagull Lý Sơn</h2>
        </div>

        <div className="about-photo-pair">
          <figure className="about-photo-card">
            <img
              src="/assets/lyson-harbor-real.jpg"
              alt="Ảnh thực tế góc cà phê Seagull nhìn ra bến cảng Lý Sơn"
              style={{ objectPosition: 'center 35%' }}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <figcaption>Ảnh thực tế · Góc cà phê nhìn ra đê chắn sóng &amp; bến cảng Lý Sơn</figcaption>
          </figure>

          <figure className="about-photo-card">
            <img
              src="/assets/lyson-beach-sup-real.jpg"
              alt="Ảnh thực tế bãi biển san hô và chèo SUP dưới chân đồi Seagull"
              style={{ objectPosition: 'center 60%' }}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <figcaption>Ảnh thực tế · Bãi biển san hô &amp; hoạt động chèo SUP dưới chân đồi</figcaption>
          </figure>
        </div>

        <div className="subpage-cta-box">
          <div>
            <h3>Sẵn sàng cho kỳ nghỉ tại Lý Sơn?</h3>
            <p>Khám phá các hạng phòng đang mở bán hoặc liên hệ trực tiếp để được tư vấn lịch trình.</p>
          </div>
          <div className="subpage-cta-actions">
            <button
              type="button"
              className="button light"
              onClick={() => onNavigatePage('home', 'luu-tru')}
            >
              Xem hạng phòng
            </button>
            <button
              type="button"
              className="button"
              onClick={() => (onNavigateToBooking ? onNavigateToBooking() : onNavigatePage('contact'))}
            >
              Đặt phòng ngay
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

// ============================================================================
// 2. TRANG DỊCH VỤ (/dich-vu)
// Phân loại 2 nhóm:
//   (a) 5 Dịch vụ TRẢI NGHIỆM (dữ liệu CMS content_type = 'service', 1–3 ảnh lazy-load)
//   (b) 3 Dịch vụ TIỆN ÍCH (icon đơn giản, KHÔNG ảnh)
// ============================================================================
const ExperienceServiceCard: React.FC<{
  service: CmsContentItem;
  index: number;
  onConsult: () => void;
}> = ({ service, index, onConsult }) => {
  const photos = Array.from(
    new Set((service.images || []).map((u) => (u || '').trim()).filter(Boolean))
  ).slice(0, 3);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [photos.join('|')]);

  const activePhoto = photos[activePhotoIdx] || photos[0] || '/assets/services/tour-tham-quan-dao.jpg';
  const subtitle = String(service.attributes?.subtitle || '').trim();
  const highlights: string[] = Array.isArray(service.attributes?.highlights)
    ? service.attributes.highlights.map((x: unknown) => String(x || '').trim()).filter(Boolean)
    : [];
  const editorialIndex = String(index + 1).padStart(2, '0');

  return (
    <article className="service-exp-card" data-service-id={service.id}>
      <div className="service-media-frame">
        <div className="service-media-primary">
          <img
            src={activePhoto}
            alt={service.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>

        {photos.length > 1 && (
          <div className="service-thumbs" role="group" aria-label={`Bộ ảnh ${service.title}`}>
            {photos.map((url, idx) => (
              <button
                key={`${service.id}-thumb-${idx}`}
                type="button"
                className={`service-thumb-btn ${idx === activePhotoIdx ? 'is-active' : ''}`}
                aria-label={`Xem ảnh ${idx + 1} của ${service.title}`}
                aria-pressed={idx === activePhotoIdx}
                onClick={() => setActivePhotoIdx(idx)}
              >
                <img
                  src={url}
                  alt={`${service.title} - Ảnh ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="service-exp-body">
        <div className="service-frame-head">
          <span className="editorial-num">{editorialIndex}</span>
          {subtitle && <span className="service-subtitle">{subtitle}</span>}
        </div>

        <h2>{service.title}</h2>
        <p className="service-desc">{service.description}</p>

        {highlights.length > 0 && (
          <ul className="service-list">
            {highlights.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        )}

        <div className="service-card-action">
          <button type="button" className="service-consult-link" onClick={onConsult}>
            <span>Tư vấn &amp; đặt lịch trải nghiệm</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export const SeagullServicesPage: React.FC<SubPageCommonProps> = ({
  propertyConfig,
  serviceItems = EXPERIENCE_SERVICES_SEED,
  onUpdateServiceItems,
  onNavigatePage,
  onNavigateToBooking,
}) => {
  const cleanHotline = (propertyConfig?.hotline || '0868 011 799').split('-')[0].trim();

  // Always hydrate latest CMS service records when visiting /dich-vu so Admin updates reflect immediately
  useEffect(() => {
    let cancelled = false;
    apiListCmsContent('service')
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.items) && res.items.length > 0) {
          onUpdateServiceItems?.(res.items);
        }
      })
      .catch(() => {
        // Fallback silently to hydrated/seed state
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const experienceServices = (serviceItems && serviceItems.length > 0
    ? serviceItems
    : EXPERIENCE_SERVICES_SEED
  ).filter((s) => s.active !== false);

  const renderUtilityIcon = (key: 'shuttle' | 'bike' | 'wifi') => {
    if (key === 'shuttle') return <Ship size={22} strokeWidth={1.8} aria-hidden="true" />;
    if (key === 'bike') return <Bike size={22} strokeWidth={1.8} aria-hidden="true" />;
    return <Wifi size={22} strokeWidth={1.8} aria-hidden="true" />;
  };

  return (
    <main className="subpage-main">
      {/* Clean Typographic Header */}
      <section className="subpage-header-plain">
        <div className="section" style={{ paddingTop: '4rem', paddingBottom: '2.25rem' }}>
          <span className="eyebrow">DỊCH VỤ · SEAGULL LÝ SƠN</span>
          <h1>Dịch vụ &amp; Trải nghiệm tại Seagull Lý Sơn</h1>
          <p className="subpage-lead">
            Khám phá 5 trải nghiệm biển đảo đặc trưng cùng các tiện ích lưu trú thiết yếu được đội
            ngũ bản địa Seagull chuẩn bị chu đáo cho chuyến đi Lý Sơn của bạn.
          </p>
        </div>
      </section>

      {/* Group A: 5 Experience Services with 1–3 Lazy-Loaded Photos (CMS-backed) */}
      <section className="section" style={{ paddingTop: '1.5rem', paddingBottom: '3.25rem' }}>
        <div className="section-heading" style={{ marginBottom: '2rem' }}>
          <span className="eyebrow">NHÓM 01 · TRẢI NGHIỆM BIỂN ĐẢO</span>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>5 Trải nghiệm nổi bật tại Lý Sơn</h2>
          <p>Hành trình khám phá đảo Lớn, đảo Bé, san hô và hoàng hôn biển theo lịch trình riêng.</p>
        </div>

        <div className="services-exp-grid">
          {experienceServices.map((svc, idx) => (
            <ExperienceServiceCard
              key={svc.id}
              service={svc}
              index={idx}
              onConsult={() => onNavigatePage('contact')}
            />
          ))}
        </div>
      </section>

      {/* Group B: 3 Utility Services (Clean Icon-Only Frames — Zero Images) */}
      <section className="subpage-band">
        <div className="section" style={{ paddingTop: '3.75rem', paddingBottom: '3.75rem' }}>
          <div className="section-heading" style={{ marginBottom: '2rem' }}>
            <span className="eyebrow">NHÓM 02 · TIỆN ÍCH LƯU TRÚ</span>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>Tiện ích đi kèm tại Seagull</h2>
            <p>Hỗ trợ di chuyển, phương tiện quanh đảo và kết nối xuyên suốt kỳ nghỉ.</p>
          </div>

          <div className="utility-services-grid">
            {UTILITY_SERVICES.map((util) => (
              <article key={util.id} className="utility-service-card" data-utility-id={util.id}>
                <div className="utility-icon-box">{renderUtilityIcon(util.iconKey)}</div>
                <span className="utility-subtitle">{util.subtitle}</span>
                <h3>{util.title}</h3>
                <p>{util.description}</p>
              </article>
            ))}
          </div>

          <div className="subpage-cta-box" style={{ marginTop: '3.25rem' }}>
            <div>
              <h3>Cần tư vấn thêm về dịch vụ hoặc lịch trình đi đảo?</h3>
              <p>
                Liên hệ trực tiếp hotline <strong>{cleanHotline}</strong> hoặc gửi yêu cầu để đội ngũ
                Seagull hỗ trợ nhanh nhất.
              </p>
            </div>
            <div className="subpage-cta-actions">
              <button
                type="button"
                className="button light"
                onClick={() => onNavigatePage('contact')}
              >
                Liên hệ tư vấn
              </button>
              <button
                type="button"
                className="button"
                onClick={() => (onNavigateToBooking ? onNavigateToBooking() : onNavigatePage('home', 'luu-tru'))}
              >
                Đặt phòng trực tuyến
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

// ============================================================================
// 3. TRANG LIÊN HỆ (/lien-he)
// Form liên hệ đơn giản + Hotline/Zalo + Tái dùng bản đồ vị trí Google Maps
// ============================================================================
export const SeagullContactPage: React.FC<SubPageCommonProps> = ({ propertyConfig }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [submittedData, setSubmittedData] = useState<{
    fullName: string;
    phone: string;
    message: string;
  } | null>(null);

  const hotlineDisplay = (propertyConfig?.hotline || '0868011799 - 0981065065')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  const primaryPhoneDigits = '0868011799';
  const emailDisplay =
    propertyConfig?.email && propertyConfig.email.toLowerCase() !== 'seagull.lyson@gmail.com'
      ? propertyConfig.email
      : 'seagulllyson@gmail.com';
  const addressDisplay =
    propertyConfig?.address ||
    'Thôn Đông An Vĩnh, Đặc khu Lý Sơn, Tỉnh Quảng Ngãi (Thửa 432, Tờ bản đồ số 27)';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanMsg = message.trim();

    if (cleanName.length < 2) {
      setFormError('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 13) {
      setFormError('Vui lòng nhập số điện thoại hoặc Zalo hợp lệ (9–13 chữ số).');
      return;
    }

    if (cleanMsg.length < 5) {
      setFormError('Vui lòng nhập nội dung bạn cần tư vấn.');
      return;
    }

    setSubmittedData({
      fullName: cleanName,
      phone: cleanPhone,
      message: cleanMsg,
    });
    setFullName('');
    setPhone('');
    setMessage('');
  };

  return (
    <main className="subpage-main">
      <section className="subpage-header-plain">
        <div className="section" style={{ paddingTop: '4rem', paddingBottom: '2.5rem' }}>
          <span className="eyebrow">LIÊN HỆ · SEAGULL LÝ SƠN</span>
          <h1>Kết nối với Seagull Lý Sơn</h1>
          <p className="subpage-lead">
            Để lại thông tin hoặc gọi trực tiếp qua hotline / Zalo — chúng tôi luôn sẵn sàng tư vấn
            phòng trống, giờ tàu ra đảo và dịch vụ lưu trú.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: '1.5rem' }}>
        <div className="contact-grid">
          {/* Left: Simple Contact Form */}
          <div className="contact-form-card">
            <h2>Gửi tin nhắn cho Seagull</h2>
            <p className="contact-form-note">
              Điền họ tên, số điện thoại / Zalo và nội dung cần hỗ trợ.
            </p>

            <form onSubmit={handleSubmit} className="contact-form" noValidate>
              <label htmlFor="contactFullName">
                Họ và tên *
                <input
                  id="contactFullName"
                  type="text"
                  required
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>

              <label htmlFor="contactPhone">
                Số điện thoại / Zalo *
                <input
                  id="contactPhone"
                  type="tel"
                  required
                  placeholder="0868 xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>

              <label htmlFor="contactMessage">
                Nội dung cần tư vấn *
                <textarea
                  id="contactMessage"
                  rows={5}
                  required
                  placeholder="Ví dụ: Mình dự kiến đi Lý Sơn ngày 15/08, nhóm 4 người, cần tư vấn phòng view biển và đón tại cảng..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>

              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}

              <button type="submit" className="button stay-request-button">
                Gửi thông tin liên hệ
              </button>
            </form>

            {submittedData && (
              <div className="stay-request-result" role="status">
                <strong>Đã ghi nhận yêu cầu liên hệ của {submittedData.fullName}!</strong>
                <p style={{ marginTop: '0.4rem', lineHeight: 1.55 }}>
                  Số điện thoại / Zalo: <strong>{submittedData.phone}</strong>
                  <br />
                  Nội dung: {submittedData.message}
                </p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#2D5A46' }}>
                  Để được phản hồi ngay lập tức, bạn có thể nhắn trực tiếp qua Zalo hoặc gọi hotline
                  bên cạnh.
                </p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a
                    href={`https://zalo.me/${primaryPhoneDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button"
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.78rem',
                      background: '#0068FF',
                      color: '#FFFFFF',
                    }}
                  >
                    Nhắn Zalo 0868 011 799
                  </a>
                  <a
                    href={`tel:${primaryPhoneDigits}`}
                    className="button light"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}
                  >
                    Gọi trực tiếp
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right: Direct Contact Details + Reused Google Maps */}
          <div className="contact-info-col">
            <div className="contact-info-card">
              <span className="eyebrow">THÔNG TIN TRỰC TIẾP</span>
              <h3>Seagull Coffee &amp; Homestay Lý Sơn</h3>

              <dl className="contact-dl">
                <div>
                  <dt>Hotline / Zalo</dt>
                  <dd>
                    <a href={`tel:${primaryPhoneDigits}`} className="contact-phone-link">
                      {hotlineDisplay}
                    </a>
                    <div className="contact-quick-links">
                      <a
                        href={`https://zalo.me/${primaryPhoneDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mở Zalo đặt phòng ↗
                      </a>
                    </div>
                  </dd>
                </div>

                <div>
                  <dt>Địa chỉ</dt>
                  <dd>{addressDisplay}</dd>
                </div>

                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${emailDisplay}`} className="text-button">
                      {emailDisplay}
                    </a>
                  </dd>
                </div>

                <div>
                  <dt>Giờ phục vụ</dt>
                  <dd>
                    Nhận phòng {propertyConfig?.checkInTime || '14:00'} · Trả phòng{' '}
                    {propertyConfig?.checkOutTime || '12:00'} · Cà phê mở cửa hàng ngày
                  </dd>
                </div>
              </dl>
            </div>

            {/* Reused Google Maps embed from homepage location block */}
            <div className="map-wrap" style={{ minHeight: '340px' }}>
              <iframe
                title="Bản đồ Seagull Lý Sơn Homestay & Coffee"
                src={GOOGLE_MAPS_EMBED_URL}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              ></iframe>
              <a
                href={GOOGLE_MAPS_SHARE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở bản đồ trong Google Maps ↗
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
