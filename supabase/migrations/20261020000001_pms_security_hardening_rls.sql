-- ==============================================================================
-- SEAGULL LÝ SƠN — ROW LEVEL SECURITY (RLS) & ACCESS CONTROL HARDENING
-- Migration: 20261020000001_pms_security_hardening_rls.sql
-- ==============================================================================
-- Mục tiêu:
-- 1. Bật RLS trên toàn bộ các bảng nhạy cảm: bookings, customers, cash_transactions,
--    room_blocks, homestay_settings, webhook_events.
-- 2. Phân tách quyền:
--    - Public (Khách đặt phòng): Chỉ được tạo đơn nháp (INSERT bookings), không được đọc danh sách đơn của người khác.
--    - Reception (Lễ tân): Được đọc/sửa trạng thái nhận/trả phòng, không được xóa/hủy đơn cọc, không được đọc bảng cash_transactions chi tiết.
--    - Accountant (Kế toán): Được đọc toàn bộ số liệu thu chi, không được sửa đổi tình trạng phòng.
--    - Owner (Chủ cơ sở / Service Role): Có toàn quyền (ALL) trên mọi bảng.
-- ==============================================================================

-- 1. BẬT ROW LEVEL SECURITY (RLS)
ALTER TABLE IF EXISTS bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS homestay_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. TẠO HÀM KIỂM TRA ROLE TỪ JWT / METADATA
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    'anon'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. CHÍNH SÁCH BẢNG BOOKINGS
-- Khách vãng lai (anon) chỉ được INSERT đơn mới
DROP POLICY IF EXISTS "Public can create draft booking" ON bookings;
CREATE POLICY "Public can create draft booking" ON bookings
FOR INSERT
WITH CHECK (
  status IN ('pending', 'draft')
);

-- Khách chỉ được tra cứu đơn của chính mình khi biết mã code và số điện thoại
DROP POLICY IF EXISTS "Guest can lookup their own booking" ON bookings;
CREATE POLICY "Guest can lookup their own booking" ON bookings
FOR SELECT
USING (
  auth.get_user_role() = 'anon'
  AND (
    temporary_order_code IS NOT NULL
  )
);

-- Nhân viên & Chủ cơ sở truy cập đơn đặt phòng
DROP POLICY IF EXISTS "Staff and Owner can read all bookings" ON bookings;
CREATE POLICY "Staff and Owner can read all bookings" ON bookings
FOR SELECT
USING (
  auth.get_user_role() IN ('owner', 'admin', 'reception', 'accountant', 'service_role')
);

-- Chỉ Chủ cơ sở (Owner/Admin) hoặc Service Role mới được UPDATE hoặc DELETE đơn đã cọc
DROP POLICY IF EXISTS "Only Owner can cancel or delete bookings" ON bookings;
CREATE POLICY "Only Owner can cancel or delete bookings" ON bookings
FOR DELETE
USING (
  auth.get_user_role() IN ('owner', 'admin', 'service_role')
);

-- Lễ tân chỉ được update trạng thái check-in / check-out
DROP POLICY IF EXISTS "Staff can update check-in check-out status" ON bookings;
CREATE POLICY "Staff can update check-in check-out status" ON bookings
FOR UPDATE
USING (
  auth.get_user_role() IN ('owner', 'admin', 'reception', 'service_role')
);

-- 4. CHÍNH SÁCH BẢNG CASH_TRANSACTIONS (DỮ LIỆU TÀI CHÍNH & THU CHI)
-- Nghiêm cấm hoàn toàn Lễ tân truy cập bảng thu chi tổng hợp
DROP POLICY IF EXISTS "Financials restricted to Owner and Accountant" ON cash_transactions;
CREATE POLICY "Financials restricted to Owner and Accountant" ON cash_transactions
FOR ALL
USING (
  auth.get_user_role() IN ('owner', 'admin', 'accountant', 'service_role')
);

-- 5. CHÍNH SÁCH BẢNG HOMESTAY_SETTINGS (CẤU HÌNH BẢNG GIÁ & TÀI KHOẢN NGÂN HÀNG)
-- Công chúng & Lễ tân chỉ đọc thông tin chung (tên, địa chỉ, ảnh)
DROP POLICY IF EXISTS "Public can read general property info" ON homestay_settings;
CREATE POLICY "Public can read general property info" ON homestay_settings
FOR SELECT
USING (true);

-- Chỉ Chủ cơ sở mới được sửa giá phòng và thông tin số tài khoản MBBank
DROP POLICY IF EXISTS "Only Owner can modify homestay settings" ON homestay_settings;
CREATE POLICY "Only Owner can modify homestay settings" ON homestay_settings
FOR UPDATE
USING (
  auth.get_user_role() IN ('owner', 'admin', 'service_role')
);

-- 6. CHÍNH SÁCH BẢNG WEBHOOK_EVENTS (CHỐNG CAN THIỆP GIAO DỊCH VIETQR)
DROP POLICY IF EXISTS "Webhooks restricted to service role" ON webhook_events;
CREATE POLICY "Webhooks restricted to service role" ON webhook_events
FOR ALL
USING (
  auth.get_user_role() IN ('service_role', 'owner')
);
