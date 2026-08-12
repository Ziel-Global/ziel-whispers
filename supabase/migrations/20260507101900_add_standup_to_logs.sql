-- Add standup_done column to daily_logs table
ALTER TABLE public.daily_logs ADD COLUMN standup_done boolean DEFAULT true NOT NULL;

-- Ensure admins can update the standup_done column
-- Admmins usually have full access to daily_logs, but let's be explicit if needed.
-- Check if there's an existing update policy for admins.
-- Based on previous conversations, admins have 'Admin can manage' policies for most tables.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_logs' AND policyname = 'Admin can update daily logs'
    ) THEN
        CREATE POLICY "Admin can update daily logs" ON public.daily_logs
        FOR UPDATE TO authenticated
        USING (public.get_my_role() = 'admin')
        WITH CHECK (public.get_my_role() = 'admin');
    END IF;
END $$;
