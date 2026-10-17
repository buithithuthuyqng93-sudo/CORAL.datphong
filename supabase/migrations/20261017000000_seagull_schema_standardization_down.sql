-- ====================================================================
-- SEAGULL LÝ SƠN — HOMESTAY & CÀ PHÊ
-- ROLLBACK SCRIPT FOR: 20261017000000_seagull_schema_standardization.sql
-- ====================================================================

-- 1. DROP RLS POLICIES & TABLES (Reverse order)
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.payment_events CASCADE;
DROP TABLE IF EXISTS public.housekeeping_tasks CASCADE;
DROP TABLE IF EXISTS public.email_notifications CASCADE;
DROP TABLE IF EXISTS public.booking_room_allocations CASCADE;
DROP TABLE IF EXISTS public.booking_holds CASCADE;
DROP TABLE IF EXISTS public.room_rates CASCADE;
DROP TABLE IF EXISTS public.homestay_settings CASCADE;

-- 2. DROP FUNCTIONS
DROP FUNCTION IF EXISTS public.fn_cleanup_expired_holds() CASCADE;
