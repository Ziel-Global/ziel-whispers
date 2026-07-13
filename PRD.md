Project Management Module

Consolidated functional and technical specification, for the Ziel Log
System

Version 1.1 (draft), adds phase-scoped sprints, automation rules,
project roles, configurable thresholds, and a read-only kanban board

Contents

1.  Purpose and scope

This module gives the Ziel Log System full project management
capability: project detail, task lists, phases, task assignment, effort
tracking against daily logs, burndown, health status, a client-facing
portal, configurable workflows, task dependencies with critical path
scheduling, sprint-based planning with velocity tracking,
project-defined roles, a configurable automation rule engine, and a
read-only kanban board.

Every new table is structured so an AI scrum master can eventually read
project state and act on it, without another schema change when that
work begins. Section 10 lays out how.

1.1 In scope

Project overview page with health status and phase timeline

Task list with assignment, priority, estimate, due date, client
visibility control, configurable workflow status, sprint assignment, and
story points

Phases, containing sprints, containing tasks

Daily log entries linked to a specific task, not just a project

Burndown chart based on estimated vs. logged hours

Blockers, raised against a task or a project, with an open/resolved
workflow

Task comments for internal collaboration

Periodic status updates, optionally published to the client portal

Client action items: things Ziel needs from the client, tracked to
completion

Reporting: utilization, hours by phase, task velocity, overdue items,
blocker frequency, health trend

Expanded client portal: phase, tasks, assignees, blockers, action items,
status updates, portal messaging

Configurable workflows per project, with a full history of every status
change

Task dependencies, with cycle prevention and a critical path calculation

Sprints, with story points, velocity, and mid-sprint scope-change
tracking

Project-defined roles, with no fixed list of job titles anywhere in the
system

Per-project configurable thresholds for health status and schedule
calculations

An automation rule engine: trigger, conditions, actions, scoped per
project

A read-only kanban board reflecting each project's own workflow

1.2 Foundation only, not built

The AI scrum master itself: no agent, no automated drafting, no
autonomous actions

Persistent client login accounts (the portal remains a share link)

Budget or cost tracking beyond hours

Automatic status transitions or reassignments driven by an agent (stage
3 or 4 of the roadmap in section 10, distinct from the rule-based
automation in this document)

Velocity forecasting or sprint scope recommendations

Hard enforcement of dependency order. This is implemented as a warning,
not a block; see section 7.8

Genuinely open-ended scripted automation logic. The rule engine in this
document covers a defined, extensible vocabulary of triggers and
actions, not an arbitrary code execution layer; that's a materially
bigger and riskier undertaking and isn't part of this scope

2.  Design principle: configured, not hardcoded

This module is meant to work the same way regardless of what kind of
project or what kind of work is running through it, a one-week fix, a
year-long build, a solo engagement, a large team. Four things in
particular were flagged as needing to be genuinely configurable rather
than fixed, and this document treats each one as a first-class table or
setting, not a constant buried in application code:

Workflow statuses and their transitions are defined per project through
workflow_templates (4.14), not a fixed status list

Roles are defined per project through project_roles (5.17), not a fixed
set of job titles

Health and schedule thresholds live in project_settings (6.7), not as
constants in the health or critical path calculations

The automation vocabulary (5.18) is a set of plain text trigger and
action types paired with jsonb configuration, so adding a new trigger or
action later is new code against an existing table, not a schema
migration

Anywhere this document still states a specific number, a 10 percent
variance, an 8 hour day, that number is a default value in
project_settings, not a hardcoded limit. Defaults exist so a new project
has something reasonable to start from, not because every project is
expected to behave the same way.

3.  Why this order

Configurable workflows come before dependencies and sprints in this
document because critical path and velocity calculations both need a
reliable, structured answer to whether a task is actually done,
independent of whatever label a given project's workflow uses for that
state. Dependencies and sprints have no ordering requirement relative to
each other, and can be built in either order, or in parallel, once
workflows are in place. Project roles and the automation engine both
depend on workflows and, for role-based actions, on project_roles
existing and being populated, so they're built last.

4.  User roles and access

Three access levels apply throughout this module. The manager role
referenced elsewhere in the base system's Admin Features is not yet
defined against the Permissions Matrix; until that's resolved, this spec
treats manager as equivalent to Admin for project management actions.

The client role has materially more read access than a simple health
view: phase, client-visible tasks and assignees, client-visible
blockers, status updates marked visible to client, plus one write
capability, marking their own action items complete. The kanban board
and automation rules are internal-only; clients don't see either.

5.  Functional requirements

5.1 Project overview

A single page per project showing name, client, dates, status, current
health badge, phase timeline, team members, and document links.
Presentation layer over the existing projects, project_phases, and
project_members tables.

5.2 Task management

Extends the existing tasks table with:

Estimated hours: effort estimate used for burndown

Due date: task-level deadline, used for overdue detection and burndown
pacing

Client visible: whether this task appears in the client portal task
list, default true

Status: driven by a project's configurable workflow rather than a fixed
list (see 5.14)

Sprint assignment and story points: optional, for teams planning in
sprints (see 5.16)

A task keeps its phase_id regardless of sprint assignment. If a task
does have a sprint, that sprint's own phase must match the task's phase,
so the hierarchy stays consistent: a phase contains sprints, a sprint
contains tasks, but a task without a sprint still sits directly under
its phase as a backlog item. Tasks not yet estimated remain fully
usable; they're excluded from burndown math and flagged separately (see
7.1).

5.3 Phases

Uses the existing project_phases table unchanged. Phase progress is the
percentage of linked tasks marked complete, plotted against the phase
due_date. A phase now contains sprints (5.16) as well as tasks directly.

5.4 Task assignment

Uses the existing tasks.assigned_to field, already supported in the base
system. No schema change required here.

5.5 Task-to-log linkage

The base system's Submit Log feature references task selection, but
daily_logs has no task_id column, so hours logged can't be attributed to
a specific task. This spec adds daily_logs.task_id, a nullable foreign
key to tasks.id. Logs created before this field exists remain
project-level only and are excluded from task-level burndown.

5.6 Burndown tracking

Chart scoped to a project, phase, or sprint, showing an ideal line and
an actual line across the date range. Calculation detail in section 7.1.
Open blockers, and schedule position, are inputs into health status
alongside burndown variance, detailed in 7.2.

5.7 Reporting and stats

Utilization: hours logged by team member, across projects and tasks

Hours by phase and by category

Task velocity: tasks completed per week, and sprint velocity in story
points where sprints are used

Overdue and at-risk task lists

Blocker frequency and average time to resolution

Project health trend, using the snapshot history

Automation rule activity: runs, failures, and skipped executions per
rule

5.8 Blockers

A blocker can be raised against a specific task or at the project level,
with a short description and a status of open or resolved. Blockers
default to client visible, so a client can see what is holding up
progress, but any individual blocker can be marked internal only when
the underlying cause shouldn't be surfaced externally, for example a
resourcing issue inside Ziel. Open blockers feed into the health status
calculation in section 7.2, and a blocker on a critical-path task is
treated as more urgent than one with schedule slack.

5.9 Task comments

A lightweight comment thread on each task, used for internal
collaboration between team members. The author_type field (human, ai, or
system) is included from the start so this table can support
AI-generated and automation-generated comments without a schema change.
A system-authored comment means an automation rule wrote it; an
ai-authored one means an agent's judgment produced it. Keeping those
distinct matters once both exist.

5.10 Status updates

A short narrative summary posted against a project on a regular cadence,
written by a team member for now. Each update can be marked visible to
client, in which case it appears in the portal as a progress log. This
is the mechanism an AI scrum master will eventually use to post
automated updates, with the visible_to_client flag giving the team a
review point before anything reaches a client.

5.11 Client action items

Items that need something from the client rather than from the team:
approving a design, providing brand assets, signing off a milestone.
These appear in the portal with a pending or completed status, and the
client can mark an item complete through the portal. Completion is
written through a dedicated edge function rather than a direct database
write, since the client has no login (see 7.4).

5.12 Client portal

Accessed via a tokenized link, no login required. Shows:

Current phase and overall project status

Task counts by status, and the task list itself for tasks marked
client_visible

Who is working on what: assignee names against client-visible tasks

Open blockers marked client visible, with a short description of what's
holding progress

Client action items awaiting a response

Recent status updates marked visible to client

A portal messaging block for the team to highlight relevant services or
next steps (see 5.13)

Assignee names and task-level detail are shown by design, gated by the
client_visible flag so the team retains control over what surfaces
externally. Schedule and velocity detail, critical path position, sprint
scope, automation activity, are not exposed to clients; the health badge
is the client-facing signal for schedule risk.

5.13 Portal messaging

A simple content block the team can set per project, shown inside the
client portal. Intended as a lightweight way to surface relevant next
steps or additional services for that client's engagement, for example
suggesting a retainer extension or a related service line. Content is
entirely team-authored. This is a manually curated message, not a
recommendation engine, and nothing is selected automatically.

5.14 Configurable workflows

Projects currently share one fixed set of task statuses. This module
lets each project use its own workflow: its own status names, its own
sort order, its own allowed transitions between them. A status's
category, to do, in progress, or done, stays fixed regardless of its
label, and every calculation elsewhere in the system, burndown, health,
blockers, dependencies, sprints, automations, reads from category, never
from the label. That's what lets a client call a status whatever they
want without breaking anything downstream.

5.15 Task dependencies and critical path

Tasks can depend on other tasks. A dependency has a type, matching
standard project scheduling conventions, and the system prevents a
dependency graph from looping back on itself. A scheduled job computes
the critical path, the chain of tasks with zero slack, and stores the
result rather than recalculating it live. A blocker on a critical-path
task is treated as more urgent than one on a task with schedule slack
(see 7.2).

5.16 Sprints and velocity

A sprint now belongs to a phase, not directly to a project; a phase can
contain several sprints over its lifetime. Tasks can be pulled into a
time-boxed sprint rather than sitting only against a phase. A task
without a sprint assignment sits in the backlog at the phase level.
Story points are captured alongside estimated hours: hours still drive
burndown and tie to the daily logs billing runs on, points are what
sprint velocity conventionally uses. Scope changes after a sprint
starts, points added or removed, are tracked separately from points
completed.

5.17 Project roles

Projects reference roles through project_roles rather than any fixed
list of job titles baked into the system. A role is whatever name an
admin gives it, QA, backend, designer, copywriter, account lead, and
project_members links a person to a project against one of those roles.
Nothing elsewhere in this document assumes a specific role exists;
anywhere a role is referenced, for example in an automation action, it
resolves against whatever project_roles actually contains for that
project. This closes a gap noted in the previous version of this
document, where roles were referenced by foreign key elsewhere in the
base system but had no table of their own defined.

5.18 Automation rules

An admin-configurable rule engine, structured the way established
platforms handle this: a trigger starts the rule, one or more conditions
must all pass for it to continue, and one or more actions run in
sequence once they do. Rules are scoped to a project and carry a status
of draft, enabled, or disabled. A rule can be set to allow triggering
other rules, off by default, and every execution is written to an audit
table regardless of outcome. See 7.9 for the execution model and 7.10
for how a role-based action resolves to an actual person.

5.19 Kanban board

A read-only board per project, phase, or sprint. Columns are that
project's own workflow_statuses in their defined sort order, so the
board reflects whatever workflow that project actually uses, nothing
about the columns is fixed to a particular set of stages. Cards show
task title, assignee, and priority. This is read-only by design, not
just for simplicity: see 7.9 for why a draggable board is a bad idea
once automation rules exist.

6.  Data model changes

6.1 Modified core tables

tasks

daily_logs

projects gains workflow_template_id (uuid, references
workflow_templates.id).

6.2 Collaboration and status-history tables

blockers

task_comments

project_status_updates

task_status_history

Every time a task's status changes, a row is written here. Written by a
database trigger on tasks.status_id, not application code, so no code
path can change a status without leaving a record.

6.3 Client portal tables

project_share_links

project_share_views

Lightweight, unauthenticated view log so the team can see whether a
client has actually opened the link.

client_action_items

client_portal_messages

project_health_snapshots

Populated by a daily cron job so health status and burndown can be
charted over time.

6.4 Workflow tables

workflow_templates

workflow_statuses

workflow_transitions

Templates are reusable objects, not owned by a single project, so
several projects can share a standard template, or a project can point
to one built for a specific client.

6.5 Scheduling tables

task_dependencies

A cycle check runs on insert: a task cannot depend, directly or
transitively, on a task that depends on it.

task_schedule_snapshots

6.6 Sprint tables

sprints

sprint_snapshots

Captured daily while a sprint is active, and at sprint close.

6.7 Roles and settings tables

project_roles

No fixed list anywhere. An admin defines whatever roles a project
actually needs.

project_members gains role_id (uuid, references project_roles.id,
nullable), closing the gap noted in the previous version of this
document where a role reference existed elsewhere in the base system
without a table behind it.

project_settings

One row per project. Every threshold used in health and schedule
calculations elsewhere in this document lives here, with sensible
defaults, not as a constant in the calculation itself.

6.8 Automation tables

automation_rules

automation_rule_runs

6.9 AI foundation table (reserved)

This table exists so an audit trail is already in place when AI-driven
actions begin. It is not written to or read from anywhere in this
version.

ai_agent_actions

7.  Business logic

7.1 Burndown calculation

Remaining work for a project, phase, or sprint is the sum, across all
estimated tasks in scope, of estimated_hours minus hours logged against
that task, floored at zero:

remaining = SUM over tasks of max(0, task.estimated_hours - hours logged
against task.id)

The ideal line runs linearly from total estimated hours down to zero,
between the earliest task creation date and the phase, sprint, or
project due date. The actual line is plotted from daily snapshot
history. Tasks without an estimate are excluded from the calculation and
shown as a separate unestimated count next to the chart, rather than
blocking the feature.

7.2 Health status

Computed daily per project by a scheduled job, against that project's
own project_settings row rather than one fixed threshold for every
project, so a project running fast weekly cycles and one running slow
quarterly phases can each define their own version of at risk:

The default values above are starting points, adjustable per project
through project_settings, and should be tuned once real project data is
available (see section 11).

7.3 Client share link security

Token is a high-entropy random string, not a sequential or guessable ID

Optional passcode, hashed at rest, checked before rendering the client
view

Configurable expiry; links default to expiring rather than staying open
indefinitely

Revocable at any time from the project page, independent of expiry

A revoked or expired token returns a generic link no longer available
page, not an error that reveals project existence

7.4 Client action item completion

Client action items can only be marked complete by a valid, unexpired,
unrevoked share token scoped to that project. The write happens through
a dedicated edge function using a service role, not a client-writable
row-level security policy, since there is no client identity to scope a
policy to. Completing an action item does not require anything beyond
the passcode already required to view the portal, if one is set.

7.5 Workflow category mapping

Every calculation in this document, burndown, health, critical path,
velocity, automation conditions, resolves a task's state through
workflow_statuses.category, never through the status name. This is what
lets a project's workflow use any labels it wants without breaking
downstream logic.

7.6 Critical path calculation

Forward pass: for each task in dependency order, earliest_start is the
latest of its dependencies' earliest_finish values (or the project
start, if it has none), and earliest_finish is earliest_start plus its
duration. Backward pass: starting from the project or phase target end
date, latest_finish is the earliest of its dependents' latest_start
values (or the target date, if it has none), and latest_start is
latest_finish minus its duration. slack_days is latest_start minus
earliest_start. A task is on the critical path when slack_days equals
zero.

Duration for this calculation is estimated_hours divided by that
project's project_settings.hours_per_day, default 8. A project that
structures its working time differently, shorter days, a compressed
week, adjusts the conversion at the project level rather than the
calculation being locked to one assumption.

7.7 Sprint velocity

Velocity for a completed sprint is its completed_points. A rolling
velocity figure across the last several sprints is a straightforward
average once enough sprints exist; no forecasting logic is specified in
this document (see section 1.2).

7.8 Dependency enforcement

This module does not hard-block a status change when a task's
dependencies aren't satisfied. It surfaces a warning instead: moving a
task to done, or to any in_progress status, while an unfinished
finish_to_start predecessor exists shows a warning banner naming the
predecessor, but does not prevent the change. Hard blocking is a
reasonable next step once dependency data is trustworthy, but starting
there risks gridlock from incomplete data, a predecessor nobody got
around to estimating, blocking a task that's genuinely ready to move.

7.9 Automation execution model

A rule's trigger fires on a real event, a status change, a blocker
raised or resolved, a due date approaching, a task becoming overdue, a
schedule change, a sprint milestone, or on a manual or scheduled basis.
Once triggered, every condition on the rule must pass, in order; if one
fails, the rule stops and none of its actions run, the same behavior
established automation platforms use, so a rule can be scoped precisely
without a separate filtering step bolted on afterward.

Actions run in the order defined on the rule, under a fixed system actor
rather than impersonating whoever last touched the task, so a rule's
permissions don't depend on who happened to trigger it.

A rule can trigger another rule only when allow_triggering_other_rules
is explicitly set on it, and a rule can never re-trigger itself. Every
chain of triggered rules shares one root_event_id in
automation_rule_runs, capped at five hops, so a runaway chain is both
prevented and traceable back to whatever started it.

When two enabled rules match the same event and would both act on the
same field, priority decides which one runs; the other is logged to
automation_rule_runs as skipped, not silently overwritten and not
silently dropped.

A draggable, editable kanban board would let a casual drag-and-drop
accidentally fire a reassignment or notification rule. Keeping the board
read-only (5.19) and status changes deliberate, through the task detail
view where workflow_transitions is checked, keeps every status change an
intentional trigger rather than a side effect of a careless click.

7.10 Role resolution for automations

An action that reassigns a task to a role resolves dynamically at the
moment it runs: among project_members currently holding that
project_roles entry on that project, assign to whichever person has the
fewest tasks currently in a non-done status. This is the balanced
workload method used by established platforms for the same problem, and
it needs no capacity or hours data, just a count of open work, so it
behaves the same way regardless of what the role is called or what kind
of project it's running against. If no one currently holds the role on
that project, the action fails and is logged, not silently skipped.

8.  New edge functions, cron jobs, and triggers

A database trigger on tasks.status_id, rather than an edge function,
writes task_status_history automatically whenever a task's status
changes, so no application code path can update a task's status without
leaving a record.

9.  Permissions matrix

10. Roadmap: toward an AI scrum master

This document lays the data foundation for an AI scrum master without
building the agent itself. Every table introduced above, blockers,
task_comments, project_status_updates, task_status_history,
task_schedule_snapshots, sprint_snapshots, automation_rules,
automation_rule_runs, and the reserved ai_agent_actions table, is
structured so an agent can read project state and eventually act on it,
without another schema change when that work begins.

Stage 1: Foundation (this document)

Structured data exists for blockers, comments, status updates, task
status history, schedule snapshots, sprint snapshots, and automation
activity. No AI is involved. Everything is written by people, scheduled
jobs, or rules a person configured.

Stage 2: Assisted drafting

An agent reads task_status_history to know what changed since it last
looked, task_schedule_snapshots to know what's on the critical path,
sprint_snapshots to know whether scope crept mid-sprint,
automation_rule_runs to know what's already being handled automatically,
and blocker and log data generally, then drafts a status update or flags
a likely risk. A person reviews and posts it, using the same
project_status_updates table, with author_type set to ai and a human
approval step before visible_to_client is set.

Stage 3: Suggested actions

The agent proposes changes: reassigning a task, nudging a due date,
flagging a task as blocked once its predecessors are confirmed late,
adjusting sprint scope, or even proposing a new automation_rules row to
handle a pattern it noticed repeating. Every proposal is written to
ai_agent_actions with status proposed. A person approves or rejects
before anything is applied to tasks, projects, sprints, or the rule set
itself.

Stage 4: Managed execution

Approved categories of action apply automatically, with every change
still logged to ai_agent_actions and, where relevant,
task_status_history or automation_rule_runs, all tagged ai or system as
appropriate. Any client-facing output still passes through the same
visibility flags established throughout this document.

No implementation decisions for stages 2 through 4 are made in this
document. The intent is that the schema won't need revisiting when that
work starts.

11. Assumptions and open questions

Historical daily_logs rows won't have task_id; burndown and task-level
reporting apply only from the rollout date forward

The manager role's boundary relative to Admin is undefined in the base
system and needs resolving before this module's permissions can be
finalized

tasks.client_visible defaults to true, meaning most tasks are shown to
the client unless an admin opts one out. The alternative, defaulting to
false and requiring an explicit opt-in per task, is safer but adds admin
overhead; worth a decision before build

project_roles needs to actually be populated per project before
role-based automation actions are usable. An automation referencing a
role with nobody currently holding it will fail and log the failure, not
silently do nothing

project_settings defaults (10%, 25%, 5 days, 2 days, 8 hours) are
starting values. Nothing stops a fast-moving project and a slow-moving
one from setting very different values once real data exists; that's the
intent, not a gap

The automation system actor bypasses normal per-user permission checks
by design (7.9). If that's not acceptable, rules would need to run under
a designated real user's permissions instead, which changes the
execution model and is worth deciding now rather than after rules are
built

The five-hop chain depth cap and the use of priority for conflict
resolution are placeholders, same tuning caveat as the numeric
thresholds above

Health status thresholds, both the defaults in project_settings and the
underlying variance calculation, are still unproven against real project
data

12. Risks

13. Rollout plan

The AI scrum master stages are intentionally excluded from this rollout
plan. They follow once this module has been live long enough on real
projects to give an agent something honest to read.
