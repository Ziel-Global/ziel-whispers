-- Fix RLS violation when creating a project: the trigger inserting into
-- project_settings runs as the calling user, but they aren't yet a member.
-- SECURITY DEFINER lets the trigger bypass RLS.
CREATE OR REPLACE FUNCTION public.create_default_project_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_settings (project_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
