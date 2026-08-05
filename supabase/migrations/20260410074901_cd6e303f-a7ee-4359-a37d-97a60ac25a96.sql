
-- Allow admins to manage leave balances
CREATE POLICY "Admin can insert leave balances"
ON public.leave_balances FOR INSERT
WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admin can update leave balances"
ON public.leave_balances FOR UPDATE
USING (public.get_my_role() = 'admin');

CREATE POLICY "Admin can delete leave balances"
ON public.leave_balances FOR DELETE
USING (public.get_my_role() = 'admin');

-- Allow authenticated users to insert notifications
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update own notifications (e.g. mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

-- Allow admins to insert missed logs
CREATE POLICY "Admin can insert missed logs"
ON public.missed_logs FOR INSERT
WITH CHECK (public.get_my_role() = 'admin');
