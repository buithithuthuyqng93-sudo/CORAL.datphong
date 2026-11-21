import React, { useState, useMemo } from 'react';
import { 
  Booking, Room, BookingStayRecord, StayGuest, RoomTransferHistory, 
  DeclarationStatus, DocumentCheckType, PropertyConfig 
} from '../types';
import { 
  UserCheck, Users, AlertTriangle, CheckCircle2, Clock, 
  Search, Filter, Calendar, MapPin, Phone, ShieldCheck, 
  ArrowRightLeft, Plus, Check, X, FileText, Globe, 
  AlertCircle, ChevronRight, LogIn, LogOut as LogOutIcon, 
  Eye, Lock, Sparkles, RefreshCw, Info
} from 'lucide-react';

interface CheckInStayManagerProps {
  rooms: Room[];
  bookings: Booking[];
  stayRecords: BookingStayRecord[];
  onUpdateStayRecords: (newRecords: BookingStayRecord[]) => void;
  onUpdateRooms: (newRooms: Room[]) => void;
  onOpenCheckInModal?: (record: BookingStayRecord, roomNumber?: string) => void;
  userRole: 'owner' | 'reception' | 'accountant';
  currentStaff: string;
  propertyConfig: PropertyConfig;
  maskPhone: (phone?: string) => string;
}

export const CheckInStayManager: React.FC<CheckInStayManagerProps> = ({
  rooms,
  bookings,
  stayRecords,
  onUpdateStayRecords,
  onUpdateRooms,
  onOpenCheckInModal,
  userRole,
  currentStaff,
  propertyConfig,
  maskPhone,
}) => {
  // 3 Sub-tabs: 'arrivals' (Khách đến), 'in_house' (Đang lưu trú), 'attention' (Cần xử lý)
  const [subTab, setSubTab] = useState<'arrivals' | 'in_house' | 'attention'>('arrivals');
  
  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [declarationFilter, setDeclarationFilter] = useState<string>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Modal active sub-view: 'rooms_checkin' | 'guests_list' | 'declaration_form' | 'transfer_history'
  const [modalTab, setModalTab] = useState<'rooms_checkin' | 'guests_list' | 'declaration_form' | 'transfer_history'>('rooms_checkin');

  // Transfer Room modal inside details
  const [transferModalGuest, setTransferModalGuest] = useState<StayGuest | null>(null);
  const [targetRoomNumber, setTargetRoomNumber] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Add extra guest modal
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [newGuestForm, setNewGuestForm] = useState({
    fullName: '',
    birthYear: 1995,
    gender: 'male' as 'male' | 'female' | 'other',
    nationality: 'VN' as 'VN' | 'FOREIGN',
    nationalityName: 'Việt Nam',
    assignedRoomNumber: '',
  });

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Selected record object
  const activeRecord = useMemo(() => {
    return stayRecords.find(r => r.bookingId === selectedRecordId) || null;
  }, [stayRecords, selectedRecordId]);

  // Declaration Status Metadata Helper
  const getDeclarationMeta = (status: DeclarationStatus) => {
    switch (status) {
      case 'unprocessed':
        return { label: 'Chưa thực hiện', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
      case 'in_progress':
        return { label: 'Đang xử lý', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300' };
      case 'awaiting_verification':
        return { label: 'Chờ đối chiếu', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' };
      case 'verified_completed':
        return { label: 'Đã xác nhận hoàn tất', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' };
      case 'needs_revision':
        return { label: 'Cần xử lý lại', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300' };
      default:
        return { label: status, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
    }
  };

  // Check-in Status Metadata Helper
  const getCheckInMeta = (status: BookingStayRecord['overallCheckInStatus']) => {
    switch (status) {
      case 'not_checked_in':
        return { label: 'Chờ nhận phòng', bg: 'bg-slate-100', text: 'text-slate-700' };
      case 'partially_checked_in':
        return { label: 'Nhận một phần', bg: 'bg-amber-50', text: 'text-amber-800' };
      case 'fully_checked_in':
        return { label: 'Đã nhận phòng', bg: 'bg-emerald-50', text: 'text-emerald-800' };
      case 'checked_out':
        return { label: 'Đã trả phòng', bg: 'bg-blue-50', text: 'text-blue-800' };
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const arrivalsToday = stayRecords.filter(r => r.checkInDate === '2026-08-01');
    const inHouse = stayRecords.filter(r => r.overallCheckInStatus === 'fully_checked_in' || r.overallCheckInStatus === 'partially_checked_in');
    const attention = stayRecords.filter(r => r.attentionRequired);
    return {
      arrivalsCount: arrivalsToday.length,
      inHouseCount: inHouse.length,
      attentionCount: attention.length,
    };
  }, [stayRecords]);

  // Filtered Records List
  const filteredRecords = useMemo(() => {
    return stayRecords.filter(record => {
      // 1. Tab Filter
      if (subTab === 'arrivals') {
        if (dateFilter === 'today' && record.checkInDate !== '2026-08-01') return false;
      } else if (subTab === 'in_house') {
        if (record.overallCheckInStatus !== 'fully_checked_in' && record.overallCheckInStatus !== 'partially_checked_in') {
          return false;
        }
      } else if (subTab === 'attention') {
        if (!record.attentionRequired) return false;
      }

      // 2. Declaration Status Filter
      if (declarationFilter !== 'all' && record.overallDeclarationStatus !== declarationFilter) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = record.bookingCode.toLowerCase().includes(q);
        const matchName = record.customerName.toLowerCase().includes(q);
        const matchPhone = record.customerPhone.includes(q);
        const matchRooms = record.roomAllocations.some(r => r.roomNumber.toLowerCase().includes(q));
        const matchGroup = record.groupName?.toLowerCase().includes(q) || false;
        if (!matchCode && !matchName && !matchPhone && !matchRooms && !matchGroup) {
          return false;
        }
      }

      return true;
    });
  }, [stayRecords, subTab, dateFilter, declarationFilter, searchQuery]);

  // --------------------------------------------------------------------------
  // ACTIONS: CHECK-IN SINGLE ROOM
  // --------------------------------------------------------------------------
  const handleCheckInRoom = (recordId: string, roomNumber: string) => {
    const record = stayRecords.find(r => r.bookingId === recordId);
    if (!record) return;

    const updatedAllocations = record.roomAllocations.map(alloc => {
      if (alloc.roomNumber === roomNumber) {
        return {
          ...alloc,
          isCheckedIn: true,
          checkedInAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          checkedInBy: currentStaff,
        };
      }
      return alloc;
    });

    const allCheckedIn = updatedAllocations.every(a => a.isCheckedIn);
    const someCheckedIn = updatedAllocations.some(a => a.isCheckedIn);

    const overallStatus = allCheckedIn ? 'fully_checked_in' : (someCheckedIn ? 'partially_checked_in' : 'not_checked_in');

    const updatedRecord: BookingStayRecord = {
      ...record,
      roomAllocations: updatedAllocations,
      overallCheckInStatus: overallStatus,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          staffName: currentStaff,
          action: 'ROOM_CHECK_IN',
          details: `Check-in phòng ${roomNumber}`,
        },
        ...record.auditLogs,
      ],
    };

    onUpdateStayRecords(stayRecords.map(r => r.bookingId === recordId ? updatedRecord : r));

    // Update Room PMS status to in_house (booked_direct/confirmed)
    const updatedRooms = rooms.map(r => {
      if (r.number === roomNumber) {
        return { ...r, status: 'booked_direct' as const, housekeepingStatus: 'clean' as const };
      }
      return r;
    });
    onUpdateRooms(updatedRooms);

    showToast(`Đã nhận phòng ${roomNumber} thành công!`);
  };

  // --------------------------------------------------------------------------
  // ACTIONS: CHECK-OUT SINGLE ROOM
  // (Check-out synchronizes room to 'maintenance' or 'cleaning', NOT automatically 'clean')
  // --------------------------------------------------------------------------
  const handleCheckOutRoom = (recordId: string, roomNumber: string) => {
    const record = stayRecords.find(r => r.bookingId === recordId);
    if (!record) return;

    const updatedAllocations = record.roomAllocations.map(alloc => {
      if (alloc.roomNumber === roomNumber) {
        return {
          ...alloc,
          isCheckedOut: true,
          checkedOutAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          checkedOutBy: currentStaff,
        };
      }
      return alloc;
    });

    const allCheckedOut = updatedAllocations.every(a => a.isCheckedOut);

    const updatedRecord: BookingStayRecord = {
      ...record,
      roomAllocations: updatedAllocations,
      overallCheckInStatus: allCheckedOut ? 'checked_out' : record.overallCheckInStatus,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          staffName: currentStaff,
          action: 'ROOM_CHECK_OUT',
          details: `Check-out phòng ${roomNumber}. Đã chuyển buồng phòng sang trạng thái cần dọn dẹp.`,
        },
        ...record.auditLogs,
      ],
    };

    onUpdateStayRecords(stayRecords.map(r => r.bookingId === recordId ? updatedRecord : r));

    // IMPORTANT: Per Section VI constraints:
    // "Check-out phải đồng bộ với tình trạng phòng, nhưng không tự động đánh dấu phòng sạch và sẵn sàng bán."
    // We set housekeepingStatus to 'cleaning' / 'dirty', room remains available only after inspection!
    const updatedRooms = rooms.map(r => {
      if (r.number === roomNumber) {
        return { ...r, status: 'maintenance' as const, housekeepingStatus: 'cleaning' as const };
      }
      return r;
    });
    onUpdateRooms(updatedRooms);

    showToast(`Đã trả phòng ${roomNumber}. Trạng thái phòng chuyển sang [Cần dọn dẹp]!`);
  };

  // --------------------------------------------------------------------------
  // ACTIONS: VERIFY GUEST PHYSICAL DOCUMENT CHECK
  // (Privacy constraint: No CCCD photo upload, no personal ID number storage)
  // --------------------------------------------------------------------------
  const handleToggleGuestDocumentCheck = (recordId: string, guestId: string, docType: DocumentCheckType = 'cccd') => {
    const record = stayRecords.find(r => r.bookingId === recordId);
    if (!record) return;

    const updatedGuests = record.guests.map(g => {
      if (g.id === guestId) {
        const nextChecked = !g.isDocumentChecked;
        return {
          ...g,
          isDocumentChecked: nextChecked,
          documentTypeVerified: nextChecked ? docType : undefined,
          checkedByStaff: nextChecked ? currentStaff : undefined,
          checkedAt: nextChecked ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : undefined,
          documentNotes: nextChecked ? `Đã đối chiếu giấy tờ ${docType.toUpperCase()} gốc trực tiếp tại quầy` : undefined,
        };
      }
      return g;
    });

    const updatedRecord: BookingStayRecord = {
      ...record,
      guests: updatedGuests,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          staffName: currentStaff,
          action: 'DOCUMENT_VERIFIED',
          details: `Xác nhận kiểm tra giấy tờ tùy thân trực tiếp cho khách`,
        },
        ...record.auditLogs,
      ],
    };

    onUpdateStayRecords(stayRecords.map(r => r.bookingId === recordId ? updatedRecord : r));
    showToast('Đã cập nhật trạng thái kiểm tra giấy tờ trực tiếp!');
  };

  // --------------------------------------------------------------------------
  // ACTIONS: ROOM TRANSFER (CHUYỂN PHÒNG CHO KHÁCH TRONG ĐOÀN)
  // --------------------------------------------------------------------------
  const handleTransferGuestRoom = () => {
    if (!activeRecord || !transferModalGuest || !targetRoomNumber) return;

    const fromRoom = transferModalGuest.assignedRoomNumber;
    if (fromRoom === targetRoomNumber) {
      alert('Phòng chuyển đến phải khác phòng hiện tại!');
      return;
    }

    const newTransferLog: RoomTransferHistory = {
      id: `tr-${Date.now()}`,
      guestId: transferModalGuest.id,
      guestName: transferModalGuest.fullName,
      fromRoomNumber: fromRoom,
      toRoomNumber: targetRoomNumber,
      transferredAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
      transferredBy: currentStaff,
      reason: transferReason || 'Khách yêu cầu chuyển phòng trong đoàn',
    };

    const updatedGuests = activeRecord.guests.map(g => {
      if (g.id === transferModalGuest.id) {
        const targetRoomObj = rooms.find(r => r.number === targetRoomNumber);
        return {
          ...g,
          assignedRoomNumber: targetRoomNumber,
          assignedRoomId: targetRoomObj ? targetRoomObj.id : g.assignedRoomId,
        };
      }
      return g;
    });

    const updatedRecord: BookingStayRecord = {
      ...activeRecord,
      guests: updatedGuests,
      transferHistory: [newTransferLog, ...activeRecord.transferHistory],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          staffName: currentStaff,
          action: 'GUEST_ROOM_TRANSFER',
          details: `Chuyển khách ${transferModalGuest.fullName} từ P.${fromRoom} sang P.${targetRoomNumber}`,
        },
        ...activeRecord.auditLogs,
      ],
    };

    onUpdateStayRecords(stayRecords.map(r => r.bookingId === activeRecord.bookingId ? updatedRecord : r));
    setTransferModalGuest(null);
    setTargetRoomNumber('');
    setTransferReason('');
    showToast(`Đã chuyển khách sang phòng ${targetRoomNumber} thành công!`);
  };

  // --------------------------------------------------------------------------
  // ACTIONS: UPDATE DECLARATION STATUS (5 TRẠNG THÁI KIỂM SOÁT)
  // --------------------------------------------------------------------------
  const handleUpdateDeclarationStatus = (
    recordId: string, 
    newStatus: DeclarationStatus, 
    refCode?: string, 
    notes?: string
  ) => {
    const record = stayRecords.find(r => r.bookingId === recordId);
    if (!record) return;

    // Rule: Booking 12 khách mới xác nhận 10 khách không được hiển thị toàn bộ là hoàn tất!
    const totalGuests = record.guests.length;
    const checkedDocsCount = record.guests.filter(g => g.isDocumentChecked).length;

    if (newStatus === 'verified_completed' && checkedDocsCount < totalGuests) {
      alert(`CẢNH BÁO KIỂM SOÁT:\nĐơn này có ${totalGuests} khách nhưng chỉ mới có ${checkedDocsCount} khách được đối chiếu giấy tờ trực tiếp.\n\nTheo quy định nghiệp vụ, chỉ cho phép đánh dấu Hoàn Tất khi 100% khách đã được kiểm tra!`);
      return;
    }

    const updatedGuests = record.guests.map(g => {
      if (g.isDocumentChecked) {
        return {
          ...g,
          declarationStatus: newStatus,
          declarationReferenceCode: refCode || g.declarationReferenceCode,
          declarationVerifiedBy: currentStaff,
          declarationVerifiedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return g;
    });

    const updatedRecord: BookingStayRecord = {
      ...record,
      overallDeclarationStatus: newStatus,
      attentionRequired: newStatus === 'needs_revision' || (newStatus !== 'verified_completed' && record.attentionRequired),
      guests: updatedGuests,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          staffName: currentStaff,
          action: 'DECLARATION_STATUS_CHANGE',
          details: `Cập nhật trạng thái khai báo lưu trú sang [${getDeclarationMeta(newStatus).label}] (Mã tham chiếu: ${refCode || 'Không có'})`,
        },
        ...record.auditLogs,
      ],
    };

    onUpdateStayRecords(stayRecords.map(r => r.bookingId === recordId ? updatedRecord : r));
    showToast(`Đã lưu trạng thái khai báo tạm trú: ${getDeclarationMeta(newStatus).label}`);
  };

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#0E2A47] text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-[#C8A261]/50 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#C8A261]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 1. TOP SUB-TABS & KPI SUMMARY */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* 3 Main View Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DECE]">
            <button
              onClick={() => setSubTab('arrivals')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                subTab === 'arrivals' 
                  ? 'bg-[#0E2A47] text-[#C8A261] shadow-md shadow-[#0E2A47]/10' 
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>1. Khách Đến (Check-in)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                subTab === 'arrivals' ? 'bg-[#C8A261] text-[#0E2A47]' : 'bg-slate-200 text-slate-700'
              }`}>
                {kpis.arrivalsCount}
              </span>
            </button>

            <button
              onClick={() => setSubTab('in_house')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                subTab === 'in_house' 
                  ? 'bg-[#0E2A47] text-[#C8A261] shadow-md shadow-[#0E2A47]/10' 
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>2. Đang Lưu Trú (In-House)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                subTab === 'in_house' ? 'bg-[#C8A261] text-[#0E2A47]' : 'bg-slate-200 text-slate-700'
              }`}>
                {kpis.inHouseCount}
              </span>
            </button>

            <button
              onClick={() => setSubTab('attention')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                subTab === 'attention' 
                  ? 'bg-rose-700 text-white shadow-md' 
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>3. Cần Xử Lý Gấp</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-rose-800 shadow-xs">
                {kpis.attentionCount}
              </span>
            </button>
          </div>

          {/* Privacy & Compliance Assurance Badge */}
          <div className="flex items-center gap-2 text-[11px] text-[#8C7E6C] bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E5DECE]">
            <ShieldCheck className="w-4 h-4 text-[#C8A261]" />
            <span>Đối chiếu trực tiếp tại quầy • <strong>Không lưu trữ ảnh/số CCCD</strong></span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-4 pt-3 border-t border-[#E5DECE] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã booking (SGL-...), tên khách, số điện thoại, số phòng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#FAF8F5] border border-[#E5DECE] rounded-xl text-xs text-[#0E2A47] focus:outline-none focus:border-[#C8A261]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {subTab === 'arrivals' && (
              <div className="bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DECE] flex items-center text-xs">
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    dateFilter === 'today' ? 'bg-[#0E2A47] text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Hôm Nay
                </button>
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    dateFilter === 'all' ? 'bg-[#0E2A47] text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tất Cả Ngày
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#8C7E6C] font-semibold text-[11px]">Khai báo:</span>
              <select
                value={declarationFilter}
                onChange={(e) => setDeclarationFilter(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E5DECE] rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#0E2A47] focus:outline-none focus:border-[#C8A261]"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="unprocessed">Chưa thực hiện</option>
                <option value="in_progress">Đang xử lý</option>
                <option value="awaiting_verification">Chờ đối chiếu</option>
                <option value="verified_completed">Đã hoàn tất</option>
                <option value="needs_revision">Cần xử lý lại</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. MAIN TABLE / LIST OF BOOKING STAYS */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white border border-[#E5DECE] rounded-2xl shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Không tìm thấy hồ sơ lưu trú nào phù hợp bộ lọc</p>
            <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc trạng thái lọc</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E5DECE] text-[#8C7E6C] uppercase text-[10px] font-bold tracking-wider">
                  <th className="p-3.5">Mã Booking & Kênh</th>
                  <th className="p-3.5">Khách Đại Diện</th>
                  <th className="p-3.5">Phòng Phân Bổ</th>
                  <th className="p-3.5 text-center">Khách (Dự kiến / Thực tế)</th>
                  <th className="p-3.5">Ngày Nhận / Trả</th>
                  <th className="p-3.5 text-center">Trạng Thái Check-in</th>
                  <th className="p-3.5 text-center">Tiến Độ Khai Báo</th>
                  <th className="p-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DECE]">
                {filteredRecords.map(record => {
                  const checkInMeta = getCheckInMeta(record.overallCheckInStatus);
                  const declMeta = getDeclarationMeta(record.overallDeclarationStatus);
                  const isGuestCountMismatch = record.totalExpectedGuests !== record.totalActualGuests;
                  const verifiedGuestsCount = record.guests.filter(g => g.declarationStatus === 'verified_completed').length;
                  const totalGuestsCount = record.guests.length;

                  return (
                    <tr 
                      key={record.bookingId} 
                      className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                        record.attentionRequired ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Booking Code & Tags */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-sm text-[#0E2A47] block">
                            {record.bookingCode}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            {record.isGroupBooking && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                                Khách Đoàn ({record.roomAllocations.length} phòng)
                              </span>
                            )}
                            {record.attentionRequired && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>Cần xử lý</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Guest Info */}
                      <td className="p-3.5">
                        <div>
                          <strong className="text-[#0E2A47] font-semibold block text-sm">
                            {record.customerName}
                          </strong>
                          <span className="text-[#8C7E6C] font-mono flex items-center gap-1 mt-0.5">
                            <span>{maskPhone(record.customerPhone)}</span>
                            {userRole !== 'owner' && <Lock className="w-2.5 h-2.5 text-slate-400" title="Ẩn vì bảo mật" />}
                          </span>
                        </div>
                      </td>

                      {/* Room Allocations */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1">
                          {record.roomAllocations.map(alloc => (
                            <span 
                              key={alloc.roomNumber}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                                alloc.isCheckedIn 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              P.{alloc.roomNumber}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Guest Count (Expected vs Actual) */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E5DECE]">
                          <span className="font-bold text-[#0E2A47]">{record.totalExpectedGuests}</span>
                          <span className="text-slate-400">/</span>
                          <span className={`font-bold ${isGuestCountMismatch ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {record.totalActualGuests}
                          </span>
                          <span className="text-[10px] text-slate-500">khách</span>
                        </div>
                        {isGuestCountMismatch && (
                          <span className="block text-[10px] text-amber-700 font-medium mt-0.5">
                            Sai lệch +{record.totalActualGuests - record.totalExpectedGuests}
                          </span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="p-3.5 text-slate-700 font-mono">
                        <div>
                          <span className="font-semibold block">{record.checkInDate}</span>
                          <span className="text-[11px] text-slate-500">→ {record.checkOutDate}</span>
                        </div>
                      </td>

                      {/* Check-in Status */}
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${checkInMeta.bg} ${checkInMeta.text}`}>
                          {checkInMeta.label}
                        </span>
                      </td>

                      {/* Declaration Progress */}
                      <td className="p-3.5 text-center">
                        <div className="space-y-1">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${declMeta.bg} ${declMeta.text} ${declMeta.border} inline-block`}>
                            {declMeta.label}
                          </span>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {verifiedGuestsCount}/{totalGuestsCount} khách đã xác nhận
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {record.overallCheckInStatus !== 'fully_checked_in' && (
                            <button
                              onClick={() => {
                                if (onOpenCheckInModal) {
                                  onOpenCheckInModal(record);
                                } else {
                                  setSelectedRecordId(record.bookingId);
                                  setModalTab('rooms_checkin');
                                }
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Check-in 3 Bước</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedRecordId(record.bookingId);
                              setModalTab('rooms_checkin');
                            }}
                            className="bg-[#0E2A47] hover:bg-[#163A5F] text-[#FAF8F5] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#C8A261]" />
                            <span>Chi Tiết</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. MODAL: CHI TIẾT LƯU TRÚ & QUẢN LÝ KHÁCH ĐOÀN */}
      {/* ------------------------------------------------------------------- */}
      {activeRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#E5DECE] overflow-hidden my-6 max-h-[92vh] flex flex-col animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 bg-[#0E2A47] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C8A261] to-[#9E7A3B] flex items-center justify-center text-[#0E2A47] font-bold">
                  <UserCheck className="w-6 h-6 text-[#0E2A47]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-bold text-white">
                      Hồ Sơ Lưu Trú • {activeRecord.bookingCode}
                    </h3>
                    {activeRecord.isGroupBooking && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[10px] font-bold">
                        Đoàn: {activeRecord.groupName || 'Khách đoàn nhiều phòng'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    Khách đại diện: <strong>{activeRecord.customerName}</strong> • {activeRecord.checkInDate} đến {activeRecord.checkOutDate}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRecordId(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Navigation Sub-tabs */}
            <div className="bg-[#FAF8F5] border-b border-[#E5DECE] px-5 py-2 flex flex-wrap items-center gap-2 text-xs font-bold shrink-0">
              <button
                onClick={() => setModalTab('rooms_checkin')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  modalTab === 'rooms_checkin' 
                    ? 'bg-[#0E2A47] text-[#C8A261] shadow-xs' 
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>1. Danh Sách Phòng & Check-in ({activeRecord.roomAllocations.length})</span>
              </button>

              <button
                onClick={() => setModalTab('guests_list')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  modalTab === 'guests_list' 
                    ? 'bg-[#0E2A47] text-[#C8A261] shadow-xs' 
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>2. Danh Sách Khách & Đối Chiếu Giấy Tờ ({activeRecord.guests.length})</span>
              </button>

              <button
                onClick={() => setModalTab('declaration_form')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  modalTab === 'declaration_form' 
                    ? 'bg-[#0E2A47] text-[#C8A261] shadow-xs' 
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>3. Ghi Nhận Khai Báo Tạm Trú</span>
              </button>

              <button
                onClick={() => setModalTab('transfer_history')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  modalTab === 'transfer_history' 
                    ? 'bg-[#0E2A47] text-[#C8A261] shadow-xs' 
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>4. Lịch Sử Chuyển Phòng & Audit ({activeRecord.transferHistory.length})</span>
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Attention Alert Banner if required */}
              {activeRecord.attentionRequired && activeRecord.attentionReasons.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>LƯU Ý VẬN HÀNH CẦN XỬ LÝ CHO ĐƠN NÀY:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {activeRecord.attentionReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* TAB 1: DANH SÁCH PHÒNG & CHECK-IN / CHECK-OUT */}
              {/* ----------------------------------------------------------- */}
              {modalTab === 'rooms_checkin' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#0E2A47]">
                        Danh Sách Phòng Phân Bổ ({activeRecord.roomAllocations.length} phòng)
                      </h4>
                      <p className="text-xs text-[#8C7E6C]">
                        Check-in từng phòng theo tiến độ đến thực tế của khách trong đoàn.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeRecord.roomAllocations.map(alloc => (
                      <div 
                        key={alloc.roomNumber}
                        className="p-4 border border-[#E5DECE] rounded-2xl bg-[#FAF8F5] space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-serif text-lg font-bold text-[#0E2A47]">
                              Phòng {alloc.roomNumber}
                            </span>
                            <span className="text-xs text-slate-600 block">
                              {alloc.roomTypeName}
                            </span>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            alloc.isCheckedOut 
                              ? 'bg-blue-100 text-blue-800' 
                              : alloc.isCheckedIn 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-slate-200 text-slate-700'
                          }`}>
                            {alloc.isCheckedOut ? 'Đã Check-out' : alloc.isCheckedIn ? 'Đang Ở (Checked-in)' : 'Chờ Nhận Phòng'}
                          </span>
                        </div>

                        {/* Room stats */}
                        <div className="text-xs text-slate-600 space-y-1 bg-white p-2.5 rounded-xl border border-[#E5DECE]">
                          <div className="flex justify-between">
                            <span>Khách dự kiến:</span>
                            <strong>{alloc.expectedGuests} khách</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Khách thực tế đang gán:</span>
                            <strong className="text-emerald-700">
                              {activeRecord.guests.filter(g => g.assignedRoomNumber === alloc.roomNumber).length} khách
                            </strong>
                          </div>
                          {alloc.isCheckedIn && (
                            <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <span>Nhận phòng lúc:</span>
                              <span>{alloc.checkedInAt} ({alloc.checkedInBy})</span>
                            </div>
                          )}
                          {alloc.isCheckedOut && (
                            <div className="flex justify-between text-[11px] text-blue-600 pt-1 border-t border-slate-100">
                              <span>Trả phòng lúc:</span>
                              <span>{alloc.checkedOutAt} ({alloc.checkedOutBy})</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {!alloc.isCheckedIn && !alloc.isCheckedOut && (
                            <button
                              onClick={() => handleCheckInRoom(activeRecord.bookingId, alloc.roomNumber)}
                              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Nhận Phòng (Check-in)</span>
                            </button>
                          )}

                          {alloc.isCheckedIn && !alloc.isCheckedOut && (
                            <button
                              onClick={() => handleCheckOutRoom(activeRecord.bookingId, alloc.roomNumber)}
                              className="flex-1 bg-[#0E2A47] hover:bg-[#163A5F] text-[#FAF8F5] py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                            >
                              <LogOutIcon className="w-3.5 h-3.5 text-[#C8A261]" />
                              <span>Trả Phòng (Check-out)</span>
                            </button>
                          )}

                          {alloc.isCheckedOut && (
                            <div className="flex-1 text-center py-2 text-xs text-blue-800 bg-blue-50 rounded-xl font-medium border border-blue-200">
                              Đã trả phòng • Buồng phòng đang vệ sinh
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* TAB 2: DANH SÁCH KHÁCH & ĐỐI CHIẾU GIẤY TỜ TRỰC TIẾP */}
              {/* ----------------------------------------------------------- */}
              {modalTab === 'guests_list' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#0E2A47]">
                        Danh Sách Khách Lưu Trú ({activeRecord.guests.length} người)
                      </h4>
                      <p className="text-xs text-[#8C7E6C]">
                        Ghi nhận nhân viên đã đối chiếu giấy tờ tùy thân trực tiếp tại quầy. Không lưu số định danh / CCCD / hộ chiếu.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setNewGuestForm({
                          fullName: '',
                          birthYear: 1995,
                          gender: 'male',
                          nationality: 'VN',
                          nationalityName: 'Việt Nam',
                          assignedRoomNumber: activeRecord.roomAllocations[0]?.roomNumber || '101',
                        });
                        setIsAddingGuest(true);
                      }}
                      className="bg-[#0E2A47] hover:bg-[#163A5F] text-[#FAF8F5] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#C8A261]" />
                      <span>Thêm Khách Phát Sinh</span>
                    </button>
                  </div>

                  {/* Add Guest Form inside Tab */}
                  {isAddingGuest && (
                    <div className="p-4 bg-[#FAF8F5] border border-[#C8A261] rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-[#0E2A47]">Bổ sung khách phát sinh vào đoàn</span>
                        <button onClick={() => setIsAddingGuest(false)} className="text-slate-400 hover:text-black">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Họ và tên khách</label>
                          <input
                            type="text"
                            placeholder="Nguyễn Văn A"
                            value={newGuestForm.fullName}
                            onChange={(e) => setNewGuestForm({ ...newGuestForm, fullName: e.target.value })}
                            className="w-full p-2 bg-white border border-[#D5CBBF] rounded-xl text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Năm sinh</label>
                          <input
                            type="number"
                            value={newGuestForm.birthYear}
                            onChange={(e) => setNewGuestForm({ ...newGuestForm, birthYear: Number(e.target.value) })}
                            className="w-full p-2 bg-white border border-[#D5CBBF] rounded-xl text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Phòng xếp ở</label>
                          <select
                            value={newGuestForm.assignedRoomNumber}
                            onChange={(e) => setNewGuestForm({ ...newGuestForm, assignedRoomNumber: e.target.value })}
                            className="w-full p-2 bg-white border border-[#D5CBBF] rounded-xl text-xs font-bold"
                          >
                            {activeRecord.roomAllocations.map(a => (
                              <option key={a.roomNumber} value={a.roomNumber}>Phòng {a.roomNumber}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingGuest(false)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-600"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newGuestForm.fullName.trim()) {
                              alert('Vui lòng nhập họ tên khách!');
                              return;
                            }
                            const newGuest: StayGuest = {
                              id: `gst-ext-${Date.now()}`,
                              fullName: newGuestForm.fullName.trim(),
                              birthYear: newGuestForm.birthYear,
                              gender: newGuestForm.gender,
                              nationality: newGuestForm.nationality,
                              nationalityName: newGuestForm.nationalityName,
                              assignedRoomNumber: newGuestForm.assignedRoomNumber,
                              assignedRoomId: rooms.find(r => r.number === newGuestForm.assignedRoomNumber)?.id || 'rm-unknown',
                              isPrimaryContact: false,
                              isDocumentChecked: false,
                              declarationStatus: 'unprocessed',
                            };

                            const updatedRecord: BookingStayRecord = {
                              ...activeRecord,
                              totalActualGuests: activeRecord.guests.length + 1,
                              guests: [...activeRecord.guests, newGuest],
                              attentionRequired: true,
                              attentionReasons: [
                                `Phát sinh khách mới (${newGuest.fullName}) chưa kiểm tra giấy tờ`,
                                ...activeRecord.attentionReasons,
                              ],
                            };

                            onUpdateStayRecords(stayRecords.map(r => r.bookingId === activeRecord.bookingId ? updatedRecord : r));
                            setIsAddingGuest(false);
                            showToast('Đã thêm khách phát sinh vào đoàn!');
                          }}
                          className="px-4 py-1.5 rounded-xl bg-[#0E2A47] text-[#C8A261] font-bold text-xs shadow-xs"
                        >
                          Xác Nhận Thêm
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Guests Table */}
                  <div className="border border-[#E5DECE] rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F5] border-b border-[#E5DECE] text-[#8C7E6C] uppercase text-[10px] font-bold">
                          <th className="p-3">Họ Tên & Giới Tính</th>
                          <th className="p-3">Quốc Tịch</th>
                          <th className="p-3">Phòng Đang Ở</th>
                          <th className="p-3 text-center">Kiểm Tra Giấy Tờ Trực Tiếp</th>
                          <th className="p-3 text-center">Trạng Thái Khai Báo</th>
                          <th className="p-3 text-right">Chuyển Phòng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5DECE]">
                        {activeRecord.guests.map(guest => (
                          <tr key={guest.id} className="hover:bg-[#FAF8F5]">
                            {/* Guest Name & Gender */}
                            <td className="p-3">
                              <span className="font-bold text-[#0E2A47] block text-sm">
                                {guest.fullName}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {guest.birthYear ? `Năm sinh: ${guest.birthYear}` : '—'} • {guest.gender === 'male' ? 'Nam' : guest.gender === 'female' ? 'Nữ' : 'Khác'}
                              </span>
                            </td>

                            {/* Nationality */}
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
                                guest.nationality === 'FOREIGN' 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {guest.nationality === 'FOREIGN' ? <Globe className="w-3 h-3 text-amber-700" /> : null}
                                <span>{guest.nationalityName || (guest.nationality === 'VN' ? 'Việt Nam' : 'Nước ngoài')}</span>
                              </span>
                            </td>

                            {/* Assigned Room */}
                            <td className="p-3 font-bold text-[#0E2A47]">
                              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                                P.{guest.assignedRoomNumber}
                              </span>
                            </td>

                            {/* Document Physical Check */}
                            <td className="p-3 text-center">
                              {guest.isDocumentChecked ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Đã đối chiếu {guest.documentTypeVerified?.toUpperCase()}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    Bởi {guest.checkedByStaff}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleToggleGuestDocumentCheck(activeRecord.bookingId, guest.id, guest.nationality === 'FOREIGN' ? 'passport' : 'cccd')}
                                  className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold transition-all flex items-center gap-1 mx-auto"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Xác nhận đã xem {guest.nationality === 'FOREIGN' ? 'Hộ Chiếu' : 'CCCD'}</span>
                                </button>
                              )}
                            </td>

                            {/* Individual Declaration Status */}
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getDeclarationMeta(guest.declarationStatus).bg} ${getDeclarationMeta(guest.declarationStatus).text}`}>
                                {getDeclarationMeta(guest.declarationStatus).label}
                              </span>
                            </td>

                            {/* Room Transfer Trigger */}
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setTransferModalGuest(guest);
                                  setTargetRoomNumber(activeRecord.roomAllocations.find(a => a.roomNumber !== guest.assignedRoomNumber)?.roomNumber || '');
                                }}
                                title="Chuyển phòng cho khách trong đoàn"
                                className="p-1.5 text-slate-500 hover:text-[#0E2A47] hover:bg-slate-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-[#C8A261]" />
                                <span>Chuyển</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* TAB 3: GHI NHẬN THÔNG BÁO LƯU TRÚ / KHAI BÁO TẠM TRÚ */}
              {/* ----------------------------------------------------------- */}
              {modalTab === 'declaration_form' && (
                <div className="space-y-5">
                  <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-sky-600" />
                      <span>QUY TRÌNH NGHIỆP VỤ KHAI BÁO LƯU TRÚ:</span>
                    </div>
                    <p>
                      1. Nhân viên thực hiện khai báo tạm trú chính thức trên Cổng Dịch vụ công Quản lý cư trú hoặc hệ thống khai báo người nước ngoài của cơ quan chức năng.
                    </p>
                    <p>
                      2. Sau khi có kết quả hoặc mã biên nhận, nhân viên ghi nhận trạng thái kiểm soát tại Seagull bên dưới.
                    </p>
                    <p className="font-bold text-amber-900">
                      * Chú ý: Hệ thống không tự động coi Check-in là đã khai báo. Bắt buộc nhân viên thẩm định trực tiếp!
                    </p>
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#E5DECE] rounded-2xl p-5 space-y-4">
                    <h4 className="font-serif font-bold text-sm text-[#0E2A47]">
                      Cập Nhật Trạng Thái Khai Báo Cho Đoàn / Booking {activeRecord.bookingCode}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-[#0E2A47] block mb-1">
                          Chọn Trạng Thái Khai Báo
                        </label>
                        <select
                          id="select-decl-status"
                          defaultValue={activeRecord.overallDeclarationStatus}
                          className="w-full p-2.5 bg-white border border-[#D5CBBF] rounded-xl text-xs font-bold text-[#0E2A47]"
                        >
                          <option value="unprocessed">1. Chưa thực hiện</option>
                          <option value="in_progress">2. Đang xử lý</option>
                          <option value="awaiting_verification">3. Chờ đối chiếu</option>
                          <option value="verified_completed">4. Đã xác nhận hoàn tất (Yêu cầu mã biên nhận)</option>
                          <option value="needs_revision">5. Cần xử lý lại</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-[#0E2A47] block mb-1">
                          Mã Tham Chiếu / Số Biên Nhận Dịch Vụ Công
                        </label>
                        <input
                          id="input-decl-ref"
                          type="text"
                          placeholder="Ví dụ: DKTT-260801-9102"
                          defaultValue={activeRecord.guests[0]?.declarationReferenceCode || ''}
                          className="w-full p-2.5 bg-white border border-[#D5CBBF] rounded-xl text-xs font-mono"
                        />
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Lưu làm căn cứ đối chiếu với cơ quan kiểm tra khi cần
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-[#E5DECE]">
                      <span className="text-xs text-slate-500">
                        Người thẩm định: <strong>{currentStaff}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const statusEl = document.getElementById('select-decl-status') as HTMLSelectElement;
                          const refEl = document.getElementById('input-decl-ref') as HTMLInputElement;
                          const chosenStatus = statusEl.value as DeclarationStatus;
                          const refCode = refEl.value.trim();

                          if (chosenStatus === 'verified_completed' && !refCode) {
                            alert('Vui lòng nhập Mã tham chiếu hoặc Số biên nhận khai báo để lưu làm căn cứ hoàn tất!');
                            return;
                          }

                          handleUpdateDeclarationStatus(activeRecord.bookingId, chosenStatus, refCode);
                        }}
                        className="bg-[#0E2A47] hover:bg-[#163A5F] text-[#FAF8F5] px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#C8A261]" />
                        <span>Lưu Kết Quả Khai Báo</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* TAB 4: LỊCH SỬ CHUYỂN PHÒNG & NHẬT KÝ AUDIT */}
              {/* ----------------------------------------------------------- */}
              {modalTab === 'transfer_history' && (
                <div className="space-y-6">
                  {/* Transfer History Table */}
                  <div className="space-y-2">
                    <h4 className="font-serif font-bold text-sm text-[#0E2A47]">
                      Lịch Sử Chuyển Phòng Trong Đoàn ({activeRecord.transferHistory.length} lần)
                    </h4>
                    {activeRecord.transferHistory.length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5DECE]">
                        Chưa có lịch sử chuyển phòng nào trong kỳ lưu trú này.
                      </p>
                    ) : (
                      <div className="border border-[#E5DECE] rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#FAF8F5] border-b border-[#E5DECE] text-[#8C7E6C] uppercase text-[10px] font-bold">
                              <th className="p-3">Thời Điểm</th>
                              <th className="p-3">Khách Chuyển</th>
                              <th className="p-3">Chuyển Từ → Đến</th>
                              <th className="p-3">Lý Do</th>
                              <th className="p-3">Người Thực Hiện</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5DECE]">
                            {activeRecord.transferHistory.map(item => (
                              <tr key={item.id}>
                                <td className="p-3 font-mono text-slate-500">{item.transferredAt}</td>
                                <td className="p-3 font-bold text-[#0E2A47]">{item.guestName}</td>
                                <td className="p-3 font-semibold text-purple-800">
                                  P.{item.fromRoomNumber} → P.{item.toRoomNumber}
                                </td>
                                <td className="p-3 text-slate-600">{item.reason}</td>
                                <td className="p-3 text-slate-500">{item.transferredBy}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Audit Logs Table */}
                  <div className="space-y-2">
                    <h4 className="font-serif font-bold text-sm text-[#0E2A47]">
                      Nhật Ký Thao Tác (Audit Log)
                    </h4>
                    <div className="border border-[#E5DECE] rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#FAF8F5] border-b border-[#E5DECE] text-[#8C7E6C] uppercase text-[10px] font-bold">
                            <th className="p-2.5">Thời Gian</th>
                            <th className="p-2.5">Nhân Viên</th>
                            <th className="p-2.5">Hành Động</th>
                            <th className="p-2.5">Chi Tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5DECE] font-mono text-[11px]">
                          {activeRecord.auditLogs.map(log => (
                            <tr key={log.id} className="hover:bg-[#FAF8F5]">
                              <td className="p-2.5 text-slate-500">{log.timestamp}</td>
                              <td className="p-2.5 font-bold text-[#0E2A47]">{log.staffName}</td>
                              <td className="p-2.5 text-blue-800">{log.action}</td>
                              <td className="p-2.5 text-slate-700">{log.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF8F5] border-t border-[#E5DECE] flex items-center justify-between shrink-0">
              <span className="text-xs text-[#8C7E6C]">
                Đơn vị lưu trú: <strong>{propertyConfig.propertyName}</strong> • Thôn Đông An Vĩnh, Đảo Lý Sơn
              </span>

              <button
                onClick={() => setSelectedRecordId(null)}
                className="bg-[#0E2A47] hover:bg-[#163A5F] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 4. MODAL CON: DIALOG CHUYỂN PHÒNG CHO KHÁCH TRONG ĐOÀN */}
      {/* ------------------------------------------------------------------- */}
      {transferModalGuest && activeRecord && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E5DECE] space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-[#E5DECE] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#C8A261]" />
                <h4 className="font-serif font-bold text-base text-[#0E2A47]">
                  Chuyển Phòng Cho Khách
                </h4>
              </div>
              <button onClick={() => setTransferModalGuest(null)} className="text-slate-400 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5DECE]">
                <p>Khách chuyển: <strong className="text-[#0E2A47]">{transferModalGuest.fullName}</strong></p>
                <p>Phòng hiện tại: <strong className="text-rose-700">P.{transferModalGuest.assignedRoomNumber}</strong></p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0E2A47] block mb-1">
                  Chọn phòng chuyển đến (trong đoàn):
                </label>
                <select
                  value={targetRoomNumber}
                  onChange={(e) => setTargetRoomNumber(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#D5CBBF] rounded-xl text-xs font-bold text-[#0E2A47]"
                >
                  <option value="">-- Chọn phòng mục tiêu --</option>
                  {activeRecord.roomAllocations.map(a => (
                    <option key={a.roomNumber} value={a.roomNumber}>
                      Phòng {a.roomNumber} ({a.roomTypeName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0E2A47] block mb-1">
                  Lý do chuyển phòng:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Khách muốn ở cùng anh chị em tầng 2..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#D5CBBF] rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5DECE]">
              <button
                type="button"
                onClick={() => setTransferModalGuest(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-600 font-semibold"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleTransferGuestRoom}
                className="px-5 py-2 rounded-xl bg-[#0E2A47] hover:bg-[#163A5F] text-[#C8A261] font-bold text-xs shadow-md"
              >
                Xác Nhận Chuyển Phòng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
