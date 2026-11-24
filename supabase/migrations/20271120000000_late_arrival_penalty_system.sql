-- Migration: Late Arrival Penalty System & Hourly Leave Fix (Multi-Tenant Compatible)
-- 1. Fix prevent_clock_in_on_approved_leave and prevent_daily_log_on_approved_leave so hourly leaves do not block clock-in/logs
-- 2. Add columns to attendance for waiving late arrivals
-- 3. Ensure "Late Arrival Penalty" leave type exists across all tenants
-- 4. Create sync_user_late_deductions function & trigger with tenant scoping
-- 5. Create helper RPCs for waiving and querying late arrival summaries

-- ============================================================================
-- 1. FIX: Hourly leave clock-in and daily log blocker
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_clock_in_on_approved_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_approved_leave boolean;
BEGIN
  -- Only enforce when a clock_in timestamp is being set (new row or transitioning from NULL)
  IF NEW.clock_in IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.clock_in IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only full-day leaves block clock-in (hours IS NULL and days_count > 0)
  -- Hourly/half-day leaves (hours IS NOT NULL) do not prevent working the rest of the day
  SELECT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = NEW.user_id
      AND lr.status = 'approved'
      AND lr.hours IS NULL
      AND COALESCE(lr.days_count, 1) > 0
      AND lr.start_date <= NEW.date
      AND lr.end_date >= NEW.date
  ) INTO v_has_approved_leave;

  IF v_has_approved_leave THEN
    RAISE EXCEPTION 'Clock-in is not allowed on an approved full-day leave (%).', NEW.date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_daily_log_on_approved_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_privileged boolean;
  v_has_approved_leave boolean;
BEGIN
  -- On UPDATE, only enforce if log_date is actually being changed
  IF TG_OP = 'UPDATE' AND OLD.log_date IS NOT DISTINCT FROM NEW.log_date THEN
    RETURN NEW;
  END IF;

  -- Allow service-role / system operations and admin/hr_manager roles
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'hr_manager')
  ) INTO v_is_privileged;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  -- Only full-day leaves block work logs (hours IS NULL and days_count > 0)
  SELECT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = NEW.user_id
      AND lr.status = 'approved'
      AND lr.hours IS NULL
      AND COALESCE(lr.days_count, 1) > 0
      AND lr.start_date <= NEW.log_date
      AND lr.end_date >= NEW.log_date
  ) INTO v_has_approved_leave;

  IF v_has_approved_leave THEN
    RAISE EXCEPTION 'Cannot add work logs on an approved full-day leave (%).', NEW.log_date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. ATTENDANCE WAIVER COLUMNS
-- ============================================================================
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS is_late_waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_waived_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS late_waived_reason text,
  ADD COLUMN IF NOT EXISTS late_waived_at timestamptz;

-- ============================================================================
-- 3. ENSURE "Late Arrival Penalty" LEAVE TYPE (Multi-Tenant Compatible)
-- ============================================================================
-- Seed for all registered tenants
INSERT INTO public.leave_types (tenant_id, name, days_per_year, is_paid)
SELECT t.id, 'Late Arrival Penalty', 0, true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Seed for default fallback workspace in case single tenant or initial bootstrap
INSERT INTO public.leave_types (tenant_id, name, days_per_year, is_paid)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Late Arrival Penalty', 0, true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================================================
-- 4. CORE FUNCTION: sync_user_late_deductions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_user_late_deductions(
  p_user_id uuid,
  p_leave_year integer DEFAULT NULL
)
RETURNS jsonb
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

  -- Determine leave year
  IF p_leave_year IS NULL THEN
    v_leave_year := public.get_leave_year();
  ELSE
    v_leave_year := p_leave_year;
  END IF;

  SELECT leave_start, leave_end INTO v_ly_start, v_ly_end
  FROM public.get_leave_year_range(v_leave_year);

  -- Get user info and tenant
  SELECT tenant_id, full_name INTO v_user_tenant_id, v_user_full_name
  FROM public.users WHERE id = p_user_id;

  IF v_user_tenant_id IS NULL THEN
    v_user_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Get or create Late Arrival Penalty leave type ID for this tenant
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

  -- 1. Calculate non-waived late minutes and waived late minutes for the leave year
  SELECT 
    COALESCE(SUM(CASE WHEN is_late = true AND is_late_waived = false THEN minutes_late ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_late = true AND is_late_waived = true THEN minutes_late ELSE 0 END), 0),
    MAX(CASE WHEN is_late = true AND is_late_waived = false THEN date ELSE NULL END)
  INTO v_total_late_minutes, v_waived_late_minutes, v_latest_late_date
  FROM public.attendance
  WHERE user_id = p_user_id
    AND date >= v_ly_start AND date <= v_ly_end
    AND clock_in IS NOT NULL;

  -- Total earned penalties (1 penalty per 540 minutes)
    -- Compute minutes already covered by existing penalty records
  SELECT COALESCE(SUM(lr.days_count * v_threshold_minutes), 0) INTO v_already_accounted_minutes
  FROM public.leave_requests lr
  WHERE lr.user_id = p_user_id
    AND lr.leave_type_id = v_penalty_type_id
    AND lr.status = 'approved'
    AND lr.start_date >= v_ly_start AND lr.start_date <= v_ly_end;

  -- Net minutes that still need conversion to penalties
  v_net_minutes := GREATEST(0, v_total_late_minutes - v_already_accounted_minutes);

  v_earned_penalties := FLOOR(v_net_minutes / v_threshold_minutes)::integer;

  -- 2. Check user's annual leave entitlement and other used leaves
  SELECT COALESCE(value::integer, 12) INTO v_entitlement
  FROM public.system_settings
  WHERE key = 'annual_leave_entitlement'
    AND (tenant_id = v_user_tenant_id OR tenant_id IS NULL)
  ORDER BY (tenant_id = v_user_tenant_id) DESC
  LIMIT 1;

  IF v_entitlement IS NULL THEN
    v_entitlement := 12;
  END IF;

  -- Calculate other leaves used (excluding Late Arrival Penalty) in this leave year
  SELECT 
    COALESCE(SUM(lr.days_count), 0),
    COALESCE(SUM(lr.hours), 0)
  INTO v_other_days, v_other_hours
  FROM public.leave_requests lr
  LEFT JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.user_id = p_user_id
    AND lr.status = 'approved'
    AND (lt.name IS NULL OR lt.name != 'Late Arrival Penalty')
    AND lr.start_date >= v_ly_start AND lr.start_date <= v_ly_end;

  v_other_used := v_other_days + FLOOR(v_other_hours / 8)::integer;
  v_available_leaves := GREATEST(0, v_entitlement - v_other_used);

  -- Rule: Once leaves reach 0, stop calculating/deducting penalties (no negative balance)
  v_target_penalties := LEAST(v_earned_penalties, v_available_leaves);

  -- 3. Count existing Late Arrival Penalty records in leave_requests
  SELECT count(*) INTO v_existing_penalties
  FROM public.leave_requests lr
  WHERE lr.user_id = p_user_id
    AND lr.leave_type_id = v_penalty_type_id
    AND lr.status = 'approved'
    AND lr.start_date >= v_ly_start AND lr.start_date <= v_ly_end;

  -- 4. Reconcile existing penalties vs target penalties
  IF v_existing_penalties < v_target_penalties THEN
    v_missing_penalties := v_target_penalties - v_existing_penalties;
    
    FOR i IN 1..v_missing_penalties LOOP
      INSERT INTO public.leave_requests (
        tenant_id,
        user_id,
        leave_type_id,
        start_date,
        end_date,
        days_count,
        hours,
        status,
        reason,
        admin_comment,
        reviewed_at
      ) VALUES (
        v_user_tenant_id,
        p_user_id,
        v_penalty_type_id,
        COALESCE(v_latest_late_date, CURRENT_DATE),
        COALESCE(v_latest_late_date, CURRENT_DATE),
        1,
        NULL,
        'approved',
        'Late Arrival Penalty (540 accumulated late minutes)',
        'System-generated deduction: 9 accumulated late hours = 1 leave day',
        NOW()
      );

      -- Create notification for employee
      INSERT INTO public.notifications (
        tenant_id,
        user_id,
        type,
        channel,
        metadata,
        read
      ) VALUES (
        v_user_tenant_id,
        p_user_id,
        'leave.approved',
        'in_app',
        jsonb_build_object(
          'title', 'Late Arrival Penalty Deducted',
          'message', '1 day has been deducted from your leaves due to 540 accumulated late arrival minutes.',
          'leave_type', 'Late Arrival Penalty',
          'days', 1
        ),
        false
      );

      -- Audit log
      INSERT INTO public.audit_logs (
        tenant_id,
        actor_id,
        action,
        target_entity,
        metadata
      ) VALUES (
        v_user_tenant_id,
        p_user_id,
        'leave.late_penalty_deducted',
        'leave_requests',
        jsonb_build_object(
          'employee', v_user_full_name,
          'total_late_minutes', v_total_late_minutes,
          'penalties_count', v_target_penalties
        )
      );
    END LOOP;

  ELSIF v_existing_penalties > v_target_penalties THEN
    -- Admin waived late attendance or leaves changed, refund excess penalty days
    v_excess_penalties := v_existing_penalties - v_target_penalties;
    
    FOR v_rec IN (
      SELECT id FROM public.leave_requests
      WHERE user_id = p_user_id
        AND leave_type_id = v_penalty_type_id
        AND status = 'approved'
        AND start_date >= v_ly_start AND start_date <= v_ly_end
      ORDER BY created_at DESC
      LIMIT v_excess_penalties
    ) LOOP
      DELETE FROM public.leave_requests WHERE id = v_rec.id;
      
      -- Notify employee about waiver refund
      INSERT INTO public.notifications (
        tenant_id,
        user_id,
        type,
        channel,
        metadata,
        read
      ) VALUES (
        v_user_tenant_id,
        p_user_id,
        'leave.approved',
        'in_app',
        jsonb_build_object(
          'title', 'Late Arrival Penalty Revoked',
          'message', 'A 1-day late arrival penalty was reversed and refunded to your leave balance following an admin waiver.',
          'leave_type', 'Late Arrival Penalty',
          'days', 1
        ),
        false
      );
    END LOOP;
  END IF;

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'leave_year', v_leave_year,
    'total_late_minutes', v_total_late_minutes,
    'waived_late_minutes', v_waived_late_minutes,
    'threshold_minutes', v_threshold_minutes,
    'cycle_late_minutes', v_total_late_minutes % v_threshold_minutes,
    'earned_penalties', v_earned_penalties,
    'target_penalties', v_target_penalties,
    'available_leaves', v_available_leaves,
    'is_capped', (v_available_leaves = 0 AND v_earned_penalties > 0)
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. TRIGGER ON ATTENDANCE: Auto-sync late deductions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_sync_late_deductions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_user_late_deductions(OLD.user_id);
    RETURN OLD;
  ELSE
    -- Only run if late status or waiver changed
    IF TG_OP = 'INSERT' OR 
       (NEW.minutes_late IS DISTINCT FROM OLD.minutes_late) OR
       (NEW.is_late IS DISTINCT FROM OLD.is_late) OR
       (NEW.is_late_waived IS DISTINCT FROM OLD.is_late_waived) OR
       (NEW.clock_in IS DISTINCT FROM OLD.clock_in) THEN
      PERFORM public.sync_user_late_deductions(NEW.user_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_sync_late_deductions ON public.attendance;

CREATE TRIGGER trg_attendance_sync_late_deductions
  AFTER INSERT OR UPDATE OF clock_in, minutes_late, is_late, is_late_waived OR DELETE
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_sync_late_deductions();

-- ============================================================================
-- 6. RPC: waive_late_attendance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.waive_late_attendance(
  p_attendance_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
  v_att record;
  v_sync_res jsonb;
BEGIN
  v_caller_id := auth.uid();

  -- Verify caller is admin or hr_manager
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin', 'hr_manager')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Only Administrators and HR Managers can waive late attendance.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_att FROM public.attendance WHERE id = p_attendance_id;
  IF v_att IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.attendance
  SET 
    is_late_waived = true,
    late_waived_by = v_caller_id,
    late_waived_reason = TRIM(p_reason),
    late_waived_at = NOW()
  WHERE id = p_attendance_id;

  -- Sync user late deductions
  v_sync_res := public.sync_user_late_deductions(v_att.user_id);

  -- Audit log
  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    action,
    target_entity,
    target_id,
    metadata
  ) VALUES (
    v_att.tenant_id,
    v_caller_id,
    'attendance.late_waived',
    'attendance',
    p_attendance_id,
    jsonb_build_object(
      'employee_id', v_att.user_id,
      'date', v_att.date,
      'minutes_waived', v_att.minutes_late,
      'reason', TRIM(p_reason)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', p_attendance_id,
    'sync', v_sync_res
  );
END;
$$;

-- ============================================================================
-- 7. RPC: unwaive_late_attendance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.unwaive_late_attendance(
  p_attendance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
  v_att record;
  v_sync_res jsonb;
BEGIN
  v_caller_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_caller_id AND role IN ('admin', 'hr_manager')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Only Administrators and HR Managers can revoke waivers.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_att FROM public.attendance WHERE id = p_attendance_id;
  IF v_att IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.attendance
  SET 
    is_late_waived = false,
    late_waived_by = NULL,
    late_waived_reason = NULL,
    late_waived_at = NULL
  WHERE id = p_attendance_id;

  v_sync_res := public.sync_user_late_deductions(v_att.user_id);

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_id,
    action,
    target_entity,
    target_id,
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
$$;

-- ============================================================================
-- 8. RPC: get_user_late_summary
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_late_summary(
  p_user_id uuid,
  p_leave_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_leave_year integer;
  v_ly_start date;
  v_ly_end date;
  v_user_tenant_id uuid;
  v_total_late_minutes integer := 0;
  v_waived_late_minutes integer := 0;
  v_threshold_minutes integer := 540;
  v_penalties_count integer := 0;
  v_entitlement integer := 12;
  v_other_days integer := 0;
  v_other_hours integer := 0;
  v_available_leaves integer := 0;
BEGIN
  IF p_leave_year IS NULL THEN
    v_leave_year := public.get_leave_year();
  ELSE
    v_leave_year := p_leave_year;
  END IF;

  SELECT leave_start, leave_end INTO v_ly_start, v_ly_end
  FROM public.get_leave_year_range(v_leave_year);

  SELECT tenant_id INTO v_user_tenant_id FROM public.users WHERE id = p_user_id;

  SELECT 
    COALESCE(SUM(CASE WHEN is_late = true AND is_late_waived = false THEN minutes_late ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_late = true AND is_late_waived = true THEN minutes_late ELSE 0 END), 0)
  INTO v_total_late_minutes, v_waived_late_minutes
  FROM public.attendance
  WHERE user_id = p_user_id
    AND date >= v_ly_start AND date <= v_ly_end
    AND clock_in IS NOT NULL;

  -- Entitlement scoped to tenant if available
  SELECT COALESCE(value::integer, 12) INTO v_entitlement
  FROM public.system_settings 
  WHERE key = 'annual_leave_entitlement'
    AND (tenant_id = v_user_tenant_id OR tenant_id IS NULL)
  ORDER BY (tenant_id = v_user_tenant_id) DESC
  LIMIT 1;

  IF v_entitlement IS NULL THEN v_entitlement := 12; END IF;

  -- Other leaves
  SELECT 
    COALESCE(SUM(lr.days_count), 0),
    COALESCE(SUM(lr.hours), 0)
  INTO v_other_days, v_other_hours
  FROM public.leave_requests lr
  LEFT JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.user_id = p_user_id
    AND lr.status = 'approved'
    AND (lt.name IS NULL OR lt.name != 'Late Arrival Penalty')
    AND lr.start_date >= v_ly_start AND lr.start_date <= v_ly_end;

  v_available_leaves := GREATEST(0, v_entitlement - (v_other_days + FLOOR(v_other_hours / 8)::integer));

  -- Penalty count
  SELECT count(*) INTO v_penalties_count
  FROM public.leave_requests lr
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.user_id = p_user_id
    AND lt.name = 'Late Arrival Penalty'
    AND lr.status = 'approved'
    AND lr.start_date >= v_ly_start AND lr.start_date <= v_ly_end;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'leave_year', v_leave_year,
    'leave_year_start', v_ly_start,
    'leave_year_end', v_ly_end,
    'total_late_minutes', v_total_late_minutes,
    'waived_late_minutes', v_waived_late_minutes,
    'threshold_minutes', v_threshold_minutes,
    'cycle_late_minutes', v_total_late_minutes % v_threshold_minutes,
    'earned_penalties', FLOOR(v_total_late_minutes / v_threshold_minutes)::integer,
    'penalties_count', v_penalties_count,
    'available_leaves', v_available_leaves,
    'remaining_leaves', GREATEST(0, v_available_leaves - v_penalties_count),
    'is_capped', (v_available_leaves = 0)
  );
END;
$$;
