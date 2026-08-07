-- Migration: Fix RLS policies on leave_requests to allow Admins and Managers to insert/update leave requests for any user

-- Enable RLS on leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 1. Admin / Manager full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admin full access on leave_requests" ON public.leave_requests;
CREATE POLICY "Admin full access on leave_requests"
  ON public.leave_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- 2. Users can insert their own leave requests
DROP POLICY IF EXISTS "Users can insert own leave requests" ON public.leave_requests;
CREATE POLICY "Users can insert own leave requests"
  ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- 3. Users can view their own leave requests
DROP POLICY IF EXISTS "Users can view own leave requests" ON public.leave_requests;
CREATE POLICY "Users can view own leave requests"
  ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
  );
