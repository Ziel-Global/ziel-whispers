# Ziel Log System — Master AI Agent Context & Engineering Guidelines

> **Target Audience**: AI Coding Agents & Autonomous Assistants  
> **Status**: Mandatory System Protocol  
> **Project Root**: `ziel-whispers` (Ziel Log System / Ziel CMS)

---

## 1. High-Level Project Overview & Mission

Ziel Log System is an enterprise engineering intelligence, attendance management, and project execution platform. It replaces manual work reporting, informal time tracking, and rigid project management tools with a single, highly auditable operating system.

### Core Value Propositions:
1. **Hour-Attributed Progress Tracking**: Work status advancement is tied to validated, hour-attributed daily work logs.
2. **Read-Only Kanban Invariant**: Workflow status cannot be updated arbitrarily via drag-and-drop on boards; status moves require accountable log submissions or auditable system automations.
3. **Generalized Project Engine**: Projects act as the universal container. Structural layers (Phases, Sprints, Milestones) are completely modular and toggled via configuration, with no hardcoded methodology enums.
4. **Timezone Standardization**: All shifts, lateness math, missed log calculations, and cron schedules strictly align to **Pakistan Standard Time (PKT, Asia/Karachi, UTC+5)**.
5. **Multi-Role Collaboration**: Tailored experiences for Administrators, Project Managers, Internal Engineers, and External Client Members with strict Row Level Security (RLS) isolation.

---

## 2. Technology Stack & Runtime Architecture

| Layer | Technologies & Libraries |
|---|---|
| **Framework & Core** | React 18 (`react`, `react-dom`), TypeScript 5.8+, Vite 5.4+ (SWC compiler) |
| **Styling & Design System** | Tailwind CSS 3.4+, PostCSS, `tailwindcss-animate`, `class-variance-authority`, `tailwind-merge`, `clsx` |
| **Component Primitives** | Radix UI primitives (`@radix-ui/*`), Shadcn UI structure, Lucide React icons (`lucide-react`) |
| **Data Fetching & State** | TanStack React Query v5 (`@tanstack/react-query`), React Context (`AuthContext`) |
| **Backend & Database** | Supabase (`@supabase/supabase-js` v2.103+), PostgreSQL 14+, `pg_cron`, Row Level Security |
| **Form Handling & Validation** | React Hook Form (`react-hook-form` v7.61+), Zod (`zod` v3.25+), `@hookform/resolvers` |
| **Date & Time Utilities** | Date-fns (`date-fns` v3.6+), `@vvo/tzdb` |
| **Charts & Reporting** | Recharts (`recharts` v2.15+), HTML2Canvas (`html2canvas`), jsPDF (`jspdf`, `jspdf-autotable`) |
| **Feedback & Notifications** | Sonner toast (`sonner`), Radix Tooltip & Dialog primitives |
| **Testing & Quality** | Vitest (`vitest`), Playwright (`@playwright/test`), ESLint 9 |

---

## 3. Strict Non-Negotiable Architectural Principles

When writing or modifying code in this codebase, any future AI Agent **MUST** adhere to the following invariants:

### 1. The Kanban Board is READ-ONLY
- **Rule**: Never introduce drag-and-drop status advancement or direct inline status dropdowns on Kanban boards.
- **Reason**: The engine's core governance requires all task stage advances to be justified by an hour-attributed log, a system automation trigger, or an audited admin override.

### 2. Task Status Mutation Path
- **Rule**: Do not perform direct `supabase.from('tasks').update({ status_id })` from user-facing screens without executing through the validated pipeline.
- **Standard Flow**: Use `supabase.rpc('declare_stage_outcome', ...)` or submit a daily log with `declared_outcome_status_id`.
- **Admin Overrides**: Must insert an audit log entry in `audit_logs` specifying actor and justification.

### 3. Task Optimistic Concurrency Locking
- **Rule**: Every mutation to `tasks.status_id` or `tasks.assigned_to` must account for the `tasks.version` column.
- **Implementation**: Verify the task version before write. Stale writes must fail gracefully and prompt the user to refresh rather than silently overwriting concurrent changes.

### 4. PKT Timezone Consistency (UTC+5)
- **Rule**: Never use raw local browser timestamps (`new Date().toISOString()`) for business dates, deadlines, or lateness math.
- **Implementation**: Always use `getPKTDateString()`, `getPKTISOString()`, or `formatPKTTime()` from `@/hooks/useWorkSettings`. All daily logs, attendance records, and leave requests operate in PKT (`Asia/Karachi`).

### 5. Annual Leave Year Boundary
- **Rule**: Do not compute leave quotas based on the calendar year (Jan 1–Dec 31).
- **Implementation**: The company leave year strictly begins **June 1st** and concludes **May 31st** of the subsequent year (`getCurrentLeaveYear()` in `@/lib/utils.ts`).

### 6. Subtask Hierarchy Limits
- **Rule**: Subtask nesting depth is strictly **1**. Subtasks cannot have subtasks.
- **Rule**: Child tasks must belong to the exact same `project_id` as their parent task.
- **Rule**: Completing a parent task with `require_subtasks_done = true` must be blocked if any child subtask is not yet in the `done` category.

### 7. Soft Status Retirement
- **Rule**: Never delete a `workflow_statuses` row if tasks or transitions reference it.
- **Implementation**: Set `retired = true`. Exclude retired statuses from new task creation and transition selectors, but preserve them in historical cards, audit logs, and analytics.

---

## 4. Strict Code Quality & Component Standards

### 4.1 Component-Based Architecture & Reusability Mandate (STRICT)
All future development in this codebase **MUST** be strictly component-based and prioritize reusable components:

1. **Pages as Orchestrators Only**:
   - Page files (`src/pages/*.tsx`) must **never** be monoliths. A page file should solely orchestrate data hooks, layout containers, and subcomponents.
   - Target line count: **under 300 lines** per page. Hard maximum: **500 lines**.
   - Sub-views, tabs, modal forms, and complex sections must always be isolated into focused, reusable components.

2. **Mandatory Reuse of Existing Functionality (Single Source of Truth)**:
   - Before building any new UI element or functionality, you **MUST inspect existing components** in `src/components/ui/`, `src/components/`, and `src/hooks/`.
   - **Never rewrite or duplicate existing logic or UI inline**.
   - If a page requires:
     - **Status display**: Consume a shared `<StatusBadge />`, do not create ad-hoc local `statusBadge` functions.
     - **Page header / Search / Filters**: Consume shared `<PageHeader />` and `<SearchInput />` components.
     - **Initials / Avatars**: Use `getInitials()` from `@/lib/utils.ts` or a shared `<UserAvatar />`, never write inline string-splitting math.
     - **Toggles / Switches**: Use `@/components/ui/switch`, never write custom toggle switches (e.g. `UdToggle`).
     - **List rows / Table cards**: Consume `@/components/ui/data-row.tsx`.
     - **CSV Importers**: Standardize on a shared modal wrapper rather than reimplementing file reader tables.

3. **Component Extraction Requirement**:
   - If a visual pattern, modal, filter set, or card is used in **more than one place** (or is logically independent), it **MUST be extracted into a reusable component**.
   - Place generic UI elements in `src/components/ui/` or `src/components/shared/`.
   - Place domain-specific reusable components in `src/components/<domain>/` (e.g. `src/components/employees/`, `src/components/projects/`).

4. **Canonical Constants & Utilities**:
   - Never define static business lists (e.g., `DEPARTMENTS`, `ROLES`, `EMP_TYPES`, shift defaults) locally within a page or component.
   - Always export and import them from a single canonical constants source (`src/lib/constants.ts` or `src/types/`).

### 4.2 Monolith Prevention & Directory Separation
- Place page tabs in `src/components/<feature>/tabs/`.
- Place modals and dialogs in `src/components/<feature>/dialogs/`.
- Place slide-over panels in `src/components/<feature>/sheets/`.
- Extract data fetching, mutation state, and filter logic into custom hooks in `src/hooks/use<Feature>Data.ts`.

### 4.3 State Management & TanStack Query Rules
1. **Query Keys**: Use descriptive, array-based query keys with relevant dependencies:
   ```typescript
   // Correct
   queryKey: ["my-logs-range", user?.id, startDate, endDate]
   queryKey: ["project-tasks", projectId, sprintId, statusFilter]
   ```
2. **Invalidation**: Always invalidate queries upon mutation success:
   ```typescript
   queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
   ```
3. **No Redundant Local State**: Avoid duplicating query response data into local `useState` unless specifically editing a draft form.

### 4.4 Form Handling & Validation
- **React Hook Form + Zod**: All user input forms (employees, tasks, projects, clients, daily logs, settings) must define a strict Zod schema with user-friendly error messages.
- Always use `zodResolver(schema)` and bind errors to Shadcn UI `<FormMessage />` or input error states.

### 4.5 Notifications & User Feedback
- Use `sonner` (`toast.success`, `toast.error`, `toast.warning`, `toast.info`).
- Do not mix legacy alert methods or create conflicting modal stacks.

### 4.6 Continuous Documentation Maintenance Rule
As an AI agent working on this codebase, you must keep the `.docs` folder perfectly synchronized with the actual codebase.

Whenever you implement a new feature, alter business logic, change a database schema, or modify access roles:
1. You MUST proactively update the relevant sections in [`.docs/features-logic.md`](file:///d:/Ziel/Ziel%20Log%20System/ziel-whispers/.docs/features-logic.md) and [`.docs/database-schema.md`](file:///d:/Ziel/Ziel%20Log%20System/ziel-whispers/.docs/database-schema.md) in the same response/commit as your code changes.
2. Do not wait for the user to explicitly ask you to update the documentation.
3. Only update the documentation for structural, logical, or database changes. Do not update documentation for pure UI styling tweaks, typo fixes, or minor refactors that do not change system behavior.

---

## 5. File System & Directory Map

```
ziel-whispers/
├── .docs/                               # Complete System Documentation
│   ├── agents.md                        # Master AI Context & Engineering Rules (this file)
│   ├── features-logic.md                # Exhaustive business rules & data flows
│   └── database-schema.md               # 49 tables, columns, relations & RPC functions
├── src/
│   ├── components/                      # UI Components
│   │   ├── admin/                       # Administrative dialogs & tables
│   │   ├── dashboard/                   # Summary metric cards & widgets
│   │   ├── employee/                    # Employee profile sheets, cards & tabs
│   │   ├── leave-admin/                 # Leave approval tabs & calendar views
│   │   ├── log-submit/                  # Daily log entry forms & draft history
│   │   ├── project/                     # Project execution tabs, panels & kanban
│   │   ├── skills/                      # Skill badges, matrices & evaluation modals
│   │   ├── ui/                          # Radix / Shadcn reusable primitives
│   │   └── workflow/                    # Graph previews & status badges
│   ├── contexts/
│   │   └── AuthContext.tsx              # Auth state, session heartbeat & timeout
│   ├── hooks/                           # Custom React Query & business logic hooks
│   │   ├── useEmployeeProfileData.ts    # Employee profile state aggregator
│   │   ├── useLeaveAdminData.ts         # Leave management state aggregator
│   │   ├── useLogSubmitData.ts          # Daily log submission orchestrator
│   │   ├── useProjectDetailData.ts      # Project detail state & query hub
│   │   ├── useSkillMetricsData.ts       # Skill matrix & gap analysis queries
│   │   ├── useWorkSettings.ts           # Shift times, PKT timezone & lateness math
│   │   └── useTaskVersionCheck.ts       # Optimistic concurrency version check
│   ├── integrations/
│   │   └── supabase/                    # Supabase client & generated type definitions
│   │       ├── client.ts                # Initialized client singleton
│   │       └── types.ts                 # Database type interfaces
│   ├── layouts/
│   │   └── AppLayout.tsx                # Master app chrome (Sidebar, TopBar, Alerts)
│   ├── lib/                             # Core domain utilities & services
│   │   ├── adminProjectNav.ts           # Admin project detail tab definitions
│   │   ├── clientTaskBuckets.ts         # Simplified client status buckets
│   │   ├── dependencies.ts              # Finish-to-start task dependency validator
│   │   ├── exportWorkflowPdf.ts         # Workflow template PDF generation
│   │   ├── notification-helpers.ts      # In-app notification dispatcher
│   │   ├── projectRolesService.ts       # Project-defined roles API
│   │   ├── utils.ts                     # Leave year, slugs, avatars, formatters
│   │   └── workflow.ts                  # Workflow transitions & permission resolver
│   ├── pages/                           # Top-level route views
│   │   ├── AttendanceAdmin.tsx          # Org-wide attendance management
│   │   ├── Dashboard.tsx                # Executive overview dashboard
│   │   ├── Employees.tsx                # Employee directory
│   │   ├── LeaveAdmin.tsx               # Leave request approvals & WFH
│   │   ├── LogSubmit.tsx                # Daily work log submission
│   │   ├── LogsAdmin.tsx                # Org-wide daily log oversight
│   │   ├── MyAttendance.tsx             # Employee clock-in/out & calendar
│   │   ├── MyLeave.tsx                  # Employee leave requests & balance
│   │   ├── ProjectDetail.tsx            # Project execution dashboard
│   │   ├── Projects.tsx                 # Project directory
│   │   ├── Reports.tsx                  # Workforce intelligence & analytics
│   │   ├── Settings.tsx                 # Global system configuration
│   │   └── WorkflowTemplates.tsx        # Workflow builder & transition editor
│   ├── types/                           # Supplemental TypeScript interfaces
│   │   └── skills.ts                    # Skill metrics & proficiency definitions
│   └── utils/
│       └── logDateUtils.ts              # Log edit window & working day math
└── supabase/
    └── migrations/                      # PostgreSQL migrations & triggers
```

---

## 6. Master Technical Documentation Index

When you need deep architectural or schema specifications, refer directly to:
1. **Detailed Business Logic & Feature Workflows**:
   👉 See [`.docs/features-logic.md`](file:///d:/Ziel/Ziel%20Log%20System/ziel-whispers/.docs/features-logic.md)
   *Covers exact step-by-step algorithms, conditions, and validations for every module in the platform.*

2. **Database Schema & Relational Specifications**:
   👉 See [`.docs/database-schema.md`](file:///d:/Ziel/Ziel%20Log%20System/ziel-whispers/.docs/database-schema.md)
   *Covers all 49 database tables, columns, data types, check constraints, foreign keys, triggers, and RPC functions.*

3. **Codebase Maintainability & Component Audit**:
   👉 See [`CODEBASE_MAINTAINABILITY_AUDIT.md`](file:///d:/Ziel/Ziel%20Log%20System/ziel-whispers/CODEBASE_MAINTAINABILITY_AUDIT.md)
   *Identifies oversized files, technical debt, and recommended refactoring decompositions.*
