-- Remove unique constraint to allow multiple sessions per day
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_user_id_date_key;

-- Update the calculate_late_clockin function to only apply to the first session of the day
CREATE OR REPLACE FUNCTION public.calculate_late_clockin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shift_start time;
  v_has_custom boolean;
  v_grace_minutes integer;
  v_clock_in_time timestamp;
  v_shift_start_ts timestamp;
  v_total_late_minutes integer;
  v_day_of_week integer;
  v_timezone text;
  v_existing_count integer;
BEGIN
  -- Only trigger for the first clock-in of the day
  SELECT count(*) INTO v_existing_count
  FROM public.attendance
  WHERE user_id = NEW.user_id 
    AND date = NEW.date
    AND id != NEW.id;

  IF v_existing_count > 0 THEN
    NEW.is_late := false;
    NEW.minutes_late := 0;
    NEW.hours_late := 0;
    RETURN NEW;
  END IF;

  IF NEW.clock_in IS NULL THEN
    RETURN NEW;
  END IF;

  v_day_of_week := EXTRACT(ISODOW FROM NEW.date);
  IF v_day_of_week IN (6, 7) THEN
    NEW.is_late := false;
    NEW.minutes_late := 0;
    NEW.hours_late := 0;
    RETURN NEW;
  END IF;

  SELECT value::integer INTO v_grace_minutes
  FROM public.system_settings WHERE key = 'late_grace_minutes';
  IF v_grace_minutes IS NULL THEN
    v_grace_minutes := 15;
  END IF;

  SELECT value INTO v_timezone
  FROM public.system_settings WHERE key = 'timezone';
  IF v_timezone IS NULL THEN
    v_timezone := 'Asia/Karachi';
  END IF;

  SELECT has_custom_shift, shift_start INTO v_has_custom, v_shift_start
  FROM public.users WHERE id = NEW.user_id;

  IF NOT COALESCE(v_has_custom, false) THEN
    SELECT value::time INTO v_shift_start
    FROM public.system_settings WHERE key = 'default_shift_start';
    IF v_shift_start IS NULL THEN
      v_shift_start := '09:00'::time;
    END IF;
  END IF;

  v_shift_start_ts := (NEW.date || ' ' || v_shift_start::text)::timestamp;
  v_clock_in_time := (NEW.clock_in AT TIME ZONE v_timezone)::timestamp;
  v_total_late_minutes := EXTRACT(EPOCH FROM (v_clock_in_time - v_shift_start_ts))::integer / 60;

  IF v_total_late_minutes > v_grace_minutes THEN
    NEW.is_late := true;
    NEW.hours_late := FLOOR(v_total_late_minutes / 60)::integer;
    NEW.minutes_late := v_total_late_minutes; 
  ELSE
    NEW.is_late := false;
    NEW.hours_late := 0;
    NEW.minutes_late := 0;
  END IF;

  RETURN NEW;
END;
$function$;
