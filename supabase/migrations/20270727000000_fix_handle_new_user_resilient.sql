CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, status, designation, department, employment_type, join_date)
  VALUES (
    new.id,
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
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user trigger error for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;
