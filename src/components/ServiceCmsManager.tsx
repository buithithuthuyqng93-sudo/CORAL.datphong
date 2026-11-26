import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
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
  ExternalLink,
} from 'lucide-react';
import type { CmsContentItem } from '../types';
import {
  apiListCmsContent,
  apiSaveCmsContent,
  apiUploadCmsImage,
} from '../services/dataAdapter';

interface ServiceCmsManagerProps {
  services: CmsContentItem[];
  userRole: 'owner' | 'reception' | 'accountant';
  onUpdateServices: (updated: CmsContentItem[]) => void;
  showToast: (msg: string) => void;
}

const SERVICE_LOCAL_PRESETS = [
  { label: 'Tour tham quan đảo (Demo)', url: '/assets/services/tour-tham-quan-dao.jpg' },
  { label: 'Tour soi đêm bắt hải sản (Demo)', url: '/assets/services/tour-soi-dem-hai-san.jpg' },
  { label: 'Chèo SUP bãi biển Seagull (Ảnh thật)', url: '/assets/lyson-beach-sup-real.jpg' },
  { label: 'Chèo SUP vịnh hoàng hôn (Demo)', url: '/assets/services/cheo-sup-vinh-bien.jpg' },
  { label: 'Lặn ngắm san hô (Demo)', url: '/assets/services/lan-ngam-san-ho.jpg' },
  { label: 'Tiệc tối ban công biển (Demo)', url: '/assets/services/tiec-toi-ban-cong-bien.jpg' },
  { label: 'Bến cảng Lý Sơn (Ảnh thật)', url: '/assets/lyson-harbor-real.jpg' },
  { label: 'Toàn cảnh Seagull Lý Sơn', url: '/assets/seagull-hero.jpg' },
];

const MAX_SERVICE_IMAGES = 3;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh.'));
    reader.readAsDataURL(file);
  });
}

function normalizeHighlights(attrs?: Record<string, any>): string[] {
  if (!attrs || !Array.isArray(attrs.highlights)) return [];
  return attrs.highlights.map((x: unknown) => String(x || '').trim()).filter(Boolean);
}

export const ServiceCmsManager: React.FC<ServiceCmsManagerProps> = ({
  services,
  userRole,
  onUpdateServices,
  showToast,
}) => {
  const canEdit = userRole === 'owner';

  const [selectedId, setSelectedId] = useState<string>(() => services[0]?.id || '');
  const [draft, setDraft] = useState<CmsContentItem | null>(() =>
    services[0]
      ? {
          ...services[0],
          images: [...(services[0].images || [])].slice(0, MAX_SERVICE_IMAGES),
          attributes: {
            ...(services[0].attributes || {}),
            subtitle: String(services[0].attributes?.subtitle || ''),
            highlights: normalizeHighlights(services[0].attributes),
          },
        }
      : null
  );

  const [newHighlightInput, setNewHighlightInput] = useState('');
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<'cover' | 'gallery' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const cloneServiceToDraft = (svc: CmsContentItem): CmsContentItem => ({
    ...svc,
    images: Array.from(
      new Set<string>((svc.images || []).map((u) => (u || '').trim()).filter(Boolean))
    ).slice(0, MAX_SERVICE_IMAGES),
    attributes: {
      ...(svc.attributes || {}),
      subtitle: String(svc.attributes?.subtitle || ''),
      highlights: normalizeHighlights(svc.attributes),
    },
  });

  useEffect(() => {
    if (!services.length) return;
    const found = services.find((s) => s.id === selectedId) || services[0];
    if (found && found.id !== selectedId) {
      setSelectedId(found.id);
    }
    if (!draft || draft.id !== found.id) {
      setDraft(cloneServiceToDraft(found));
    }
  }, [services, selectedId]);

  const handleSelectService = (svc: CmsContentItem) => {
    setSelectedId(svc.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    setDraft(cloneServiceToDraft(svc));
  };

  const handleRefreshFromServer = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const token = sessionStorage.getItem('seagull_admin_token');
      const res = await apiListCmsContent('service', { includeInactive: false, token });
      if (res.success && Array.isArray(res.items) && res.items.length > 0) {
        onUpdateServices(res.items);
        const current = res.items.find((s) => s.id === selectedId) || res.items[0];
        if (current) {
          handleSelectService(current);
        }
        showToast('Đã đồng bộ danh sách dịch vụ mới nhất từ cơ sở dữ liệu.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải danh sách dịch vụ từ máy chủ.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUploadFile = async (file: File, target: 'cover' | 'gallery') => {
    if (!draft) return;
    if (!canEdit) {
      setErrorMsg('Chỉ tài khoản Chủ cơ sở (Owner) mới có quyền tải ảnh và chỉnh sửa dịch vụ.');
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

    if (target === 'gallery' && draft.images.length >= MAX_SERVICE_IMAGES) {
      setErrorMsg(`Mỗi dịch vụ hiển thị tối đa ${MAX_SERVICE_IMAGES} ảnh. Hãy xoá bớt ảnh cũ trước khi thêm.`);
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
          contentType: 'service',
          itemId: draft.id,
          fileBase64,
          filename: file.name,
          mimeType: file.type,
          altText: draft.title,
        },
        token
      );

      const url = uploaded.publicUrl;
      const existing = draft.images || [];

      if (target === 'cover') {
        const nextImages = [url, ...existing.filter((u) => u !== url)].slice(0, MAX_SERVICE_IMAGES);
        setDraft({ ...draft, images: nextImages });
        showToast('Đã tải ảnh chính mới! Nhấn "Lưu thay đổi" để cập nhật ngay lên trang Dịch vụ.');
      } else {
        const nextImages = (existing.includes(url) ? existing : [...existing, url]).slice(
          0,
          MAX_SERVICE_IMAGES
        );
        setDraft({ ...draft, images: nextImages });
        showToast('Đã thêm ảnh mới! Nhấn "Lưu thay đổi" để cập nhật ngay lên trang Dịch vụ.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi tải ảnh lên Supabase Storage.');
    } finally {
      setUploadingSlot(null);
      if (coverInputRef.current) coverInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleSetAsCover = (url: string) => {
    if (!draft || !canEdit) return;
    const reordered = [url, ...draft.images.filter((u) => u !== url)].slice(0, MAX_SERVICE_IMAGES);
    setDraft({ ...draft, images: reordered });
  };

  const handleRemoveImage = (url: string) => {
    if (!draft || !canEdit) return;
    const remaining = draft.images.filter((u) => u !== url);
    if (remaining.length === 0) {
      setErrorMsg('Mỗi dịch vụ trải nghiệm cần giữ lại ít nhất 1 ảnh.');
      return;
    }
    setDraft({ ...draft, images: remaining });
  };

  const handleAddImageByUrl = () => {
    if (!draft || !canEdit) return;
    const url = newImageUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('/') && !url.startsWith('https://') && !url.startsWith('http://')) {
      setErrorMsg('Đường dẫn ảnh phải bắt đầu bằng https://, http:// hoặc /assets/...');
      return;
    }
    if (draft.images.length >= MAX_SERVICE_IMAGES && !draft.images.includes(url)) {
      setErrorMsg(`Mỗi dịch vụ hiển thị tối đa ${MAX_SERVICE_IMAGES} ảnh.`);
      return;
    }
    const nextImages = draft.images.includes(url) ? draft.images : [...draft.images, url];
    setDraft({ ...draft, images: nextImages.slice(0, MAX_SERVICE_IMAGES) });
    setNewImageUrlInput('');
    setErrorMsg(null);
  };

  const handleApplyPresetImage = (url: string) => {
    if (!draft || !canEdit) return;
    if (draft.images.length >= MAX_SERVICE_IMAGES && !draft.images.includes(url)) {
      const replaced = [url, ...draft.images.slice(1)].slice(0, MAX_SERVICE_IMAGES);
      setDraft({ ...draft, images: replaced });
    } else {
      const nextImages = draft.images.includes(url)
        ? [url, ...draft.images.filter((u) => u !== url)]
        : [url, ...draft.images].slice(0, MAX_SERVICE_IMAGES);
      setDraft({ ...draft, images: nextImages });
    }
    setShowPresetPicker(false);
  };

  const handleAddHighlight = () => {
    if (!draft || !canEdit) return;
    const text = newHighlightInput.trim();
    if (!text) return;
    const current = normalizeHighlights(draft.attributes);
    if (current.includes(text)) {
      setNewHighlightInput('');
      return;
    }
    setDraft({
      ...draft,
      attributes: {
        ...(draft.attributes || {}),
        highlights: [...current, text],
      },
    });
    setNewHighlightInput('');
  };

  const handleRemoveHighlight = (item: string) => {
    if (!draft || !canEdit) return;
    const current = normalizeHighlights(draft.attributes);
    setDraft({
      ...draft,
      attributes: {
        ...(draft.attributes || {}),
        highlights: current.filter((h) => h !== item),
      },
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!canEdit) {
      setErrorMsg('Chỉ tài khoản Chủ cơ sở (Owner) mới có quyền lưu thay đổi dịch vụ.');
      return;
    }

    const cleanTitle = draft.title.trim();
    if (cleanTitle.length < 2) {
      setErrorMsg('Tiêu đề dịch vụ phải có ít nhất 2 ký tự.');
      return;
    }

    const cleanImages: string[] = Array.from(
      new Set<string>((draft.images || []).map((u) => u.trim()).filter(Boolean))
    ).slice(0, MAX_SERVICE_IMAGES);
    if (cleanImages.length === 0) {
      setErrorMsg('Vui lòng giữ ít nhất 1 ảnh cho dịch vụ trải nghiệm.');
      return;
    }

    const token = sessionStorage.getItem('seagull_admin_token');
    if (!token) {
      setErrorMsg('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiSaveCmsContent(
        {
          id: draft.id,
          contentType: 'service',
          title: cleanTitle,
          slug: draft.slug,
          description: draft.description.trim(),
          price: Math.max(0, Math.round(Number(draft.price) || 0)),
          images: cleanImages,
          attributes: {
            ...(draft.attributes || {}),
            subtitle: String(draft.attributes?.subtitle || '').trim(),
            highlights: normalizeHighlights(draft.attributes),
          },
          sortOrder: draft.sortOrder,
          active: draft.active !== false,
        },
        token
      );

      const saved = res.item;
      const updatedList = services.map((s) => (s.id === saved.id ? saved : s));
      if (!updatedList.some((s) => s.id === saved.id)) {
        updatedList.push(saved);
      }
      onUpdateServices(updatedList);
      setDraft(cloneServiceToDraft(saved));
      setSuccessMsg(
        `Đã lưu "${saved.title}" (${saved.images.length} ảnh). Trang /dich-vu đã cập nhật ngay lập tức!`
      );
      showToast(`Đã cập nhật dịch vụ "${saved.title}" lên trang /dich-vu.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi khi lưu thay đổi dịch vụ.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5DECE] p-8 text-center text-sm text-[#6B5E4F]">
        Chưa có dữ liệu dịch vụ trải nghiệm. Nhấn tải lại để đồng bộ từ CMS.
      </div>
    );
  }

  const coverImage = draft.images[0] || '';
  const highlights = normalizeHighlights(draft.attributes);

  return (
    <div className="space-y-6">
      {/* Top Info Bar */}
      <div className="bg-white rounded-2xl border border-[#E5DECE] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#C8A261]" />
            <h2 className="text-base font-bold text-[#0E2A47]">
              Quản Lý Dịch Vụ Trải Nghiệm (CMS Ảnh &amp; Nội Dung)
            </h2>
          </div>
          <p className="text-xs text-[#6B5E4F]">
            Quản lý 5 dịch vụ trải nghiệm có khung ảnh trên trang <strong>/dich-vu</strong> (tối đa 3 ảnh/dịch vụ). Ảnh tải lên được lưu trực tiếp trên Supabase Storage và hiển thị ngay khi bấm Lưu.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefreshFromServer}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D8CEBC] bg-[#FAF8F5] hover:bg-[#F1ECE2] text-[#0E2A47] text-xs font-bold transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Đồng bộ dữ liệu</span>
          </button>
          <a
            href="/dich-vu"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0E2A47] hover:bg-[#163A5F] text-white text-xs font-bold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Xem trang Dịch vụ</span>
          </a>
        </div>
      </div>

      {/* RBAC Read-only Banner */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Bạn đang xem ở quyền <strong>{userRole === 'reception' ? 'Lễ tân' : 'Kế toán'}</strong>. Chỉ tài khoản <strong>Chủ cơ sở (Owner)</strong> mới có quyền thay ảnh và lưu nội dung dịch vụ.
          </span>
        </div>
      )}

      {/* Main Two-Column CMS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 5 Experience Services Selector */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E6C] px-1">
            5 Dịch vụ trải nghiệm ({services.length})
          </div>
          {services.map((svc, idx) => {
            const isSelected = svc.id === selectedId;
            const thumb = svc.images?.[0] || '/assets/services/tour-tham-quan-dao.jpg';
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => handleSelectService(svc)}
                className={`w-full text-left rounded-2xl border p-3 transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'bg-[#0E2A47] text-white border-[#0E2A47] shadow-md'
                    : 'bg-white text-[#0E2A47] border-[#E5DECE] hover:border-[#C8A261]'
                }`}
              >
                <img
                  src={thumb}
                  alt={svc.title}
                  className="w-16 h-12 rounded-xl object-cover shrink-0 bg-[#EFE9DC]"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isSelected ? 'text-[#E6D5B4]' : 'text-[#9E7A3B]'
                    }`}
                  >
                    0{idx + 1} · {svc.images?.length || 0}/{MAX_SERVICE_IMAGES} ảnh
                  </div>
                  <div className="text-xs font-bold truncate mt-0.5">{svc.title}</div>
                  <div
                    className={`text-[11px] truncate mt-0.5 ${
                      isSelected ? 'text-slate-300' : 'text-[#6B5E4F]'
                    }`}
                  >
                    {String(svc.attributes?.subtitle || svc.description || '')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected Service Editor */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E5DECE] p-5 sm:p-6 shadow-sm space-y-6">
          {/* Status Alerts */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Photos (1–3 images) */}
          <div className="space-y-4 pb-6 border-b border-[#EFE9DC]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0E2A47] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#C8A261]" />
                  <span>Bộ ảnh dịch vụ ({draft.images.length}/{MAX_SERVICE_IMAGES} ảnh)</span>
                </h3>
                <p className="text-xs text-[#6B5E4F] mt-0.5">
                  Tải ảnh thực tế lên để thay thế ảnh demo. Khung hiển thị tối đa 3 ảnh sắc nét.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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

                <button
                  type="button"
                  disabled={!canEdit || uploadingSlot !== null}
                  onClick={() => coverInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C8A261] hover:bg-[#B38D4F] text-[#0E2A47] text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {uploadingSlot === 'cover' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>Thay ảnh chính</span>
                </button>

                <button
                  type="button"
                  disabled={!canEdit || uploadingSlot !== null || draft.images.length >= MAX_SERVICE_IMAGES}
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D8CEBC] bg-[#FAF8F5] hover:bg-[#F1ECE2] text-[#0E2A47] text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {uploadingSlot === 'gallery' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Thêm ảnh phụ</span>
                </button>
              </div>
            </div>

            {/* Cover + Gallery Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {draft.images.map((url, idx) => {
                const isCover = idx === 0;
                return (
                  <div
                    key={`${url}-${idx}`}
                    className={`rounded-xl overflow-hidden border bg-[#FAF8F5] flex flex-col ${
                      isCover ? 'border-[#C8A261] ring-2 ring-[#C8A261]/25' : 'border-[#E5DECE]'
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-[#EAE3D5]">
                      <img
                        src={url}
                        alt={`${draft.title} - Ảnh ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      {isCover && (
                        <span className="absolute top-2 left-2 bg-[#0E2A47]/90 text-[#E6D5B4] text-[10px] font-bold px-2 py-0.5 rounded-md">
                          Ảnh chính
                        </span>
                      )}
                    </div>
                    <div className="p-2 flex items-center justify-between gap-1.5 bg-white border-t border-[#EFE9DC]">
                      {!isCover ? (
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleSetAsCover(url)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0E2A47] hover:text-[#9E7A3B] disabled:opacity-50"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Đặt ảnh chính</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#8C7E6C]">Hiển thị đầu tiên</span>
                      )}

                      <button
                        type="button"
                        disabled={!canEdit || draft.images.length <= 1}
                        onClick={() => handleRemoveImage(url)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 disabled:opacity-40"
                        title="Xoá ảnh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optional URL Paste + Local Preset Picker */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                disabled={!canEdit}
                value={newImageUrlInput}
                onChange={(e) => setNewImageUrlInput(e.target.value)}
                placeholder="Hoặc dán đường dẫn ảnh (https://... hoặc /assets/...)"
                className="flex-1 bg-[#FAF8F5] border border-[#DFD7C8] rounded-xl px-3.5 py-2 text-xs text-[#0E2A47] focus:outline-none focus:border-[#0E2A47]"
              />
              <button
                type="button"
                disabled={!canEdit || !newImageUrlInput.trim()}
                onClick={handleAddImageByUrl}
                className="px-3.5 py-2 rounded-xl bg-[#0E2A47] text-white text-xs font-bold hover:bg-[#163A5F] disabled:opacity-40"
              >
                Thêm URL
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setShowPresetPicker(!showPresetPicker)}
                className="px-3.5 py-2 rounded-xl border border-[#DFD7C8] bg-white text-[#0E2A47] text-xs font-bold hover:bg-[#FAF8F5] disabled:opacity-40"
              >
                Ảnh có sẵn
              </button>
            </div>

            {showPresetPicker && canEdit && (
              <div className="bg-[#FAF8F5] border border-[#E5DECE] rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SERVICE_LOCAL_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => handleApplyPresetImage(preset.url)}
                    className="group text-left rounded-lg overflow-hidden border border-[#E5DECE] hover:border-[#C8A261] bg-white transition-all"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-[#EAE3D5]">
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-1.5 text-[10px] font-semibold text-[#0E2A47] truncate">
                      {preset.label}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Title, Subtitle & Description */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0E2A47] mb-1.5">
                  Tên dịch vụ *
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#DFD7C8] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#0E2A47] focus:outline-none focus:border-[#0E2A47] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0E2A47] mb-1.5">
                  Phụ đề ngắn
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={String(draft.attributes?.subtitle || '')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      attributes: { ...(draft.attributes || {}), subtitle: e.target.value },
                    })
                  }
                  placeholder="VD: Đảo Lớn & Đảo Bé · Lịch trình trọn gói"
                  className="w-full bg-[#FAF8F5] border border-[#DFD7C8] rounded-xl px-3.5 py-2.5 text-sm text-[#0E2A47] focus:outline-none focus:border-[#0E2A47] disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0E2A47] mb-1.5">
                Mô tả chi tiết dịch vụ
              </label>
              <textarea
                rows={3}
                disabled={!canEdit}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="w-full bg-[#FAF8F5] border border-[#DFD7C8] rounded-xl px-3.5 py-2.5 text-sm text-[#0E2A47] focus:outline-none focus:border-[#0E2A47] disabled:opacity-60"
              />
            </div>

            {/* Highlights List */}
            <div>
              <label className="block text-xs font-bold text-[#0E2A47] mb-1.5">
                Điểm nổi bật hiển thị trên thẻ dịch vụ
              </label>
              <div className="space-y-1.5 mb-2.5">
                {highlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-[#FAF8F5] border border-[#EAE3D5] rounded-lg px-3 py-2 text-xs text-[#2D414D]"
                  >
                    <span>— {hl}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(hl)}
                        className="text-rose-500 hover:text-rose-700 shrink-0"
                        title="Xoá mục này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newHighlightInput}
                    onChange={(e) => setNewHighlightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddHighlight();
                      }
                    }}
                    placeholder="Thêm điểm nổi bật mới..."
                    className="flex-1 bg-[#FAF8F5] border border-[#DFD7C8] rounded-xl px-3.5 py-2 text-xs text-[#0E2A47]"
                  />
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="px-3.5 py-2 rounded-xl border border-[#DFD7C8] bg-white hover:bg-[#FAF8F5] text-xs font-bold text-[#0E2A47]"
                  >
                    + Thêm
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Save Footer */}
          <div className="pt-4 border-t border-[#EFE9DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[11px] text-[#8C7E6C]">
              Mã CMS: <span className="font-mono font-bold text-[#0E2A47]">{draft.id}</span> · Loại:{' '}
              <span className="font-mono font-bold text-[#0E2A47]">service</span>
              {coverImage ? ' · Sẵn sàng hiển thị' : ''}
            </div>

            <button
              type="button"
              disabled={!canEdit || isSaving || uploadingSlot !== null}
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0E2A47] hover:bg-[#163A5F] text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 text-[#C8A261]" />
              )}
              <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
