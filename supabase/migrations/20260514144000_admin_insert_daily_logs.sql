-- Add INSERT policy for admins on daily_logs
CREATE POLICY "Admins can insert daily logs" ON public.daily_logs
  FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'admin'
  );
