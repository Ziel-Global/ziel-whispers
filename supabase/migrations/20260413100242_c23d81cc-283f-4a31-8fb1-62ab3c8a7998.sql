
-- Login attempts tracking table
CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  ip_address text
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anon insert (for tracking before auth)
CREATE POLICY "Anyone can insert login attempts"
ON public.login_attempts FOR INSERT
TO public
WITH CHECK (true);

-- Only admin can read
CREATE POLICY "Admin can view login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (public.get_my_role() = 'admin');

-- Index for fast lookups
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (email, attempted_at DESC);

-- Function to auto-create leave balances when a user is created
CREATE OR REPLACE FUNCTION public.handle_new_user_leave_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT NEW.id, lt.id, EXTRACT(YEAR FROM now())::int, 12, 0
  FROM public.leave_types lt
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-create leave balances after user insert
CREATE TRIGGER on_user_created_leave_balances
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_leave_balances();
