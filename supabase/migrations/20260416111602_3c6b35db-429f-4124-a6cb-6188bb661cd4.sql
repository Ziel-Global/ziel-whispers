
-- Add hours_late column
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS hours_late integer NOT NULL DEFAULT 0;

-- Recreate the trigger function with correct calculation
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
  v_clock_in_time timestamp;
  v_shift_start_ts timestamp;
  v_total_late_minutes integer;
  v_day_of_week integer;
  v_timezone text;
BEGIN
  -- Only process on INSERT with clock_in set
  IF NEW.clock_in IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip weekends (6=Saturday, 7=Sunday in ISO)
  v_day_of_week := EXTRACT(ISODOW FROM NEW.date);
  IF v_day_of_week IN (6, 7) THEN
    NEW.is_late := false;
    NEW.minutes_late := 0;
    NEW.hours_late := 0;
    RETURN NEW;
  END IF;

  -- Get timezone from system_settings
  SELECT value INTO v_timezone
  FROM public.system_settings WHERE key = 'timezone';
  IF v_timezone IS NULL THEN
    v_timezone := 'Asia/Karachi';
  END IF;

  -- Get employee's shift info
  SELECT has_custom_shift, shift_start INTO v_has_custom, v_shift_start
  FROM public.users WHERE id = NEW.user_id;

  -- If no custom shift, use global default
  IF NOT COALESCE(v_has_custom, false) THEN
    SELECT value::time INTO v_shift_start
    FROM public.system_settings WHERE key = 'default_shift_start';

    IF v_shift_start IS NULL THEN
      v_shift_start := '09:00'::time;
    END IF;
  END IF;

  -- Build full shift start timestamp for the attendance date in the configured timezone
  v_shift_start_ts := (NEW.date || ' ' || v_shift_start::text)::timestamp;
  
  -- Convert clock_in to the same timezone for comparison
  v_clock_in_time := (NEW.clock_in AT TIME ZONE v_timezone)::timestamp;

  -- Calculate total minutes late
  v_total_late_minutes := EXTRACT(EPOCH FROM (v_clock_in_time - v_shift_start_ts))::integer / 60;

  IF v_total_late_minutes > v_grace_minutes THEN
    NEW.is_late := true;
    NEW.hours_late := FLOOR(v_total_late_minutes / 60)::integer;
    NEW.minutes_late := v_total_late_minutes % 60;
  ELSE
    NEW.is_late := false;
    NEW.hours_late := 0;
    NEW.minutes_late := 0;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_calculate_late_clockin ON public.attendance;
CREATE TRIGGER trg_calculate_late_clockin
  BEFORE INSERT ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_late_clockin();
