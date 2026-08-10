-- Migration: Ensure all workflow templates have a 'Backlog' initial status, set up transitions, and assign unassigned tasks to Backlog

DO $$
DECLARE
  tmpl_rec RECORD;
  b_status_id UUID;
  next_status_id UUID;
BEGIN
  -- 1. Loop through all workflow templates
  FOR tmpl_rec IN SELECT id FROM public.workflow_templates LOOP
    -- Check if Backlog status exists for this template
    SELECT id INTO b_status_id
    FROM public.workflow_statuses
    WHERE workflow_template_id = tmpl_rec.id AND LOWER(name) = 'backlog'
    LIMIT 1;

    -- If Backlog status doesn't exist, create it with sort_order = -1
    IF b_status_id IS NULL THEN
      -- Set is_initial = false for all existing statuses in this template
      UPDATE public.workflow_statuses
      SET is_initial = false
      WHERE workflow_template_id = tmpl_rec.id;

      -- Insert new Backlog status with sort_order = -1 (always unique and sorts first)
      INSERT INTO public.workflow_statuses (
        workflow_template_id,
        name,
        category,
        color,
        sort_order,
        is_initial
      ) VALUES (
        tmpl_rec.id,
        'Backlog',
        'todo',
        'bg-gray-100 text-gray-800',
        -1,
        true
      ) RETURNING id INTO b_status_id;
    END IF;

    -- Find the next status (lowest non-Backlog status)
    SELECT id INTO next_status_id
    FROM public.workflow_statuses
    WHERE workflow_template_id = tmpl_rec.id AND id != b_status_id
    ORDER BY sort_order ASC
    LIMIT 1;

    -- Add default transition from Backlog to next status if next status exists
    IF next_status_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.workflow_transitions
        WHERE workflow_template_id = tmpl_rec.id AND from_status_id = b_status_id AND to_status_id = next_status_id
      ) THEN
        INSERT INTO public.workflow_transitions (
          workflow_template_id,
          from_status_id,
          to_status_id
        ) VALUES (
          tmpl_rec.id,
          b_status_id,
          next_status_id
        );
      END IF;
    END IF;
  END LOOP;

  -- 2. Update existing tasks with NULL status_id to point to Backlog status of their project's workflow template
  UPDATE public.tasks tsk
  SET status_id = (
    SELECT ws.id
    FROM public.projects p
    JOIN public.workflow_statuses ws ON ws.workflow_template_id = p.workflow_template_id
    WHERE p.id = tsk.project_id AND LOWER(ws.name) = 'backlog'
    LIMIT 1
  )
  WHERE tsk.status_id IS NULL;
END $$;
