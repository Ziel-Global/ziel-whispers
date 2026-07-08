-- Add notified column to project_members to track shown notifications
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS notified boolean DEFAULT false;

-- Mark existing memberships as notified so they don't see old notifications
UPDATE public.project_members SET notified = true;

-- Update RLS policies to allow employees to update the notified flag
-- The existing manage policy for admins/managers already covers it for them.
-- For employees, we need to allow updating ONLY the notified column on their own record.
-- However, given the current "Admin/Manager can manage" policy, we should add a specific update policy for employees.

CREATE POLICY "Employees can update their own notification status"
ON public.project_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
