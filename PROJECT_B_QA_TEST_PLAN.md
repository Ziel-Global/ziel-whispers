# QA Test Blueprint — Project B: ApexPay Cross-Border Remittance App

**Document Version:** 1.0  
**Target Project:** ApexPay Cross-Border Remittance App (iOS & Android)  
**Audience:** QA Engineers, Security Auditors, Product Owners, and System Administrators  

---

## 1. Project Specification & Team Setup

### 1.1 Project Overview
* **Project Name:** `ApexPay Cross-Border Remittance App`
* **Project Key / Type:** Mobile Banking & Remittance Platform
* **Description:** High-security cross-border wire transfers, wallet management, and compliance auditing.

### 1.2 Team Members & Roles
| User Name | Role in Project | User ID Reference |
| :--- | :--- | :--- |
| **Saad Nasir** | Security Engineer | `8100e324-88a4-451d-82f5-84d1ecb9ccde` |
| **Shahid** | Compliance Auditor | `51e1279f-bbd0-448e-b928-d7cca20b9f73` |
| **Muhammad Sami Khan** | Product Owner | `beaa51f7-3271-40f5-a30f-7861416b63c5` |

---

## 2. Workflow Setup (Custom Fintech Template)

Configure the project workflow with the following 5 custom stages and allowed transition paths:

### 2.1 Workflow Stages
1. **`Backlog`** (Category: `todo`, Initial: `true`)
2. **`In Development`** (Category: `in_progress`, Initial: `false`)
3. **`Security Audit`** (Category: `in_progress`, Initial: `false`)
4. **`Staging`** (Category: `in_progress`, Initial: `false`)
5. **`Completed`** (Category: `done`, Initial: `false`)

### 2.2 Allowed Transition Paths
* `Backlog` $\rightarrow$ `In Development`
* `In Development` $\rightarrow$ `Security Audit`
* `In Development` $\rightarrow$ `Completed` (Fast-track non-security tasks)
* `Security Audit` $\rightarrow$ `In Development` (Audit Rejection / Remediation)
* `Security Audit` $\rightarrow$ `Staging` (Audit Approval)
* `Staging` $\rightarrow$ `In Development` (Staging Regression)
* `Staging` $\rightarrow$ `Completed` (Release)
* `Completed` $\rightarrow$ `In Development` (Re-open)

> [!WARNING]
> **Disallowed / Illegal Transitions**:
> * `Backlog` $\rightarrow$ `Staging` (Direct jump from Backlog to Staging is prohibited)
> * `Backlog` $\rightarrow$ `Security Audit` (Direct jump skipping In Development is prohibited)

---

## 3. Automation Rules Setup (Project Settings)

Create the following **6 Automation Rules** under **Project Settings $\rightarrow$ Automation Rules**:

| Rule ID | Rule Name | Trigger | Conditions | Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Rule B1** | `Move Security Tasks to Audit` | `Status Changed` | `description CONTAINS 'Security'` | `change_status (Security Audit)` |
| **Rule B2** | `Assign Non-Low Blockers to Security Engineer` | `Blocker Raised` | `priority neq 'low'` | `assign_user (Saad Nasir)` |
| **Rule B3** | `Match-All Audit Logger` | `Blocker Raised` | *(None / Match All)* | `add_comment ("Project B Global Blocker Comment")` |
| **Rule B4** | `Notify All Members on Staging` | `Status Changed` | `status_id = 'Staging'` | `notify_user (recipient: project_members, title: "Task In Staging", template: "Task {task_title} reached Staging in {project_name}")` |
| **Rule B5** | `Notify Admins on Security Audit` | `Status Changed` | `status_id = 'Security Audit'` | `notify_user (recipient: admins_managers, title: "Security Audit Triggered", template: "Security Audit required for {task_title}")` |
| **Rule B6** | `Auto-Resolve Blocker on Staging Move` | `Status Changed` | `status_id = 'Staging'` | `resolve_blocker ()` |

---

## 4. Tasks Seed Inventory (20 Tasks)

Create the following **20 realistic tasks** inside **ApexPay Cross-Border Remittance App** prior to running test cases:

| Task # | Task Title | Description | Priority | Initial Status | Assignee |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Task B-01** | `Initialize Biometric Hardware Enclave Keystore Vault` | Security critical vault initialization | High | `Backlog` | Saad Nasir |
| **Task B-02** | `Implement AES-256-GCM Payload Encryption Layer` | Security payload encryption service | High | `Backlog` | Saad Nasir |
| **Task B-03** | `Refactor Real-time Interbank Transfer Listener` | Backend socket listener refactor | Medium | `Backlog` | Saad Nasir |
| **Task B-04** | `Design Financial Monthly Statement PDF Renderer` | PDF exporter module for statements | Low | `In Development` | Saad Nasir |
| **Task B-05** | `Sanitize TLS 1.3 Socket Handshake Request Payload` | Security socket validator | High | `In Development` | Saad Nasir |
| **Task B-06a** | `Audit iOS Secure Enclave Heap Memory Allocation` | Secure memory allocation inspection | High | `In Development` | Saad Nasir |
| **Task B-06b** | `Audit Dark Theme Color Contrast Ratios` | UI contrast ratio verification | Medium | `In Development` | Shahid |
| **Task B-07** | `Update OpenID Connect Spec Documentation for Partner APIs` | API specification update (Due: Past) | Medium | `In Development` | Saad Nasir |
| **Task B-08a** | `Fix Session Pinning Key Expiration State Crash` | Pinning crash patch | High | `In Development` | Saad Nasir |
| **Task B-08b** | `Fix Multi-Currency Symbol Locale Formatting` | UI multi-currency formatting | Low | `In Development` | Saad Nasir |
| **Task B-09** | `Add Immediate Push Alert for Fraudulent Withdrawal Attempt` | Security alert push notification | Low | `In Development` | Saad Nasir |
| **Task B-10** | `Fix Authentication Loop on Intermittent Cellular Connection` | Auth redirect loop patch | High | `In Development` | Saad Nasir |
| **Task B-11** | `Integrate Google Pay Express Checkout Native SDK` | Native Google Pay SDK integration | High | `In Development` | Saad Nasir |
| **Task B-12** | `Patch Jailbreak & Root Inspection Detection Checks` | Security jailbreak detection patch | High | `In Development` | Saad Nasir |
| **Task B-13** | `Setup End-of-Day Clearing House Settlement Email Alert` | EOD settlement email trigger | Medium | `In Development` | Saad Nasir |
| **Task B-14** | `Add Hardware FIDO2 Security Key Fallback Mode` | Hardware Security Key fallback mode | Low | `In Development` | Saad Nasir |
| **Task B-15** | `Enforce Fine-Grained ACL Policy on Wire Transfer Endpoint` | Fine-grained ACL enforcement | High | `In Development` | Saad Nasir |
| **Task B-16** | `Configure App Shielding RASP Threat Engine` | App shielding RASP engine setup | Medium | `In Development` | Saad Nasir |
| **Task B-17** | `Optimize Core Ledger DB Partitioning for High Volume Writes` | DB partitioning for high volume | High | `In Development` | Saad Nasir |
| **Task B-18** | `Bulk Import Security Tasks (1 through 5)` | Batch security task audit | High | `Backlog` | Unassigned |

---

## 5. Step-by-Step Test Cases (20 Test Scenarios)

### Category 1: Multi-Stage Workflow & Custom Templates

#### **TC-B-01: Multi-Stage Custom Workflow Transition Path**
* **Target Task:** `Initialize Biometric Hardware Enclave Keystore Vault` (Task B-01)
* **Initial State:** Status `Backlog`
* **Test Steps:**
  1. Open task `Initialize Biometric Hardware Enclave Keystore Vault`.
  2. Move status: `Backlog` $\rightarrow$ `In Development` $\rightarrow$ `Security Audit` $\rightarrow$ `Staging` $\rightarrow$ `Completed`.
* **Expected Result:** Task transitions cleanly through all 5 custom stages. `tasks.status_id` and text `status` update in sync.

#### **TC-B-02: Custom Workflow Illegal Transition Guard (`Backlog` $\rightarrow$ `Staging`)**
* **Target Task:** `Implement AES-256-GCM Payload Encryption Layer` (Task B-02)
* **Initial State:** Status `Backlog`
* **Test Steps:**
  1. Open task `Implement AES-256-GCM Payload Encryption Layer`.
  2. Attempt to move status directly to `Staging`.
* **Expected Result:** Transition is **blocked**. Error message indicates illegal workflow transition for Project B template.

#### **TC-B-03: Initial Status Auto-Assignment**
* **Target Task:** `Refactor Real-time Interbank Transfer Listener` (Task B-03)
* **Test Steps:**
  1. Create new task `Refactor Real-time Interbank Transfer Listener` in Project B without passing `status_id`.
* **Expected Result:** Task is automatically assigned initial status `Backlog`.

#### **TC-B-04: Custom Stage Outcome Declaration (`declare_stage_outcome`)**
* **Target Task:** `Design Financial Monthly Statement PDF Renderer` (Task B-04)
* **Initial State:** Status `In Development`
* **Test Steps:**
  1. Open **Log Submit** form.
  2. Select task `Design Financial Monthly Statement PDF Renderer`.
  3. Set outcome to `Security Audit` and submit log.
* **Expected Result:** Task status updates to `Security Audit` and Rule B5 fires.

#### **TC-B-05: Multi-Stage Status History Audit Trail Logging**
* **Target Task:** `Sanitize TLS 1.3 Socket Handshake Request Payload` (Task B-05)
* **Initial State:** Status `In Development`
* **Test Steps:**
  1. Open task `Sanitize TLS 1.3 Socket Handshake Request Payload`.
  2. Move status to `Security Audit`.
  3. Query `task_status_history` table.
* **Expected Result:** `task_status_history` logs transition between Project B custom status IDs.

---

### Category 2: Advanced Condition Evaluator (`contains`, `gt`/`lt`, `neq`)

#### **TC-B-06: String Keyword Match Condition (`operator: contains`)**
* **Target Tasks:** `Audit iOS Secure Enclave Heap Memory Allocation` (Task B-06a) vs `Audit Dark Theme Color Contrast Ratios` (Task B-06b)
* **Test Steps:**
  1. Change status on Task B-06a (description contains `'Secure'`).
  2. Change status on Task B-06b (description does NOT contain `'Secure'`).
* **Expected Result:** Rule B1 (`description CONTAINS 'Security'`) fires ONLY on Task B-06a, moving it to `Security Audit`. Task B-06b is unaffected.

#### **TC-B-07: Date Comparison Condition (`operator: lt`)**
* **Target Task:** `Update OpenID Connect Spec Documentation for Partner APIs` (Task B-07)
* **Initial State:** `due_date` set to yesterday.
* **Test Steps:**
  1. Change status on task `Update OpenID Connect Spec Documentation for Partner APIs`.
* **Expected Result:** Rule with condition `due_date lt NOW()` evaluates to true and moves task to `Staging`.

#### **TC-B-08: Inequality Operator (`operator: neq`)**
* **Target Tasks:** `Fix Session Pinning Key Expiration State Crash` (Task B-08a, High) vs `Fix Multi-Currency Symbol Locale Formatting` (Task B-08b, Low)
* **Test Steps:**
  1. Raise blocker on Task B-08a (High Priority).
  2. Raise blocker on Task B-08b (Low Priority).
* **Expected Result:** Rule B2 (`priority neq 'low'`) executes for Task B-08a and skips Task B-08b.

#### **TC-B-09: Match-All Empty Condition Array (`conditions: []`)**
* **Target Task:** `Add Immediate Push Alert for Fraudulent Withdrawal Attempt` (Task B-09)
* **Test Steps:**
  1. Open task `Add Immediate Push Alert for Fraudulent Withdrawal Attempt`.
  2. Raise a blocker on the task.
* **Expected Result:** Rule B3 with `conditions: []` matches automatically and posts comment `"Project B Global Blocker Comment"`.

#### **TC-B-10: Condition Failure Logging (`result = 'condition_not_met'`)**
* **Target Task:** `Fix Authentication Loop on Intermittent Cellular Connection` (Task B-10)
* **Test Steps:**
  1. Trigger rule on non-matching task.
  2. Query `automation_rule_runs` table.
* **Expected Result:** Log entry created in `automation_rule_runs` with `result = 'condition_not_met'`.

---

### Category 3: Multi-Recipient Notifications & System Actions

#### **TC-B-11: Notify Project Members (`recipient: project_members`)**
* **Target Task:** `Integrate Google Pay Express Checkout Native SDK` (Task B-11)
* **Initial State:** Status `In Development`
* **Test Steps:**
  1. Open task `Integrate Google Pay Express Checkout Native SDK`.
  2. Move status to `Staging`.
* **Expected Result:** Rule B4 fires. In-app notifications generated for ALL active members of `ApexPay Cross-Border Remittance App`.

#### **TC-B-12: Notify Admins & Managers (`recipient: admins_managers`)**
* **Target Task:** `Patch Jailbreak & Root Inspection Detection Checks` (Task B-12)
* **Initial State:** Status `In Development`
* **Test Steps:**
  1. Open task `Patch Jailbreak & Root Inspection Detection Checks`.
  2. Move status to `Security Audit`.
* **Expected Result:** Rule B5 fires. In-app notifications generated for all users with `admin` or `manager` roles.

#### **TC-B-13: System Audit Commenting (`add_comment`)**
* **Target Task:** `Setup End-of-Day Clearing House Settlement Email Alert` (Task B-13)
* **Test Steps:**
  1. Trigger automation rule on `Setup End-of-Day Clearing House Settlement Email Alert`.
* **Expected Result:** Comment posted to `task_comments` with `author_type = 'system'`.

#### **TC-B-14: Blocker Auto-Resolution (`resolve_blocker`)**
* **Target Task:** `Add Hardware FIDO2 Security Key Fallback Mode` (Task B-14)
* **Initial State:** Open Blocker present on task.
* **Test Steps:**
  1. Open task `Add Hardware FIDO2 Security Key Fallback Mode`.
  2. Move status to `Staging`.
* **Expected Result:** Rule B6 fires (`status_change` to `Staging` $\rightarrow$ `resolve_blocker`). Open blocker status automatically updates to `resolved`.

---

### Category 4: Sprint Management & Employee Task Views

#### **TC-B-15: Sprint Creation & Task Association**
* **Target Task:** `Enforce Fine-Grained ACL Policy on Wire Transfer Endpoint` (Task B-15)
* **Test Steps:**
  1. Create `Sprint B1 - Mobile Security Hardening`.
  2. Assign task `Enforce Fine-Grained ACL Policy on Wire Transfer Endpoint` to `Sprint B1`.
* **Expected Result:** Task reflects `sprint_id`. Sprint metrics update.

#### **TC-B-16: Sprint Deletion Task Reversion**
* **Target Task:** `Configure App Shielding RASP Threat Engine` (Task B-16)
* **Test Steps:**
  1. Assign task to `Sprint B2`.
  2. Delete `Sprint B2`.
* **Expected Result:** Task reverts to `sprint_id = NULL` cleanly without status corruption.

#### **TC-B-17: Employee Assigned Task Counter Filtering**
* **Target Task:** `Optimize Core Ledger DB Partitioning for High Volume Writes` (Task B-17)
* **User Context:** Lead Dev Saad Nasir (logged in)
* **Test Steps:**
  1. Log in as Lead Dev Saad Nasir.
  2. Open Tasks tab in `ApexPay Cross-Border Remittance App`.
  3. Check badge counter vs list.
* **Expected Result:** Tab header badge shows count of tasks assigned to current employee (`Tasks (3)`), matching table rows below.

#### **TC-B-18: Bulk Task Import with Automations**
* **Target Task:** `Bulk Import Security Tasks (1 through 5)` (Task B-18)
* **Test Steps:**
  1. Prepare CSV with 5 security audit tasks.
  2. Upload CSV in `ApexPay Cross-Border Remittance App`.
  3. Complete import.
* **Expected Result:** All 5 tasks created with initial status `Backlog`. Automations fire per task.

---

### Category 5: Strict Cross-Project Isolation

#### **TC-B-19: Strict Cross-Project Rule Isolation**
* **Target Environment:** `PropVault Real Estate Portal` vs `ApexPay Cross-Border Remittance App`
* **Test Steps:**
  1. Perform status changes and raise blockers on Project A tasks.
  2. Query `automation_rule_runs` for Project B.
* **Expected Result:** **0 rules or rule runs fire in Project B**. Complete execution boundary isolation.

#### **TC-B-20: Cross-Project Data Leakage Guard**
* **Target Environment:** All Tasks across Project A & Project B
* **Test Steps:**
  1. Query Project A tasks.
  2. Query Project B tasks.
* **Expected Result:** Zero task cross-assignment or status ID leakage between projects.
