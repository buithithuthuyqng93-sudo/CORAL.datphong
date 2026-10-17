-- ====================================================================
-- SEAGULL LÝ SƠN — HOMESTAY & CÀ PHÊ
-- GIAI ĐOẠN 1: CHUẨN HÓA CƠ SỞ DỮ LIỆU & QUẢN TRỊ 20 PHÒNG AN TOÀN
-- Target Database: Supabase PostgreSQL
-- ====================================================================

-- 1. ADD 'payment_review' TO booking_status_enum
DO $$ BEGIN
    ALTER TYPE booking_status_enum ADD VALUE IF NOT EXISTS 'payment_review';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. TABLE: homestay_settings (Quản lý cấu hình thông tin Seagull Lý Sơn)
CREATE TABLE IF NOT EXISTS public.homestay_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'seagull_main',
    property_name VARCHAR(255) NOT NULL DEFAULT 'SEAGULL LÝ SƠN',
    tagline VARCHAR(255) NOT NULL DEFAULT 'Homestay & Cà Phê tại Đảo Lý Sơn',
    slogan VARCHAR(255) NOT NULL DEFAULT 'Nơi chữa lành tâm hồn bạn.',
    address TEXT NOT NULL DEFAULT 'Thôn Tây, An Vĩnh, Đảo Lý Sơn, Quảng Ngãi',
    google_maps_url TEXT DEFAULT 'https://maps.google.com/?q=Seagull+Homestay+Ly+Son',
    hotline VARCHAR(100) NOT NULL DEFAULT '0868011799 - 0981065065',
    zalo VARCHAR(100) NOT NULL DEFAULT '0868011799 - 0981065065',
    email VARCHAR(255) NOT NULL DEFAULT 'booking@seagulllyson.vn',
    check_in_time VARCHAR(10) NOT NULL DEFAULT '14:00',
    check_out_time VARCHAR(10) NOT NULL DEFAULT '12:00',
    deposit_percentage INT NOT NULL DEFAULT 30,
    booking_hold_minutes INT NOT NULL DEFAULT 15,
    cancellation_policy TEXT DEFAULT 'Miễn phí hủy trước 7 ngày. Hủy trong vòng 3-7 ngày hoàn 50% tiền cọc. Sau 3 ngày không hoàn cọc.',
    bank_account JSONB DEFAULT '{"bankName": "MB Bank", "accountNumber": "0868011799", "accountName": "SEAGULL HOMESTAY - BUI THI THU THUY"}'::jsonb,
    sepay_config JSONB DEFAULT '{"enabled": true, "webhookConfigured": true}'::jsonb,
    social_links JSONB DEFAULT '{"facebook": "https://facebook.com/seagull.lyson.homestay", "zalo": "https://zalo.me/0868011799"}'::jsonb,
    updated_by VARCHAR(100) DEFAULT 'admin',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default homestay settings if not present
INSERT INTO public.homestay_settings (id, property_name, tagline, slogan, address, hotline, zalo, email)
VALUES (
    'seagull_main',
    'SEAGULL LÝ SƠN',
    'Homestay & Cà Phê tại Đảo Lý Sơn',
    'Nơi chữa lành tâm hồn bạn.',
    'Thôn Tây, An Vĩnh, Đảo Lý Sơn, Tỉnh Quảng Ngãi',
    '0868011799 - 0981065065',
    '0868011799 - 0981065065',
    'booking@seagulllyson.vn'
)
ON CONFLICT (id) DO UPDATE SET
    property_name = EXCLUDED.property_name,
    slogan = EXCLUDED.slogan,
    tagline = EXCLUDED.tagline,
    updated_at = NOW();

-- 3. TABLE: room_rates (Bảng giá động theo ngày, mùa vụ hoặc ngày lễ)
CREATE TABLE IF NOT EXISTS public.room_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_type_id VARCHAR(50) NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
    rate_name VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_night DECIMAL(12, 2) NOT NULL,
    weekend_surcharge DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_rate_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_room_rates_type_dates ON public.room_rates(room_type_id, start_date, end_date);

-- 4. TABLE: booking_holds (Quản lý các lượt giữ chỗ tạm thời - hold an toàn)
CREATE TABLE IF NOT EXISTS public.booking_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    room_type_id VARCHAR(50) NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
    room_id VARCHAR(50) REFERENCES public.rooms(id) ON DELETE SET NULL,
    hold_token VARCHAR(100) UNIQUE NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'confirmed', 'expired', 'released'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_hold_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_holds_active ON public.booking_holds(room_type_id, expires_at, status);
CREATE INDEX IF NOT EXISTS idx_booking_holds_booking ON public.booking_holds(booking_id);

-- 5. TABLE: booking_room_allocations (Phân bổ phòng thực tế cho đơn đặt phòng)
CREATE TABLE IF NOT EXISTS public.booking_room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    room_id VARCHAR(50) NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    allocated_by VARCHAR(100) DEFAULT 'system', -- 'system' | 'staff_admin' | 'receptionist'
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    CONSTRAINT unique_room_allocation_slot UNIQUE (room_id, check_in_date, check_out_date)
);

CREATE INDEX IF NOT EXISTS idx_allocations_room_dates ON public.booking_room_allocations(room_id, check_in_date, check_out_date);

-- 6. TABLE: email_notifications (Hàng đợi gửi email Outbox Pattern có retry)
CREATE TABLE IF NOT EXISTS public.email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(300) NOT NULL,
    template_type VARCHAR(100) NOT NULL, -- 'booking_confirmation', 'payment_review_alert', 'cancellation'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    send_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'retrying'
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON public.email_notifications(send_status, scheduled_at);

-- 7. TABLE: housekeeping_tasks (Quản lý vệ sinh buồng phòng 20 phòng)
CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(50) NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL DEFAULT 'checkout_clean', -- 'daily_clean', 'checkout_clean', 'deep_clean', 'inspect'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',          -- 'pending', 'in_progress', 'completed'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',          -- 'low', 'medium', 'high', 'urgent'
    assigned_to VARCHAR(150),
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_housekeeping_room ON public.housekeeping_tasks(room_id, scheduled_date, status);

-- 8. TABLE: payment_events (Ghi nhận toàn bộ sự kiện webhook SePay, kiểm tra chữ ký & xử lý idempotent)
CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    provider_transaction_id VARCHAR(100),
    event_type VARCHAR(100) NOT NULL, -- 'webhook_received', 'verified', 'idempotency_duplicate', 'confirmed', 'underpaid', 'review_required'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'processed',
    error_message TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_tx ON public.payment_events(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_booking ON public.payment_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON public.payment_events(created_at);

-- 9. TABLE: user_roles (Phân quyền nhân viên: owner, manager, receptionist, housekeeping)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'receptionist', -- 'owner', 'manager', 'receptionist', 'housekeeping'
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_email_role UNIQUE (email, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_email ON public.user_roles(email);

-- 10. FUNCTION: fn_cleanup_expired_holds (Tự động giải phóng phòng khi hết hạn cọc)
CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_holds()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- 1. Update expired holds
    UPDATE public.booking_holds
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' AND expires_at < NOW();

    -- 2. Mark pending bookings as expired
    UPDATE public.bookings
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending_payment'
      AND hold_expires_at IS NOT NULL
      AND hold_expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.homestay_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active settings and rates
DO $$ BEGIN
    CREATE POLICY "Public read homestay settings" ON public.homestay_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read room rates" ON public.room_rates FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Service role / Admin full control
DO $$ BEGIN
    CREATE POLICY "Service full control homestay settings" ON public.homestay_settings FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service full control room rates" ON public.room_rates FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service full control booking holds" ON public.booking_holds FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service full control allocations" ON public.booking_room_allocations FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service full control email outbox" ON public.email_notifications FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service full control housekeeping" ON public.housekeeping_tasks FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service full control payment events" ON public.payment_events FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Service full control user roles" ON public.user_roles FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;
