import React, { useState, useEffect, useRef } from 'react';
import { PropertyConfig, RoomType, BookingSearchQuery, CmsContentItem } from '../types';
import {
  SeagullAboutPage,
  SeagullServicesPage,
  SeagullContactPage,
  WebsiteSubPage,
} from './SeagullSubPages';
import {
  SeagullRoomDetailPage,
  getRoomDetailSlug,
  findRoomBySlugOrId,
} from './SeagullRoomDetailPage';

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

function extractRoomParamFromPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '');
  const match = clean.match(/^\/(?:phong-o|phong)\/([^/?#]+)$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function getSubPageFromLocation(): WebsiteSubPage {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (extractRoomParamFromPath(window.location.pathname)) return 'room-detail';
  if (path === '/gioi-thieu' || path === '/about') return 'about';
  if (path === '/dich-vu' || path === '/services') return 'services';
  if (path === '/lien-he' || path === '/contact') return 'contact';
  return 'home';
}

function getPathForSubPage(page: WebsiteSubPage, anchorId?: string): string {
  if (page === 'about') return '/gioi-thieu';
  if (page === 'services') return '/dich-vu';
  if (page === 'contact') return '/lien-he';
  return anchorId ? `/#${anchorId}` : '/';
}

interface SeagullWebsiteProps {
  propertyConfig?: PropertyConfig;
  roomTypes?: RoomType[];
  serviceItems?: CmsContentItem[];
  onUpdateServiceItems?: (items: CmsContentItem[]) => void;
  onNavigateToBooking?: (target?: string | BookingSearchQuery) => void;
  onNavigateToAdmin?: () => void;
}

interface GalleryItem {
  src: string;
  alt: string;
  caption: string;
}

interface HeroSlide {
  src: string;
  alt: string;
  badge: string;
  caption: string;
  objectPosition?: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    src: '/assets/seagull-hero.jpg?v=seagull2',
    alt: 'Phối cảnh Seagull Coffee & Homestay Lý Sơn bên vịnh biển',
    badge: 'Phối cảnh dự kiến',
    caption: 'Toàn cảnh Seagull Coffee & Homestay bên vách đá Lý Sơn',
    objectPosition: 'center center',
  },
  {
    src: '/assets/lyson-harbor-real.jpg',
    alt: 'Ảnh thực tế góc cà phê Seagull nhìn ra bến cảng Lý Sơn',
    badge: 'Ảnh thực tế · Bến cảng Lý Sơn',
    caption: 'Góc cà phê thực tế nhìn thẳng ra đê chắn sóng & bến cảng Lý Sơn',
    objectPosition: 'center 32%',
  },
  {
    src: '/assets/bungalow-harbor-view.png',
    alt: 'Phối cảnh phòng nghỉ mái vòm gỗ có bồn tắm hướng bến cảng Lý Sơn',
    badge: 'Phối cảnh dự kiến',
    caption: 'Phòng nghỉ mái vòm hướng thẳng bến cảng & đại dương',
    objectPosition: 'center center',
  },
  {
    src: '/assets/lyson-beach-sup-real.jpg',
    alt: 'Ảnh thực tế bãi biển san hô và chèo SUP dưới chân đồi Seagull',
    badge: 'Ảnh thực tế · Bãi biển & SUP',
    caption: 'Bãi biển san hô và hoạt động chèo SUP dưới chân đồi homestay',
    objectPosition: 'center 62%',
  },
];

const DEFAULT_GALLERY_PHOTOS: GalleryItem[] = [
  {
    src: '/assets/lyson-harbor-real.jpg',
    alt: 'Ảnh thực tế góc cà phê Seagull nhìn ra bến cảng Lý Sơn',
    caption: 'Góc cà phê thực tế – Tách cà phê sáng nhìn ra bến cảng và đê chắn sóng Lý Sơn.',
  },
  {
    src: '/assets/lyson-beach-sup-real.jpg',
    alt: 'Ảnh thực tế bãi biển san hô và chèo SUP dưới chân đồi Seagull',
    caption: 'Bãi biển & chèo SUP – Trải nghiệm biển trong xanh ngay dưới chân đồi Seagull.',
  },
  {
    src: '/assets/seagull-hero.jpg?v=seagull2',
    alt: 'Phối cảnh Seagull Coffee & Homestay Lý Sơn',
    caption: 'Seagull Coffee & Homestay Lý Sơn – Điểm hẹn bình yên giữa đảo.',
  },
];

export const SeagullWebsite: React.FC<SeagullWebsiteProps> = ({
  propertyConfig,
  roomTypes = [],
  serviceItems,
  onUpdateServiceItems,
  onNavigateToBooking,
  onNavigateToAdmin,
}) => {
  // Subpage routing inside the marketing website (/, /gioi-thieu, /dich-vu, /lien-he, /phong-o/:slug)
  const [activeSubPage, setActiveSubPage] = useState<WebsiteSubPage>(getSubPageFromLocation);
  const [activeRoomParam, setActiveRoomParam] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractRoomParamFromPath(window.location.pathname);
  });

  useEffect(() => {
    const onPop = () => {
      setActiveSubPage(getSubPageFromLocation());
      setActiveRoomParam(extractRoomParamFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleOpenRoomDetail = (rt: RoomType) => {
    setIsMobileMenuOpen(false);
    const slugOrId = getRoomDetailSlug(rt);
    const nextUrl = `/phong-o/${encodeURIComponent(slugOrId)}`;
    if (window.location.pathname !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }
    setActiveRoomParam(slugOrId);
    setActiveSubPage('room-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigatePage = (page: WebsiteSubPage, anchorId?: string) => {
    setIsMobileMenuOpen(false);
    const nextUrl = getPathForSubPage(page, anchorId);
    const currentFull = `${window.location.pathname}${window.location.hash}`;
    if (currentFull !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }

    const wasDifferentPage = activeSubPage !== page;
    if (page !== 'room-detail') {
      setActiveRoomParam(null);
    }
    setActiveSubPage(page);

    if (page === 'home' && anchorId) {
      const scrollTarget = () => {
        const el = document.getElementById(anchorId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      if (wasDifferentPage) {
        window.setTimeout(scrollTarget, 60);
      } else {
        scrollTarget();
      }
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hero Slider state
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  const handleNextHeroSlide = () => {
    setHeroSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  const handlePrevHeroSlide = () => {
    setHeroSlideIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  useEffect(() => {
    if (isHeroPaused) return;
    const timer = window.setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [isHeroPaused]);

  // Gallery Dialog state (supports viewing real room galleries)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(DEFAULT_GALLERY_PHOTOS);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  // Active real room types (same single source of truth as /booking)
  const activeRoomTypes = roomTypes.filter((rt) => rt.active !== false);

  // Ambient Video/Media toggle
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(true);
  const ambientVideoRef = useRef<HTMLVideoElement>(null);

  // Quick Availability Search Bar state (Hero bottom dock -> redirects to /booking with query params)
  const todayIso = formatLocalIsoDate(new Date());
  const [quickCheckin, setQuickCheckin] = useState<string>(() => addDaysIso(todayIso, 1));
  const [quickCheckout, setQuickCheckout] = useState<string>(() => addDaysIso(todayIso, 3));
  const [quickAdults, setQuickAdults] = useState<number>(2);
  const [quickChildren, setQuickChildren] = useState<number>(0);
  const [quickSearchError, setQuickSearchError] = useState<string>('');

  const quickNights = (() => {
    const start = new Date(`${quickCheckin}T00:00:00`);
    const end = new Date(`${quickCheckout}T00:00:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  })();

  const handleQuickCheckinChange = (nextCheckin: string) => {
    setQuickCheckin(nextCheckin);
    setQuickSearchError('');
    if (nextCheckin && (!quickCheckout || quickCheckout <= nextCheckin)) {
      setQuickCheckout(addDaysIso(nextCheckin, 1));
    }
  };

  const handleQuickCheckoutChange = (nextCheckout: string) => {
    setQuickCheckout(nextCheckout);
    setQuickSearchError('');
  };

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickSearchError('');

    if (!quickCheckin || !quickCheckout) {
      setQuickSearchError('Vui lòng chọn ngày nhận phòng và ngày trả phòng.');
      return;
    }
    if (quickCheckout <= quickCheckin) {
      setQuickSearchError('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.');
      return;
    }

    onNavigateToBooking?.({
      checkin: quickCheckin,
      checkout: quickCheckout,
      adults: quickAdults,
      children: quickChildren,
    });
  };

  // Stay Request Form state
  const [checkinDate, setCheckinDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [checkoutDate, setCheckoutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [roomCount, setRoomCount] = useState('1');
  const [guestCount, setGuestCount] = useState('2');
  const [formError, setFormError] = useState('');
  const [reservationResult, setReservationResult] = useState<{
    checkin: string;
    checkout: string;
    nights: number;
    rooms: string;
    guests: string;
  } | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleOpenGallery = (index: number) => {
    setGalleryItems(DEFAULT_GALLERY_PHOTOS);
    setGalleryIndex(Math.max(0, Math.min(index, DEFAULT_GALLERY_PHOTOS.length - 1)));
  };

  const handleOpenRoomGallery = (rt: RoomType, startIndex = 0) => {
    const imgs = Array.from(
      new Set([rt.image, ...(rt.galleryImages || [])].map((u) => (u || '').trim()).filter(Boolean))
    );
    const items: GalleryItem[] = imgs.map((src, idx) => ({
      src,
      alt: `${rt.name} - Ảnh ${idx + 1}`,
      caption: `${rt.name} · ${rt.basePrice.toLocaleString('vi-VN')} đ / đêm`,
    }));
    if (items.length > 0) {
      setGalleryItems(items);
      setGalleryIndex(Math.max(0, Math.min(startIndex, items.length - 1)));
    }
  };

  const handleCloseGallery = () => {
    setGalleryIndex(null);
  };

  const handleNextPhoto = () => {
    if (galleryIndex !== null && galleryItems.length > 0) {
      setGalleryIndex((galleryIndex + 1) % galleryItems.length);
    }
  };

  const handlePrevPhoto = () => {
    if (galleryIndex !== null && galleryItems.length > 0) {
      setGalleryIndex((galleryIndex - 1 + galleryItems.length) % galleryItems.length);
    }
  };

  // Keyboard navigation for gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (galleryIndex === null) return;
      if (e.key === 'Escape') handleCloseGallery();
      if (e.key === 'ArrowRight') handleNextPhoto();
      if (e.key === 'ArrowLeft') handlePrevPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryIndex, galleryItems.length]);

  // Handle Stay Form Submission
  const handleStayFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!checkinDate || !checkoutDate) {
      setFormError('Vui lòng chọn ngày nhận phòng và ngày trả phòng');
      return;
    }

    const start = new Date(checkinDate);
    const end = new Date(checkoutDate);

    if (end <= start) {
      setFormError('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.');
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    setReservationResult({
      checkin: checkinDate,
      checkout: checkoutDate,
      nights,
      rooms: roomCount,
      guests: guestCount,
    });

    showToast('Đã ghi nhận yêu cầu xem trước giữ chỗ của bạn!');
  };

  const toggleAmbientVideo = () => {
    if (ambientVideoRef.current) {
      if (isAmbientPlaying) {
        ambientVideoRef.current.pause();
        setIsAmbientPlaying(false);
      } else {
        ambientVideoRef.current.play();
        setIsAmbientPlaying(true);
      }
    } else {
      setIsAmbientPlaying(!isAmbientPlaying);
    }
  };

  return (
    <div className="seagull-site-root min-h-screen bg-[#FBF9F5] text-[#17384A] font-sans antialiased selection:bg-[#E6D5B4] selection:text-[#17384A]">
      {/* Inline styles replicating the exact CSS architecture of index_ee27c111.html */}
      <style>{`
        .seagull-site-root {
          --color-brand-dark: #17384A;
          --color-brand-light: #E6D5B4;
          --color-brand-accent: #C8A261;
          --color-bg-base: #FBF9F5;
          --color-bg-surface: #FFFFFF;
          --color-bg-elevated: #F3EEE3;
          --color-text-main: #17384A;
          --color-text-muted: #60727B;
          --color-border: #E5DFD5;
          --color-border-subtle: #ECE6DB;
          font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: 400;
        }

        .seagull-site-root a,
        .seagull-site-root a:hover,
        .seagull-site-root button,
        .seagull-site-root button:hover,
        .seagull-site-root h1,
        .seagull-site-root h2,
        .seagull-site-root h3,
        .seagull-site-root h4 {
          text-decoration: none;
        }

        .seagull-site-root a:focus-visible,
        .seagull-site-root button:focus-visible,
        .seagull-site-root input:focus-visible,
        .seagull-site-root select:focus-visible {
          outline: 2px solid #C8A261;
          outline-offset: 2px;
        }

        .eyebrow {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7E8E96;
          margin-bottom: 0.5rem;
        }

        .site-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(23, 56, 74, 0.94);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          color: #FAF8F5;
          border-bottom: 1px solid rgba(230, 213, 180, 0.18);
          transition: all 0.3s ease;
        }

        .header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.85rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand {
          display: flex;
          flex-direction: column;
          color: #FAF8F5;
          text-decoration: none;
          line-height: 1.15;
          flex-shrink: 0;
        }

        .brand strong {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #FAF8F5;
        }

        .brand small {
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.12em;
          color: #E6D5B4;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .main-nav {
          display: none;
          align-items: center;
          gap: 1.5rem;
        }

        @media (min-width: 1024px) {
          .main-nav {
            display: flex;
          }
        }

        .main-nav a {
          color: #D5DFE3;
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
          padding: 0.25rem 0;
          border-bottom: 2px solid transparent;
          transition: color 0.2s ease, border-color 0.2s ease;
        }

        .main-nav a:hover,
        .main-nav a.is-active {
          color: #E6D5B4;
        }

        .main-nav a.is-active {
          border-bottom-color: #C8A261;
          font-weight: 600;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.65rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 9999px;
          background: #17384A;
          color: #E6D5B4;
          text-decoration: none;
          border: 1px solid transparent;
          transition: all 0.25s ease;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .button:hover {
          background: #204B63;
          color: #FFFFFF;
          transform: translateY(-1px);
        }

        .button.light {
          background: #FAF8F5;
          color: #17384A;
          border-color: #E5DFD5;
        }

        .button.light:hover {
          background: #FFFFFF;
          color: #17384A;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        }

        .header-cta {
          background: #E6D5B4;
          color: #17384A;
          padding: 0.45rem 1.25rem;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .header-cta:hover {
          background: #FFFFFF;
          color: #17384A;
        }

        .menu-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: transparent;
          border: 1px solid rgba(230, 213, 180, 0.3);
          color: #E6D5B4;
          font-size: 1.25rem;
          border-radius: 8px;
          cursor: pointer;
        }

        @media (min-width: 1024px) {
          .menu-toggle {
            display: none;
          }
        }

        /* Hero */
        .hero {
          position: relative;
          min-height: 82vh;
          min-height: 82dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background-color: #102633;
          overflow: hidden;
          padding: 6rem 1.5rem 7.5rem;
        }

        .hero-slide-layer {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.85s ease;
          z-index: 1;
          pointer-events: none;
        }

        .hero-slide-layer.is-active {
          opacity: 1;
          z-index: 2;
        }

        .hero-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          opacity: 0.94;
          display: block;
          transform: scale(1.02);
          transition: transform 9s ease;
        }

        .hero:hover .hero-slide-layer.is-active .hero-image {
          transform: scale(1.05);
        }

        .hero-shade {
          position: absolute;
          inset: 0;
          z-index: 3;
          background: linear-gradient(180deg, rgba(16, 38, 51, 0.22) 0%, rgba(16, 38, 51, 0.38) 52%, rgba(23, 56, 74, 0.9) 100%);
          pointer-events: none;
        }

        .hero-slide-badge {
          position: absolute;
          top: 1.25rem;
          left: 1.5rem;
          z-index: 12;
          background: rgba(16, 38, 51, 0.72);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: #E6D5B4;
          border: 1px solid rgba(230, 213, 180, 0.3);
          padding: 0.35rem 0.85rem;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.04em;
        }

        .hero-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 12;
          width: 42px;
          height: 42px;
          border-radius: 9999px;
          background: rgba(16, 38, 51, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(230, 213, 180, 0.35);
          color: #FAF8F5;
          font-size: 1.15rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .hero-nav-btn:hover {
          background: rgba(23, 56, 74, 0.88);
          color: #E6D5B4;
        }

        .hero-nav-prev {
          left: 1rem;
        }

        .hero-nav-next {
          right: 1rem;
        }

        .hero-dots {
          position: absolute;
          bottom: 5.5rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 12;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .hero-dot {
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: rgba(250, 248, 245, 0.45);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .hero-dot.is-active {
          width: 26px;
          background: #E6D5B4;
        }

        .hero-content {
          position: relative;
          z-index: 10;
          max-width: 800px;
          color: #FAF8F5;
          padding: 0 2.5rem;
        }

        .hero-content .eyebrow {
          color: #E6D5B4;
        }

        .hero-content h1 {
          font-size: clamp(2.25rem, 5.5vw, 4.1rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.18;
          margin: 0.65rem 0 1rem;
          text-shadow: 0 2px 18px rgba(10, 24, 33, 0.45);
        }

        .hero-content h1 span {
          color: #E6D5B4;
          font-weight: 700;
          text-transform: uppercase;
        }

        .hero-content p {
          font-size: clamp(1.05rem, 2.2vw, 1.35rem);
          font-weight: 400;
          color: #EDF3F5;
          margin-bottom: 2rem;
          letter-spacing: 0.01em;
          text-shadow: 0 1px 10px rgba(10, 24, 33, 0.45);
        }

        .hero-caption {
          position: absolute;
          bottom: 3.35rem;
          left: 0;
          width: 100%;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: 0 1.75rem;
          font-size: 0.72rem;
          font-weight: 500;
          color: rgba(230, 213, 180, 0.85);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          z-index: 10;
        }

        @media (max-width: 640px) {
          .hero {
            min-height: 76vh;
            min-height: 76dvh;
            padding: 5.5rem 1rem 6.25rem;
          }
          .hero-content {
            padding: 0 1.75rem;
          }
          .hero-nav-btn {
            width: 34px;
            height: 34px;
            font-size: 0.95rem;
          }
          .hero-nav-prev {
            left: 0.5rem;
          }
          .hero-nav-next {
            right: 0.5rem;
          }
          .hero-slide-badge {
            top: 0.85rem;
            left: 1rem;
            font-size: 0.68rem;
          }
          .hero-dots {
            bottom: 3.9rem;
          }
          .hero-caption {
            bottom: 2rem;
            padding: 0 1rem;
            font-size: 0.65rem;
          }
          .hero-caption span:first-child {
            display: none;
          }
        }

        /* Quick Availability Search Bar overlapping Hero bottom edge */
        .hero-search-wrap {
          position: relative;
          z-index: 25;
          background: #17384A;
          padding: 0 1.25rem 1.75rem;
        }

        .hero-search-card {
          max-width: 1120px;
          margin: 0 auto;
          transform: translateY(-2.5rem);
          margin-bottom: -2.5rem;
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 18px;
          box-shadow: 0 22px 48px -12px rgba(10, 26, 36, 0.34), 0 4px 12px rgba(10, 26, 36, 0.12);
          padding: 1.25rem 1.5rem 1.35rem;
        }

        .hero-search-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding-bottom: 0.85rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid #F0EBE1;
          font-size: 0.78rem;
          color: #60727B;
        }

        .hero-search-meta strong {
          color: #17384A;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .hero-search-summary {
          font-weight: 600;
          color: #9E7A3B;
          font-variant-numeric: tabular-nums;
        }

        .hero-search-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.85rem;
          align-items: end;
        }

        .hero-search-guests {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        @media (min-width: 540px) {
          .hero-search-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .hero-search-guests {
            grid-column: 1 / -1;
          }
          .hero-search-submit-wrap {
            grid-column: 1 / -1;
          }
        }

        @media (min-width: 1024px) {
          .hero-search-grid {
            grid-template-columns: 1.15fr 1.15fr 1.55fr auto;
            gap: 1rem;
          }
          .hero-search-guests {
            grid-column: auto;
          }
          .hero-search-submit-wrap {
            grid-column: auto;
          }
        }

        .hero-search-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          min-width: 0;
        }

        .hero-search-field label {
          font-size: 0.74rem;
          font-weight: 700;
          color: #4A5F6B;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }

        .hero-search-input {
          width: 100%;
          min-height: 44px;
          padding: 0.6rem 0.85rem;
          font-size: 0.9rem;
          font-weight: 600;
          font-family: inherit;
          color: #17384A;
          background: #FAF8F5;
          border: 1px solid #DDD5C9;
          border-radius: 10px;
          font-variant-numeric: tabular-nums;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }

        .hero-search-input:hover {
          border-color: #C8A261;
        }

        .hero-search-input:focus {
          outline: none;
          border-color: #17384A;
          background: #FFFFFF;
        }

        .hero-search-submit {
          width: 100%;
          min-height: 44px;
          padding: 0.7rem 1.5rem;
          border-radius: 10px;
          border: 1px solid transparent;
          background: #17384A;
          color: #FAF8F5;
          font-size: 0.9rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          white-space: nowrap;
          transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .hero-search-submit:hover {
          background: #C8A261;
          color: #17384A;
          transform: translateY(-1px);
        }

        .hero-search-error {
          margin-top: 0.75rem;
          font-size: 0.82rem;
          font-weight: 600;
          color: #B42318;
        }

        @media (max-width: 640px) {
          .hero-search-wrap {
            padding: 0 0.9rem 1.5rem;
          }
          .hero-search-card {
            transform: translateY(-1.5rem);
            margin-bottom: -1.5rem;
            padding: 1.05rem 1rem 1.15rem;
            border-radius: 14px;
          }
          .hero-search-submit {
            min-height: 46px;
          }
        }

        /* Hero Booking Strip */
        .hero-booking-cta {
          background: #17384A;
          color: #FAF8F5;
          border-top: 1px solid rgba(230, 213, 180, 0.16);
          border-bottom: 1px solid rgba(230, 213, 180, 0.1);
          padding: 1.75rem 1.5rem;
        }

        .hero-booking-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          align-items: center;
          text-align: center;
        }

        @media (min-width: 768px) {
          .hero-booking-inner {
            flex-direction: row;
            justify-content: space-between;
            text-align: left;
          }
        }

        .hero-booking-inner h2 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #FAF8F5;
          margin-bottom: 0.25rem;
        }

        .hero-booking-inner p {
          font-size: 0.9rem;
          color: #B2C4CB;
        }

        .hero-booking-call {
          background: #E6D5B4;
          color: #17384A;
          padding: 0.75rem 1.75rem;
          font-size: 0.95rem;
          font-weight: 700;
          white-space: nowrap;
          border-radius: 9999px;
        }

        .hero-booking-call:hover {
          background: #FFFFFF;
          color: #17384A;
        }

        /* Section Global */
        .section {
          padding: 5rem 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-heading {
          margin-bottom: 3rem;
        }

        .section-heading h2 {
          font-size: clamp(1.85rem, 4vw, 2.6rem);
          font-weight: 700;
          color: #17384A;
          letter-spacing: -0.015em;
          margin-top: 0.25rem;
          margin-bottom: 0.5rem;
        }

        .section-heading p {
          font-size: 1.05rem;
          font-weight: 400;
          color: #5A6D77;
        }

        /* Room Grid */
        .room-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
          margin-bottom: 1.5rem;
        }

        @media (min-width: 768px) {
          .room-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .room-card {
          background: #FFFFFF;
          border: 1px solid #EBE5DB;
          border-radius: 16px;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .room-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 32px -8px rgba(23, 56, 74, 0.12);
        }

        .image-button {
          width: 100%;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          display: block;
        }

        .image-button img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .image-button:hover img {
          transform: scale(1.05);
        }

        .room-card-copy {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .room-card-copy h3 {
          font-size: 1.15rem;
          font-weight: 700;
          color: #17384A;
          margin-bottom: 0.45rem;
          line-height: 1.35;
        }

        .room-card-price-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.65rem;
          padding-bottom: 0.65rem;
          border-bottom: 1px solid #F0EBE1;
        }

        .room-card-price {
          font-size: 1.15rem;
          font-weight: 800;
          color: #9E7A3B;
          font-variant-numeric: tabular-nums;
        }

        .room-card-price small {
          font-size: 0.78rem;
          font-weight: 500;
          color: #7A8B93;
        }

        .room-card-deposit {
          font-size: 0.75rem;
          font-weight: 600;
          color: #5A6D77;
          font-variant-numeric: tabular-nums;
        }

        .room-card-specs {
          font-size: 0.8rem;
          font-weight: 600;
          color: #3D5461;
          margin-bottom: 0.65rem;
          line-height: 1.5;
        }

        .room-card-desc {
          font-size: 0.88rem;
          color: #60727B;
          line-height: 1.55;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 1.25rem;
        }

        .room-card-footer {
          margin-top: auto;
          padding-top: 0.85rem;
          border-top: 1px solid #F0EBE1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .room-card-cta {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.72rem 1rem;
          border-radius: 10px;
          background: #17384A;
          color: #FAF8F5;
          font-size: 0.85rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .room-card-cta:hover {
          background: #C8A261;
          color: #151B17;
        }

        .room-gallery-count {
          position: absolute;
          bottom: 0.65rem;
          right: 0.65rem;
          background: rgba(23, 56, 74, 0.82);
          color: #FAF8F5;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.22rem 0.55rem;
          border-radius: 6px;
        }

        .caption.muted {
          font-size: 0.8rem;
          color: #8C9CA3;
          margin-bottom: 3.5rem;
          font-style: italic;
        }

        /* Stay Invitation Card & Form */
        .stay-invitation {
          background: #F3EEE3;
          border: 1px solid #E5DFD5;
          border-radius: 24px;
          padding: 2.5rem 1.75rem;
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
        }

        @media (min-width: 900px) {
          .stay-invitation {
            grid-template-columns: 1.15fr 1fr;
            padding: 3.5rem;
          }
        }

        .stay-intro h3 {
          font-size: clamp(1.75rem, 3.5vw, 2.4rem);
          font-weight: 800;
          color: #17384A;
          line-height: 1.25;
          margin: 0.5rem 0 1rem;
        }

        .stay-intro p {
          font-size: 0.95rem;
          color: #4C5D66;
          line-height: 1.6;
          margin-bottom: 1.75rem;
        }

        .stay-poster {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 1.75rem;
          aspect-ratio: 16 / 9;
          background: #17384A;
        }

        .stay-poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .stay-poster figcaption {
          position: absolute;
          bottom: 0.75rem;
          right: 0.75rem;
          background: rgba(23, 56, 74, 0.85);
          color: #FAF8F5;
          font-size: 0.7rem;
          padding: 0.25rem 0.65rem;
          border-radius: 4px;
        }

        .stay-highlights {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .stay-highlights li {
          font-size: 0.9rem;
          font-weight: 500;
          color: #2D414D;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .stay-highlights li::before {
          content: "—";
          color: #C8A261;
          font-weight: 700;
        }

        /* Stay Request Form Card */
        .stay-card {
          background: #FFFFFF;
          border: 1px solid #DFD8CB;
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 12px 28px -8px rgba(23, 56, 74, 0.08);
          display: flex;
          flex-direction: column;
        }

        .stay-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #EBE5DB;
          margin-bottom: 1.5rem;
        }

        .stay-price {
          font-size: 1.45rem;
          font-weight: 800;
          color: #17384A;
          display: block;
        }

        .stay-price-note {
          font-size: 0.8rem;
          color: #7A8B93;
        }

        .badge {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          background: #EBF4F7;
          color: #17384A;
          border: 1px solid #C4D9E2;
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
        }

        .stay-input-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        @media (min-width: 500px) {
          .stay-input-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .stay-input-grid label {
          display: flex;
          flex-direction: column;
          font-size: 0.8rem;
          font-weight: 700;
          color: #17384A;
          gap: 0.35rem;
        }

        .stay-input-grid input,
        .stay-input-grid select {
          padding: 0.65rem 0.75rem;
          font-size: 0.9rem;
          font-family: inherit;
          border: 1px solid #D5CBBF;
          border-radius: 8px;
          background: #FAF8F5;
          color: #17384A;
        }

        .stay-input-grid input:focus,
        .stay-input-grid select:focus {
          outline: none;
          border-color: #17384A;
          background: #FFFFFF;
        }

        .stay-capacity-note {
          font-size: 0.75rem;
          color: #7E8E96;
          line-height: 1.45;
          margin-bottom: 1.25rem;
        }

        .form-error {
          color: #DC2626;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .stay-request-button {
          width: 100%;
          padding: 0.85rem;
          font-size: 0.95rem;
          font-weight: 700;
          border-radius: 12px;
          background: #17384A;
          color: #E6D5B4;
        }

        .stay-demo-note {
          font-size: 0.75rem;
          color: #8C9CA3;
          text-align: center;
          margin-top: 0.75rem;
        }

        .stay-request-result {
          margin-top: 1.5rem;
          padding: 1.25rem;
          background: #F4FAF7;
          border: 1px solid #B8E2D0;
          border-radius: 12px;
          font-size: 0.85rem;
          color: #134E35;
        }

        /* Coffee Section */
        .coffee-section {
          background: #17384A;
          color: #FAF8F5;
          padding: 6rem 1.5rem;
        }

        .coffee-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 3.5rem;
          align-items: center;
        }

        @media (min-width: 900px) {
          .coffee-container {
            grid-template-columns: 1fr 1fr;
          }
        }

        .coffee-image {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: #102633;
          aspect-ratio: 16 / 11;
        }

        .coffee-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .photo-label {
          position: absolute;
          bottom: 1rem;
          left: 1rem;
          background: rgba(16, 38, 51, 0.85);
          color: #FAF8F5;
          font-size: 0.75rem;
          padding: 0.3rem 0.75rem;
          border-radius: 6px;
        }

        .coffee-copy .eyebrow {
          color: #E6D5B4;
        }

        .coffee-copy h2 {
          font-size: clamp(1.9rem, 4vw, 2.75rem);
          font-weight: 700;
          color: #FAF8F5;
          margin: 0.5rem 0 1rem;
        }

        .coffee-copy p {
          font-size: 1.05rem;
          font-weight: 400;
          color: #CBD8DC;
          line-height: 1.6;
          margin-bottom: 2rem;
        }

        .coffee-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          margin-bottom: 2rem;
        }

        .coffee-details .image-button {
          border-radius: 12px;
          aspect-ratio: 4 / 3;
        }

        .underlined {
          color: #E6D5B4;
          font-size: 0.95rem;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .underlined:hover {
          color: #FFFFFF;
          text-decoration: none;
        }

        /* Reviews & Location */
        .reviews-ambient-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
          margin-bottom: 4rem;
        }

        @media (min-width: 900px) {
          .reviews-ambient-grid {
            grid-template-columns: 1fr 1.1fr;
          }
        }

        .review-samples {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .review-sample-label {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #8C9CA3;
          margin-bottom: 0.25rem;
        }

        .review-sample {
          background: #FFFFFF;
          border: 1px solid #EBE5DB;
          border-radius: 14px;
          padding: 1.5rem;
          transition: transform 0.2s ease;
        }

        .review-sample:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -6px rgba(23, 56, 74, 0.08);
        }

        .review-stars {
          color: #C8A261;
          font-size: 1rem;
          letter-spacing: 2px;
          margin-bottom: 0.5rem;
        }

        .review-sample blockquote {
          font-size: 0.95rem;
          color: #2D414D;
          line-height: 1.6;
          margin-bottom: 0.5rem;
          font-style: italic;
        }

        .review-sample span {
          font-size: 0.75rem;
          color: #8C9CA3;
          text-transform: uppercase;
          font-weight: 600;
        }

        .ambient-figure {
          background: #FFFFFF;
          border: 1px solid #EBE5DB;
          border-radius: 16px;
          overflow: hidden;
          padding: 1rem;
        }

        .ambient-media {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          background: #102633;
        }

        .ambient-media video,
        .ambient-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ambient-toggle {
          position: absolute;
          bottom: 0.75rem;
          right: 0.75rem;
          background: rgba(23, 56, 74, 0.85);
          color: #FAF8F5;
          border: none;
          padding: 0.4rem 0.85rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
        }

        .ambient-figure figcaption {
          font-size: 0.85rem;
          color: #4C5D66;
          margin-top: 0.75rem;
          line-height: 1.5;
        }

        .ambient-figure figcaption span {
          display: block;
          font-size: 0.75rem;
          color: #8C9CA3;
          margin-top: 0.25rem;
        }

        /* Visit & Maps Grid */
        .visit-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
          background: #F3EEE3;
          border: 1px solid #E5DFD5;
          border-radius: 24px;
          padding: 2.5rem 1.75rem;
        }

        @media (min-width: 900px) {
          .visit-grid {
            grid-template-columns: 1fr 1.25fr;
            padding: 3.5rem;
          }
        }

        .review-copy h3 {
          font-size: clamp(1.75rem, 3.5vw, 2.3rem);
          font-weight: 700;
          color: #17384A;
          line-height: 1.25;
          margin: 0.5rem 0 1rem;
        }

        .review-copy p {
          font-size: 0.95rem;
          font-weight: 400;
          color: #4C5D66;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .visit-address {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #DCD5C8;
        }

        .visit-address h3 {
          font-size: 1.15rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .visit-address p {
          font-size: 0.85rem;
          font-weight: 400;
          color: #60727B;
          margin-bottom: 0.75rem;
        }

        .text-button {
          font-size: 0.85rem;
          font-weight: 600;
          color: #17384A;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .text-button:hover {
          color: #204B63;
          text-decoration: none;
        }

        .map-wrap {
          border-radius: 16px;
          overflow: hidden;
          min-height: 300px;
          border: 1px solid #DFD8CB;
          background: #EBE5DB;
          position: relative;
        }

        .map-wrap iframe {
          width: 100%;
          height: 100%;
          min-height: 320px;
          border: 0;
        }

        .map-wrap a {
          position: absolute;
          bottom: 0.75rem;
          left: 0.75rem;
          background: rgba(23, 56, 74, 0.9);
          color: #FAF8F5;
          font-size: 0.75rem;
          padding: 0.4rem 0.85rem;
          border-radius: 6px;
          text-decoration: none;
        }

        /* Lightbox Gallery Dialog */
        .gallery-dialog {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          background: rgba(16, 38, 51, 0.95);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .dialog-close {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          width: 44px;
          height: 44px;
          background: rgba(255, 255, 255, 0.15);
          color: #FAF8F5;
          border: none;
          border-radius: 50%;
          font-size: 1.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gallery-dialog img {
          max-width: 90vw;
          max-height: 75vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .gallery-controls {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-top: 1.5rem;
          color: #FAF8F5;
        }

        .gallery-controls button {
          background: rgba(230, 213, 180, 0.2);
          color: #E6D5B4;
          border: 1px solid rgba(230, 213, 180, 0.4);
          padding: 0.5rem 1.25rem;
          border-radius: 9999px;
          cursor: pointer;
          font-weight: 600;
        }

        .gallery-controls button:hover {
          background: #E6D5B4;
          color: #17384A;
        }

        /* Compact Footer */
        .compact-footer {
          max-width: 1200px;
          margin: 0 auto;
          padding: 3rem 1.5rem 4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          border-top: 1px solid #EBE5DB;
          text-align: center;
          font-size: 0.85rem;
          color: #7E8E96;
        }

        @media (min-width: 768px) {
          .compact-footer {
            flex-direction: row;
            justify-content: space-between;
          }
        }

        .compact-footer a.brand {
          color: #17384A;
        }

        .compact-footer a.brand strong {
          color: #17384A;
        }

        .compact-footer a.brand small {
          color: #8C9CA3;
        }

        /* Toast */
        #toast {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          background: #17384A;
          color: #E6D5B4;
          padding: 0.85rem 1.5rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          z-index: 100;
        }

        /* ============================================================== */
        /* SUBPAGES: GIỚI THIỆU, DỊCH VỤ, LIÊN HỆ                        */
        /* ============================================================== */
        .subpage-main {
          min-height: 70vh;
          padding-bottom: 3rem;
        }

        .subpage-hero {
          position: relative;
          min-height: 360px;
          display: flex;
          align-items: flex-end;
          background: #102633;
          overflow: hidden;
        }

        .subpage-hero-media {
          position: absolute;
          inset: 0;
        }

        .subpage-hero-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .subpage-hero-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(16, 38, 51, 0.35) 0%, rgba(16, 38, 51, 0.82) 100%);
        }

        .subpage-hero-inner {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding: 5.5rem 1.5rem 3.25rem;
          color: #FAF8F5;
        }

        .subpage-hero-inner h1 {
          font-size: clamp(2rem, 4.5vw, 3.1rem);
          font-weight: 700;
          line-height: 1.2;
          margin: 0.35rem 0 0.85rem;
          color: #FAF8F5;
        }

        .subpage-hero-inner p {
          max-width: 680px;
          font-size: 1.05rem;
          line-height: 1.65;
          color: #E1EAEF;
        }

        .subpage-header-plain {
          background: #F3EEE3;
          border-bottom: 1px solid #E5DFD5;
        }

        .subpage-header-plain h1 {
          font-size: clamp(2rem, 4.2vw, 3rem);
          font-weight: 700;
          color: #17384A;
          line-height: 1.2;
          margin: 0.35rem 0 0.85rem;
        }

        .subpage-lead {
          max-width: 720px;
          font-size: 1.02rem;
          line-height: 1.65;
          color: #4C5D66;
        }

        .subpage-band {
          background: #F3EEE3;
          border-top: 1px solid #E5DFD5;
          border-bottom: 1px solid #E5DFD5;
        }

        .about-story-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
          align-items: center;
        }

        @media (min-width: 900px) {
          .about-story-grid {
            grid-template-columns: 1.1fr 1fr;
            gap: 3.5rem;
          }
        }

        .about-story-copy h2 {
          font-size: clamp(1.65rem, 3.2vw, 2.25rem);
          font-weight: 700;
          color: #17384A;
          line-height: 1.28;
          margin: 0.4rem 0 1.25rem;
        }

        .about-story-copy p {
          font-size: 0.96rem;
          line-height: 1.75;
          color: #4C5D66;
          margin-bottom: 1rem;
        }

        .about-meta-line {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid #E5DFD5;
          font-size: 0.84rem;
          font-weight: 600;
          color: #17384A;
        }

        .about-story-figure {
          margin: 0;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid #E5DFD5;
          background: #17384A;
        }

        .about-story-figure img {
          width: 100%;
          aspect-ratio: 16 / 10;
          object-fit: cover;
          display: block;
        }

        .about-story-figure figcaption {
          padding: 0.75rem 1rem;
          font-size: 0.78rem;
          color: #E6D5B4;
          background: #17384A;
        }

        .about-pillars-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.75rem;
        }

        @media (min-width: 768px) {
          .about-pillars-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .editorial-card {
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 16px;
          padding: 1.85rem;
        }

        .editorial-num {
          display: inline-block;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #9E7A3B;
          font-variant-numeric: tabular-nums;
          margin-bottom: 0.75rem;
        }

        .editorial-card h3 {
          font-size: 1.15rem;
          font-weight: 700;
          color: #17384A;
          margin-bottom: 0.6rem;
        }

        .editorial-card p {
          font-size: 0.92rem;
          line-height: 1.65;
          color: #5A6D77;
        }

        .about-photo-pair {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.75rem;
          margin-bottom: 3rem;
        }

        @media (min-width: 768px) {
          .about-photo-pair {
            grid-template-columns: 1fr 1fr;
          }
        }

        .about-photo-card {
          margin: 0;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #E5DFD5;
          background: #FFFFFF;
        }

        .about-photo-card img {
          width: 100%;
          aspect-ratio: 16 / 10;
          object-fit: cover;
          display: block;
        }

        .about-photo-card figcaption {
          padding: 0.9rem 1.25rem;
          font-size: 0.82rem;
          color: #5A6D77;
        }

        .subpage-cta-box {
          background: #17384A;
          color: #FAF8F5;
          border-radius: 20px;
          padding: 2.25rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          justify-content: space-between;
          align-items: flex-start;
        }

        @media (min-width: 768px) {
          .subpage-cta-box {
            flex-direction: row;
            align-items: center;
          }
        }

        .subpage-cta-box h3 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #FAF8F5;
          margin-bottom: 0.35rem;
        }

        .subpage-cta-box p {
          font-size: 0.92rem;
          color: #D5DFE3;
          line-height: 1.55;
        }

        .subpage-cta-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          flex-shrink: 0;
        }

        .subpage-cta-box .button:not(.light) {
          background: #E6D5B4;
          color: #17384A;
        }

        .subpage-cta-box .button:not(.light):hover {
          background: #FFFFFF;
        }

        /* Services Page: 5 Experience Photo Cards + 3 Utility Icon Cards */
        .services-exp-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }

        @media (min-width: 820px) {
          .services-exp-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .service-exp-card {
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .service-exp-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 32px -10px rgba(23, 56, 74, 0.12);
        }

        .service-media-frame {
          background: #EAE3D5;
          border-bottom: 1px solid #EFE9DC;
        }

        .service-media-primary {
          width: 100%;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          background: #EAE3D5;
        }

        .service-media-primary img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.45s ease;
        }

        .service-exp-card:hover .service-media-primary img {
          transform: scale(1.03);
        }

        .service-thumbs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.45rem;
          padding: 0.55rem 0.75rem;
          background: #FAF8F5;
          border-top: 1px solid #EFE9DC;
        }

        .service-thumb-btn {
          padding: 0;
          border: 2px solid transparent;
          border-radius: 8px;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          background: #EAE3D5;
          cursor: pointer;
          opacity: 0.78;
          transition: opacity 0.2s ease, border-color 0.2s ease;
        }

        .service-thumb-btn:hover {
          opacity: 1;
        }

        .service-thumb-btn.is-active {
          border-color: #C8A261;
          opacity: 1;
        }

        .service-thumb-btn img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .service-exp-body {
          padding: 1.6rem 1.75rem 1.75rem;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .service-exp-body h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #17384A;
          margin-bottom: 0.6rem;
          line-height: 1.35;
        }

        .service-card-action {
          margin-top: 1.25rem;
          padding-top: 0.9rem;
          border-top: 1px solid #F3EEE3;
        }

        .service-consult-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: transparent;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          color: #17384A;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .service-consult-link:hover {
          color: #9E7A3B;
        }

        .utility-services-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 768px) {
          .utility-services-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .utility-service-card {
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 16px;
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .utility-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #F3EEE3;
          color: #17384A;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.4rem;
        }

        .utility-subtitle {
          font-size: 0.74rem;
          font-weight: 700;
          color: #9E7A3B;
          letter-spacing: 0.04em;
        }

        .utility-service-card h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #17384A;
          margin: 0;
          line-height: 1.35;
        }

        .utility-service-card p {
          font-size: 0.9rem;
          line-height: 1.62;
          color: #5A6D77;
          margin: 0.2rem 0 0;
        }

        .service-frame-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 0.85rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid #F0EBE1;
        }

        .service-frame-head .editorial-num {
          margin-bottom: 0;
        }

        .service-subtitle {
          font-size: 0.78rem;
          font-weight: 600;
          color: #7A8B93;
          text-align: right;
        }

        .service-frame h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #17384A;
          margin-bottom: 0.65rem;
          line-height: 1.35;
        }

        .service-desc {
          font-size: 0.93rem;
          line-height: 1.65;
          color: #5A6D77;
          margin-bottom: 1.15rem;
        }

        .service-list {
          list-style: none;
          padding: 0;
          margin: auto 0 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid #F3EEE3;
        }

        .service-list li {
          font-size: 0.86rem;
          color: #2D414D;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          line-height: 1.5;
        }

        .service-list li::before {
          content: "—";
          color: #C8A261;
          font-weight: 700;
          flex-shrink: 0;
        }

        /* Contact Page */
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.25rem;
          align-items: start;
        }

        @media (min-width: 900px) {
          .contact-grid {
            grid-template-columns: 1.05fr 1fr;
          }
        }

        .contact-form-card,
        .contact-info-card {
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 18px;
          padding: 2rem;
        }

        .contact-form-card h2,
        .contact-info-card h3 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #17384A;
          margin-bottom: 0.4rem;
        }

        .contact-form-note {
          font-size: 0.9rem;
          color: #60727B;
          margin-bottom: 1.5rem;
        }

        .contact-form {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .contact-form label {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.82rem;
          font-weight: 700;
          color: #17384A;
        }

        .contact-form input,
        .contact-form textarea {
          padding: 0.75rem 0.9rem;
          font-size: 0.92rem;
          font-family: inherit;
          border: 1px solid #D5CBBF;
          border-radius: 10px;
          background: #FAF8F5;
          color: #17384A;
        }

        .contact-form input:focus,
        .contact-form textarea:focus {
          outline: none;
          border-color: #17384A;
          background: #FFFFFF;
        }

        .contact-info-col {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .contact-dl {
          margin: 1.25rem 0 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .contact-dl > div {
          padding-top: 0.85rem;
          border-top: 1px solid #F0EBE1;
        }

        .contact-dl dt {
          font-size: 0.74rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #7E8E96;
          margin-bottom: 0.25rem;
        }

        .contact-dl dd {
          margin: 0;
          font-size: 0.94rem;
          color: #17384A;
          line-height: 1.55;
        }

        .contact-phone-link {
          font-size: 1.15rem;
          font-weight: 800;
          color: #17384A;
          font-variant-numeric: tabular-nums;
        }

        .contact-quick-links {
          margin-top: 0.35rem;
        }

        .contact-quick-links a {
          font-size: 0.82rem;
          font-weight: 600;
          color: #9E7A3B;
        }

        .footer-nav {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1.25rem;
        }

        .footer-nav a {
          color: #5A6D77;
          font-size: 0.82rem;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .footer-nav a:hover {
          color: #17384A;
        }

        /* ============================================================== */
        /* DEDICATED ROOM DETAIL PAGE (/phong-o/:slug)                    */
        /* ============================================================== */
        .room-detail-container {
          padding-top: 2rem;
          padding-bottom: 4.5rem;
        }

        .room-detail-topbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .room-detail-back {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: transparent;
          border: none;
          padding: 0.25rem 0;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          color: #17384A;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .room-detail-back:hover {
          color: #9E7A3B;
        }

        .room-detail-crumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: #60727B;
        }

        .room-detail-crumb strong {
          color: #17384A;
          font-weight: 600;
        }

        .room-detail-gallery-wrap {
          margin-bottom: 2rem;
        }

        .room-detail-gallery {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          border-radius: 18px;
          overflow: hidden;
        }

        @media (min-width: 768px) {
          .room-detail-gallery.has-secondary {
            grid-template-columns: 2fr 1fr;
            max-height: 460px;
          }
        }

        .room-detail-photo-main,
        .room-detail-photo-sub {
          position: relative;
          border: none;
          padding: 0;
          margin: 0;
          background: #EAE3D5;
          cursor: pointer;
          overflow: hidden;
          display: block;
          width: 100%;
        }

        .room-detail-photo-main {
          aspect-ratio: 16 / 10;
        }

        @media (min-width: 768px) {
          .room-detail-gallery.has-secondary .room-detail-photo-main {
            aspect-ratio: auto;
            height: 460px;
          }
          .room-detail-gallery.single-photo .room-detail-photo-main {
            max-height: 500px;
          }
        }

        .room-detail-photo-side {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        @media (min-width: 768px) {
          .room-detail-photo-side {
            grid-template-columns: 1fr;
            grid-auto-rows: 1fr;
            height: 460px;
          }
        }

        .room-detail-photo-sub {
          aspect-ratio: 16 / 10;
        }

        @media (min-width: 768px) {
          .room-detail-photo-sub {
            aspect-ratio: auto;
            height: 100%;
          }
        }

        .room-detail-photo-main img,
        .room-detail-photo-sub img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.45s ease;
        }

        .room-detail-photo-main:hover img,
        .room-detail-photo-sub:hover img {
          transform: scale(1.03);
        }

        .room-detail-zoom-hint {
          position: absolute;
          bottom: 0.9rem;
          right: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(16, 38, 51, 0.84);
          backdrop-filter: blur(6px);
          color: #FAF8F5;
          padding: 0.45rem 0.85rem;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .room-detail-more-overlay {
          position: absolute;
          inset: 0;
          background: rgba(16, 38, 51, 0.56);
          color: #FFFFFF;
          font-size: 1.15rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .room-detail-header {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-bottom: 1.75rem;
          border-bottom: 1px solid #E5DFD5;
          margin-bottom: 1.75rem;
        }

        @media (min-width: 768px) {
          .room-detail-header {
            flex-direction: row;
            align-items: flex-end;
            justify-content: space-between;
          }
        }

        .room-detail-title-col h1 {
          font-size: clamp(1.75rem, 3.6vw, 2.55rem);
          font-weight: 700;
          color: #17384A;
          line-height: 1.2;
          margin: 0.2rem 0 0.35rem;
          letter-spacing: -0.015em;
        }

        .room-detail-bedtype {
          font-size: 0.92rem;
          color: #60727B;
          margin: 0;
        }

        .room-detail-price-col {
          text-align: left;
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .room-detail-price-col {
            text-align: right;
          }
        }

        .room-detail-price-value {
          font-size: clamp(1.5rem, 2.8vw, 2rem);
          font-weight: 800;
          color: #9E7A3B;
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
        }

        .room-detail-price-value small {
          font-size: 0.9rem;
          font-weight: 500;
          color: #60727B;
        }

        .room-detail-price-sub {
          font-size: 0.8rem;
          color: #5A6D77;
          margin-top: 0.25rem;
        }

        .room-detail-specs-bar {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 14px;
          padding: 1.15rem 1.35rem;
          margin-bottom: 2.25rem;
        }

        @media (min-width: 768px) {
          .room-detail-specs-bar {
            grid-template-columns: repeat(5, 1fr);
          }
        }

        .room-spec-item {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          color: #17384A;
        }

        .room-spec-item svg {
          color: #9E7A3B;
          flex-shrink: 0;
        }

        .room-spec-label {
          display: block;
          font-size: 0.72rem;
          color: #7A8B93;
          font-weight: 500;
        }

        .room-spec-item strong {
          font-size: 0.88rem;
          font-weight: 700;
          color: #17384A;
        }

        .room-detail-body-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
          align-items: start;
        }

        @media (min-width: 1024px) {
          .room-detail-body-grid {
            grid-template-columns: minmax(0, 1.55fr) 380px;
          }
        }

        .room-detail-main-col {
          display: flex;
          flex-direction: column;
          gap: 2.25rem;
        }

        .room-detail-block {
          padding-bottom: 2rem;
          border-bottom: 1px solid #ECE6DB;
        }

        .room-detail-block:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .room-detail-block h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #17384A;
          margin: 0 0 0.9rem;
        }

        .room-detail-description {
          font-size: 0.98rem;
          line-height: 1.78;
          color: #354954;
          margin: 0;
          white-space: pre-line;
        }

        .room-amenities-checklist {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem 1.5rem;
        }

        @media (min-width: 640px) {
          .room-amenities-checklist {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .room-amenities-checklist li {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          font-size: 0.93rem;
          color: #243945;
          line-height: 1.5;
        }

        .room-amenities-checklist li svg {
          color: #9E7A3B;
          margin-top: 0.2rem;
          flex-shrink: 0;
        }

        .room-policy-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          background: #F3EEE3;
          border-radius: 14px;
          padding: 1.2rem 1.35rem;
        }

        @media (min-width: 640px) {
          .room-policy-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .room-policy-grid strong {
          display: block;
          margin-top: 0.2rem;
          font-size: 0.92rem;
          color: #17384A;
          font-variant-numeric: tabular-nums;
        }

        .room-detail-sticky-col {
          width: 100%;
        }

        @media (min-width: 1024px) {
          .room-detail-sticky-col {
            position: sticky;
            top: 5.5rem;
          }
        }

        .room-booking-card {
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 18px;
          padding: 1.5rem;
          box-shadow: 0 18px 40px -14px rgba(23, 56, 74, 0.14);
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }

        .room-booking-card-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          padding-bottom: 0.95rem;
          border-bottom: 1px solid #F0EBE1;
        }

        .room-booking-rate {
          font-size: 1.35rem;
          font-weight: 800;
          color: #17384A;
          font-variant-numeric: tabular-nums;
        }

        .room-booking-per {
          font-size: 0.82rem;
          color: #60727B;
        }

        .room-booking-nights-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: #9E7A3B;
          font-variant-numeric: tabular-nums;
        }

        .room-booking-fields {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .room-booking-date-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.7rem;
        }

        @media (max-width: 420px) {
          .room-booking-date-row {
            grid-template-columns: 1fr;
          }
        }

        .room-booking-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          min-width: 0;
        }

        .room-booking-field label {
          font-size: 0.74rem;
          font-weight: 700;
          color: #4A5F6B;
        }

        .room-booking-field input,
        .room-booking-field select {
          width: 100%;
          min-height: 42px;
          padding: 0.55rem 0.75rem;
          font-size: 0.86rem;
          font-weight: 600;
          font-family: inherit;
          color: #17384A;
          background: #FAF8F5;
          border: 1px solid #DDD5C9;
          border-radius: 10px;
          font-variant-numeric: tabular-nums;
        }

        .room-booking-field input:focus,
        .room-booking-field select:focus {
          outline: none;
          border-color: #17384A;
          background: #FFFFFF;
        }

        .room-booking-error {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 600;
          color: #B42318;
        }

        .room-booking-breakdown {
          background: #FAF8F5;
          border: 1px solid #EFE9DC;
          border-radius: 12px;
          padding: 0.95rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .room-booking-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 0.85rem;
          color: #354954;
          font-variant-numeric: tabular-nums;
        }

        .room-booking-row strong {
          color: #17384A;
          font-weight: 700;
        }

        .room-booking-row.is-deposit {
          padding-top: 0.55rem;
          border-top: 1px solid #E5DFD5;
          font-size: 0.92rem;
          font-weight: 700;
          color: #17384A;
        }

        .room-booking-row.is-deposit strong {
          color: #9E7A3B;
          font-size: 1.02rem;
        }

        .room-booking-row.is-muted {
          font-size: 0.78rem;
          color: #6B7D86;
        }

        .room-booking-submit {
          width: 100%;
          min-height: 46px;
          padding: 0.8rem 1.25rem;
          border-radius: 12px;
          border: none;
          background: #17384A;
          color: #FAF8F5;
          font-size: 0.94rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .room-booking-submit:hover {
          background: #C8A261;
          color: #17384A;
          transform: translateY(-1px);
        }

        .room-booking-support {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          color: #60727B;
        }

        .room-booking-support a {
          color: #17384A;
          font-weight: 700;
        }

        .room-detail-others {
          margin-top: 4rem;
          padding-top: 3rem;
          border-top: 1px solid #E5DFD5;
        }

        .room-detail-others-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .room-detail-others-head h2 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #17384A;
          margin: 0;
        }

        .room-detail-others-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 768px) {
          .room-detail-others-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .room-other-card {
          background: #FFFFFF;
          border: 1px solid #E5DFD5;
          border-radius: 14px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .room-other-thumb {
          border: none;
          padding: 0;
          background: #EAE3D5;
          aspect-ratio: 16 / 10;
          width: 100%;
          overflow: hidden;
          cursor: pointer;
          display: block;
        }

        .room-other-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.4s ease;
        }

        .room-other-thumb:hover img {
          transform: scale(1.04);
        }

        .room-other-body {
          padding: 1.15rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .room-other-body h3 {
          font-size: 1rem;
          font-weight: 700;
          color: #17384A;
          margin: 0;
          line-height: 1.35;
        }

        .room-other-price {
          font-size: 0.95rem;
          font-weight: 700;
          color: #9E7A3B;
          font-variant-numeric: tabular-nums;
          margin-bottom: 0.25rem;
        }

        .room-other-price small {
          font-weight: 500;
          color: #7A8B93;
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* 1. HEADER (BRAND + 6-ITEM NAV + PROMINENT CTA + MOBILE TOGGLE)     */}
      {/* ------------------------------------------------------------------ */}
      <header className="site-header over-hero">
        <div className="header-inner">
          <a
            href="/"
            className="brand"
            aria-label="SEAGULL LÝ SƠN, trang chủ"
            onClick={(e) => {
              e.preventDefault();
              handleNavigatePage('home');
            }}
          >
            <strong>SEAGULL LÝ SƠN</strong>
            <small>SEAGULL COFFEE &amp; HOMESTAY LÝ SƠN</small>
          </a>

          <nav id="mainNav" className="main-nav" aria-label="Điều hướng chính">
            <a
              href="/"
              className={activeSubPage === 'home' ? 'is-active' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home');
              }}
            >
              Trang chủ
            </a>
            <a
              href="/gioi-thieu"
              className={activeSubPage === 'about' ? 'is-active' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('about');
              }}
            >
              Giới thiệu
            </a>
            <a
              href="/#luu-tru"
              className={activeSubPage === 'room-detail' ? 'is-active' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home', 'luu-tru');
              }}
            >
              Phòng ở
            </a>
            <a
              href="/#coffee"
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home', 'coffee');
              }}
            >
              Cà phê
            </a>
            <a
              href="/dich-vu"
              className={activeSubPage === 'services' ? 'is-active' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('services');
              }}
            >
              Dịch vụ
            </a>
            <a
              href="/lien-he"
              className={activeSubPage === 'contact' ? 'is-active' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('contact');
              }}
            >
              Liên hệ
            </a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <a
              className="button header-cta"
              href="/#luu-tru"
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home', 'luu-tru');
              }}
            >
              Khám phá
            </a>

            <button
              type="button"
              className="menu-toggle"
              aria-controls="mainNav"
              aria-expanded={isMobileMenuOpen}
              aria-label="Mở menu"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div
            style={{
              background: '#102633',
              borderTop: '1px solid rgba(230, 213, 180, 0.15)',
              padding: '1rem 1.5rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <a
              href="/"
              style={{
                color: activeSubPage === 'home' ? '#E6D5B4' : '#D5DFE3',
                fontWeight: activeSubPage === 'home' ? 700 : 500,
                fontSize: '0.95rem',
              }}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home');
              }}
            >
              Trang chủ
            </a>
            <a
              href="/gioi-thieu"
              style={{
                color: activeSubPage === 'about' ? '#E6D5B4' : '#D5DFE3',
                fontWeight: activeSubPage === 'about' ? 700 : 500,
                fontSize: '0.95rem',
              }}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('about');
              }}
            >
              Giới thiệu
            </a>
            <a
              href="/#luu-tru"
              style={{ color: '#D5DFE3', fontSize: '0.95rem' }}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home', 'luu-tru');
              }}
            >
              Phòng ở
            </a>
            <a
              href="/#coffee"
              style={{ color: '#D5DFE3', fontSize: '0.95rem' }}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home', 'coffee');
              }}
            >
              Cà phê
            </a>
            <a
              href="/dich-vu"
              style={{
                color: activeSubPage === 'services' ? '#E6D5B4' : '#D5DFE3',
                fontWeight: activeSubPage === 'services' ? 700 : 500,
                fontSize: '0.95rem',
              }}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('services');
              }}
            >
              Dịch vụ
            </a>
            <a
              href="/lien-he"
              style={{
                color: activeSubPage === 'contact' ? '#E6D5B4' : '#D5DFE3',
                fontWeight: activeSubPage === 'contact' ? 700 : 500,
                fontSize: '0.95rem',
              }}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('contact');
              }}
            >
              Liên hệ
            </a>
            <a
              href="/#luu-tru"
              className="button header-cta"
              style={{ textAlign: 'center', marginTop: '0.4rem' }}
              onClick={(e) => {
                e.preventDefault();
                handleNavigatePage('home', 'luu-tru');
              }}
            >
              Khám phá
            </a>
          </div>
        )}
      </header>

      {/* ================================================================== */}
      {/* SUBPAGE VIEWS: GIỚI THIỆU / DỊCH VỤ / LIÊN HỆ                      */}
      {/* ================================================================== */}
      {activeSubPage === 'about' && (
        <SeagullAboutPage
          propertyConfig={propertyConfig}
          onNavigatePage={handleNavigatePage}
          onNavigateToBooking={onNavigateToBooking}
        />
      )}

      {activeSubPage === 'services' && (
        <SeagullServicesPage
          propertyConfig={propertyConfig}
          serviceItems={serviceItems}
          onUpdateServiceItems={onUpdateServiceItems}
          onNavigatePage={handleNavigatePage}
          onNavigateToBooking={onNavigateToBooking}
        />
      )}

      {activeSubPage === 'contact' && (
        <SeagullContactPage
          propertyConfig={propertyConfig}
          onNavigatePage={handleNavigatePage}
          onNavigateToBooking={onNavigateToBooking}
        />
      )}

      {activeSubPage === 'room-detail' && (() => {
        const matchedRoom = activeRoomParam
          ? findRoomBySlugOrId(activeRoomTypes, activeRoomParam) ||
            findRoomBySlugOrId(roomTypes, activeRoomParam)
          : undefined;
        const otherRooms = matchedRoom
          ? activeRoomTypes.filter((r) => r.id !== matchedRoom.id)
          : [];
        return (
          <SeagullRoomDetailPage
            room={matchedRoom}
            otherRooms={otherRooms}
            propertyConfig={propertyConfig}
            onBackToRooms={() => handleNavigatePage('home', 'luu-tru')}
            onSelectOtherRoom={handleOpenRoomDetail}
            onOpenLightbox={handleOpenRoomGallery}
            onBookRoom={(query) => onNavigateToBooking?.(query)}
          />
        );
      })()}

      {/* ================================================================== */}
      {/* HOMEPAGE VIEW (ORIGINAL STRUCTURE PRESERVED INTACT)                */}
      {/* ================================================================== */}
      {activeSubPage === 'home' && (
      <>
      {/* ------------------------------------------------------------------ */}
      {/* 2. HERO SECTION (INTERACTIVE CAROUSEL + CONTENT)                   */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="hero"
        id="hero"
        aria-labelledby="heroTitle"
        onMouseEnter={() => setIsHeroPaused(true)}
        onMouseLeave={() => setIsHeroPaused(false)}
      >
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className={`hero-slide-layer ${index === heroSlideIndex ? 'is-active' : ''}`}
            aria-hidden={index !== heroSlideIndex}
          >
            <img
              id={index === 0 ? 'hero-video' : undefined}
              className="hero-image"
              src={slide.src}
              alt={slide.alt}
              style={{ objectPosition: slide.objectPosition || 'center center' }}
              loading={index === 0 ? 'eager' : 'lazy'}
              referrerPolicy="no-referrer"
            />
          </div>
        ))}
        <div className="hero-shade"></div>

        <span className="hero-slide-badge" aria-live="polite">
          {HERO_SLIDES[heroSlideIndex].badge}
        </span>

        <button
          type="button"
          className="hero-nav-btn hero-nav-prev"
          onClick={handlePrevHeroSlide}
          aria-label="Ảnh trước"
        >
          ‹
        </button>
        <button
          type="button"
          className="hero-nav-btn hero-nav-next"
          onClick={handleNextHeroSlide}
          aria-label="Ảnh tiếp theo"
        >
          ›
        </button>

        <div className="hero-content">
          <span className="eyebrow">SEAGULL COFFEE &amp; HOMESTAY LÝ SƠN</span>
          <h1 id="heroTitle">
            SEAGULL <span>LÝ SƠN</span>
          </h1>
          <p id="heroDescription">
            {propertyConfig?.slogan || 'Nơi chữa lành tâm hồn bạn.'}
          </p>
          <div className="hero-actions">
            <a className="button light" href="#luu-tru">
              Khám phá không gian
            </a>
          </div>
        </div>

        <div className="hero-dots" role="tablist" aria-label="Chọn ảnh trình chiếu">
          {HERO_SLIDES.map((slide, idx) => (
            <button
              key={slide.src}
              type="button"
              role="tab"
              aria-selected={idx === heroSlideIndex}
              aria-label={`Xem ảnh ${idx + 1}: ${slide.badge}`}
              className={`hero-dot ${idx === heroSlideIndex ? 'is-active' : ''}`}
              onClick={() => setHeroSlideIndex(idx)}
            />
          ))}
        </div>

        <div className="hero-caption">
          <span>CUỘN ĐỂ KHÁM PHÁ</span>
          <span>{HERO_SLIDES[heroSlideIndex].caption}</span>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2.5 QUICK AVAILABILITY SEARCH BAR (OVERLAPPING HERO BOTTOM EDGE)   */}
      {/* ------------------------------------------------------------------ */}
      <div className="hero-search-wrap" role="search" aria-label="Tìm phòng trống Seagull Lý Sơn">
        <form className="hero-search-card" onSubmit={handleQuickSearchSubmit} noValidate>
          <div className="hero-search-meta">
            <strong>Tìm phòng trống trực tiếp</strong>
            <span className="hero-search-summary">
              {quickNights > 0 ? `${quickNights} đêm` : 'Chọn ngày'} · {quickAdults} người lớn
              {quickChildren > 0 ? ` · ${quickChildren} trẻ em` : ''}
            </span>
          </div>

          <div className="hero-search-grid">
            <div className="hero-search-field">
              <label htmlFor="heroQuickCheckin">Ngày nhận phòng</label>
              <input
                id="heroQuickCheckin"
                name="checkin"
                type="date"
                className="hero-search-input"
                min={todayIso}
                value={quickCheckin}
                onChange={(e) => handleQuickCheckinChange(e.target.value)}
                required
              />
            </div>

            <div className="hero-search-field">
              <label htmlFor="heroQuickCheckout">Ngày trả phòng</label>
              <input
                id="heroQuickCheckout"
                name="checkout"
                type="date"
                className="hero-search-input"
                min={quickCheckin ? addDaysIso(quickCheckin, 1) : addDaysIso(todayIso, 1)}
                value={quickCheckout}
                onChange={(e) => handleQuickCheckoutChange(e.target.value)}
                required
              />
            </div>

            <div className="hero-search-guests">
              <div className="hero-search-field">
                <label htmlFor="heroQuickAdults">Người lớn</label>
                <select
                  id="heroQuickAdults"
                  name="adults"
                  className="hero-search-input"
                  value={quickAdults}
                  onChange={(e) => setQuickAdults(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} người lớn
                    </option>
                  ))}
                </select>
              </div>

              <div className="hero-search-field">
                <label htmlFor="heroQuickChildren">Trẻ em</label>
                <select
                  id="heroQuickChildren"
                  name="children"
                  className="hero-search-input"
                  value={quickChildren}
                  onChange={(e) => setQuickChildren(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} trẻ em
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hero-search-submit-wrap">
              <button type="submit" className="hero-search-submit">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span>Tìm phòng trống</span>
              </button>
            </div>
          </div>

          {quickSearchError && (
            <p className="hero-search-error" role="alert">
              {quickSearchError}
            </p>
          )}
        </form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. HERO BOOKING CTA STRIP                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="hero-booking-cta" role="region" aria-labelledby="bookingCtaTitle">
        <div className="hero-booking-inner">
          <div>
            <h2 id="bookingCtaTitle">Đặt phòng tại Seagull Lý Sơn</h2>
            <p>Liên hệ trực tiếp để được tư vấn phòng và ngày lưu trú.</p>
          </div>
          <a
            className="button hero-booking-call"
            href="https://zalo.me/0868011799"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Gọi đặt phòng Seagull qua số 0868 011 799"
          >
            Gọi đặt phòng · <span>0868 011 799</span>
          </a>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. SECTION 01 / NGHỈ NGƠI - KHÔNG GIAN PHÒNG Ở                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="section" id="luu-tru" aria-labelledby="rooms-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / NGHỈ NGƠI</span>
            <h2 id="rooms-title">Không gian phòng ở</h2>
          </div>
          <p>Một chốn nghỉ ấm áp, mở ra khoảng trời và biển Lý Sơn.</p>
        </div>

        {/* Real Room Types Grid (Single source of truth synced with /booking & Admin CMS) */}
        <div className="room-grid" style={{ marginBottom: '3.5rem' }}>
          {activeRoomTypes.map((rt) => {
            const galleryCount = Array.from(
              new Set([rt.image, ...(rt.galleryImages || [])].filter(Boolean))
            ).length;
            const depositPercent = rt.depositPercent ?? 30;
            const specsParts = [
              rt.size,
              `${rt.bedrooms ?? 1} phòng ngủ`,
              `${rt.bathrooms ?? 1} phòng tắm`,
              (rt.hasBalcony ?? true) ? 'Có ban công' : null,
            ].filter(Boolean);

            return (
              <article key={rt.id} className="room-card">
                <button
                  type="button"
                  className="image-button"
                  aria-label={`Xem bộ ảnh ${rt.name}`}
                  onClick={() => handleOpenRoomGallery(rt)}
                >
                  <img
                    src={rt.image}
                    alt={rt.name}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  {galleryCount > 1 && (
                    <span className="room-gallery-count">{galleryCount} ảnh</span>
                  )}
                </button>

                <div className="room-card-copy">
                  <h3>{rt.name}</h3>

                  <div className="room-card-price-row">
                    <span className="room-card-price">
                      {rt.basePrice.toLocaleString('vi-VN')} đ <small>/ đêm</small>
                    </span>
                    <span className="room-card-deposit">Cọc {depositPercent}%</span>
                  </div>

                  <div className="room-card-specs">
                    {specsParts.join(' · ')}
                  </div>

                  <p className="room-card-desc">{rt.description}</p>

                  <div className="room-card-footer">
                    <button
                      type="button"
                      className="room-card-cta"
                      onClick={() => handleOpenRoomDetail(rt)}
                    >
                      <span>Xem chi tiết &amp; Đặt phòng</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Stay Invitation Block & Interactive Reservation Form */}
        <div className="stay-invitation" id="yeu-cau-luu-tru">
          <div className="stay-intro">
            <span className="eyebrow">SEAGULL LÝ SƠN · 27 CĂN PHÒNG VẬN HÀNH</span>
            <h3>
              Kỳ nghỉ an yên,
              <br />
              bắt đầu từ đây.
            </h3>
            <p>
              Chọn ngày ghé đảo và số phòng bạn cần. Seagull sẽ xác nhận loại phòng, sức chứa và giá
              khi chính thức mở đặt phòng.
            </p>
            <figure className="stay-poster">
              <img
                src="/assets/seagull-hero.jpg?v=seagull2"
                alt="Phối cảnh Seagull Coffee & Homestay Lý Sơn nhìn ra biển"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <figcaption>Phối cảnh dự kiến Seagull Coffee &amp; Homestay Lý Sơn</figcaption>
            </figure>
            <ul className="stay-highlights">
              <li>Không gian nghỉ với chất liệu gỗ ấm áp</li>
              <li>Góc cà phê cho những cuộc hẹn bên biển</li>
              <li>Lựa chọn nhiều phòng cho gia đình và nhóm bạn</li>
            </ul>
          </div>

          <div className="stay-card">
            <div className="stay-card-top">
              <div>
                <span className="stay-price">Liên hệ báo giá</span>
                <span className="stay-price-note">Theo loại phòng và ngày lưu trú</span>
              </div>
              <span className="badge">Bản mẫu</span>
            </div>

            <form id="stayRequestForm" onSubmit={handleStayFormSubmit}>
              <div className="stay-input-grid">
                <label htmlFor="stayCheckin">
                  Ngày nhận phòng
                  <input
                    id="stayCheckin"
                    name="checkin"
                    type="date"
                    value={checkinDate}
                    onChange={(e) => setCheckinDate(e.target.value)}
                    required
                  />
                </label>

                <label htmlFor="stayCheckout">
                  Ngày trả phòng
                  <input
                    id="stayCheckout"
                    name="checkout"
                    type="date"
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    required
                  />
                </label>

                <label htmlFor="stayRoomCount">
                  Số phòng
                  <select
                    id="stayRoomCount"
                    name="rooms"
                    value={roomCount}
                    onChange={(e) => setRoomCount(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((num) => (
                      <option key={num} value={num}>
                        {num} phòng
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="stayGuests">
                  Số khách
                  <input
                    id="stayGuests"
                    name="guests"
                    type="number"
                    min="1"
                    max="200"
                    step="1"
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    required
                  />
                </label>
              </div>

              <p className="stay-capacity-note">
                Bao gồm trẻ em. Sức chứa sẽ được xác nhận theo loại phòng; số phòng chọn chưa phản
                ánh phòng trống.
              </p>

              {formError && (
                <p id="stayDateError" className="form-error" role="alert">
                  {formError}
                </p>
              )}

              <button type="submit" className="button stay-request-button">
                Yêu cầu giữ chỗ ngay
              </button>

              <p className="stay-demo-note">
                Chỉ xem trước yêu cầu · Chưa gửi, chưa giữ phòng và chưa thu tiền.
              </p>

              {reservationResult && (
                <div className="stay-request-result" id="stayRequestResult" role="status">
                  <strong>Yêu cầu dự kiến của bạn:</strong>
                  <p style={{ marginTop: '0.4rem', lineHeight: '1.5' }}>
                    Nhận phòng: <strong>{reservationResult.checkin}</strong> · Trả phòng:{' '}
                    <strong>{reservationResult.checkout}</strong> ({reservationResult.nights} đêm)
                    <br />
                    Quy mô: <strong>{reservationResult.rooms} phòng</strong> cho{' '}
                    <strong>{reservationResult.guests} khách</strong>.
                  </p>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <a
                      href={`https://zalo.me/0868011799`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.75rem',
                        background: '#0068FF',
                        color: '#fff',
                      }}
                    >
                      Gửi Zalo đặt phòng
                    </a>
                    {onNavigateToBooking && (
                      <button
                        type="button"
                        onClick={() => onNavigateToBooking()}
                        className="button"
                        style={{
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.75rem',
                          background: '#17384A',
                        }}
                      >
                        Mở cổng đặt phòng trực tiếp
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. SECTION 02 / GẶP GỠ - KHÔNG GIAN CÀ PHÊ                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="coffee" className="coffee-section" aria-labelledby="coffee-title">
        <div className="coffee-container">
          <div className="coffee-image">
            <button
              type="button"
              className="image-button"
              data-gallery="0"
              aria-label="Xem ảnh thực tế góc cà phê nhìn ra bến cảng Lý Sơn"
              onClick={() => handleOpenGallery(0)}
            >
              <img
                src="/assets/lyson-harbor-real.jpg"
                alt="Ảnh thực tế góc cà phê Seagull nhìn ra bến cảng Lý Sơn"
                style={{ objectPosition: 'center 35%' }}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </button>
            <span className="photo-label">Ảnh thực tế · View bến cảng Lý Sơn</span>
          </div>

          <div className="coffee-copy">
            <span className="eyebrow">02 / GẶP GỠ</span>
            <h2 id="coffee-title">Không gian cà phê</h2>
            <p>
              Một tách cà phê, một khoảng sân xanh.
              <br />
              Dành thời gian cho mình và những người thương.
            </p>

            <div className="coffee-details">
              <button
                type="button"
                className="image-button"
                data-gallery="1"
                aria-label="Xem ảnh thực tế bãi biển và chèo SUP"
                onClick={() => handleOpenGallery(1)}
              >
                <img
                  src="/assets/lyson-beach-sup-real.jpg"
                  alt="Ảnh thực tế bãi biển san hô và chèo SUP dưới chân đồi Seagull"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </button>

              <button
                type="button"
                className="image-button"
                data-gallery="2"
                aria-label="Xem phối cảnh Seagull Coffee"
                onClick={() => handleOpenGallery(2)}
              >
                <img
                  src="/assets/seagull-hero.jpg?v=seagull2"
                  alt="Phối cảnh Seagull Coffee & Homestay Lý Sơn"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </button>
            </div>

            <a
              className="underlined"
              href="https://maps.app.goo.gl/yaYH56pM37VPbjnv7"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ghé Seagull trên Google Maps →
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. SECTION 03 / ĐIỂM HẸN - ĐÁNH GIÁ KHÁCH & VỊ TRÍ                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="section reviews-location" id="danh-gia" aria-labelledby="reviews-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">03 / ĐIỂM HẸN</span>
            <h2 id="reviews-title">Đánh giá khách & vị trí</h2>
          </div>
        </div>

        <div className="reviews-ambient-grid">
          <div className="review-samples">
            <p className="review-sample-label">NHẬN XÉT MINH HỌA · CHƯA PHẢI ĐÁNH GIÁ THỰC TẾ</p>

            <article className="review-sample">
              <div className="review-stars" aria-label="Minh họa mức đánh giá 5 sao">
                ★★★★★
              </div>
              <blockquote>
                “Một góc nghỉ yên tĩnh, chỉ muốn ngồi ở ban công và nhìn biển thật lâu.”
              </blockquote>
              <span>Nội dung mẫu 01</span>
            </article>

            <article className="review-sample">
              <div className="review-stars" aria-label="Minh họa mức đánh giá 5 sao">
                ★★★★★
              </div>
              <blockquote>
                “Căn phòng ấm áp và khoảng nhìn ra biển khiến buổi sáng trở nên thật nhẹ nhàng.”
              </blockquote>
              <span>Nội dung mẫu 02</span>
            </article>

            <article className="review-sample">
              <div className="review-stars" aria-label="Minh họa mức đánh giá 5 sao">
                ★★★★★
              </div>
              <blockquote>
                “Một tách cà phê, chút gió biển và thời gian thảnh thơi bên người thương.”
              </blockquote>
              <span>Nội dung mẫu 03</span>
            </article>
          </div>

          <figure className="ambient-figure">
            <div className="ambient-media">
              <img
                src="/assets/review-ambient-poster.jpg"
                alt="Minh họa cặp đôi uống cà phê trên ban công nhìn ra biển Lý Sơn"
                loading="lazy"
                decoding="async"
              />
              <button
                type="button"
                id="ambientToggle"
                className="ambient-toggle"
                onClick={toggleAmbientVideo}
                aria-label="Tạm dừng hoặc bật video cà phê"
              >
                {isAmbientPlaying ? 'Đang phát' : 'Tạm dừng'}
              </button>
            </div>
            <figcaption>
              Khoảnh khắc thảnh thơi bên tách cà phê sáng, nhìn ra biển Lý Sơn.
              <span>Video minh họa</span>
            </figcaption>
          </figure>
        </div>

        {/* Visit Grid & Google Maps */}
        <div className="visit-grid">
          <div className="review-copy">
            <span className="eyebrow">CẢM NHẬN TỪ KHÁCH GHÉ THĂM</span>
            <h3>
              Mỗi lần ghé,
              <br />
              một câu chuyện.
            </h3>
            <p>Xem đánh giá và chia sẻ trải nghiệm của bạn tại Seagull trên Google Maps.</p>
            <a
              className="button"
              href="https://maps.app.goo.gl/yaYH56pM37VPbjnv7"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginBottom: '1.5rem' }}
            >
              Xem đánh giá trên Google
            </a>

            <div className="visit-address" id="vi-tri">
              <h3>Seagull Lý Sơn</h3>
              <p>Homestay & cà phê · Đảo Lý Sơn</p>
              <a
                className="text-button"
                href="https://maps.app.goo.gl/yaYH56pM37VPbjnv7"
                target="_blank"
                rel="noopener noreferrer"
              >
                Chỉ đường đến Seagull
              </a>
            </div>
          </div>

          <div className="map-wrap">
            <iframe
              title="Bản đồ Seagull Lý Sơn Homestay & Coffee"
              src="https://maps.google.com/maps?cid=3047062392967181604&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            ></iframe>
            <a
              href="https://maps.app.goo.gl/yaYH56pM37VPbjnv7"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở bản đồ trong Google Maps ↗
            </a>
          </div>
        </div>
      </section>
      </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 7. GALLERY DIALOG (LIGHTBOX MODAL)                                 */}
      {/* ------------------------------------------------------------------ */}
      {galleryIndex !== null && galleryItems[galleryIndex] && (
        <div
          id="galleryDialog"
          className="gallery-dialog"
          role="dialog"
          aria-modal="true"
          onClick={handleCloseGallery}
        >
          <button
            type="button"
            className="dialog-close"
            data-close
            aria-label="Đóng ảnh"
            onClick={handleCloseGallery}
          >
            ×
          </button>

          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <img
              id="galleryImage"
              src={galleryItems[galleryIndex].src}
              alt={galleryItems[galleryIndex].alt}
              referrerPolicy="no-referrer"
            />

            <div className="gallery-controls">
              <button type="button" id="previousPhoto" aria-label="Ảnh trước" onClick={handlePrevPhoto}>
                ← Trước
              </button>
              <p id="galleryCaption" style={{ margin: '0 1rem', fontSize: '0.9rem' }}>
                {galleryItems[galleryIndex].caption} ({galleryIndex + 1}/{galleryItems.length})
              </p>
              <button type="button" id="nextPhoto" aria-label="Ảnh sau" onClick={handleNextPhoto}>
                Sau →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 8. COMPACT FOOTER                                                  */}
      {/* ------------------------------------------------------------------ */}
      <footer>
        <div className="compact-footer">
          <a
            className="brand"
            href="/"
            aria-label="SEAGULL LÝ SƠN, trang chủ"
            onClick={(e) => {
              e.preventDefault();
              handleNavigatePage('home');
            }}
          >
            <strong>SEAGULL LÝ SƠN</strong>
            <small>SEAGULL COFFEE &amp; HOMESTAY LÝ SƠN</small>
          </a>

          <nav className="footer-nav" aria-label="Điều hướng chân trang">
            <a href="/" onClick={(e) => { e.preventDefault(); handleNavigatePage('home'); }}>
              Trang chủ
            </a>
            <a href="/gioi-thieu" onClick={(e) => { e.preventDefault(); handleNavigatePage('about'); }}>
              Giới thiệu
            </a>
            <a href="/#luu-tru" onClick={(e) => { e.preventDefault(); handleNavigatePage('home', 'luu-tru'); }}>
              Phòng ở
            </a>
            <a href="/#coffee" onClick={(e) => { e.preventDefault(); handleNavigatePage('home', 'coffee'); }}>
              Cà phê
            </a>
            <a href="/dich-vu" onClick={(e) => { e.preventDefault(); handleNavigatePage('services'); }}>
              Dịch vụ
            </a>
            <a href="/#danh-gia" onClick={(e) => { e.preventDefault(); handleNavigatePage('home', 'danh-gia'); }}>
              Đánh giá &amp; vị trí
            </a>
            <a href="/lien-he" onClick={(e) => { e.preventDefault(); handleNavigatePage('contact'); }}>
              Liên hệ
            </a>
          </nav>

          <span>Lý Sơn · Quảng Ngãi · Việt Nam</span>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div id="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
