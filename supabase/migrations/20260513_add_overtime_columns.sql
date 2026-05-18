-- Add overtime_enabled to users table (default false)
ALTER TABLE users ADD COLUMN IF NOT EXISTS overtime_enabled BOOLEAN DEFAULT false;

-- Add is_overtime to daily_logs table (default false)
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT false;
