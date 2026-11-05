# Ziel Log System — Database Schema & Relational Architecture

## Schema Overview
The database layer is hosted on PostgreSQL (Supabase 14+), featuring Row Level Security (RLS) on all production tables, database-level constraint enforcement, automated audit triggers, dynamic `pg_cron` jobs, and high-performance RPC functions.

The schema comprises **49 relational tables** grouped into functional domains:
1. **User Identity & Access**: `users`, `login_attempts`, `system_settings`, `audit_logs`
2. **Attendance & Time Tracking**: `attendance`, `auto_clockout_acks`, `remote_work_requests`
3. **Daily Work Logs & Standups**: `daily_logs`, `daily_standups`, `missed_logs`
4. **Leave Management**: `leave_requests`, `leave_balances`, `leave_types`
5. **Project Engine**: `projects`, `project_settings`, `project_settings_kv`, `project_roles`, `project_members`, `project_phases`, `sprints`, `sprint_snapshots`, `project_health_snapshots`, `project_status_updates`
6. **Task Execution & Workflow Engine**: `workflow_templates`, `workflow_statuses`, `workflow_transitions`, `task_types`, `tasks`, `task_collaborators`, `task_dependencies`, `task_comments`, `task_blockers`, `task_status_history`, `task_schedule_snapshots`
7. **Automation Engine**: `automation_rules`, `automation_rule_runs`
8. **Client Portal**: `clients`, `client_action_items`, `client_action_item_messages`, `client_portal_messages`
9. **Skill Metrics**: `skills`, `employee_skills`, `project_skill_requirements`, `skill_evaluations`
10. **Communications**: `announcements`, `announcement_reads`, `notifications`
11. **Legacy / Compatibility**: `goals`, `goal_resources`

---

## 1. Complete Table Definitions & Column Specifications

### `users`
Master employee, manager, administrator, and client account directory.
- `id` (uuid, PK): Maps 1:1 with Supabase Auth `auth.users.id`.
- `full_name` (text, NOT NULL): Employee full legal/display name.
- `email` (text, NOT NULL, UNIQUE): System login email.
- `role` (text, NOT NULL): Allowed values: `'admin'`, `'manager'`, `'employee'`, `'client'`, `'client member'`.
- `department` (text, NOT NULL): Department name (e.g., Engineering, Design, HR, SQA).
- `designation` (text, NOT NULL): Professional role title.
- `status` (text, NOT NULL, DEFAULT `'active'`): Status flag (`'active'`, `'inactive'`).
- `must_change_password` (boolean, NOT NULL, DEFAULT `false`): Flag forcing password update on next login.
- `working_days` (numeric, NOT NULL, DEFAULT `5`): Work week schedule: `5` (Mon–Fri) or `6` (Mon–Sat).
- `join_date` (date, nullable): Formal employment commencement date.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`): Record creation timestamp.
- `avatar_url` (text, nullable): Storage path or external URL for user avatar.
- `shift_start` (text, nullable): Custom shift start in `HH:mm` format (PKT).
- `shift_end` (text, nullable): Custom shift end in `HH:mm` format (PKT).
- `has_custom_shift` (boolean, NOT NULL, DEFAULT `false`): Enables user-specific shift times over global defaults.
- `overtime_enabled` (boolean, NOT NULL, DEFAULT `false`): Grants permission to record billable overtime past 8 hours.
- `remote_access` (boolean, NOT NULL, DEFAULT `false`): Allows remote clock-in within specified date bounds.
- `remote_access_from` (date, nullable): Beginning of remote clock-in eligibility.
- `remote_access_to` (date, nullable): End of remote clock-in eligibility.
- `remote_access_bulk` (boolean, nullable): Flag indicating remote access was granted via global administrative broadcast.
- `log_edit_days` (integer, nullable): Custom grace window for editing historical logs (overrides system default).
- `is_oversight` (boolean, NOT NULL, DEFAULT `false`): Flags high-visibility team members for special managerial tracking.
- `client_id` (uuid, nullable): Foreign key to `clients.id` for external client member accounts.

---

### `attendance`
Clock-in, clock-out, geofence audit, and shift completion logs.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`): Unique attendance session record.
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE): Employee ID.
- `date` (date, NOT NULL): Calendar date in PKT (`YYYY-MM-DD`).
- `clock_in` (timestamptz, nullable): Exact clock-in timestamp with timezone.
- `clock_out` (timestamptz, nullable): Exact clock-out timestamp with timezone.
- `work_mode` (text, NOT NULL): Working environment: `'onsite'` or `'remote'`.
- `notes` (text, nullable): Employee optional shift notes.
- `is_late` (boolean, NOT NULL, DEFAULT `false`): Computed late arrival flag.
- `minutes_late` (integer, NOT NULL, DEFAULT `0`): Lateness duration in minutes past grace period.
- `auto_clocked_out` (boolean, NOT NULL, DEFAULT `false`): True if closed by automated midnight cleanup cron.
- `log_reminder_time` (timestamptz, nullable): Calculated reminder time (15 mins prior to shift end).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`): Creation timestamp.

---

### `auto_clockout_acks`
User acknowledgment of automated midnight clock-outs.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `attendance_id` (uuid, NOT NULL, FK -> `attendance.id` ON DELETE CASCADE).
- `acknowledged_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `daily_logs`
Hour-attributed daily work records and task progression submissions.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `project_id` (uuid, nullable, FK -> `projects.id` ON DELETE SET NULL): Nullable for miscellaneous work.
- `task_id` (uuid, nullable, FK -> `tasks.id` ON DELETE SET NULL): Associated task execution unit.
- `category` (text, NOT NULL): Log category (e.g., `development`, `meeting`, `bug_fix`, `code_review`, `testing`).
- `hours` (numeric(4,2), NOT NULL): Duration worked (min 0.25, max 24.0).
- `description` (text, NOT NULL): Narrative of activities completed (minimum 20 characters).
- `log_date` (date, NOT NULL): Date work occurred in PKT.
- `status` (text, NOT NULL, DEFAULT `'draft'`): Workflow state: `'draft'`, `'submitted'`.
- `is_late` (boolean, NOT NULL, DEFAULT `false`): Submission deadline breach indicator.
- `is_overtime` (boolean, NOT NULL, DEFAULT `false`): Hours exceeding regular shift allocation.
- `status_id` (uuid, nullable, FK -> `workflow_statuses.id`): Status of task at time of logging.
- `hours_status_id` (uuid, nullable, FK -> `workflow_statuses.id`): Explicit status to which logged hours are credited.
- `declared_transition_to` (uuid, nullable, FK -> `workflow_statuses.id`): Requested destination status.
- `declared_outcome_status_id` (uuid, nullable, FK -> `workflow_statuses.id`): Alias for requested transition.
- `submitted_at` (timestamptz, nullable): Timestamp of final submission.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `updated_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `daily_standups`
Standup participation tracking independent of work logs.
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `date` (date, NOT NULL): PKT calendar date.
- `is_done` (boolean, NOT NULL, DEFAULT `true`): Completion flag.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- *Primary Key*: Composite `(user_id, date)`.

---

### `missed_logs`
System-generated alerts for employees with missing work logs.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `date` (date, NOT NULL): Date of missing log.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `resolved_at` (timestamptz, nullable): When the user resolved the missed log.

---

### `leave_requests`
Employee leave and absence applications.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `leave_type_id` (uuid, NOT NULL, FK -> `leave_types.id`).
- `start_date` (date, NOT NULL): Initial absence date.
- `end_date` (date, NOT NULL): Concluding absence date.
- `days_count` (numeric(4,1), NOT NULL): Total full days calculated.
- `hours` (numeric(4,1), nullable): Specific duration for hourly leave requests.
- `reason` (text, NOT NULL): Justification provided by applicant.
- `status` (text, NOT NULL, DEFAULT `'pending'`): Status: `'pending'`, `'approved'`, `'rejected'`, `'cancelled'`.
- `reviewed_by` (uuid, nullable, FK -> `users.id`): Reviewing manager/admin ID.
- `reviewed_at` (timestamptz, nullable): Decision timestamp.
- `admin_comment` (text, nullable): Administrative rationale or conditions.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `updated_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `leave_balances`
Allocated vs. consumed employee leave entitlements.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `leave_type_id` (uuid, NOT NULL, FK -> `leave_types.id`).
- `year` (integer, NOT NULL): Leave year starting year (e.g. 2026 for 2026-06-01 to 2027-05-31).
- `allocated` (numeric(4,1), NOT NULL, DEFAULT `0`): Annual allowance.
- `used` (numeric(4,1), NOT NULL, DEFAULT `0`): Cumulative consumed days.
- *Unique Constraint*: `(user_id, leave_type_id, year)`.

---

### `leave_types`
Catalogue of leave categories and standard allocations.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `name` (text, NOT NULL, UNIQUE): Category title (Sick, Casual, Annual, Hourly).
- `days_allowed` (integer, NOT NULL, DEFAULT `12`): Base default quota.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `remote_work_requests`
Formal Work-From-Home (WFH) applications.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `date` (date, NOT NULL): Requested remote date.
- `reason` (text, NOT NULL): Justification.
- `status` (text, NOT NULL, DEFAULT `'pending'`): Status: `'pending'`, `'approved'`, `'rejected'`.
- `reviewed_by` (uuid, nullable, FK -> `users.id`).
- `reviewed_at` (timestamptz, nullable).
- `admin_comment` (text, nullable).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `projects`
Central project entity and organizational container.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `name` (text, NOT NULL): Project name.
- `description` (text, nullable): Project summary and objectives.
- `client_id` (uuid, nullable, FK -> `clients.id` ON DELETE SET NULL): Sponsoring client.
- `status` (text, NOT NULL, DEFAULT `'active'`): Lifecycle: `'active'`, `'on_hold'`, `'completed'`, `'archived'`.
- `workflow_template_id` (uuid, nullable, FK -> `workflow_templates.id`): Active workflow blueprint.
- `start_date` (date, nullable): Project launch date.
- `end_date` (date, nullable): Target completion date.
- `document_link` (text, nullable): External specification or document repository link.
- `client_visible` (boolean, NOT NULL, DEFAULT `false`): Toggles client portal accessibility.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `updated_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `project_settings` & `project_settings_kv`
Dynamic key-value configuration store scoping features per project.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, nullable, FK -> `projects.id` ON DELETE CASCADE): Null indicates organization default.
- `key` (text, NOT NULL): Setting identifier (e.g. `structure.phases.enabled`, `task.subtask.max_depth`).
- `value` (jsonb / text, NOT NULL): Configuration value.
- *Unique Constraint*: `(project_id, key)`.

---

### `project_roles`
Configurable project-level member roles (e.g. Tech Lead, Product Owner, Senior Developer).
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `name` (text, NOT NULL): Role name.
- `permissions` (jsonb, NOT NULL, DEFAULT `'[]'::jsonb`): Granular permission flags.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `project_members`
Association between users, projects, and specific project roles.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `project_role_id` (uuid, nullable, FK -> `project_roles.id` ON DELETE SET NULL).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `removed_at` (timestamptz, nullable): Soft deletion marker.
- *Unique Constraint*: `(project_id, user_id)` where `removed_at IS NULL`.

---

### `project_phases`
Ordered developmental or delivery stages within a project.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `name` (text, NOT NULL): Phase title.
- `sort_order` (integer, NOT NULL, DEFAULT `0`): Sequential ordering.
- `start_date` (date, nullable): Planned phase start.
- `end_date` (date, nullable): Planned phase finish.
- `status` (text, NOT NULL, DEFAULT `'planned'`): Status: `'planned'`, `'active'`, `'completed'`.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `sprints`
Time-boxed agile execution iterations.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `phase_id` (uuid, nullable, FK -> `project_phases.id` ON DELETE SET NULL): Optional nesting in a Phase.
- `name` (text, NOT NULL): Sprint title (e.g. "Sprint 24").
- `start_date` (date, NOT NULL): Iteration start date.
- `end_date` (date, NOT NULL): Iteration conclusion date.
- `status` (text, NOT NULL, DEFAULT `'planned'`): Status: `'planned'`, `'active'`, `'completed'`.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `sprint_snapshots`
Historical point-in-time metrics captured upon sprint completion.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `sprint_id` (uuid, NOT NULL, FK -> `sprints.id` ON DELETE CASCADE).
- `total_tasks` (integer, NOT NULL).
- `completed_tasks` (integer, NOT NULL).
- `total_hours_logged` (numeric(8,2), NOT NULL).
- `snapshot_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `workflow_templates`
Reusable workflow models defining the state progression of tasks.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `name` (text, NOT NULL, UNIQUE): Template name (e.g. "Standard Development", "Design Sprint").
- `description` (text, nullable): Scope and methodology summary.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `workflow_statuses`
Statuses defining stages within a workflow template.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `workflow_template_id` (uuid, NOT NULL, FK -> `workflow_templates.id` ON DELETE CASCADE).
- `name` (text, NOT NULL): Status title (e.g., Backlog, In Development, Code Review, Quality Assurance, Done).
- `category` (text, NOT NULL): High-level category: `'todo'`, `'in_progress'`, `'done'`.
- `color` (text, NOT NULL, DEFAULT `'bg-gray-100 text-gray-800'`): UI badge styling.
- `sort_order` (integer, NOT NULL, DEFAULT `0`): Column display order.
- `is_initial` (boolean, NOT NULL, DEFAULT `false`): Target status on task creation.
- `retired` (boolean, NOT NULL, DEFAULT `false`): Soft retirement flag preventing future transitions while preserving historical tasks.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `workflow_transitions`
Directed graphs defining valid movements between workflow statuses.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `workflow_template_id` (uuid, NOT NULL, FK -> `workflow_templates.id` ON DELETE CASCADE).
- `from_status_id` (uuid, nullable, FK -> `workflow_statuses.id` ON DELETE CASCADE): Source status (null represents creation).
- `to_status_id` (uuid, NOT NULL, FK -> `workflow_statuses.id` ON DELETE CASCADE): Target status.
- `allowed_role_ids` (text[] / uuid[], nullable): Array of `project_roles.id` authorized to execute transition.

---

### `task_types`
Project-defined classifications for execution units (e.g. Story, Bug, Spike, Task).
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `name` (text, NOT NULL): Classification title.
- `icon` (text, nullable): Visual icon identifier.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `tasks`
The universal work unit within the platform.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `task_type_id` (uuid, nullable, FK -> `task_types.id` ON DELETE SET NULL).
- `title` (text, NOT NULL): Task headline.
- `description` (text, nullable): Detailed task brief.
- `status_id` (uuid, NOT NULL, FK -> `workflow_statuses.id`): Active workflow state.
- `assigned_to` (uuid, nullable, FK -> `users.id` ON DELETE SET NULL): Primary responsible assignee.
- `priority` (text, NOT NULL, DEFAULT `'medium'`): Priority: `'low'`, `'medium'`, `'high'`.
- `phase_id` (uuid, nullable, FK -> `project_phases.id` ON DELETE SET NULL): Linked structural phase.
- `sprint_id` (uuid, nullable, FK -> `sprints.id` ON DELETE SET NULL): Linked iteration.
- `parent_id` (uuid, nullable, FK -> `tasks.id` ON DELETE CASCADE): Parent task for direct subtasks.
- `require_subtasks_done` (boolean, NOT NULL, DEFAULT `false`): Gate blocking completion if child subtasks are open.
- `estimated_hours` (numeric(6,2), nullable): Planned effort.
- `due_date` (date, nullable): Target delivery date.
- `completed_at` (timestamptz, nullable): Timestamp of terminal status entry.
- `is_flagged` (boolean, NOT NULL, DEFAULT `false`): Synced boolean indicating active blockers.
- `client_visible` (boolean, NOT NULL, DEFAULT `true`): Visibility toggle for client portal.
- `version` (integer, NOT NULL, DEFAULT `1`): Optimistic concurrency locking counter.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `updated_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `task_collaborators`
Secondary team contributors attached to a task alongside the primary assignee.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `task_id` (uuid, NOT NULL, FK -> `tasks.id` ON DELETE CASCADE).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `added_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- *Unique Constraint*: `(task_id, user_id)`.

---

### `task_dependencies`
Predecessor and successor constraints between tasks.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `task_id` (uuid, NOT NULL, FK -> `tasks.id` ON DELETE CASCADE): Dependent task.
- `depends_on_task_id` (uuid, NOT NULL, FK -> `tasks.id` ON DELETE CASCADE): Prerequisite task.
- `dependency_type` (text, NOT NULL, DEFAULT `'finish_to_start'`): Dependency rule.
- *Check Constraint*: `task_id != depends_on_task_id`.
- *Unique Constraint*: `(task_id, depends_on_task_id)`.

---

### `task_blockers`
Impediments obstructing progress on a task.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `task_id` (uuid, NOT NULL, FK -> `tasks.id` ON DELETE CASCADE).
- `reason` (text, NOT NULL): Narrative description of impediment.
- `status` (text, NOT NULL, DEFAULT `'open'`): Status: `'open'`, `'resolved'`.
- `created_by` (uuid, NOT NULL, FK -> `users.id`).
- `resolved_by` (uuid, nullable, FK -> `users.id`).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `resolved_at` (timestamptz, nullable).

---

### `task_comments`
Discussion thread and historical remarks on a task.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `task_id` (uuid, NOT NULL, FK -> `tasks.id` ON DELETE CASCADE).
- `author_id` (uuid, nullable, FK -> `users.id` ON DELETE SET NULL).
- `author_type` (text, NOT NULL, DEFAULT `'user'`): Author classification: `'user'`, `'client'`, `'system'`.
- `body` (text, NOT NULL): Comment content.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `task_status_history`
Immutable audit log recording every task workflow status change.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `task_id` (uuid, NOT NULL, FK -> `tasks.id` ON DELETE CASCADE).
- `from_status_id` (uuid, nullable, FK -> `workflow_statuses.id`).
- `to_status_id` (uuid, nullable, FK -> `workflow_statuses.id`).
- `changed_by` (uuid, nullable, FK -> `users.id`).
- `changed_by_type` (text, NOT NULL, DEFAULT `'manual'`): Attribution: `'manual'`, `'system'`, `'automation'`, `'admin_override'`.
- `assigned_to_at_change` (uuid, nullable, FK -> `users.id`): Assignee snapshot at transition instant.
- `source` (text, NOT NULL, DEFAULT `'manual'`): Source channel.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `task_schedule_snapshots`
Analytical snapshots of task timeline variance for critical path analysis.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `task_id` (uuid, NOT NULL, FK -> `tasks.id` ON DELETE CASCADE).
- `planned_start` (date, nullable).
- `planned_end` (date, nullable).
- `actual_start` (date, nullable).
- `actual_end` (date, nullable).
- `snapshot_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `project_health_snapshots`
Calculated overall project health scores and trend indicators.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `health_score` (numeric(5,2), NOT NULL): 0–100 health composite.
- `schedule_variance_days` (integer, NOT NULL, DEFAULT `0`).
- `open_blockers_count` (integer, NOT NULL, DEFAULT `0`).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `project_status_updates`
Formal project milestone summaries published to team and clients.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `author_id` (uuid, NOT NULL, FK -> `users.id`).
- `title` (text, NOT NULL): Summary headline.
- `body` (text, NOT NULL): Status report narrative.
- `overall_status` (text, NOT NULL, DEFAULT `'on_track'`): `'on_track'`, `'at_risk'`, `'delayed'`.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `automation_rules`
Declarative triggers, conditions, and actions for project workflow automation.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `name` (text, NOT NULL): Rule title.
- `description` (text, NOT NULL): Intended automation behavior.
- `status` (text, NOT NULL, DEFAULT `'draft'`): `'draft'`, `'enabled'`, `'disabled'`.
- `trigger_type` (text, NOT NULL): Trigger: `'status_change'`, `'task_created'`, `'task_blocked'`, `'blocker_resolved'`, `'scheduled'`.
- `conditions` (jsonb, NOT NULL, DEFAULT `'[]'::jsonb`): Criteria array.
- `actions` (jsonb, NOT NULL, DEFAULT `'[]'::jsonb`): Execution payload array.
- `allow_triggering_other_rules` (boolean, NOT NULL, DEFAULT `false`): Enables recursive rule chaining.
- `priority` (integer, NOT NULL, DEFAULT `0`): Sequential priority weighting.
- `created_by` (uuid, nullable, FK -> `users.id`).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `updated_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `automation_rule_runs`
Audit and execution results for automated rule triggers.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `automation_rule_id` (uuid, NOT NULL, FK -> `automation_rules.id` ON DELETE CASCADE).
- `entity_type` (text, NOT NULL): Target entity type (e.g. `'task'`, `'blocker'`).
- `entity_id` (uuid, nullable): Target primary key.
- `root_event_id` (uuid, NOT NULL): Correlating root identifier for chain depth management.
- `result` (text, NOT NULL): Outcome: `'success'`, `'failed'`, `'skipped'`, `'condition_not_met'`.
- `error_message` (text, nullable): Failure diagnostic string.
- `triggered_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `clients`
External customer organizations.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `name` (text, NOT NULL): Organization name.
- `industry` (text, nullable): Industry vertical.
- `contact_name` (text, nullable): Key representative.
- `contact_email` (text, nullable): Representative email.
- `contact_phone` (text, nullable): Phone / location field.
- `status` (text, NOT NULL, DEFAULT `'active'`): `'active'`, `'archived'`.
- `notes` (text, nullable): Internal administrative commentary.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `client_action_items`
Deliverable requests or decisions assigned to client representatives.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `title` (text, NOT NULL): Action item title.
- `description` (text, nullable): Detailed request specifications.
- `status` (text, NOT NULL, DEFAULT `'pending'`): Status: `'pending'`, `'completed'`, `'cancelled'`.
- `priority` (text, NOT NULL, DEFAULT `'medium'`): Priority rating.
- `assigned_to` (uuid, nullable, FK -> `users.id`): Targeted client member or manager.
- `blocker_id` (uuid, nullable, FK -> `task_blockers.id` ON DELETE SET NULL): Linked internal task blocker.
- `due_date` (date, nullable): Target resolution date.
- `created_by` (uuid, NOT NULL, FK -> `users.id`).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- `completed_at` (timestamptz, nullable).

---

### `client_action_item_messages`
Discussion thread on individual client action items.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `action_item_id` (uuid, NOT NULL, FK -> `client_action_items.id` ON DELETE CASCADE).
- `user_id` (uuid, NOT NULL, FK -> `users.id`).
- `message` (text, NOT NULL): Comment content.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `client_portal_messages`
Global client-team communication channel for a project.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `user_id` (uuid, NOT NULL, FK -> `users.id`).
- `message` (text, NOT NULL): Bulletin message text.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `skills`
Master registry of organizational competencies.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `name` (text, NOT NULL, UNIQUE): Skill title (e.g. "React", "PostgreSQL", "UI Design").
- `category` (text, NOT NULL): Classification: `'Technical'`, `'Soft Skill'`, `'Domain'`, `'Tools'`.
- `description` (text, nullable): Proficiency description.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `employee_skills`
Employee assessed capabilities and proficiency levels.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `skill_id` (uuid, NOT NULL, FK -> `skills.id` ON DELETE CASCADE).
- `proficiency_level` (integer, NOT NULL CHECK (`proficiency_level BETWEEN 1 AND 5`)): 1=Beginner to 5=Master.
- `updated_at` (timestamptz, NOT NULL, DEFAULT `now()`).
- *Unique Constraint*: `(user_id, skill_id)`.

---

### `project_skill_requirements`
Minimum competencies required for staffing a project.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `project_id` (uuid, NOT NULL, FK -> `projects.id` ON DELETE CASCADE).
- `skill_id` (uuid, NOT NULL, FK -> `skills.id` ON DELETE CASCADE).
- `required_proficiency_level` (integer, NOT NULL CHECK (`required_proficiency_level BETWEEN 1 AND 5`)).
- `weight` (numeric(3,2), NOT NULL, DEFAULT `1.0`): Importance factor.
- *Unique Constraint*: `(project_id, skill_id)`.

---

### `skill_evaluations`
Managerial and peer evaluation history for skill proficiency calibration.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE): Evaluated member.
- `skill_id` (uuid, NOT NULL, FK -> `skills.id` ON DELETE CASCADE): Target competency.
- `evaluator_id` (uuid, NOT NULL, FK -> `users.id`): Scoring manager/evaluator.
- `score` (integer, NOT NULL CHECK (`score BETWEEN 1 AND 5`)): Calibrated level.
- `comments` (text, nullable): Qualitative feedback.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `announcements` & `announcement_reads`
Company-wide and role-targeted broadcast communications.
- `announcements`: `id` (uuid, PK), `title` (text), `body` (text), `priority` (`'normal'`, `'high'`, `'urgent'`), `audience` (`'all'`, `'engineering'`, etc.), `publish_at` (timestamptz), `created_by` (uuid, FK -> `users.id`), `created_at` (timestamptz).
- `announcement_reads`: `id` (uuid, PK), `announcement_id` (uuid, FK -> `announcements.id` ON DELETE CASCADE), `user_id` (uuid, FK -> `users.id` ON DELETE CASCADE), `read_at` (timestamptz), `dismissed` (boolean).

---

### `notifications`
In-app user notification inbox.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `user_id` (uuid, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `type` (text, NOT NULL): Notification classification.
- `channel` (text, NOT NULL, DEFAULT `'in_app'`).
- `metadata` (jsonb, NOT NULL, DEFAULT `'{}'::jsonb`): Title, message, project link, etc.
- `read` (boolean, NOT NULL, DEFAULT `false`).
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `audit_logs`
Centralized compliance and governance event trail.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `actor_id` (uuid, nullable, FK -> `users.id` ON DELETE SET NULL): Author of action.
- `action` (text, NOT NULL): Domain event key (e.g. `'attendance.clocked_in'`, `'log.bulk_submitted'`, `'user.created'`).
- `target_entity` (text, NOT NULL): Affected table name.
- `target_id` (text, nullable): Target primary key string.
- `metadata` (jsonb, nullable): Detailed contextual state delta.
- `created_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `system_settings`
Global organizational runtime parameters.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `key` (text, NOT NULL, UNIQUE): Configuration identifier.
- `value` (text, NOT NULL): Serialized parameter value.
- `updated_by` (uuid, nullable, FK -> `users.id`).
- `updated_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `login_attempts`
Authentication attempt tracker for brute-force mitigation.
- `id` (uuid, PK, DEFAULT `gen_random_uuid()`).
- `email` (text, NOT NULL).
- `ip_address` (text, nullable).
- `successful` (boolean, NOT NULL).
- `attempted_at` (timestamptz, NOT NULL, DEFAULT `now()`).

---

### `goals` & `goal_resources` *(Deprecated / Maintained for Schema Integrity)*
Predecessor planning structures superseded by `project_phases`, `sprints`, and `tasks`.

---

## 2. Stored Procedures & Database RPC Functions

| Function Name | Return Type | Key Parameters | Purpose |
|---|---|---|---|
| `declare_stage_outcome` | `void` | `p_task_id`, `p_to_status_id`, `p_changed_by_type` | Validates workflow transition, verifies blockers/dependencies, and advances task status. |
| `change_task_status` | `void` | `p_task_id`, `p_new_status_id`, `p_changed_by_type` | Direct status advancement RPC with validation. |
| `run_automation_rules` | `void` | `p_project_id`, `p_trigger_type`, `p_entity_type`, `p_entity_id`, `p_root_event_id` | Core execution engine for automation triggers with 5-hop loop protection. |
| `run_scheduled_automations` | `void` | *None* | Invoked every 15 mins by pg_cron to evaluate time-based rules. |
| `resolve_blocker_cascade` | `void` | `p_blocker_id`, `p_resolved_by_user_id` | Closes blocker, checks for sibling blockers, unflags task if clear, and completes linked action items. |
| `compute_critical_path` | `jsonb` | `p_project_id` | Analyzes task finish-to-start dependencies and schedule variances to find critical path tasks. |
| `compute_project_health` | `numeric` | `p_project_id` | Aggregates schedule delay, open blockers, and completion velocity into 0–100 score. |
| `get_admin_manager_ids` | `TABLE(id uuid)` | *None* | Returns list of all active administrator and manager IDs for notifications. |
| `cleanup_expired_remote_access` | `void` | *None* | Nightly cron to revoke bulk and individual remote access windows that have passed. |
| `delete_user_complete` | `void` | `p_user_id` | Comprehensive cascade removal of a user across all operational tables. |
| `get_my_role` | `text` | *None* | RLS helper returning current authenticated user's role from `public.users`. |
| `is_project_member` | `boolean` | `p_project_id` | RLS helper checking whether current user is active on a project. |

---

## 3. Database Triggers & Automated Guardrails

1. `trg_validate_task_parent`:
   - Prevents recursive parent assignments (`parent_id != id`).
   - Limits subtask nesting to **max depth 1** (subtasks cannot have subtasks).
   - Enforces cross-project integrity: child task must have matching `project_id`.
2. `trg_block_parent_done_with_open_subtasks`:
   - Prevents setting parent task to `done` category if `require_subtasks_done = true` and open child tasks remain.
3. `trg_sync_task_is_flagged`:
   - Automatically maintains `tasks.is_flagged = true` when open blockers exist in `task_blockers`.
4. `trg_record_task_status_history`:
   - Automatically records audit log entry in `task_status_history` on any change to `tasks.status_id`.
5. `calculate_late_clockin`:
   - Evaluates clock-in timestamp in PKT against shift start + grace minutes, populating `is_late` and `minutes_late`.
