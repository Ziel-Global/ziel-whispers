-- Migration: 20271106040000_phase6_fix_auth_triggers_and_tenant_provisioning.sql
-- Description: Updates auth and user lifecycle triggers to handle multi-tenant tenant_id seamlessly.

-- 1. Update handle_new_user trigger function to include tenant_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := COALESCE(
    (new.raw_user_meta_data->>'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  INSERT INTO public.users (
    id,
    tenant_id,
    email,
    full_name,
    role,
    status,
    designation,
    department,
    employment_type,
    join_date
  )
  VALUES (
    new.id,
    v_tenant_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'System Admin'),
    COALESCE(new.raw_user_meta_data->>'role', 'employee'),
    'active',
    COALESCE(new.raw_user_meta_data->>'designation', 'Administrator'),
    COALESCE(new.raw_user_meta_data->>'department', 'Management'),
    COALESCE(new.raw_user_meta_data->>'employment_type', 'full-time'),
    COALESCE((new.raw_user_meta_data->>'join_date')::date, NOW()::date)
  )
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id),
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user trigger error for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

-- 2. Update handle_new_user_leave_balances trigger function to scope by tenant_id
CREATE OR REPLACE FUNCTION public.handle_new_user_leave_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entitlement integer;
  v_leave_year integer;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001'::uuid);

  SELECT COALESCE(value::integer, 12) INTO v_entitlement
  FROM public.system_settings
  WHERE tenant_id = v_tenant_id AND key = 'annual_leave_entitlement';

  IF v_entitlement IS NULL THEN
    v_entitlement := 12;
  END IF;

  v_leave_year := public.get_leave_year();

  INSERT INTO public.leave_balances (tenant_id, user_id, leave_type_id, year, total_days, used_days)
  SELECT v_tenant_id, NEW.id, lt.id, v_leave_year, v_entitlement, 0
  FROM public.leave_types lt
  WHERE lt.tenant_id = v_tenant_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user_leave_balances error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

