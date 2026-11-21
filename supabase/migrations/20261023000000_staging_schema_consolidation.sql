-- ==============================================================================
-- SEAGULL LÝ SƠN — HOMESTAY & CÀ PHÊ
-- STAGING MIGRATION DRAFT: CHUẨN HÓA TOÀN BỘ CƠ SỞ DỮ LIỆU & RÀNG BUỘC NGHIỆP VỤ
-- File: 20261023000000_staging_schema_consolidation.sql
-- Mục đích: Dành riêng cho môi trường Supabase Staging độc lập (Dữ liệu giả lập)
-- TUYỆT ĐỐI KHÔNG CHẠY TRỰC TIẾP TRÊN CƠ SỞ DỮ LIỆU PRODUCTION KHI CHƯA PHÊ DUYỆT!
-- ==============================================================================

-- 0. KÍCH HOẠT EXTENSIONS CẦN THIẾT
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- Hỗ trợ EXCLUSION constraint trên range và scalar types

-- ==============================================================================
-- PHẦN 1: BỔ SUNG CÁC BẢNG BỊ THIẾU TRONG SCHEMA CŨ
-- ==============================================================================

-- 1.1 BẢNG: room_blocks (Khóa phòng / Bảo trì theo khoảng ngày)
CREATE TABLE IF NOT EXISTS public.room_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(50) NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_room_block_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_room_blocks_room_dates ON public.room_blocks(room_id, start_date, end_date);

-- Áp dụng EXCLUSION CONSTRAINT chống chồng lấn lịch khóa phòng
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exclude_overlapping_room_blocks'
    ) THEN
        ALTER TABLE public.room_blocks
        ADD CONSTRAINT exclude_overlapping_room_blocks
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(start_date, end_date, '[)') WITH &&
        );
    END IF;
END $$;

-- 1.2 BẢNG: customers (Hồ sơ khách hàng định danh bảo mật)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    total_stays INT NOT NULL DEFAULT 0,
    total_spent DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    last_stay_date DATE,
    tier VARCHAR(50) NOT NULL DEFAULT 'new', -- 'new', 'regular', 'vip', 'flagged'
    notes TEXT,
    zalo_contact VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_customer_phone UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- 1.3 BẢNG: cash_transactions (Quản lý dòng tiền thu chi homestay & cà phê)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_type VARCHAR(20) NOT NULL, -- 'income' | 'expense'
    category VARCHAR(50) NOT NULL,        -- 'deposit', 'room_balance', 'cafe_beverage', 'bike_rental', 'supplies', 'utilities', 'staff_salary', 'other'
    amount DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
    title VARCHAR(255) NOT NULL,
    booking_code VARCHAR(50),
    performed_by VARCHAR(100) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'vietqr', -- 'vietqr', 'cash', 'card', 'bank_transfer'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON public.cash_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(transaction_type, category);

-- ==============================================================================
-- PHẦN 2: BẢNG NGHIỆP VỤ CHECK-IN & QUẢN LÝ LƯU TRÚ (V1.2 / V1.3)
-- ==============================================================================

-- 2.1 BẢNG: booking_stay_records (Hồ sơ lưu trú tổng thể theo đơn phòng)
CREATE TABLE IF NOT EXISTS public.booking_stay_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_code VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    is_group_booking BOOLEAN NOT NULL DEFAULT FALSE,
    group_name VARCHAR(255),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    total_expected_guests INT NOT NULL DEFAULT 1,
    total_actual_guests INT NOT NULL DEFAULT 1,
    overall_check_in_status VARCHAR(50) NOT NULL DEFAULT 'not_checked_in', -- 'not_checked_in', 'partially_checked_in', 'fully_checked_in', 'checked_out'
    overall_declaration_status VARCHAR(50) NOT NULL DEFAULT 'unprocessed',  -- 'unprocessed', 'in_progress', 'awaiting_verification', 'verified_completed', 'needs_revision'
    attention_required BOOLEAN NOT NULL DEFAULT FALSE,
    attention_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_booking_stay_code UNIQUE (booking_code)
);

CREATE INDEX IF NOT EXISTS idx_stay_records_code ON public.booking_stay_records(booking_code);
CREATE INDEX IF NOT EXISTS idx_stay_records_attention ON public.booking_stay_records(attention_required);

-- 2.2 BẢNG: stay_guests (Chi tiết từng khách lưu trú - Tuân thủ NĐ 13/2023: Không lưu ảnh CCCD/mật khẩu)
CREATE TABLE IF NOT EXISTS public.stay_guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_record_id UUID NOT NULL REFERENCES public.booking_stay_records(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    birth_year INT,
    gender VARCHAR(20) DEFAULT 'male', -- 'male', 'female', 'other'
    nationality VARCHAR(50) NOT NULL DEFAULT 'VN', -- 'VN' | 'FOREIGN'
    nationality_name VARCHAR(100) DEFAULT 'Việt Nam',
    assigned_room_id VARCHAR(50) REFERENCES public.rooms(id) ON DELETE SET NULL,
    assigned_room_number VARCHAR(50) NOT NULL,
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    document_type_verified VARCHAR(50), -- 'physical_cccd', 'passport', 'vneid_app', 'birth_certificate'
    is_document_checked BOOLEAN NOT NULL DEFAULT FALSE,
    checked_by_staff VARCHAR(100),
    checked_at TIMESTAMPTZ,
    document_notes TEXT,
    declaration_status VARCHAR(50) NOT NULL DEFAULT 'unprocessed', -- 'unprocessed', 'in_progress', 'awaiting_verification', 'verified_completed', 'needs_revision'
    declaration_reference_code VARCHAR(100), -- Tùy chọn, không bắt buộc, không sinh mã giả
    declaration_verified_by VARCHAR(100),
    declaration_verified_at TIMESTAMPTZ,
    declaration_notes TEXT,
    verification_basis VARCHAR(255), -- 'Biên nhận điện tử Cổng TBLT KBTT', 'Xác nhận CA xã', 'Tin nhắn DVC'...
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stay_guests_record ON public.stay_guests(stay_record_id);
CREATE INDEX IF NOT EXISTS idx_stay_guests_status ON public.stay_guests(declaration_status);

-- 2.3 BẢNG: room_transfer_history (Lịch sử chuyển phòng giữa các khách trong đoàn)
CREATE TABLE IF NOT EXISTS public.room_transfer_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_record_id UUID NOT NULL REFERENCES public.booking_stay_records(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.stay_guests(id) ON DELETE CASCADE,
    guest_name VARCHAR(255) NOT NULL,
    from_room_number VARCHAR(50) NOT NULL,
    to_room_number VARCHAR(50) NOT NULL,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transferred_by VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL
);

-- 2.4 BẢNG: stay_audit_logs (Nhật ký kiểm toán nghiệp vụ lưu trú)
CREATE TABLE IF NOT EXISTS public.stay_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_record_id UUID NOT NULL REFERENCES public.booking_stay_records(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    staff_name VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL
);

-- ==============================================================================
-- PHẦN 3: BẢNG CÀI ĐẶT NÂNG CAO V2 (GIÁ MÙA VỤ & AUDIT LOGS)
-- ==============================================================================

-- 3.1 BẢNG: seasonal_price_rules (Quy tắc giá mùa hè / lễ tết / cuối tuần)
CREATE TABLE IF NOT EXISTS public.seasonal_price_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    room_type_id VARCHAR(50) NOT NULL, -- 'all' hoặc ID cụ thể
    room_type_name VARCHAR(255) DEFAULT 'Tất cả loại phòng',
    adjustment_type VARCHAR(50) NOT NULL DEFAULT 'percentage', -- 'fixed_price' | 'percentage'
    adjustment_value DECIMAL(12, 2) NOT NULL,
    note TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_seasonal_rule_dates CHECK (end_date >= start_date)
);

-- 3.2 BẢNG: price_audit_logs (Lịch sử điều chỉnh giá - Bảo vệ booking cũ)
CREATE TABLE IF NOT EXISTS public.price_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    staff_name VARCHAR(100) NOT NULL,
    room_type_name VARCHAR(255) NOT NULL,
    field_changed VARCHAR(100) NOT NULL,
    old_value VARCHAR(100) NOT NULL,
    new_value VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL
);

-- 3.3 BẢNG: bank_audit_logs (Lịch sử thay đổi tài khoản ngân hàng nhận cọc VietQR)
CREATE TABLE IF NOT EXISTS public.bank_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    staff_name VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    old_bank_info TEXT NOT NULL,
    new_bank_info TEXT NOT NULL,
    reason TEXT NOT NULL,
    confirmed_by_owner BOOLEAN NOT NULL DEFAULT FALSE
);

-- ==============================================================================
-- PHẦN 4: GIA CỐ CHỐNG BÁN TRÙNG PHÒNG BẰNG POSTGRESQL EXCLUSION CONSTRAINT
-- ==============================================================================

-- Đảm bảo xóa bỏ unique tuple cũ nếu tồn tại
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_room_allocation_slot'
    ) THEN
        ALTER TABLE public.booking_room_allocations DROP CONSTRAINT unique_room_allocation_slot;
    END IF;
END $$;

-- Áp dụng EXCLUSION CONSTRAINT trên booking_room_allocations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exclude_overlapping_room_allocations'
    ) THEN
        ALTER TABLE public.booking_room_allocations
        ADD CONSTRAINT exclude_overlapping_room_allocations
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(check_in_date, check_out_date, '[)') WITH &&
        );
    END IF;
END $$;

-- ==============================================================================
-- PHẦN 5: CHUẨN HÓA DANH SÁCH 20 PHÒNG KINH DOANH SEAGULL (+ 1 KHO + 11 GĐ2)
-- ==============================================================================

-- Cập nhật danh sách loại phòng chuẩn Seagull
INSERT INTO public.room_types (id, name, slug, description, capacity_adults, capacity_children, base_price, deposit_value, size_sqm, bed_type, image, amenities)
VALUES
('type-home1-single', 'Bungalow Vòm Ocean View (Cụm Home 1)', 'bungalow-vom-ocean-view-home-1', 'Bungalow mái vòm trệt nép mình bên vách đá bazan, kính tràn viền hướng thẳng mặt biển An Vĩnh. Diện tích 21m².', 2, 1, 650000.00, 30.00, '21m²', '1 Giường King Mái Vòm', '/images/bungalow-cliff-day.jpg', '["Ban công riêng view biển", "WC sen tắm đứng", "Wifi tốc độ cao", "Điều hòa 2 chiều", "Tủ lạnh mini"]'::jsonb),
('type-home1-vip', 'VIP Cliffside Bồn Tắm Nằm & Sky Terrace (P.101)', 'vip-cliffside-bon-tam-sky-terrace-101', 'Căn vòm VIP duy nhất tại Cụm 1 sở hữu bồn tắm nằm sát vách kính ngắm biển và Sân thượng ngắm hoàng hôn 360 độ.', 2, 1, 950000.00, 30.00, '22m²', '1 Giường King Panorama', '/images/bungalow-bathtub-ocean.jpg', '["Bồn tắm nằm view biển", "Sân thượng trên nóc vòm (Sky Terrace)", "Ban công riêng", "Smart TV 55 inch"]'::jsonb),
('type-home2-sunset', 'Bungalow Vòm Sunset 2 Tầng (Cụm Home 2)', 'bungalow-vom-sunset-2-tang-home-2', 'Khối 2 tầng mái vòm ngắm trọn hoàng hôn biển Tây Lý Sơn. Tầng 2 có hành lang sau ngắm cảnh rộng 18m².', 2, 1, 750000.00, 30.00, '20m²', '1 Giường King hoặc 2 Giường Đơn', '/images/bungalow-row-sunset.jpg', '["Ban công ngắm hoàng hôn", "Hành lang ngắm cảnh 18m²", "Điều hòa 2 chiều", "Gỗ mây cao cấp"]'::jsonb),
('type-home3-panorama', 'Bungalow Vòm Panorama 2 Tầng (Cụm Home 3)', 'bungalow-vom-panorama-2-tang-home-3', 'Khối 2 tầng nép mình vách núi đá bazan trầm tích, ban công trước thoáng đãng và hành lang sau 24m².', 2, 1, 850000.00, 30.00, '20m²', '1 Giường King lớn', '/images/bungalow-bedroom-twin.jpg', '["Ban công đón gió biển", "Hành lang sau 24m²", "Smart TV 55 inch", "Trà & Cà phê miễn phí"]'::jsonb),
('type-home4-cafe', 'Phòng Lầu Nóc Cafe Seagull (Home 4 - GĐ2)', 'phong-lau-noc-cafe-seagull-home-4', 'Phòng lưu trú tầng 2 phía trên không gian Seagull Coffee. Đang hoàn thiện thi công.', 2, 1, 700000.00, 30.00, '19m²', '1 Giường King', '/images/bungalow-cliff-day.jpg', '["Ban công phố biển", "Gần quầy Cà phê Seagull", "Đang hoàn thiện thi công"]'::jsonb),
('type-home5-heritage', 'Khu Nghỉ Dưỡng Cải Tạo (Home 5 - GĐ2)', 'khu-nghi-duong-cai-tao-home-5', 'Dãy phòng cải tạo trệt với sân vườn và khu giặt sấy 18m². Đang hoàn thiện thi công.', 4, 2, 600000.00, 30.00, '22m²', '2 Giường Đôi Gia Đình', '/images/bungalow-sunset-front.jpg', '["Sân vườn & Sảnh chung", "Khu giặt phơi 18m²", "Đang hoàn thiện thi công"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    base_price = EXCLUDED.base_price,
    deposit_value = EXCLUDED.deposit_value,
    amenities = EXCLUDED.amenities;

-- Seed danh sách phòng chuẩn (20 phòng kinh doanh + 1 kho kỹ thuật + 11 phòng GĐ2)
INSERT INTO public.rooms (id, room_type_id, room_code, room_name, floor_or_area, status, housekeeping_status, active, notes)
VALUES
-- CỤM HOME 1 (6 phòng mở bán + 1 phòng dự phòng kỹ thuật)
('rm-101', 'type-home1-vip', '101', 'VIP Cliffside Bathtub 101', 1, 'available', 'clean', TRUE, 'Căn VIP bồn tắm & Sky Terrace'),
('rm-102', 'type-home1-single', '102', 'Ocean View Vòm 102', 1, 'available', 'clean', TRUE, 'Vòm trệt view biển'),
('rm-103', 'type-home1-single', '103', 'Ocean View Vòm 103', 1, 'available', 'clean', TRUE, 'Vòm trệt view biển'),
('rm-104', 'type-home1-single', '104', 'Ocean View Vòm 104', 1, 'available', 'clean', TRUE, 'Vòm trệt view biển'),
('rm-105', 'type-home1-single', '105', 'Ocean View Vòm 105', 1, 'available', 'clean', TRUE, 'Vòm trệt view biển'),
('rm-106', 'type-home1-single', '106', 'Ocean View Vòm 106', 1, 'available', 'clean', TRUE, 'Vòm trệt view biển'),
('rm-107', 'type-home1-single', '107', 'Dự Phòng / Kho Kỹ Thuật 107', 1, 'maintenance', 'clean', FALSE, 'Phòng dự phòng kỹ thuật / kho - Chưa có quyết định ngừng bán riêng từ Chủ cơ sở (Không tự ý xóa khỏi DB)'),

-- CỤM HOME 2 (6 phòng mở bán)
('rm-201', 'type-home2-sunset', '201', 'Sunset Vòm 201', 1, 'available', 'clean', TRUE, 'Tầng 1 Cụm 2'),
('rm-202', 'type-home2-sunset', '202', 'Sunset Vòm 202', 1, 'available', 'clean', TRUE, 'Tầng 1 Cụm 2'),
('rm-203', 'type-home2-sunset', '203', 'Sunset Vòm 203', 1, 'available', 'clean', TRUE, 'Tầng 1 Cụm 2'),
('rm-204', 'type-home2-sunset', '204', 'Sunset Vòm 204', 2, 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 18m²'),
('rm-205', 'type-home2-sunset', '205', 'Sunset Vòm 205', 2, 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 18m²'),
('rm-206', 'type-home2-sunset', '206', 'Sunset Vòm 206', 2, 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 18m²'),

-- CỤM HOME 3 (8 phòng mở bán)
('rm-301', 'type-home3-panorama', '301', 'Panorama Vòm 301', 1, 'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-302', 'type-home3-panorama', '302', 'Panorama Vòm 302', 1, 'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-303', 'type-home3-panorama', '303', 'Panorama Vòm 303', 1, 'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-304', 'type-home3-panorama', '304', 'Panorama Vòm 304', 1, 'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-305', 'type-home3-panorama', '305', 'Panorama Vòm 305', 2, 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),
('rm-306', 'type-home3-panorama', '306', 'Panorama Vòm 306', 2, 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),
('rm-307', 'type-home3-panorama', '307', 'Panorama Vòm 307', 2, 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),
('rm-308', 'type-home3-panorama', '308', 'Panorama Vòm 308', 2, 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),

-- CỤM HOME 4 (5 phòng Giai đoạn 2 - Khóa thi công)
('rm-401', 'type-home4-cafe', '401', 'Lầu Nóc Cafe 401', 2, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-402', 'type-home4-cafe', '402', 'Lầu Nóc Cafe 402', 2, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-403', 'type-home4-cafe', '403', 'Lầu Nóc Cafe 403', 2, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-404', 'type-home4-cafe', '404', 'Lầu Nóc Cafe 404', 2, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-405', 'type-home4-cafe', '405', 'Lầu Nóc Cafe 405', 2, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),

-- CỤM HOME 5 (6 phòng Giai đoạn 2 - Khóa thi công)
('rm-501', 'type-home5-heritage', '501', 'Khu Cải Tạo 501', 1, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-502', 'type-home5-heritage', '502', 'Khu Cải Tạo 502', 1, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-503', 'type-home5-heritage', '503', 'Khu Cải Tạo 503', 1, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-504', 'type-home5-heritage', '504', 'Khu Cải Tạo 504', 1, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-505', 'type-home5-heritage', '505', 'Khu Cải Tạo 505', 1, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công'),
('rm-506', 'type-home5-heritage', '506', 'Khu Cải Tạo 506', 1, 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang thi công')
ON CONFLICT (id) DO UPDATE SET
    room_code = EXCLUDED.room_code,
    room_name = EXCLUDED.room_name,
    room_type_id = EXCLUDED.room_type_id,
    active = EXCLUDED.active,
    notes = EXCLUDED.notes;

-- ==============================================================================
-- PHẦN 6: GIA CỐ RLS TOÀN DIỆN CHO TẤT CẢ CÁC BẢNG MỚI
-- ==============================================================================

ALTER TABLE public.room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_stay_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_transfer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6.1 Quyền bảng khách hàng & lưu trú:
-- Khách vãng lai bị chặn xem hồ sơ lưu trú
DROP POLICY IF EXISTS "Block anon from stay records" ON public.booking_stay_records;
CREATE POLICY "Block anon from stay records" ON public.booking_stay_records
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Lễ tân và Chủ cơ sở xem & quản lý hồ sơ lưu trú
DROP POLICY IF EXISTS "Staff manage stay guests" ON public.stay_guests;
CREATE POLICY "Staff manage stay guests" ON public.stay_guests
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.get_user_role() IN ('owner', 'admin', 'reception')
    );

-- Kế toán bị chặn truy cập giấy tờ tùy thân của khách lưu trú
-- (Chỉ được xem bảng payments và cash_transactions)

-- 6.2 Quyền bảng thu chi: Kế toán và Chủ cơ sở
DROP POLICY IF EXISTS "Accountant and Owner full cash transactions" ON public.cash_transactions;
CREATE POLICY "Accountant and Owner full cash transactions" ON public.cash_transactions
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.get_user_role() IN ('owner', 'admin', 'accountant')
    );

-- 6.3 Quyền bảng quy tắc giá & audit:
DROP POLICY IF EXISTS "Public read active seasonal price rules" ON public.seasonal_price_rules;
CREATE POLICY "Public read active seasonal price rules" ON public.seasonal_price_rules
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Only Owner modify seasonal price rules" ON public.seasonal_price_rules;
CREATE POLICY "Only Owner modify seasonal price rules" ON public.seasonal_price_rules
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.get_user_role() IN ('owner', 'admin')
    );
