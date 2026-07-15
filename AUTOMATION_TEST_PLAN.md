# Automation Rules — Test Plan

## Quick Reference Card

| Resource | Name / Value | ID |
|----------|-------------|-----|
| **Project** | Ziel Automation Test | `2ab21444-5569-4837-903b-3a76b02c0cf8` |
| **Sprint 1** | Active | See DB |
| **Developer** | Muhammad Ibrahim Syed | See DB |
| **QA** | Muhammad Husnain Shakir | See DB |

| Task | Sprint | Status | Priority |
|------|--------|--------|----------|
| T1. Design the homepage | None | unlinked | high |
| T2. Build the API | Sprint 1 | linked | high |
| T3. Write unit tests | Sprint 1 | linked | medium |
| T4. QA the homepage | Sprint 1 | in_progress | medium |
| T5. Deploy to staging | None | unlinked | low |
| T6. Fix login bug | Sprint 1 | linked (OVERDUE) | high |

---

## Prerequisites

- [ ] You are logged in as **admin**
- [ ] You can see **"Ziel Automation Test"** in your project list and open it
- [ ] The **Automation** tab is visible (admin only)
- [ ] All 6 tasks above appear in the Tasks tab
- [ ] **Sprint 1** exists in the Sprints tab with status "active"

---

## Section 1: Sprint ↔ Status (Foundation)

_Run these first. If these fail, automation rules won't work correctly._

### 1.1 Task with no sprint → status = unlinked

| # | Action | Expected |
|---|--------|----------|
| 1 | Click **Add Task** | Dialog opens |
| 2 | Set Title = `Test unlinked task` | — |
| 3 | Leave Sprint = **Backlog** | — |
| 4 | Click **Create Task** | Task created |
| 5 | Find the new task in the table | Status shows **unlinked** |

### 1.2 Task with a sprint → status = linked

| # | Action | Expected |
|---|--------|----------|
| 1 | Click **Add Task** | Dialog opens |
| 2 | Set Title = `Test linked task` | — |
| 3 | Set Sprint = **Sprint 1** | — |
| 4 | Click **Create Task** | Task created |
| 5 | Find the new task in the table | Status shows **linked** |

### 1.3 Edit task — assign sprint → status becomes linked

| # | Action | Expected |
|---|--------|----------|
| 1 | Click the **pencil icon** on **T1. Design the homepage** (currently unlinked) | Edit dialog opens |
| 2 | Set Sprint = **Sprint 1** | — |
| 3 | Click **Save** | — |
| 4 | Look at the task row | Status changed to **linked** |

### 1.4 Edit task — remove sprint (Backlog) → status becomes unlinked

| # | Action | Expected |
|---|--------|----------|
| 1 | Click the **pencil icon** on the same task | Edit dialog opens |
| 2 | Set Sprint = **Backlog** (deselects the sprint) | — |
| 3 | Click **Save** | — |
| 4 | Look at the task row | Status changed back to **unlinked** |

---

## Section 2: Blocker Rules

_Build automation rules in the **Automation** tab, then raise blockers in the Task Details view._

### 2.1 Blocker raised → change status to returned

**Build this rule first:**

| Field | Value |
|-------|-------|
| Name | `Blocker → Returned` |
| Status | Enabled |
| Trigger | Blocker Raised |
| Condition | Task Status **equals** linked |
| Action | Change Task Status → **returned** |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T2. Build the API** (linked, high) | Details dialog opens |
| 2 | Scroll to Blockers section, click **Report Blocker** | — |
| 3 | Enter a description and save | — |
| 4 | Close and re-open the task | Status changed to **returned** |
| 5 | **Verify in DB:** `SELECT result FROM automation_rule_runs ORDER BY triggered_at DESC LIMIT 5` | result = `success` |

**Troubleshooting:** If status didn't change, check:
- Rule is **Enabled** (not Draft/Disabled)
- Task status was **linked** when blocker was raised
- `run_automation_rules` function runs as SECURITY DEFINER (migration applied)

---

### 2.2 Condition not met → rule skipped

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `Skip if not in_progress` |
| Status | Enabled |
| Trigger | Blocker Raised |
| Condition | Task Status **equals** in_progress |
| Action | Change Task Status → **returned** |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T3. Write unit tests** (linked, medium — NOT in_progress) | — |
| 2 | Raise a blocker | — |
| 3 | **Verify in DB:** `SELECT result FROM automation_rule_runs ORDER BY triggered_at DESC LIMIT 5` | result = `condition_not_met` |
| 4 | Check the task status | Still **linked** (unchanged) |

---

### 2.3 Multiple conditions (AND logic)

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `High + Linked → Returned` |
| Status | Enabled |
| Trigger | Blocker Raised |
| Condition 1 | Task Status **equals** linked |
| Condition 2 | Priority **equals** high |
| Action | Change Task Status → **returned** |

**Execute — should fire:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T2. Build the API** (linked + high) | — |
| 2 | Raise a blocker | — |
| 3 | Check task status | Changed to **returned** |
| 4 | Verify DB: result = `success` | — |

**Execute — should NOT fire:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T3. Write unit tests** (linked + medium — medium fails condition 2) | — |
| 2 | Raise a blocker | — |
| 3 | Verify DB: result = `condition_not_met` | — |
| 4 | Check task status | Still **linked** (unchanged) |

---

### 2.4 Empty conditions = match all

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `Match All Blockers` |
| Status | Enabled |
| Trigger | Blocker Raised |
| Conditions | _(none — leave empty)_ |
| Action | Add Comment → `"Blocker was raised on this task"` |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **any task** (regardless of status/priority) | — |
| 2 | Raise a blocker | — |
| 3 | Verify DB: result = `success` | — |
| 4 | Check the task's Comments section | Comment "Blocker was raised on this task" appears |

---

### 2.5 Multiple actions in sequence

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `Full Blocker Response` |
| Status | Enabled |
| Trigger | Blocker Raised |
| Condition | Task Status **equals** linked |
| Action 1 | Add Comment → `"Blocker detected, processing..."` |
| Action 2 | Assign to Role → **QA** |
| Action 3 | Change Task Status → **returned** |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T3. Write unit tests** (linked, medium) | — |
| 2 | Raise a blocker | — |
| 3 | Check Comments | Comment "Blocker detected, processing..." appears |
| 4 | Check Assigned To field | Reassigned to **QA** member |
| 5 | Check Status | Changed to **returned** |

---

### 2.6 Blocker resolved → assign to role

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `Resolved → QA` |
| Status | Enabled |
| Trigger | Blocker Resolved |
| Conditions | _(none — match all)_ |
| Action | Assign to Role → **QA** |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T5. Deploy to staging** (unlinked, low) | — |
| 2 | Raise a blocker, then click the green checkmark to **Resolve** it | — |
| 3 | Check Assigned To field | Reassigned to **QA** member |

---

### 2.7 Toggle rule on/off

| # | Action | Expected |
|---|--------|----------|
| 1 | **Disable** the "Match All Blockers" rule (flip the switch) | — |
| 2 | Open any task and raise a blocker | — |
| 3 | Verify DB: `SELECT result FROM automation_rule_runs ...` | result = `skipped` or no run at all |
| 4 | **Re-enable** the rule | — |
| 5 | Raise another blocker | Rule fires (result = `success`) |

---

## Section 3: Status Change Rules

### 3.1 Status change → add comment (detect sprint assignment)

> Note: Status is now auto-derived from sprint assignment. Changing a task's sprint triggers a status change, which fires the automation rule.

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `Sprint Changed → Notify` |
| Status | Enabled |
| Trigger | Status Change |
| Condition | Task Status **equals** linked |
| Action | Add Comment → `"Task was assigned to a sprint"` |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T5. Deploy to staging** (currently Backlog → unlinked) | — |
| 2 | Set Sprint = **Sprint 1**, click **Save** | Status changes to **linked**, auto-trigger fires |
| 3 | Open the task's Comments section | Comment "Task was assigned to a sprint" appears |
| 4 | Verify DB: `SELECT result FROM automation_rule_runs ORDER BY triggered_at DESC LIMIT 5` | result = `success` |

---

## Section 4: Scheduled & Advanced Rules

### 4.1 Scheduled rule → change overdue task status

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `Overdue → Returned` |
| Status | Enabled |
| Trigger | Scheduled |
| Condition | Due Date **less than** today |
| Action | Change Task Status → **returned** |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Note **T6. Fix login bug** — due date is 2 days ago, linked, high | — |
| 2 | Run the scheduler manually via SQL: `SELECT run_scheduled_automations();` | — |
| 3 | Check T6's status | Changed to **returned** |
| 4 | Verify DB: result = `success` | — |

---

### 4.2 Assign role with load balancing

> Requires the Developer role to have at least 2 members. If not, add another member with Developer role first.

**Build this rule:**

| Field | Value |
|-------|-------|
| Name | `Balance Load` |
| Status | Enabled |
| Trigger | Blocker Raised |
| Condition | Task Status **equals** linked |
| Action | Assign to Role → **Developer** |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Give one Developer member extra tasks (assign existing tasks to them) | — |
| 2 | Open **T3. Write unit tests** (linked) | — |
| 3 | Raise a blocker | — |
| 4 | Check Assigned To | Set to the **least-loaded** Developer member |

---

### 4.3 Chain protection (5-hop cap)

**Build 3 chaining rules:**

| Rule | Name | Trigger | Condition | Action | Allow Chaining? |
|------|------|---------|-----------|--------|-----------------|
| **A** | Chain A → In Progress | Blocker Raised | status = linked | Change Status → in_progress | Yes |
| **B** | Chain B → Returned | Status Change | status = in_progress | Change Status → returned | Yes |
| **C** | Chain C → Unlinked | Status Change | status = returned | Change Status → unlinked | Yes |

**Execute the test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open **T2. Build the API** (linked, high) | — |
| 2 | Raise a blocker | — |
| 3 | Chain starts: A fires (→in_progress), B fires (→returned), C fires (→unlinked) | — |
| 4 | Check task status | Should have changed through the chain |
| 5 | Verify DB: `SELECT COUNT(*) FROM automation_rule_runs WHERE root_event_id = '<root_id>'` | ≤ 5 hops |

---

## Section 5: Admin Features

### 5.1 Delete task (admin)

| # | Action | Expected |
|---|--------|----------|
| 1 | Go to **Tasks** tab | — |
| 2 | Find any task, click the **trash icon** (🗑) in the Actions column | Confirmation dialog appears |
| 3 | Click **Delete** | — |
| 4 | Toast confirms deletion | Task disappears from table |

### 5.2 Delete task (non-admin — icon hidden)

| # | Action | Expected |
|---|--------|----------|
| 1 | Log in as a non-admin user (e.g. Muhammad Ibrahim Syed) | — |
| 2 | Go to the same project's Tasks tab | — |
| 3 | Look at the Actions column | **No trash icon** appears |

---

## Test Results Log

| # | Test Name | Date | Pass/Fail | Notes / Bug Ref |
|---|-----------|------|-----------|-----------------|
| 1.1 | No sprint → unlinked | | | |
| 1.2 | Sprint → linked | | | |
| 1.3 | Assign sprint → linked | | | |
| 1.4 | Backlog → unlinked | | | |
| 2.1 | Blocker → returned | | | |
| 2.2 | Condition not met → skip | | | |
| 2.3 | Multiple conditions (AND) | | | |
| 2.4 | Empty conditions → match all | | | |
| 2.5 | Multiple actions in sequence | | | |
| 2.6 | Blocker resolved → assign role | | | |
| 2.7 | Toggle on/off | | | |
| 3.1 | Status change → comment | | | |
| 4.1 | Scheduled → overdue | | | |
| 4.2 | Load balancing | | | |
| 4.3 | Chain protection (5 hops) | | | |
| 5.1 | Delete task (admin) | | | |
| 5.2 | Delete task (non-admin) | | | |

---

## Useful SQL Queries

```sql
-- Check rule runs (last 10)
SELECT * FROM automation_rule_runs ORDER BY triggered_at DESC LIMIT 10;

-- Run scheduled automations manually
SELECT run_scheduled_automations();

-- Check task status changes
SELECT id, title, status, due_date FROM tasks WHERE project_id = '2ab21444-5569-4837-903b-3a76b02c0cf8' ORDER BY title;

-- Trigger status change manually (if UI can't)
SELECT change_task_status('<task_id>', '<target_status_id>', 'auto');

-- Find status IDs
SELECT id, name FROM workflow_statuses WHERE workflow_template_id = (
  SELECT workflow_template_id FROM projects WHERE id = '2ab21444-5569-4837-903b-3a76b02c0cf8'
);
```
