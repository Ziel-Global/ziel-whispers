-- ============================================
-- SECURITY FIX 1: Tighten users table RLS to authenticated only
-- ============================================
-- Drop existing policies that target {public} role (includes anon)
DROP POLICY IF EXISTS "Admin can insert users" ON public.users;
DROP POLICY IF EXISTS "Admin can update any user; employee can update own" ON public.users;
DROP POLICY IF EXISTS "Admin/Manager can view all users" ON public.users;

-- Recreate scoped to authenticated role only (anon cannot read)
CREATE POLICY "Admin can insert users"
ON public.users FOR INSERT TO authenticated
WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admin can update any user; employee can update own"
ON public.users FOR UPDATE TO authenticated
USING (public.get_my_role() = 'admin' OR id = auth.uid());

CREATE POLICY "Admin/Manager can view all users; employee own"
ON public.users FOR SELECT TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin','manager']) OR id = auth.uid());

-- ============================================
-- SECURITY FIX 2: audit_logs — prevent actor_id impersonation
-- ============================================
DROP POLICY IF EXISTS "Any authenticated user can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND actor_id = auth.uid());

-- ============================================
-- SECURITY FIX 3: login_attempts — block direct client INSERT
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON public.login_attempts;
-- No INSERT policy = only service_role (edge function) can insert.
-- SELECT policy for admins remains intact.

-- ============================================
-- SECURITY FIX 4: SET search_path on all functions
-- ============================================
ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
-- handle_new_user_leave_balances and calculate_late_clockin already SET search_path = public
