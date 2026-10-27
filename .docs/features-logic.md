# Ziel Log System — Features & Business Logic Documentation

## Executive Overview
Ziel Log System (internally referred to as *Ziel Whispers* / *Ziel CMS*) is an enterprise workforce management, project execution, and engineering intelligence platform. It orchestrates attendance tracking, work logging, generalized project lifecycle workflows, multi-tiered leave management, skills metrics, client portal collaboration, and system automations.

---

## 1. Authentication, Sessions & Access Control

### 1.1 Architecture & Components
- **Core Files**: `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/pages/Login.tsx`, `src/pages/SetPassword.tsx`
- **Database Tables**: `users`, `system_settings`, `audit_logs`, `login_attempts`
- **Auth Provider**: Supabase Auth (JWT access token + refresh tokens)

### 1.2 User Roles & Permissions
The system enforces five system-level user roles:
1. **`admin`**: Unrestricted access to all modules, employee master profiles, financial/audit logs, system configurations, and override powers.
2. **`manager`**: Operational management access: oversees attendance, work logs, project settings, sprint/phase planning, task allocation, and leaves. Restricted from global system settings and employee deactivation.
3. **`employee`**: Standard workforce access: clocks in/out, logs daily tasks, views assigned projects and tasks, requests leaves, and monitors personal statistics.
4. **`client`**: External organization client sponsor: access restricted to assigned client portal projects, milestone tracking, client action items, and project communication.
5. **`client member`**: External collaborator attached to a client account: read-only access to scoped project deliverables, action items, and status feeds.

### 1.3 Step-by-Step Business Logic & Data Flow
1. **Login Flow (`/login`)**:
   - Validates email and password against Supabase `auth.signInWithPassword`.
   - Records attempt in `login_attempts` table.
   - Checks rate-limiting and lockout thresholds configured in `system_settings` (`max_failed_login_attempts`, `lockout_window_minutes`).
   - Fetches the user profile from `public.users`.
   - If `status === 'inactive'`, login is immediately aborted, user is signed out from auth, and an error toast displays: *"Your account has been deactivated. Please contact your administrator."*
   - If `must_change_password === true`, user is redirected to `/set-password`.
   - Role routing: `client` and `client member` are routed to `/projects`; internal employees are routed to `/dashboard`.
2. **Session Lifecycle & Inactivity Management**:
   - `SESSION_ID_KEY` (`ziel_session_id`): Stores the last 16 characters of the JWT token. If another browser tab or login generates a new token, the storage listener detects the discrepancy and logs out the superseded tab.
   - **Inactivity Timeout**: Configured via `system_settings.session_timeout_hours` (defaults to 12 hours). Window event listeners (`mousedown`, `keydown`, `scroll`, `touchstart`) update `ziel_last_activity` timestamp. If idle time exceeds threshold, session is terminated.
   - **Absolute Session Ceiling**: Hard-capped at 12 hours (`MAX_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000`) regardless of active interaction, enforced by a 60-second periodic timer.
   - **Active Status Heartbeat**: Every 30 seconds (`STATUS_CHECK_INTERVAL`), queries `users.status`. If deactivated mid-session, session drops immediately.
   - **Sign Out Flow**: Inserts an audit log entry (`session.logout`), clears local/session storage, purges TanStack Query cache, and calls `supabase.auth.signOut()`.
3. **Forced Password Reset Flow (`/set-password`)**:
   - Any user with `users.must_change_password = true` cannot access any other route (`ProtectedRoute` intercepts and redirects).
   - Form validates password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character).
   - Updates password via `supabase.auth.updateUser` and sets `users.must_change_password = false`.

### 1.4 Conditions, Validations & Edge Cases
- **Stale Token Hydration**: If the auth listener emits token refreshes (`TOKEN_REFRESHED`), `loading` state is never set back to `true`, preventing UI destruction while users are editing forms or logs.
- **Cross-Tab Synchronization**: Multi-tab localStorage listeners prevent zombie sessions when logged out in another tab.
- **Impersonation**: Audit logs track `impersonation.started` and `impersonation.ended` if an admin uses session override mechanisms.

---

## 2. Attendance & Geofenced Time Tracking

### 2.1 Architecture & Components
- **Core Files**: `src/pages/MyAttendance.tsx`, `src/pages/AttendanceAdmin.tsx`, `src/hooks/useWorkSettings.ts`, `src/components/AutoClockoutAlert.tsx`
- **Database Tables**: `attendance`, `auto_clockout_acks`, `remote_work_requests`, `users`, `system_settings`
- **Timezone**: Strict **Pakistan Standard Time (PKT, Asia/Karachi, UTC+5)**.

### 2.2 Shift Resolution & Lateness Algorithm
1. **Shift Inheritance**:
   - Checks if user has `users.has_custom_shift = true`.
   - If true, uses `users.shift_start` and `users.shift_end`.
   - If false, inherits `system_settings.default_shift_start` (e.g., 09:30 AM) and `system_settings.default_shift_end` (e.g., 06:30 PM).
2. **Lateness Evaluation**:
   - Weekend rule: Sunday (all workers) and Saturday (for `working_days = 5`) do not accumulate late penalties.
   - Grace period: Derived from `system_settings.late_grace_minutes` (default 15 minutes).
   - Lateness formula:
     $$\Delta_{\text{minutes}} = \text{ClockIn}_{\text{PKT}} - \text{ShiftStart}_{\text{PKT}}$$
     $$\text{is\_late} = \Delta_{\text{minutes}} > \text{GraceMinutes}$$
   - When clocking in late, a modal dialog alerts the user of their exact lateness before confirming.

### 2.3 Onsite Geofencing & Location Verification
1. **Haversine Distance Check**:
   $$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$
   $$a = \sin^2(\Delta\phi/2) + \cos(\phi_1)\cos(\phi_2)\sin^2(\Delta\lambda/2)$$
   $$d = 2R \cdot \text{atan2}(\sqrt{a}, \sqrt{1-a})$$
   Where $R = 6,371,000$ meters.
2. Coordinates defined in `system_settings`:
   - `onsite_latitude` (Default: 33.712417)
   - `onsite_longitude` (Default: 73.039444)
   - `onsite_radius_meters` (Default: 300 meters)
   - `geofence_enabled` (Boolean toggle)
3. If `work_mode === 'onsite'` and geofencing is enabled:
   - Queries browser Geolocation API.
   - If coordinates exceed radius $d > \text{onsite\_radius\_meters}$, clock-in is rejected with current distance feedback.
   - If GPS permission is denied or times out, clock-in is blocked.

### 2.4 Remote & Work-From-Home (WFH) Rules
1. To clock in with `work_mode = 'remote'`, the employee must satisfy at least one of:
   - Approved `remote_work_requests` row matching `date = today` and `status = 'approved'`.
   - Individual `users.remote_access = true` with `today` falling between `remote_access_from` and `remote_access_to`.
   - Organization-wide bulk remote access enabled (`users.remote_access_bulk = true`).
2. If neither condition is met, remote clock-in is blocked with an error toast instructing the employee to submit a WFH request or contact administration.

### 2.5 Multi-Session Attendance & Auto Clock-Out
1. **Multi-Session Support**: A user can clock in and out multiple times in a single day (e.g., split shifts, field visits). The open session is identified by `clock_out IS NULL`.
2. **Auto Clock-Out Engine**:
   - A background PostgreSQL cron (`20260428110500_dynamic_cron_schedule.sql`) runs nightly.
   - Unclosed attendance sessions are closed with `auto_clocked_out = true` and `clock_out` set to configured midnight/eod timestamp.
3. **Acknowledgment Dialog (`AutoClockoutAlert.tsx`)**:
   - On subsequent login, employees with unacknowledged auto clock-outs are presented with a blocking dialog.
   - Submitting an acknowledgment records a row in `auto_clockout_acks`.

---

## 3. Daily Work Logging & Hour-Attributed Progression

### 3.1 Architecture & Components
- **Core Files**: `src/pages/LogSubmit.tsx`, `src/hooks/useLogSubmitData.ts`, `src/components/log-submit/*`, `src/utils/logDateUtils.ts`
- **Database Tables**: `daily_logs`, `tasks`, `workflow_statuses`, `workflow_transitions`, `task_blockers`, `task_status_history`

### 3.2 Dual-Purpose Daily Logs Architecture
The system enforces strict architectural separation between **historical effort tracking** and **stage transitions**:
1. **`hours_status_id`**: Always set to the status the task occupied while work was being performed.
2. **`declared_transition_to` / `declared_outcome_status_id`**: Nullable field populated only when the contributor explicitly requests a stage move upon completing that unit of work.

### 3.3 Draft vs. Submission Lifecycle
1. **Draft State (`status = 'draft'`)**:
   - Allows employees to accumulate log entries throughout the day.
   - Form fields: `project_id`, `task_id` (mandatory unless miscellaneous project), `category`, `hours` (0.25h to 24h), `description` (min 20 chars), `log_date`.
   - Draft entries do not trigger task transitions or notify managers.
2. **Submission State (`status = 'submitted'`)**:
   - Batch submitted using `handleSubmitAll()`.
   - Validates daily total hours (max 24h per day).
   - If the log is for `today` and the employee has an open attendance session, **submitting logs automatically clocks out the employee** (`trigger: log_submission`).
   - If declared outcome is set, executes RPC `declare_stage_outcome` or `change_task_status_with_history`.

### 3.4 Strict Validation & Guardrails
- **Minimum Description**: Enforced at 20 characters minimum.
- **Log Edit Window (`isWithinLogEditWindow`)**:
   - Governed by `users.log_edit_days` (overrides default 1 day).
   - Iterates backward counting only valid working days (skipping weekends based on `working_days` configuration).
   - Retroactive log submissions outside this window are rejected at both UI and database level.
- **Late Log Submission**:
   - If `log_date < today_PKT`, marked `is_late = true`.
   - If `log_date == today_PKT`, marked `is_late = true` if submitted after `shift_end + 30 minutes` (PKT).
- **Blocker Lockout**: If a task has an active blocker (`tasks.is_flagged = true`), stage outcome declaration is prevented with: *"Cannot declare stage outcome for [Task] — it is blocked by an active blocker."*
- **Dependency Guard**: Warns user if attempting to advance a task whose finish-to-start predecessor tasks are not yet in `done` category.
- **Parent/Subtask Gate**: Completing a parent task is blocked if any of its child subtasks remain uncompleted while `require_subtasks_done` is true.

### 3.5 Proactive Missing Log Alert (`MissingLogAlert.tsx`)
- Evaluates the previous working day (skips Sunday, skips Saturday for 5-day workers).
- If total submitted hours for that target working day are less than `expected_daily_hours` (default 8 hours), a modal alert appears upon logging in.
- Selecting "Go to Logs" automatically sets the log form date to the missed day.

---

## 4. Daily Standups

### 4.1 Architecture & Components
- **Core Files**: `src/pages/LogsAdmin.tsx`, migration `20260507102500_dedicated_standup_table.sql`
- **Database Tables**: `daily_standups`, `users`

### 4.2 Business Logic
- Dedicated tracking table with composite primary key `(user_id, date)`.
- Independent of daily logs to decouple standup participation status from task hour accumulation.
- Aggregated in `LogsAdmin.tsx` beside attendance timestamps and hours logged to give project leads an instant snapshot of daily alignment.

---

## 5. Leave & Remote Work (WFH) Management

### 5.1 Architecture & Components
- **Core Files**: `src/pages/MyLeave.tsx`, `src/pages/LeaveAdmin.tsx`, `src/hooks/useLeaveAdminData.ts`, `src/lib/utils.ts`
- **Database Tables**: `leave_requests`, `leave_balances`, `leave_types`, `remote_work_requests`, `system_settings`

### 5.2 The Annual Leave Year Cycle
- **Cycle Range**: The company leave year strictly begins **June 1st** and concludes **May 31st** of the subsequent calendar year (`getCurrentLeaveYear()`).
- Annual entitlement is configured in `system_settings.annual_leave_entitlement` (default: 12 days).

### 5.3 Leave Categories & Rules
1. **Full-Day Leaves** (`Sick Leave`, `Casual Leave`, `Others`):
   - Deducts integer days (`days_count`) from employee entitlement.
2. **Hourly Leaves**:
   - Employees request specific time durations in hours.
   - Conversion rule: Every **8 cumulative hours** of approved hourly leave automatically counts as 1 full day deducted against annual quota.
3. **Approval Data Flow**:
   - Admin/Manager reviews pending requests.
   - Actions: `approve` or `reject` with mandatory/optional administrative notes.
   - Emits in-app notifications and updates `leave_requests.status`.
   - Writes audit log entries: `leave.approved` or `leave.rejected`.

### 5.4 Bulk Remote Work Control
- In addition to individual employee WFH requests, administrators can enable organization-wide bulk remote access (e.g., severe weather, holidays, facility maintenance).
- Sets `users.remote_access = true`, `users.remote_access_bulk = true`, `users.remote_access_from`, and `users.remote_access_to`.
- Cron function `cleanup_expired_remote_access` automatically revokes expired remote permissions.

---

## 6. Generalized Project Engine & Workflow Architecture

### 6.1 Architecture & Principles
- **Core Files**: `src/pages/Projects.tsx`, `src/pages/ProjectDetail.tsx`, `src/pages/WorkflowTemplates.tsx`, `src/lib/workflow.ts`, `src/lib/adminProjectNav.ts`, `src/components/project/*`
- **Database Tables**: `projects`, `project_settings`, `project_roles`, `project_members`, `task_types`, `project_phases`, `sprints`, `workflow_templates`, `workflow_statuses`, `workflow_transitions`, `tasks`, `task_collaborators`, `task_dependencies`, `task_status_history`

### 6.2 Universal Execution Unit & Optional Structures
- **Guiding Principle**: `Project` is the only mandatory root container; `Task` is the only mandatory execution unit.
- **Independent Structural Layers**:
  - `Phases`: Sequenced project milestones / stages (controlled by `structure.phases.enabled`).
  - `Sprints`: Time-boxed iterations (controlled by `structure.sprints.enabled`).
  - `Milestones`: Zero-effort checkpoints (controlled by `structure.milestones.enabled`).
- Deleting a Phase or Sprint **never** cascades to delete tasks; tasks are unlinked or reassigned.

### 6.3 The Read-Only Kanban Board Invariant
> [!IMPORTANT]
> **Kanban Board is strictly a read-only visualization.**
> Drag-and-drop status advancement on the Kanban board is disabled both in the UI and prohibited at the schema level. A task's workflow status can ONLY advance via:
> 1. An hour-attributed, validated Daily Log submission.
> 2. A system automation rule trigger.
> 3. An audited administrative override.

### 6.4 Workflow Status Model & Retirement
1. **Composability**:
   - Statuses are defined per `workflow_templates` and carry semantic flags: `is_initial`, `category` (`todo`, `in_progress`, `done`), `color`, `sort_order`, and `retired`.
2. **Soft Retirement (`retired = true`)**:
   - Deleting a status in use by existing tasks or transitions is forbidden.
   - Retiring a status preserves full historical integrity on existing tasks and audit logs, but immediately excludes the status as a selectable destination for future transitions.
3. **Role-Gated Transitions**:
   - `workflow_transitions` supports `allowed_role_ids`. If populated, only project members with that role can advance tasks through that transition.

### 6.5 Concurrency & Version Protection
- Every task maintains a `version` integer column.
- Whenever a write occurs to `status_id` or `assigned_to`, `version` is incremented.
- Stale client writes conflicting with background automations or concurrent log submissions are rejected to prevent silent overwrite bugs.

### 6.6 Subtasks & Hierarchical Constraints
- Self-referencing `parent_id` foreign key.
- **Max Depth = 1**: Direct subtasks only; subtasks cannot have subtasks (`trg_validate_task_parent`).
- Cross-project prevention: Parent and child tasks must belong to the exact same `project_id`.

---

## 7. Blocker Management & Action Items

### 7.1 Architecture & Components
- **Core Files**: `src/components/BlockerAlertModal.tsx`, `src/components/project/tabs/ProjectBlockersTab.tsx`, `src/components/project/tabs/ProjectActionItemsTab.tsx`
- **Database Tables**: `task_blockers`, `client_action_items`, `client_action_item_messages`

### 7.2 Business Logic
1. **Task Flagging**: Creating an open blocker (`task_blockers`) triggers `trg_sync_task_is_flagged`, immediately marking `tasks.is_flagged = true`.
2. **Client Linkage**: A blocker can spawn a `client_action_items` entry if resolution requires client input (e.g., credentials, design feedback).
3. **Cascade Resolution (`resolve_blocker_cascade`)**:
   - Resolving a blocker checks if any other open blockers remain for that task.
   - If none remain, clears `tasks.is_flagged = false`.
   - If linked to an action item, resolves the action item and notifies relevant stakeholders.

---

## 8. Automation Rules Engine

### 8.1 Architecture & Components
- **Core Files**: `src/components/project/AdminAutomationRulesPanel.tsx`, `src/lib/projectSettingsService.ts`, migration `20260713000004_create_automation_rules.sql`, `20270815000002_automation_lockout_and_source_audit.sql`
- **Database Tables**: `automation_rules`, `automation_rule_runs`

### 8.2 Event Triggers, Conditions & Actions
- **Trigger Types**: `status_change`, `task_created`, `task_blocked`, `blocker_resolved`, `scheduled`.
- **Condition Operators**: `eq`, `neq`, `contains`, `gt`, `lt`, `always` against task fields (`status_id`, `priority`, `assigned_to`, `due_date`, `description`).
- **Action Types**:
  - `change_status`: Advances task to target status.
  - `assign_user`: Assigns task to specific user.
  - `assign_role`: Reassigns task to eligible member with lowest active task count across all projects (balanced workload).
  - `add_comment`: Inserts system note in `task_comments`.
  - `resolve_blocker`: Automatically closes linked blockers.
- **Loop Protection (Chain Depth Guard)**:
  - Every automation execution passes a `root_event_id`.
  - Hard cap at **5 hops** (`v_chain_depth > 5`).
  - If a loop is detected, execution stops and logs an error in `automation_rule_runs` without crashing the database transaction.

---

## 9. Client Portal Collaboration

### 9.1 Architecture & Components
- **Core Files**: `src/pages/Clients.tsx`, `src/pages/Projects.tsx`, `src/lib/clientTaskBuckets.ts`, `src/components/employee/ClientMemberProfileCard.tsx`
- **Database Tables**: `clients`, `client_portal_messages`, `client_action_items`, `client_action_item_messages`

### 9.2 Client Security Invariants
- `client` and `client member` users are strictly isolated via Row Level Security (RLS).
- Can only select and view projects where `projects.client_id = user.client_id` or explicit `project_members` membership exists.
- **Archived Project Isolation**: Archived projects are hidden from client views (`isProjectVisibleToClientPortal`).
- **Internal Masking**: Clients see simplified task state buckets (`Unlinked`, `Development`, `Complete`, `Returned`) rather than internal granular technical statuses.

---

## 10. Skill Metrics & Capacity Planning

### 10.1 Architecture & Components
- **Core Files**: `src/types/skills.ts`, `src/hooks/useSkillMetricsData.ts`, `src/components/skills/*`, `src/components/employee/tabs/EmployeeSkillsTab.tsx`, `src/components/project/tabs/ProjectSkillsTab.tsx`
- **Database Tables**: `skills`, `employee_skills`, `project_skill_requirements`, `skill_evaluations`

### 10.2 Skill Proficiency Framework
- **Categories**: `Technical`, `Soft Skill`, `Domain`, `Tools`.
- **Proficiency Levels (1–5)**:
  - `1`: Beginner (requires guidance).
  - `2`: Intermediate (executes routine work independently).
  - `3`: Advanced (handles complex scenarios).
  - `4`: Expert (mentors and leads).
  - `5`: Master (architectural authority).
- **Match Score Formula**: Calculates percentage fit between project required proficiencies and assigned team member proficiencies to prevent under-skilled project allocations.

---

## 11. Reporting & Analytics Intelligence

### 11.1 Architecture & Components
- **Core Files**: `src/pages/Reports.tsx`, `src/pages/Dashboard.tsx`
- **Export Engines**: `html2canvas` (PNG charts), `jspdf` & `jspdf-autotable` (PDF reports), Native CSV streaming.

### 11.2 Analytical Engines
1. **Utilization Report**:
   - Calculates total logged hours vs. available work capacity (working days * 8h) factoring in join dates (`created_at`).
   - Categorizes utilization: `High` (≥90%), `Healthy` (70–89%), `Watch` (55–69%), `Low` (<55%).
2. **Activity Heatmap**: Day-by-day distribution of work log volume across departments.
3. **Monthly Summary Report**: Cross-tabulation of attendance, leaves, and total productive hours.
4. **Attendance Trend Report**: Tracks on-time vs. late clock-ins across departments and employees.
5. **Missed Logs Report**: Surfaces employees with unlogged working days for administrative follow-up.

---

## 12. Audit Logging & System Settings

### 12.1 Audit Trail
- Comprehensive audit records stored in `audit_logs` tracking `actor_id`, `action`, `target_entity`, `target_id`, `metadata`, and `created_at`.
- Covers every domain event: user creation/updates, status transitions, leave decisions, clock-in/out, impersonation, and administrative overrides.

### 12.2 System Configuration (`system_settings`)
- Organization key-value registry:
  - `app_name`: Organization application branding.
  - `session_timeout_hours`: Max inactive session window.
  - `lockout_window_minutes`, `max_failed_login_attempts`: Brute-force protection.
  - `onsite_latitude`, `onsite_longitude`, `onsite_radius_meters`, `geofence_enabled`: Location bounds.
  - `annual_leave_entitlement`: Standard yearly leave days.
  - `default_shift_start`, `default_shift_end`, `late_grace_minutes`: Default shift rules.
