import { dbQuery } from "../helpers/dbClient";
import {
  STATUS_UNLINKED,
  STATUS_DEVELOPMENT,
  STATUS_QA_REVIEW,
  STATUS_DONE,
  USER_DEV_SAAD,
  USER_QA_SHAHID,
  USER_PM_SAMI,
  WORKFLOW_TEMPLATE_ID,
} from "./constants";

export interface TestTask {
  id: string;
  title: string;
  status_id: string;
  priority: string;
}

export interface TestContext {
  projectId: string;
  projectName: string;
  phaseId: string;
  tasks: Record<string, TestTask>;
  ruleIds: Record<string, string>;
}

export async function setupTestEnvironment(): Promise<TestContext> {
  const timestamp = Date.now();
  const projectName = `OmniPay Mobile Wallet [run-${timestamp}]`;

  // 1. Create Project
  const projRows = await dbQuery<{ id: string; name: string }>(
    `INSERT INTO projects (name, workflow_template_id, status, start_date) VALUES ('${projectName}', '${WORKFLOW_TEMPLATE_ID}', 'active', CURRENT_DATE) RETURNING id, name;`
  );

  if (!projRows || projRows.length === 0) {
    throw new Error("Failed to insert test project into database.");
  }

  const projectId = projRows[0].id;

  // 2. Create Project Phase
  const phaseRows = await dbQuery<{ id: string }>(
    `INSERT INTO project_phases (project_id, title) VALUES ('${projectId}', 'Phase 1 - Core Development') RETURNING id;`
  );

  if (!phaseRows || phaseRows.length === 0) {
    throw new Error("Failed to insert test project phase.");
  }

  const phaseId = phaseRows[0].id;

  // 3. Add Project Members
  await dbQuery(
    `INSERT INTO project_members (project_id, user_id) VALUES ('${projectId}', '${USER_DEV_SAAD}'), ('${projectId}', '${USER_QA_SHAHID}'), ('${projectId}', '${USER_PM_SAMI}');`
  );

  // 4. Seed Inventory Tasks
  const taskTitles = [
    { title: "Implement biometric authentication flow", priority: "high", status: STATUS_UNLINKED },
    { title: "Fix duplicate transaction charge bug", priority: "high", status: STATUS_DEVELOPMENT },
    { title: "Refactor payment gateway webhook retry", priority: "medium", status: STATUS_DEVELOPMENT },
    { title: "Design transaction receipt PDF exporter", priority: "low", status: STATUS_DEVELOPMENT },
    { title: "Sanitize JWT token storage in Keychain", priority: "high", status: STATUS_DEVELOPMENT },
    { title: "Update API documentation for v2 routes", priority: "medium", status: STATUS_DEVELOPMENT },
    { title: "Fix OAuth token expiration state crash", priority: "high", status: STATUS_DEVELOPMENT },
    { title: "Add push notification for failed reload", priority: "low", status: STATUS_DEVELOPMENT },
    { title: "QA review for dark mode theme toggle", priority: "medium", status: STATUS_DEVELOPMENT },
    { title: "Fix login redirect loop on slow network", priority: "high", status: STATUS_DEVELOPMENT },
    { title: "Optimize SQL query for transaction history", priority: "medium", status: STATUS_DEVELOPMENT },
    { title: "Audit biometric SDK memory consumption", priority: "high", status: STATUS_DEVELOPMENT },
    { title: "Add fingerprint fallback for older Android", priority: "low", status: STATUS_DEVELOPMENT },
    { title: "Fix currency symbol formatting in UI", priority: "low", status: STATUS_DEVELOPMENT },
    { title: "Validate session timeout modal popup", priority: "medium", status: STATUS_DEVELOPMENT },
    { title: "Integrate Apple Pay express checkout", priority: "high", status: STATUS_DEVELOPMENT },
    { title: "Patch SSL certificate pinning validator", priority: "high", status: STATUS_DEVELOPMENT },
    { title: "Setup transaction summary email alert", priority: "medium", status: STATUS_DEVELOPMENT },
    { title: "Enforce RBAC policy on refund endpoints", priority: "high", status: STATUS_DEVELOPMENT },
  ];

  const taskValues = taskTitles
    .map((t) => `('${projectId}', '${t.title}', '${t.status}', '${t.priority}')`)
    .join(", ");

  const insertedTasks = await dbQuery<{ id: string; title: string; status_id: string; priority: string }>(
    `INSERT INTO tasks (project_id, title, status_id, priority) VALUES ${taskValues} RETURNING id, title, status_id, priority;`
  );

  const tasksMap: Record<string, TestTask> = {};
  for (const row of insertedTasks) {
    tasksMap[row.title] = row;
  }

  // 5. Seed Automation Rules
  const rulesToInsert = [
    {
      key: "rule_2_1",
      name: "Auto-Return High Priority Bugs on Blocker",
      description: "Automated rule 2.1",
      trigger_type: "blocker_raised",
      conditions: JSON.stringify([{ field: "priority", operator: "eq", value: "high" }]),
      actions: JSON.stringify([{ type: "change_status", params: { status_id: STATUS_QA_REVIEW } }]),
      status: "enabled",
      priority: 10,
    },
    {
      key: "rule_2_3",
      name: "Assign Critical Dev Blockers to Project Manager",
      description: "Automated rule 2.3",
      trigger_type: "blocker_raised",
      conditions: JSON.stringify([
        { field: "priority", operator: "eq", value: "low" },
        { field: "status_id", operator: "eq", value: STATUS_DEVELOPMENT },
      ]),
      actions: JSON.stringify([{ type: "assign_user", params: { user_id: USER_PM_SAMI } }]),
      status: "enabled",
      priority: 10,
    },
    {
      key: "rule_2_4",
      name: "Global Blocker Audit Logger",
      description: "Automated rule 2.4",
      trigger_type: "blocker_raised",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: "add_comment", params: { body: "System Alert: A blocker was reported on this task." } }]),
      status: "enabled",
      priority: 1,
    },
    {
      key: "rule_2_5",
      name: "Escalate API Doc Blocker",
      description: "Automated rule 2.5",
      trigger_type: "blocker_raised",
      conditions: JSON.stringify([{ field: "priority", operator: "eq", value: "medium" }]),
      actions: JSON.stringify([
        { type: "assign_user", params: { user_id: USER_DEV_SAAD } },
        { type: "add_comment", params: { body: "Escalated to lead developer Saad Nasir." } },
      ]),
      status: "enabled",
      priority: 10,
    },
    {
      key: "rule_2_6",
      name: "Resume Development on Blocker Clearance",
      description: "Automated rule 2.6",
      trigger_type: "blocker_resolved",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([{ type: "change_status", params: { status_id: STATUS_DEVELOPMENT } }]),
      status: "enabled",
      priority: 10,
    },
    {
      key: "rule_2_7",
      name: "Toggle Test Rule",
      description: "Automated rule 2.7",
      trigger_type: "blocker_raised",
      conditions: JSON.stringify([{ field: "priority", operator: "eq", value: "low" }]),
      actions: JSON.stringify([{ type: "change_status", params: { status_id: STATUS_DONE } }]),
      status: "enabled",
      priority: 2,
    },
    {
      key: "rule_3_1",
      name: "Auto-Assign QA Lead on QA Review Transition",
      description: "Automated rule 3.1",
      trigger_type: "status_change",
      conditions: JSON.stringify([{ field: "status_id", operator: "eq", value: STATUS_QA_REVIEW }]),
      actions: JSON.stringify([{ type: "assign_user", params: { user_id: USER_QA_SHAHID } }]),
      status: "enabled",
      priority: 5,
    },
    {
      key: "rule_4_1",
      name: "Return QA Rejections to Original Developer",
      description: "Automated rule 4.1",
      trigger_type: "status_change",
      conditions: JSON.stringify([{ field: "status_id", operator: "eq", value: STATUS_DEVELOPMENT }]),
      actions: JSON.stringify([
        {
          type: "reassign_to_stage_owner",
          params: { status_id: STATUS_DEVELOPMENT, lookup_by: "from" },
        },
      ]),
      status: "enabled",
      priority: 10,
    },
    {
      key: "rule_9_1",
      name: "Notify Developer on QA Transition",
      description: "Automated rule 9.1",
      trigger_type: "status_change",
      conditions: JSON.stringify([{ field: "status_id", operator: "eq", value: STATUS_QA_REVIEW }]),
      actions: JSON.stringify([
        {
          type: "notify_user",
          params: {
            recipient: "task_assignee",
            title: "QA Review Pending",
            message_template: "Task {task_title} moved to QA in project {project_name}",
          },
        },
      ]),
      status: "enabled",
      priority: 5,
    },
  ];

  const ruleValues = rulesToInsert
    .map(
      (r) =>
        `('${projectId}', '${r.name}', '${r.description}', '${r.trigger_type}', '${r.conditions}'::jsonb, '${r.actions}'::jsonb, '${r.status}', ${r.priority})`
    )
    .join(", ");

  const insertedRules = await dbQuery<{ id: string; name: string }>(
    `INSERT INTO automation_rules (project_id, name, description, trigger_type, conditions, actions, status, priority) VALUES ${ruleValues} RETURNING id, name;`
  );

  const ruleIds: Record<string, string> = {};
  for (let i = 0; i < rulesToInsert.length; i++) {
    const key = rulesToInsert[i].key;
    if (insertedRules[i]) {
      ruleIds[key] = insertedRules[i].id;
    }
  }

  return {
    projectId,
    projectName,
    phaseId,
    tasks: tasksMap,
    ruleIds,
  };
}

export async function teardownTestEnvironment(projectId?: string): Promise<void> {
  if (!projectId) return;

  console.log(`[TEARDOWN] Cleaning up test project ID: ${projectId}...`);
  try {
    await dbQuery(`DELETE FROM projects WHERE id = '${projectId}';`);
    console.log(`[TEARDOWN] Project ${projectId} deleted successfully.`);
  } catch (err: any) {
    console.error(`[TEARDOWN ERROR] Exception during teardown: ${err.message}`);
  }
}
