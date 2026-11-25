-- Migration: Fix UUID insertion for audit‑log target_id
-- ---------------------------------------------------
-- This migration replaces the two PL/pgSQL functions that record
-- waiving / un‑waiving of late‑arrival penalties. The only change
-- is the removal of the erroneous "::text" cast on `p_attendance_id`
-- when it is stored in `audit_logs.target_id` (which is a UUID column).

--------------------------------------------------------------------
-- 1️⃣ waive_late_attendance
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waive_late_attendance(
    p_attendance_id uuid,
    p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id   uuid;
  v_is_authorized boolean;
  v_att          record;
  v_sync_res     jsonb;
BEGIN
  -- Authorization -------------------------------------------------
  v_caller_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role IN ('admin', 'hr_manager')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION
      'Only Administrators and HR Managers can waive late arrivals.'
      USING ERRCODE = '42501';
  END IF;

  -- Update attendance ---------------------------------------------
  UPDATE public.attendance
  SET
    is_late_waived   = true,
    late_waived_by   = v_caller_id,
    late_waived_reason = p_reason,
    late_waived_at   = now()
  WHERE id = p_attendance_id
  RETURNING * INTO v_att;

  IF v_att IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Re‑sync late‑minute totals ------------------------------------
  v_sync_res := public.sync_user_late_deductions(v_att.user_id);

  -- Audit log (fixed – **no ::text cast**) ------------------------
  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    action,
    target_entity,
    target_id,               -- UUID, stored directly
    metadata
  ) VALUES (
    v_att.tenant_id,
    v_caller_id,
    'attendance.late_waived',
    'attendance',
    p_attendance_id,
    jsonb_build_object('employee_id', v_att.user_id, 'date', v_att.date)
  );

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', p_attendance_id,
    'sync', v_sync_res
  );
END;
$function$;

--------------------------------------------------------------------
-- 2️⃣ unwaive_late_attendance
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unwaive_late_attendance(
    p_attendance_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id   uuid;
  v_is_authorized boolean;
  v_att          record;
  v_sync_res     jsonb;
BEGIN
  -- Authorization -------------------------------------------------
  v_caller_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id
      AND role IN ('admin', 'hr_manager')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION
      'Only Administrators and HR Managers can revoke waivers.'
      USING ERRCODE = '42501';
  END IF;

  -- Update attendance ---------------------------------------------
  UPDATE public.attendance
  SET
    is_late_waived    = false,
    late_waived_by    = NULL,
    late_waived_reason = NULL,
    late_waived_at    = NULL
  WHERE id = p_attendance_id
  RETURNING * INTO v_att;

  IF v_att IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Re‑sync late‑minute totals ------------------------------------
  v_sync_res := public.sync_user_late_deductions(v_att.user_id);

  -- Audit log (fixed – **no ::text cast**) ------------------------
  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    action,
    target_entity,
    target_id,               -- UUID, stored directly
    metadata
  ) VALUES (
    v_att.tenant_id,
    v_caller_id,
    'attendance.late_unwaived',
    'attendance',
    p_attendance_id,
    jsonb_build_object('employee_id', v_att.user_id, 'date', v_att.date)
  );

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', p_attendance_id,
    'sync', v_sync_res
  );
END;
$function$;
