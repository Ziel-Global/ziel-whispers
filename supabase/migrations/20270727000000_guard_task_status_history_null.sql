CREATE OR REPLACE FUNCTION public.record_task_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_changed_by_type TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_changed_by_type := NULL;
  END;
  IF v_changed_by_type IS NULL OR v_changed_by_type NOT IN ('admin', 'system', 'auto') THEN
    v_changed_by_type := 'system';
  END IF;

  INSERT INTO public.task_status_history
    (task_id, from_status_id, to_status_id, changed_by_type, changed_by)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status_id ELSE NULL END,
    NEW.status_id,
    v_changed_by_type,
    auth.uid()
  );

  RETURN NEW;
END;
$$;
