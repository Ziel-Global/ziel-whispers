-- Automatically disable expired bulk remote access at midnight every day
-- Only affects users where remote_access_bulk = true (set by the admin bulk enable button)
-- Users with individually-set remote access (remote_access_bulk IS NULL) are NOT touched

CREATE OR REPLACE FUNCTION public.cleanup_expired_remote_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET remote_access = false,
      remote_access_from = null,
      remote_access_to = null,
      remote_access_bulk = null
  WHERE remote_access_bulk = true
    AND remote_access_to < CURRENT_DATE;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-remote-access');
EXCEPTION WHEN OTHERS THEN
  -- Job may not exist yet, that's fine
END;
$$;

SELECT cron.schedule(
  'cleanup-expired-remote-access',
  '0 0 * * *',
  'SELECT public.cleanup_expired_remote_access();'
);
