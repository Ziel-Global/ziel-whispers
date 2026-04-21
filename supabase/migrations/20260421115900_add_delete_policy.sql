
-- Add missing DELETE policy for daily_logs
CREATE POLICY "Users can delete own unlocked logs" ON public.daily_logs
FOR DELETE
USING (
  (user_id = auth.uid() AND is_locked = false) OR 
  (public.get_my_role() = 'admin')
);
