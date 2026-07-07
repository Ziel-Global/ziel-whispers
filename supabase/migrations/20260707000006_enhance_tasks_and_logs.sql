-- M2: Task & Log Enhancement
-- Adds due_date, client_visible, story_points to tasks
-- Adds task_id to daily_logs

-- Tasks enhancements
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points INTEGER;

-- Daily logs: add task_id if not already present
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Performance index for task lookups on daily_logs
CREATE INDEX IF NOT EXISTS idx_daily_logs_task_id ON daily_logs(task_id);
