-- Auto-create a task in the project's active sprint (or backlog if none)
-- when an employee submits a project log under "Other" (task_id IS NULL).

CREATE OR REPLACE FUNCTION public.create_task_for_other_log(
  p_project_id UUID,
  p_description TEXT
)
RETURNS TABLE(task_id UUID, status_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_tenant UUID := public.user_tenant_id();
  v_project_tenant UUID;
  v_workflow_template_id UUID;
  v_sprint_id UUID;
  v_status_id UUID;
  v_clean_desc TEXT;
  v_title VARCHAR(255);
  v_task_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.tenant_id, p.workflow_template_id
    INTO v_project_tenant, v_workflow_template_id
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF v_user_tenant IS NOT NULL AND v_project_tenant IS DISTINCT FROM v_user_tenant THEN
    RAISE EXCEPTION 'Access denied for project';
  END IF;

  -- Active sprint for the project, or NULL (backlog) if none is active
  SELECT s.id
    INTO v_sprint_id
  FROM public.sprints s
  WHERE s.project_id = p_project_id
    AND s.status = 'active'
  ORDER BY s.start_date DESC, s.created_at DESC
  LIMIT 1;

  -- Initial workflow status for the project's workflow template, if any
  IF v_workflow_template_id IS NOT NULL THEN
    SELECT ws.id
      INTO v_status_id
    FROM public.workflow_statuses ws
    WHERE ws.workflow_template_id = v_workflow_template_id
    ORDER BY ws.is_initial DESC, ws.sort_order ASC
    LIMIT 1;
  END IF;

  v_clean_desc := regexp_replace(btrim(COALESCE(p_description, '')), '\s+', ' ', 'g');
  IF v_clean_desc = '' THEN
    v_title := 'Other: Ad-hoc Task';
  ELSIF char_length(v_clean_desc) > 60 THEN
    v_title := 'Other: ' || left(v_clean_desc, 57) || '...';
  ELSE
    v_title := 'Other: ' || v_clean_desc;
  END IF;

  INSERT INTO public.tasks (
    project_id,
    sprint_id,
    title,
    description,
    assigned_to,
    priority,
    status,
    status_id,
    created_by,
    tenant_id
  )
  VALUES (
    p_project_id,
    v_sprint_id,
    v_title,
    p_description,
    v_user_id,
    'medium',
    'in_progress',
    v_status_id,
    v_user_id,
    v_project_tenant
  )
  RETURNING id INTO v_task_id;

  RETURN QUERY SELECT v_task_id, v_status_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_task_for_other_log(UUID, TEXT) TO authenticated;

