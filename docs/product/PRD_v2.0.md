# Product Requirements Document (PRD) & Working Procedure: BOB Cranes Operations Portal (v2.0)

> **Document Author:** Manus AI  
> **Project Target:** BOB Cranes Operations Portal (`bob-cranes-operations-portal`)  
> **Tech Stack:** React 19, TypeScript, Tailwind CSS 4, tRPC 11, Drizzle ORM (MySQL), SheetJS (XLSX), PDF-Lib  

---

## 1. Executive Summary & Product Vision

The **BOB Cranes Operations Portal** is an enterprise-grade, role-based heavy equipment rental, crew assignment, and compliance document management platform [1]. Designed for high-stakes crane and lifting operations in the Middle East, the platform bridges the operational gap between commercial sales, documentation supervisors, equipment managers, safety officers, and executive dispatchers.

By enforcing strict certification gating, live crew availability tracking, real-time multi-departmental parallel document completion, and automated Excel data integrity checks, the portal ensures that no heavy lift commences without complete compliance and equipment verification.

---

## 2. End-to-End Operational Workflow

The lifecycle of a heavy equipment rental follows a rigorous **7-step sequential workflow** backed by 8 cross-functional operating departments:

```
[Sales Initiation] ➔ [Documentation Supervisor Assignment] ➔ [Gear & Asset Confirmation] 
➔ [Parallel Department Uploads] ➔ [100% Milestone Review] ➔ [Executive Sign-off] ➔ [Dispatch]
```

1. **Sales Initiation (6-Step Wizard):**  
   The salesperson opens the booking wizard and inputs client name, project manager, LPO reference, mobilization/off-hire dates, contact person, email, phone number, required compliance documents, and priority tier (`Critical`, `High`, `Standard`). Upon creation, a unique `BOB Booking-XXXXX` dossier ID is generated, and all departments receive instant notifications.
2. **Documentation Supervisor Review & Assignment:**  
   The documentation supervisor reviews incoming requirements, assigns specific crane assets, and allocates crew members (Operators, Riggers, Supervisors, Banksmen). Each crew member is displayed with live availability (`Present`, `On Leave`, `Assigned`, `Off-Site`) and certification status. Crew needing training renewals are explicitly flagged.
3. **Gear & Equipment Confirmation:**  
   The Lifting Gears Department selects shackles, slings, spreader beams, and hooks. **The system hard-blocks any gear with an expired inspection certificate**, preventing selection. Vehicles and trailers are assigned from the active fleet list with inspection validity tracking.
4. **Parallel Departmental Uploads:**  
   All 8 departments upload their required compliance documents concurrently. Each upload is tracked via an individual progress indicator (showing speed, ETA, and percentage completion). Uploaded documents support drag-and-drop, category/tag taxonomy, and full-screen preview modals.
5. **Milestone Review & 100% Completion:**  
   Once all departments hit 100% completion, the booking status transitions to *Ready for Review*. The documentation department formally submits the dossier.
6. **Executive Dispatch Review:**  
   Sales reviews the submitted document bundle, with authority to preview every file and flag individual items for revision (which kicks the dossier back to the responsible department).
7. **Final Dispatch & PDF Bundle Generation:**  
   Upon final approval, a single click generates an on-demand professional PDF dispatch bundle complete with the BOB company logo and exact timestamps, and automatically dispatches email notifications to locked recipients.

---

## 3. Departmental Roles & Access Matrix

The portal enforces granular Role-Based Access Control (RBAC) across 8 specialized operational divisions.

| Department Code | Department Name | Core Responsibilities | Key Portal Capabilities |
| :--- | :--- | :--- | :--- |
| `sales` | Sales & Client Relations | Client onboarding, quote estimates, booking initiation | 6-step booking wizard, enquiry inbox, dispatch sign-off |
| `docs` | Documentation Supervisor | Dossier oversight, document verification, submission | Document taxonomy, parallel tracking, supervisor assignments |
| `hse` | Health, Safety & Environment | Compliance audits, training renewals, safety passes | Crew training checks, certification expiry alerts, incident logs |
| `ops` | Operations Management | Fleet allocation, crane deployment, scheduling | Visual crew calendar, drag-and-drop assignment, conflict alerts |
| `workshop` | Workshop & Gear Inspection | Lifting gear safety, sling/shackle validation | Gear inspection expiry hard-blocking, maintenance logs |
| `transport` | Transport & Fleet | Trailer allocation, logistics, route compliance | Vehicle fleet roster, transport document verification |
| `accounts` | Accounts & Billing | LPO verification, invoicing, financial sign-off | Commercial document checks, billing status tracking |
| `administrator` | System Administration | User provisioning, role assignment, audit logs | Admin dashboard, user deactivation confirmation, activity audit |

---

## 4. Core Functional Modules & Technical Highlights

### A. Advanced Document Management & Taxonomy
- **Concurrent Multi-File Uploads:** Supports drag-and-drop and click-to-browse uploads for PDF, PNG, and JPG files up to 25MB with individual progress bars, speed, and ETA calculation.
- **Categorization & Tagging:** Dynamic document metadata persistence backed by dedicated database tables (`document_taxonomy_categories`, `document_taxonomy_tags`, `persisted_document_metadata`).
- **Multi-Tag Search Presets:** Users can save, rename, and delete custom multi-tag search presets stored securely in the backend database across browser sessions.

### B. Robust Excel Data Integration & Validation
- **Workbook Preview & Mapping:** Uploads Excel workbooks (`.xlsx`, `.xls`) with automated column mapping, duplicate header normalization, and schema rule checks.
- **Inline Editing & Batch Correction:** Direct inline cell editing for previewed rows and batch-correction rules to apply replacements across flagged validation rows simultaneously.
- **Flagged-Row CSV Export:** Instant export of flagged validation error rows into a clean CSV error report for offline correction.

### C. Attendance, Crew Scheduling & Training Tracking
- **Daily Attendance Roster:** Integrated employee records imported from department rosters (`OP`, `HELP`, `WORKSHOP`, `OFFICE`), supporting daily attendance marking and historical date lookup.
- **Visual Crew Calendar:** Interactive calendar view displaying crew assignments, schedule overlaps, and date-aware availability filtering.
- **Training Expiry Widgets:** Dashboard widgets highlighting personnel with expiring certifications, linked directly to full profile inspection modals.

---

## 5. Security, Testing & Deployment Standards

- **Unit Testing:** Maintained with a rigorous suite of **145 passing unit tests** across 52 test files (`vitest`).
- **Type Safety:** Strict TypeScript checking (`tsc --noEmit`) with end-to-end type safety via tRPC contracts and Drizzle ORM schemas.
- **Production Compilation:** Clean Vite production build with optimized chunk bundling and automated deployment pipeline integration.

---

## 6. References

[1] BOB Cranes Operations Portal PRD and System Architecture Guidelines, 2026.  
[2] React 19 & tRPC 11 Enterprise Architecture Specifications.  
[3] Drizzle ORM MySQL Relational Mapping Standards.
