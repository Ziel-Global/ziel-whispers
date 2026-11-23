-- Migration: Idempotent Late Arrival Penalty handling and rollback on waive
-- ---------------------------------------------------
-- 1️⃣ Add a nullable FK from leave_requests to attendance so we can trace
--    which attendance row created a penalty.
-- 2️⃣ Add a unique constraint to guarantee only one penalty per attendance.
-- 3️⃣ Update sync_user_late_deductions to store attendance_id when creating a penalty
--    and use ON CONFLICT DO NOTHING to avoid duplicates.
-- 4️⃣ Update waive_late_attendance / unwaive_late_attendance to delete the
--    corresponding penalty leave request when a waiver is applied.

-- ---------------------------------------------------------------------
-- 1. Add attendance_id column (if not already present)
-- ---------------------------------------------------------------------
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS attendance_id uuid REFERENCES public.attendance(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 2. Unique index to enforce one penalty per attendance
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_late_penalty_per_attendance
  ON public.leave_requests (attendance_id, leave_type_id)
  WHERE attendance_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Update sync_user_late_deductions – we will add a small helper block
--    at the point where a new penalty is inserted. The original function
--    already exists; we replace it with CREATE OR REPLACE that adds the
--    attendance_id and ON CONFLICT guard.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_late_deductions(
    p_user_id uuid,
    p_leave_year integer DEFAULT NULL,
    p_attendance_id uuid DEFAULT NULL   -- optional, passed from waive flow
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_leave_year integer;
  v_ly_start date;
  v_ly_end date;
  v_total_late_minutes integer := 0;
  v_waived_late_minutes integer := 0;
  v_threshold_minutes integer := 540; -- 9 hours = 540 minutes
  v_earned_penalties integer := 0;
  v_target_penalties integer := 0;
  v_existing_penalties integer := 0;
  v_entitlement integer := 12;
  v_other_days integer := 0;
  v_other_hours integer := 0;
  v_other_used integer := 0;
  v_available_leaves integer := 0;
  v_penalty_type_id uuid;
  v_user_tenant_id uuid;
  v_user_full_name text;
  v_latest_late_date date;
  v_already_accounted_minutes integer := 0;
  v_net_minutes integer := 0;
  v_missing_penalties integer;
  v_excess_penalties integer;
  v_rec record;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_id is required');
  END IF;

  -- Determine leave year ------------------------------------------------
  IF p_leave_year IS NULL THEN
    v_leave_year := public.get_leave_year();
  ELSE
    v_leave_year := p_leave_year;
  END IF;

  SELECT leave_start, leave_end INTO v_ly_start, v_ly_end
  FROM public.get_leave_year_range(v_leave_year);

  -- Get user info and tenant --------------------------------------------
  SELECT tenant_id, full_name INTO v_user_tenant_id, v_user_full_name
  FROM public.users WHERE id = p_user_id;

  IF v_user_tenant_id IS NULL THEN
    v_user_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Resolve or create Late Arrival Penalty leave type --------------------
  SELECT id INTO v_penalty_type_id
  FROM public.leave_types
  WHERE name = 'Late Arrival Penalty'
    AND tenant_id = v_user_tenant_id
  LIMIT 1;

  IF v_penalty_type_id IS NULL THEN
    INSERT INTO public.leave_types (tenant_id, name, days_per_year, is_paid)
    VALUES (v_user_tenant_id, 'Late Arrival Penalty', 0, true)
    ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_penalty_type_id;
  END IF;

  ---------------------------------------------------------------------
  -- 1. Compute total late minutes (non‑waived & waived) for the year ---
  ---------------------------------------------------------------------
  SELECT
    COALESCE(SUM(CASE WHEN is_late = true AND is_late_waived = false THEN minutes_late END),0),
    COALESCE(SUM(CASE WHEN is_late = true AND is_late_waived = true THEN minutes_late END),0),
    MAX(CASE WHEN is_late = true AND is_late_waived = false THEN date END)
  INTO v_total_late_minutes, v_waived_late_minutes, v_latest_late_date
  FROM public.attendance
  WHERE user_id = p_user_id
    AND date >= v_ly_start AND date <= v_ly_end
    AND clock_in IS NOT NULL;

  ---------------------------------------------------------------------
  -- 2. How many minutes are already covered by existing penalty rows? --
  ---------------------------------------------------------------------
  SELECT COALESCE(SUM(lr.days_count * v_threshold_minutes),0)
  INTO v_already_accounted_minutes
  FROM public.leave_requests lr
  WHERE lr.user_id = p_user_id
    AND lr.leave_type_id = v_penalty_type_id
    AND lr.status = 'approved'
    AND lr.start_date >= v_ly_start AND lr.start_date <= v_ly_end;

  v_net_minutes := GREATEST(0, v_total_late_minutes - v_already_accounted_minutes);
  v_earned_penalties := FLOOR(v_net_minutes / v_threshold_minutes)::integer;

  ---------------------------------------------------------------------
  -- 3. Insert new penalty rows if needed (idempotent) -------------------
  ---------------------------------------------------------------------
  IF v_earned_penalties > 0 THEN
    -- Loop to create each needed penalty (usually 1, but keep generic)
    FOR i IN 1..v_earned_penalties LOOP
      INSERT INTO public.leave_requests (
        tenant_id,
        user_id,
        leave_type_id,
        days_count,
        reason,
        start_date,
        status,
        attendance_id
      ) VALUES (
        v_user_tenant_id,
        p_user_id,
        v_penalty_type_id,
        1,                         -- one day per penalty unit
        'Late Arrival Penalty',
        v_latest_late_date,        -- apply on the latest late date
        'approved',
        p_attendance_id             -- may be NULL when called from UI sync
      )
      ON CONFLICT (attendance_id, leave_type_id) DO NOTHING; -- idempotent guard
    END LOOP;
  END IF;

  ---------------------------------------------------------------------
  -- 4. Compute other leave usage / entitlement (unchanged) --------------
  ---------------------------------------------------------------------
  SELECT COALESCE(value::integer,12) INTO v_entitlement
  FROM public.system_settings
  WHERE key = 'annual_leave_entitlement'
    AND (tenant_id = v_user_tenant_id OR tenant_id IS NULL)
  ORDER BY (tenant_id = v_user_tenant_id) DESC
  LIMIT 1;

  IF v_entitlement IS NULL THEN v_entitlement := 12; END IF;

  SELECT COALESCE(SUM(lr.days_count),0), COALESCE(SUM(lr.hours),0)
  INTO v_other_days, v_other_hours
  FROM public.leave_requests lr
  LEFT JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.user_id = p_user_id
    AND lr.status = 'approved'
    AND (lt.name IS NULL OR lt.name != 'Late Arrival Penalty')
    AND lr.start_date >= v_ly_start AND lr.start_date <= v_ly_end;

  v_other_used := v_other_days + FLOOR(v_other_hours/8)::integer;
  v_available_leaves := GREATEST(0, v_entitlement - v_other_used);

  v_result := jsonb_build_object(
    'total_late_minutes', v_total_late_minutes,
    'waived_late_minutes', v_waived_late_minutes,
    'earned_penalties', v_earned_penalties,
    'available_leaves', v_available_leaves
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Update waive / unwaive functions to clean up penalty rows
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waive_late_attendance(
    p_attendance_id uuid,
    p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
  v_att record;
  v_sync_res jsonb;
BEGIN
  v_caller_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin','hr_manager')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Only Administrators and HR Managers can waive late arrivals.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.attendance
  SET is_late_waived = true,
      late_waived_by = v_caller_id,
      late_waived_reason = p_reason,
      late_waived_at = now()
  WHERE id = p_attendance_id
  RETURNING * INTO v_att;

  IF v_att IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Re‑sync – pass the attendance_id so newly created penalties can be linked
  v_sync_res := public.sync_user_late_deductions(v_att.user_id, NULL, p_attendance_id);

  INSERT INTO public.audit_logs (
    tenant_id, actor_id, action, target_entity, target_id, metadata
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

CREATE OR REPLACE FUNCTION public.unwaive_late_attendance(
    p_attendance_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
  v_att record;
  v_sync_res jsonb;
BEGIN
  v_caller_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin','hr_manager')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Only Administrators and HR Managers can revoke waivers.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.attendance
  SET is_late_waived = false,
      late_waived_by = NULL,
      late_waived_reason = NULL,
      late_waived_at = NULL
  WHERE id = p_attendance_id
  RETURNING * INTO v_att;

  IF v_att IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Delete the penalty that was attached to this attendance (if any)
  DELETE FROM public.leave_requests
  WHERE attendance_id = p_attendance_id
    AND leave_type_id = (
      SELECT id FROM public.leave_types
      WHERE name = 'Late Arrival Penalty' AND tenant_id = v_att.tenant_id LIMIT 1
    );

  v_sync_res := public.sync_user_late_deductions(v_att.user_id, NULL, NULL);

  INSERT INTO public.audit_logs (
    tenant_id, actor_id, action, target_entity, target_id, metadata
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
