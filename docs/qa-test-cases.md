# Module test case catalog

These cases are the functional coverage baseline. `Automated` means a matching automated case exists in this repository; `Planned` means the workflow requires authenticated test data, database isolation, or UI service seams that have not yet been added. Do not treat planned cases as passed coverage.

## Authentication and access

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| AUTH-01 | Open the login page | Email, password, and sign-in controls render | Automated: `e2e/auth.spec.ts` |
| AUTH-02 | Open a protected module while signed out | User is redirected to login | Automated: `e2e/module-access.spec.ts` |
| AUTH-03 | Sign in with valid credentials | Session is created and user reaches their home route | Planned |
| AUTH-04 | Sign in with invalid credentials or a locked account | Access is denied and the correct error is shown | Planned |
| AUTH-05 | Sign in as an inactive user or a user required to change password | Inactive user is signed out; password-change user is forced into the password flow | Planned |
| AUTH-06 | Let a session expire by inactivity or absolute lifetime | Session is cleared and protected content is no longer accessible | Planned |

## Employee management and profile

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| EMP-01 | Admin invites an employee with valid profile and role data | Account is created, invitation is sent, and an audit event is recorded | Planned |
| EMP-02 | Submit an invalid or duplicate employee invitation | Validation explains the issue and no duplicate account is created | Planned |
| EMP-03 | Employee updates permitted profile fields | Changes persist; protected role/status fields remain unchanged | Planned |
| EMP-04 | Admin deactivates and reactivates an employee | Account access follows active status and the action is audited | Planned |
| EMP-05 | Admin updates log-edit/access controls | Employee profile and downstream controls reflect the saved values | Planned |

## Attendance

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| ATT-01 | Format shift time and lateness values | 12-hour time and duration text are consistent | Automated: `src/tests/attendanceRules.test.ts` |
| ATT-02 | Clock in at or within grace, then beyond grace | Boundary is not late; a time beyond grace is late by the correct minutes | Automated helper coverage: `src/tests/attendanceRules.test.ts` |
| ATT-03 | Clock in on a non-working weekend day | Weekend policy is applied for five-day and six-day schedules | Automated helper coverage: `src/tests/attendanceRules.test.ts` |
| ATT-04 | Employee clocks in/out across multiple sessions | Each session persists and total work time is calculated correctly | Planned |
| ATT-05 | Admin edits an attendance record | Corrected values persist and an audit event is created | Planned |
| ATT-06 | Auto-clockout runs for an open session | Session closes at the configured time and duplicate runs are safe | Planned |

## Daily logs

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| LOG-01 | Select today with zero past-day edit allowance | Today's log date remains valid | Automated: `src/tests/logDateUtils.test.ts` |
| LOG-02 | Select past dates at and outside the edit window | Working-day boundary is accepted; older dates are rejected | Automated helper coverage: `src/tests/logDateUtils.test.ts` |
| LOG-03 | Apply five-day versus six-day schedules to the edit window | Saturday counts only for a six-day schedule; Sunday does not count | Automated helper coverage: `src/tests/logDateUtils.test.ts` |
| LOG-04 | Create, edit, and delete a draft | Draft values persist; deletion affects only the draft | Planned |
| LOG-05 | Submit a log with missing project/task, short description, invalid hours, or invalid date | Submission is blocked with field-level feedback | Planned |
| LOG-06 | Submit a valid task log with a declared workflow outcome | Hours are attributed to the current status and only an allowed transition is applied | Planned: requires isolated database |
| LOG-07 | Submit an outcome for a blocked task or with unfinished dependencies | Submission is rejected or warned according to the configured rule; no partial task update occurs | Planned: requires isolated database |
| LOG-08 | Admin reviews, locks, flags, comments on, or deletes a submitted log | Each action persists, is permission-gated, and is audited where applicable | Planned |

## Leave and remote work

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| LEAVE-01 | Resolve a leave year and label a leave type | June-to-May range and hourly/type labels are correct | Automated helper coverage: `src/tests/commonUtils.test.ts` |
| LEAVE-02 | Submit leave for valid dates and sufficient balance | Request is created with the correct working-day count | Planned |
| LEAVE-03 | Submit invalid, overlapping, or over-balance leave | Request is rejected with a useful explanation | Planned |
| LEAVE-04 | Manager approves or rejects a request | Status, reviewer, timestamp, balance, audit, and notification are consistent | Planned: requires isolated database |
| LEAVE-05 | Submit and review a remote-work request | Request state and requester notification are correct | Planned |
| LEAVE-06 | Admin marks an employee on leave through access controls | Leave record and access controls stay synchronized on save and removal | Planned |

## Clients and projects

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| PROJ-01 | Resolve admin project navigation from each project tab | Primary/secondary navigation points to the expected section | Automated: `src/tests/adminProjectNav.test.ts` |
| PROJ-02 | Create, edit, archive, and delete a client/project | Valid changes persist; dependent records and delete constraints behave safely | Planned |
| PROJ-03 | Add, remove, and change project members | Membership and project visibility update for the affected user | Planned: requires isolated database |
| PROJ-04 | Client opens their project list | Only permitted projects appear; archived projects are hidden | Automated helper coverage: `src/tests/workflow.test.ts`; RLS path planned |
| PROJ-05 | Import project/member/task CSV with valid and invalid rows | Valid rows are imported, invalid rows are reported, and retries do not duplicate data | Planned |

## Tasks, workflow, blockers, dependencies, sprints, automation

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| TASK-01 | Resolve task status destinations | Only configured destinations from the current state are offered; retired destinations are excluded | Automated: `src/tests/workflow.test.ts` |
| TASK-02 | Resolve initial status and display status history | Active initial/fallback status is selected; historical status labels still render | Automated helper coverage: `src/tests/workflow.test.ts` |
| TASK-03 | Change task state through a submitted log | Valid transition records status history; invalid transition writes no partial state | Planned: requires isolated database |
| TASK-04 | Attempt a stale version write | Conflict is reported and newer task state is preserved | Planned: requires isolated database |
| TASK-05 | Add dependencies and attempt to finish a dependent task | Unfinished finish-to-start dependencies are reported; done dependencies do not block | Automated helper coverage: `src/tests/dependencies.test.ts`; database path planned |
| TASK-06 | Raise/resolve a blocker | Flag state and blocker status stay synchronized; valid automation runs once | Planned: requires isolated database |
| TASK-07 | Filter Kanban by sprint and priority | Correct tasks appear in workflow columns, with backlog and retired-status rules applied | Automated helper coverage: `src/tests/workflow.test.ts`; UI filter planned |
| TASK-08 | Complete a sprint with unfinished tasks | Sprint status and task assignment follow the database rule; task history remains valid | Planned: requires isolated database |
| TASK-09 | Trigger chainable and non-chainable automation rules | Conditions, priority, chain depth, and loop protection are respected | Planned: requires isolated database |
| TASK-10 | Assign a task with collaborators and reassign its stage owner | Owner, collaborators, workload, and assignment history remain consistent | Planned: requires isolated database |

## Dashboard, reporting, and activity

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| DASH-01 | Aggregate estimated, logged, and remaining project hours | Totals and ideal/actual burndown values are correct | Automated: `src/tests/projectBurndown.test.ts` |
| DASH-02 | Scope burndown to a phase | Only tasks in sprints belonging to that phase are counted | Automated helper coverage: `src/tests/projectBurndown.test.ts` |
| DASH-03 | Build project activity from overdue tasks, blockers, completions, updates, sprints, and members | Feed items are present and sorted newest-first; limit is respected | Automated: `src/tests/projectActivityFeed.test.ts` |
| DASH-04 | Open reports with role-appropriate filters and date ranges | Results match source records and totals; unauthorized roles cannot open admin reports | Planned |

## Announcements, notifications, settings, audit, and skills

| ID | Scenario | Expected result | Status |
| --- | --- | --- | --- |
| COMMS-01 | Publish, read, and dismiss an announcement | Visibility and per-user read/dismiss state persist | Planned |
| COMMS-02 | Create an in-app notification and mark one/all read | Correct recipient sees it; unread count and state refresh | Planned |
| COMMS-03 | Send email notification when the provider fails | In-app event remains usable and failure is observable/retryable | Planned |
| ADMIN-01 | Update shift, session, leave, and automation settings | Valid values persist and are used by downstream logic | Planned |
| ADMIN-02 | Review consequential user/project/log actions in the audit page | Actor, target, action, and timestamp are accurate and filters work | Planned |
| SKILL-01 | Add a skill, assign proficiency, evaluate, and add a project requirement | Values persist and recommendations reflect the updated skill data | Planned |

## Current automation boundaries

- Fast Vitest tests run without a backend. They cover pure rules and mocked service behavior.
- Playwright smoke tests use no credentials and verify login rendering plus authentication gates for module routes.
- The legacy `src/tests/automation` suite writes to a hard-coded linked Supabase project and is excluded from default test commands and CI. It must be rewritten against an isolated local/ephemeral database before it can be an integration gate.
- The repository does not yet have an authenticated E2E identity, isolated database seed, or verified migration history for CI. Database-backed cases above remain planned until those are available.
