# BOB Cranes Operations Portal TODO

## Phase 1: Planning & Analysis
- [x] Initialize project with `web-db-user` scaffold
- [x] Create initial `todo.md`
- [x] Analyze `DAILYREPORT2026-OPERATIONS.xlsx`, `VEHICLELIST.xlsx`, and `AttendanceNew-2026.xlsx` for seed data
- [x] Analyze `BOBCRANES-PORTALPRD.txt`, `BOB_Cranes_PRD.txt`, and `BOB-Cranes-Operations-Portal-PRD-v2.0.md` for consolidated requirements
- [x] Write consolidated master PRD (PRD v3.0)

## Phase 2: Data & Backend
- [x] Define portal domain model and reusable lifecycle/compliance rules in `shared/bookingRules.ts`
- [x] Preserve full-stack auth/database scaffold for future persistence integration
- [x] Add normalized workbook-informed seed data reference at `client/public/seed-data.json`
- [x] Keep core auth scaffold available through Manus OAuth
- [x] Implement exact booking lifecycle logic and status transitions in UI and shared tests

## Phase 3: Core Portal UI
- [x] Set up global theme and layout in `client/src/index.css` and `App.tsx`
- [x] Implement role-oriented Sidebar and Dashboard layout for 10 departments
- [x] Build 6-step Salesperson Booking Wizard
- [x] Build Kanban/Pipeline view for all active bookings
- [x] Implement Documentation Supervisor assignment views for Crane/Crew/Gear resources

## Phase 4: Client Portal & Features
- [x] Build Client Response Portal preview (booking-scoped URL, document upload states, live chat)
- [x] Implement in-app notification panel and simulated email-ready alert states
- [x] Implement Lifting Gear compliance hard-block (expired certificate check)
- [x] Implement parallel document tracking and completion percentage logic
- [x] Build dossier review and dispatch controls (revision state, locked email, PDF-ready package)

## Phase 5: Integrations & Polish
- [x] Simulate Google Drive folder generation logic with required naming convention
- [x] Implement final Email Dispatch PDF bundle preview logic
- [x] Add unit tests for critical business logic (lifecycle, compliance)
- [x] Perform visual verification and responsive design audit
- [x] Finalize documentation and deliver project

## Validation follow-ups
- [x] Add explicit shared domain types for bookings, departments, assets, crew, gear, trailers, documents, chat, and notifications.
- [x] Normalize workbook-derived data into app-ready booking, equipment, and crew seed collections.
- [x] Add role-gated lifecycle transition handlers with revision/reversion and notification behavior.
- [x] Expand the department navigation to explicitly represent all 10 departments.
- [x] Compute document completion from checklist item states and department totals.
- [x] Add interactive dossier review controls, document preview, revision kick-back, and dispatch gating.
- [x] Add email dispatch and PDF bundle preview UI.

## Final validation fixes
- [x] Implement real booking state updates for review approval and revision kick-back, including exact stage reversion and targeted notifications.
- [x] Expand sidebar/routes so all ten departments are explicitly represented and navigable.
- [x] Replace static dossier progress displays with computed checklist completion values per department.
- [x] Add actual document preview UI and a real PDF bundle preview surface.

## Handoff hardening
- [x] Wire lifecycle notification payloads into review/revision state and render targeted department notifications.
- [x] Give each of the ten department sidebar entries a distinct navigable department view.
- [x] Bind dossier progress bar and department rows to computed checklist totals.
- [x] Save final project checkpoint and complete handoff.

## Apple UAE Store-inspired redesign
- [x] Inspect the Apple UAE Store reference and map the visual language to the BOB Cranes portal.
- [x] Replace the dark operations cockpit styling with a light, spacious retail-inspired visual system while retaining operational density.
- [x] Redesign the booking progress visualization as a clear stage timeline and completion graph.
- [x] Validate responsive rendering and preserve all existing booking, review, compliance, and client portal interactions after post-redesign QA.
- [x] Save and deliver the updated checkpoint.
