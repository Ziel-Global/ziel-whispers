# Complete Codebase Performance & Maintainability Audit

## Executive Summary

This audit provides a comprehensive, empirical line-by-line inspection of all source files in the project to identify maintenance risks, oversized files, and opportunities for component decoupling.

> [!NOTE]
> **Audit Rule**: Generated files (such as database type definitions) are categorized separately from application source files.

---

## 1. Generated & Configuration Files (Excluded from Refactoring)

| File Path | Current Line Count | Classification | Notes |
|---|---|---|---|
| `src/integrations/supabase/types.ts` | **2,213 lines** | Auto-Generated DB Types | Generated automatically by Supabase CLI based on PostgreSQL schema. **Do not refactor.** |

---

## 2. Source Code Files Meeting 1,000+ Lines Threshold

---

### 🔴 1. `src/pages/ProjectDetail.tsx`
* **Exact Current Line Count**: **3,790 lines**
* **Priority**: **HIGH PRIORITY**
* **Main Responsibility**: Serves as the central project execution dashboard, handling project metadata, status transitions, member management, burndown analytics, activity feeds, and coordinating tabs & modal dialogs.
* **Why it is too large / difficult to maintain**: 
  Despite previous modal and tab extraction efforts, the parent container retains 40+ state variables, complex query hooks, inline member management sheets, status note modals, and duplicate tab content definitions, causing large bundle sizes and heavy re-renders.
* **Major Sections / Responsibilities Currently Inside**:
  1. Main project state, auth controls, & 20+ TanStack Query hooks.
  2. Member/Resource management sheet (`SheetContent` for client/resource lookup).
  3. Inline tab definitions (`Activity`, `Settings`, `Logs`, `Burndown`).
  4. Status transition confirmation dialogs & phase deletion alert dialogs.
  5. Audit log tracking & notification dispatch logic.
* **What Could Be Separated**:
  - Extract Member/Resource Management Sheet into `ProjectMembersSheet.tsx`.
  - Extract Activity Feed tab into `ProjectActivityTab.tsx`.
  - Extract Inline Settings into `ProjectSettingsTab.tsx`.
  - Move state hook aggregations into custom hooks (e.g., `useProjectDetailData.ts`).
* **Suggested Breakdown**:
  ```
  src/pages/ProjectDetail.tsx (Main orchestrator, ~400 lines)
  ├── src/hooks/useProjectDetailData.ts (Data query aggregation)
  ├── src/components/project/sheets/ProjectMembersSheet.tsx (Member management)
  ├── src/components/project/tabs/ProjectActivityTab.tsx (Activity feed)
  └── src/components/project/tabs/ProjectSettingsTab.tsx (Project settings form)
  ```

---

### 🔴 2. `src/pages/EmployeeProfile.tsx`
* **Exact Current Line Count**: **1,554 lines**
* **Priority**: **HIGH PRIORITY**
* **Main Responsibility**: Manages individual employee profiles, personal details, employment settings, log edit permissions, salary/designation config, and profile tabs.
* **Why it is too large / difficult to maintain**: 
  Houses multiple unrelated tabs, complex React Hook Form + Zod validation schemas (`adminSchema`, `clientEditSchema`), log history filters, and email confirmation dialogs inside a single component file.
* **Major Sections / Responsibilities Currently Inside**:
  1. Zod form schemas & state initialization (300+ lines).
  2. Tab 1: Profile Details & Personal Settings (`TabsContent value="profile"`).
  3. Tab 2: Employee Daily Logs History (`TabsContent value="logs"`).
  4. Tab 3: Assigned Projects & Roles (`TabsContent value="projects"`).
  5. Tab 4: Logged Hours Metrics (`TabsContent value="logged-hours"`).
  6. Tab 5: Log Editing Window Config (`TabsContent value="log-edit-days"`).
  7. Tab 6: Access Control Overrides (`TabsContent value="access-controls"`).
  8. Email Change Warning Dialog.
* **What Could Be Separated**:
  - Split each tab into its own sub-component under `src/components/employee-profile/`.
  - Extract Zod form schemas to `src/lib/schemas/employee-profile.schema.ts`.
* **Suggested Breakdown**:
  ```
  src/pages/EmployeeProfile.tsx (Main container, ~300 lines)
  ├── src/components/employee-profile/tabs/ProfileInfoTab.tsx
  ├── src/components/employee-profile/tabs/ProfileLogsTab.tsx
  ├── src/components/employee-profile/tabs/ProfileProjectsTab.tsx
  ├── src/components/employee-profile/tabs/ProfileHoursMetricsTab.tsx
  ├── src/components/employee-profile/tabs/ProfileEditWindowTab.tsx
  └── src/components/employee-profile/tabs/ProfileAccessControlsTab.tsx
  ```

---

### 🟠 3. `src/pages/LogSubmit.tsx`
* **Exact Current Line Count**: **1,150 lines**
* **Priority**: **MEDIUM PRIORITY**
* **Main Responsibility**: Handles daily work logging for employees, including project selection, category selection, hours input, description, status transition requests, and past log view/edit.
* **Why it is too large / difficult to maintain**: 
  Combines date validation logic, log edit window math, transition status dropdowns, task blocker warnings, draft log saving, and historical log list views in one file.
* **Major Sections / Responsibilities Currently Inside**:
  1. Date utility functions (`isWithinLogEditWindow`, `getMinDateStr`).
  2. React Hook Form log creation form (`project_id`, `category`, `hours`, `log_date`, `description`).
  3. Workflow status change selector & blocker check handlers.
  4. Submitted/Draft log cards list rendering with overtime & late indicators.
  5. Edit/Delete log inline modal dialogs.
* **What Could Be Separated**:
  - Move date window logic into `src/utils/log-date.utils.ts`.
  - Extract log submission form to `LogSubmissionForm.tsx`.
  - Extract submitted log list cards to `SubmittedLogsList.tsx`.
* **Suggested Breakdown**:
  ```
  src/pages/LogSubmit.tsx (Page wrapper, ~250 lines)
  ├── src/components/log-submit/LogSubmissionForm.tsx (Log input form)
  ├── src/components/log-submit/SubmittedLogsList.tsx (Log history cards)
  └── src/components/log-submit/LogEditModal.tsx (Inline edit dialog)
  ```

---

### 🟠 4. `src/pages/LeaveAdmin.tsx`
* **Exact Current Line Count**: **1,118 lines**
* **Priority**: **MEDIUM PRIORITY**
* **Main Responsibility**: Admin panel for reviewing, approving, or rejecting leave requests, remote work (WFH) requests, managing holiday/leave calendars, and setting leave policies.
* **Why it is too large / difficult to maintain**: 
  Contains 4 major administrative tabs, modal dialogs for employee leave balances, calendar views with employee popups (`namesModal`), and leave approval action dialogs in a single file.
* **Major Sections / Responsibilities Currently Inside**:
  1. Leave Requests approval table & filters (`TabsContent value="requests"`).
  2. WFH / Remote work approval table (`TabsContent value="wfh"`).
  3. Leave & Holiday Calendar view (`TabsContent value="calendar"`).
  4. Leave Policy & Category Settings (`TabsContent value="settings"`).
  5. Employee Balance Dialog & Action Approval/Rejection Dialogs.
* **What Could Be Separated**:
  - Extract tabs into `src/components/leave-admin/tabs/`.
  - Extract balance and action dialogs into `src/components/leave-admin/dialogs/`.
* **Suggested Breakdown**:
  ```
  src/pages/LeaveAdmin.tsx (Admin wrapper, ~250 lines)
  ├── src/components/leave-admin/tabs/LeaveRequestsTab.tsx
  ├── src/components/leave-admin/tabs/WFHRequestsTab.tsx
  ├── src/components/leave-admin/tabs/LeaveCalendarTab.tsx
  ├── src/components/leave-admin/tabs/LeaveSettingsTab.tsx
  └── src/components/leave-admin/dialogs/LeaveActionModal.tsx
  ```

---

## 3. Files Approaching 1,000 Lines (800–999 Lines)

These files are currently under 1,000 lines but are growing complex and should be monitored:

| File Path | Current Line Count | Key Responsibility | Recommendation |
|---|---|---|---|
| **`src/pages/LogsAdmin.tsx`** | **866 lines** | Administrative daily log overview, missed logs, & log rules | Extract rule settings tab and log edit modal |
| **`src/pages/Dashboard.tsx`** | **864 lines** | Executive dashboard, project status cards, pending actions | Extract summary metrics cards and announcement dialogs |

---

## 4. Priority Summary List

### 🔴 HIGH PRIORITY — 1,000+ Lines (Refactor First)
1. **`src/pages/ProjectDetail.tsx`** — **3,790 lines**
2. **`src/pages/EmployeeProfile.tsx`** — **1,554 lines**

### 🟠 MEDIUM PRIORITY — 1,000+ Lines (Less Urgent)
3. **`src/pages/LogSubmit.tsx`** — **1,150 lines**
4. **`src/pages/LeaveAdmin.tsx`** — **1,118 lines**

### 🟡 APPROACHING 1,000 LINES — 800–999 Lines (Monitor)
5. **`src/pages/LogsAdmin.tsx`** — **866 lines**
6. **`src/pages/Dashboard.tsx`** — **864 lines**

---

> [!IMPORTANT]
> **No code or files were modified during this audit**. This document serves as the official maintainability and refactoring reference.
