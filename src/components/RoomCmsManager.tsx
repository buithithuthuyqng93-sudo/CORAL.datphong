import React, { useState, useEffect, useRef } from 'react';
import {
  BedDouble,
  Upload,
  Plus,
  Trash2,
  Star,
  Check,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  Save,
  AlertCircle,
  Lock,
  Sparkles,
  ExternalLink,
  Maximize2,
  Bath,
  Wind,
} from 'lucide-react';
import type { RoomType } from '../types';
import {
  apiListCmsContent,
  apiSaveCmsContent,
  apiUploadCmsImage,
  roomTypeToCmsPayload,
} from '../services/dataAdapter';

interface RoomCmsManagerProps {
  roomTypes: RoomType[];
  userRole: 'owner' | 'reception' | 'accountant';
  onUpdateRoomTypes: (updated: RoomType[]) => void;
  showToast: (msg: string) => void;
}

const QUICK_LOCAL_PRESETS = [
  { label: 'Bungalow Vòm View Biển (Ban ngày)', url: '/images/bungalow-cliff-day.jpg' },
  { label: 'VIP Bồn Tắm Panorama Biển', url: '/images/bungalow-bathtub-ocean.jpg' },
  { label: 'Dãy Bungalow Hoàng Hôn', url: '/images/bungalow-row-sunset.jpg' },
  { label: 'Phòng Vòm Nội Thất Gỗ', url: '/images/bungalow-bedroom-twin.jpg' },
  { label: 'Bungalow Đèn Vàng Hoàng Hôn', url: '/images/bungalow-sunset-front.jpg' },
  { label: 'Phòng Vòm Hướng Bến Cảng', url: '/assets/bungalow-harbor-view.png' },
  { label: 'Toàn Cảnh Seagull Lý Sơn', url: '/assets/seagull-hero.jpg' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh.'));
    reader.readAsDataURL(file);
  });
}

export const RoomCmsManager: React.FC<RoomCmsManagerProps> = ({
  roomTypes,
  userRole,
  onUpdateRoomTypes,
  showToast,
}) => {
  const canEdit = userRole === 'owner';

  const [selectedId, setSelectedId] = useState<string>(() => roomTypes[0]?.id || '');
  const [draft, setDraft] = useState<RoomType | null>(() => roomTypes[0] || null);
  const [newAmenityInput, setNewAmenityInput] = useState('');
  const [newImageUrlInput, setNewImageUrlInput] = useState('');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<'cover' | 'gallery' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Keep selected room & draft synced when roomTypes updates
  useEffect(() => {
    if (!roomTypes.length) return;
    const found = roomTypes.find((r) => r.id === selectedId) || roomTypes[0];
    if (found && found.id !== selectedId) {
      setSelectedId(found.id);
    }
    if (!draft || draft.id !== found.id) {
      setDraft({
        ...found,
        bedrooms: found.bedrooms ?? 1,
        bathrooms: found.bathrooms ?? 1,
        hasBalcony: found.hasBalcony ?? true,
        depositPercent: found.depositPercent ?? 30,
        galleryImages:
          found.galleryImages && found.galleryImages.length > 0
            ? found.galleryImages
            : [found.image].filter(Boolean),
        amenities: [...(found.amenities || [])],
      });
    }
  }, [roomTypes, selectedId]);

  const handleSelectRoom = (rt: RoomType) => {
    setSelectedId(rt.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    setDraft({
      ...rt,
      bedrooms: rt.bedrooms ?? 1,
      bathrooms: rt.bathrooms ?? 1,
      hasBalcony: rt.hasBalcony ?? true,
      depositPercent: rt.depositPercent ?? 30,
      galleryImages:
        rt.galleryImages && rt.galleryImages.length > 0
          ? Array.from(new Set([rt.image, ...rt.galleryImages].filter(Boolean)))
          : [rt.image].filter(Boolean),
      amenities: [...(rt.amenities || [])],
    });
  };

  const handleRefreshFromServer = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const token = sessionStorage.getItem('seagull_admin_token');
      const res = await apiListCmsContent('room', { includeInactive: false, token });
      if (res.success && Array.isArray(res.roomTypes) && res.roomTypes.length > 0) {
        onUpdateRoomTypes(res.roomTypes);
        const current = res.roomTypes.find((r) => r.id === selectedId) || res.roomTypes[0];
        if (current) {
          handleSelectRoom(current);
        }
        showToast('Đã đồng bộ danh sách hạng phòng mới nhất từ cơ sở dữ liệu.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải danh sách phòng từ máy chủ.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getAllImages = (rt: RoomType): string[] => {
    return Array.from(
      new Set([rt.image, ...(rt.galleryImages || [])].map((u) => (u || '').trim()).filter(Boolean))
    );
  };

  const handleUploadFile = async (file: File, target: 'cover' | 'gallery') => {
    if (!draft) return;
    if (!canEdit) {
      setErrorMsg('Chỉ tài khoản Chủ cơ sở (Owner) mới có quyền tải ảnh và chỉnh sửa phòng.');
      return;
    }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setErrorMsg('Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Dung lượng ảnh tối đa là 8MB. Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }

    const token = sessionStorage.getItem('seagull_admin_token');
    if (!token) {
      setErrorMsg('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    setUploadingSlot(target);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const fileBase64 = await fileToBase64(file);
      const uploaded = await apiUploadCmsImage(
        {
          contentType: 'room',
          itemId: draft.id,
          fileBase64,
          filename: file.name,
          mimeType: file.type,
          altText: draft.name,
        },
        token
      );

      const url = uploaded.publicUrl;
      const existing = getAllImages(draft);

      if (target === 'cover') {
        const nextGallery = [url, ...existing.filter((u) => u !== url)];
        setDraft({
          ...draft,
          image: url,
          galleryImages: nextGallery,
        });
        showToast('Đã tải ảnh đại diện mới! Nhấn "Lưu thay đổi" để cập nhật lên website.');
      } else {
        const nextGallery = existing.includes(url) ? existing : [...existing, url];
        setDraft({
          ...draft,
          image: draft.image || url,
          galleryImages: nextGallery,
        });
        showToast('Đã thêm ảnh phụ mới! Nhấn "Lưu thay đổi" để lưu vào cơ sở dữ liệu.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi tải ảnh lên máy chủ.');
    } finally {
      setUploadingSlot(null);
      if (coverInputRef.current) coverInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleSetAsCover = (url: string) => {
    if (!draft || !canEdit) return;
    const existing = getAllImages(draft);
    const reordered = [url, ...existing.filter((u) => u !== url)];
    setDraft({
      ...draft,
      image: url,
      galleryImages: reordered,
    });
  };

  const handleRemoveImage = (url: string) => {
    if (!draft || !canEdit) return;
    const remaining = getAllImages(draft).filter((u) => u !== url);
    if (remaining.length === 0) {
      setErrorMsg('Mỗi hạng phòng cần giữ lại ít nhất 1 ảnh đại diện.');
      return;
    }
    setDraft({
      ...draft,
      image: remaining[0],
      galleryImages: remaining,
    });
  };

  const handleAddImageByUrl = () => {
    if (!draft || !canEdit) return;
    const url = newImageUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('/') && !url.startsWith('https://') && !url.startsWith('http://')) {
      setErrorMsg('Đường dẫn ảnh phải bắt đầu bằng https://, http:// hoặc /images/...');
      return;
    }
    const existing = getAllImages(draft);
    const nextGallery = existing.includes(url) ? existing : [...existing, url];
    setDraft({
      ...draft,
      image: draft.image || url,
      galleryImages: nextGallery,
    });
    setNewImageUrlInput('');
    setErrorMsg(null);
  };

  const handleAddAmenity = () => {
    if (!draft || !canEdit) return;
    const trimmed = newAmenityInput.trim();
    if (!trimmed) return;
    if (draft.amenities.includes(trimmed)) {
      setNewAmenityInput('');
      return;
    }
    setDraft({
      ...draft,
      amenities: [...draft.amenities, trimmed],
    });
    setNewAmenityInput('');
  };

  const handleRemoveAmenity = (index: number) => {
    if (!draft || !canEdit) return;
    setDraft({
      ...draft,
      amenities: draft.amenities.filter((_, idx) => idx !== index),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    if (!canEdit) {
      setErrorMsg('Chỉ tài khoản Chủ cơ sở (Owner) mới có quyền lưu thay đổi.');
      return;
    }

    const token = sessionStorage.getItem('seagull_admin_token');
    if (!token) {
      setErrorMsg('Thiếu phiên đăng nhập quản trị. Vui lòng đăng nhập lại.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = roomTypeToCmsPayload(draft);
      const res = await apiSaveCmsContent(payload, token);

      const savedRoomType: RoomType = res.roomType || draft;
      const nextRoomTypes = roomTypes.map((r) => (r.id === savedRoomType.id ? savedRoomType : r));
      onUpdateRoomTypes(nextRoomTypes);
      handleSelectRoom(savedRoomType);

      const msg = `Đã lưu "${savedRoomType.name}" và đồng bộ ngay lên mục Phòng ở & trang /booking.`;
      setSuccessMsg(msg);
      showToast(msg);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể lưu thay đổi phòng lúc này.');
    } finally {
      setIsSaving(false);
    }
  };

  const imagesList = draft ? getAllImages(draft) : [];

  return (
    <div className="space-y-6">
      {/* Top Info Bar */}
      <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif font-bold text-lg text-[#0E2A47]">
              Quản lý Hạng Phòng (CMS Dùng Chung)
            </h2>
            <span className="text-[11px] font-mono text-[#8C7E6C]">
              • {roomTypes.length} hạng phòng
            </span>
          </div>
          <p className="text-xs text-[#6B5F50] mt-1">
            Mọi thay đổi về ảnh đại diện, ảnh phụ, giá bán, tỷ lệ cọc và thuộc tính phòng sẽ cập nhật đồng bộ ngay lập tức cho cả mục <strong>Phòng ở</strong> trên website chính và cổng đặt phòng <strong>/booking</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefreshFromServer}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] hover:bg-[#F3EEE3] text-[#0E2A47] text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Tải lại từ DB</span>
          </button>
          <a
            href="/booking"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-[#0E2A47] hover:bg-[#163A5F] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#C8A261]" />
            <span>Xem trang /booking</span>
          </a>
        </div>
      </div>

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
          <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Chế độ chỉ xem (Read-only)</strong>
            <span>
              Tài khoản của bạn không có quyền chỉnh sửa giá và nội dung phòng. Vui lòng đăng nhập bằng tài khoản <strong>Chủ cơ sở (Owner)</strong> để cập nhật.
            </span>
          </div>
        </div>
      )}

      {/* Main Split Workspace: Left Room List | Right Room Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Room Types List */}
        <div className="lg:col-span-4 bg-white border border-[#E5DECE] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5DECE] bg-[#FAF8F5] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0E2A47]">
              Danh sách hạng phòng
            </span>
            <span className="text-[11px] font-mono text-[#8C7E6C]">
              contentType: room
            </span>
          </div>

          <div className="divide-y divide-[#F0EBE1]">
            {roomTypes.map((rt) => {
              const isSelected = rt.id === selectedId;
              const depositPct = rt.depositPercent ?? 30;
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => handleSelectRoom(rt)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                    isSelected
                      ? 'bg-[#FAF5EB] border-l-4 border-l-[#C8A261]'
                      : 'hover:bg-[#FAF8F5] border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-[#E5DECE]">
                    <img
                      src={rt.image}
                      alt={rt.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#0E2A47] line-clamp-1">
                      {rt.name}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs font-mono font-bold text-[#9E7A3B] tabular-nums">
                      <span>{rt.basePrice.toLocaleString('vi-VN')} đ/đêm</span>
                      <span className="text-[10px] font-sans font-semibold text-[#6B5F50]">
                        · Cọc {depositPct}%
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#8C7E6C] truncate">
                      {rt.size} · {rt.bedrooms ?? 1} PN · {rt.bathrooms ?? 1} PT
                      {(rt.hasBalcony ?? true) ? ' · Có ban công' : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Room CMS Form Editor */}
        <div className="lg:col-span-8">
          {!draft ? (
            <div className="bg-white border border-[#E5DECE] rounded-2xl p-10 text-center text-sm text-[#8C7E6C]">
              Chọn một hạng phòng bên trái để bắt đầu chỉnh sửa.
            </div>
          ) : (
            <form onSubmit={handleSave} className="bg-white border border-[#E5DECE] rounded-2xl overflow-hidden">
              {/* Editor Header */}
              <div className="px-6 py-4 border-b border-[#E5DECE] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-mono text-[#8C7E6C] block">
                    ID: {draft.id}
                  </span>
                  <h3 className="font-serif font-bold text-lg text-[#0E2A47]">
                    {draft.name}
                  </h3>
                </div>

                <button
                  type="submit"
                  disabled={isSaving || !canEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#0E2A47] hover:bg-[#163A5F] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#C8A261]" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-[#C8A261]" />
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-6 space-y-6">
                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-start gap-2">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* SECTION 1: COVER IMAGE & GALLERY IMAGES */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E2A47]">
                        1. Hình ảnh hạng phòng (Ảnh đại diện & Ảnh phụ)
                      </h4>
                      <p className="text-[11px] text-[#8C7E6C] mt-0.5">
                        Hỗ trợ JPG, PNG, WebP (tối đa 8MB). Ảnh được tải lên Supabase Storage và lưu URL vào database.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPresetPicker((v) => !v)}
                      className="text-xs font-bold text-[#9E7A3B] hover:text-[#0E2A47] underline"
                    >
                      {showPresetPicker ? 'Ẩn kho ảnh sẵn' : 'Chọn từ kho ảnh sẵn'}
                    </button>
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFile(f, 'cover');
                    }}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFile(f, 'gallery');
                    }}
                  />

                  {/* Cover Image Preview + Upload */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="md:col-span-6">
                      <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-[#D5CBBF] bg-slate-100">
                        <img
                          src={draft.image}
                          alt={draft.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2.5 left-2.5 bg-[#0E2A47]/90 text-[#FAF8F5] text-[10px] font-bold px-2.5 py-1 rounded-md">
                          Ảnh đại diện chính
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 space-y-3">
                      <button
                        type="button"
                        disabled={!canEdit || uploadingSlot !== null}
                        onClick={() => coverInputRef.current?.click()}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#C8A261] hover:bg-[#B38D4F] disabled:opacity-50 text-[#0E2A47] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        {uploadingSlot === 'cover' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang tải ảnh đại diện...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Thay ảnh đại diện (Upload ảnh mới)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={!canEdit || uploadingSlot !== null}
                        onClick={() => galleryInputRef.current?.click()}
                        className="w-full py-2.5 px-4 rounded-xl border border-[#0E2A47] text-[#0E2A47] hover:bg-[#0E2A47] hover:text-white disabled:opacity-50 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        {uploadingSlot === 'gallery' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang tải ảnh phụ...</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-4 h-4" />
                            <span>Thêm ảnh phụ vào thư viện</span>
                          </>
                        )}
                      </button>

                      <div className="pt-1">
                        <label className="block text-[11px] font-bold text-[#6B5F50] mb-1">
                          Hoặc dán URL ảnh (https://... hoặc /images/...)
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={newImageUrlInput}
                            onChange={(e) => setNewImageUrlInput(e.target.value)}
                            placeholder="https://... hoặc /images/..."
                            className="flex-1 px-3 py-2 rounded-lg border border-[#D5CBBF] bg-[#FAF8F5] text-xs text-[#0E2A47] focus:outline-none focus:border-[#0E2A47]"
                          />
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={handleAddImageByUrl}
                            className="px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#D5CBBF] hover:border-[#0E2A47] text-xs font-bold text-[#0E2A47]"
                          >
                            Thêm
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Local Preset Picker */}
                  {showPresetPicker && (
                    <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E5DECE] space-y-2.5">
                      <span className="text-[11px] font-bold text-[#0E2A47] block">
                        Chọn nhanh ảnh có sẵn trong hệ thống:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {QUICK_LOCAL_PRESETS.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => {
                              const existing = getAllImages(draft);
                              setDraft({
                                ...draft,
                                image: preset.url,
                                galleryImages: [preset.url, ...existing.filter((u) => u !== preset.url)],
                              });
                            }}
                            className="text-left rounded-lg overflow-hidden border border-[#D5CBBF] hover:border-[#C8A261] bg-white transition-colors"
                          >
                            <div className="aspect-[16/10] bg-slate-100">
                              <img
                                src={preset.url}
                                alt={preset.label}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-1.5 text-[10px] font-semibold text-[#0E2A47] truncate">
                              {preset.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gallery Thumbnails Strip */}
                  <div>
                    <span className="text-[11px] font-bold text-[#6B5F50] block mb-2">
                      Bộ sưu tập ảnh của hạng phòng ({imagesList.length} ảnh)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {imagesList.map((imgUrl, idx) => {
                        const isCover = imgUrl === draft.image;
                        return (
                          <div
                            key={`${imgUrl}-${idx}`}
                            className={`rounded-xl overflow-hidden border ${
                              isCover ? 'border-[#C8A261] ring-2 ring-[#C8A261]/30' : 'border-[#E5DECE]'
                            } bg-[#FAF8F5]`}
                          >
                            <div className="relative aspect-[16/10] bg-slate-100">
                              <img
                                src={imgUrl}
                                alt={`${draft.name} ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              {isCover && (
                                <span className="absolute top-1.5 left-1.5 bg-[#C8A261] text-[#0E2A47] text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  Đại diện
                                </span>
                              )}
                            </div>
                            <div className="p-1.5 flex items-center justify-between gap-1">
                              {!isCover ? (
                                <button
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => handleSetAsCover(imgUrl)}
                                  className="text-[10px] font-bold text-[#0E2A47] hover:text-[#9E7A3B] flex items-center gap-1"
                                >
                                  <Star className="w-3 h-3" />
                                  <span>Đặt đại diện</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-semibold text-emerald-700">
                                  Đang hiển thị
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={!canEdit || imagesList.length <= 1}
                                onClick={() => handleRemoveImage(imgUrl)}
                                title="Xóa ảnh này"
                                className="p-1 rounded hover:bg-rose-100 text-rose-600 disabled:opacity-30"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <hr className="border-[#EBE5DB]" />

                {/* SECTION 2: BASIC INFO & PRICING */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E2A47]">
                    2. Tên hạng phòng, Giá bán & Tỷ lệ tiền cọc
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6">
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1">
                        Tên hạng phòng *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!canEdit}
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-semibold text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1">
                        Giá / đêm (VNĐ) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={10000}
                        disabled={!canEdit}
                        value={draft.basePrice}
                        onChange={(e) =>
                          setDraft({ ...draft, basePrice: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-mono font-bold tabular-nums text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                      <span className="text-[10px] text-[#8C7E6C] font-mono tabular-nums mt-0.5 block">
                        = {draft.basePrice.toLocaleString('vi-VN')} đ/đêm
                      </span>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1">
                        Tỷ lệ cọc (%) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        max={100}
                        step={5}
                        disabled={!canEdit}
                        value={draft.depositPercent ?? 30}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            depositPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-mono font-bold tabular-nums text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                      <span className="text-[10px] text-emerald-700 font-mono tabular-nums mt-0.5 block">
                        Cọc 1 đêm: {Math.ceil((draft.basePrice * (draft.depositPercent ?? 30)) / 100).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-[#EBE5DB]" />

                {/* SECTION 3: ROOM ATTRIBUTES */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E2A47]">
                    3. Thuộc tính chi tiết phòng
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1 flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-[#C8A261]" />
                        <span>Diện tích</span>
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={draft.size}
                        onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                        placeholder="vd: 21m²"
                        className="w-full px-3 py-2 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-semibold text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1 flex items-center gap-1">
                        <BedDouble className="w-3.5 h-3.5 text-[#C8A261]" />
                        <span>Số phòng ngủ</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        disabled={!canEdit}
                        value={draft.bedrooms ?? 1}
                        onChange={(e) =>
                          setDraft({ ...draft, bedrooms: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-mono font-bold tabular-nums text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1 flex items-center gap-1">
                        <Bath className="w-3.5 h-3.5 text-[#C8A261]" />
                        <span>Số phòng tắm</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        disabled={!canEdit}
                        value={draft.bathrooms ?? 1}
                        onChange={(e) =>
                          setDraft({ ...draft, bathrooms: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-mono font-bold tabular-nums text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1">
                        Sức chứa tối đa (khách)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        disabled={!canEdit}
                        value={draft.maxGuests}
                        onChange={(e) =>
                          setDraft({ ...draft, maxGuests: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-mono font-bold tabular-nums text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="block text-xs font-bold text-[#0E2A47] mb-1">
                        Loại giường
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={draft.bedType}
                        onChange={(e) => setDraft({ ...draft, bedType: e.target.value })}
                        placeholder="vd: 1 Giường King Mái Vòm"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs font-semibold text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                      />
                    </div>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] cursor-pointer mt-4 md:mt-5">
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={Boolean(draft.hasBalcony)}
                        onChange={(e) => setDraft({ ...draft, hasBalcony: e.target.checked })}
                        className="w-4 h-4 accent-[#0E2A47] rounded"
                      />
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E2A47]">
                        <Wind className="w-4 h-4 text-[#C8A261]" />
                        <span>Có ban công riêng / sân hiên đón gió biển</span>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0E2A47] mb-1">
                      Mô tả hạng phòng (hiển thị trên mục Phòng ở & trang /booking)
                    </label>
                    <textarea
                      rows={4}
                      disabled={!canEdit}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs text-[#0E2A47] leading-relaxed focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                    />
                  </div>
                </div>

                <hr className="border-[#EBE5DB]" />

                {/* SECTION 4: AMENITIES LIST */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E2A47] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C8A261]" />
                    <span>4. Danh sách tiện nghi ({draft.amenities.length} mục)</span>
                  </h4>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={newAmenityInput}
                      onChange={(e) => setNewAmenityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAmenity();
                        }
                      }}
                      placeholder="Nhập tiện nghi mới (vd: Bồn tắm nằm view biển, Wifi tốc độ cao...)"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#D5CBBF] bg-[#FAF8F5] text-xs text-[#0E2A47] focus:bg-white focus:outline-none focus:border-[#0E2A47]"
                    />
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={handleAddAmenity}
                      className="px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#0E2A47] text-[#0E2A47] hover:bg-[#0E2A47] hover:text-white text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm</span>
                    </button>
                  </div>

                  {draft.amenities.length === 0 ? (
                    <p className="text-xs text-[#8C7E6C] italic">
                      Chưa có tiện nghi nào. Nhập vào ô phía trên và nhấn Thêm.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#F0EBE1] border border-[#E5DECE] rounded-xl bg-[#FAF8F5]">
                      {draft.amenities.map((amenity, idx) => (
                        <div
                          key={`${amenity}-${idx}`}
                          className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-[#0E2A47]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Check className="w-3.5 h-3.5 text-[#C8A261] shrink-0" />
                            <span className="truncate">{amenity}</span>
                          </div>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => handleRemoveAmenity(idx)}
                            className="p-1 rounded hover:bg-rose-100 text-rose-600 disabled:opacity-30 shrink-0"
                            title="Xóa tiện nghi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Save Footer */}
                <div className="pt-4 border-t border-[#E5DECE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[11px] text-[#8C7E6C]">
                    Lưu thay đổi sẽ cập nhật đồng thời vào bảng <code className="font-mono">room_types</code> và kho CMS.
                  </span>
                  <button
                    type="submit"
                    disabled={isSaving || !canEdit}
                    className="px-6 py-3 rounded-xl bg-[#0E2A47] hover:bg-[#163A5F] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#C8A261]" />
                        <span>Đang lưu & đồng bộ...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-[#C8A261]" />
                        <span>Lưu thay đổi & Đồng bộ ngay</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
