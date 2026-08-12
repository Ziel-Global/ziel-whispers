-- Update the attendance SELECT policy to allow all employees to see each other's status for the Team Today feature.
-- We drop the existing restrictive policy and replace it with one that allows all authenticated users to read records.
-- Note: Update, Insert, and Delete policies remain restricted to admin/owner.

DROP POLICY IF EXISTS "Admin/Manager can view all attendance" ON public.attendance;

CREATE POLICY "Authenticated users can view attendance records"
ON public.attendance
FOR SELECT
TO authenticated
USING (true);
