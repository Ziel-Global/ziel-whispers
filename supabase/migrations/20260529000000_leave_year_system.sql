-- Leave Year System
-- Leave year runs from June 1 to May 31 every year

-- Function to get the current leave year (starting year)
-- E.g., for June 2025 - May 2026, returns 2025
CREATE OR REPLACE FUNCTION public.get_leave_year()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_month integer;
  v_year integer;
BEGIN
  v_month := EXTRACT(MONTH FROM NOW());
  v_year := EXTRACT(YEAR FROM NOW());

  IF v_month >= 6 THEN
    RETURN v_year;
  ELSE
    RETURN v_year - 1;
  END IF;
END;
$$;

-- Function to get the leave year range for a given start year
-- E.g., get_leave_year_range(2025) returns ('2025-06-01', '2026-05-31')
CREATE OR REPLACE FUNCTION public.get_leave_year_range(start_year integer DEFAULT NULL)
RETURNS TABLE(leave_start date, leave_end date)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_year integer;
BEGIN
  IF start_year IS NULL THEN
    v_year := public.get_leave_year();
  ELSE
    v_year := start_year;
  END IF;

  leave_start := make_date(v_year, 6, 1);
  leave_end := make_date(v_year + 1, 5, 31);
  RETURN NEXT;
END;
$$;

-- Update handle_new_user_leave_balances to use leave year instead of calendar year
-- This only affects NEW users created after this migration
CREATE OR REPLACE FUNCTION public.handle_new_user_leave_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entitlement integer;
  v_leave_year integer;
BEGIN
  SELECT COALESCE(value::integer, 12) INTO v_entitlement
  FROM public.system_settings
  WHERE key = 'annual_leave_entitlement';

  IF v_entitlement IS NULL THEN
    v_entitlement := 12;
  END IF;

  v_leave_year := public.get_leave_year();

  INSERT INTO public.leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT NEW.id, lt.id, v_leave_year, v_entitlement, 0
  FROM public.leave_types lt
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Ensure Personal Leave type exists for historical data mapping
INSERT INTO public.leave_types (name, days_per_year, is_paid)
SELECT 'Personal Leave', 12, true
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types WHERE name = 'Personal Leave');
