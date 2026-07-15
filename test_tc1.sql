-- Step-by-step test without RAISE (use temporary table for results)
DROP TABLE IF EXISTS _test_result;
CREATE TEMP TABLE _test_result(msg text);

DO $$
DECLARE
  v_project_id uuid := (SELECT id FROM projects WHERE name = 'Test Automation');
  v_task_id uuid := (SELECT id FROM tasks WHERE title = 'Build the API' AND project_id = (SELECT id FROM projects WHERE name = 'Test Automation'));
  v_blocker_id uuid;
  v_status_before uuid;
  v_status_after uuid;
  v_run_count int;
  v_rule_id uuid;
BEGIN
  INSERT INTO _test_result VALUES ('project_id: ' || v_project_id);
  INSERT INTO _test_result VALUES ('task_id: ' || v_task_id);

  SELECT status_id INTO v_status_before FROM tasks WHERE id = v_task_id;
  INSERT INTO _test_result VALUES ('status before: ' || v_status_before);

  INSERT INTO task_blockers (project_id, task_id, description, raised_by)
  VALUES (v_project_id, v_task_id, 'TC1 test', '95c624cb-ac15-4337-b4df-dc77ee05b781'::uuid)
  RETURNING id INTO v_blocker_id;
  INSERT INTO _test_result VALUES ('blocker_id: ' || v_blocker_id);

  PERFORM run_automation_rules(v_project_id, 'blocker_raised', 'blocker', v_blocker_id);
  INSERT INTO _test_result VALUES ('engine done');

  SELECT status_id INTO v_status_after FROM tasks WHERE id = v_task_id;
  INSERT INTO _test_result VALUES ('status after: ' || v_status_after);

  SELECT COUNT(*) INTO v_run_count FROM automation_rule_runs WHERE entity_id = v_blocker_id;
  INSERT INTO _test_result VALUES ('run entries: ' || v_run_count);

  INSERT INTO _test_result VALUES ('blocker still exists: ' || (SELECT COUNT(*)::text FROM task_blockers WHERE id = v_blocker_id));

  -- Don't delete so we can inspect
END;
$$;

SELECT * FROM _test_result;
