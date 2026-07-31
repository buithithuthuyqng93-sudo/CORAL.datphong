-- ====================================================================
-- HOMESTAY & CAFE CORAL LÝ SƠN - DATABASE INITIALIZATION SCHEMA
-- Target Database: Supabase PostgreSQL
-- Múi giờ mặc định: Asia/Ho_Chi_Minh (+07:00)
-- ====================================================================

-- Enable extension required for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. ENUM TYPES
-- --------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE room_status_enum AS ENUM ('available', 'held', 'occupied', 'cleaning', 'maintenance', 'inactive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE booking_status_enum AS ENUM ('pending_payment', 'deposit_paid', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'refunded', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE booking_channel_enum AS ENUM ('direct', 'booking.com', 'agoda', 'pms_manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- --------------------------------------------------------------------
-- 2. TABLE: room_types (Loại phòng)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    capacity_adults INT NOT NULL DEFAULT 2,
    capacity_children INT NOT NULL DEFAULT 1,
    base_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    deposit_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
    deposit_value DECIMAL(12, 2) NOT NULL DEFAULT 50.00, -- 50%
    size_sqm VARCHAR(50) DEFAULT '28m²',
    bed_type VARCHAR(100) DEFAULT '1 Giường King',
    amenities JSONB DEFAULT '[]'::jsonb,
    image VARCHAR(500),
    gallery_images JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 3. TABLE: rooms (Danh sách 15 căn bungalow)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
    id VARCHAR(50) PRIMARY KEY,
    room_type_id VARCHAR(50) NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
    room_code VARCHAR(50) UNIQUE NOT NULL, -- e.g. "101", "102"
    room_name VARCHAR(100) NOT NULL,
    floor_or_area INT NOT NULL DEFAULT 1,
    status room_status_enum NOT NULL DEFAULT 'available',
    housekeeping_status VARCHAR(20) DEFAULT 'clean',
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 4. TABLE: guests (Khách hàng)
-- --------------------------------------------------------------------
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

-- --------------------------------------------------------------------
-- 5. TABLE: bookings (Đơn đặt phòng)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    temporary_order_code VARCHAR(50) UNIQUE NOT NULL, -- Mã đơn tạm lúc khởi tạo e.g. CRL-260731-A8K4
    confirmation_code VARCHAR(50) UNIQUE,              -- Mã xác nhận sau khi nhận cọc thành công e.g. CFM-CORAL-8921
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50) NOT NULL,
    guest_email VARCHAR(255),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    number_of_nights INT NOT NULL CHECK (number_of_nights > 0),
    adults INT NOT NULL DEFAULT 1,
    children INT NOT NULL DEFAULT 0,
    assigned_room_id VARCHAR(50) REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_type_id VARCHAR(50) REFERENCES public.room_types(id) ON DELETE SET NULL,
    room_type_name VARCHAR(255),
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    surcharge_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    required_payment_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status booking_status_enum NOT NULL DEFAULT 'pending_payment',
    hold_expires_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    source booking_channel_enum NOT NULL DEFAULT 'direct',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_booking_dates CHECK (check_out_date > check_in_date)
);

-- --------------------------------------------------------------------
-- 6. TABLE: booking_rooms (Chi tiết phòng trong đơn)
-- --------------------------------------------------------------------
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

-- --------------------------------------------------------------------
-- 7. TABLE: payments (Lịch sử thanh toán & SePay)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'sepay_vietqr', -- sepay_vietqr | cash | bank_transfer
    provider_transaction_id VARCHAR(255) UNIQUE,         -- SePay transaction ID / Ref
    transfer_content TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'completed', -- completed | partial | refunded
    raw_payload JSONB DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 8. TABLE: webhook_events (Nhật ký SePay Webhook Idempotency)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL DEFAULT 'sepay',
    event_key VARCHAR(255) UNIQUE NOT NULL, -- SePay event ID / transaction ID
    signature VARCHAR(255),
    payload JSONB NOT NULL,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'processed', -- processed | failed | ignored
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 9. TABLE: room_blocks (Lịch khóa phòng bảo trì / chặn)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(50) NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_block_dates CHECK (end_date >= start_date)
);

-- --------------------------------------------------------------------
-- 10. TABLE: email_logs (Nhật ký gửi Gmail)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    template_type VARCHAR(100) NOT NULL, -- confirmation | payment_received | cancellation
    send_status VARCHAR(50) NOT NULL DEFAULT 'sent', -- sent | failed | pending
    provider_message_id VARCHAR(255),
    error_message TEXT,
    attempt_count INT NOT NULL DEFAULT 1,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 11. TABLE: sheet_sync_logs (Nhật ký sao lưu Google Sheets)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sheet_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL DEFAULT 'booking_upsert',
    sync_status VARCHAR(50) NOT NULL DEFAULT 'synced', -- synced | failed
    sheet_row_reference VARCHAR(100),
    attempt_count INT NOT NULL DEFAULT 1,
    error_message TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 12. TABLE: audit_logs & system_settings
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id VARCHAR(100),
    actor_type VARCHAR(50) DEFAULT 'user', -- user | admin | webhook | cron
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    previous_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- INDEXES FOR HIGH PERFORMANCE & FAST SEARCHING
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_dates_status ON public.bookings(check_in_date, check_out_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_temp_code ON public.bookings(temporary_order_code);
CREATE INDEX IF NOT EXISTS idx_bookings_confirm_code ON public.bookings(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_phone ON public.bookings(guest_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email ON public.bookings(guest_email);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_key ON public.webhook_events(event_key);
CREATE INDEX IF NOT EXISTS idx_room_blocks_dates ON public.room_blocks(room_id, start_date, end_date);

-- --------------------------------------------------------------------
-- ATOMIC ROOM AVAILABILITY & HOLD PROCEDURE (Chống đặt trùng phòng)
-- --------------------------------------------------------------------
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
AS $$
DECLARE
    v_room RECORD;
    v_booking_id UUID;
    v_hold_expires TIMESTAMPTZ;
    v_nights INT;
BEGIN
    v_nights := p_check_out - p_check_in;
    IF v_nights <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ngày trả phòng phải sau ngày nhận phòng');
    END IF;

    -- Lock room table for concurrency control within transaction
    PERFORM pg_advisory_xact_lock(hashtext(p_room_type_id || p_check_in::text || p_check_out::text));

    -- Find an available room of requested type without overlapping bookings or blocks
    SELECT r.* INTO v_room
    FROM public.rooms r
    WHERE r.room_type_id = p_room_type_id
      AND r.active = TRUE
      AND r.status != 'maintenance'
      -- No overlapping active booking
      AND NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.assigned_room_id = r.id
            AND b.status IN ('pending_payment', 'deposit_paid', 'confirmed', 'checked_in')
            AND (
                -- Non-expired pending holds or confirmed stays
                (b.status != 'pending_payment' OR b.hold_expires_at > NOW())
            )
            AND (b.check_in_date < p_check_out AND b.check_out_date > p_check_in)
      )
      -- No overlapping maintenance blocks
      AND NOT EXISTS (
          SELECT 1 FROM public.room_blocks rb
          WHERE rb.room_id = r.id
            AND (rb.start_date < p_check_out AND rb.end_date > p_check_in)
      )
    ORDER BY r.room_code ASC
    LIMIT 1
    FOR UPDATE OF r;

    IF v_room.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hết phòng trống cho loại phòng này trong thời gian đã chọn');
    END IF;

    v_hold_expires := NOW() + (p_hold_minutes || ' minutes')::INTERVAL;

    -- Insert draft booking
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
        p_guest_email,
        p_check_in,
        p_check_out,
        v_nights,
        p_adults,
        p_children,
        v_room.id,
        p_room_type_id,
        (SELECT name FROM public.room_types WHERE id = p_room_type_id),
        p_total_price,
        p_total_price,
        p_deposit_amount,
        p_total_price - p_deposit_amount,
        'pending_payment',
        v_hold_expires,
        'direct'
    )
    RETURNING id INTO v_booking_id;

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'assigned_room_id', v_room.id,
        'room_number', v_room.room_code,
        'hold_expires_at', v_hold_expires
    );
END;
$$;

-- --------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Public read-only access for active room types and active rooms
CREATE POLICY "Public read active room_types" ON public.room_types FOR SELECT USING (active = true);
CREATE POLICY "Public read active rooms" ON public.rooms FOR SELECT USING (active = true);

-- Service Role Full Privileges for API backend execution
CREATE POLICY "Service Role Full Access room_types" ON public.room_types USING (true);
CREATE POLICY "Service Role Full Access rooms" ON public.rooms USING (true);
CREATE POLICY "Service Role Full Access guests" ON public.guests USING (true);
CREATE POLICY "Service Role Full Access bookings" ON public.bookings USING (true);
CREATE POLICY "Service Role Full Access payments" ON public.payments USING (true);

-- --------------------------------------------------------------------
-- SEED INITIAL DATA FOR CORAL HOMESTAY (15 BUNGALOWS)
-- --------------------------------------------------------------------
INSERT INTO public.room_types (id, name, slug, description, capacity_adults, capacity_children, base_price, deposit_value, size_sqm, bed_type, image, amenities)
VALUES
('rt-cliffside', 'Bungalow Vòm Cliffside View Biển', 'bungalow-vom-cliffside-view-bien', 'Căn Bungalow vòm độc bản nằm sát vách đá bờ biển Lý Sơn, view trực diện đại dương 180 độ.', 2, 1, 650000.00, 50.00, '28m²', '1 Giường King Mái Vòm', '/images/bungalow-cliff-day.jpg', '["Wifi tốc độ cao", "Điều hòa 2 chiều", "Ban công view biển Cliffside", "Tủ lạnh mini", "Trà & Cà phê miễn phí"]'::jsonb),
('rt-panorama', 'Bungalow Vòm Bồn Tắm Panorama', 'bungalow-vom-bon-tam-panorama', 'Thiết kế cửa kính vòm lớn siêu lãng mạn, trang bị bồn tắm ngâm ngắm hoàng hôn biển Lý Sơn.', 2, 1, 850000.00, 50.00, '35m²', '1 Giường King Panorama', '/images/bungalow-bathtub-ocean.jpg', '["Bồn tắm nằm view biển", "Cửa vòm panorama", "Máy sấy tóc & Đồ skincare", "Smart TV 55 inch", "Nội thất gỗ mây cao cấp"]'::jsonb),
('rt-family', 'Bungalow Vòm Gia Đình (Family Twin)', 'bungalow-vom-gia-dinh-family-twin', 'Bungalow không gian rộng rãi cho nhóm bạn hoặc gia đình 4 người với 2 giường đôi cao cấp.', 4, 2, 1100000.00, 50.00, '48m²', '2 Giường Đôi Mái Vòm', '/images/bungalow-bedroom-twin.jpg', '["2 Giường đôi lớn", "Gương soi toàn thân", "Tủ lạnh & Bếp nhẹ", "Sân hiên hóng gió", "Máy giặt & sấy"]'::jsonb),
('rt-sunset', 'Bungalow Vòm Hoàng Hôn VIP Cliffside', 'bungalow-vom-hoang-hon-vip-cliffside', 'Vị trí ngắm hoàng hôn đẹp nhất Lý Sơn. Trang bị hệ thống âm thanh cao cấp & dịch vụ VIP đặc biệt.', 3, 1, 1350000.00, 50.00, '42m²', '1 Giường Super King + 1 Sofa bed', '/images/bungalow-sunset-front.jpg', '["Lối đi sân vườn riêng", "Đèn vàng ấm áp hoàng hôn", "Loa Bluetooth Harman Kardon", "Đồ pha cà phê thủ công", "Miễn phí ăn sáng đặc sản"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rooms (id, room_type_id, room_code, room_name, floor_or_area, status)
VALUES
('rm-101', 'rt-cliffside', '101', 'Cliffside Vòm 101', 1, 'available'),
('rm-102', 'rt-cliffside', '102', 'Cliffside Vòm 102', 1, 'available'),
('rm-103', 'rt-cliffside', '103', 'Cliffside Vòm 103', 1, 'available'),
('rm-104', 'rt-cliffside', '104', 'Cliffside Vòm 104', 1, 'available'),
('rm-105', 'rt-cliffside', '105', 'Cliffside Vòm 105', 1, 'available'),

('rm-201', 'rt-panorama', '201', 'Panorama Vòm 201', 2, 'available'),
('rm-202', 'rt-panorama', '202', 'Panorama Vòm 202', 2, 'available'),
('rm-203', 'rt-panorama', '203', 'Panorama Vòm 203', 2, 'available'),
('rm-204', 'rt-panorama', '204', 'Panorama Vòm 204', 2, 'available'),

('rm-301', 'rt-family', '301', 'Family Vòm 301', 1, 'available'),
('rm-302', 'rt-family', '302', 'Family Vòm 302', 1, 'available'),
('rm-303', 'rt-family', '303', 'Family Vòm 303', 1, 'available'),

('rm-401', 'rt-sunset', '401', 'Sunset VIP 401', 2, 'available'),
('rm-402', 'rt-sunset', '402', 'Sunset VIP 402', 2, 'available'),
('rm-403', 'rt-sunset', '403', 'Sunset VIP 403', 2, 'available')
ON CONFLICT (id) DO NOTHING;
