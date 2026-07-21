-- Create a SECURITY DEFINER function to return all admin and manager IDs
-- This bypasses RLS on the users table so that non-admin callers
-- (e.g., employees creating blockers) can still notify all admins/managers.
CREATE OR REPLACE FUNCTION public.get_admin_manager_ids()
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id FROM public.users u WHERE u.role IN ('admin', 'manager');
$$;
