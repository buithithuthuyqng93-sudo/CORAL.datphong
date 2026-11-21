import React, { useState, useRef } from 'react';
import { 
  useSiteContent 
} from '../context/SiteContentContext';
import { 
  uploadAndSaveSiteContentImage, 
  restorePreviousSiteContentImage,
  validateImageFile,
  fileToDataUrl,
  MediaAsset,
  SiteContentItem
} from '../services/mediaService';
import { RoomType } from '../types';
import { CORAL_ROOM_TYPES } from '../data/mockData';
import { 
  Upload, Image as ImageIcon, RotateCcw, Save, X, Check, AlertCircle, 
  Monitor, Smartphone, Sliders, Info, ShieldCheck, Sparkles, Move, 
  Eye, RefreshCw, FolderOpen, Layers, CheckCircle2, Trash2, ArrowUp, ArrowDown
} from 'lucide-react';

interface MediaManagerPanelProps {
  roomTypes?: RoomType[];
  onUpdateRoomTypes?: (roomTypes: RoomType[]) => void;
  showToast?: (msg: string) => void;
}

export const MediaManagerPanel: React.FC<MediaManagerPanelProps> = ({
  roomTypes,
  onUpdateRoomTypes,
  showToast = (_msg: string) => {},
}) => {
  const activeRoomTypes = (roomTypes && roomTypes.length > 0) ? roomTypes : CORAL_ROOM_TYPES;
  const { siteContent, isDemoMode, refreshSiteContent, getMediaUrl, getMetadata } = useSiteContent();

  // Active sub-category tab
  type MediaCategory = 
    | 'hero'           // 1. Ảnh Hero trang chủ
    | 'logo'           // 2. Logo thương hiệu
    | 'about'          // 3. Ảnh giới thiệu
    | 'rooms'          // 4. Ảnh từng loại phòng
    | 'room-galleries' // 5. Gallery chi tiết phòng
    | 'amenities'      // 6. Ảnh tiện ích
    | 'cafe'           // 7. Ảnh khu café
    | 'locations'      // 8. Ảnh bản đồ hoặc địa điểm
    | 'general';       // 9. Thư viện hình ảnh chung

  const [activeCategory, setActiveCategory] = useState<MediaCategory>('hero');

  // Hero specific state
  const [heroFocalX, setHeroFocalX] = useState<number>(
    getMetadata('homepage.hero.desktop')?.focalPoint?.x ?? 50
  );
  const [heroFocalY, setHeroFocalY] = useState<number>(
    getMetadata('homepage.hero.desktop')?.focalPoint?.y ?? 50
  );
  const [heroOverlayOpacity, setHeroOverlayOpacity] = useState<number>(
    getMetadata('homepage.hero.desktop')?.overlayOpacity ?? 0.3
  );
  const [heroAltText, setHeroAltText] = useState<string>(
    getMetadata('homepage.hero.desktop')?.altText ?? 'Toàn cảnh Homestay & Cà Phê Seagull Lý Sơn'
  );
  const [heroPreviewMode, setHeroPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Temporary selected file preview state
  const [pendingUploads, setPendingUploads] = useState<Record<string, {
    file: File;
    previewUrl: string;
    altText: string;
  }>>({});

  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({});
  const [dragActiveKeys, setDragActiveKeys] = useState<Record<string, boolean>>({});

  // Room galleries state
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>(activeRoomTypes[0]?.id || '');
  const [roomGalleries, setRoomGalleries] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    activeRoomTypes.forEach((rt) => {
      init[rt.id] = [rt.image, ...PHOTO_PRESET_URLS.filter((u) => u !== rt.image).slice(0, 3)];
    });
    return init;
  });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------

  const handleFileSelect = async (contentKey: string, file: File) => {
    const val = validateImageFile(file);
    if (!val.valid) {
      alert(val.error);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPendingUploads((prev) => ({
        ...prev,
        [contentKey]: {
          file,
          previewUrl: dataUrl,
          altText: file.name.substring(0, file.name.lastIndexOf('.')),
        },
      }));
    } catch (err) {
      console.error('[File Select Error]:', err);
      alert('Không thể đọc tệp hình ảnh vừa chọn.');
    }
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveKeys((prev) => ({ ...prev, [key]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveKeys((prev) => ({ ...prev, [key]: false }));
  };

  const handleDrop = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveKeys((prev) => ({ ...prev, [key]: false }));

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(key, e.dataTransfer.files[0]);
    }
  };

  const handleSaveImage = async (contentKey: string, category: string) => {
    const pending = pendingUploads[contentKey];
    const currentMeta = getMetadata(contentKey);

    setUploadingKeys((prev) => ({ ...prev, [contentKey]: true }));

    try {
      let result;
      if (pending) {
        result = await uploadAndSaveSiteContentImage({
          file: pending.file,
          contentKey,
          category,
          altText: pending.altText,
          metadata: {
            ...currentMeta,
            focalPoint: contentKey.includes('hero') ? { x: heroFocalX, y: heroFocalY } : currentMeta.focalPoint,
            overlayOpacity: contentKey.includes('hero') ? heroOverlayOpacity : currentMeta.overlayOpacity,
          },
        });
      } else {
        // Only metadata update (like focal points)
        result = await uploadAndSaveSiteContentImage({
          file: new File([], 'dummy.jpg', { type: 'image/jpeg' }),
          contentKey,
          category,
          altText: heroAltText,
          metadata: {
            ...currentMeta,
            focalPoint: { x: heroFocalX, y: heroFocalY },
            overlayOpacity: heroOverlayOpacity,
            altText: heroAltText,
          },
        });
      }

      if (result.success) {
        showToast(`Đã lưu hình ảnh mới cho vị trí "${contentKey}" thành công!`);
        // Clear pending upload
        setPendingUploads((prev) => {
          const next = { ...prev };
          delete next[contentKey];
          return next;
        });
        await refreshSiteContent();
      } else {
        alert(result.error || 'Lỗi khi lưu hình ảnh');
      }
    } catch (err: any) {
      alert(`Đã xảy ra lỗi: ${err.message}`);
    } finally {
      setUploadingKeys((prev) => ({ ...prev, [contentKey]: false }));
    }
  };

  const handleCancelPending = (contentKey: string) => {
    setPendingUploads((prev) => {
      const next = { ...prev };
      delete next[contentKey];
      return next;
    });
  };

  const handleRestorePrevious = async (contentKey: string) => {
    if (!confirm(`Bạn có chắc chắn muốn khôi phục lại ảnh trước đó cho vị trí "${contentKey}" không?`)) {
      return;
    }

    setUploadingKeys((prev) => ({ ...prev, [contentKey]: true }));
    try {
      const res = await restorePreviousSiteContentImage(contentKey);
      if (res.success) {
        showToast(`Đã khôi phục thành công ảnh trước cho "${contentKey}"!`);
        await refreshSiteContent();
      } else {
        alert(res.error || 'Không thể khôi phục ảnh cũ');
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setUploadingKeys((prev) => ({ ...prev, [contentKey]: false }));
    }
  };

  // Helper renderer for single image location card
  const renderSingleImageSlot = (params: {
    keyName: string;
    title: string;
    description: string;
    category: string;
    recommendedSize: string;
    defaultFallback: string;
  }) => {
    const { keyName, title, description, category, recommendedSize, defaultFallback } = params;
    const currentUrl = getMediaUrl(keyName, defaultFallback);
    const pending = pendingUploads[keyName];
    const isUploading = uploadingKeys[keyName];
    const isDragActive = dragActiveKeys[keyName];

    const displayUrl = pending ? pending.previewUrl : currentUrl;

    return (
      <div key={keyName} className="bg-[#151B17] border border-[#2D3931] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2D3931] pb-3">
          <div>
            <h4 className="font-serif text-lg font-bold text-[#FAF8F5] flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#C8A261]" />
              <span>{title}</span>
            </h4>
            <p className="text-xs text-[#B8A99A] mt-0.5">{description}</p>
          </div>
          <span className="text-[11px] font-mono bg-[#1C2321] text-[#C8A261] border border-[#2D3931] px-2.5 py-1 rounded-full shrink-0 w-fit">
            Kích thước khuyên dùng: {recommendedSize}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Preview Container */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#D5CBBF] flex items-center justify-between">
              <span>Hình ảnh hiển thị hiện tại</span>
              {pending && (
                <span className="text-amber-400 font-normal text-[11px] bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                  Đang xem trước (Chưa lưu)
                </span>
              )}
            </label>
            <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2D3931] bg-[#111613] group shadow-inner">
              <img
                src={displayUrl}
                alt={title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#151B17] text-white p-2 rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-[#C8A261] hover:text-black transition"
                >
                  <Eye className="w-4 h-4" /> xem ảnh gốc
                </a>
              </div>
            </div>
          </div>

          {/* Controls & Upload Zone */}
          <div className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => handleDragOver(e, keyName)}
              onDragLeave={(e) => handleDragLeave(e, keyName)}
              onDrop={(e) => handleDrop(e, keyName)}
              onClick={() => fileInputRefs.current[keyName]?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                isDragActive
                  ? 'border-[#C8A261] bg-[#C8A261]/10 scale-[0.99]'
                  : 'border-[#2D3931] bg-[#111613]/60 hover:border-[#C8A261]/60 hover:bg-[#111613]'
              }`}
            >
              <input
                type="file"
                ref={(el) => (fileInputRefs.current[keyName] = el)}
                accept="image/jpeg,image/png,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(keyName, e.target.files[0]);
                  }
                }}
              />
              <Upload className="w-7 h-7 text-[#C8A261]" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#FAF8F5]">
                  Nhấp chọn tệp hoặc Kéo thả ảnh vào đây
                </p>
                <p className="text-[11px] text-[#B8A99A]">
                  Hỗ trợ tệp: JPG, PNG, WebP (Tối đa 8MB)
                </p>
              </div>
            </div>

            {/* ALT text field */}
            <div>
              <label className="block text-[11px] font-bold text-[#D5CBBF] mb-1">
                Văn bản thay thế (ALT Text chuẩn SEO)
              </label>
              <input
                type="text"
                placeholder="Nhập mô tả hình ảnh..."
                value={pending ? pending.altText : getMetadata(keyName)?.altText || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (pending) {
                    setPendingUploads((prev) => ({
                      ...prev,
                      [keyName]: { ...prev[keyName], altText: val },
                    }));
                  }
                }}
                className="w-full bg-[#111613] border border-[#2D3931] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8A261]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSaveImage(keyName, category)}
                disabled={isUploading}
                className={`flex-1 min-w-[120px] bg-[#C8A261] hover:bg-[#B38E46] text-[#151B17] font-bold py-2.5 px-4 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-2 ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang tải lên...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu Thay Đổi</span>
                  </>
                )}
              </button>

              {pending && (
                <button
                  type="button"
                  onClick={() => handleCancelPending(keyName)}
                  disabled={isUploading}
                  className="bg-[#2D3931] hover:bg-[#3D4B42] text-white font-medium py-2.5 px-3 rounded-xl transition text-xs flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  <span>Hủy</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleRestorePrevious(keyName)}
                disabled={isUploading}
                title="Khôi phục ảnh trước đó"
                className="bg-[#111613] border border-[#2D3931] hover:border-amber-500/50 text-[#B8A99A] hover:text-amber-400 py-2.5 px-3 rounded-xl transition text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Khôi Phục Ảnh Cũ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="bg-[#151B17] border border-[#2D3931] rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C8A261]/15 border border-[#C8A261]/30 text-[#C8A261] flex items-center justify-center shrink-0">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-[#FAF8F5] flex items-center gap-2">
              <span>Hệ Thống Quản Lý Hình Ảnh Trực Tiếp Website</span>
              {isDemoMode ? (
                <span className="text-[10px] font-sans font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Chế độ Demo Local
                </span>
              ) : (
                <span className="text-[10px] font-sans font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Supabase Storage Connected
                </span>
              )}
            </h3>
            <p className="text-xs text-[#B8A99A] mt-0.5">
              Thay đổi hình ảnh lập tức trên website công khai mà không cần sửa code, không cần deploy Vercel lại.
            </p>
          </div>
        </div>

        <button
          onClick={async () => {
            await refreshSiteContent();
            showToast('Đã làm mới danh mục kho ảnh từ máy chủ!');
          }}
          className="bg-[#1C2321] hover:bg-[#2D3931] border border-[#2D3931] text-[#D5CBBF] hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 self-start md:self-auto transition shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Đồng Bộ Dữ Liệu Anh</span>
        </button>
      </div>

      {/* Sub-Category Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {[
          { id: 'hero', label: '1. Ảnh Hero Trang Chủ', icon: Monitor },
          { id: 'logo', label: '2. Logo Thương Hiệu', icon: Sparkles },
          { id: 'about', label: '3. Ảnh Giới Thiệu', icon: FolderOpen },
          { id: 'rooms', label: '4. Ảnh Từng Loại Phòng', icon: Layers },
          { id: 'room-galleries', label: '5. Gallery Chi Tiết Phòng', icon: ImageIcon },
          { id: 'cafe', label: '6. Ảnh Khu Café', icon: Info },
          { id: 'amenities', label: '7. Ảnh Tiện Ích', icon: CheckCircle2 },
          { id: 'locations', label: '8. Ảnh Bản Đồ / Vị Trí', icon: Move },
          { id: 'general', label: '9. Thư Viện Ảnh Chung', icon: FolderOpen },
        ].map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as MediaCategory)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 shrink-0 border ${
                isActive
                  ? 'bg-[#C8A261] text-[#151B17] border-[#C8A261] shadow-md'
                  : 'bg-[#151B17] text-[#B8A99A] border-[#2D3931] hover:text-white hover:border-[#C8A261]/50'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* CATEGORY 1: HERO IMAGE MANAGEMENT */}
      {activeCategory === 'hero' && (
        <div className="space-y-6">
          <div className="bg-[#151B17] border border-[#2D3931] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D3931] pb-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-[#FAF8F5] flex items-center gap-2">
                  <Monitor className="w-6 h-6 text-[#C8A261]" />
                  <span>Quản Lý Ảnh Hero Trang Chủ (Header Background)</span>
                </h3>
                <p className="text-xs text-[#B8A99A] mt-1">
                  Cấu hình ảnh banner chính, ảnh mobile riêng biệt, điểm tập trung ngắm cảnh (Focal Point) và lớp phủ tối bảo vệ độ tương phản chữ.
                </p>
              </div>

              {/* Viewport Preview Switcher */}
              <div className="flex items-center gap-1 bg-[#111613] border border-[#2D3931] p-1 rounded-xl shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setHeroPreviewMode('desktop')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    heroPreviewMode === 'desktop'
                      ? 'bg-[#C8A261] text-[#151B17]'
                      : 'text-[#B8A99A] hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Desktop View
                </button>
                <button
                  onClick={() => setHeroPreviewMode('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    heroPreviewMode === 'mobile'
                      ? 'bg-[#C8A261] text-[#151B17]'
                      : 'text-[#B8A99A] hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Mobile View
                </button>
              </div>
            </div>

            {/* Live Interactive Device Preview Frame */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#D5CBBF] flex items-center justify-between">
                <span>Khung Xem Trước Trực Tiếp Ngay Trên Website</span>
                <span className="text-xs text-[#C8A261] font-normal">
                  Chế độ: {heroPreviewMode === 'desktop' ? 'Màn hình máy tính (1920x1080)' : 'Điện thoại di động (390x844)'}
                </span>
              </label>

              <div
                className={`mx-auto transition-all duration-300 relative rounded-2xl overflow-hidden border-2 border-[#C8A261]/60 shadow-2xl bg-[#111613] ${
                  heroPreviewMode === 'desktop' ? 'w-full aspect-[21/9]' : 'max-w-[340px] aspect-[9/16]'
                }`}
              >
                {/* Hero Image with Focal Point Alignment */}
                <img
                  src={
                    pendingUploads['homepage.hero.desktop']
                      ? pendingUploads['homepage.hero.desktop'].previewUrl
                      : getMediaUrl('homepage.hero.desktop', '/images/coral-hero.jpg')
                  }
                  alt={heroAltText}
                  referrerPolicy="no-referrer"
                  style={{
                    objectPosition: `${heroFocalX}% ${heroFocalY}%`,
                  }}
                  className="w-full h-full object-cover filter brightness-95 contrast-[1.05] transition-all duration-300"
                />

                {/* Dark Overlay Layer (Preserved as current UI design) */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#151B17] via-[#151B17]/40 to-black/25 transition-opacity"
                  style={{ opacity: heroOverlayOpacity + 0.5 }}
                ></div>

                {/* Simulated Overlay Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white pointer-events-none">
                  <span className="text-[10px] tracking-widest uppercase bg-[#C8A261]/30 border border-[#C8A261]/50 px-3 py-1 rounded-full font-bold mb-2">
                    LÝ SƠN ISLAND • CLIFFSIDE BUNGALOW & CAFE
                  </span>
                  <h2 className="font-serif text-xl md:text-3xl font-extrabold tracking-wide drop-shadow-lg">
                    HOMESTAY & CÀ PHÊ SEAGULL
                  </h2>
                  <p className="text-xs max-w-md text-stone-200 mt-2 hidden sm:block opacity-90">
                    Tận hưởng không gian kiến trúc mái vòm độc đáo nhỏ ra vách núi ngắm trọn vẹn bình minh & hoàng hôn đại dương Lý Sơn.
                  </p>
                </div>
              </div>
            </div>

            {/* Focal Point & Overlay Adjustment Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#111613] p-4 rounded-xl border border-[#2D3931]">
              <div>
                <label className="block text-xs font-bold text-[#D5CBBF] mb-1.5 flex items-center justify-between">
                  <span>Điểm căn lề ngang (Horizontal Focal X)</span>
                  <span className="font-mono text-[#C8A261]">{heroFocalX}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={heroFocalX}
                  onChange={(e) => setHeroFocalX(Number(e.target.value))}
                  className="w-full accent-[#C8A261] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#B8A99A] mt-1">
                  <span>Trái (0%)</span>
                  <span>Giữa (50%)</span>
                  <span>Phải (100%)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D5CBBF] mb-1.5 flex items-center justify-between">
                  <span>Điểm căn lề dọc (Vertical Focal Y)</span>
                  <span className="font-mono text-[#C8A261]">{heroFocalY}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={heroFocalY}
                  onChange={(e) => setHeroFocalY(Number(e.target.value))}
                  className="w-full accent-[#C8A261] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#B8A99A] mt-1">
                  <span>Đỉnh (0%)</span>
                  <span>Giữa (50%)</span>
                  <span>Đáy (100%)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D5CBBF] mb-1.5 flex items-center justify-between">
                  <span>Độ phủ tối bảo vệ chữ (Overlay Opacity)</span>
                  <span className="font-mono text-[#C8A261]">{Math.round(heroOverlayOpacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={heroOverlayOpacity}
                  onChange={(e) => setHeroOverlayOpacity(Number(e.target.value))}
                  className="w-full accent-[#C8A261] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#B8A99A] mt-1">
                  <span>Sáng rõ</span>
                  <span>Tiêu chuẩn</span>
                  <span>Tối sâu</span>
                </div>
              </div>
            </div>

            {/* Upload Control Slotted Components for Hero Desktop and Mobile */}
            <div className="space-y-6 pt-2">
              {renderSingleImageSlot({
                keyName: 'homepage.hero.desktop',
                title: 'Ảnh Hero Desktop (Khuyên dùng 1920 x 1080px)',
                description: 'Hiển thị trên màn hình máy tính, laptop và máy tính bảng nằm ngang.',
                category: 'hero',
                recommendedSize: '1920x1080 (Dưới 8MB)',
                defaultFallback: '/images/coral-hero.jpg',
              })}

              {renderSingleImageSlot({
                keyName: 'homepage.hero.mobile',
                title: 'Ảnh Hero Mobile Riêng Biệt (Khuyên dùng 1080 x 1920px)',
                description: 'Tùy chọn tải riêng ảnh phiên bản màn hình dọc cho điện thoại di động.',
                category: 'hero',
                recommendedSize: '1080x1920 (Dưới 8MB)',
                defaultFallback: '/images/coral-hero.jpg',
              })}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 2: BRAND LOGO */}
      {activeCategory === 'logo' && (
        <div className="space-y-6">
          {renderSingleImageSlot({
            keyName: 'homepage.logo',
            title: 'Logo Thương Hiệu Homestay & Cà Phê Seagull',
            description: 'Hiển thị ở góc trái thanh điều hướng Header và chân trang.',
            category: 'logo',
            recommendedSize: '512x512 PNG trong suốt',
            defaultFallback: '/images/coral-hero.jpg',
          })}
        </div>
      )}

      {/* CATEGORY 3: ABOUT IMAGE */}
      {activeCategory === 'about' && (
        <div className="space-y-6">
          {renderSingleImageSlot({
            keyName: 'homepage.about.image',
            title: 'Ảnh Khung Giới Thiệu Homestay & Vách Núi',
            description: 'Ảnh minh họa không gian nghỉ dưỡng mái vòm trong phần giới thiệu tổng quan.',
            category: 'about',
            recommendedSize: '1200x800 JPG/WebP',
            defaultFallback: '/images/bungalow-row-sunset.jpg',
          })}
        </div>
      )}

      {/* CATEGORY 4: ROOM TYPES COVER IMAGES */}
      {activeCategory === 'rooms' && (
        <div className="space-y-6">
          <div className="bg-[#151B17] border border-[#2D3931] rounded-2xl p-5 shadow-xl">
            <h3 className="font-serif text-lg font-bold text-[#FAF8F5] mb-1">
              Ảnh Đại Diện Các Hạng Phòng
            </h3>
            <p className="text-xs text-[#B8A99A] mb-4">
              Cập nhật ảnh đại diện trực tiếp cho 4 hạng phòng bungalow.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeRoomTypes.map((rt) => (
                <div key={rt.id} className="bg-[#111613] border border-[#2D3931] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{rt.name}</h4>
                    <span className="text-xs text-[#C8A261] font-mono">{rt.basePrice.toLocaleString('vi-VN')}đ / đêm</span>
                  </div>

                  <div className="aspect-video rounded-lg overflow-hidden border border-[#2D3931]">
                    <img src={rt.image} alt={rt.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>

                  {renderSingleImageSlot({
                    keyName: `room.type.${rt.id}.cover`,
                    title: `Thay Ảnh Đại Diện - ${rt.name}`,
                    description: `Cập nhật ảnh bìa cho ${rt.name}`,
                    category: 'rooms',
                    recommendedSize: '800x600 JPG',
                    defaultFallback: rt.image,
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 5: ROOM GALLERIES */}
      {activeCategory === 'room-galleries' && (
        <div className="space-y-6">
          <div className="bg-[#151B17] border border-[#2D3931] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D3931] pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#FAF8F5]">
                  Thư Viện Ảnh Chi Tiết Cho Từng Hạng Phòng
                </h3>
                <p className="text-xs text-[#B8A99A]">
                  Tải lên nhiều ảnh, kéo thả thay đổi thứ tự, đặt làm ảnh đại diện và thêm mô tả ALT.
                </p>
              </div>

              {/* Room selector */}
              <select
                value={selectedRoomTypeId}
                onChange={(e) => setSelectedRoomTypeId(e.target.value)}
                className="bg-[#111613] border border-[#2D3931] text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-[#C8A261]"
              >
                {activeRoomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Gallery Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {(roomGalleries[selectedRoomTypeId] || []).map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-[#2D3931] bg-[#111613]"
                  >
                    <img src={imgUrl} alt={`Gallery ${idx}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                      <span className="text-[10px] font-bold bg-[#C8A261] text-black px-2 py-0.5 rounded w-fit">
                        #{idx + 1} {idx === 0 ? 'Ảnh Bìa' : ''}
                      </span>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            // Move to cover
                            const current = [...(roomGalleries[selectedRoomTypeId] || [])];
                            const item = current.splice(idx, 1)[0];
                            current.unshift(item);
                            setRoomGalleries((prev) => ({ ...prev, [selectedRoomTypeId]: current }));
                            showToast('Đã đặt làm ảnh đại diện!');
                          }}
                          className="bg-[#C8A261] text-black p-1.5 rounded hover:bg-white text-[10px] font-bold"
                          title="Đặt làm ảnh đại diện"
                        >
                          Làm Bìa
                        </button>
                        <button
                          onClick={() => {
                            const current = [...(roomGalleries[selectedRoomTypeId] || [])];
                            current.splice(idx, 1);
                            setRoomGalleries((prev) => ({ ...prev, [selectedRoomTypeId]: current }));
                            showToast('Đã xóa ảnh khỏi thư viện!');
                          }}
                          className="bg-rose-600 text-white p-1.5 rounded hover:bg-rose-700"
                          title="Xóa ảnh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add image slot */}
              {renderSingleImageSlot({
                keyName: `gallery.room.${selectedRoomTypeId}.new`,
                title: `Thêm Ảnh Mới Vào Thư Viện Phòng`,
                description: 'Tải ảnh phòng mới để bổ sung vào album chi tiết.',
                category: 'room-galleries',
                recommendedSize: '1200x800 JPG',
                defaultFallback: '/images/bungalow-cliff-day.jpg',
              })}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 6: CAFE IMAGES */}
      {activeCategory === 'cafe' && (
        <div className="space-y-6">
          {renderSingleImageSlot({
            keyName: 'homepage.cafe.image',
            title: 'Ảnh Khu vực Cà Phê Vòm Hoàng Hôn Cliffside',
            description: 'Ảnh giới thiệu khu uống cà phê ngắm biển Lý Sơn.',
            category: 'cafe',
            recommendedSize: '1200x800 JPG',
            defaultFallback: '/images/bungalow-sunset-front.jpg',
          })}
        </div>
      )}

      {/* CATEGORY 7: AMENITIES */}
      {activeCategory === 'amenities' && (
        <div className="space-y-6">
          {renderSingleImageSlot({
            keyName: 'homepage.amenity.bathtub',
            title: 'Ảnh Bồn Tắm Panorama Ngắm Biển',
            description: 'Ảnh minh họa bồn tắm sục sang trọng sát cửa sổ kính vòm.',
            category: 'amenities',
            recommendedSize: '800x600 JPG',
            defaultFallback: '/images/bungalow-bathtub-ocean.jpg',
          })}
        </div>
      )}

      {/* CATEGORY 8: LOCATION MAP */}
      {activeCategory === 'locations' && (
        <div className="space-y-6">
          {renderSingleImageSlot({
            keyName: 'homepage.location.image',
            title: 'Ảnh Vị Trí Vách Núi Vòm Cliffside Lý Sơn',
            description: 'Ảnh toàn cảnh vách đá địa chất độc đáo nơi đặt Homestay & Cà Phê Seagull.',
            category: 'locations',
            recommendedSize: '1200x800 JPG',
            defaultFallback: '/images/bungalow-cliff-day.jpg',
          })}
        </div>
      )}

      {/* CATEGORY 9: GENERAL LIBRARY */}
      {activeCategory === 'general' && (
        <div className="bg-[#151B17] border border-[#2D3931] rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="font-serif text-lg font-bold text-[#FAF8F5]">
            Thư Viện Hình Ảnh Dự Phòng Hiện Có Trực Tiếp Trên Hệ Thống
          </h3>
          <p className="text-xs text-[#B8A99A]">
            Tất cả các tệp ảnh gốc được lưu trữ an toàn trong thư mục public/images để làm phương án dự phòng 100% không bao giờ bị mất trang.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
            {[
              { name: 'seagull-hero.jpg', url: '/assets/seagull-hero.jpg?v=seagull2', label: 'Toàn cảnh Hero (Seagull Coffee)' },
              { name: 'lyson-harbor-real.jpg', url: '/assets/lyson-harbor-real.jpg', label: 'Ảnh thực tế · Bến cảng Lý Sơn' },
              { name: 'bungalow-harbor-view.png', url: '/assets/bungalow-harbor-view.png', label: 'Phòng vòm bồn tắm view bến cảng' },
              { name: 'lyson-beach-sup-real.jpg', url: '/assets/lyson-beach-sup-real.jpg', label: 'Ảnh thực tế · Bãi biển & SUP' },
              { name: 'bungalow-cliff-day.jpg', url: '/images/bungalow-cliff-day.jpg', label: 'Vách núi ban ngày' },
              { name: 'bungalow-row-sunset.jpg', url: '/images/bungalow-row-sunset.jpg', label: 'Dãy bungalow hoàng hôn' },
              { name: 'bungalow-bathtub-ocean.jpg', url: '/images/bungalow-bathtub-ocean.jpg', label: 'Bồn tắm panorama' },
              { name: 'bungalow-bedroom-twin.jpg', url: '/images/bungalow-bedroom-twin.jpg', label: 'Phòng vòm 2 giường' },
              { name: 'bungalow-sunset-front.jpg', url: '/images/bungalow-sunset-front.jpg', label: 'Khu vòm ngắm biển' },
            ].map((item, idx) => (
              <div key={idx} className="bg-[#111613] border border-[#2D3931] rounded-xl overflow-hidden p-2 space-y-2">
                <div className="aspect-video rounded-lg overflow-hidden border border-[#2D3931]">
                  <img src={item.url} alt={item.label} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white truncate">{item.label}</p>
                  <p className="text-[10px] font-mono text-[#B8A99A] truncate">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PHOTO_PRESET_URLS = [
  '/assets/seagull-hero.jpg?v=seagull2',
  '/assets/lyson-harbor-real.jpg',
  '/assets/bungalow-harbor-view.png',
  '/assets/lyson-beach-sup-real.jpg',
  '/images/bungalow-cliff-day.jpg',
  '/images/bungalow-row-sunset.jpg',
  '/images/bungalow-bathtub-ocean.jpg',
  '/images/bungalow-bedroom-twin.jpg',
  '/images/bungalow-sunset-front.jpg',
];
