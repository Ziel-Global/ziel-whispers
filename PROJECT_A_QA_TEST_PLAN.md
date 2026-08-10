# QA Test Blueprint — Project A: PropVault Real Estate Portal

**Document Version:** 1.0  
**Target Project:** PropVault Real Estate Portal (API & Core)  
**Audience:** QA Engineers, Developers, and System Administrators  

---

## 1. Project Specification & Team Setup

### 1.1 Project Overview
* **Project Name:** `PropVault Real Estate Portal`
* **Project Key / Type:** Web & Backend Core Services
* **Description:** Property listing, tenant management, and payment processing backend API.

### 1.2 Team Members & Roles
| User Name | Role in Project | User ID Reference |
| :--- | :--- | :--- |
| **Saad Nasir** | Lead Developer | `8100e324-88a4-451d-82f5-84d1ecb9ccde` |
| **Shahid** | QA Lead | `51e1279f-bbd0-448e-b928-d7cca20b9f73` |
| **Muhammad Sami Khan** | Project Manager | `beaa51f7-3271-40f5-a30f-7861416b63c5` |

---

## 2. Workflow Setup (Standard Software Template)

Configure the project workflow with the following 4 stages and allowed transition paths:

### 2.1 Workflow Stages
1. **`Unlinked`** (Category: `todo`, Initial: `true`)
2. **`Development`** (Category: `in_progress`, Initial: `false`)
3. **`QA Review`** (Category: `in_progress`, Initial: `false`)
4. **`Done`** (Category: `done`, Initial: `false`)

### 2.2 Allowed Transition Paths
* `Unlinked` $\rightarrow$ `Development`
* `Development` $\rightarrow$ `QA Review`
* `QA Review` $\rightarrow$ `Development` (QA Rejection)
* `QA Review` $\rightarrow$ `Done`
* `Done` $\rightarrow$ `Development` (Re-open)

> [!WARNING]
> **Disallowed / Illegal Transitions**:
> * `Done` $\rightarrow$ `QA Review` (Direct jump back to QA is prohibited)
> * `Unlinked` $\rightarrow$ `Done` (Direct jump skipping Dev/QA is prohibited)

---

## 3. Automation Rules Setup (Project Settings)

Create the following **7 Automation Rules** under **Project Settings $\rightarrow$ Automation Rules**:

| Rule ID | Rule Name | Trigger | Conditions | Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Rule A1** | `Auto-Return High Priority Bugs` | `Blocker Raised` | `priority = 'high'` | `change_status (QA Review)` |
| **Rule A2** | `Assign Low Dev Blockers to PM` | `Blocker Raised` | `priority = 'low'` AND `status_id = 'Development'` | `assign_user (Muhammad Sami Khan)` |
| **Rule A3** | `Global Blocker Audit Logger` | `Blocker Raised` | *(None / Match All)* | `add_comment ("Audit Alert: Blocker logged on PropVault task.")` |
| **Rule A4** | `Resume Development on Blocker Clear` | `Blocker Resolved` | *(None / Match All)* | `change_status (Development)` |
| **Rule A5** | `Auto-Assign QA Lead on QA Transition` | `Status Changed` | `status_id = 'QA Review'` | `assign_user (Shahid)` |
| **Rule A6** | `Return QA Rejections to Original Developer` | `Status Changed` | `status_id = 'Development'` | `reassign_to_stage_owner (Target: Development, lookup_by: 'from')` |
| **Rule A7** | `Notify Developer on QA Transition` | `Status Changed` | `status_id = 'QA Review'` | `notify_user (recipient: task_assignee, title: "QA Review Pending", template: "Task {task_title} moved to QA in {project_name}")` |

---

## 4. Tasks Seed Inventory (20 Tasks)

Create the following **20 realistic tasks** inside **PropVault Real Estate Portal** prior to running test cases:

| Task # | Task Title | Description | Priority | Initial Status | Assignee |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Task A-01** | `Implement OAuth 2.0 PKCE Authentication Flow` | OAuth2 service for tenant portal login | High | `Unlinked` | Saad Nasir |
| **Task A-02** | `Fix Concurrent Transaction Deadlock in Stripe Webhook` | Payment webhook concurrency deadlock fix | High | `Done` | Saad Nasir |
| **Task A-03** | `Sanitize JWT Bearer Token Header Storage` | Sanitize token headers in auth layer | High | `Unlinked` | Saad Nasir |
| **Task A-04** | `Integrate Apple Pay Express Checkout Gateway` | Express checkout integration | High | `Development` | Saad Nasir |
| **Task A-05** | `Refactor Property Inventory Listing Export API` | Property export CSV/JSON refactor | Medium | `Development` | Saad Nasir |
| **Task A-06** | `QA Review for Dark Mode Theme Toggle on Tenant Portal` | UI dark mode toggle inspection | Medium | `Development` | Unassigned |
| **Task A-07** | `Fix OAuth Token Expiration State Crash` | OAuth token expiration crash patch | High | `Development` | Saad Nasir |
| **Task A-08** | `Fix Redis Token Revocation Cache Invalidation Crash` | Redis cache invalidation patch | High | `QA Review` | Saad Nasir |
| **Task A-09** | `Update OpenAPI 3.0 Documentation for Billing Endpoints` | Swagger OpenAPI specs update | Medium | `Development` | Saad Nasir |
| **Task A-10** | `Setup Automated Transaction Summary Email Alerts` | Daily sales digest email trigger | Medium | `Development` | Saad Nasir |
| **Task A-11** | `Fix Tenant Login Redirect Loop on Slow 3G Networks` | Redirect loop on slow cellular network | High | `Development` | Saad Nasir |
| **Task A-12** | `Optimize PostgreSQL Query Execution Plan for Ledger History` | Query optimization for ledger table | Medium | `Development` | Saad Nasir |
| **Task A-13** | `Audit Biometric Authentication SDK Memory Footprint` | Biometric memory footprint profiling | High | `Development` | Unassigned |
| **Task A-14a** | `Design Tenant Lease Receipt PDF Generator Service` | PDF renderer module for leases | Low | `Development` | Saad Nasir |
| **Task A-14b** | `Sanitize JWT Bearer Token` | JWT token validator helper | High | `Development` | Saad Nasir |
| **Task A-15a** | `Configure Middleware Audit Log Interceptor` | Audit logging middleware setup | Medium | `Development` | Saad Nasir |
| **Task A-15b** | `Enforce Granular RBAC Policies on Refund Endpoints` | RBAC security policy enforcement | High | `Development` | Saad Nasir |
| **Task A-16** | `Patch TLS Certificate Pinning Validator in iOS App` | SSL certificate pinning patch | High | `Development` | Saad Nasir |
| **Task A-17** | `Add Push Notifications for Failed Remote Account Reload` | Push alert for reload failures | Low | `Development` | Saad Nasir |
| **Task A-18** | `Add Fingerprint Fallback Mode for Older Android Devices` | Legacy fingerprint fallback | Low | `Development` | Unassigned |
| **Task A-19** | `Fix Multi-Currency Symbol Formatting in Payment Receipt UI` | Multi-currency symbol renderer fix | Low | `Development` | Saad Nasir |
| **Task A-20** | `Validate Session Expiration Warning Modal Popup` | Session timeout modal validation | Medium | `Development` | Saad Nasir |

---

## 5. Step-by-Step Test Cases (20 Test Scenarios)

### Category 1: Workflow Transition & Illegal Transition Guards

#### **TC-A-01: Standard Workflow Transition Path**
* **Target Task:** `Implement OAuth 2.0 PKCE Authentication Flow` (Task A-01)
* **Initial State:** Status `Unlinked`, Assignee `Saad Nasir`
* **Test Steps:**
  1. Open task `Implement OAuth 2.0 PKCE Authentication Flow`.
  2. Change status to `Development`.
  3. Change status to `QA Review`.
  4. Change status to `Done`.
* **Expected Result:** Task transitions cleanly across `Unlinked` $\rightarrow$ `Development` $\rightarrow$ `QA Review` $\rightarrow$ `Done`. `status_id` and text `status` update in sync.

#### **TC-A-02: Illegal Transition Guard (`Done` $\rightarrow$ `QA Review`)**
* **Target Task:** `Fix Concurrent Transaction Deadlock in Stripe Webhook` (Task A-02)
* **Initial State:** Status `Done`
* **Test Steps:**
  1. Open completed task `Fix Concurrent Transaction Deadlock in Stripe Webhook`.
  2. Attempt to move status directly to `QA Review`.
* **Expected Result:** Transition is **rejected**. Error message displayed. Status remains `Done`. No automation rules execute.

#### **TC-A-03: Direct Jump Guard (`Unlinked` $\rightarrow$ `Done`)**
* **Target Task:** `Sanitize JWT Bearer Token Header Storage` (Task A-03)
* **Initial State:** Status `Unlinked`
* **Test Steps:**
  1. Open task `Sanitize JWT Bearer Token Header Storage`.
  2. Attempt direct status change to `Done`.
* **Expected Result:** Transition is **blocked** by database BEFORE trigger. Task status remains `Unlinked`.

#### **TC-A-04: Daily Log Stage Outcome Submission (`declare_stage_outcome`)**
* **Target Task:** `Integrate Apple Pay Express Checkout Gateway` (Task A-04)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Developer opens **Log Submit** form.
  2. Selects task `Integrate Apple Pay Express Checkout Gateway`.
  3. Declares stage outcome to `QA Review` and submits log.
* **Expected Result:** Task status updates to `QA Review`. `declare_stage_outcome` RPC executes transition and triggers Rule A5 (Auto-assign QA Lead Shahid).

#### **TC-A-05: Status History Audit Trail Logging**
* **Target Task:** `Refactor Property Inventory Listing Export API` (Task A-05)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Open task `Refactor Property Inventory Listing Export API`.
  2. Change status to `QA Review`.
  3. Check `task_status_history` audit table.
* **Expected Result:** New audit history entry logged with `from_status_id` (Development), `to_status_id` (QA Review), `changed_by_type = 'system'`, and timestamp.

---

### Category 2: Automation Rule Triggers & Actions

#### **TC-A-06: Auto-Assign QA Lead on QA Review Transition**
* **Target Task:** `QA Review for Dark Mode Theme Toggle on Tenant Portal` (Task A-06)
* **Initial State:** Status `Development`, Unassigned
* **Test Steps:**
  1. Open task `QA Review for Dark Mode Theme Toggle on Tenant Portal`.
  2. Change status to `QA Review`.
* **Expected Result:** Rule A5 fires. Task `assigned_to` automatically updates to QA Lead **Shahid**.

#### **TC-A-07: Blocker Raised Automation on High Priority Task**
* **Target Task:** `Fix OAuth Token Expiration State Crash` (Task A-07)
* **Initial State:** Status `Development`, Priority `High`
* **Test Steps:**
  1. Open task `Fix OAuth Token Expiration State Crash`.
  2. Click **Raise Blocker** and enter description `"OAuth server timeout"`.
* **Expected Result:** Rule A1 fires (`blocker_raised` + `priority = high`). Task status automatically changes to `QA Review`.

#### **TC-A-08: Blocker Resolved Automation**
* **Target Task:** `Fix Redis Token Revocation Cache Invalidation Crash` (Task A-08)
* **Initial State:** Status `QA Review`, Open Blocker present
* **Test Steps:**
  1. Open task `Fix Redis Token Revocation Cache Invalidation Crash`.
  2. Click **Mark Blocker Resolved**.
* **Expected Result:** Rule A4 fires (`blocker_resolved`). Task status automatically changes back to `Development`.

#### **TC-A-09: Multi-Action Rule Execution**
* **Target Task:** `Update OpenAPI 3.0 Documentation for Billing Endpoints` (Task A-09)
* **Initial State:** Status `Development`, Priority `Medium`
* **Test Steps:**
  1. Open task `Update OpenAPI 3.0 Documentation for Billing Endpoints`.
  2. Raise a blocker on the task.
* **Expected Result:** Rule A9 executes multiple actions: task `assigned_to` updates to **Saad Nasir** AND comment `"Escalated to lead developer Saad Nasir"` is added to task comments.

#### **TC-A-10: In-App User Notification Dispatched**
* **Target Task:** `Setup Automated Transaction Summary Email Alerts` (Task A-10)
* **Initial State:** Status `Development`, Assignee `Saad Nasir`
* **Test Steps:**
  1. Open task `Setup Automated Transaction Summary Email Alerts`.
  2. Move status to `QA Review`.
* **Expected Result:** Rule A7 fires. Notification created in `notifications` table for Saad Nasir: `"Task Setup Automated Transaction Summary Email Alerts moved to QA in PropVault Real Estate Portal"`.

---

### Category 3: Stage Owner Reassignment (`lookup_by: from/to`)

#### **TC-A-11: QA Rejection Reassignment to Original Developer (`lookup_by: from`)**
* **Target Task:** `Fix Tenant Login Redirect Loop on Slow 3G Networks` (Task A-11)
* **Initial State:** Task in `Development` worked on by Developer Saad Nasir.
* **Test Steps:**
  1. Developer Saad Nasir moves task to `QA Review` assigned to QA Shahid.
  2. QA Shahid rejects task and moves status back to `Development`.
* **Expected Result:** Rule A6 fires (`lookup_by: from`). Task is **reassigned back to original developer Saad Nasir** (who sent task away from Development), NOT QA Shahid.

#### **TC-A-12: Stage Owner Reassignment (`lookup_by: to`)**
* **Target Task:** `Optimize PostgreSQL Query Execution Plan for Ledger History` (Task A-12)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Move task to `QA Review`.
  2. Move task back to `Development` using rule configured with `lookup_by: to`.
* **Expected Result:** Task is reassigned to the user who last arrived at `Development`.

#### **TC-A-13: Fallback Role Assignment**
* **Target Task:** `Audit Biometric Authentication SDK Memory Footprint` (Task A-13)
* **Initial State:** Status `Development`, No prior status history
* **Test Steps:**
  1. Move task to status with rule configured to reassign to stage owner with `fallback_role: Lead Developer`.
* **Expected Result:** System checks status history (finds none) and falls back to assigning task to workload-balanced `Lead Developer` (Saad Nasir).

---

### Category 4: Task Dependencies & Blocker Linkages

#### **TC-A-14: Multiple AND Conditions Evaluation**
* **Target Task:** `Design Tenant Lease Receipt PDF Generator Service` (Task A-14a) vs `Sanitize JWT Bearer Token` (Task A-14b)
* **Initial State:** Task A-14a is Low Priority in Dev; Task A-14b is High Priority in Dev.
* **Test Steps:**
  1. Raise blocker on Task A-14b (High Priority).
  2. Raise blocker on Task A-14a (Low Priority in Dev).
* **Expected Result:** Rule A2 matching `priority = low AND status = Development` skips Task A-14b and executes ONLY on Task A-14a, assigning it to PM Sami Khan.

#### **TC-A-15: Finish-to-Start Dependency Completion Guard**
* **Target Task:** `Enforce Granular RBAC Policies on Refund Endpoints` (Task A-15b)
* **Precondition:** Task A-15b has Finish-to-Start dependency on `Configure Middleware Audit Log Interceptor` (Task A-15a). Task A-15a is incomplete.
* **Test Steps:**
  1. Open task `Enforce Granular RBAC Policies on Refund Endpoints`.
  2. Attempt to change status to `Done`.
* **Expected Result:** Warning modal displays / transition blocked until prerequisite Task A-15a is completed.

#### **TC-A-16: Action Item & Blocker Linkage**
* **Target Task:** `Patch TLS Certificate Pinning Validator in iOS App` (Task A-16)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Raise blocker `"TLS Cert Expired"` on task.
  2. Create action item `"Renew TLS Certificate"` linked to blocker.
  3. Mark action item `completed`.
* **Expected Result:** Action item updates to `completed`. Linked blocker status updates or notifies raiser.

#### **TC-A-17: Automation Rule Toggle (Enable/Disable)**
* **Target Task:** `Add Push Notifications for Failed Remote Account Reload` (Task A-17)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Go to Project Settings $\rightarrow$ Automation Rules and toggle Rule A1 to `Disabled`.
  2. Raise High Priority blocker on task (verify status does NOT change).
  3. Toggle Rule A1 to `Enabled` and raise blocker.
* **Expected Result:** Rule is ignored while disabled and executes normally when enabled.

---

### Category 5: Workload Balancing & Execution Safeguards

#### **TC-A-18: Workload-Balanced Role Assignment (`assign_role`)**
* **Target Task:** `Add Fingerprint Fallback Mode for Older Android Devices` (Task A-18)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Trigger status change rule configured with `assign_role (Lead Developer)`.
* **Expected Result:** Task is assigned to the developer holding `Lead Developer` role with the **fewest active tasks**.

#### **TC-A-19: Automation Chain Depth Safety Cap**
* **Target Task:** `Fix Multi-Currency Symbol Formatting in Payment Receipt UI` (Task A-19)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Trigger rule chain (Rule 1 $\rightarrow$ Rule 2 $\rightarrow$ Rule 3).
* **Expected Result:** Execution completes safely. Depth cap at 5 hops prevents infinite recursion loops.

#### **TC-A-20: Suppressed Double-Fire Execution**
* **Target Task:** `Validate Session Expiration Warning Modal Popup` (Task A-20)
* **Initial State:** Status `Development`
* **Test Steps:**
  1. Submit stage change for task via `declare_stage_outcome` RPC.
  2. Query `automation_rule_runs` table.
* **Expected Result:** Status updates and automations execute **exactly once**. No duplicate rule execution records.
