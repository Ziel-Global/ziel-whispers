-- Migration: Revert Late Leave Deduction Feature
-- ---------------------------------------------------
-- This migration removes all objects that were added for the Late Arrival Penalty
-- functionality (attendance waiver columns, penalty helper functions, extra
-- columns/indexes on leave_requests, and the Late Arrival Penalty leave type).
-- After applying, the database schema returns to the state before any of the
-- feature work was introduced.

-- 1. Remove attendance waiver columns
-- First drop the trigger that depends on these columns
DROP TRIGGER IF EXISTS trg_attendance_sync_late_deductions ON public.attendance;

ALTER TABLE public.attendance
  DROP COLUMN IF EXISTS is_late_waived,
  DROP COLUMN IF EXISTS late_waived_by,
  DROP COLUMN IF EXISTS late_waived_reason,
  DROP COLUMN IF EXISTS late_waived_at;

-- 2. Drop the helper functions introduced for this feature
DROP FUNCTION IF EXISTS public.waive_late_attendance(uuid, text);
DROP FUNCTION IF EXISTS public.unwaive_late_attendance(uuid);
DROP FUNCTION IF EXISTS public.sync_user_late_deductions(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.sync_user_late_deductions(uuid, integer);

-- 3. Remove the attendance_id column and unique index from leave_requests
ALTER TABLE public.leave_requests
  DROP COLUMN IF EXISTS attendance_id;
DROP INDEX IF EXISTS uniq_late_penalty_per_attendance;

-- 4. Delete the Late Arrival Penalty leave type (if it exists)
-- Delete any leave_requests that reference the Late Arrival Penalty leave types (across all tenants)
DELETE FROM public.leave_requests lr
USING public.leave_types lt
WHERE lr.leave_type_id = lt.id
  AND lt.name = 'Late Arrival Penalty';
DELETE FROM public.leave_types WHERE name = 'Late Arrival Penalty';

-- 5. (Optional) Clean up any residual penalty leave_requests that were
--    created by the feature. This deletes rows that reference now‑missing
--    leave types (defensive, should be empty after the previous delete).
DELETE FROM public.leave_requests lr
WHERE lr.leave_type_id NOT IN (SELECT id FROM public.leave_types);

-- Note: No new functions are recreated – the system now behaves exactly as it
-- did before the Late Leave Deduction feature was added.
