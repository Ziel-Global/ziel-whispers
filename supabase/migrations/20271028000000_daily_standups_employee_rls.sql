-- Allow authenticated users to insert and update their own daily standups
DROP POLICY IF EXISTS "Users can manage their own standups" ON public.daily_standups;
CREATE POLICY "Users can manage their own standups" ON public.daily_standups
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
