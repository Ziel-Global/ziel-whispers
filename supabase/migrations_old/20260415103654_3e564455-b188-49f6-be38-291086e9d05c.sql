
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule auto-clockout at midnight every day
SELECT cron.schedule(
  'auto-clockout-midnight',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://goutpygixoxkgbrfmkey.supabase.co/functions/v1/auto-clockout',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2dicmZta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzAyNTAsImV4cCI6MjA5MTMwNjI1MH0.QS-CXAblzMQdpk33rpn1ybbgF_dXfZfgIJu5Z9ZcSGs"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
