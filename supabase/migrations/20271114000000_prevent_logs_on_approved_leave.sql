-- Prevent employees from adding work logs on days covered by an approved leave request.
-- Enforced at the database level via BEFORE INSERT OR UPDATE OF log_date trigger on public.daily_logs.
-- Admins and HR managers are exempt so administrative adjustments continue working as before.

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

  SELECT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = NEW.user_id
      AND lr.status = 'approved'
      AND lr.start_date <= NEW.log_date
      AND lr.end_date >= NEW.log_date
  ) INTO v_has_approved_leave;

  IF v_has_approved_leave THEN
    RAISE EXCEPTION 'Cannot add work logs on an approved leave day (%).', NEW.log_date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_daily_log_on_approved_leave ON public.daily_logs;

CREATE TRIGGER trg_prevent_daily_log_on_approved_leave
  BEFORE INSERT OR UPDATE OF log_date ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_daily_log_on_approved_leave();

