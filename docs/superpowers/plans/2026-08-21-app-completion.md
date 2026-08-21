# BOB Cranes Operations Portal - App Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the BOB Cranes Operations Portal by adding missing routes, admin dashboard, documentation supervisor console, and fixing routing to match PRD v3.0.

**Architecture:** The app uses React 19 + tRPC 11 + MySQL/Drizzle. Current implementation uses view-based routing within a single ProtectedPortal component. Need to add URL-based routing matching PRD requirements.

**Tech Stack:** React 19, tRPC 11, wouter (routing), shadcn/ui, Tailwind CSS, Drizzle ORM, MySQL

**Spec:** client/public/PRD_v3.0.md

---

## Phase 1: Route Alignment (Critical)

### Task 1: Add Missing Routes to App.tsx

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/AdminDashboard.tsx`
- Create: `client/src/pages/DepartmentPage.tsx`
- Create: `client/src/pages/BookingsPage.tsx`
- Create: `client/src/pages/BookingDetailPage.tsx`

**What to do:**
1. Add routes matching PRD:
   - `/admin` → AdminDashboard
   - `/dept/:deptCode` → DepartmentPage
   - `/dept/doc/console` → Documentation Console
   - `/bookings` → BookingsPage
   - `/bookings/:id` → BookingDetailPage

2. Create wrapper pages that render existing views

### Task 2: Create Admin Dashboard Page

**Files:**
- Create: `client/src/pages/AdminDashboard.tsx`

**Features:**
- KPIs (total bookings, active dispatches, department health)
- Department configuration panel
- Integration status (Google Drive, SMTP)
- User management
- Audit log viewer

### Task 3: Create Department Page

**Files:**
- Create: `client/src/pages/DepartmentPage.tsx`

**Features:**
- Dynamic department routing (`/dept/:deptCode`)
- Department-specific dashboard
- Booking queue for department
- Department metrics

### Task 4: Create Bookings Page

**Files:**
- Create: `client/src/pages/BookingsPage.tsx`

**Features:**
- Kanban pipeline view
- Filter by stage, priority, department
- Quick actions (advance stage, assign resources)

### Task 5: Create Booking Detail Page

**Files:**
- Create: `client/src/pages/BookingDetailPage.tsx`

**Features:**
- Full dossier view
- Stage history
- Document checklist
- Chat interface
- Action buttons (advance, revert, dispatch)

---

## Phase 2: Missing Features (Important)

### Task 6: Add Google Drive Integration Stubs

**Files:**
- Modify: `server/routers/operations.ts`
- Create: `server/integrations/googleDrive.ts`

**What to do:**
- Create integration stub with configuration
- Add folder creation on booking creation
- Add file upload on document submission

### Task 7: Add Email Dispatch System

**Files:**
- Modify: `server/routers/operations.ts`
- Create: `server/integrations/emailDispatch.ts`

**What to do:**
- Create email dispatch with branded HTML template
- Add crew manifest table
- Add PDF bundle attachment
- Lock recipient email from Sales intake

---

## Phase 3: Quality Improvements (Nice-to-have)

### Task 8: Add Missing Tests

**Files:**
- Create: `server/adminDashboard.test.ts`
- Create: `server/departmentPage.test.ts`
- Create: `server/bookingsPage.test.ts`

### Task 9: Fix Remaining Test Failures

**Files:**
- Fix: `server/operations.test.ts` (flaky seed test)

---

## Global Constraints

- TypeScript strict mode enabled
- Package manager: pnpm (with npm fallback)
- React 19 with automatic JSX transform
- tRPC for type-safe API calls
- Dark theme (#0D0D0D background, #E31E24 accent)

---

## Next Step

Start with Phase 1, Task 1: Add Missing Routes to App.tsx
