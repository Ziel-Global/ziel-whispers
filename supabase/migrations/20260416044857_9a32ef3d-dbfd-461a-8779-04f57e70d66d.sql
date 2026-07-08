
-- 1. Add late detection columns to attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS minutes_late integer NOT NULL DEFAULT 0;

-- 2. Add has_custom_shift flag to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_custom_shift boolean NOT NULL DEFAULT false;

-- 3. Allow all authenticated users to SELECT system_settings
CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- 4. Fix handle_new_user_leave_balances to read entitlement from system_settings
CREATE OR REPLACE FUNCTION public.handle_new_user_leave_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entitlement integer;
BEGIN
  SELECT COALESCE(value::integer, 12) INTO v_entitlement
  FROM public.system_settings
  WHERE key = 'annual_leave_entitlement';

  IF v_entitlement IS NULL THEN
    v_entitlement := 12;
  END IF;

  INSERT INTO public.leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT NEW.id, lt.id, EXTRACT(YEAR FROM now())::int, v_entitlement, 0
  FROM public.leave_types lt
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 5. Create late detection trigger function
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
  v_timezone text;
BEGIN
  -- Only process on INSERT with clock_in set
  IF NEW.clock_in IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip weekends (6=Saturday, 7=Sunday in ISO)
  v_day_of_week := EXTRACT(ISODOW FROM NEW.date);
  IF v_day_of_week IN (6, 7) THEN
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

  -- Calculate lateness using configured timezone
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

-- Create the trigger (BEFORE INSERT so it can modify NEW)
CREATE TRIGGER trg_calculate_late_clockin
BEFORE INSERT ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.calculate_late_clockin();
