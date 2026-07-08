-- Add status column to daily_logs for draft/submitted workflow
-- Default is 'submitted' so all existing records remain correct
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

-- Add a check constraint for valid status values
ALTER TABLE public.daily_logs ADD CONSTRAINT daily_logs_status_check
  CHECK (status IN ('draft', 'submitted'));

-- Allow employees to update their own draft logs (edit before submit)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_logs' AND policyname = 'Users can update own draft logs'
    ) THEN
        CREATE POLICY "Users can update own draft logs" ON public.daily_logs
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid() AND status = 'draft')
        WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- Allow employees to delete their own draft logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_logs' AND policyname = 'Users can delete own draft logs'
    ) THEN
        CREATE POLICY "Users can delete own draft logs" ON public.daily_logs
        FOR DELETE TO authenticated
        USING (user_id = auth.uid() AND status = 'draft');
    END IF;
END $$;
