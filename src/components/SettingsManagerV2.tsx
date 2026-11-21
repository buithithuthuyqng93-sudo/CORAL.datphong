import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  RoomType, Room, PropertyConfig, StaffUser, Booking,
  SeasonalPriceRule, PriceAuditLog, PolicyVersion, BankAuditLog, SettingsMediaItem
} from '../types';
import { 
  Settings, DollarSign, BedDouble, Image as ImageIcon, FileText, 
  CreditCard, Shield, CheckCircle2, AlertCircle, Plus, Trash2, 
  Edit3, Save, X, RotateCcw, Lock, Unlock, Eye, ArrowUp, ArrowDown,
  Calendar, Clock, ShieldCheck, ChevronRight, HelpCircle, Check,
  AlertTriangle, Upload, RefreshCw, Smartphone, KeyRound, Building, Phone
} from 'lucide-react';

interface BackendStaffAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'owner' | 'reception' | 'accountant' | 'housekeeping' | 'coffee_staff';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface BackendAuditLog {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousData: Record<string, any> | null;
  newData: Record<string, any> | null;
  createdAt: string;
}

interface SettingsManagerV2Props {
  roomTypes: RoomType[];
  rooms: Room[];
  bookings: Booking[];
  propertyConfig: PropertyConfig;
  staffList: StaffUser[];
  userRole: 'owner' | 'reception' | 'accountant';
  currentStaff: string;
  currentUsername?: string;
  onUpdateRoomTypes: (types: RoomType[]) => void;
  onUpdatePropertyConfig: (config: PropertyConfig) => void;
  onUpdateStaffList?: (staff: StaffUser[]) => void;
  showToast: (msg: string) => void;
}

export type SettingsTabKey = 'price' | 'roomtypes' | 'photos' | 'policy' | 'contact' | 'account';

// Sample media presets representing Seagull Ly Son
const INITIAL_DEMO_PHOTOS: SettingsMediaItem[] = [
  {
    id: 'photo-1',
    name: 'Toàn cảnh Homestay Seagull & Vách Đá Bazan',
    url: '/images/coral-hero.jpg',
    targetCategory: 'homepage',
    isPrimary: true,
    altText: 'Toàn cảnh Seagull Homestay trên vách đá bazan An Vĩnh',
    fileSizeKb: 1420,
    uploadedAt: '2026-04-10 10:00',
    uploadedBy: 'Mr Thiện (Chủ cơ sở)',
    isLocalDemo: false,
  },
  {
    id: 'photo-2',
    name: 'Quầy Bar Cafe Seagull Sunset View',
    url: '/images/coral_homestay_cafe_hero.jpg',
    targetCategory: 'cafe',
    isPrimary: true,
    altText: 'Quầy Seagull Coffee view biển hoàng hôn Lý Sơn',
    fileSizeKb: 980,
    uploadedAt: '2026-04-10 11:30',
    uploadedBy: 'Mr Thiện (Chủ cơ sở)',
    isLocalDemo: false,
  },
  {
    id: 'photo-3',
    name: 'Bungalow Vòm Ocean View Ban Ngày',
    url: '/images/bungalow-cliff-day.jpg',
    targetCategory: 'room_type',
    roomTypeId: 'type-home1-single',
    isPrimary: true,
    altText: 'Bungalow vòm Ocean View đón nắng biển',
    fileSizeKb: 1250,
    uploadedAt: '2026-04-12 14:15',
    uploadedBy: 'Lễ Tân Thủy',
    isLocalDemo: false,
  },
  {
    id: 'photo-4',
    name: 'VIP P.101 Bồn Tắm Nằm Panorama',
    url: '/images/bungalow-bathtub-ocean.jpg',
    targetCategory: 'room_type',
    roomTypeId: 'type-home1-vip',
    isPrimary: true,
    altText: 'Bồn tắm nằm hướng biển phòng 101',
    fileSizeKb: 1680,
    uploadedAt: '2026-04-15 09:20',
    uploadedBy: 'Mr Thiện (Chủ cơ sở)',
    isLocalDemo: false,
  },
  {
    id: 'photo-5',
    name: 'Dãy Bungalow Hoàng Hôn Cliffside',
    url: '/images/bungalow-row-sunset.jpg',
    targetCategory: 'room_type',
    roomTypeId: 'type-home2-sunset',
    isPrimary: true,
    altText: 'Dãy bungalow vòm hoàng hôn cụm Home 2',
    fileSizeKb: 1340,
    uploadedAt: '2026-04-16 16:40',
    uploadedBy: 'Lễ Tân Thủy',
    isLocalDemo: false,
  },
  {
    id: 'photo-6',
    name: 'Phòng Vòm 2 Giường Đôi Mộc Mạc',
    url: '/images/bungalow-bedroom-twin.jpg',
    targetCategory: 'room_type',
    roomTypeId: 'type-home3-panorama',
    isPrimary: true,
    altText: 'Nội thất phòng vòm panorama 2 tầng',
    fileSizeKb: 1120,
    uploadedAt: '2026-04-18 10:10',
    uploadedBy: 'Mr Thiện (Chủ cơ sở)',
    isLocalDemo: false,
  },
];

export const SettingsManagerV2: React.FC<SettingsManagerV2Props> = ({
  roomTypes,
  rooms,
  bookings,
  propertyConfig,
  staffList: _legacyStaffList,
  userRole,
  currentStaff,
  currentUsername = '',
  onUpdateRoomTypes,
  onUpdatePropertyConfig,
  onUpdateStaffList: _onUpdateStaffList,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('price');

  // Filter 27 active commercial rooms confirmed for Phase 1
  const commercialRooms = useMemo(() => {
    return rooms.filter(r => r.isActive !== false);
  }, [rooms]);

  // =========================================================================
  // TAB 1: GIÁ PHÒNG THEO MÙA (Seasonal Pricing & Dynamic Rates)
  // =========================================================================
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [selectedRoomTypeIdForPrice, setSelectedRoomTypeIdForPrice] = useState<string>(roomTypes[0]?.id || '');
  
  // Local edit states for rates
  const [priceForm, setPriceForm] = useState(() => {
    const basePrices: Record<string, number> = {};
    roomTypes.forEach(rt => {
      basePrices[rt.id] = rt.basePrice;
    });
    return {
      basePrices,
      peakSeasonSurchargePercent: propertyConfig.seasonPricing?.peakSeasonSurchargePercent || 25,
      lowSeasonDiscountPercent: propertyConfig.seasonPricing?.lowSeasonDiscountPercent || 15,
      weekendSurchargePercent: propertyConfig.weekendSurchargePercent || 20,
      holidaySurchargePercent: propertyConfig.holidaySurchargePercent || 35,
      seasonNotes: propertyConfig.seasonPricing?.seasonNotes || '',
      priceChangeReason: '',
    };
  });

  const [priceErrors, setPriceErrors] = useState<string[]>([]);
  const [seasonalRules, setSeasonalRules] = useState<SeasonalPriceRule[]>(() => {
    return propertyConfig.seasonalPriceRules || [];
  });
  const [priceAuditLogs, setPriceAuditLogs] = useState<PriceAuditLog[]>(() => {
    return propertyConfig.priceAuditLogs || [];
  });

  // Modal create/edit seasonal rule
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<Omit<SeasonalPriceRule, 'id' | 'createdAt' | 'createdBy'>>({
    name: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    roomTypeId: 'all',
    adjustmentType: 'percentage',
    adjustmentValue: 20,
    note: '',
    isActive: true,
  });
  const [ruleError, setRuleError] = useState<string>('');

  // Validate price form
  const validatePriceForm = (): boolean => {
    const errs: string[] = [];
    Object.entries(priceForm.basePrices).forEach(([rtId, price]) => {
      const rt = roomTypes.find(t => t.id === rtId);
      const numPrice = Number(price);
      if (numPrice <= 0 || isNaN(numPrice)) {
        errs.push(`Giá phòng ${rt?.name || rtId} phải lớn hơn 0 VNĐ.`);
      }
    });
    if (priceForm.peakSeasonSurchargePercent < 0 || priceForm.peakSeasonSurchargePercent > 200) {
      errs.push('Phụ thu mùa hè cao điểm phải từ 0% đến 200%.');
    }
    if (priceForm.lowSeasonDiscountPercent < 0 || priceForm.lowSeasonDiscountPercent > 90) {
      errs.push('Giảm giá mùa đông phải từ 0% đến 90%.');
    }
    if (priceForm.weekendSurchargePercent < 0 || priceForm.weekendSurchargePercent > 100) {
      errs.push('Phụ thu cuối tuần phải từ 0% đến 100%.');
    }
    setPriceErrors(errs);
    return errs.length === 0;
  };

  const handleSavePrice = () => {
    if (!validatePriceForm()) return;
    
    // Check permission
    if (userRole === 'reception') {
      alert('Tài khoản Lễ tân không có quyền đổi bảng giá hệ thống. Vui lòng đăng nhập tài khoản Chủ cơ sở (Owner).');
      return;
    }

    // Build audit logs for modified room types
    const newLogs: PriceAuditLog[] = [...priceAuditLogs];
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedRoomTypes = roomTypes.map(rt => {
      const oldPrice = rt.basePrice;
      const newPrice = priceForm.basePrices[rt.id] ?? oldPrice;
      if (oldPrice !== newPrice) {
        newLogs.unshift({
          id: `pal-${Date.now()}-${rt.id}`,
          timestamp,
          staffName: currentStaff,
          roomTypeName: rt.name,
          fieldChanged: 'Giá niêm yết cơ bản',
          oldValue: `${oldPrice.toLocaleString('vi-VN')} đ`,
          newValue: `${newPrice.toLocaleString('vi-VN')} đ`,
          reason: priceForm.priceChangeReason.trim() || 'Cập nhật giá phòng theo mùa kinh doanh',
        });
      }
      return { ...rt, basePrice: newPrice };
    });

    const updatedConfig: PropertyConfig = {
      ...propertyConfig,
      weekendSurchargePercent: priceForm.weekendSurchargePercent,
      holidaySurchargePercent: priceForm.holidaySurchargePercent,
      seasonPricing: {
        ...propertyConfig.seasonPricing!,
        peakSeasonSurchargePercent: priceForm.peakSeasonSurchargePercent,
        lowSeasonDiscountPercent: priceForm.lowSeasonDiscountPercent,
        weekendSurchargePercent: priceForm.weekendSurchargePercent,
        holidaySurchargePercent: priceForm.holidaySurchargePercent,
        seasonNotes: priceForm.seasonNotes,
      },
      seasonalPriceRules: seasonalRules,
      priceAuditLogs: newLogs,
    };

    onUpdateRoomTypes(updatedRoomTypes);
    onUpdatePropertyConfig(updatedConfig);
    setPriceAuditLogs(newLogs);
    setIsEditingPrice(false);
    showToast('Đã lưu bảng giá và phụ thu theo mùa thành công! Booking Engine đã nhận giá mới.');
  };

  const handleCancelPrice = () => {
    const basePrices: Record<string, number> = {};
    roomTypes.forEach(rt => {
      basePrices[rt.id] = rt.basePrice;
    });
    setPriceForm({
      basePrices,
      peakSeasonSurchargePercent: propertyConfig.seasonPricing?.peakSeasonSurchargePercent || 25,
      lowSeasonDiscountPercent: propertyConfig.seasonPricing?.lowSeasonDiscountPercent || 15,
      weekendSurchargePercent: propertyConfig.weekendSurchargePercent || 20,
      holidaySurchargePercent: propertyConfig.holidaySurchargePercent || 35,
      seasonNotes: propertyConfig.seasonPricing?.seasonNotes || '',
      priceChangeReason: '',
    });
    setPriceErrors([]);
    setIsEditingPrice(false);
  };

  const handleAddSeasonalRule = (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError('');

    if (!ruleForm.name.trim()) {
      setRuleError('Vui lòng nhập tên khoảng ngày áp dụng.');
      return;
    }
    if (new Date(ruleForm.startDate) > new Date(ruleForm.endDate)) {
      setRuleError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }
    if (ruleForm.adjustmentValue <= 0) {
      setRuleError('Mức điều chỉnh giá phải lớn hơn 0.');
      return;
    }

    // Check overlapping rules with same room target
    const isOverlap = seasonalRules.some(r => {
      if (!r.isActive) return false;
      if (r.roomTypeId !== 'all' && ruleForm.roomTypeId !== 'all' && r.roomTypeId !== ruleForm.roomTypeId) return false;
      const rStart = new Date(r.startDate).getTime();
      const rEnd = new Date(r.endDate).getTime();
      const newStart = new Date(ruleForm.startDate).getTime();
      const newEnd = new Date(ruleForm.endDate).getTime();
      return (newStart <= rEnd && newEnd >= rStart);
    });

    if (isOverlap) {
      setRuleError('Cảnh báo: Khoảng ngày này đang bị chồng lấn (trùng lặp) với một bảng giá theo mùa khác đang kích hoạt!');
      return;
    }

    const newRule: SeasonalPriceRule = {
      ...ruleForm,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      createdBy: currentStaff,
    };

    const updated = [newRule, ...seasonalRules];
    setSeasonalRules(updated);
    onUpdatePropertyConfig({ ...propertyConfig, seasonalPriceRules: updated });
    setIsRuleModalOpen(false);
    showToast(`Đã thêm cấu hình giá theo mùa: ${newRule.name}`);
  };

  const handleDeleteSeasonalRule = (ruleId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa quy tắc giá mùa này?')) return;
    const updated = seasonalRules.filter(r => r.id !== ruleId);
    setSeasonalRules(updated);
    onUpdatePropertyConfig({ ...propertyConfig, seasonalPriceRules: updated });
    showToast('Đã xóa quy tắc giá theo mùa.');
  };

  // =========================================================================
  // TAB 2: LOẠI PHÒNG (Room Types Management)
  // =========================================================================
  const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);
  const [roomTypeForm, setRoomTypeForm] = useState<Partial<RoomType>>({});
  const [newAmenityInput, setNewAmenityInput] = useState<string>('');

  const handleStartEditRoomType = (rt: RoomType) => {
    setEditingRoomTypeId(rt.id);
    setRoomTypeForm({
      ...rt,
      amenities: [...rt.amenities],
    });
    setNewAmenityInput('');
  };

  const handleAddAmenity = () => {
    if (!newAmenityInput.trim()) return;
    const current = roomTypeForm.amenities || [];
    if (!current.includes(newAmenityInput.trim())) {
      setRoomTypeForm({
        ...roomTypeForm,
        amenities: [...current, newAmenityInput.trim()],
      });
    }
    setNewAmenityInput('');
  };

  const handleRemoveAmenity = (amenity: string) => {
    const current = roomTypeForm.amenities || [];
    setRoomTypeForm({
      ...roomTypeForm,
      amenities: current.filter(a => a !== amenity),
    });
  };

  const handleSaveRoomType = () => {
    if (!editingRoomTypeId) return;
    if (!roomTypeForm.name?.trim()) {
      alert('Tên loại phòng không được để trống.');
      return;
    }
    if ((roomTypeForm.maxGuests || 0) <= 0) {
      alert('Sức chứa tối đa phải từ 1 khách trở lên.');
      return;
    }

    const updated = roomTypes.map(rt => {
      if (rt.id === editingRoomTypeId) {
        return {
          ...rt,
          ...roomTypeForm,
        } as RoomType;
      }
      return rt;
    });

    onUpdateRoomTypes(updated);
    setEditingRoomTypeId(null);
    showToast('Đã cập nhật thông tin loại phòng thành công!');
  };

  // =========================================================================
  // TAB 3: ẢNH PHÒNG & MEDIA (Media Management V2)
  // =========================================================================
  const [mediaItems, setMediaItems] = useState<SettingsMediaItem[]>(() => {
    try {
      const saved = localStorage.getItem('seagull_media_items_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_DEMO_PHOTOS;
  });

  const [mediaTargetFilter, setMediaTargetFilter] = useState<'all' | 'homepage' | 'cafe' | 'room_type'>('all');
  const [selectedPhotoRoomType, setSelectedPhotoRoomType] = useState<string>('all');
  const [mediaDeleteConfirmId, setMediaDeleteConfirmId] = useState<string | null>(null);

  // Upload modal / state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFileSizeKb, setUploadFileSizeKb] = useState<number>(0);
  const [uploadTargetCategory, setUploadTargetCategory] = useState<'homepage' | 'cafe' | 'room_type'>('room_type');
  const [uploadTargetRoomTypeId, setUploadTargetRoomTypeId] = useState<string>(roomTypes[0]?.id || '');
  const [uploadAltText, setUploadAltText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Chỉ hỗ trợ tệp ảnh định dạng JPG, PNG hoặc WebP.');
      return;
    }

    // Validate size (max 5MB)
    const sizeKb = Math.round(file.size / 1024);
    if (sizeKb > 5120) {
      setUploadError('Dung lượng ảnh vượt quá giới hạn 5MB. Vui lòng nén ảnh trước khi tải lên.');
      return;
    }

    setUploadFileName(file.name);
    setUploadFileSizeKb(sizeKb);

    // Read preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadPreviewUrl(event.target?.result as string);
      if (!uploadAltText) {
        setUploadAltText(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUploadedPhoto = () => {
    if (!uploadPreviewUrl) {
      setUploadError('Vui lòng chọn ảnh trước khi lưu.');
      return;
    }

    const newPhoto: SettingsMediaItem = {
      id: `media-${Date.now()}`,
      name: uploadFileName || 'Ảnh tải lên',
      url: uploadPreviewUrl,
      targetCategory: uploadTargetCategory,
      roomTypeId: uploadTargetCategory === 'room_type' ? uploadTargetRoomTypeId : undefined,
      isPrimary: false,
      altText: uploadAltText.trim() || uploadFileName,
      fileSizeKb: uploadFileSizeKb,
      uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      uploadedBy: currentStaff,
      isLocalDemo: true,
    };

    const updated = [newPhoto, ...mediaItems];
    setMediaItems(updated);
    try {
      localStorage.setItem('seagull_media_items_v2', JSON.stringify(updated));
    } catch {}

    setIsUploadModalOpen(false);
    setUploadPreviewUrl(null);
    setUploadFileName('');
    setUploadAltText('');
    showToast('Đã thêm ảnh vào bộ sưu tập DEMO cục bộ thành công!');
  };

  const handleSetPrimaryPhoto = (photoId: string) => {
    const target = mediaItems.find(m => m.id === photoId);
    if (!target) return;

    const updated = mediaItems.map(m => {
      if (target.targetCategory === 'room_type' && m.roomTypeId === target.roomTypeId) {
        return { ...m, isPrimary: m.id === photoId };
      }
      if (target.targetCategory === m.targetCategory && target.targetCategory !== 'room_type') {
        return { ...m, isPrimary: m.id === photoId };
      }
      return m;
    });

    setMediaItems(updated);
    try {
      localStorage.setItem('seagull_media_items_v2', JSON.stringify(updated));
    } catch {}

    // If it's a room type photo, update the roomType.image as well
    if (target.targetCategory === 'room_type' && target.roomTypeId) {
      const updatedTypes = roomTypes.map(rt => {
        if (rt.id === target.roomTypeId) {
          return { ...rt, image: target.url };
        }
        return rt;
      });
      onUpdateRoomTypes(updatedTypes);
    }

    showToast('Đã đặt làm ảnh đại diện chính!');
  };

  const handleMovePhoto = (photoId: string, direction: 'up' | 'down') => {
    const idx = mediaItems.findIndex(m => m.id === photoId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= mediaItems.length) return;

    const updated = [...mediaItems];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setMediaItems(updated);
    try {
      localStorage.setItem('seagull_media_items_v2', JSON.stringify(updated));
    } catch {}
    showToast('Đã thay đổi thứ tự hiển thị ảnh.');
  };

  const handleDeletePhotoConfirmed = () => {
    if (!mediaDeleteConfirmId) return;
    const updated = mediaItems.filter(m => m.id !== mediaDeleteConfirmId);
    setMediaItems(updated);
    try {
      localStorage.setItem('seagull_media_items_v2', JSON.stringify(updated));
    } catch {}
    setMediaDeleteConfirmId(null);
    showToast('Đã xóa ảnh khỏi thư viện.');
  };

  // Filtered media
  const displayedMedia = useMemo(() => {
    return mediaItems.filter(m => {
      if (mediaTargetFilter !== 'all' && m.targetCategory !== mediaTargetFilter) return false;
      if (mediaTargetFilter === 'room_type' && selectedPhotoRoomType !== 'all') {
        return m.roomTypeId === selectedPhotoRoomType;
      }
      return true;
    });
  }, [mediaItems, mediaTargetFilter, selectedPhotoRoomType]);

  // =========================================================================
  // TAB 4: CHÍNH SÁCH ĐẶT PHÒNG & DRAFT WORKFLOW (Policy V2)
  // =========================================================================
  const [policyVersions, setPolicyVersions] = useState<PolicyVersion[]>(() => {
    return propertyConfig.policyVersions || [];
  });
  const [isEditingPolicy, setIsEditingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    depositPercent: propertyConfig.defaultDepositPercent || 30,
    holdTimeMinutes: propertyConfig.holdTimeMinutes || 15,
    cancellationPolicy: propertyConfig.cancellationPolicy || '',
    depositPolicy: propertyConfig.depositPolicy || '',
    surchargeExtraAdult: propertyConfig.surchargeExtraAdult || 150000,
    surchargeExtraChild: propertyConfig.surchargeExtraChild || 80000,
    draftNotes: '',
    effectiveDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });
  const [policyErrors, setPolicyErrors] = useState<string[]>([]);
  const [isApprovePolicyModalOpen, setIsApprovePolicyModalOpen] = useState(false);
  const [selectedDraftForApproval, setSelectedDraftForApproval] = useState<PolicyVersion | null>(null);

  const validatePolicyForm = (): boolean => {
    const errs: string[] = [];
    if (policyForm.depositPercent < 10 || policyForm.depositPercent > 100) {
      errs.push('Tỷ lệ cọc phải từ 10% đến 100% (Khuyến nghị 30% theo chính sách Seagull).');
    }
    if (policyForm.holdTimeMinutes < 5 || policyForm.holdTimeMinutes > 60) {
      errs.push('Thời gian giữ phòng chờ VietQR phải từ 5 đến 60 phút (Tiêu chuẩn: 15 phút).');
    }
    if (!policyForm.cancellationPolicy.trim()) {
      errs.push('Vui lòng nhập nội dung chính sách hủy / đổi / hoàn tiền.');
    }
    setPolicyErrors(errs);
    return errs.length === 0;
  };

  const handleSavePolicyDraft = () => {
    if (!validatePolicyForm()) return;

    const nextVerNumber = `V2.${policyVersions.length}`;
    const newDraft: PolicyVersion = {
      id: `pol-${Date.now()}`,
      version: `${nextVerNumber} (Bản nháp)`,
      status: 'draft',
      effectiveDate: policyForm.effectiveDate,
      depositPercent: policyForm.depositPercent,
      holdTimeMinutes: policyForm.holdTimeMinutes,
      cancellationPolicy: policyForm.cancellationPolicy,
      surchargeExtraAdult: policyForm.surchargeExtraAdult,
      surchargeExtraChild: policyForm.surchargeExtraChild,
      earlyCheckInFee: 100000,
      lateCheckOutFee: 100000,
      draftNotes: policyForm.draftNotes.trim() || 'Bản nháp điều chỉnh chính sách đặt phòng',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      createdBy: currentStaff,
    };

    const updated = [newDraft, ...policyVersions];
    setPolicyVersions(updated);
    onUpdatePropertyConfig({ ...propertyConfig, policyVersions: updated });
    setIsEditingPolicy(false);
    showToast(`Đã lưu ${newDraft.version}. Bản nháp đang chờ Chủ cơ sở (Owner) phê duyệt.`);
  };

  const handleApprovePolicyConfirmed = () => {
    if (!selectedDraftForApproval) return;
    if (userRole !== 'owner') {
      alert('Chỉ tài khoản Chủ cơ sở (Owner) mới có quyền phê duyệt và ban hành chính sách mới.');
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const updated = policyVersions.map(p => {
      if (p.id === selectedDraftForApproval.id) {
        return {
          ...p,
          status: 'approved' as const,
          version: p.version.replace(' (Bản nháp)', ' (Đang áp dụng)'),
          approvedBy: currentStaff,
          approvedAt: timestamp,
        };
      }
      // Set previous approved versions to archived status
      if (p.status === 'approved') {
        return {
          ...p,
          version: p.version.replace(' (Đang áp dụng)', ' (Lưu trữ)'),
        };
      }
      return p;
    });

    const activePolicy = selectedDraftForApproval;
    const updatedConfig: PropertyConfig = {
      ...propertyConfig,
      defaultDepositPercent: activePolicy.depositPercent,
      holdTimeMinutes: activePolicy.holdTimeMinutes,
      cancellationPolicy: activePolicy.cancellationPolicy,
      surchargeExtraAdult: activePolicy.surchargeExtraAdult,
      surchargeExtraChild: activePolicy.surchargeExtraChild,
      policyVersions: updated,
    };

    setPolicyVersions(updated);
    onUpdatePropertyConfig(updatedConfig);
    setIsApprovePolicyModalOpen(false);
    setSelectedDraftForApproval(null);
    showToast(`Chủ cơ sở đã chính thức phê duyệt & ban hành chính sách ${activePolicy.version}!`);
  };

  // =========================================================================
  // TAB 5: THÔNG TIN & VIETQR (Property & Banking)
  // =========================================================================
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    propertyName: propertyConfig.propertyName,
    slogan: propertyConfig.slogan || 'Nơi chữa lành tâm hồn bạn.',
    address: propertyConfig.address,
    hotline: propertyConfig.hotline,
    zaloPhone: propertyConfig.zaloPhone,
    email: propertyConfig.email || 'seagull.lyson@gmail.com',
    bankName: propertyConfig.bankName,
    bankBin: propertyConfig.bankBin,
    accountNumber: propertyConfig.accountNumber,
    accountHolder: propertyConfig.accountHolder,
    bankBranch: propertyConfig.bankBranch || 'Chi Nhánh Quảng Ngãi',
  });
  const [bankAuditLogs, setBankAuditLogs] = useState<BankAuditLog[]>(() => {
    return propertyConfig.bankAuditLogs || [];
  });

  // Modal confirm sensitive bank change
  const [isBankConfirmModalOpen, setIsBankConfirmModalOpen] = useState(false);
  const [bankChangeReason, setBankChangeReason] = useState<string>('');
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState<string>('');
  const [bankConfirmError, setBankConfirmError] = useState<string>('');

  const handleSaveContactInitiate = () => {
    // Check if bank details changed
    const isBankChanged = 
      contactForm.accountNumber !== propertyConfig.accountNumber ||
      contactForm.bankBin !== propertyConfig.bankBin ||
      contactForm.accountHolder !== propertyConfig.accountHolder;

    if (isBankChanged) {
      if (userRole !== 'owner') {
        alert('CẢNH BÁO BẢO MẬT: Chỉ có tài khoản Chủ cơ sở (Owner) mới được quyền thay đổi thông tin số tài khoản thụ hưởng VietQR. Vui lòng liên hệ Mr. Thiện / Ms. Điền.');
        return;
      }
      setBankChangeReason('');
      setOwnerConfirmPassword('');
      setBankConfirmError('');
      setIsBankConfirmModalOpen(true);
      return;
    }

    // Normal info update
    const updated: PropertyConfig = {
      ...propertyConfig,
      propertyName: contactForm.propertyName,
      slogan: contactForm.slogan,
      address: contactForm.address,
      hotline: contactForm.hotline,
      zaloPhone: contactForm.zaloPhone,
      email: contactForm.email,
    };
    onUpdatePropertyConfig(updated);
    setIsEditingContact(false);
    showToast('Đã lưu thông tin liên hệ thành công!');
  };

  const handleConfirmBankChange = (e: React.FormEvent) => {
    e.preventDefault();
    setBankConfirmError('');

    if (!bankChangeReason.trim()) {
      setBankConfirmError('Vui lòng nhập lý do điều chỉnh tài khoản thụ hưởng.');
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const oldBankStr = `${propertyConfig.bankName} - ${propertyConfig.accountNumber} - ${propertyConfig.accountHolder}`;
    const newBankStr = `${contactForm.bankName} - ${contactForm.accountNumber} - ${contactForm.accountHolder}`;

    const newLog: BankAuditLog = {
      id: `bal-${Date.now()}`,
      timestamp,
      staffName: currentStaff,
      action: 'CẬP NHẬT TÀI KHOẢN NGÂN HÀNG VIETQR',
      oldBankInfo: oldBankStr,
      newBankInfo: newBankStr,
      reason: bankChangeReason.trim(),
      confirmedByOwner: true,
    };

    const updatedLogs = [newLog, ...bankAuditLogs];
    const updatedConfig: PropertyConfig = {
      ...propertyConfig,
      ...contactForm,
      bankAuditLogs: updatedLogs,
    };

    onUpdatePropertyConfig(updatedConfig);
    setBankAuditLogs(updatedLogs);
    setIsBankConfirmModalOpen(false);
    setIsEditingContact(false);
    showToast('Đã xác nhận thay đổi tài khoản nhận tiền VietQR và ghi nhật ký kiểm toán!');
  };

  // =========================================================================
  // TAB 6: TÀI KHOẢN & PHÂN QUYỀN (Per-Staff Supabase user_roles + Audit Logs)
  // =========================================================================
  const [staffAccounts, setStaffAccounts] = useState<BackendStaffAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<BackendAuditLog[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffApiError, setStaffApiError] = useState<string | null>(null);
  const [staffStorageMode, setStaffStorageMode] = useState<'supabase' | 'demo' | null>(null);

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string>('');
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    role: 'reception' as 'owner' | 'reception' | 'accountant' | 'housekeeping' | 'coffee_staff',
    password: '',
  });

  // Reset password modal (Owner resets any staff's password)
  const [resetTarget, setResetTarget] = useState<BackendStaffAccount | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Self-service change own password
  const [ownPassForm, setOwnPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [ownPassError, setOwnPassError] = useState('');
  const [isChangingOwnPass, setIsChangingOwnPass] = useState(false);

  const getAdminAuthHeaders = (): Record<string, string> => {
    let token = '';
    try {
      token = sessionStorage.getItem('seagull_admin_token') || '';
    } catch {}
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchStaffAndAuditData = useCallback(async () => {
    setStaffLoading(true);
    setStaffApiError(null);
    const headers = getAdminAuthHeaders();
    try {
      if (userRole === 'owner') {
        const res = await fetch('/api/admin?action=staff-list', { headers });
        const data = await res.json();
        if (res.ok && data.success) {
          setStaffAccounts(data.staff || []);
          setStaffStorageMode(data.isDemo ? 'demo' : 'supabase');
        } else {
          setStaffApiError(data.error || 'Không thể tải danh sách tài khoản nhân sự.');
        }
      }

      if (userRole === 'owner' || userRole === 'accountant') {
        const auditRes = await fetch('/api/admin?action=audit-logs&limit=40', { headers });
        const auditData = await auditRes.json();
        if (auditRes.ok && auditData.success) {
          setAuditLogs(auditData.logs || []);
        }
      }
    } catch {
      setStaffApiError('Không thể kết nối API quản lý nhân sự (/api/admin).');
    } finally {
      setStaffLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    if (activeTab === 'account') {
      fetchStaffAndAuditData();
    }
  }, [activeTab, fetchStaffAndAuditData]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');

    if (!newUserForm.fullName.trim() || !newUserForm.username.trim() || !newUserForm.password.trim()) {
      setAddUserError('Vui lòng điền đủ Họ tên, Tên đăng nhập và Mật khẩu.');
      return;
    }
    if (newUserForm.password.trim().length < 8) {
      setAddUserError('Mật khẩu riêng phải có tối thiểu 8 ký tự.');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const res = await fetch('/api/admin?action=staff-create', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          fullName: newUserForm.fullName.trim(),
          username: newUserForm.username.trim().toLowerCase(),
          email: newUserForm.email.trim() || undefined,
          phone: newUserForm.phone.trim() || undefined,
          role: newUserForm.role,
          password: newUserForm.password.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAddUserModalOpen(false);
        setNewUserForm({ fullName: '', username: '', email: '', phone: '', role: 'reception', password: '' });
        showToast(data.message || 'Đã tạo tài khoản nhân sự mới!');
        fetchStaffAndAuditData();
      } else {
        setAddUserError(data.error || 'Không thể tạo tài khoản nhân sự.');
      }
    } catch {
      setAddUserError('Lỗi kết nối máy chủ khi tạo tài khoản.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleToggleUserActive = async (staff: BackendStaffAccount) => {
    if (userRole !== 'owner') {
      showToast('Chỉ tài khoản Chủ cơ sở mới có quyền kích hoạt hoặc tạm khóa tài khoản nhân viên.');
      return;
    }
    try {
      const res = await fetch('/api/admin?action=staff-toggle-active', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ staffId: staff.id, isActive: !staff.isActive }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Đã cập nhật trạng thái tài khoản.');
        fetchStaffAndAuditData();
      } else {
        showToast(data.error || 'Không thể cập nhật trạng thái tài khoản.');
      }
    } catch {
      showToast('Lỗi kết nối khi cập nhật trạng thái tài khoản.');
    }
  };

  const handleResetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetPasswordError('');

    if (resetPasswordValue.trim().length < 8) {
      setResetPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await fetch('/api/admin?action=staff-reset-password', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ staffId: resetTarget.id, newPassword: resetPasswordValue.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetTarget(null);
        setResetPasswordValue('');
        showToast(data.message || 'Đã đặt lại mật khẩu thành công!');
        fetchStaffAndAuditData();
      } else {
        setResetPasswordError(data.error || 'Không thể đặt lại mật khẩu.');
      }
    } catch {
      setResetPasswordError('Lỗi kết nối khi đặt lại mật khẩu.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnPassError('');

    if (ownPassForm.newPassword.trim().length < 8) {
      setOwnPassError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (ownPassForm.newPassword !== ownPassForm.confirmPassword) {
      setOwnPassError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsChangingOwnPass(true);
    try {
      const res = await fetch('/api/admin?action=change-own-password', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          currentPassword: ownPassForm.currentPassword,
          newPassword: ownPassForm.newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOwnPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        showToast(data.message || 'Đã đổi mật khẩu cá nhân thành công!');
        if (userRole === 'owner' || userRole === 'accountant') {
          fetchStaffAndAuditData();
        }
      } else {
        setOwnPassError(data.error || 'Không thể đổi mật khẩu.');
      }
    } catch {
      setOwnPassError('Lỗi kết nối khi đổi mật khẩu.');
    } finally {
      setIsChangingOwnPass(false);
    }
  };

  const formatTimestampVN = (iso?: string | null) => {
    if (!iso) return 'Chưa đăng nhập';
    try {
      return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------- */}
      {/* BANNER DEMO CỤC BỘ & NHẬT KÝ KIỂM TOÁN */}
      {/* ------------------------------------------------------------------- */}
      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md">
                Chế độ Quản Trị Cài Đặt V2 (DEMO MODE)
              </span>
              <span className="text-[11px] text-amber-800 font-semibold">
                Phiên làm việc: {currentStaff} ({userRole.toUpperCase()})
              </span>
            </div>
            <p className="text-xs text-amber-900/90 mt-1">
              Mọi thay đổi bảng giá, chính sách, tài khoản đều được lưu trong bộ nhớ trình duyệt & localStorage. 
              <strong> Tuyệt đối không tự động thay đổi giá của các booking đã chốt trước đó.</strong>
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-xs font-bold bg-white text-slate-700 px-3 py-1.5 rounded-xl border border-amber-200 shadow-xs flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-[#0E2A47]" />
            <span>27 Phòng Kinh Doanh</span>
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SUB-TABS NAVIGATION (6 Tabs) */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white border border-[#E5DECE] rounded-2xl p-2 shadow-xs flex items-center gap-1 overflow-x-auto">
        {[
          { key: 'price', label: '1. Giá phòng theo mùa', icon: DollarSign },
          { key: 'roomtypes', label: '2. Loại phòng', icon: BedDouble },
          { key: 'photos', label: '3. Ảnh phòng & Media', icon: ImageIcon },
          { key: 'policy', label: '4. Chính sách đặt phòng', icon: FileText },
          { key: 'contact', label: '5. Thông tin & VietQR', icon: CreditCard },
          { key: 'account', label: '6. Tài khoản & Phân quyền', icon: Shield },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as SettingsTabKey)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-[#0E2A47] text-[#C8A261] shadow-md'
                  : 'text-slate-600 hover:text-black hover:bg-[#FAF8F5]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: GIÁ PHÒNG THEO MÙA (Seasonal Pricing) */}
      {/* =================================================================== */}
      {activeTab === 'price' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5DECE] gap-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0E2A47] flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#C8A261]" />
                  <span>Bảng Giá Niêm Yết & Phụ Thu Theo Mùa</span>
                </h3>
                <p className="text-xs text-[#8C7E6C] mt-0.5">
                  Cấu hình giá cho 27 phòng kinh doanh mở bán thực tế giai đoạn đầu. Bảo toàn 100% giá các booking đã chốt.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isEditingPrice ? (
                  <button
                    onClick={() => {
                      if (userRole === 'reception') {
                        alert('Quyền Lễ tân chỉ được xem bảng giá. Cần quyền Chủ cơ sở (Owner) để chỉnh sửa.');
                        return;
                      }
                      setIsEditingPrice(true);
                    }}
                    className="px-4 py-2 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Chỉnh Sửa Bảng Giá</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelPrice}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Hủy</span>
                    </button>
                    <button
                      onClick={handleSavePrice}
                      className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu Thay Đổi</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error alerts */}
            {priceErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Lỗi kiểm tra tính hợp lệ dữ liệu giá:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {priceErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contract Preservation Notice */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Nguyên tắc bảo toàn giá hợp đồng:</strong> Khi lưu giá mới, Booking Engine sẽ áp dụng ngay cho các báo giá tạo mới. Mọi đơn đặt phòng cũ đã có trong hệ thống ({bookings.length} đơn) vẫn giữ nguyên 100% mức giá đã chốt tại thời điểm thanh toán cọc.
              </div>
            </div>

            {/* 4 Standard Season Adjustment Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <span className="text-xs font-bold text-[#0E2A47] block">Mùa Cao Điểm Hè (T5 - T8)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isEditingPrice}
                    value={priceForm.peakSeasonSurchargePercent}
                    onChange={(e) => setPriceForm({ ...priceForm, peakSeasonSurchargePercent: Number(e.target.value) })}
                    className={`w-24 px-3 py-1.5 rounded-lg text-sm font-bold text-[#0E2A47] ${
                      isEditingPrice ? 'bg-white border border-[#D5CBBF] shadow-inner' : 'bg-slate-100 border border-transparent'
                    }`}
                  />
                  <span className="text-xs text-slate-600 font-bold">% phụ thu</span>
                </div>
                <p className="text-[11px] text-slate-500">Mùa du lịch biển sôi động nhất ở đảo Lý Sơn.</p>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <span className="text-xs font-bold text-[#0E2A47] block">Mùa Thấp Điểm / Mùa Đông</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isEditingPrice}
                    value={priceForm.lowSeasonDiscountPercent}
                    onChange={(e) => setPriceForm({ ...priceForm, lowSeasonDiscountPercent: Number(e.target.value) })}
                    className={`w-24 px-3 py-1.5 rounded-lg text-sm font-bold text-[#0E2A47] ${
                      isEditingPrice ? 'bg-white border border-[#D5CBBF] shadow-inner' : 'bg-slate-100 border border-transparent'
                    }`}
                  />
                  <span className="text-xs text-slate-600 font-bold">% giảm giá</span>
                </div>
                <p className="text-[11px] text-slate-500">Chính sách ưu đãi mùa biển động thu hút khách.</p>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <span className="text-xs font-bold text-[#0E2A47] block">Phụ Thu Cuối Tuần (T6 - CN)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isEditingPrice}
                    value={priceForm.weekendSurchargePercent}
                    onChange={(e) => setPriceForm({ ...priceForm, weekendSurchargePercent: Number(e.target.value) })}
                    className={`w-24 px-3 py-1.5 rounded-lg text-sm font-bold text-[#0E2A47] ${
                      isEditingPrice ? 'bg-white border border-[#D5CBBF] shadow-inner' : 'bg-slate-100 border border-transparent'
                    }`}
                  />
                  <span className="text-xs text-slate-600 font-bold">% phụ thu</span>
                </div>
                <p className="text-[11px] text-slate-500">Tự động cộng khi khách chọn đêm thứ 6, thứ 7.</p>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <span className="text-xs font-bold text-[#0E2A47] block">Phụ Thu Ngày Lễ / Tết</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isEditingPrice}
                    value={priceForm.holidaySurchargePercent}
                    onChange={(e) => setPriceForm({ ...priceForm, holidaySurchargePercent: Number(e.target.value) })}
                    className={`w-24 px-3 py-1.5 rounded-lg text-sm font-bold text-[#0E2A47] ${
                      isEditingPrice ? 'bg-white border border-[#D5CBBF] shadow-inner' : 'bg-slate-100 border border-transparent'
                    }`}
                  />
                  <span className="text-xs text-slate-600 font-bold">% phụ thu</span>
                </div>
                <p className="text-[11px] text-slate-500">Áp dụng các ngày nghỉ lễ quốc gia và Tết.</p>
              </div>
            </div>

            {/* Room Base Prices Comparison Table (Old vs New) */}
            <div className="space-y-3 pt-4 border-t border-[#E5DECE]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E2A47]">
                  Bảng Giá Niêm Yết Gốc Từng Loại Phòng (So sánh Giá Cũ vs Giá Mới)
                </h4>
                {isEditingPrice && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Đang ở chế độ chỉnh sửa - Nhập giá mới
                  </span>
                )}
              </div>

              <div className="overflow-x-auto border border-[#E5DECE] rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FAF8F5] text-[#0E2A47] font-bold border-b border-[#E5DECE]">
                    <tr>
                      <th className="p-3">Loại Phòng</th>
                      <th className="p-3">Số Phòng Áp Dụng</th>
                      <th className="p-3">Giá Niêm Yết Cũ</th>
                      <th className="p-3">Giá Mới Đề Xuất</th>
                      <th className="p-3">Chênh Lệch</th>
                      <th className="p-3">Giá Cuối Tuần (+{priceForm.weekendSurchargePercent}%)</th>
                      <th className="p-3">Giá Cao Điểm (+{priceForm.peakSeasonSurchargePercent}%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DECE]">
                    {roomTypes.map(rt => {
                      const oldPrice = rt.basePrice;
                      const newPrice = priceForm.basePrices[rt.id] ?? oldPrice;
                      const diff = newPrice - oldPrice;
                      const assignedRooms = commercialRooms.filter(r => r.roomTypeId === rt.id);
                      const weekendPrice = Math.round(newPrice * (1 + priceForm.weekendSurchargePercent / 100));
                      const peakPrice = Math.round(newPrice * (1 + priceForm.peakSeasonSurchargePercent / 100));

                      return (
                        <tr key={rt.id} className="hover:bg-[#FAF8F5]/50 transition-colors">
                          <td className="p-3 font-bold text-[#0E2A47]">
                            <div className="flex items-center gap-2">
                              <img src={rt.image} alt={rt.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                              <div>
                                <span>{rt.name}</span>
                                <span className="block text-[10px] text-slate-500 font-normal">{rt.size} • {rt.bedType}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              {assignedRooms.length} phòng ({assignedRooms.map(r => r.number).join(', ') || 'Chưa gán'})
                            </span>
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-600">
                            {oldPrice.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-3 font-mono font-bold">
                            {isEditingPrice ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="20000"
                                  value={newPrice}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setPriceForm({
                                      ...priceForm,
                                      basePrices: {
                                        ...priceForm.basePrices,
                                        [rt.id]: val,
                                      },
                                    });
                                  }}
                                  className="w-28 px-2 py-1 bg-white border border-[#D5CBBF] rounded-lg text-xs font-bold text-[#0E2A47] focus:ring-1 focus:ring-[#0E2A47]"
                                />
                                <span className="text-[11px] text-slate-500 font-normal">đ</span>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-bold">{newPrice.toLocaleString('vi-VN')} đ</span>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            {diff === 0 ? (
                              <span className="text-slate-400">— Không đổi</span>
                            ) : diff > 0 ? (
                              <span className="text-emerald-700 font-bold">+{diff.toLocaleString('vi-VN')} đ (Tăng)</span>
                            ) : (
                              <span className="text-rose-600 font-bold">{diff.toLocaleString('vi-VN')} đ (Giảm)</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-700">
                            {weekendPrice.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-3 font-mono text-slate-700">
                            {peakPrice.toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Justification note when editing */}
              {isEditingPrice && (
                <div className="pt-2">
                  <label className="text-xs font-bold text-[#0E2A47] block mb-1">
                    Lý Do Điều Chỉnh Bảng Giá (Ghi nhận vào Nhật Ký Kiểm Toán Audit Log) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Áp dụng bảng giá du lịch mùa hè 2026, nâng cấp tiện nghi phòng VIP..."
                    value={priceForm.priceChangeReason}
                    onChange={(e) => setPriceForm({ ...priceForm, priceChangeReason: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#D5CBBF] rounded-xl text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* CẤU HÌNH GIÁ THEO KHOẢNG NGÀY (Seasonal Rules / Date Range Rates) */}
          {/* --------------------------------------------------------------- */}
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5DECE] gap-3">
              <div>
                <h4 className="font-serif font-bold text-base text-[#0E2A47] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#C8A261]" />
                  <span>Cấu Hình Giá Theo Khoảng Ngày Cụ Thể (Mùa / Dịp Lễ)</span>
                </h4>
                <p className="text-xs text-[#8C7E6C]">
                  Thiết lập tự động điều chỉnh giá cho các khoảng thời gian đặc thù (tránh chồng lấn ngày)
                </p>
              </div>
              <button
                onClick={() => {
                  setRuleError('');
                  setIsRuleModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Khoảng Ngày Mới</span>
              </button>
            </div>

            {seasonalRules.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">Chưa có quy tắc khoảng ngày nào được thiết lập.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {seasonalRules.map(rule => (
                  <div key={rule.id} className="p-4 border border-[#E5DECE] rounded-xl bg-[#FAF8F5] space-y-2 relative">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-xs text-[#0E2A47] block">{rule.name}</span>
                        <span className="text-[11px] text-slate-600 font-mono">
                          {rule.startDate} ➜ {rule.endDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {rule.isActive ? 'Đang kích hoạt' : 'Tạm dừng'}
                        </span>
                        <button
                          onClick={() => handleDeleteSeasonalRule(rule.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                          title="Xóa quy tắc này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-700 flex items-center justify-between pt-1 border-t border-[#E5DECE]">
                      <span>Áp dụng: <strong>{rule.roomTypeId === 'all' ? 'Toàn bộ 27 phòng' : roomTypes.find(t => t.id === rule.roomTypeId)?.name || rule.roomTypeId}</strong></span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {rule.adjustmentType === 'percentage' ? `+${rule.adjustmentValue}%` : `${rule.adjustmentValue.toLocaleString('vi-VN')} đ/đêm`}
                      </span>
                    </div>
                    {rule.note && <p className="text-[11px] text-slate-500 italic">Ghi chú: {rule.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* AUDIT LOG LỊCH SỬ ĐIỀU CHỈNH GIÁ */}
          {/* --------------------------------------------------------------- */}
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-3">
            <h4 className="font-serif font-bold text-sm text-[#0E2A47] flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Nhật Ký Kiểm Toán Lịch Sử Điều Chỉnh Giá (Price Audit Trail)</span>
            </h4>
            <div className="overflow-x-auto border border-[#E5DECE] rounded-xl max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF8F5] text-[#0E2A47] font-bold border-b border-[#E5DECE] sticky top-0">
                  <tr>
                    <th className="p-2.5">Thời Điểm</th>
                    <th className="p-2.5">Người Thực Hiện</th>
                    <th className="p-2.5">Loại Phòng</th>
                    <th className="p-2.5">Giá Cũ</th>
                    <th className="p-2.5">Giá Mới</th>
                    <th className="p-2.5">Lý Do Điều Chỉnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DECE]">
                  {priceAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#FAF8F5]/60">
                      <td className="p-2.5 font-mono text-slate-500">{log.timestamp}</td>
                      <td className="p-2.5 font-bold text-[#0E2A47]">{log.staffName}</td>
                      <td className="p-2.5 font-medium">{log.roomTypeName}</td>
                      <td className="p-2.5 font-mono text-slate-600 line-through">{log.oldValue}</td>
                      <td className="p-2.5 font-mono text-emerald-700 font-bold">{log.newValue}</td>
                      <td className="p-2.5 text-slate-600">{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LOẠI PHÒNG (Room Types Management) */}
      {/* =================================================================== */}
      {activeTab === 'roomtypes' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5DECE] gap-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0E2A47] flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-[#C8A261]" />
                  <span>Quản Lý Các Hạng Loại Phòng (Seagull Ly Son)</span>
                </h3>
                <p className="text-xs text-[#8C7E6C] mt-0.5">
                  Chỉnh sửa tên, diện tích, sức chứa, tiện nghi và mô tả. Chỉ liên kết với đúng 27 phòng kinh doanh được duyệt.
                </p>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Không tự thêm/xóa phòng vật lý khi chưa có phê duyệt riêng của chủ</span>
              </div>
            </div>

            {/* List of room types */}
            <div className="space-y-4">
              {roomTypes.map(rt => {
                const isEditing = editingRoomTypeId === rt.id;
                const assignedPhysicalRooms = commercialRooms.filter(r => r.roomTypeId === rt.id);

                return (
                  <div key={rt.id} className="p-5 border border-[#E5DECE] rounded-2xl bg-white shadow-xs space-y-4">
                    {/* View Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <img
                          src={isEditing ? (roomTypeForm.image || rt.image) : rt.image}
                          alt={rt.name}
                          className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[#E5DECE]"
                          onError={(e) => {
                            e.currentTarget.src = '/images/coral-hero.jpg';
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif font-bold text-base text-[#0E2A47]">{rt.name}</h4>
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                              Đang kinh doanh
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {rt.size} • {rt.bedType} • Tối đa {rt.maxGuests} khách
                          </p>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2 max-w-2xl">{rt.description}</p>
                          
                          {/* Physical rooms badge */}
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-slate-600 font-semibold">Phòng thực tế:</span>
                            {assignedPhysicalRooms.length > 0 ? (
                              assignedPhysicalRooms.map(r => (
                                <span key={r.id} className="text-[10px] font-mono font-bold bg-[#FAF8F5] border border-[#E5DECE] px-2 py-0.5 rounded text-[#0E2A47]">
                                  P.{r.number}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Chưa gán phòng mở bán</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-end md:self-start">
                        {!isEditing ? (
                          <button
                            onClick={() => handleStartEditRoomType(rt)}
                            className="px-3.5 py-1.5 bg-[#FAF8F5] hover:bg-[#E5DECE] text-[#0E2A47] border border-[#D5CBBF] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa Chi Tiết</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingRoomTypeId(null)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={handleSaveRoomType}
                              className="px-4 py-1.5 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Lưu</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Edit Form */}
                    {isEditing && (
                      <div className="pt-4 border-t border-[#E5DECE] space-y-4 bg-[#FAF8F5] p-4 rounded-xl">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">Tên Loại Phòng *</label>
                            <input
                              type="text"
                              value={roomTypeForm.name || ''}
                              onChange={(e) => setRoomTypeForm({ ...roomTypeForm, name: e.target.value })}
                              className="w-full p-2 bg-white border border-[#D5CBBF] rounded-lg text-xs font-medium"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">Diện Tích Sử Dụng *</label>
                            <input
                              type="text"
                              value={roomTypeForm.size || ''}
                              onChange={(e) => setRoomTypeForm({ ...roomTypeForm, size: e.target.value })}
                              className="w-full p-2 bg-white border border-[#D5CBBF] rounded-lg text-xs"
                              placeholder="Ví dụ: 21m²"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">Số / Loại Giường *</label>
                            <input
                              type="text"
                              value={roomTypeForm.bedType || ''}
                              onChange={(e) => setRoomTypeForm({ ...roomTypeForm, bedType: e.target.value })}
                              className="w-full p-2 bg-white border border-[#D5CBBF] rounded-lg text-xs"
                              placeholder="1 Giường King Mái Vòm"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">Sức Chứa Tối Đa (Khách) *</label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={roomTypeForm.maxGuests || 2}
                              onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxGuests: Number(e.target.value) })}
                              className="w-full p-2 bg-white border border-[#D5CBBF] rounded-lg text-xs font-bold"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">Đường Dẫn Ảnh Đại Diện</label>
                            <input
                              type="text"
                              value={roomTypeForm.image || ''}
                              onChange={(e) => setRoomTypeForm({ ...roomTypeForm, image: e.target.value })}
                              className="w-full p-2 bg-white border border-[#D5CBBF] rounded-lg text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">Mô Tả Chi Tiết Về Không Gian & Tiện Nghi</label>
                          <textarea
                            rows={3}
                            value={roomTypeForm.description || ''}
                            onChange={(e) => setRoomTypeForm({ ...roomTypeForm, description: e.target.value })}
                            className="w-full p-2.5 bg-white border border-[#D5CBBF] rounded-lg text-xs"
                          />
                        </div>

                        {/* Amenities Tags Editor */}
                        <div>
                          <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">Danh Sách Tiện Nghi (Amenities)</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {(roomTypeForm.amenities || []).map((amenity, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[11px] bg-white border border-[#D5CBBF] px-2.5 py-1 rounded-lg text-slate-700 shadow-xs"
                              >
                                <span>{amenity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAmenity(amenity)}
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              type="text"
                              placeholder="Thêm tiện nghi mới (Ví dụ: Máy sấy tóc Dyson, Smart TV...)"
                              value={newAmenityInput}
                              onChange={(e) => setNewAmenityInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddAmenity();
                                }
                              }}
                              className="flex-1 p-2 bg-white border border-[#D5CBBF] rounded-lg text-xs"
                            />
                            <button
                              type="button"
                              onClick={handleAddAmenity}
                              className="px-3 py-2 bg-[#0E2A47] text-white rounded-lg text-xs font-bold shrink-0"
                            >
                              Thêm
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ẢNH PHÒNG & MEDIA (Media Management V2) */}
      {/* =================================================================== */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5DECE] gap-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0E2A47] flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#C8A261]" />
                  <span>Thư Viện Ảnh Thực Tế & Ảnh Đại Diện Phòng</span>
                </h3>
                <p className="text-xs text-[#8C7E6C] mt-0.5">
                  Tải lên JPG/PNG/WebP (tối đa 5MB), xem trước, gán vào trang chủ, khu cà phê hoặc loại phòng cụ thể.
                </p>
              </div>

              <button
                onClick={() => {
                  setUploadError('');
                  setUploadPreviewUrl(null);
                  setUploadFileName('');
                  setIsUploadModalOpen(true);
                }}
                className="px-4 py-2 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Tải Ảnh Mới Lên</span>
              </button>
            </div>

            {/* Anti-AI photo policy notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Chính sách ảnh thực tế Seagull:</strong> Toàn bộ hình ảnh trong thư viện là ảnh chụp thực tế tại cơ sở Thôn Đông An Vĩnh, Đảo Lý Sơn. Hệ thống không sử dụng hình ảnh AI thay thế để đảm bảo độ chân thực và uy tín với khách lưu trú.
              </div>
            </div>

            {/* Target Category Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0E2A47]">Lọc theo khu vực:</span>
                {[
                  { key: 'all', label: 'Tất cả' },
                  { key: 'homepage', label: 'Trang chủ (Hero)' },
                  { key: 'cafe', label: 'Khu Cà Phê Vách Biển' },
                  { key: 'room_type', label: 'Loại Phòng' },
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setMediaTargetFilter(cat.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mediaTargetFilter === cat.key
                        ? 'bg-[#0E2A47] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {mediaTargetFilter === 'room_type' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Chọn phòng:</span>
                  <select
                    value={selectedPhotoRoomType}
                    onChange={(e) => setSelectedPhotoRoomType(e.target.value)}
                    className="p-1.5 bg-white border border-[#D5CBBF] rounded-lg text-xs font-medium"
                  >
                    <option value="all">-- Toàn bộ các loại phòng --</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Media Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {displayedMedia.map(item => {
                const rt = roomTypes.find(t => t.id === item.roomTypeId);

                return (
                  <div key={item.id} className="border border-[#E5DECE] rounded-2xl overflow-hidden bg-white shadow-xs flex flex-col group">
                    <div className="relative aspect-video bg-slate-100 overflow-hidden">
                      <img
                        src={item.url}
                        alt={item.altText}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = '/images/coral-hero.jpg';
                        }}
                      />
                      
                      {/* Primary Badge */}
                      {item.isPrimary && (
                        <div className="absolute top-2 left-2 bg-[#0E2A47] text-[#C8A261] px-2.5 py-0.5 rounded-md text-[10px] font-bold shadow-md flex items-center gap-1">
                          <Check className="w-3 h-3 text-[#C8A261]" />
                          <span>Ảnh Đại Diện</span>
                        </div>
                      )}

                      {/* Local Demo Badge */}
                      {item.isLocalDemo && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-0.5 rounded-md text-[9px] font-bold shadow">
                          Tệp DEMO Cục Bộ
                        </div>
                      )}

                      {/* Bottom target pill */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-semibold bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                        <span className="truncate">
                          {item.targetCategory === 'homepage' && 'Trang Chủ Hero'}
                          {item.targetCategory === 'cafe' && 'Khu Cà Phê'}
                          {item.targetCategory === 'room_type' && (rt?.name || 'Loại phòng')}
                        </span>
                        <span className="shrink-0">{item.fileSizeKb ? `${item.fileSizeKb} KB` : ''}</span>
                      </div>
                    </div>

                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <h5 className="font-bold text-xs text-[#0E2A47] truncate" title={item.name}>
                          {item.name}
                        </h5>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.altText}</p>
                      </div>

                      <div className="pt-2 border-t border-[#E5DECE] flex items-center justify-between gap-1">
                        {!item.isPrimary ? (
                          <button
                            onClick={() => handleSetPrimaryPhoto(item.id)}
                            className="text-[11px] font-bold text-slate-700 hover:text-[#0E2A47] bg-[#FAF8F5] hover:bg-[#E5DECE] px-2 py-1 rounded-md"
                          >
                            Đặt làm bìa
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-700">Đang là ảnh bìa</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMovePhoto(item.id, 'up')}
                            className="p-1 text-slate-500 hover:text-black rounded"
                            title="Di chuyển lên"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMovePhoto(item.id, 'down')}
                            className="p-1 text-slate-500 hover:text-black rounded"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setMediaDeleteConfirmId(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded ml-1"
                            title="Xóa ảnh này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: CHÍNH SÁCH ĐẶT PHÒNG & QUY TRÌNH DUYỆT (Policy V2) */}
      {/* =================================================================== */}
      {activeTab === 'policy' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5DECE] gap-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0E2A47] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#C8A261]" />
                  <span>Chính Sách Cọc 30%, Giữ Phòng 15 Phút & Bản Nháp Duyệt</span>
                </h3>
                <p className="text-xs text-[#8C7E6C] mt-0.5">
                  Mọi thay đổi chính sách phải ở trạng thái Bản Nháp chờ Chủ cơ sở phê duyệt trước khi áp dụng.
                </p>
              </div>

              {!isEditingPolicy ? (
                <button
                  onClick={() => setIsEditingPolicy(true)}
                  className="px-4 py-2 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Soạn Thảo Bản Nháp Mới</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingPolicy(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSavePolicyDraft}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu Bản Nháp</span>
                  </button>
                </div>
              )}
            </div>

            {/* Error alerts */}
            {policyErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Lỗi kiểm tra tính hợp lệ chính sách:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {policyErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Policy Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <label className="text-xs font-bold text-[#0E2A47] block">
                  Tỷ Lệ Tiền Cọc Mặc Định (%) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isEditingPolicy}
                    min={10}
                    max={100}
                    value={policyForm.depositPercent}
                    onChange={(e) => setPolicyForm({ ...policyForm, depositPercent: Number(e.target.value) })}
                    className={`w-28 px-3 py-2 rounded-xl text-sm font-bold text-[#0E2A47] ${
                      isEditingPolicy ? 'bg-white border border-[#D5CBBF]' : 'bg-slate-100 border border-transparent'
                    }`}
                  />
                  <span className="text-xs text-slate-600 font-bold">% tổng hóa đơn</span>
                </div>
                <p className="text-[11px] text-slate-500">Khách thanh toán cọc qua VietQR để khóa phòng tức thì, số dư thanh toán tại quầy.</p>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <label className="text-xs font-bold text-[#0E2A47] block">
                  Thời Gian Giữ Chỗ Chờ Quét Mã VietQR (Phút) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isEditingPolicy}
                    min={5}
                    max={60}
                    value={policyForm.holdTimeMinutes}
                    onChange={(e) => setPolicyForm({ ...policyForm, holdTimeMinutes: Number(e.target.value) })}
                    className={`w-28 px-3 py-2 rounded-xl text-sm font-bold text-[#0E2A47] ${
                      isEditingPolicy ? 'bg-white border border-[#D5CBBF]' : 'bg-slate-100 border border-transparent'
                    }`}
                  />
                  <span className="text-xs text-slate-600 font-bold">phút (900 giây)</span>
                </div>
                <p className="text-[11px] text-slate-500">Hết 15 phút không có tín hiệu SePay khớp giao dịch, phòng tự động nhả về trạng thái trống.</p>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <label className="text-xs font-bold text-[#0E2A47] block">Phụ Thu Thêm Người Lớn (VND/đêm)</label>
                <input
                  type="number"
                  step="20000"
                  disabled={!isEditingPolicy}
                  value={policyForm.surchargeExtraAdult}
                  onChange={(e) => setPolicyForm({ ...policyForm, surchargeExtraAdult: Number(e.target.value) })}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold ${
                    isEditingPolicy ? 'bg-white border border-[#D5CBBF]' : 'bg-slate-100 border border-transparent'
                  }`}
                />
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl space-y-2">
                <label className="text-xs font-bold text-[#0E2A47] block">Phụ Thu Trẻ Em 6-11 Tuổi (VND/đêm)</label>
                <input
                  type="number"
                  step="20000"
                  disabled={!isEditingPolicy}
                  value={policyForm.surchargeExtraChild}
                  onChange={(e) => setPolicyForm({ ...policyForm, surchargeExtraChild: Number(e.target.value) })}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold ${
                    isEditingPolicy ? 'bg-white border border-[#D5CBBF]' : 'bg-slate-100 border border-transparent'
                  }`}
                />
              </div>
            </div>

            {/* Cancellation Policy Text */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#0E2A47] block">
                Chính Sách Hủy / Đổi Ngày / Hoàn Tiền (Hỗ Trợ Tàu Cao Tốc Biển Động) *
              </label>
              <textarea
                rows={4}
                disabled={!isEditingPolicy}
                value={policyForm.cancellationPolicy}
                onChange={(e) => setPolicyForm({ ...policyForm, cancellationPolicy: e.target.value })}
                className={`w-full p-3 rounded-xl text-xs ${
                  isEditingPolicy ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                }`}
              />
            </div>

            {isEditingPolicy && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div>
                  <label className="text-[11px] font-bold text-amber-900 block mb-1">Ngày Dự Kiến Có Hiệu Lực</label>
                  <input
                    type="date"
                    value={policyForm.effectiveDate}
                    onChange={(e) => setPolicyForm({ ...policyForm, effectiveDate: e.target.value })}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-amber-900 block mb-1">Ghi Chú Đề Xuất Của Bản Nháp</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Cập nhật phí phụ thu nệm phụ theo chi phí thực tế..."
                    value={policyForm.draftNotes}
                    onChange={(e) => setPolicyForm({ ...policyForm, draftNotes: e.target.value })}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* POLICY VERSIONS & OWNER APPROVAL WORKFLOW */}
          {/* --------------------------------------------------------------- */}
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="font-serif font-bold text-base text-[#0E2A47] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Lịch Sử Các Phiên Bản Chính Sách & Phê Duyệt Của Chủ Cơ Sở</span>
            </h4>

            <div className="space-y-3">
              {policyVersions.map(p => (
                <div key={p.id} className="p-4 border border-[#E5DECE] rounded-xl bg-[#FAF8F5] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#0E2A47]">{p.version}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        p.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {p.status === 'approved' ? 'ĐÃ PHÊ DUYỆT & ĐANG ÁP DỤNG' : 'BẢN NHÁP (CHỜ DUYỆT)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Cọc: <strong>{p.depositPercent}%</strong> • Giữ phòng: <strong>{p.holdTimeMinutes} phút</strong> • Ngày hiệu lực: {p.effectiveDate}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tạo bởi: {p.createdBy} ({p.createdAt})
                      {p.approvedBy && ` • Phê duyệt bởi: ${p.approvedBy} (${p.approvedAt})`}
                    </p>
                    {p.draftNotes && <p className="text-[11px] text-slate-600 italic mt-1">Ghi chú: {p.draftNotes}</p>}
                  </div>

                  <div className="shrink-0">
                    {p.status === 'draft' ? (
                      userRole === 'owner' ? (
                        <button
                          onClick={() => {
                            setSelectedDraftForApproval(p);
                            setIsApprovePolicyModalOpen(true);
                          }}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Phê Duyệt & Ban Hành</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-medium">
                          Chờ Chủ cơ sở phê duyệt
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-emerald-800 font-bold flex items-center gap-1">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Chính sách hiện hành</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: THÔNG TIN & VIETQR (Property & Banking) */}
      {/* =================================================================== */}
      {activeTab === 'contact' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5DECE] gap-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0E2A47] flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#C8A261]" />
                  <span>Thông Tin Thương Hiệu & Tài Khoản VietQR Nhận Cọc</span>
                </h3>
                <p className="text-xs text-[#8C7E6C] mt-0.5">
                  Cấu hình số tài khoản MBBank khớp mã SePay tự động. Thay đổi ngân hàng yêu cầu mật khẩu xác thực của Chủ cơ sở.
                </p>
              </div>

              {!isEditingContact ? (
                <button
                  onClick={() => setIsEditingContact(true)}
                  className="px-4 py-2 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh Sửa Thông Tin</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingContact(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveContactInitiate}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu Thông Tin</span>
                  </button>
                </div>
              )}
            </div>

            {/* General Property Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#0E2A47] block mb-1">Tên Cơ Sở Thương Hiệu *</label>
                <input
                  type="text"
                  disabled={!isEditingContact}
                  value={contactForm.propertyName}
                  onChange={(e) => setContactForm({ ...contactForm, propertyName: e.target.value })}
                  className={`w-full p-2.5 rounded-xl text-xs font-semibold ${
                    isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0E2A47] block mb-1">Slogan / Thông Điệp</label>
                <input
                  type="text"
                  disabled={!isEditingContact}
                  value={contactForm.slogan}
                  onChange={(e) => setContactForm({ ...contactForm, slogan: e.target.value })}
                  className={`w-full p-2.5 rounded-xl text-xs ${
                    isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-[#0E2A47] block mb-1">Địa Chỉ Hồ Sơ Kỹ Thuật Đất Đai *</label>
                <input
                  type="text"
                  disabled={!isEditingContact}
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  className={`w-full p-2.5 rounded-xl text-xs ${
                    isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0E2A47] block mb-1">Hotline Đặt Phòng / Lễ Tân *</label>
                <input
                  type="text"
                  disabled={!isEditingContact}
                  value={contactForm.hotline}
                  onChange={(e) => setContactForm({ ...contactForm, hotline: e.target.value })}
                  className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${
                    isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0E2A47] block mb-1">Số Zalo Chăm Sóc Khách Hàng</label>
                <input
                  type="text"
                  disabled={!isEditingContact}
                  value={contactForm.zaloPhone}
                  onChange={(e) => setContactForm({ ...contactForm, zaloPhone: e.target.value })}
                  className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${
                    isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                  }`}
                />
              </div>
            </div>

            {/* Banking & VietQR Section */}
            <div className="pt-6 border-t border-[#E5DECE] space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-sm text-[#0E2A47] uppercase tracking-wider">
                  Tài Khoản Ngân Hàng Thụ Hưởng VietQR SePay
                </h4>
                <span className="text-[11px] text-slate-500 font-semibold">
                  API Key & Webhook Secret được bảo mật hoàn toàn ở biến môi trường backend (.env)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[#0E2A47] block mb-1">Ngân Hàng *</label>
                      <input
                        type="text"
                        disabled={!isEditingContact}
                        value={contactForm.bankName}
                        onChange={(e) => setContactForm({ ...contactForm, bankName: e.target.value })}
                        className={`w-full p-2.5 rounded-xl text-xs font-bold ${
                          isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#0E2A47] block mb-1">Mã BIN Ngân Hàng (NAPAS) *</label>
                      <input
                        type="text"
                        disabled={!isEditingContact}
                        value={contactForm.bankBin}
                        onChange={(e) => setContactForm({ ...contactForm, bankBin: e.target.value })}
                        className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold ${
                          isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#0E2A47] block mb-1">Số Tài Khoản Nhận Cọc *</label>
                      <input
                        type="text"
                        disabled={!isEditingContact}
                        value={contactForm.accountNumber}
                        onChange={(e) => setContactForm({ ...contactForm, accountNumber: e.target.value })}
                        className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold text-blue-900 ${
                          isEditingContact ? 'bg-white border border-blue-400' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#0E2A47] block mb-1">Tên Chủ Tài Khoản *</label>
                      <input
                        type="text"
                        disabled={!isEditingContact}
                        value={contactForm.accountHolder}
                        onChange={(e) => setContactForm({ ...contactForm, accountHolder: e.target.value.toUpperCase() })}
                        className={`w-full p-2.5 rounded-xl text-xs font-bold uppercase text-[#0E2A47] ${
                          isEditingContact ? 'bg-white border border-[#D5CBBF]' : 'bg-[#FAF8F5] border border-[#E5DECE]'
                        }`}
                      />
                    </div>
                  </div>

                  {isEditingContact && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Lưu ý bảo mật:</strong> Nếu bạn thay đổi số tài khoản hoặc ngân hàng thụ hưởng, hệ thống sẽ yêu cầu Chủ cơ sở (Owner) xác thực mật mã để chống gian lận dòng tiền cọc.
                      </span>
                    </div>
                  )}
                </div>

                {/* Real-time VietQR Preview Box */}
                <div className="border border-[#E5DECE] rounded-2xl p-4 bg-[#FAF8F5] flex flex-col items-center justify-center text-center space-y-2">
                  <span className="text-[11px] font-bold text-[#0E2A47] uppercase tracking-wider">
                    Xem Trước Mã VietQR Tự Động
                  </span>
                  <div className="p-2 bg-white rounded-xl shadow-xs border border-[#E5DECE]">
                    <img
                      src={`https://img.vietqr.io/image/${contactForm.bankBin}-${contactForm.accountNumber}-compact.png?amount=100000&addInfo=DEMO%20SEAGULL`}
                      alt="VietQR Preview"
                      className="w-36 h-36 object-contain"
                      onError={(e) => {
                        // Fallback SVG if offline
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#0E2A47]">{contactForm.accountNumber}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{contactForm.accountHolder}</span>
                </div>
              </div>
            </div>

            {/* Bank Change Audit Logs */}
            <div className="pt-4 border-t border-[#E5DECE] space-y-2">
              <h5 className="font-bold text-xs text-[#0E2A47] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Nhật Ký Thay Đổi Tài Khoản Ngân Hàng (Bank Change Audit Log)</span>
              </h5>
              <div className="overflow-x-auto border border-[#E5DECE] rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FAF8F5] text-slate-700 font-bold border-b border-[#E5DECE]">
                    <tr>
                      <th className="p-2">Thời Điểm</th>
                      <th className="p-2">Người Đổi</th>
                      <th className="p-2">Tài Khoản Cũ</th>
                      <th className="p-2">Tài Khoản Mới</th>
                      <th className="p-2">Lý Do</th>
                      <th className="p-2">Xác Thực Chủ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DECE]">
                    {bankAuditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-[#FAF8F5]/60">
                        <td className="p-2 font-mono text-slate-500">{log.timestamp}</td>
                        <td className="p-2 font-bold text-[#0E2A47]">{log.staffName}</td>
                        <td className="p-2 font-mono text-slate-500 line-through">{log.oldBankInfo}</td>
                        <td className="p-2 font-mono text-blue-900 font-bold">{log.newBankInfo}</td>
                        <td className="p-2 text-slate-600">{log.reason}</td>
                        <td className="p-2">
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                            ✔ Đã Xác Nhận
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: TÀI KHOẢN & PHÂN QUYỀN (Per-Staff Accounts + Audit Trail) */}
      {/* =================================================================== */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DECE] rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5DECE] gap-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0E2A47] flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#C8A261]" />
                  <span>Quản Lý Tài Khoản Nhân Sự Cá Nhân & Nhật Ký Kiểm Toán</span>
                </h3>
                <p className="text-xs text-[#8C7E6C] mt-0.5">
                  Mỗi nhân viên có username &amp; mật khẩu riêng (hash scrypt trong bảng <code className="font-mono text-[#0E2A47]">public.user_roles</code>), áp RLS theo vai trò và ghi nhận audit trail theo từng người.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchStaffAndAuditData}
                  disabled={staffLoading}
                  className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#EFEAE0] text-[#0E2A47] border border-[#D5CBBF] rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${staffLoading ? 'animate-spin' : ''}`} />
                  <span>Tải lại</span>
                </button>
                {userRole === 'owner' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddUserError('');
                      setIsAddUserModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Nhân Viên Mới</span>
                  </button>
                )}
              </div>
            </div>

            {staffApiError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{staffApiError}</span>
              </div>
            )}

            {/* Staff list (Owner view) */}
            {userRole === 'owner' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E2A47]">
                    Danh Sách Tài Khoản Nhân Sự ({staffAccounts.length} tài khoản)
                  </h4>
                  {staffStorageMode && (
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      staffStorageMode === 'supabase'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {staffStorageMode === 'supabase' ? 'Supabase public.user_roles (Live)' : 'Bộ nhớ Demo cục bộ'}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto border border-[#E5DECE] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF8F5] text-[#0E2A47] font-bold border-b border-[#E5DECE]">
                      <tr>
                        <th className="p-3">Họ Tên &amp; Tài Khoản</th>
                        <th className="p-3">Vai Trò (RLS Role)</th>
                        <th className="p-3">Điện Thoại</th>
                        <th className="p-3">Đăng Nhập Gần Nhất</th>
                        <th className="p-3">Trạng Thái</th>
                        <th className="p-3 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DECE]">
                      {staffAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-500">
                            {staffLoading ? 'Đang tải danh sách tài khoản nhân sự...' : 'Chưa có tài khoản nhân sự nào.'}
                          </td>
                        </tr>
                      ) : (
                        staffAccounts.map((u) => (
                          <tr key={u.id} className="hover:bg-[#FAF8F5]/50">
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#0E2A47] text-[#C8A261] flex items-center justify-center font-bold text-xs shrink-0">
                                  {(u.fullName || u.username || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-[#0E2A47] flex items-center gap-1.5">
                                    <span>{u.fullName}</span>
                                    {u.username === currentUsername && (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                                        Bạn
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    @{u.username} {u.email ? `· ${u.email}` : ''}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-block ${
                                  u.role === 'owner'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : u.role === 'reception'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                    : u.role === 'accountant'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}
                              >
                                {u.role === 'owner' && '👑 CHỦ CƠ SỞ (owner)'}
                                {u.role === 'reception' && '🛎️ LỄ TÂN (reception)'}
                                {u.role === 'accountant' && '📊 KẾ TOÁN (accountant)'}
                                {u.role === 'housekeeping' && '🧹 BUỒNG PHÒNG (housekeeping)'}
                                {u.role === 'coffee_staff' && '☕ CÀ PHÊ POS (coffee_staff)'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-700">{u.phone || '—'}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-600">
                              {formatTimestampVN(u.lastLoginAt)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {u.isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetTarget(u);
                                    setResetPasswordValue('');
                                    setResetPasswordError('');
                                  }}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg border text-[#0E2A47] bg-[#FAF8F5] border-[#D5CBBF] hover:bg-[#EFEAE0] inline-flex items-center gap-1"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>Đặt lại MK</span>
                                </button>
                                {u.username !== currentUsername && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserActive(u)}
                                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                                      u.isActive
                                        ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                        : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {u.isActive ? 'Tạm khóa' : 'Kích hoạt'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl text-xs text-slate-700">
                Bạn đang đăng nhập bằng tài khoản cá nhân <strong>{currentStaff}</strong>
                {currentUsername ? <span className="font-mono"> (@{currentUsername})</span> : null}. Chỉ Chủ cơ sở (Owner) mới có quyền thêm hoặc khóa tài khoản nhân sự khác.
              </div>
            )}

            {/* Self-service change own password */}
            <div className="pt-4 border-t border-[#E5DECE] space-y-3">
              <h4 className="font-serif font-bold text-sm text-[#0E2A47] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#C8A261]" />
                <span>Đổi Mật Khẩu Cá Nhân ({currentUsername ? `@${currentUsername}` : currentStaff})</span>
              </h4>
              <form onSubmit={handleChangeOwnPassword} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs">
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Mật Khẩu Hiện Tại</label>
                  <input
                    type="password"
                    required
                    value={ownPassForm.currentPassword}
                    onChange={(e) => setOwnPassForm({ ...ownPassForm, currentPassword: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                    placeholder="Nhập mật khẩu cũ..."
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Mật Khẩu Mới (≥ 8 ký tự)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={ownPassForm.newPassword}
                    onChange={(e) => setOwnPassForm({ ...ownPassForm, newPassword: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                    placeholder="Tối thiểu 8 ký tự..."
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Nhập Lại Mật Khẩu Mới</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={ownPassForm.confirmPassword}
                    onChange={(e) => setOwnPassForm({ ...ownPassForm, confirmPassword: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                    placeholder="Xác nhận mật khẩu mới..."
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isChangingOwnPass}
                    className="w-full py-2.5 px-4 bg-[#0E2A47] hover:bg-[#163A5F] disabled:opacity-60 text-white font-bold rounded-xl"
                  >
                    {isChangingOwnPass ? 'Đang lưu...' : 'Cập Nhật Mật Khẩu'}
                  </button>
                </div>
              </form>
              {ownPassError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {ownPassError}
                </div>
              )}
            </div>

            {/* Per-Staff Audit Trail (Owner & Accountant) */}
            {(userRole === 'owner' || userRole === 'accountant') && (
              <div className="pt-4 border-t border-[#E5DECE] space-y-3">
                <h4 className="font-serif font-bold text-sm text-[#0E2A47] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#C8A261]" />
                  <span>Nhật Ký Đăng Nhập &amp; Thao Tác Theo Từng Nhân Sự (Audit Trail)</span>
                </h4>
                <div className="overflow-x-auto border border-[#E5DECE] rounded-xl max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF8F5] text-[#0E2A47] font-bold border-b border-[#E5DECE] sticky top-0">
                      <tr>
                        <th className="p-2.5">Thời Điểm</th>
                        <th className="p-2.5">Nhân Sự Thực Hiện</th>
                        <th className="p-2.5">Vai Trò</th>
                        <th className="p-2.5">Hành Động</th>
                        <th className="p-2.5">Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DECE]">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-5 text-center text-slate-500">
                            Chưa có bản ghi kiểm toán nào.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => {
                          const actorName = log.newData?.actorName || log.actorId;
                          const actorUsername = log.newData?.actorUsername || log.actorId;
                          const detailParts: string[] = [];
                          if (log.newData?.targetUsername) detailParts.push(`TK đích: @${log.newData.targetUsername}`);
                          if (log.newData?.username && log.action === 'STAFF_CREATED') detailParts.push(`Tạo @${log.newData.username} (${log.newData.role})`);
                          if (typeof log.newData?.isActive === 'boolean') detailParts.push(log.newData.isActive ? 'Kích hoạt' : 'Tạm khóa');
                          if (log.newData?.reason) detailParts.push(`Lý do: ${log.newData.reason}`);
                          if (log.newData?.bookingCode) detailParts.push(`Đơn: ${log.newData.bookingCode}`);
                          if (log.newData?.roomId) detailParts.push(`Phòng: ${log.newData.roomId}`);
                          if (log.newData?.ip) detailParts.push(`IP: ${log.newData.ip}`);

                          return (
                            <tr key={log.id} className="hover:bg-[#FAF8F5]/60">
                              <td className="p-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {formatTimestampVN(log.createdAt)}
                              </td>
                              <td className="p-2.5">
                                <div className="font-bold text-[#0E2A47]">{actorName}</div>
                                <div className="text-[10px] font-mono text-slate-500">@{actorUsername}</div>
                              </td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                                  {log.actorType}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-[11px] font-bold text-[#0E2A47]">
                                {log.action}
                              </td>
                              <td className="p-2.5 text-slate-600">
                                {detailParts.length > 0 ? detailParts.join(' · ') : `${log.entityType}${log.entityId ? ` (${log.entityId})` : ''}`}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Role-Permission Matrix Table */}
            <div className="pt-4 border-t border-[#E5DECE] space-y-3">
              <h4 className="font-serif font-bold text-sm text-[#0E2A47]">
                Ma Trận Phân Quyền Chi Tiết (Role-Permission Matrix)
              </h4>
              <div className="overflow-x-auto border border-[#E5DECE] rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FAF8F5] text-[#0E2A47] font-bold border-b border-[#E5DECE]">
                    <tr>
                      <th className="p-2.5">Chức Năng Nghiệp Vụ</th>
                      <th className="p-2.5 text-center">👑 Chủ Cơ Sở</th>
                      <th className="p-2.5 text-center">🛎️ Lễ Tân Ca Trực</th>
                      <th className="p-2.5 text-center">📊 Kế Toán Doanh Thu</th>
                      <th className="p-2.5 text-center">☕ Barista Coffee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DECE]">
                    {[
                      { action: 'Xem Sơ Đồ 27 Phòng & Tình Trạng', owner: '✔ Toàn quyền', rec: '✔ Toàn quyền', acc: '👁 Chỉ xem', pos: '✖ Không' },
                      { action: 'Bán Phòng Tại Quầy (Walk-in)', owner: '✔ Toàn quyền', rec: '✔ Toàn quyền', acc: '✖ Không', pos: '✖ Không' },
                      { action: 'Check-in, Check-out, Khai Báo Lưu Trú', owner: '✔ Toàn quyền', rec: '✔ Toàn quyền', acc: '✖ Không', pos: '✖ Không' },
                      { action: 'Xem Doanh Thu & Sổ Quỹ Chi Tiết', owner: '✔ Toàn quyền', rec: '✖ Không (Khóa)', acc: '✔ Toàn quyền', pos: '✖ Không' },
                      { action: 'Xem Số Điện Thoại / Email Khách Hàng', owner: '✔ Hiển thị đầy đủ', rec: '🔒 Masking (098***123)', acc: '✖ Ẩn hoàn toàn', pos: '✖ Không' },
                      { action: 'Điều Chỉnh Giá Phòng & Phụ Thu Mùa', owner: '✔ Toàn quyền', rec: '👁 Chỉ xem', acc: '👁 Chỉ xem', pos: '✖ Không' },
                      { action: 'Thay Đổi Tài Khoản Nhận Cọc VietQR', owner: '✔ Xác thực mật khẩu', rec: '✖ Bị cấm', acc: '✖ Bị cấm', pos: '✖ Không' },
                      { action: 'Phê Duyệt Chính Sách & Cọc 30%', owner: '✔ Toàn quyền', rec: '📝 Chỉ soạn nháp', acc: '👁 Chỉ xem', pos: '✖ Không' },
                      { action: 'Quản Lý Tài Khoản Nhân Sự & Audit Trail', owner: '✔ Toàn quyền', rec: '✖ Bị cấm', acc: '👁 Xem Audit', pos: '✖ Không' },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5]/60">
                        <td className="p-2.5 font-bold text-[#0E2A47]">{row.action}</td>
                        <td className="p-2.5 text-center font-bold text-purple-900 bg-purple-50/30">{row.owner}</td>
                        <td className="p-2.5 text-center font-semibold text-blue-900">{row.rec}</td>
                        <td className="p-2.5 text-center font-semibold text-amber-900">{row.acc}</td>
                        <td className="p-2.5 text-center text-slate-400">{row.pos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: THÊM QUY TẮC GIÁ THEO KHOẢNG NGÀY (Rule Modal) */}
      {/* =================================================================== */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DECE]">
              <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                Thêm Cấu Hình Giá Theo Khoảng Ngày
              </h3>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-slate-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {ruleError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{ruleError}</span>
              </div>
            )}

            <form onSubmit={handleAddSeasonalRule} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Tên Dịp / Mùa Áp Dụng *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Mùa hè cao điểm, Lễ 2/9, Tết Dương Lịch..."
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Từ Ngày *</label>
                  <input
                    type="date"
                    required
                    value={ruleForm.startDate}
                    onChange={(e) => setRuleForm({ ...ruleForm, startDate: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Đến Ngày *</label>
                  <input
                    type="date"
                    required
                    value={ruleForm.endDate}
                    onChange={(e) => setRuleForm({ ...ruleForm, endDate: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Áp Dụng Cho Loại Phòng</label>
                <select
                  value={ruleForm.roomTypeId}
                  onChange={(e) => setRuleForm({ ...ruleForm, roomTypeId: e.target.value })}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                >
                  <option value="all">Toàn bộ 27 phòng kinh doanh</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Kiểu Điều Chỉnh</label>
                  <select
                    value={ruleForm.adjustmentType}
                    onChange={(e) => setRuleForm({ ...ruleForm, adjustmentType: e.target.value as any })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                  >
                    <option value="percentage">Phụ thu phần trăm (%)</option>
                    <option value="fixed_price">Giá cố định (VND/đêm)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Mức Điều Chỉnh *</label>
                  <input
                    type="number"
                    required
                    value={ruleForm.adjustmentValue}
                    onChange={(e) => setRuleForm({ ...ruleForm, adjustmentValue: Number(e.target.value) })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Ghi Chú</label>
                <input
                  type="text"
                  placeholder="Ghi chú nội bộ..."
                  value={ruleForm.note}
                  onChange={(e) => setRuleForm({ ...ruleForm, note: e.target.value })}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-black"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0E2A47] text-white font-bold rounded-xl"
                >
                  Xác Nhận Thêm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: TẢI ẢNH MỚI LÊN (Upload Modal) */}
      {/* =================================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DECE]">
              <div>
                <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                  Tải Ảnh Thực Tế Lên Thư Viện
                </h3>
                <p className="text-[11px] text-[#8C7E6C]">
                  Hỗ trợ JPG, PNG, WebP (Tối đa 5MB)
                </p>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D5CBBF] hover:border-[#0E2A47] rounded-2xl p-6 text-center cursor-pointer bg-[#FAF8F5] transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-[#0E2A47] mx-auto mb-2 opacity-70" />
                <span className="font-bold text-xs text-[#0E2A47] block">
                  Nhấp để chọn ảnh từ máy tính hoặc kéo thả vào đây
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {uploadFileName ? `Đã chọn: ${uploadFileName} (${uploadFileSizeKb} KB)` : 'JPG, PNG hoặc WebP dung lượng dưới 5MB'}
                </span>
              </div>

              {/* Preview image */}
              {uploadPreviewUrl && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 block">Xem trước ảnh:</span>
                  <div className="rounded-xl overflow-hidden aspect-video border border-[#E5DECE] bg-slate-100 max-h-48">
                    <img src={uploadPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Gắn Vào Vị Trí *</label>
                  <select
                    value={uploadTargetCategory}
                    onChange={(e) => setUploadTargetCategory(e.target.value as any)}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                  >
                    <option value="homepage">Trang chủ (Hero Banner)</option>
                    <option value="cafe">Khu Cà Phê Vách Đá</option>
                    <option value="room_type">Loại phòng cụ thể</option>
                  </select>
                </div>

                {uploadTargetCategory === 'room_type' && (
                  <div>
                    <label className="font-bold text-[#0E2A47] block mb-1">Loại Phòng Cụ Thể</label>
                    <select
                      value={uploadTargetRoomTypeId}
                      onChange={(e) => setUploadTargetRoomTypeId(e.target.value)}
                      className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                    >
                      {roomTypes.map(rt => (
                        <option key={rt.id} value={rt.id}>{rt.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Mô Tả Ảnh (Alt Text SEO)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Căn bungalow vòm view biển An Vĩnh..."
                  value={uploadAltText}
                  onChange={(e) => setUploadAltText(e.target.value)}
                  className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                <strong>Chế độ DEMO cục bộ:</strong> Ảnh được lưu trữ trong trình duyệt để xem thử ngay. Chưa thực hiện upload lên Supabase Storage bucket thật.
              </div>

              <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-black"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveUploadedPhoto}
                  className="px-5 py-2 bg-[#0E2A47] text-white font-bold rounded-xl"
                >
                  Lưu Vào Bộ Sưu Tập
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: XÁC NHẬN XÓA ẢNH (Delete Confirm Modal) */}
      {/* =================================================================== */}
      {mediaDeleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="font-serif font-bold text-base text-[#0E2A47]">Xác Nhận Xóa Ảnh</h4>
            </div>
            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn xóa bức ảnh này khỏi thư viện hiển thị? Thao tác này không thể hoàn tác.
            </p>
            <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2 text-xs">
              <button
                onClick={() => setMediaDeleteConfirmId(null)}
                className="px-4 py-2 text-slate-600 hover:text-black font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={handleDeletePhotoConfirmed}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: PHÊ DUYỆT CHÍNH SÁCH BỞI CHỦ CƠ SỞ */}
      {/* =================================================================== */}
      {isApprovePolicyModalOpen && selectedDraftForApproval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <h4 className="font-serif font-bold text-base text-[#0E2A47]">
                Phê Duyệt & Ban Hành Chính Sách {selectedDraftForApproval.version}
              </h4>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <p>Chủ cơ sở ({currentStaff}) xác nhận ban hành chính sách mới:</p>
              <ul className="list-disc pl-5 font-semibold">
                <li>Tỷ lệ cọc: {selectedDraftForApproval.depositPercent}%</li>
                <li>Thời gian giữ phòng: {selectedDraftForApproval.holdTimeMinutes} phút</li>
                <li>Ngày có hiệu lực: {selectedDraftForApproval.effectiveDate}</li>
              </ul>
            </div>
            <p className="text-xs text-slate-600">
              Chính sách mới sẽ được áp dụng cho toàn bộ các khách đặt mới từ thời điểm phê duyệt. Đơn đặt cũ giữ nguyên giá trị hợp đồng ban đầu.
            </p>
            <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsApprovePolicyModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-black"
              >
                Đóng
              </button>
              <button
                onClick={handleApprovePolicyConfirmed}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl"
              >
                Xác Nhận Ban Hành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: XÁC THỰC THAY ĐỔI TÀI KHOẢN NGÂN HÀNG (Sensitive Bank Change) */}
      {/* =================================================================== */}
      {isBankConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <Lock className="w-6 h-6 shrink-0" />
              <h4 className="font-serif font-bold text-base text-[#0E2A47]">
                Xác Thực Đổi Tài Khoản Thụ Hưởng VietQR
              </h4>
            </div>

            {bankConfirmError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {bankConfirmError}
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">Thay đổi tài khoản nhận tiền cọc là thao tác cực kỳ quan trọng:</p>
              <p>Mới: <strong>{contactForm.bankName} - {contactForm.accountNumber} ({contactForm.accountHolder})</strong></p>
              <p className="line-through text-slate-500">Cũ: {propertyConfig.bankName} - {propertyConfig.accountNumber}</p>
            </div>

            <form onSubmit={handleConfirmBankChange} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">
                  Lý Do Điều Chỉnh Tài Khoản Ngân Hàng *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chuyển sang tài khoản MBBank chuyên dùng cho VietQR SePay..."
                  value={bankChangeReason}
                  onChange={(e) => setBankChangeReason(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">
                  Mật Khẩu Xác Thực Của Chủ Cơ Sở *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu phiên làm việc..."
                  value={ownerConfirmPassword}
                  onChange={(e) => setOwnerConfirmPassword(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBankConfirmModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-black"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl"
                >
                  Xác Nhận & Ghi Nhật Ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: THÊM TÀI KHOẢN NHÂN VIÊN MỚI (Lưu Supabase user_roles + Scrypt) */}
      {/* =================================================================== */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DECE]">
              <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                Tạo Tài Khoản Nhân Sự Cá Nhân
              </h3>
              <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="text-slate-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addUserError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{addUserError}</span>
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Họ Tên Nhân Sự *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Thị Trúc"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Tên Đăng Nhập (Username) *</label>
                  <input
                    type="text"
                    required
                    placeholder="letan.truc"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Số Điện Thoại</label>
                  <input
                    type="tel"
                    placeholder="0868xxxxxx"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Email (tùy chọn)</label>
                <input
                  type="email"
                  placeholder="Để trống sẽ tự gán <username>@seagull.lyson"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Vai Trò Phân Quyền (RLS) *</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg font-semibold"
                >
                  <option value="reception">🛎️ Lễ Tân (reception — Check-in, Sơ đồ phòng, Masking SĐT)</option>
                  <option value="accountant">📊 Kế Toán (accountant — Xem doanh thu, dòng tiền, audit)</option>
                  <option value="owner">👑 Chủ Cơ Sở (owner — Toàn quyền quản trị)</option>
                  <option value="housekeeping">🧹 Buồng Phòng (housekeeping — Lịch dọn phòng)</option>
                  <option value="coffee_staff">☕ Quầy Cà Phê (coffee_staff — Cô lập khỏi lưu trú)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Mật Khẩu Riêng (≥ 8 ký tự, tự động hash scrypt) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Tối thiểu 8 ký tự..."
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg font-mono"
                />
              </div>

              <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-black"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 bg-[#0E2A47] hover:bg-[#163A5F] disabled:opacity-60 text-white font-bold rounded-xl"
                >
                  {isSubmittingUser ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ĐẶT LẠI MẬT KHẨU CHO NHÂN VIÊN (Owner Action) */}
      {/* =================================================================== */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DECE]">
              <div>
                <h3 className="font-serif font-bold text-base text-[#0E2A47]">
                  Đặt Lại Mật Khẩu
                </h3>
                <p className="text-[11px] text-[#8C7E6C]">
                  {resetTarget.fullName} (<span className="font-mono">@{resetTarget.username}</span>)
                </p>
              </div>
              <button type="button" onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetPasswordError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {resetPasswordError}
              </div>
            )}

            <form onSubmit={handleResetStaffPassword} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Mật Khẩu Mới (tối thiểu 8 ký tự) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Nhập mật khẩu mới..."
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg font-mono"
                />
              </div>

              <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-slate-600 hover:text-black"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-5 py-2 bg-[#0E2A47] hover:bg-[#163A5F] disabled:opacity-60 text-white font-bold rounded-xl"
                >
                  {isResettingPassword ? 'Đang lưu...' : 'Lưu Mật Khẩu Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
