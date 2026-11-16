-- Prevent employees from clocking in on days covered by an approved leave request.
-- Enforced at the database level via BEFORE INSERT OR UPDATE trigger on public.attendance.

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

  SELECT EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.user_id = NEW.user_id
      AND lr.status = 'approved'
      AND lr.start_date <= NEW.date
      AND lr.end_date >= NEW.date
  ) INTO v_has_approved_leave;

  IF v_has_approved_leave THEN
    RAISE EXCEPTION 'Clock-in is not allowed on an approved leave day (%).', NEW.date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_clock_in_on_approved_leave ON public.attendance;

CREATE TRIGGER trg_prevent_clock_in_on_approved_leave
  BEFORE INSERT OR UPDATE OF clock_in, date ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_clock_in_on_approved_leave();

