-- Add log reminder columns to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS log_reminder_time timestamptz;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS log_reminder_sent boolean NOT NULL DEFAULT false;

-- Schedule send-log-reminder to run every 5 minutes
SELECT cron.schedule(
  'send-log-reminder',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://goutpygixoxkgbrfmkey.supabase.co/functions/v1/send-log-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2dicmZta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzAyNTAsImV4cCI6MjA5MTMwNjI1MH0.QS-CXAblzMQdpk33rpn1ybbgF_dXfZfgIJu5Z9ZcSGs"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
  $$
);
