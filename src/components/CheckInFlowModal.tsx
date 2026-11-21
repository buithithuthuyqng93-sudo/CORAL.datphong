import React, { useState, useMemo } from 'react';
import { 
  Booking, Room, BookingStayRecord, StayGuest, 
  DeclarationStatus, DocumentCheckType, PropertyConfig 
} from '../types';
import { 
  UserCheck, Users, ShieldCheck, CheckCircle2, AlertCircle, 
  ExternalLink, ArrowRight, ArrowLeft, Check, X, Clock, 
  FileText, Globe, AlertTriangle, KeyRound, Building, Phone,
  Lock, RefreshCw, Info, WifiOff
} from 'lucide-react';

interface CheckInFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: BookingStayRecord;
  booking?: Booking;
  rooms: Room[];
  targetRoomNumber?: string;
  userRole: 'owner' | 'reception' | 'accountant';
  currentStaff: string;
  propertyConfig: PropertyConfig;
  onSaveStayRecord: (updatedRecord: BookingStayRecord, roomNumberToCheckIn?: string) => void;
  showToast: (msg: string) => void;
  maskPhone: (phone?: string) => string;
}

export const CheckInFlowModal: React.FC<CheckInFlowModalProps> = ({
  isOpen,
  onClose,
  record,
  booking,
  rooms,
  targetRoomNumber,
  userRole,
  currentStaff,
  propertyConfig,
  onSaveStayRecord,
  showToast,
  maskPhone,
}) => {
  // Current active step (1, 2, 3)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Editable stay record state cloned for this modal session
  const [localRecord, setLocalRecord] = useState<BookingStayRecord>(() => {
    return JSON.parse(JSON.stringify(record));
  });

  // Selected room(s) to check-in in this session
  const [selectedRoomsToCheckIn, setSelectedRoomsToCheckIn] = useState<string[]>(() => {
    if (targetRoomNumber) return [targetRoomNumber];
    // Default to rooms that are not checked in yet
    const notCheckedIn = record.roomAllocations.filter(r => !r.isCheckedIn).map(r => r.roomNumber);
    return notCheckedIn.length > 0 ? notCheckedIn : record.roomAllocations.map(r => r.roomNumber);
  });

  // Shift handoff note if declaration is not completed
  const [handoffNote, setHandoffNote] = useState<string>('');
  const [isKeyDelivered, setIsKeyDelivered] = useState(true);

  // New guest modal inside Step 1
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [newGuestForm, setNewGuestForm] = useState({
    fullName: '',
    birthYear: 1996,
    gender: 'male' as 'male' | 'female' | 'other',
    nationality: 'VN' as 'VN' | 'FOREIGN',
    nationalityName: 'Việt Nam',
    assignedRoomNumber: record.roomAllocations[0]?.roomNumber || '',
  });

  // Verification statistics
  const stats = useMemo(() => {
    const totalGuests = localRecord.guests.length;
    const documentCheckedCount = localRecord.guests.filter(g => g.isDocumentChecked).length;
    const verifiedDeclarationCount = localRecord.guests.filter(g => g.declarationStatus === 'verified_completed').length;
    const isMismatch = localRecord.totalActualGuests !== localRecord.totalExpectedGuests;
    const extraGuestsCount = Math.max(0, localRecord.totalActualGuests - localRecord.totalExpectedGuests);
    
    return {
      totalGuests,
      documentCheckedCount,
      verifiedDeclarationCount,
      declarationPercentage: totalGuests > 0 ? Math.round((verifiedDeclarationCount / totalGuests) * 100) : 0,
      isMismatch,
      extraGuestsCount,
      allDocumentsChecked: documentCheckedCount === totalGuests && totalGuests > 0,
      allDeclarationsVerified: verifiedDeclarationCount === totalGuests && totalGuests > 0,
    };
  }, [localRecord]);

  if (!isOpen) return null;

  // Security & RBAC: Accountant is strictly prohibited from accessing guest identity documents or checking in
  if (userRole === 'accountant') {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden p-6 text-center space-y-4 animate-scale-up">
          <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#0E2A47]">
              Không Đủ Quyền Truy Cập (403 Forbidden)
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Tài khoản <strong>Kế toán</strong> chỉ có quyền xem và hạch toán dòng tiền/doanh thu. Theo quy định bảo vệ dữ liệu cá nhân tại <strong>Nghị định 13/2023/NĐ-CP</strong> và chính sách PMS Seagull, Kế toán không được truy cập hồ sơ giấy tờ tùy thân của khách lưu trú hoặc thực hiện thủ tục Check-in.
            </p>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-[11px] text-amber-900">
            <strong>Hướng dẫn:</strong> Vui lòng chuyển sang ca trực của <strong>Lễ Tân</strong> hoặc <strong>Chủ cơ sở</strong> để thực hiện quy trình Check-in.
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#0E2A47] hover:bg-[#163A5F] text-white text-xs font-bold rounded-xl transition-all"
          >
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STEP 1 HANDLERS: GUEST DOCUMENT CHECK
  // --------------------------------------------------------------------------
  const handleToggleGuestDocument = (guestId: string, docType: DocumentCheckType = 'cccd') => {
    const updatedGuests = localRecord.guests.map(g => {
      if (g.id === guestId) {
        const next = !g.isDocumentChecked;
        return {
          ...g,
          isDocumentChecked: next,
          documentTypeVerified: next ? docType : undefined,
          checkedByStaff: next ? currentStaff : undefined,
          checkedAt: next ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : undefined,
          documentNotes: next ? `Đã đối chiếu trực tiếp bản gốc ${docType.toUpperCase()}` : undefined,
        };
      }
      return g;
    });

    setLocalRecord({
      ...localRecord,
      guests: updatedGuests,
    });
  };

  const handleUpdateGuestDocType = (guestId: string, docType: DocumentCheckType) => {
    const updatedGuests = localRecord.guests.map(g => {
      if (g.id === guestId) {
        return {
          ...g,
          documentTypeVerified: docType,
          documentNotes: `Đã đối chiếu trực tiếp bản gốc ${docType.toUpperCase()}`,
        };
      }
      return g;
    });

    setLocalRecord({
      ...localRecord,
      guests: updatedGuests,
    });
  };

  const handleAddExtraGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestForm.fullName.trim()) {
      alert('Vui lòng nhập họ và tên khách lưu trú.');
      return;
    }

    const newGuest: StayGuest = {
      id: `gst-${Date.now()}`,
      fullName: newGuestForm.fullName.trim(),
      birthYear: newGuestForm.birthYear,
      gender: newGuestForm.gender,
      nationality: newGuestForm.nationality,
      nationalityName: newGuestForm.nationalityName,
      assignedRoomId: `rm-${newGuestForm.assignedRoomNumber}`,
      assignedRoomNumber: newGuestForm.assignedRoomNumber,
      isPrimaryContact: false,
      isDocumentChecked: false,
      declarationStatus: 'unprocessed',
    };

    const updatedGuests = [...localRecord.guests, newGuest];
    setLocalRecord({
      ...localRecord,
      guests: updatedGuests,
      totalActualGuests: updatedGuests.length,
      attentionRequired: true,
      attentionReasons: [
        ...localRecord.attentionReasons.filter(r => !r.includes('phát sinh')),
        `Phát hiện thêm khách lưu trú mới (${newGuest.fullName}) chưa xuất trình giấy tờ.`,
      ],
    });

    setIsAddingGuest(false);
    setNewGuestForm({
      fullName: '',
      birthYear: 1996,
      gender: 'male',
      nationality: 'VN',
      nationalityName: 'Việt Nam',
      assignedRoomNumber: localRecord.roomAllocations[0]?.roomNumber || '',
    });
    showToast(`Đã thêm khách ${newGuest.fullName} vào phòng ${newGuest.assignedRoomNumber}!`);
  };

  // --------------------------------------------------------------------------
  // STEP 2 HANDLERS: DECLARATION STATUS & REFERENCE CODE (MANUAL RECORDING)
  // --------------------------------------------------------------------------
  const handleUpdateGuestDeclaration = (
    guestId: string, 
    status: DeclarationStatus, 
    refCode?: string, 
    notes?: string,
    basis?: string
  ) => {
    // Only authorized staff (Reception or Owner) can verify completion
    if (status === 'verified_completed' && userRole !== 'owner' && userRole !== 'reception') {
      showToast('Chỉ Lễ tân ca trực hoặc Chủ cơ sở mới có quyền xác nhận hoàn tất khai báo.');
      return;
    }

    const nowFormatted = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date().toLocaleDateString('vi-VN')}`;

    const updatedGuests = localRecord.guests.map(g => {
      if (g.id === guestId) {
        const isVerified = status === 'verified_completed';
        const selectedBasis = basis !== undefined ? basis : (g.verificationBasis || 'Biên nhận điện tử trên Cổng TBLT KBTT');
        
        return {
          ...g,
          declarationStatus: status,
          // Optional ref code without any fake generation: keep whatever was provided or keep previous
          declarationReferenceCode: refCode !== undefined ? (refCode.trim() ? refCode.trim() : undefined) : g.declarationReferenceCode,
          declarationVerifiedBy: isVerified ? currentStaff : (status === 'unprocessed' ? undefined : g.declarationVerifiedBy),
          declarationVerifiedAt: isVerified ? nowFormatted : (status === 'unprocessed' ? undefined : g.declarationVerifiedAt),
          declarationNotes: notes !== undefined ? notes : g.declarationNotes,
          verificationBasis: isVerified ? selectedBasis : (status === 'unprocessed' ? undefined : g.verificationBasis),
        };
      }
      return g;
    });

    // Calculate overall declaration status for group or single
    const verifiedCount = updatedGuests.filter(g => g.declarationStatus === 'verified_completed').length;
    let overallStatus: DeclarationStatus = 'unprocessed';
    if (verifiedCount === updatedGuests.length && updatedGuests.length > 0) {
      overallStatus = 'verified_completed';
    } else if (verifiedCount > 0) {
      overallStatus = 'awaiting_verification';
    } else if (updatedGuests.some(g => g.declarationStatus === 'in_progress')) {
      overallStatus = 'in_progress';
    } else if (updatedGuests.some(g => g.declarationStatus === 'needs_revision')) {
      overallStatus = 'needs_revision';
    }

    const targetGuest = localRecord.guests.find(g => g.id === guestId);
    const guestLabel = targetGuest ? targetGuest.fullName : 'Khách lưu trú';

    setLocalRecord({
      ...localRecord,
      guests: updatedGuests,
      overallDeclarationStatus: overallStatus,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          staffName: currentStaff,
          action: 'DECLARATION_STATUS_UPDATE',
          details: `Ghi nhận khai báo cho ${guestLabel}: trạng thái -> ${status}${refCode ? `, mã biên nhận: ${refCode}` : ''}${basis ? `, căn cứ: ${basis}` : ''}. Người thực hiện: ${currentStaff}.`,
        },
        ...localRecord.auditLogs,
      ],
    });
  };

  const handleMarkAllInProgress = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const updatedGuests = localRecord.guests.map(g => {
      if (g.declarationStatus === 'unprocessed') {
        return {
          ...g,
          declarationStatus: 'in_progress' as DeclarationStatus,
          declarationNotes: `Đã nộp hồ sơ trên Cổng DVC Bộ Công an lúc ${nowTime}, đang chờ phê duyệt.`,
        };
      }
      return g;
    });

    setLocalRecord({
      ...localRecord,
      guests: updatedGuests,
      overallDeclarationStatus: 'in_progress',
    });
    showToast('Đã đánh dấu toàn bộ khách sang trạng thái: ĐANG XỬ LÝ');
  };

  const handleReportNetworkOutage = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const outageMsg = `Sự cố mất mạng / Cổng DVC Bộ Công an bảo trì lúc ${nowTime}. Đã ghi nhận hồ sơ giấy tại quầy, chuyển giao ca sau nộp bù.`;

    const updatedGuests = localRecord.guests.map(g => {
      if (g.declarationStatus !== 'verified_completed') {
        return {
          ...g,
          declarationStatus: 'in_progress' as DeclarationStatus,
          declarationNotes: outageMsg,
        };
      }
      return g;
    });

    setLocalRecord({
      ...localRecord,
      guests: updatedGuests,
      overallDeclarationStatus: 'in_progress',
      attentionRequired: true,
      attentionReasons: [
        ...localRecord.attentionReasons.filter(r => !r.includes('bảo trì')),
        outageMsg,
      ],
    });
    setHandoffNote(outageMsg);
    showToast('Đã ghi nhận sự cố mạng vào sổ bàn giao ca trực!');
  };

  // --------------------------------------------------------------------------
  // STEP 3 HANDLERS: FINAL CHECK-IN CONFIRMATION
  // --------------------------------------------------------------------------
  const handleFinalCheckInComplete = () => {
    // Permission check
    if (userRole === 'accountant') {
      alert('Tài khoản Kế toán không có quyền thực hiện thủ tục nhận phòng (Check-in).');
      return;
    }

    if (selectedRoomsToCheckIn.length === 0) {
      alert('Vui lòng chọn ít nhất một phòng cần làm thủ tục nhận phòng.');
      return;
    }

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // 1. Update Room Allocations
    const updatedAllocations = localRecord.roomAllocations.map(alloc => {
      if (selectedRoomsToCheckIn.includes(alloc.roomNumber)) {
        return {
          ...alloc,
          isCheckedIn: true,
          checkedInAt: nowStr,
          checkedInBy: currentStaff,
        };
      }
      return alloc;
    });

    const allRoomsCheckedIn = updatedAllocations.every(a => a.isCheckedIn);
    const someRoomsCheckedIn = updatedAllocations.some(a => a.isCheckedIn);
    const overallCheckInStatus = allRoomsCheckedIn ? 'fully_checked_in' : (someRoomsCheckedIn ? 'partially_checked_in' : 'not_checked_in');

    // 2. Evaluate Attention Status (Decoupled check-in vs declaration rule!)
    const hasUnverifiedDeclaration = localRecord.guests.some(g => g.declarationStatus !== 'verified_completed');
    const hasUncheckedDocument = localRecord.guests.some(g => !g.isDocumentChecked);
    
    const attentionReasons: string[] = [];
    if (hasUnverifiedDeclaration) {
      attentionReasons.push(`Mới xác nhận hoàn tất ${stats.verifiedDeclarationCount}/${stats.totalGuests} khách. Còn ${stats.totalGuests - stats.verifiedDeclarationCount} khách chưa hoàn tất khai báo.`);
    }
    if (hasUncheckedDocument) {
      attentionReasons.push(`Còn ${localRecord.guests.filter(g => !g.isDocumentChecked).length} khách chưa xuất trình giấy tờ tùy thân trực tiếp.`);
    }
    if (stats.isMismatch) {
      attentionReasons.push(`Sai lệch số khách thực tế (+${stats.extraGuestsCount} khách phát sinh).`);
    }
    if (handoffNote.trim()) {
      attentionReasons.push(`Ghi chú bàn giao ca: ${handoffNote.trim()}`);
    }

    const isAttentionRequired = attentionReasons.length > 0;

    // 3. Assemble Final Record
    const finalRecord: BookingStayRecord = {
      ...localRecord,
      roomAllocations: updatedAllocations,
      overallCheckInStatus,
      attentionRequired: isAttentionRequired,
      attentionReasons,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: nowStr,
          staffName: currentStaff,
          action: isAttentionRequired ? 'CHECK_IN_WITH_ATTENTION' : 'CHECK_IN_COMPLETED',
          details: `Check-in ${selectedRoomsToCheckIn.map(r => `P.${r}`).join(', ')}. Khai báo: ${stats.verifiedDeclarationCount}/${stats.totalGuests} khách. ${isAttentionRequired ? 'Đã tạo cảnh báo ca trực.' : 'Hồ sơ đầy đủ.'}`,
        },
        ...localRecord.auditLogs,
      ],
    };

    // 4. Save and Synchronize
    onSaveStayRecord(finalRecord, selectedRoomsToCheckIn.join(','));
    onClose();

    if (isAttentionRequired) {
      showToast(`Đã nhận phòng ${selectedRoomsToCheckIn.map(r => `P.${r}`).join(', ')}! Lưu ý: Đã tạo cảnh báo Cần Xử Lý do khai báo chưa đủ 100%.`);
    } else {
      showToast(`Đã hoàn tất toàn bộ quy trình Check-in và Khai báo cho phòng ${selectedRoomsToCheckIn.map(r => `P.${r}`).join(', ')}!`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#E5DECE] overflow-hidden my-6 max-h-[94vh] flex flex-col animate-scale-up">
        
        {/* =================================================================== */}
        {/* HEADER & 3-STEP PROGRESS BAR */}
        {/* =================================================================== */}
        <div className="bg-[#0E2A47] text-white p-5 shrink-0 border-b border-[#163A5F]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8A261] to-[#9E7A3B] flex items-center justify-center text-[#0E2A47] font-bold shadow-md">
                <UserCheck className="w-6 h-6 text-[#0E2A47]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-lg font-bold text-white">
                    Quy Trình Nhận Phòng (Check-in 3 Bước)
                  </h3>
                  <span className="font-mono text-xs bg-[#C8A261] text-[#0E2A47] px-2 py-0.5 rounded-md font-bold">
                    {localRecord.bookingCode}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/40 text-[10px] font-bold">
                    DEMO MODE
                  </span>
                  {localRecord.isGroupBooking && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[10px] font-bold">
                      Đoàn: {localRecord.groupName || 'Nhiều phòng'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Khách đại diện: <strong>{localRecord.customerName}</strong> • {localRecord.checkInDate} ➜ {localRecord.checkOutDate} • Phân bổ: {localRecord.roomAllocations.map(r => `P.${r.roomNumber}`).join(', ')} • <em>(Mô phỏng dữ liệu DEMO - Chưa có tài khoản cơ sở thật)</em>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3 Steps Stepper */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            {[
              { num: 1, title: 'Bước 1: Tiếp nhận & Đối chiếu', desc: 'Kiểm tra giấy tờ trực tiếp' },
              { num: 2, title: 'Bước 2: Thông báo lưu trú', desc: 'tbltkbtt.bocongan.gov.vn' },
              { num: 3, title: 'Bước 3: Xác nhận nhận phòng', desc: 'Bàn giao chìa & Lưu vết' },
            ].map(step => {
              const isCurrent = currentStep === step.num;
              const isPast = currentStep > step.num;

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num as any)}
                  className={`p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 ${
                    isCurrent 
                      ? 'bg-white text-[#0E2A47] font-bold shadow-md' 
                      : isPast
                      ? 'bg-[#163A5F] text-[#C8A261] hover:bg-[#1C4773]'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    isCurrent 
                      ? 'bg-[#0E2A47] text-[#C8A261]' 
                      : isPast
                      ? 'bg-[#C8A261] text-[#0E2A47]'
                      : 'bg-white/20 text-white'
                  }`}>
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </span>
                  <div className="truncate">
                    <span className="block truncate text-xs">{step.title}</span>
                    <span className="block text-[10px] font-normal truncate opacity-80">{step.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* STEP 1: TIẾP NHẬN & ĐỐI CHIẾU KHÁCH TRỰC TIẾP */}
        {/* =================================================================== */}
        {currentStep === 1 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Privacy Compliance Banner */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
              <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <strong>Chính sách bảo mật dữ liệu lưu trú (Nghị định 13/2023/NĐ-CP):</strong> Nhân viên lễ tân đối chiếu trực tiếp thẻ CCCD gắn chip hoặc hộ chiếu gốc của khách tại quầy. 
                <span className="font-bold text-blue-950"> TUYỆT ĐỐI KHÔNG CHỤP ẢNH CCCD/HỘ CHIẾU, KHÔNG LƯU BẢN SAO HOẶC SỐ ĐỊNH DANH VÀO HỆ THỐNG ĐÁM MÂY.</span>
              </div>
            </div>

            {/* Guest Count Comparison & Surcharge Alert */}
            <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#0E2A47]" />
                <div>
                  <span className="font-bold text-[#0E2A47] block text-sm">
                    Khách Dự Kiến: {localRecord.totalExpectedGuests} khách • Thực Tế Tại Quầy: {localRecord.totalActualGuests} khách
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Đối chiếu thực tế: {stats.documentCheckedCount}/{stats.totalGuests} khách đã xuất trình giấy tờ gốc
                  </span>
                </div>
              </div>

              {stats.isMismatch && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Phát sinh +{stats.extraGuestsCount} khách (Phụ thu: {(stats.extraGuestsCount * 150000).toLocaleString('vi-VN')} đ/đêm)
                  </span>
                </div>
              )}
            </div>

            {/* Guest List Grouped by Room */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-sm text-[#0E2A47] uppercase tracking-wider">
                  Danh Sách Khách Lưu Trú Theo Từng Phòng
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingGuest(true)}
                  className="px-3 py-1.5 bg-[#0E2A47] hover:bg-[#163A5F] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Thêm Khách Phát Sinh</span>
                </button>
              </div>

              {localRecord.roomAllocations.map(alloc => {
                const roomGuests = localRecord.guests.filter(g => g.assignedRoomNumber === alloc.roomNumber);

                return (
                  <div key={alloc.roomNumber} className="border border-[#E5DECE] rounded-2xl p-4 bg-white shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5DECE]">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-base text-[#0E2A47]">
                          Phòng {alloc.roomNumber}
                        </span>
                        <span className="text-xs text-[#8C7E6C]">
                          ({alloc.roomTypeName})
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        alloc.isCheckedIn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {alloc.isCheckedIn ? 'Đã nhận phòng này' : 'Chờ nhận phòng'}
                      </span>
                    </div>

                    {/* Guests in this room */}
                    <div className="space-y-2.5">
                      {roomGuests.map((guest, idx) => (
                        <div 
                          key={guest.id}
                          className="p-3 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-[#0E2A47] text-[#C8A261] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#0E2A47]">{guest.fullName}</span>
                                {guest.isPrimaryContact && (
                                  <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                                    Đại diện đặt
                                  </span>
                                )}
                                <span className={`px-2 py-0.2 rounded-md text-[10px] font-semibold ${
                                  guest.nationality === 'VN' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-purple-50 text-purple-800 border border-purple-200'
                                }`}>
                                  {guest.nationality === 'VN' ? '🇻🇳 Việt Nam' : `🌐 ${guest.nationalityName || 'Quốc tế'}`}
                                </span>
                              </div>
                              <p className="text-slate-500 text-[11px] mt-0.5">
                                Năm sinh: {guest.birthYear || '—'} ({guest.gender === 'male' ? 'Nam' : guest.gender === 'female' ? 'Nữ' : 'Khác'})
                                {guest.checkedAt && ` • Đối chiếu: ${guest.checkedAt} (${guest.checkedByStaff})`}
                              </p>
                              {guest.documentNotes && (
                                <p className="text-[11px] text-slate-600 italic">{guest.documentNotes}</p>
                              )}
                            </div>
                          </div>

                          {/* Physical Verification Controls */}
                          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                            {guest.isDocumentChecked && (
                              <select
                                value={guest.documentTypeVerified || 'cccd'}
                                onChange={(e) => handleUpdateGuestDocType(guest.id, e.target.value as DocumentCheckType)}
                                className="p-1.5 bg-white border border-[#D5CBBF] rounded-lg text-xs font-medium"
                              >
                                <option value="cccd">CCCD gắn chip</option>
                                <option value="passport">Hộ chiếu (Passport)</option>
                                <option value="birth_certificate">Giấy khai sinh (Trẻ em)</option>
                                <option value="other">Giấy tờ khác</option>
                              </select>
                            )}

                            <button
                              type="button"
                              onClick={() => handleToggleGuestDocument(guest.id)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                guest.isDocumentChecked
                                  ? 'bg-emerald-700 text-white shadow-xs'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:border-[#0E2A47]'
                              }`}
                            >
                              {guest.isDocumentChecked ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Đã Đối Chiếu Gốc</span>
                                </>
                              ) : (
                                <>
                                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Chưa Đối Chiếu</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: THÔNG BÁO LƯU TRÚ / KHAI BÁO TẠM TRÚ */}
        {/* =================================================================== */}
        {currentStep === 2 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Official Government Portals Links & Manual Workflow Guide */}
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <Globe className="w-5 h-5 text-amber-700 shrink-0" />
                  <span>Cổng Dịch Vụ Công Bộ Công An Chính Thức (tbltkbtt.bocongan.gov.vn)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold bg-amber-200/60 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                    DEMO MODE (MÔ PHỎNG NỘI BỘ)
                  </span>
                  <span className="text-[10px] font-bold bg-white text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-300">
                    Không Tuyên Bố API Tự Động
                  </span>
                </div>
              </div>

              {/* Rõ ràng minh bạch: Chưa có tài khoản cơ sở thật */}
              <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1.5 leading-relaxed">
                <p>
                  <strong>Nguyên tắc vận hành:</strong> Seagull Admin <strong>KHÔNG</strong> kết nối API trực tiếp với Bộ Công an. Hiện tại cơ sở <em>chưa có tài khoản định danh cơ sở lưu trú chính thức</em> trên hệ thống TBLT KBTT. Tất cả thao tác trong bản thử nghiệm này chạy trên <strong>môi trường DEMO</strong> để nhân viên chuẩn bị quy trình nghiệp vụ và lưu vết ca trực.
                </p>
                <p className="text-[11px] text-slate-600">
                  🛡️ <strong>Chính sách an toàn dữ liệu:</strong> Tuyệt đối không lưu mật khẩu TBLT KBTT, không lưu ảnh CCCD/hộ chiếu hay số định danh cá nhân trên hệ thống Seagull.
                </p>
              </div>

              {/* Hướng dẫn luồng 3 bước thao tác cho nhân viên */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-1 shadow-2xs">
                  <div className="font-bold text-[#0E2A47] flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#0E2A47] text-[#C8A261] flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Mở tab Cổng DVC</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Bấm nút bên dưới để mở trang chính thức <strong>tbltkbtt.bocongan.gov.vn</strong> trong tab mới.
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-1 shadow-2xs">
                  <div className="font-bold text-[#0E2A47] flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#0E2A47] text-[#C8A261] flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Khai báo ngoài tab</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Đăng nhập tài khoản cơ sở lưu trú (khi được cấp), gửi hồ sơ và xem biên nhận/kết quả phê duyệt.
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-1 shadow-2xs">
                  <div className="font-bold text-[#0E2A47] flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#0E2A47] text-[#C8A261] flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Ghi nhận thủ công</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Quay lại Seagull cập nhật 1 trong 5 trạng thái, chọn căn cứ đối chiếu và lưu vết audit log ca trực.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/60">
                <a
                  href="https://tbltkbtt.bocongan.gov.vn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#0E2A47] hover:bg-[#163A5F] text-[#C8A261] font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở Cổng Quản Lý Lưu Trú (tbltkbtt.bocongan.gov.vn)</span>
                </a>

                {localRecord.guests.some(g => g.nationality === 'FOREIGN') && (
                  <a
                    href="https://evisa.xuatnhapcanh.gov.vn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-purple-900 hover:bg-purple-950 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Cổng Khai Báo Người Nước Ngoài (evisa.xuatnhapcanh.gov.vn)</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleMarkAllInProgress}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  Đánh dấu tất cả: Đang xử lý
                </button>

                <button
                  type="button"
                  onClick={handleReportNetworkOutage}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1 ml-auto"
                  title="Ghi nhận sự cố mất mạng hoặc cổng DVC bảo trì"
                >
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Báo Cáo Mất Mạng / DVC Bảo Trì</span>
                </button>
              </div>
            </div>

            {/* Declaration Progress Bar & Group Summary */}
            <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#0E2A47]">
                  Tiến Độ Khai Báo: {stats.verifiedDeclarationCount}/{stats.totalGuests} khách đã xác nhận hoàn tất
                </span>
                <span className="font-bold text-emerald-700 font-mono">
                  {stats.declarationPercentage}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    stats.declarationPercentage === 100 ? 'bg-emerald-600' : 'bg-[#C8A261]'
                  }`}
                  style={{ width: `${stats.declarationPercentage}%` }}
                />
              </div>
              {stats.declarationPercentage < 100 ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  <strong>Lưu ý nghiệp vụ khách đoàn:</strong> Mới có <strong>{stats.verifiedDeclarationCount}/{stats.totalGuests} khách</strong> được xác nhận hoàn tất. Còn <strong>{stats.totalGuests - stats.verifiedDeclarationCount} khách</strong> chưa hoàn tất. Tổng trạng thái đoàn là <strong>Chờ đối chiếu kết quả (Awaiting Verification)</strong>. Hệ thống <em>tuyệt đối không đánh dấu toàn đoàn hoàn tất</em> khi còn khách chưa xong. Nếu nhấn Nhận phòng, hồ sơ đoàn sẽ tự động ghim vào mục <strong>Cần Xử Lý</strong> để bàn giao ca sau.
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Toàn bộ {stats.totalGuests} khách trong đoàn đã được đối chiếu và xác nhận hoàn tất đầy đủ.</span>
                </div>
              )}
            </div>

            {/* Per-guest Declaration Status Form */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-sm text-[#0E2A47] uppercase tracking-wider">
                  Ghi Nhận Kết Quả Từng Khách (Thủ Công)
                </h4>
                <span className="text-[11px] text-slate-500">
                  Xác nhận bởi: <strong>{currentStaff}</strong> ({userRole === 'owner' ? 'Chủ cơ sở' : 'Lễ tân ca trực'})
                </span>
              </div>

              <div className="space-y-3">
                {localRecord.guests.map(guest => (
                  <div 
                    key={guest.id}
                    className="p-4 border border-[#E5DECE] rounded-2xl bg-white shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#0E2A47]">{guest.fullName}</span>
                          <span className="text-xs text-slate-500 font-mono">P.{guest.assignedRoomNumber}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {guest.nationality === 'VN' ? 'Khách Việt Nam' : `Quốc tế (${guest.nationalityName})`}
                          </span>
                        </div>
                      </div>

                      {/* Status Selector */}
                      <div className="flex items-center gap-2">
                        <select
                          value={guest.declarationStatus}
                          onChange={(e) => handleUpdateGuestDeclaration(guest.id, e.target.value as DeclarationStatus)}
                          className={`p-2 rounded-xl text-xs font-bold border ${
                            guest.declarationStatus === 'verified_completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : guest.declarationStatus === 'in_progress'
                              ? 'bg-sky-50 text-sky-800 border-sky-300'
                              : guest.declarationStatus === 'awaiting_verification'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : guest.declarationStatus === 'needs_revision'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="unprocessed">Chưa thực hiện</option>
                          <option value="in_progress">Đang xử lý (Đã nộp hồ sơ ngoài tab)</option>
                          <option value="awaiting_verification">Chờ đối chiếu kết quả</option>
                          <option value="verified_completed">✔ Đã xác nhận hoàn tất</option>
                          <option value="needs_revision">⚠ Cần xử lý lại</option>
                        </select>
                      </div>
                    </div>

                    {/* Verified Metadata Box */}
                    {guest.declarationStatus === 'verified_completed' && (
                      <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
                        <span className="flex items-center gap-1 text-emerald-800 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đã xác nhận hoàn tất</span>
                        </span>
                        <span>Thời điểm: <strong>{guest.declarationVerifiedAt || 'Hôm nay'}</strong></span>
                        <span>Người xác nhận: <strong>{guest.declarationVerifiedBy || currentStaff}</strong></span>
                        <span>Căn cứ: <strong>{guest.verificationBasis || 'Biên nhận điện tử trên Cổng TBLT KBTT'}</strong></span>
                        {guest.declarationReferenceCode ? (
                          <span>Mã biên nhận: <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-mono text-[10px] text-emerald-950 font-bold">{guest.declarationReferenceCode}</code></span>
                        ) : (
                          <span className="text-slate-500 italic">(Không có mã biên nhận)</span>
                        )}
                      </div>
                    )}

                    {/* Reference Code, Verification Basis & Notes Input */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E5DECE]">
                      {/* Verification Basis */}
                      <div>
                        <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">
                          Căn Cứ Đối Chiếu Kết Quả
                        </label>
                        <select
                          value={guest.verificationBasis || 'Biên nhận điện tử trên Cổng TBLT KBTT'}
                          onChange={(e) => handleUpdateGuestDeclaration(guest.id, guest.declarationStatus, undefined, undefined, e.target.value)}
                          className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg text-xs"
                        >
                          <option value="Biên nhận điện tử trên Cổng TBLT KBTT">Biên nhận điện tử Cổng TBLT KBTT (Khuyên dùng)</option>
                          <option value="Xác nhận trực tiếp từ Công an xã / huyện Lý Sơn">Xác nhận trực tiếp từ Công an xã / huyện Lý Sơn</option>
                          <option value="Tin nhắn SMS / Email thông báo thành công">Tin nhắn SMS / Email thông báo thành công</option>
                          <option value="Giấy biên nhận / Sổ lưu trú viết tay">Giấy biên nhận / Sổ lưu trú viết tay tại quầy</option>
                          <option value="Khác / Ghi nhận chuyển giao ca trực">Khác / Ghi nhận chuyển giao ca trực</option>
                        </select>
                      </div>

                      {/* Reference code (Optional) */}
                      <div>
                        <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">
                          Mã Biên Nhận Cổng DVC <span className="font-normal text-slate-500">(Tùy chọn)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Chỉ nhập nếu Cổng chính thức có cấp mã..."
                          value={guest.declarationReferenceCode || ''}
                          onChange={(e) => handleUpdateGuestDeclaration(guest.id, guest.declarationStatus, e.target.value)}
                          className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg text-xs font-mono"
                        />
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          * Không tự tạo mã giả dạng chính thức
                        </span>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-[11px] font-bold text-[#0E2A47] block mb-1">
                          Ghi Chú Kết Quả Đối Soát & Bàn Giao Ca
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Đã đối chiếu kết quả duyệt lúc 13h..."
                          value={guest.declarationNotes || ''}
                          onChange={(e) => handleUpdateGuestDeclaration(guest.id, guest.declarationStatus, undefined, e.target.value)}
                          className="w-full p-2 bg-[#FAF8F5] border border-[#D5CBBF] rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3: XÁC NHẬN NHẬN PHÒNG & TÁCH BIỆT TRẠNG THÁI */}
        {/* =================================================================== */}
        {currentStep === 3 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Decoupling principle explanation */}
            <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-2xl space-y-2">
              <h4 className="font-serif font-bold text-sm text-[#0E2A47] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#C8A261]" />
                <span>Nguyên Tắc Tách Biệt Nghiệp Vụ Check-in & Khai Báo Lưu Trú</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Trạng thái <strong>Đã Check-in (Đang ở)</strong> biểu thị khách đã nhận phòng vật lý tại homestay. Trạng thái <strong>Đã Khai Báo Hoàn Tất</strong> biểu thị hồ sơ lưu trú đã được đối chiếu thành công với cơ quan chức năng. Hai trạng thái này hoàn toàn độc lập.
              </p>
            </div>

            {/* Room selection for group booking check-in */}
            <div className="p-4 border border-[#E5DECE] rounded-2xl bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#0E2A47] uppercase">
                  Chọn Các Phòng Cần Làm Thủ Tục Nhận Hôm Nay:
                </span>
                <span className="text-[11px] text-slate-500">
                  {selectedRoomsToCheckIn.length}/{localRecord.roomAllocations.length} phòng được chọn
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {localRecord.roomAllocations.map(alloc => {
                  const isChecked = selectedRoomsToCheckIn.includes(alloc.roomNumber);

                  return (
                    <label 
                      key={alloc.roomNumber}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isChecked 
                          ? 'bg-blue-50/70 border-blue-400 text-blue-900 shadow-xs' 
                          : 'bg-[#FAF8F5] border-[#E5DECE] text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoomsToCheckIn([...selectedRoomsToCheckIn, alloc.roomNumber]);
                            } else {
                              setSelectedRoomsToCheckIn(selectedRoomsToCheckIn.filter(r => r !== alloc.roomNumber));
                            }
                          }}
                          className="w-4 h-4 text-[#0E2A47] rounded"
                        />
                        <div>
                          <span className="font-bold text-xs block">Phòng {alloc.roomNumber}</span>
                          <span className="text-[10px] text-slate-500">{alloc.roomTypeName}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold">
                        {alloc.isCheckedIn ? 'Đã nhận trước' : 'Nhận bây giờ'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Summary Review Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-[#E5DECE] rounded-2xl space-y-2">
                <span className="text-xs font-bold text-[#0E2A47] block">1. Đối Chiếu Giấy Tờ Tùy Thân:</span>
                <div className="text-xl font-bold text-[#0E2A47]">
                  {stats.documentCheckedCount} / {stats.totalGuests} <span className="text-xs font-normal text-slate-500">khách</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {stats.allDocumentsChecked ? '✔ 100% khách đã đối chiếu bản gốc tại quầy' : `⚠ Còn ${stats.totalGuests - stats.documentCheckedCount} khách chưa đối chiếu giấy tờ`}
                </p>
              </div>

              <div className="p-4 bg-white border border-[#E5DECE] rounded-2xl space-y-2">
                <span className="text-xs font-bold text-[#0E2A47] block">2. Tình Trạng Khai Báo Bộ Công An:</span>
                <div className={`text-xl font-bold ${stats.allDeclarationsVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {stats.verifiedDeclarationCount} / {stats.totalGuests} <span className="text-xs font-normal text-slate-500">khách ({stats.declarationPercentage}%)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {stats.allDeclarationsVerified ? '✔ Toàn bộ khách đã xác nhận hoàn tất' : `Chờ xử lý: ${stats.totalGuests - stats.verifiedDeclarationCount} khách chưa có biên nhận`}
                </p>
              </div>
            </div>

            {/* Attention Warning Alert if Incomplete */}
            {!stats.allDeclarationsVerified && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900">
                <div className="flex items-center gap-2 font-bold text-rose-950 text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Cảnh Báo Ca Trực: Hồ Sơ Khai Báo Chưa Đầy Đủ</span>
                </div>
                <p className="leading-relaxed">
                  Đoàn có <strong>{stats.totalGuests} khách</strong> nhưng mới hoàn tất <strong>{stats.verifiedDeclarationCount}/{stats.totalGuests} người</strong>. Hệ thống sẽ:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 font-medium">
                  <li>Tự động đánh dấu cờ <strong>Cần Xử Lý (Attention Required)</strong>.</li>
                  <li>Hiển thị nổi bật trên tab "Cần xử lý" và Dashboard tổng quan.</li>
                  <li><strong>Tuyệt đối không xóa cảnh báo</strong> cho đến khi ca trực sau hoàn tất đối chiếu cho toàn bộ khách còn lại.</li>
                </ul>

                <div className="pt-2">
                  <label className="text-[11px] font-bold text-rose-950 block mb-1">
                    Ghi Chú Bàn Giao Ca Trực Tiếp Theo:
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Chờ khách bổ sung CCCD chuyến bay tối, ca sau đối chiếu trước 20h..."
                    value={handoffNote}
                    onChange={(e) => setHandoffNote(e.target.value)}
                    className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs text-[#0E2A47]"
                  />
                </div>
              </div>
            )}

            {/* Final Key Handover Confirmation */}
            <div className="p-4 bg-[#FAF8F5] border border-[#E5DECE] rounded-2xl flex items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-[#0E2A47]">
                <input
                  type="checkbox"
                  checked={isKeyDelivered}
                  onChange={(e) => setIsKeyDelivered(e.target.checked)}
                  className="w-4 h-4 text-[#0E2A47] rounded"
                />
                <span>Xác nhận đã bàn giao chìa khóa và đón tiếp khách vào phòng an toàn</span>
              </label>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL FOOTER CONTROLS */}
        {/* =================================================================== */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#E5DECE] shrink-0 flex items-center justify-between gap-3">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep - 1) as any)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-[#D5CBBF] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Bước {currentStep - 1}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-black text-xs font-semibold"
            >
              Hủy Bỏ
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep + 1) as any)}
                className="px-5 py-2.5 bg-[#0E2A47] hover:bg-[#163A5F] text-[#FAF8F5] font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
              >
                <span>Tiếp tục sang Bước {currentStep + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalCheckInComplete}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
              >
                <Check className="w-4 h-4" />
                <span>XÁC NHẬN HOÀN TẤT NHẬN PHÒNG</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-MODAL: THÊM KHÁCH PHÁT SINH */}
      {/* =================================================================== */}
      {isAddingGuest && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5DECE] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DECE]">
              <h4 className="font-serif font-bold text-base text-[#0E2A47]">
                Thêm Khách Phát Sinh Vào Phòng
              </h4>
              <button onClick={() => setIsAddingGuest(false)} className="text-slate-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExtraGuest} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#0E2A47] block mb-1">Họ Và Tên Khách *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Quốc Hưng"
                  value={newGuestForm.fullName}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, fullName: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Năm Sinh</label>
                  <input
                    type="number"
                    value={newGuestForm.birthYear}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, birthYear: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Giới Tính</label>
                  <select
                    value={newGuestForm.gender}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, gender: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Quốc Tịch</label>
                  <select
                    value={newGuestForm.nationality}
                    onChange={(e) => setNewGuestForm({ 
                      ...newGuestForm, 
                      nationality: e.target.value as any,
                      nationalityName: e.target.value === 'VN' ? 'Việt Nam' : 'Quốc tế'
                    })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl"
                  >
                    <option value="VN">Việt Nam</option>
                    <option value="FOREIGN">Nước ngoài (Quốc tế)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#0E2A47] block mb-1">Xếp Vào Phòng</label>
                  <select
                    value={newGuestForm.assignedRoomNumber}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, assignedRoomNumber: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#D5CBBF] rounded-xl font-bold text-[#0E2A47]"
                  >
                    {localRecord.roomAllocations.map(r => (
                      <option key={r.roomNumber} value={r.roomNumber}>Phòng {r.roomNumber}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                Lưu ý: Khách phát sinh sẽ được đưa vào danh sách đối chiếu giấy tờ và khai báo lưu trú theo quy định.
              </div>

              <div className="pt-3 border-t border-[#E5DECE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGuest(false)}
                  className="px-4 py-2 text-slate-600 hover:text-black font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0E2A47] text-white font-bold rounded-xl"
                >
                  Thêm Khách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
