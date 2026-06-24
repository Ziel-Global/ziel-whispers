-- Migrate remote_work_requests from single date to date range
-- 1. Rename date → start_date
-- 2. Add end_date, backfill from start_date
-- 3. Add days_count

ALTER TABLE remote_work_requests RENAME COLUMN date TO start_date;

ALTER TABLE remote_work_requests ADD COLUMN end_date DATE;
UPDATE remote_work_requests SET end_date = start_date;
ALTER TABLE remote_work_requests ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE remote_work_requests ADD COLUMN days_count INTEGER NOT NULL DEFAULT 1;
UPDATE remote_work_requests SET days_count = 1;

-- Drop and recreate the RLS policy so it uses the new column name
DROP POLICY IF EXISTS "Users can view own remote work requests" ON remote_work_requests;
CREATE POLICY "Users can view own remote work requests" ON remote_work_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own remote work requests" ON remote_work_requests;
CREATE POLICY "Users can create own remote work requests" ON remote_work_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
