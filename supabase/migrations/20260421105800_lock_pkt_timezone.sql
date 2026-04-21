
-- Update late detection trigger to hardcode Asia/Karachi (PKT)
CREATE OR REPLACE FUNCTION public.calculate_late_clockin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shift_start time;
  v_has_custom boolean;
  v_grace_minutes integer := 15;
  v_clock_in_time time;
  v_diff_minutes integer;
  v_day_of_week integer;
  v_timezone text := 'Asia/Karachi'; -- HARDCODED TO PKT as requested
BEGIN
  -- 1. Check if clock_in is present
  IF NEW.clock_in IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Skip weekends (6=Saturday, 7=Sunday in ISO)
  v_day_of_week := EXTRACT(ISODOW FROM NEW.date);
  IF v_day_of_week IN (6, 7) THEN
    RETURN NEW;
  END IF;

  -- 3. Get grace period from system_settings
  SELECT COALESCE(value::integer, 15) INTO v_grace_minutes
  FROM public.system_settings WHERE key = 'late_grace_minutes';

  -- 4. Get employee's shift info
  SELECT has_custom_shift, shift_start INTO v_has_custom, v_shift_start
  FROM public.users WHERE id = NEW.user_id;

  -- 5. Fallback to global shift
  IF NOT COALESCE(v_has_custom, false) THEN
    SELECT value::time INTO v_shift_start
    FROM public.system_settings WHERE key = 'default_shift_start';

    IF v_shift_start IS NULL THEN
      v_shift_start := '09:00'::time;
    END IF;
  END IF;

  -- 6. Calculate lateness (LOCK TO PKT)
  -- AT TIME ZONE 'Asia/Karachi' on a timestamptz correctly shifts it to PKT
  v_clock_in_time := (NEW.clock_in AT TIME ZONE v_timezone)::time;
  v_diff_minutes := EXTRACT(EPOCH FROM (v_clock_in_time - v_shift_start))::integer / 60;

  IF v_diff_minutes > v_grace_minutes THEN
    NEW.is_late := true;
    NEW.minutes_late := v_diff_minutes;
  ELSE
    NEW.is_late := false;
    NEW.minutes_late := 0;
  END IF;

  RETURN NEW;
END;
$function$;
