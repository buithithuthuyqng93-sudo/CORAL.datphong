-- ====================================================================
-- SEAGULL LÝ SƠN — HOMESTAY & CÀ PHÊ
-- DRAFT MIGRATION: GIA CỐ CHỐNG BÁN TRÙNG PHÒNG VỚI POSTGRESQL EXCLUSION
-- Trạng thái: DỰ THẢO KIỂM THỬ (CHƯA CHẠY TRÊN PRODUCTION)
-- ====================================================================

-- 1. Bật Extension btree_gist để hỗ trợ so sánh toán tử '=' trên kiểu VARCHAR/UUID kết hợp Range
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Khắc phục lỗ hổng UNIQUE(room_id, check_in_date, check_out_date) trên bảng booking_room_allocations
DO $$ 
BEGIN
    -- Xóa constraint UNIQUE cũ (vì UNIQUE tuple không chặn được khoảng ngày chồng lấn lệch ngày)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_room_allocation_slot'
    ) THEN
        ALTER TABLE public.booking_room_allocations DROP CONSTRAINT unique_room_allocation_slot;
    END IF;
END $$;

-- 3. Bổ sung EXCLUSION CONSTRAINT ngăn chặn trùng khoảng ngày [check_in, check_out)
-- Sử dụng toán tử && (Overlaps) trên kiểu dữ liệu daterange
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'exclude_overlapping_room_allocations'
    ) THEN
        ALTER TABLE public.booking_room_allocations
        ADD CONSTRAINT exclude_overlapping_room_allocations
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(check_in_date, check_out_date, '[)') WITH &&
        );
    END IF;
END $$;

-- 4. Bổ sung EXCLUSION CONSTRAINT trên bảng room_blocks (Chặn trùng khoảng ngày khóa phòng)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'exclude_overlapping_room_blocks'
    ) THEN
        ALTER TABLE public.room_blocks
        ADD CONSTRAINT exclude_overlapping_room_blocks
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(start_date, end_date, '[)') WITH &&
        );
    END IF;
END $$;

-- 5. FUNCTION BẢO VỆ: fn_admin_block_room (Khóa phòng an toàn, chặn khi phòng đang có khách)
CREATE OR REPLACE FUNCTION public.fn_admin_block_room(
    p_room_id VARCHAR(50),
    p_start_date DATE,
    p_end_date DATE,
    p_reason TEXT,
    p_created_by VARCHAR(100) DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conflict_booking RECORD;
BEGIN
    IF p_end_date <= p_start_date THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ngày kết thúc khóa phòng phải sau ngày bắt đầu');
    END IF;

    -- Khóa phòng bằng Advisory Lock trong giao dịch
    PERFORM pg_advisory_xact_lock(hashtext('block_' || p_room_id));

    -- Kiểm tra xem phòng có đang có khách lưu trú hoặc booking đã chốt/cọc trong khoảng ngày này không
    SELECT b.id, b.temporary_order_code, b.guest_name, b.status INTO v_conflict_booking
    FROM public.bookings b
    WHERE b.assigned_room_id = p_room_id
      AND b.status IN ('checked_in', 'confirmed', 'deposit_paid')
      AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange(p_start_date, p_end_date, '[)')
    LIMIT 1;

    IF v_conflict_booking.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Không thể khóa phòng: Phòng đang có khách ' || v_conflict_booking.guest_name || 
                       ' (Đơn ' || v_conflict_booking.temporary_order_code || ', trạng thái: ' || v_conflict_booking.status || ') trong khoảng ngày này.'
        );
    END IF;

    -- Nếu không có xung đột, thực hiện ghi nhận khóa phòng
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
        p_reason,
        p_created_by
    );

    RETURN jsonb_build_object('success', true, 'message', 'Đã khóa phòng thành công');
END;
$$;
