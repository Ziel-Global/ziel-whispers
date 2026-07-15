-- Step 1: Check if any automation rules exist
SELECT id, name, trigger_type, status, conditions, actions FROM automation_rules
WHERE project_id = (SELECT id FROM projects WHERE name = 'Test Automation')
ORDER BY priority DESC;

-- Step 2: Check "Build the API" task
SELECT id, title, status, status_id, assigned_to, priority FROM tasks
WHERE project_id = (SELECT id FROM projects WHERE name = 'Test Automation')
ORDER BY title;
