-- Migration: Fix RLS policies on leave_requests table with robust role checks

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 1. DROP old policies
DROP POLICY IF EXISTS "Users can insert own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admin full access on leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can view own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admin can delete any; employee can delete own pending" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_select_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete_policy" ON public.leave_requests;

-- 2. CREATE robust INSERT policy
CREATE POLICY "leave_requests_insert_policy"
  ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (LOWER(users.role) LIKE '%admin%' OR LOWER(users.role) LIKE '%manager%')
    )
  );

-- 3. CREATE robust SELECT policy
CREATE POLICY "leave_requests_select_policy"
  ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (LOWER(users.role) LIKE '%admin%' OR LOWER(users.role) LIKE '%manager%')
    )
  );

-- 4. CREATE robust UPDATE policy
CREATE POLICY "leave_requests_update_policy"
  ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (LOWER(users.role) LIKE '%admin%' OR LOWER(users.role) LIKE '%manager%')
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (LOWER(users.role) LIKE '%admin%' OR LOWER(users.role) LIKE '%manager%')
    )
  );

-- 5. CREATE robust DELETE policy
CREATE POLICY "leave_requests_delete_policy"
  ON public.leave_requests
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (LOWER(users.role) LIKE '%admin%' OR LOWER(users.role) LIKE '%manager%')
    )
  );
