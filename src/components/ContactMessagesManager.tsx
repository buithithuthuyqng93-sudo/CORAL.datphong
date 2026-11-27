import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  ExternalLink,
  Lock,
} from 'lucide-react';
import type { ContactMessage, ContactMessageStatus } from '../types';
import {
  apiListContactMessages,
  apiUpdateContactMessageStatus,
} from '../services/dataAdapter';

interface ContactMessagesManagerProps {
  userRole: 'owner' | 'reception' | 'accountant';
  showToast: (msg: string) => void;
  onNewCountChange?: (newCount: number) => void;
}

const STATUS_OPTIONS: {
  value: ContactMessageStatus;
  label: string;
  activeClass: string;
  badgeClass: string;
  dotClass: string;
}[] = [
  {
    value: 'new',
    label: 'Mới',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-xs',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500 animate-pulse',
  },
  {
    value: 'contacted',
    label: 'Đã liên hệ',
    activeClass: 'bg-sky-600 text-white border-sky-600 shadow-xs',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClass: 'bg-sky-500',
  },
  {
    value: 'done',
    label: 'Hoàn tất',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
];

function sanitizePhoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function formatVietnamDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).format(d);
  } catch {
    return iso;
  }
}

export const ContactMessagesManager: React.FC<ContactMessagesManagerProps> = ({
  userRole,
  showToast,
  onNewCountChange,
}) => {
  const canUpdateStatus = userRole === 'owner' || userRole === 'reception';

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ContactMessageStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchMessages = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg(null);
    try {
      const token = sessionStorage.getItem('seagull_admin_token');
      if (!token) {
        setErrorMsg('Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại.');
        return;
      }
      const res = await apiListContactMessages(token);
      setMessages(res.items || []);
      onNewCountChange?.(res.newCount ?? (res.items || []).filter((m) => m.status === 'new').length);
      if (isManualRefresh) {
        showToast('Đã cập nhật danh sách liên hệ khách hàng mới nhất.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải danh sách liên hệ khách hàng.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessages(false);
  }, []);

  const counts = useMemo(() => {
    let newCount = 0;
    let contactedCount = 0;
    let doneCount = 0;
    for (const m of messages) {
      if (m.status === 'new') newCount++;
      else if (m.status === 'contacted') contactedCount++;
      else if (m.status === 'done') doneCount++;
    }
    return {
      all: messages.length,
      new: newCount,
      contacted: contactedCount,
      done: doneCount,
    };
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q)
      );
    });
  }, [messages, statusFilter, searchQuery]);

  const handleStatusChange = async (item: ContactMessage, nextStatus: ContactMessageStatus) => {
    if (!canUpdateStatus) {
      showToast('Tài khoản Kế toán chỉ có quyền xem danh sách liên hệ.');
      return;
    }
    if (item.status === nextStatus || updatingId === item.id) return;

    const token = sessionStorage.getItem('seagull_admin_token');
    if (!token) {
      setErrorMsg('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    setUpdatingId(item.id);
    setErrorMsg(null);
    try {
      const res = await apiUpdateContactMessageStatus(item.id, nextStatus, token);
      const updatedList = messages.map((m) => (m.id === item.id ? res.item : m));
      setMessages(updatedList);
      const nextNewCount = updatedList.filter((m) => m.status === 'new').length;
      onNewCountChange?.(nextNewCount);

      const label = STATUS_OPTIONS.find((s) => s.value === nextStatus)?.label || nextStatus;
      showToast(`Đã chuyển liên hệ của ${item.fullName} sang trạng thái "${label}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể cập nhật trạng thái liên hệ.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Info & Action Bar */}
      <div className="bg-white border border-[#E5DECE] rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0E2A47] text-[#C8A261] flex items-center justify-center shrink-0 shadow-xs">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0E2A47] flex items-center gap-2">
              <span>Hộp thư Liên hệ Khách hàng (/lien-he)</span>
              {counts.new > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>{counts.new} liên hệ mới</span>
                </span>
              )}
            </h2>
            <p className="text-xs text-[#6E6458] mt-0.5">
              Tự động lưu mọi tin nhắn khách gửi từ trang Liên hệ (mới nhất lên đầu). Nhân viên bấm đổi trạng thái hoặc gọi / nhắn Zalo trực tiếp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!canUpdateStatus && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Chế độ chỉ xem</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchMessages(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#EFEAE0] border border-[#D5CBBF] text-[#0E2A47] text-xs font-bold transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all ${
            statusFilter === 'all'
              ? 'border-[#0E2A47] ring-1 ring-[#0E2A47] shadow-sm'
              : 'border-[#E5DECE] hover:border-[#C8A261]'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E6C]">
            Tổng liên hệ
          </span>
          <div className="mt-1.5 text-2xl font-bold text-[#0E2A47]">{counts.all}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('new')}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all ${
            statusFilter === 'new'
              ? 'border-rose-500 ring-1 ring-rose-500 shadow-sm'
              : 'border-[#E5DECE] hover:border-rose-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Mới (Chưa xử lý)</span>
          </span>
          <div className="mt-1.5 text-2xl font-bold text-rose-600">{counts.new}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('contacted')}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all ${
            statusFilter === 'contacted'
              ? 'border-sky-500 ring-1 ring-sky-500 shadow-sm'
              : 'border-[#E5DECE] hover:border-sky-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Đã liên hệ</span>
          </span>
          <div className="mt-1.5 text-2xl font-bold text-sky-700">{counts.contacted}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('done')}
          className={`text-left bg-white border rounded-2xl p-3.5 transition-all ${
            statusFilter === 'done'
              ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-sm'
              : 'border-[#E5DECE] hover:border-emerald-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Hoàn tất</span>
          </span>
          <div className="mt-1.5 text-2xl font-bold text-emerald-700">{counts.done}</div>
        </button>
      </div>

      {/* Search & Error */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C7E6C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên khách, số điện thoại hoặc nội dung..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5CBBF] rounded-xl text-xs text-[#0E2A47] placeholder:text-[#9A8E80] focus:outline-none focus:border-[#0E2A47]"
          />
        </div>
        <span className="text-xs text-[#8C7E6C]">
          Hiển thị <strong className="text-[#0E2A47]">{filteredMessages.length}</strong> / {messages.length} liên hệ
        </span>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="bg-white border border-[#E5DECE] rounded-2xl p-12 text-center text-xs text-[#8C7E6C] flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#C8A261]" />
          <span>Đang tải danh sách liên hệ khách hàng...</span>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-white border border-[#E5DECE] rounded-2xl p-12 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-[#C8A261] mx-auto opacity-70" />
          <p className="text-sm font-bold text-[#0E2A47]">
            {messages.length === 0
              ? 'Chưa có yêu cầu liên hệ nào từ khách hàng'
              : 'Không có liên hệ nào khớp với bộ lọc hiện tại'}
          </p>
          <p className="text-xs text-[#8C7E6C]">
            Khi khách gửi form trên trang Liên hệ (/lien-he), thông tin sẽ tự động xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((item) => {
            const isNew = item.status === 'new';
            const digits = sanitizePhoneDigits(item.phone);
            const statusMeta =
              STATUS_OPTIONS.find((s) => s.value === item.status) || STATUS_OPTIONS[0];
            const isUpdating = updatingId === item.id;

            return (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 transition-all ${
                  isNew
                    ? 'bg-[#FFFDF9] border-rose-300 shadow-sm ring-1 ring-rose-100'
                    : 'bg-white border-[#E5DECE] hover:border-[#D5CBBF]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left: Guest Info + Message */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isNew && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0"
                          title="Liên hệ mới chưa xử lý"
                        />
                      )}
                      <h3 className="text-sm font-bold text-[#0E2A47] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#C8A261] shrink-0" />
                        <span>{item.fullName}</span>
                      </h3>
                      <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-lg bg-[#FAF8F5] border border-[#E5DECE] text-[#0E2A47]">
                        {item.phone}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#334155] leading-relaxed whitespace-pre-wrap bg-[#FAF8F5] border border-[#EFEAE0] rounded-xl px-3.5 py-2.5">
                      {item.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#8C7E6C]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#C8A261]" />
                        <span>Gửi lúc: {formatVietnamDateTime(item.createdAt)}</span>
                      </span>
                      {item.handledBy && (
                        <span className="inline-flex items-center gap-1 text-[#6E6458]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Cập nhật bởi: {item.handledBy}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Status Switcher + Quick Call / Zalo Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-2.5 shrink-0">
                    {/* Status Switcher */}
                    <div
                      className="inline-flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DECE]"
                      role="group"
                      aria-label={`Trạng thái liên hệ của ${item.fullName}`}
                    >
                      {STATUS_OPTIONS.map((opt) => {
                        const active = item.status === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={!canUpdateStatus || isUpdating}
                            onClick={() => handleStatusChange(item, opt.value)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-60 ${
                              active
                                ? opt.activeClass
                                : 'bg-transparent text-[#6E6458] border-transparent hover:bg-white hover:text-[#0E2A47]'
                            }`}
                          >
                            {isUpdating && active ? (
                              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                            ) : null}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Action Buttons: Gọi & Nhắn Zalo */}
                    <div className="flex items-center gap-2">
                      {digits ? (
                        <>
                          <a
                            href={`tel:${digits}`}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Gọi</span>
                          </a>
                          <a
                            href={`https://zalo.me/${digits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0068FF] hover:bg-[#0056D6] text-white text-xs font-bold transition-colors shadow-xs"
                          >
                            <span>Nhắn Zalo</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#8C7E6C]">SĐT không hợp lệ</span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
