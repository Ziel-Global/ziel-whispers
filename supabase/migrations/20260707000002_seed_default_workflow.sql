-- Seed the default "Standard" workflow template and backfill existing data
DO $$
DECLARE
  v_template_id UUID;
  v_unlinked_id UUID;
  v_linked_id UUID;
  v_in_progress_id UUID;
  v_complete_id UUID;
  v_returned_id UUID;
BEGIN
  -- 1. Insert the default workflow template
  INSERT INTO public.workflow_templates (name, description)
  VALUES ('Standard', E'Default workflow: unlinked \u2192 linked \u2192 in_progress \u2192 complete')
  RETURNING id INTO v_template_id;

  -- 2. Insert the 5 standard statuses
  INSERT INTO public.workflow_statuses (workflow_template_id, name, category, color, sort_order, is_initial)
  VALUES (v_template_id, 'unlinked', 'todo', 'bg-gray-100 text-gray-800', 0, true)
  RETURNING id INTO v_unlinked_id;

  INSERT INTO public.workflow_statuses (workflow_template_id, name, category, color, sort_order)
  VALUES (v_template_id, 'linked', 'in_progress', 'bg-blue-100 text-blue-800', 1)
  RETURNING id INTO v_linked_id;

  INSERT INTO public.workflow_statuses (workflow_template_id, name, category, color, sort_order)
  VALUES (v_template_id, 'in_progress', 'in_progress', 'bg-yellow-100 text-yellow-800', 2)
  RETURNING id INTO v_in_progress_id;

  INSERT INTO public.workflow_statuses (workflow_template_id, name, category, color, sort_order)
  VALUES (v_template_id, 'complete', 'done', 'bg-green-100 text-green-800', 3)
  RETURNING id INTO v_complete_id;

  INSERT INTO public.workflow_statuses (workflow_template_id, name, category, color, sort_order)
  VALUES (v_template_id, 'returned', 'todo', 'bg-red-100 text-red-800', 4)
  RETURNING id INTO v_returned_id;

  -- 3. Insert allowed transitions
  -- unlinked -> linked
  INSERT INTO public.workflow_transitions (workflow_template_id, from_status_id, to_status_id)
  VALUES (v_template_id, v_unlinked_id, v_linked_id);

  -- linked -> unlinked, in_progress, complete, returned
  INSERT INTO public.workflow_transitions (workflow_template_id, from_status_id, to_status_id) VALUES
    (v_template_id, v_linked_id, v_unlinked_id),
    (v_template_id, v_linked_id, v_in_progress_id),
    (v_template_id, v_linked_id, v_complete_id),
    (v_template_id, v_linked_id, v_returned_id);

  -- in_progress -> unlinked, complete, returned
  INSERT INTO public.workflow_transitions (workflow_template_id, from_status_id, to_status_id) VALUES
    (v_template_id, v_in_progress_id, v_unlinked_id),
    (v_template_id, v_in_progress_id, v_complete_id),
    (v_template_id, v_in_progress_id, v_returned_id);

  -- returned -> unlinked, linked, in_progress, complete
  INSERT INTO public.workflow_transitions (workflow_template_id, from_status_id, to_status_id) VALUES
    (v_template_id, v_returned_id, v_unlinked_id),
    (v_template_id, v_returned_id, v_linked_id),
    (v_template_id, v_returned_id, v_in_progress_id),
    (v_template_id, v_returned_id, v_complete_id);

  -- complete -> in_progress, unlinked
  INSERT INTO public.workflow_transitions (workflow_template_id, from_status_id, to_status_id) VALUES
    (v_template_id, v_complete_id, v_in_progress_id),
    (v_template_id, v_complete_id, v_unlinked_id);

  -- 4. Backfill existing tasks: set status_id based on current status text
  UPDATE public.tasks t
  SET status_id = ws.id
  FROM public.workflow_statuses ws
  WHERE ws.workflow_template_id = v_template_id
    AND ws.name = t.status
    AND t.status_id IS NULL;

  -- 5. Backfill existing projects: assign default workflow template
  UPDATE public.projects
  SET workflow_template_id = v_template_id
  WHERE workflow_template_id IS NULL;
END $$;
