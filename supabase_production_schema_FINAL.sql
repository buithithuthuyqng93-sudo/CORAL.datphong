-- ==============================================================================
-- SEAGULL LÝ SƠN — SEAGULL COFFEE & HOMESTAY LÝ SƠN
-- PRODUCTION DATABASE SCHEMA (CONSOLIDATED & IDEMPOTENT - FINAL)
-- ==============================================================================
-- File: supabase_production_schema_FINAL.sql
-- Mục đích: File SQL DUY NHẤT cần chạy trong Supabase SQL Editor cho một project
--           Supabase PostgreSQL mới (hoặc chạy lại an toàn - Idempotent 100%).
-- Quy mô:   27 phòng kinh doanh giai đoạn 1 (Cụm Home 1–4) + 5 phòng giai đoạn 2
--           (Cụm Home 5 - đang thi công, active = FALSE). Tổng quy hoạch: 32 phòng.
-- Múi giờ:  Asia/Ho_Chi_Minh (+07:00)
--
-- Khắc phục toàn bộ bất nhất từ 7 file migration cũ trong supabase/migrations/:
--   1. Đúng thứ tự phụ thuộc: Extensions -> Enums -> Helper Functions -> Tables ->
--      Exclusion Constraints -> Indexes -> RPC Functions -> Triggers -> RLS -> Seed.
--   2. Không tạo hàm trong schema `auth` (tránh lỗi permission denied trên Supabase
--      SQL Editor); thay bằng `public.get_user_role()` an toàn.
--   3. Sửa lỗi policy `bookings` cũ dùng enum không tồn tại ('pending', 'draft')
--      -> chuẩn hóa sang `status = 'pending_payment'`.
--   4. Loại bỏ lỗ hổng `USING (true)` và lỗ hổng `anon` đọc toàn bộ `bookings`.
--   5. Bổ sung đầy đủ RLS cho 4 vai trò: Owner / Reception / Accountant / Public
--      (kèm `service_role` cho Backend API & Webhook SePay).
--   6. Gia cố PostgreSQL EXCLUDE USING gist chống trùng đặt phòng & khóa phòng.
--   7. Khớp 100% với code backend (`api/lib/bookingService.ts`, `api/sepay.ts`,
--      `api/admin.ts`, `api/media.ts`, `api/lib/supabaseServer.ts`) và dữ liệu
--      27 phòng giai đoạn 1 (`src/data/mockData.ts`).
-- ==============================================================================

-- ==============================================================================
-- PHẦN 0: KÍCH HOẠT EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ==============================================================================
-- PHẦN 1: ENUM TYPES (IDEMPOTENT)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE public.room_status_enum AS ENUM (
        'available',
        'held',
        'occupied',
        'cleaning',
        'maintenance',
        'inactive'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.booking_status_enum AS ENUM (
        'pending_payment',
        'payment_review',
        'deposit_paid',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled',
        'refunded',
        'expired'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Đảm bảo giá trị 'payment_review' tồn tại nếu nâng cấp từ DB cũ
DO $$ BEGIN
    ALTER TYPE public.booking_status_enum ADD VALUE IF NOT EXISTS 'payment_review';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.booking_channel_enum AS ENUM (
        'direct',
        'booking.com',
        'agoda',
        'pms_manual'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- PHẦN 2: HELPER FUNCTIONS (ĐẶT TRONG SCHEMA public ĐỂ CHẠY AN TOÀN TRÊN SUPABASE)
-- ==============================================================================

-- Trigger function tự động cập nhật cột updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- ==============================================================================
-- PHẦN 3: KHỞI TẠO TOÀN BỘ BẢNG THEO ĐÚNG THỨ TỰ PHỤ THUỘC
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 3.1 CẤU HÌNH HỆ THỐNG & PHÂN QUYỀN
-- ------------------------------------------------------------------------------

-- Bảng cấu hình cơ sở lưu trú (Kiểm tra kết nối live bởi api/lib/supabaseServer.ts)
CREATE TABLE IF NOT EXISTS public.homestay_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'seagull_main',
    property_name VARCHAR(255) NOT NULL DEFAULT 'SEAGULL LÝ SƠN',
    tagline VARCHAR(255) NOT NULL DEFAULT 'Seagull Coffee & Homestay Lý Sơn',
    slogan VARCHAR(255) NOT NULL DEFAULT 'Nơi chữa lành tâm hồn bạn.',
    address TEXT NOT NULL DEFAULT 'Thôn Đông An Vĩnh, Đặc khu Lý Sơn, Tỉnh Quảng Ngãi (Thửa 432, Tờ bản đồ số 27)',
    google_maps_url TEXT DEFAULT 'https://maps.app.goo.gl/yaYH56pM37VPbjnv7',
    hotline VARCHAR(100) NOT NULL DEFAULT '0868011799 - 0981065065',
    zalo VARCHAR(100) NOT NULL DEFAULT '0868011799 - 0981065065',
    email VARCHAR(255) NOT NULL DEFAULT 'seagulllyson@gmail.com',
    check_in_time VARCHAR(10) NOT NULL DEFAULT '14:00',
    check_out_time VARCHAR(10) NOT NULL DEFAULT '12:00',
    deposit_percentage INT NOT NULL DEFAULT 30 CHECK (deposit_percentage BETWEEN 0 AND 100),
    booking_hold_minutes INT NOT NULL DEFAULT 15 CHECK (booking_hold_minutes > 0),
    cancellation_policy TEXT DEFAULT 'Hủy trước 7 ngày: Miễn phí hoàn 100% tiền cọc. Hủy trước 3 - 6 ngày: Hoàn 50% cọc hoặc bảo lưu 6 tháng. Hủy trong vòng 48h hoặc do tàu cao tốc dừng do thời tiết/bão: Hỗ trợ dời ngày lưu trú miễn phí.',
    bank_account JSONB NOT NULL DEFAULT '{"bankName": "MB Bank", "bankBin": "970422", "accountNumber": "0868011799", "accountName": "SEAGULL HOMESTAY - BUI THI THU THUY"}'::jsonb,
    sepay_config JSONB NOT NULL DEFAULT '{"enabled": true, "webhookConfigured": false}'::jsonb,
    social_links JSONB NOT NULL DEFAULT '{"facebook": "https://facebook.com/seagull.lyson.homestay", "zalo": "https://zalo.me/0868011799", "googleMaps": "https://maps.app.goo.gl/yaYH56pM37VPbjnv7"}'::jsonb,
    updated_by VARCHAR(100) DEFAULT 'owner',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng cấu hình key-value bổ sung
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng phân quyền & tài khoản nhân sự PMS (mỗi nhân sự 1 tài khoản riêng, mật khẩu hash scrypt)
-- Vai trò chuẩn: 'owner', 'reception', 'accountant', 'housekeeping', 'coffee_staff'
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- Liên kết tùy chọn tới auth.users(id)
    username VARCHAR(100),    -- Tên đăng nhập riêng từng nhân sự (lowercase, duy nhất)
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'reception',
    password_hash TEXT,       -- Mật khẩu hash scrypt (KHÔNG lưu plaintext)
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_email_role UNIQUE (email, role)
);

-- Đảm bảo các cột tài khoản nhân sự tồn tại nếu nâng cấp từ DB đã tạo trước đó
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

-- Hàm xác định vai trò người dùng hiện tại cho RLS (ưu tiên service_role -> JWT app_metadata -> bảng user_roles -> JWT role -> anon)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claims JSONB;
    v_jwt_role TEXT;
    v_app_role TEXT;
    v_email TEXT;
    v_db_role TEXT;
BEGIN
    BEGIN
        v_claims := NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_claims := NULL;
    END;

    IF v_claims IS NULL THEN
        RETURN 'anon';
    END IF;

    v_jwt_role := COALESCE(v_claims->>'role', 'anon');
    IF v_jwt_role = 'service_role' THEN
        RETURN 'service_role';
    END IF;

    -- 1. Ưu tiên đọc role trong JWT app_metadata (do Supabase Admin set)
    v_app_role := LOWER(TRIM(COALESCE(v_claims->'app_metadata'->>'role', '')));
    IF v_app_role <> '' THEN
        IF v_app_role = 'receptionist' THEN
            RETURN 'reception';
        END IF;
        RETURN v_app_role;
    END IF;

    -- 2. Fallback: tra cứu theo email đã xác thực trong bảng public.user_roles
    v_email := LOWER(TRIM(COALESCE(v_claims->>'email', '')));
    IF v_jwt_role = 'authenticated' AND v_email <> '' THEN
        SELECT LOWER(TRIM(ur.role))
        INTO v_db_role
        FROM public.user_roles ur
        WHERE LOWER(ur.email) = v_email
          AND ur.is_active = TRUE
        ORDER BY CASE LOWER(ur.role)
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'accountant' THEN 3
            WHEN 'reception' THEN 4
            WHEN 'receptionist' THEN 4
            ELSE 5
        END
        LIMIT 1;

        IF v_db_role IS NOT NULL AND v_db_role <> '' THEN
            IF v_db_role = 'receptionist' THEN
                RETURN 'reception';
            END IF;
            RETURN v_db_role;
        END IF;
    END IF;

    RETURN v_jwt_role;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3.2 LOẠI PHÒNG, DANH SÁCH PHÒNG, GIÁ PHÒNG & KHÓA PHÒNG
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.room_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    capacity_adults INT NOT NULL DEFAULT 2,
    capacity_children INT NOT NULL DEFAULT 1,
    base_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (base_price >= 0),
    deposit_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed'
    deposit_value DECIMAL(12, 2) NOT NULL DEFAULT 30.00,
    size_sqm VARCHAR(50) DEFAULT '21m²',
    bed_type VARCHAR(100) DEFAULT '1 Giường King Mái Vòm',
    amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
    image VARCHAR(500),
    gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rooms (
    id VARCHAR(50) PRIMARY KEY,
    room_type_id VARCHAR(50) NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
    room_code VARCHAR(50) UNIQUE NOT NULL, -- VD: '101'..'107', '201'..'206', '301'..'308', '401'..'406'
    room_name VARCHAR(120) NOT NULL,
    floor_or_area INT NOT NULL DEFAULT 1,
    area_label VARCHAR(150),
    status public.room_status_enum NOT NULL DEFAULT 'available',
    housekeeping_status VARCHAR(20) NOT NULL DEFAULT 'clean', -- 'clean' | 'dirty' | 'cleaning' | 'inspect'
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS area_label VARCHAR(150);

CREATE TABLE IF NOT EXISTS public.room_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_type_id VARCHAR(50) NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
    rate_name VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_night DECIMAL(12, 2) NOT NULL CHECK (price_per_night >= 0),
    weekend_surcharge DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_rate_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.seasonal_price_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    room_type_id VARCHAR(50) NOT NULL, -- 'all' hoặc room_types.id
    room_type_name VARCHAR(255) DEFAULT 'Tất cả loại phòng',
    adjustment_type VARCHAR(50) NOT NULL DEFAULT 'percentage', -- 'fixed_price' | 'percentage'
    adjustment_value DECIMAL(12, 2) NOT NULL,
    note TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_seasonal_rule_dates CHECK (end_date >= start_date)
);

ALTER TABLE public.seasonal_price_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Lịch khóa phòng bảo trì / chặn phòng (BẮT BUỘC tạo trước các ràng buộc Exclusion và RPC)
CREATE TABLE IF NOT EXISTS public.room_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(50) NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL DEFAULT 'Bảo trì phòng',
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_room_block_dates CHECK (end_date > start_date)
);

ALTER TABLE public.room_blocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Nếu DB cũ dùng constraint check_block_dates (end_date >= start_date), chuẩn hóa sang end_date > start_date
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_block_dates') THEN
        ALTER TABLE public.room_blocks DROP CONSTRAINT check_block_dates;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_room_block_dates') THEN
        ALTER TABLE public.room_blocks ADD CONSTRAINT check_room_block_dates CHECK (end_date > start_date);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3.3 KHÁCH HÀNG (CRM & GUESTS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    total_stays INT NOT NULL DEFAULT 0,
    total_spent DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    last_stay_date DATE,
    tier VARCHAR(50) NOT NULL DEFAULT 'new', -- 'new' | 'regular' | 'vip' | 'flagged'
    notes TEXT,
    zalo_contact VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_customer_phone UNIQUE (phone)
);

CREATE TABLE IF NOT EXISTS public.guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    identity_note VARCHAR(255),
    special_request TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3.4 ĐƠN ĐẶT PHÒNG, GIỮ CHỖ 15 PHÚT, PHÂN BỔ PHÒNG & THANH TOÁN
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    temporary_order_code VARCHAR(50) UNIQUE NOT NULL, -- VD: SGL-261120-A8K4
    confirmation_code VARCHAR(50) UNIQUE,              -- VD: CFM-SEAGULL-8921
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50) NOT NULL,
    guest_email VARCHAR(255),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    number_of_nights INT NOT NULL CHECK (number_of_nights > 0),
    adults INT NOT NULL DEFAULT 1 CHECK (adults > 0),
    children INT NOT NULL DEFAULT 0 CHECK (children >= 0),
    assigned_room_id VARCHAR(50) REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_type_id VARCHAR(50) REFERENCES public.room_types(id) ON DELETE SET NULL,
    room_type_name VARCHAR(255),
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    surcharge_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    required_payment_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status public.booking_status_enum NOT NULL DEFAULT 'pending_payment',
    hold_expires_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    source public.booking_channel_enum NOT NULL DEFAULT 'direct',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_booking_dates CHECK (check_out_date > check_in_date)
);

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.booking_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    room_id VARCHAR(50) REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_type_id VARCHAR(50) REFERENCES public.room_types(id) ON DELETE SET NULL,
    nightly_price DECIMAL(12, 2) NOT NULL,
    number_of_nights INT NOT NULL DEFAULT 1,
    line_total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    room_type_id VARCHAR(50) NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
    room_id VARCHAR(50) REFERENCES public.rooms(id) ON DELETE SET NULL,
    hold_token VARCHAR(100) UNIQUE NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' | 'confirmed' | 'expired' | 'released'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_hold_dates CHECK (check_out_date > check_in_date)
);

CREATE TABLE IF NOT EXISTS public.booking_room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    room_id VARCHAR(50) NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    allocated_by VARCHAR(100) DEFAULT 'system', -- 'system' | 'owner' | 'reception'
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    CONSTRAINT check_allocation_dates CHECK (check_out_date > check_in_date)
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'sepay_vietqr', -- 'sepay_vietqr' | 'cash' | 'bank_transfer'
    provider_transaction_id VARCHAR(255) UNIQUE,
    transfer_content TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'completed', -- 'completed' | 'partial' | 'refunded'
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL DEFAULT 'sepay',
    event_key VARCHAR(255) UNIQUE NOT NULL, -- Khóa idempotency từ SePay transaction ID
    signature VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'processed', -- 'processed' | 'flagged_review' | 'failed' | 'ignored'
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    provider_transaction_id VARCHAR(100),
    event_type VARCHAR(100) NOT NULL, -- 'webhook_received' | 'verified' | 'idempotency_duplicate' | 'confirmed' | 'underpaid' | 'review_required'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'processed',
    error_message TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sổ quỹ thu chi Homestay & Cà phê (chỉ Owner và Accountant được truy cập)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    category VARCHAR(50) NOT NULL, -- 'deposit', 'room_balance', 'cafe_beverage', 'bike_rental', 'supplies', 'utilities', 'staff_salary', 'other'
    amount DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
    title VARCHAR(255) NOT NULL,
    booking_code VARCHAR(50),
    performed_by VARCHAR(100) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'vietqr', -- 'vietqr' | 'cash' | 'card' | 'bank_transfer'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3.5 CHECK-IN 3 BƯỚC & KHAI BÁO LƯU TRÚ (TUÂN THỦ NĐ 13/2023 - KHÔNG LƯU ẢNH CCCD)
-- ------------------------------------------------------------------------------

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
    overall_check_in_status VARCHAR(50) NOT NULL DEFAULT 'not_checked_in', -- 'not_checked_in' | 'partially_checked_in' | 'fully_checked_in' | 'checked_out'
    overall_declaration_status VARCHAR(50) NOT NULL DEFAULT 'unprocessed',  -- 'unprocessed' | 'in_progress' | 'awaiting_verification' | 'verified_completed' | 'needs_revision'
    attention_required BOOLEAN NOT NULL DEFAULT FALSE,
    attention_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_booking_stay_code UNIQUE (booking_code)
);

CREATE TABLE IF NOT EXISTS public.stay_guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_record_id UUID NOT NULL REFERENCES public.booking_stay_records(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    birth_year INT,
    gender VARCHAR(20) DEFAULT 'male', -- 'male' | 'female' | 'other'
    nationality VARCHAR(50) NOT NULL DEFAULT 'VN', -- 'VN' | 'FOREIGN'
    nationality_name VARCHAR(100) DEFAULT 'Việt Nam',
    assigned_room_id VARCHAR(50) REFERENCES public.rooms(id) ON DELETE SET NULL,
    assigned_room_number VARCHAR(50) NOT NULL,
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    document_type_verified VARCHAR(50), -- 'physical_cccd' | 'passport' | 'vneid_app' | 'birth_certificate'
    is_document_checked BOOLEAN NOT NULL DEFAULT FALSE,
    checked_by_staff VARCHAR(100),
    checked_at TIMESTAMPTZ,
    document_notes TEXT,
    declaration_status VARCHAR(50) NOT NULL DEFAULT 'unprocessed', -- 'unprocessed' | 'in_progress' | 'awaiting_verification' | 'verified_completed' | 'needs_revision'
    declaration_reference_code VARCHAR(100), -- Tùy chọn do nhân viên nhập thủ công sau khi khai báo trên Cổng TBLT KBTT
    declaration_verified_by VARCHAR(100),
    declaration_verified_at TIMESTAMPTZ,
    declaration_notes TEXT,
    verification_basis VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.stay_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_record_id UUID NOT NULL REFERENCES public.booking_stay_records(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    staff_name VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3.6 BUỒNG PHÒNG, NHẬT KÝ EMAIL / GOOGLE SHEETS & AUDIT LOGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(50) NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL DEFAULT 'checkout_clean', -- 'daily_clean' | 'checkout_clean' | 'deep_clean' | 'inspect'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',          -- 'pending' | 'in_progress' | 'completed'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',          -- 'low' | 'medium' | 'high' | 'urgent'
    assigned_to VARCHAR(150),
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    template_type VARCHAR(100) NOT NULL, -- 'confirmation' | 'resend_confirmation' | 'payment_received' | 'cancellation'
    send_status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent' | 'failed' | 'pending'
    provider_message_id VARCHAR(255),
    error_message TEXT,
    attempt_count INT NOT NULL DEFAULT 1,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(300) NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    send_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed' | 'retrying'
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sheet_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL DEFAULT 'booking_upsert', -- 'booking_upsert' | 'payment_received' | 'manual_resync'
    sync_status VARCHAR(50) NOT NULL DEFAULT 'synced',       -- 'synced' | 'failed'
    sheet_row_reference VARCHAR(100),
    attempt_count INT NOT NULL DEFAULT 1,
    error_message TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id VARCHAR(100),
    actor_type VARCHAR(50) DEFAULT 'user', -- 'user' | 'admin' | 'owner' | 'webhook' | 'cron'
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    previous_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- ------------------------------------------------------------------------------
-- 3.7 QUẢN LÝ MEDIA & NỘI DUNG WEBSITE (DÙNG BỞI api/media.ts)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'site-media',
    storage_path VARCHAR(500) NOT NULL,
    public_url TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    width INT,
    height INT,
    alt_text TEXT DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    entity_type VARCHAR(100) DEFAULT 'general',
    entity_id VARCHAR(100) DEFAULT '',
    display_order INT DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by VARCHAR(255) DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_key VARCHAR(150) UNIQUE NOT NULL,
    content_type VARCHAR(50) NOT NULL DEFAULT 'image', -- 'image' | 'text' | 'json'
    media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    text_value TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by VARCHAR(255) DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_key VARCHAR(150) NOT NULL,
    previous_media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    new_media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    changed_by VARCHAR(255) DEFAULT 'owner',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- PHẦN 4: RÀNG BUỘC EXCLUSION CHỐNG TRÙNG ĐẶT PHÒNG & KHÓA PHÒNG (GIST)
-- ==============================================================================

-- 4.1 Loại bỏ UNIQUE tuple cũ trên booking_room_allocations (không chặn được lệch ngày)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_room_allocation_slot') THEN
        ALTER TABLE public.booking_room_allocations DROP CONSTRAINT unique_room_allocation_slot;
    END IF;
END $$;

-- 4.2 Chặn tuyệt đối 2 phân bổ phòng trùng khoảng ngày [check_in_date, check_out_date)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exclude_overlapping_room_allocations') THEN
        ALTER TABLE public.booking_room_allocations
        ADD CONSTRAINT exclude_overlapping_room_allocations
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(check_in_date, check_out_date, '[)') WITH &&
        );
    END IF;
END $$;

-- 4.3 Chặn tuyệt đối 2 lịch khóa phòng trùng khoảng ngày [start_date, end_date)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exclude_overlapping_room_blocks') THEN
        ALTER TABLE public.room_blocks
        ADD CONSTRAINT exclude_overlapping_room_blocks
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(start_date, end_date, '[)') WITH &&
        );
    END IF;
END $$;

-- 4.4 Chặn tuyệt đối 2 booking ĐÃ XÁC NHẬN/CỌC/CHECK-IN trùng phòng & khoảng ngày
-- (Partial exclusion: không ảnh hưởng các đơn đã hủy/hết hạn, nhưng khóa cứng mọi đơn có hiệu lực)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exclude_overlapping_active_bookings') THEN
        ALTER TABLE public.bookings
        ADD CONSTRAINT exclude_overlapping_active_bookings
        EXCLUDE USING gist (
            assigned_room_id WITH =,
            daterange(check_in_date, check_out_date, '[)') WITH &&
        )
        WHERE (
            assigned_room_id IS NOT NULL
            AND status IN ('deposit_paid', 'confirmed', 'checked_in')
        );
    END IF;
END $$;

-- ==============================================================================
-- PHẦN 5: INDEXES HIỆU NĂNG CAO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON public.user_roles(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_username_unique ON public.user_roles(LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_type_active ON public.rooms(room_type_id, active, status);
CREATE INDEX IF NOT EXISTS idx_room_rates_type_dates ON public.room_rates(room_type_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_room_blocks_room_dates ON public.room_blocks(room_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_dates_status ON public.bookings(check_in_date, check_out_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_room_status ON public.bookings(assigned_room_id, status, hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_bookings_temp_code ON public.bookings(temporary_order_code);
CREATE INDEX IF NOT EXISTS idx_bookings_confirm_code ON public.bookings(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_phone ON public.bookings(guest_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email ON public.bookings(guest_email);
CREATE INDEX IF NOT EXISTS idx_booking_holds_active ON public.booking_holds(room_type_id, expires_at, status);
CREATE INDEX IF NOT EXISTS idx_booking_holds_booking ON public.booking_holds(booking_id);
CREATE INDEX IF NOT EXISTS idx_allocations_room_dates ON public.booking_room_allocations(room_id, check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_key ON public.webhook_events(event_key);
CREATE INDEX IF NOT EXISTS idx_payment_events_tx ON public.payment_events(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_booking ON public.payment_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON public.payment_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON public.cash_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(transaction_type, category);
CREATE INDEX IF NOT EXISTS idx_stay_records_code ON public.booking_stay_records(booking_code);
CREATE INDEX IF NOT EXISTS idx_stay_records_attention ON public.booking_stay_records(attention_required);
CREATE INDEX IF NOT EXISTS idx_stay_guests_record ON public.stay_guests(stay_record_id);
CREATE INDEX IF NOT EXISTS idx_stay_guests_status ON public.stay_guests(declaration_status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_room ON public.housekeeping_tasks(room_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON public.email_notifications(send_status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON public.media_assets(category, active);
CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON public.media_assets(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_site_content_key ON public.site_content(content_key);

-- ==============================================================================
-- PHẦN 6: RPC FUNCTIONS NGHIỆP VỤ (LOCK ROOM 15 PHÚT, EXPIRE HOLDS, BLOCK ROOM)
-- ==============================================================================

-- 6.1 ATOMIC RPC: Kiểm tra phòng trống & khóa giữ phòng 15 phút
-- Khớp 100% tham số & kết quả trả về trong api/lib/bookingService.ts
CREATE OR REPLACE FUNCTION public.fn_check_and_hold_room(
    p_room_type_id VARCHAR(50),
    p_check_in DATE,
    p_check_out DATE,
    p_guest_name VARCHAR(255),
    p_guest_phone VARCHAR(50),
    p_guest_email VARCHAR(255),
    p_adults INT,
    p_children INT,
    p_temp_code VARCHAR(50),
    p_total_price DECIMAL(12, 2),
    p_deposit_amount DECIMAL(12, 2),
    p_hold_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room RECORD;
    v_room_type_name VARCHAR(255);
    v_booking_id UUID;
    v_hold_expires TIMESTAMPTZ;
    v_nights INT;
    v_req_range DATERANGE;
BEGIN
    v_nights := p_check_out - p_check_in;
    IF v_nights <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm'
        );
    END IF;

    v_req_range := daterange(p_check_in, p_check_out, '[)');

    -- Kiểm tra hạng phòng hợp lệ & đang mở bán
    SELECT rt.name INTO v_room_type_name
    FROM public.room_types rt
    WHERE rt.id = p_room_type_id
      AND rt.active = TRUE;

    IF v_room_type_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Hạng phòng không tồn tại hoặc đang tạm ngưng mở bán'
        );
    END IF;

    -- Khóa giao dịch theo hạng phòng để chống race condition khi nhiều khách đặt cùng mili-giây
    PERFORM pg_advisory_xact_lock(hashtext('hold_room_type_' || p_room_type_id));

    -- Dọn nhanh tại chỗ các lượt giữ chỗ đã quá hạn (dựa trên cả hold_expires_at lẫn created_at + p_hold_minutes)
    -- Không phụ thuộc cron chạy hàng ngày
    UPDATE public.booking_holds
    SET status = 'expired',
        updated_at = NOW()
    WHERE room_type_id = p_room_type_id
      AND status = 'active'
      AND (
          expires_at <= NOW()
          OR created_at + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15))) <= NOW()
      );

    UPDATE public.bookings
    SET status = 'expired',
        updated_at = NOW()
    WHERE room_type_id = p_room_type_id
      AND status = 'pending_payment'
      AND (
          (hold_expires_at IS NOT NULL AND hold_expires_at <= NOW())
          OR created_at + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15))) <= NOW()
      );

    -- Tìm 1 phòng trống hợp lệ (tự động loại trừ mọi booking_holds / pending_payment đã hết hạn ngay tại thời điểm truy vấn)
    SELECT r.* INTO v_room
    FROM public.rooms r
    WHERE r.room_type_id = p_room_type_id
      AND r.active = TRUE
      AND r.status NOT IN ('maintenance', 'inactive')
      AND NOT EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.assigned_room_id = r.id
            AND b.status IN ('pending_payment', 'payment_review', 'deposit_paid', 'confirmed', 'checked_in')
            AND (
                b.status <> 'pending_payment'
                OR (
                    COALESCE(b.hold_expires_at, b.created_at + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15)))) > NOW()
                    AND b.created_at + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15))) > NOW()
                )
            )
            AND daterange(b.check_in_date, b.check_out_date, '[)') && v_req_range
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.booking_holds bh
          WHERE bh.room_id = r.id
            AND bh.status = 'active'
            AND bh.expires_at > NOW()
            AND bh.created_at + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15))) > NOW()
            AND daterange(bh.check_in_date, bh.check_out_date, '[)') && v_req_range
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.booking_room_allocations bra
          LEFT JOIN public.bookings b_alloc ON b_alloc.id = bra.booking_id
          WHERE bra.room_id = r.id
            AND (
                b_alloc.id IS NULL
                OR (
                    b_alloc.status NOT IN ('cancelled', 'expired')
                    AND (
                        b_alloc.status <> 'pending_payment'
                        OR (
                            COALESCE(b_alloc.hold_expires_at, b_alloc.created_at + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15)))) > NOW()
                            AND b_alloc.created_at + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15))) > NOW()
                        )
                    )
                )
            )
            AND daterange(bra.check_in_date, bra.check_out_date, '[)') && v_req_range
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.room_blocks rb
          WHERE rb.room_id = r.id
            AND daterange(rb.start_date, rb.end_date, '[)') && v_req_range
      )
    ORDER BY r.room_code ASC
    LIMIT 1
    FOR UPDATE OF r;

    IF v_room.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Hết phòng trống cho hạng phòng này trong khoảng ngày đã chọn'
        );
    END IF;

    v_hold_expires := NOW() + make_interval(mins => GREATEST(1, COALESCE(p_hold_minutes, 15)));

    -- Tạo đơn đặt phòng nháp ở trạng thái pending_payment
    INSERT INTO public.bookings (
        temporary_order_code,
        guest_name,
        guest_phone,
        guest_email,
        check_in_date,
        check_out_date,
        number_of_nights,
        adults,
        children,
        assigned_room_id,
        room_type_id,
        room_type_name,
        subtotal,
        total_amount,
        required_payment_amount,
        remaining_amount,
        status,
        hold_expires_at,
        source
    ) VALUES (
        p_temp_code,
        p_guest_name,
        p_guest_phone,
        NULLIF(TRIM(COALESCE(p_guest_email, '')), ''),
        p_check_in,
        p_check_out,
        v_nights,
        GREATEST(1, COALESCE(p_adults, 2)),
        GREATEST(0, COALESCE(p_children, 0)),
        v_room.id,
        p_room_type_id,
        v_room_type_name,
        p_total_price,
        p_total_price,
        p_deposit_amount,
        GREATEST(0, p_total_price - p_deposit_amount),
        'pending_payment',
        v_hold_expires,
        'direct'
    )
    RETURNING id INTO v_booking_id;

    -- Ghi nhận đồng bộ bản ghi giữ chỗ 15 phút vào bảng booking_holds
    INSERT INTO public.booking_holds (
        booking_id,
        room_type_id,
        room_id,
        hold_token,
        check_in_date,
        check_out_date,
        expires_at,
        status
    ) VALUES (
        v_booking_id,
        p_room_type_id,
        v_room.id,
        'HOLD-' || p_temp_code,
        p_check_in,
        p_check_out,
        v_hold_expires,
        'active'
    )
    ON CONFLICT (hold_token) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'assigned_room_id', v_room.id,
        'room_number', v_room.room_code,
        'hold_expires_at', v_hold_expires
    );
END;
$$;

-- 6.2 RPC: Dọn dẹp định kỳ các lượt giữ phòng hết hạn 15 phút (Cron hàng ngày 03:00 giờ VN / 20:00 UTC)
-- Lưu ý: Việc nhả phòng trống không phụ thuộc hàm này; fn_check_and_hold_room và /api/availability
-- đã tự động loại trừ các hold có expires_at <= NOW() hoặc created_at + 15 phút <= NOW() ngay tại thời điểm truy vấn.
CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_holds()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    UPDATE public.booking_holds
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'active'
      AND (
          expires_at <= NOW()
          OR created_at + INTERVAL '15 minutes' <= NOW()
      );

    UPDATE public.bookings
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'pending_payment'
      AND (
          (hold_expires_at IS NOT NULL AND hold_expires_at <= NOW())
          OR created_at + INTERVAL '15 minutes' <= NOW()
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 6.3 RPC: Khóa phòng an toàn (chặn khi phòng đang có khách hoặc có đơn đặt/phân bổ)
CREATE OR REPLACE FUNCTION public.fn_admin_block_room(
    p_room_id VARCHAR(50),
    p_start_date DATE,
    p_end_date DATE,
    p_reason TEXT,
    p_created_by VARCHAR(100) DEFAULT 'owner'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conflict_booking RECORD;
    v_conflict_alloc RECORD;
    v_req_range DATERANGE;
BEGIN
    IF p_end_date <= p_start_date THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ngày kết thúc khóa phòng phải sau ngày bắt đầu'
        );
    END IF;

    v_req_range := daterange(p_start_date, p_end_date, '[)');

    PERFORM pg_advisory_xact_lock(hashtext('block_room_' || p_room_id));

    -- Kiểm tra xung đột trên bảng bookings
    SELECT b.id, b.temporary_order_code, b.guest_name, b.status
    INTO v_conflict_booking
    FROM public.bookings b
    WHERE b.assigned_room_id = p_room_id
      AND b.status IN ('checked_in', 'confirmed', 'deposit_paid', 'payment_review')
      AND daterange(b.check_in_date, b.check_out_date, '[)') && v_req_range
    LIMIT 1;

    IF v_conflict_booking.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Không thể khóa phòng: Đang có khách ' || v_conflict_booking.guest_name ||
                       ' (Đơn ' || v_conflict_booking.temporary_order_code ||
                       ', trạng thái: ' || v_conflict_booking.status || ') trong khoảng ngày này.'
        );
    END IF;

    -- Kiểm tra xung đột trên bảng booking_room_allocations
    SELECT bra.id, bra.booking_id
    INTO v_conflict_alloc
    FROM public.booking_room_allocations bra
    WHERE bra.room_id = p_room_id
      AND daterange(bra.check_in_date, bra.check_out_date, '[)') && v_req_range
    LIMIT 1;

    IF v_conflict_alloc.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Không thể khóa phòng: Phòng đã được phân bổ cho đơn đặt phòng trong khoảng ngày này.'
        );
    END IF;

    INSERT INTO public.room_blocks (
        room_id,
        start_date,
        end_date,
        reason,
        created_by
    ) VALUES (
        p_room_id,
        p_start_date,
        p_end_date,
        COALESCE(NULLIF(TRIM(p_reason), ''), 'Bảo trì phòng'),
        COALESCE(NULLIF(TRIM(p_created_by), ''), 'owner')
    );

    RETURN jsonb_build_object('success', true, 'message', 'Đã khóa phòng thành công');
EXCEPTION
    WHEN exclusion_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Khoảng ngày khóa phòng bị trùng với một lịch khóa phòng đã tồn tại.'
        );
END;
$$;

-- ==============================================================================
-- PHẦN 7: TRIGGERS TỰ ĐỘNG CẬP NHẬT updated_at (IDEMPOTENT)
-- ==============================================================================
DO $$
DECLARE
    t TEXT;
    tables_with_updated_at TEXT[] := ARRAY[
        'homestay_settings',
        'system_settings',
        'user_roles',
        'room_types',
        'rooms',
        'room_rates',
        'seasonal_price_rules',
        'room_blocks',
        'customers',
        'guests',
        'bookings',
        'booking_holds',
        'booking_stay_records',
        'stay_guests',
        'housekeeping_tasks',
        'media_assets',
        'site_content'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_updated_at LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            t, t
        );
    END LOOP;
END $$;

-- ==============================================================================
-- PHẦN 8: ROW LEVEL SECURITY (RLS) THEO 4 VAI TRÒ:
--         OWNER | RECEPTION | ACCOUNTANT | PUBLIC (+ SERVICE_ROLE)
-- ==============================================================================

-- Bật RLS trên TẤT CẢ các bảng
ALTER TABLE public.homestay_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_stay_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_transfer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_history ENABLE ROW LEVEL SECURITY;

-- Dọn sạch các policy cũ (nếu có) để loại bỏ lỗ hổng USING (true) & đảm bảo idempotent 100%
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 8.1 HOMESTAY_SETTINGS & SYSTEM_SETTINGS
--     Public/Staff: Chỉ đọc thông tin chung | Owner/Service Role: Toàn quyền
-- ------------------------------------------------------------------------------
CREATE POLICY "homestay_settings_public_read"
    ON public.homestay_settings FOR SELECT
    USING (TRUE);

CREATE POLICY "homestay_settings_owner_write"
    ON public.homestay_settings FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "system_settings_owner_all"
    ON public.system_settings FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

-- ------------------------------------------------------------------------------
-- 8.2 USER_ROLES (Chỉ Owner / Service Role quản lý; user tự xem dòng của mình)
-- ------------------------------------------------------------------------------
CREATE POLICY "user_roles_owner_all"
    ON public.user_roles FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "user_roles_self_read"
    ON public.user_roles FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', ''))
    );

-- ------------------------------------------------------------------------------
-- 8.3 ROOM_TYPES, ROOMS, ROOM_RATES, SEASONAL_PRICE_RULES
--     Public: Đọc phòng/giá đang mở bán
--     Reception: Đọc tất cả + cập nhật trạng thái/dọn phòng của `rooms` (không sửa giá)
--     Accountant: Chỉ đọc để đối chiếu doanh thu
--     Owner: Toàn quyền
-- ------------------------------------------------------------------------------
CREATE POLICY "room_types_public_read_active"
    ON public.room_types FOR SELECT
    USING (active = TRUE OR public.get_user_role() IN ('owner', 'admin', 'reception', 'accountant', 'housekeeping', 'service_role'));

CREATE POLICY "room_types_owner_write"
    ON public.room_types FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "rooms_public_and_staff_read"
    ON public.rooms FOR SELECT
    USING (active = TRUE OR public.get_user_role() IN ('owner', 'admin', 'reception', 'accountant', 'housekeeping', 'service_role'));

CREATE POLICY "rooms_owner_all"
    ON public.rooms FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "rooms_reception_update_status"
    ON public.rooms FOR UPDATE
    USING (public.get_user_role() IN ('reception', 'housekeeping'))
    WITH CHECK (public.get_user_role() IN ('reception', 'housekeeping'));

CREATE POLICY "room_rates_public_read_active"
    ON public.room_rates FOR SELECT
    USING (is_active = TRUE OR public.get_user_role() IN ('owner', 'admin', 'reception', 'accountant', 'service_role'));

CREATE POLICY "room_rates_owner_write"
    ON public.room_rates FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "seasonal_price_rules_public_read_active"
    ON public.seasonal_price_rules FOR SELECT
    USING (is_active = TRUE OR public.get_user_role() IN ('owner', 'admin', 'reception', 'accountant', 'service_role'));

CREATE POLICY "seasonal_price_rules_owner_write"
    ON public.seasonal_price_rules FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

-- ------------------------------------------------------------------------------
-- 8.4 ROOM_BLOCKS (Khóa phòng bảo trì)
--     Owner: Toàn quyền | Reception: Đọc & Tạo/Sửa lịch chặn | Accountant/Public: Không sửa
-- ------------------------------------------------------------------------------
CREATE POLICY "room_blocks_owner_all"
    ON public.room_blocks FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "room_blocks_reception_manage"
    ON public.room_blocks FOR SELECT
    USING (public.get_user_role() IN ('reception', 'accountant', 'housekeeping'));

CREATE POLICY "room_blocks_reception_insert"
    ON public.room_blocks FOR INSERT
    WITH CHECK (public.get_user_role() IN ('reception'));

CREATE POLICY "room_blocks_reception_update"
    ON public.room_blocks FOR UPDATE
    USING (public.get_user_role() IN ('reception'))
    WITH CHECK (public.get_user_role() IN ('reception'));

-- ------------------------------------------------------------------------------
-- 8.5 CUSTOMERS & GUESTS (Bảo vệ PII - Chặn hoàn toàn Public & Accountant)
-- ------------------------------------------------------------------------------
CREATE POLICY "customers_owner_all"
    ON public.customers FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "customers_reception_read_write"
    ON public.customers FOR SELECT
    USING (public.get_user_role() = 'reception');

CREATE POLICY "customers_reception_insert"
    ON public.customers FOR INSERT
    WITH CHECK (public.get_user_role() = 'reception');

CREATE POLICY "customers_reception_update"
    ON public.customers FOR UPDATE
    USING (public.get_user_role() = 'reception')
    WITH CHECK (public.get_user_role() = 'reception');

CREATE POLICY "guests_owner_all"
    ON public.guests FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "guests_reception_read_write"
    ON public.guests FOR SELECT
    USING (public.get_user_role() = 'reception');

CREATE POLICY "guests_reception_insert"
    ON public.guests FOR INSERT
    WITH CHECK (public.get_user_role() = 'reception');

CREATE POLICY "guests_reception_update"
    ON public.guests FOR UPDATE
    USING (public.get_user_role() = 'reception')
    WITH CHECK (public.get_user_role() = 'reception');

-- ------------------------------------------------------------------------------
-- 8.6 BOOKINGS, BOOKING_ROOMS, BOOKING_HOLDS, BOOKING_ROOM_ALLOCATIONS
--     Public: Chỉ được tạo đơn nháp (status = 'pending_payment'); KHÔNG được đọc danh sách đơn
--     (Tra cứu đơn khách thực hiện qua Backend API /api/bookings/lookup xác thực cả mã + SĐT/Email)
--     Reception: Đọc & cập nhật nhận/trả phòng; KHÔNG được xóa/hủy đơn đã cọc
--     Accountant: Chỉ đọc để đối soát công nợ & doanh thu
--     Owner/Service Role: Toàn quyền
-- ------------------------------------------------------------------------------
CREATE POLICY "bookings_public_create_draft"
    ON public.bookings FOR INSERT
    WITH CHECK (
        status = 'pending_payment'
        AND source = 'direct'
    );

CREATE POLICY "bookings_owner_all"
    ON public.bookings FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "bookings_staff_read"
    ON public.bookings FOR SELECT
    USING (public.get_user_role() IN ('reception', 'accountant', 'housekeeping'));

-- Lễ tân được cập nhật check-in/check-out nhưng không được đổi sang cancelled/refunded trên đơn đã cọc
CREATE POLICY "bookings_reception_update_stay"
    ON public.bookings FOR UPDATE
    USING (public.get_user_role() = 'reception')
    WITH CHECK (
        public.get_user_role() = 'reception'
        AND status NOT IN ('cancelled', 'refunded')
    );

CREATE POLICY "booking_rooms_owner_all"
    ON public.booking_rooms FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "booking_rooms_staff_read"
    ON public.booking_rooms FOR SELECT
    USING (public.get_user_role() IN ('reception', 'accountant'));

CREATE POLICY "booking_holds_owner_all"
    ON public.booking_holds FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "booking_holds_reception_read"
    ON public.booking_holds FOR SELECT
    USING (public.get_user_role() IN ('reception', 'accountant'));

CREATE POLICY "allocations_owner_all"
    ON public.booking_room_allocations FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "allocations_reception_read"
    ON public.booking_room_allocations FOR SELECT
    USING (public.get_user_role() IN ('reception', 'accountant', 'housekeeping'));

CREATE POLICY "allocations_reception_insert"
    ON public.booking_room_allocations FOR INSERT
    WITH CHECK (public.get_user_role() = 'reception');

CREATE POLICY "allocations_reception_update"
    ON public.booking_room_allocations FOR UPDATE
    USING (public.get_user_role() = 'reception')
    WITH CHECK (public.get_user_role() = 'reception');

-- ------------------------------------------------------------------------------
-- 8.7 TÀI CHÍNH: CASH_TRANSACTIONS, PAYMENTS, WEBHOOK_EVENTS, PAYMENT_EVENTS
--     Cash Transactions: Chỉ Owner & Accountant (chặn tuyệt đối Reception & Public)
--     Webhook Events: Chỉ Service Role & Owner (chống giả mạo giao dịch VietQR)
--     Payments: Owner toàn quyền; Accountant chỉ đọc; Reception không xem sổ tài chính chi tiết
-- ------------------------------------------------------------------------------
CREATE POLICY "cash_transactions_owner_all"
    ON public.cash_transactions FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "cash_transactions_accountant_read"
    ON public.cash_transactions FOR SELECT
    USING (public.get_user_role() = 'accountant');

CREATE POLICY "cash_transactions_accountant_insert"
    ON public.cash_transactions FOR INSERT
    WITH CHECK (public.get_user_role() = 'accountant');

CREATE POLICY "cash_transactions_accountant_update"
    ON public.cash_transactions FOR UPDATE
    USING (public.get_user_role() = 'accountant')
    WITH CHECK (public.get_user_role() = 'accountant');

CREATE POLICY "payments_owner_all"
    ON public.payments FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "payments_accountant_read"
    ON public.payments FOR SELECT
    USING (public.get_user_role() = 'accountant');

CREATE POLICY "webhook_events_owner_service_only"
    ON public.webhook_events FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "payment_events_owner_all"
    ON public.payment_events FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "payment_events_accountant_read"
    ON public.payment_events FOR SELECT
    USING (public.get_user_role() = 'accountant');

-- ------------------------------------------------------------------------------
-- 8.8 CHECK-IN & LƯU TRÚ (Chỉ Owner & Reception; chặn tuyệt đối Public & Accountant)
-- ------------------------------------------------------------------------------
CREATE POLICY "stay_records_owner_reception_all"
    ON public.booking_stay_records FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'));

CREATE POLICY "stay_guests_owner_reception_all"
    ON public.stay_guests FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'));

CREATE POLICY "room_transfer_owner_reception_all"
    ON public.room_transfer_history FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'));

CREATE POLICY "stay_audit_logs_owner_reception_read_insert"
    ON public.stay_audit_logs FOR SELECT
    USING (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'));

CREATE POLICY "stay_audit_logs_owner_reception_insert"
    ON public.stay_audit_logs FOR INSERT
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'reception', 'service_role'));

-- ------------------------------------------------------------------------------
-- 8.9 BUỒNG PHÒNG, LOGS & AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE POLICY "housekeeping_owner_reception_all"
    ON public.housekeeping_tasks FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'reception', 'housekeeping', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'reception', 'housekeeping', 'service_role'));

CREATE POLICY "email_logs_owner_service_all"
    ON public.email_logs FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "email_logs_reception_read"
    ON public.email_logs FOR SELECT
    USING (public.get_user_role() = 'reception');

CREATE POLICY "email_notifications_owner_service_all"
    ON public.email_notifications FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "sheet_sync_logs_owner_service_all"
    ON public.sheet_sync_logs FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "sheet_sync_logs_staff_read"
    ON public.sheet_sync_logs FOR SELECT
    USING (public.get_user_role() IN ('reception', 'accountant'));

CREATE POLICY "audit_logs_owner_service_all"
    ON public.audit_logs FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "audit_logs_accountant_read"
    ON public.audit_logs FOR SELECT
    USING (public.get_user_role() = 'accountant');

CREATE POLICY "price_audit_logs_owner_service_all"
    ON public.price_audit_logs FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "price_audit_logs_accountant_read"
    ON public.price_audit_logs FOR SELECT
    USING (public.get_user_role() = 'accountant');

CREATE POLICY "bank_audit_logs_owner_service_all"
    ON public.bank_audit_logs FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "bank_audit_logs_accountant_read"
    ON public.bank_audit_logs FOR SELECT
    USING (public.get_user_role() = 'accountant');

-- ------------------------------------------------------------------------------
-- 8.10 MEDIA MANAGER & SUPABASE STORAGE BUCKET (site-media)
-- ------------------------------------------------------------------------------
CREATE POLICY "media_assets_public_read_active"
    ON public.media_assets FOR SELECT
    USING (active = TRUE OR public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "media_assets_owner_write"
    ON public.media_assets FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "site_content_public_read"
    ON public.site_content FOR SELECT
    USING (TRUE);

CREATE POLICY "site_content_owner_write"
    ON public.site_content FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

CREATE POLICY "media_history_owner_all"
    ON public.media_history FOR ALL
    USING (public.get_user_role() IN ('owner', 'admin', 'service_role'))
    WITH CHECK (public.get_user_role() IN ('owner', 'admin', 'service_role'));

-- Khởi tạo Storage Bucket 'site-media' (Public Read, giới hạn 8MB, chỉ cho ảnh)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'site-media',
    'site-media',
    TRUE,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

DROP POLICY IF EXISTS "Public Read Site Media Storage" ON storage.objects;
DROP POLICY IF EXISTS "Admin Insert Site Media Storage" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Site Media Storage" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Site Media Storage" ON storage.objects;
DROP POLICY IF EXISTS "site_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "site_media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "site_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "site_media_owner_delete" ON storage.objects;

CREATE POLICY "site_media_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'site-media');

CREATE POLICY "site_media_owner_insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'site-media'
        AND public.get_user_role() IN ('owner', 'admin', 'service_role')
    );

CREATE POLICY "site_media_owner_update"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'site-media'
        AND public.get_user_role() IN ('owner', 'admin', 'service_role')
    );

CREATE POLICY "site_media_owner_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'site-media'
        AND public.get_user_role() IN ('owner', 'admin', 'service_role')
    );

-- ==============================================================================
-- PHẦN 9: SEED DỮ LIỆU CHUẨN PRODUCTION (SEAGULL LÝ SƠN — 27 PHÒNG GIAI ĐOẠN 1)
--         (Idempotent với ON CONFLICT DO UPDATE / DO NOTHING)
-- ==============================================================================

-- 9.1 Thông tin cơ sở lưu trú mặc định
INSERT INTO public.homestay_settings (
    id,
    property_name,
    tagline,
    slogan,
    address,
    google_maps_url,
    hotline,
    zalo,
    email,
    check_in_time,
    check_out_time,
    deposit_percentage,
    booking_hold_minutes
)
VALUES (
    'seagull_main',
    'SEAGULL LÝ SƠN',
    'Seagull Coffee & Homestay Lý Sơn',
    'Nơi chữa lành tâm hồn bạn.',
    'Thôn Đông An Vĩnh, Đặc khu Lý Sơn, Tỉnh Quảng Ngãi (Thửa 432, Tờ bản đồ số 27)',
    'https://maps.app.goo.gl/yaYH56pM37VPbjnv7',
    '0868011799 - 0981065065',
    '0868011799 - 0981065065',
    'seagulllyson@gmail.com',
    '14:00',
    '12:00',
    30,
    15
)
ON CONFLICT (id) DO NOTHING;

-- 9.2 Danh sách 6 hạng phòng chuẩn (khớp 100% với src/data/mockData.ts)
INSERT INTO public.room_types (
    id, name, slug, description, capacity_adults, capacity_children,
    base_price, deposit_type, deposit_value, size_sqm, bed_type,
    image, gallery_images, amenities, active
)
VALUES
(
    'type-home1-single',
    'Bungalow Vòm Ocean View (Cụm Home 1)',
    'bungalow-vom-ocean-view-home-1',
    'Bungalow mái vòm trệt nép mình bên vách đá bazan, kính tràn viền hướng thẳng mặt biển An Vĩnh. Diện tích sử dụng 21m².',
    2, 1, 650000.00, 'percentage', 30.00, '21m²', '1 Giường King Mái Vòm',
    '/images/bungalow-cliff-day.jpg',
    '["/images/bungalow-cliff-day.jpg", "/images/bungalow-row-sunset.jpg", "/images/bungalow-bedroom-twin.jpg"]'::jsonb,
    '["Ban công riêng 4m² view biển", "WC 5m² sen tắm đứng cao cấp", "Wifi tốc độ cao", "Điều hòa 2 chiều", "Tủ lạnh mini & Ấm siêu tốc", "Miễn phí xe đón cảng Lý Sơn"]'::jsonb,
    TRUE
),
(
    'type-home1-vip',
    'VIP Cliffside Bồn Tắm Nằm & Sky Terrace (P.101)',
    'vip-cliffside-bon-tam-sky-terrace-101',
    'Căn vòm VIP duy nhất tại Cụm 1 sở hữu bồn tắm nằm sát vách kính ngắm biển và Sân thượng trên mái (Sky Terrace) 4m² ngắm hoàng hôn 360 độ.',
    2, 1, 950000.00, 'percentage', 30.00, '22m² (+ Sân thượng 4m²)', '1 Giường King Panorama',
    '/assets/bungalow-harbor-view.png',
    '["/assets/bungalow-harbor-view.png", "/images/bungalow-bathtub-ocean.jpg", "/images/bungalow-cliff-day.jpg"]'::jsonb,
    '["Bồn tắm nằm (Bathtub) view biển", "Sân thượng ngắm biển trên nóc vòm (Sky Terrace) 4m²", "Ban công riêng 4m²", "WC 6m² ốp PVC vân đá cao cấp", "Máy sấy tóc & Đồ skincare", "Smart TV 55 inch", "Miễn phí đón cảng"]'::jsonb,
    TRUE
),
(
    'type-home2-sunset',
    'Bungalow Vòm Sunset 2 Tầng (Cụm Home 2)',
    'bungalow-vom-sunset-2-tang-home-2',
    'Căn bungalow khối 2 tầng mái vòm bazan ngắm trọn vầng hoàng hôn buông xuống biển Tây Lý Sơn. Tầng 2 có hành lang sau ngắm cảnh rộng 18m².',
    2, 1, 750000.00, 'percentage', 30.00, '20m²', '1 Giường King hoặc 2 Giường Đơn',
    '/images/bungalow-row-sunset.jpg',
    '["/images/bungalow-row-sunset.jpg", "/images/bungalow-cliff-day.jpg", "/images/bungalow-bedroom-twin.jpg"]'::jsonb,
    '["Ban công ngắm hoàng hôn", "Hành lang ngắm cảnh sau 18m² (Tầng 2)", "WC 3m² khép kín sen cây", "Điều hòa 2 chiều", "Nội thất gỗ mây cao cấp"]'::jsonb,
    TRUE
),
(
    'type-home3-panorama',
    'Bungalow Vòm Panorama 2 Tầng (Cụm Home 3)',
    'bungalow-vom-panorama-2-tang-home-3',
    'Căn bungalow khối 2 tầng 8 vòm nép mình vách núi đá trầm tích triệu năm, ban công trước thoáng đãng và hành lang sau rộng 24m².',
    2, 1, 850000.00, 'percentage', 30.00, '20m²', '1 Giường King lớn',
    '/images/bungalow-bedroom-twin.jpg',
    '["/images/bungalow-bedroom-twin.jpg", "/images/bungalow-sunset-front.jpg", "/images/bungalow-row-sunset.jpg"]'::jsonb,
    '["Ban công đón gió biển vách núi", "Hành lang ngắm cảnh sau 24m² (Tầng 2)", "WC 3m² riêng biệt", "Smart TV 55 inch", "Trà & Cà phê Seagull miễn phí"]'::jsonb,
    TRUE
),
(
    'type-home4-cafe',
    'Phòng Lầu Nóc Cafe Seagull View Biển (Cụm Home 4)',
    'phong-lau-noc-cafe-seagull-home-4',
    'Phòng lưu trú tầng 2 phía trên không gian Seagull Coffee & Sunset Bar, ban công riêng nhìn trực diện mặt biển An Vĩnh.',
    2, 1, 700000.00, 'percentage', 30.00, '19m²', '1 Giường King Lớn',
    '/images/bungalow-cliff-day.jpg',
    '["/images/bungalow-cliff-day.jpg", "/images/bungalow-row-sunset.jpg", "/images/bungalow-bedroom-twin.jpg"]'::jsonb,
    '["Ban công lầu view trực diện biển An Vĩnh", "Trên lầu không gian Seagull Coffee & Sunset Bar", "WC 4m² khép kín sen tắm đứng cao cấp", "Điều hòa 2 chiều & Smart TV", "Trà & Cà phê Seagull miễn phí", "Miễn phí xe đón cảng Sa Kỳ - Lý Sơn"]'::jsonb,
    TRUE
),
(
    'type-home5-heritage',
    'Khu Nghỉ Dưỡng Cải Tạo (Home 5 - GĐ2)',
    'khu-nghi-duong-cai-tao-home-5',
    'Dãy phòng cải tạo trệt với sân vườn, khu giặt sấy 18m² và sảnh sinh hoạt chung. Đang hoàn thiện thi công giai đoạn 2.',
    4, 2, 600000.00, 'percentage', 30.00, '18m² - 24m²', '2 Giường Đôi Gia Đình',
    '/images/bungalow-sunset-front.jpg',
    '["/images/bungalow-sunset-front.jpg"]'::jsonb,
    '["Sân vườn & Sảnh chung", "Khu giặt phơi 18m²", "WC riêng từng phòng", "Đang hoàn thiện thi công"]'::jsonb,
    FALSE
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_price = EXCLUDED.base_price,
    deposit_value = EXCLUDED.deposit_value,
    size_sqm = EXCLUDED.size_sqm,
    bed_type = EXCLUDED.bed_type,
    image = EXCLUDED.image,
    gallery_images = EXCLUDED.gallery_images,
    amenities = EXCLUDED.amenities,
    active = EXCLUDED.active,
    updated_at = NOW();

-- 9.3 Danh sách 32 phòng quy hoạch: 27 phòng mở bán giai đoạn 1 (active=TRUE) + 5 phòng giai đoạn 2 (active=FALSE)
INSERT INTO public.rooms (
    id, room_type_id, room_code, room_name, floor_or_area, area_label, status, housekeeping_status, active, notes
)
VALUES
-- CỤM HOME 1: 7 phòng mở bán giai đoạn 1 (101 VIP + 102..107 Vòm Trệt)
('rm-101', 'type-home1-vip',    '101', 'VIP Cliffside Bathtub 101', 1, 'Cụm Home 1 - Căn VIP Bồn Tắm & Sân Thượng', 'available', 'clean', TRUE, 'Bồn tắm nằm view biển & Cầu thang lên Sân thượng Sky Terrace trên mái 4m²'),
('rm-102', 'type-home1-single', '102', 'Ocean View Vòm 102',        1, 'Cụm Home 1 - Vòm Trệt View Biển',            'available', 'clean', TRUE, 'Bungalow vòm trệt view biển An Vĩnh'),
('rm-103', 'type-home1-single', '103', 'Ocean View Vòm 103',        1, 'Cụm Home 1 - Vòm Trệt View Biển',            'available', 'clean', TRUE, 'Bungalow vòm trệt view biển An Vĩnh'),
('rm-104', 'type-home1-single', '104', 'Ocean View Vòm 104',        1, 'Cụm Home 1 - Vòm Trệt View Biển',            'available', 'clean', TRUE, 'Bungalow vòm trệt view biển An Vĩnh'),
('rm-105', 'type-home1-single', '105', 'Ocean View Vòm 105',        1, 'Cụm Home 1 - Vòm Trệt View Biển',            'available', 'clean', TRUE, 'Bungalow vòm trệt view biển An Vĩnh'),
('rm-106', 'type-home1-single', '106', 'Ocean View Vòm 106',        1, 'Cụm Home 1 - Vòm Trệt View Biển',            'available', 'clean', TRUE, 'Bungalow vòm trệt view biển An Vĩnh'),
('rm-107', 'type-home1-single', '107', 'Ocean View Vòm 107',        1, 'Cụm Home 1 - Vòm Trệt View Biển',            'available', 'clean', TRUE, 'Bungalow vòm trệt view biển An Vĩnh (Mở bán giai đoạn đầu)'),

-- CỤM HOME 2: 6 phòng mở bán giai đoạn 1 (201..206)
('rm-201', 'type-home2-sunset', '201', 'Sunset Vòm 201', 1, 'Cụm Home 2 - Tầng 1 Sunset',                    'available', 'clean', TRUE, 'Tầng 1 Cụm 2'),
('rm-202', 'type-home2-sunset', '202', 'Sunset Vòm 202', 1, 'Cụm Home 2 - Tầng 1 Sunset',                    'available', 'clean', TRUE, 'Tầng 1 Cụm 2'),
('rm-203', 'type-home2-sunset', '203', 'Sunset Vòm 203', 1, 'Cụm Home 2 - Tầng 1 Sunset',                    'available', 'clean', TRUE, 'Tầng 1 Cụm 2'),
('rm-204', 'type-home2-sunset', '204', 'Sunset Vòm 204', 2, 'Cụm Home 2 - Tầng 2 Sunset (Hành Lang 18m²)',   'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 18m²'),
('rm-205', 'type-home2-sunset', '205', 'Sunset Vòm 205', 2, 'Cụm Home 2 - Tầng 2 Sunset (Hành Lang 18m²)',   'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 18m²'),
('rm-206', 'type-home2-sunset', '206', 'Sunset Vòm 206', 2, 'Cụm Home 2 - Tầng 2 Sunset (Hành Lang 18m²)',   'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 18m²'),

-- CỤM HOME 3: 8 phòng mở bán giai đoạn 1 (301..308)
('rm-301', 'type-home3-panorama', '301', 'Panorama Vòm 301', 1, 'Cụm Home 3 - Tầng 1 Panorama',                  'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-302', 'type-home3-panorama', '302', 'Panorama Vòm 302', 1, 'Cụm Home 3 - Tầng 1 Panorama',                  'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-303', 'type-home3-panorama', '303', 'Panorama Vòm 303', 1, 'Cụm Home 3 - Tầng 1 Panorama',                  'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-304', 'type-home3-panorama', '304', 'Panorama Vòm 304', 1, 'Cụm Home 3 - Tầng 1 Panorama',                  'available', 'clean', TRUE, 'Tầng 1 Cụm 3'),
('rm-305', 'type-home3-panorama', '305', 'Panorama Vòm 305', 2, 'Cụm Home 3 - Tầng 2 Panorama (Hành Lang 24m²)', 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),
('rm-306', 'type-home3-panorama', '306', 'Panorama Vòm 306', 2, 'Cụm Home 3 - Tầng 2 Panorama (Hành Lang 24m²)', 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),
('rm-307', 'type-home3-panorama', '307', 'Panorama Vòm 307', 2, 'Cụm Home 3 - Tầng 2 Panorama (Hành Lang 24m²)', 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),
('rm-308', 'type-home3-panorama', '308', 'Panorama Vòm 308', 2, 'Cụm Home 3 - Tầng 2 Panorama (Hành Lang 24m²)', 'available', 'clean', TRUE, 'Tầng 2 Hành lang sau 24m²'),

-- CỤM HOME 4: 6 phòng mở bán giai đoạn 1 (401..406 - Lầu Nóc Cafe Seagull)
('rm-401', 'type-home4-cafe', '401', 'Lầu Nóc Cafe 401', 2, 'Cụm Home 4 - Tầng 2 Nóc Cafe Seagull', 'available', 'clean', TRUE, 'Ban công lầu view trực diện biển & Cafe Seagull'),
('rm-402', 'type-home4-cafe', '402', 'Lầu Nóc Cafe 402', 2, 'Cụm Home 4 - Tầng 2 Nóc Cafe Seagull', 'available', 'clean', TRUE, 'Ban công lầu view trực diện biển & Cafe Seagull'),
('rm-403', 'type-home4-cafe', '403', 'Lầu Nóc Cafe 403', 2, 'Cụm Home 4 - Tầng 2 Nóc Cafe Seagull', 'available', 'clean', TRUE, 'Ban công lầu view trực diện biển & Cafe Seagull'),
('rm-404', 'type-home4-cafe', '404', 'Lầu Nóc Cafe 404', 2, 'Cụm Home 4 - Tầng 2 Nóc Cafe Seagull', 'available', 'clean', TRUE, 'Ban công lầu view trực diện biển & Cafe Seagull'),
('rm-405', 'type-home4-cafe', '405', 'Lầu Nóc Cafe 405', 2, 'Cụm Home 4 - Tầng 2 Nóc Cafe Seagull', 'available', 'clean', TRUE, 'Ban công lầu view trực diện biển & Cafe Seagull'),
('rm-406', 'type-home4-cafe', '406', 'Lầu Nóc Cafe 406', 2, 'Cụm Home 4 - Tầng 2 Nóc Cafe Seagull', 'available', 'clean', TRUE, 'Ban công lầu view trực diện biển & Cafe Seagull'),

-- CỤM HOME 5: 5 phòng quy hoạch Giai đoạn 2 (Khóa thi công, active = FALSE)
('rm-501', 'type-home5-heritage', '501', 'Khu Cải Tạo 501', 1, 'Cụm Home 5 - Khu Cải Tạo Hiện Trạng', 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang hoàn thiện thi công theo quy hoạch 32 phòng'),
('rm-502', 'type-home5-heritage', '502', 'Khu Cải Tạo 502', 1, 'Cụm Home 5 - Khu Cải Tạo Hiện Trạng', 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang hoàn thiện thi công theo quy hoạch 32 phòng'),
('rm-503', 'type-home5-heritage', '503', 'Khu Cải Tạo 503', 1, 'Cụm Home 5 - Khu Cải Tạo Hiện Trạng', 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang hoàn thiện thi công theo quy hoạch 32 phòng'),
('rm-504', 'type-home5-heritage', '504', 'Khu Cải Tạo 504', 1, 'Cụm Home 5 - Khu Cải Tạo Hiện Trạng', 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang hoàn thiện thi công theo quy hoạch 32 phòng'),
('rm-505', 'type-home5-heritage', '505', 'Khu Cải Tạo 505', 1, 'Cụm Home 5 - Khu Cải Tạo Hiện Trạng', 'maintenance', 'clean', FALSE, 'Giai đoạn 2 - Đang hoàn thiện thi công theo quy hoạch 32 phòng')
ON CONFLICT (id) DO UPDATE SET
    room_type_id = EXCLUDED.room_type_id,
    room_code = EXCLUDED.room_code,
    room_name = EXCLUDED.room_name,
    floor_or_area = EXCLUDED.floor_or_area,
    area_label = EXCLUDED.area_label,
    active = EXCLUDED.active,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- 9.4 Nội dung Media mặc định của website (Đồng bộ thương hiệu SEAGULL LÝ SƠN)
INSERT INTO public.site_content (content_key, content_type, text_value, metadata)
VALUES
    ('homepage.hero.desktop',  'image', '/assets/seagull-hero.jpg',      '{"focalPoint": {"x": 50, "y": 50}, "altText": "Toàn cảnh Seagull Coffee & Homestay Lý Sơn"}'::jsonb),
    ('homepage.hero.mobile',   'image', '/assets/lyson-harbor-real.jpg', '{"focalPoint": {"x": 50, "y": 32}, "altText": "View thực tế bến cảng Lý Sơn từ Seagull Coffee"}'::jsonb),
    ('homepage.logo',          'image', '/assets/seagull-hero.jpg',      '{"altText": "Logo Seagull Coffee & Homestay Lý Sơn"}'::jsonb),
    ('homepage.about.image',   'image', '/images/bungalow-row-sunset.jpg','{"altText": "Dãy Bungalow Vòm Vách Núi Hoàng Hôn Seagull Lý Sơn"}'::jsonb),
    ('homepage.cafe.image',    'image', '/assets/lyson-harbor-real.jpg', '{"altText": "Không gian Seagull Coffee nhìn ra bến cảng Lý Sơn"}'::jsonb),
    ('homepage.location.image','image', '/assets/lyson-beach-sup-real.jpg','{"altText": "Bãi biển san hô & chèo SUP dưới chân đồi Seagull Lý Sơn"}'::jsonb)
ON CONFLICT (content_key) DO NOTHING;

-- 9.5 Nền tảng CMS dùng chung cho Phòng (room) & Dịch vụ (service)
ALTER TABLE public.room_types
    ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.cms_contents (
    id VARCHAR(64) PRIMARY KEY,
    content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('room', 'service')),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INT NOT NULL DEFAULT 100,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_contents_type_active
    ON public.cms_contents (content_type, active, sort_order);

ALTER TABLE public.cms_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_contents_public_read_active" ON public.cms_contents;
CREATE POLICY "cms_contents_public_read_active"
    ON public.cms_contents
    FOR SELECT
    USING (active = TRUE OR public.fn_current_user_role() = 'owner');

DROP POLICY IF EXISTS "cms_contents_owner_manage" ON public.cms_contents;
CREATE POLICY "cms_contents_owner_manage"
    ON public.cms_contents
    FOR ALL
    USING (public.fn_current_user_role() = 'owner')
    WITH CHECK (public.fn_current_user_role() = 'owner');

-- ==============================================================================
-- 11. BẢNG LIÊN HỆ KHÁCH HÀNG (TRANG /lien-he -> ADMIN /admin)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'done')),
    source VARCHAR(50) NOT NULL DEFAULT 'website_contact_page',
    handled_by VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
    ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created_at
    ON public.contact_messages (status, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on contact_messages" ON public.contact_messages;
CREATE POLICY "Service role full access on contact_messages"
    ON public.contact_messages
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ==============================================================================
-- HOÀN TẤT KHỞI TẠO SCHEMA PRODUCTION - SEAGULL LÝ SƠN (27 PHÒNG GĐ1 / 32 TỔNG)
-- ==============================================================================

