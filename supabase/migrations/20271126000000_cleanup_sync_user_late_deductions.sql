-- Migration: Remove duplicate overload of sync_user_late_deductions
-- ---------------------------------------------------
-- The earlier migration added a three‑parameter version of
-- public.sync_user_late_deductions (p_user_id uuid, p_leave_year integer DEFAULT NULL,
-- p_attendance_id uuid DEFAULT NULL). The original two‑parameter version
-- (p_user_id uuid, p_leave_year integer DEFAULT NULL) is still present, causing
-- the "function is not unique" error when the function is called with only the
-- UUID argument.
--
-- This migration drops the old overload so that only the three‑parameter
-- definition remains. After applying, a call like
--   SELECT public.sync_user_late_deductions('user‑uuid');
-- will unambiguously match the remaining function.

-- Drop the old two‑parameter signature (uuid, integer)
DROP FUNCTION IF EXISTS public.sync_user_late_deductions(uuid, integer);

-- No new function body is needed here because the three‑parameter version
-- already exists from migration 20271125000000_fix_late_penalty_idempotency.sql.
