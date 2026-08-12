# BOB CRANES OPERATIONS PORTAL — PRODUCT REQUIREMENTS DOCUMENT (PRD) v3.0

**Author:** Engineering (Manus AI)  
**Date:** August 12, 2026  
**Status:** Approved for Build & Presentation  
**Scope:** Master Consolidated Specification merging PRD v1.0, v2.0, Client Response Portal, Documentation Supervisor Coordination, Google Drive Auto-Integration, Email Dispatch, and 8-Department Multi-Tenancy.

---

## 1. Executive Summary & Product Vision

The **BOB Cranes Operations Portal** is an enterprise-grade, dark-themed operations platform designed to manage the entire crane rental and lifting services lifecycle. It replaces fragmented communication channels (WhatsApp groups, isolated spreadsheets, and email chains) with a single auditable system of record [1] [2].

### Core Value Proposition
- **End-to-End Lifecycle Enforcement:** Bookings progress through exactly 8 mandatory stages controlled by role-based permissions.
- **Documentation Supervisor Coordination:** A centralized coordinator manages equipment, crew, trailers, and compliance flags.
- **Client Response Portal:** Clients receive a secure, dedicated portal link to upload required documents and communicate directly with 5 internal departments [2].
- **Automated Google Drive & Email Handoffs:** Booking creation auto-generates structured Google Drive folders (`Bk {Client}-{Location}-{DD.MM.YYYY}`), and final dispatch triggers an automated, branded email containing the PDF bundle and assigned crew manifest [1] [2].

---

## 2. Personas & Department Roster

The portal supports 10 distinct departments and external clients:
1. **Sales & Client Relations (SAL):** Manages the 6-step booking wizard, client directory, and final dispatch review.
2. **Documentation & Permits (DOC):** Hosts the **Documentation Supervisor**, coordinates resource allocation, and monitors document completeness.
3. **Lifting Gears / Engineering (LG):** Manages lifting accessories (shackles, slings, spreader beams) with hard-blocking for expired certificates.
4. **Maintenance (MNT):** Oversees crane condition reports and maintenance schedules.
5. **Crew / Workmen Assignment (CRW):** Manages operators, riggers, banksmen, and live availability status (Present, On Leave, Assigned, Off-Site).
6. **HSE / Safety (HSE):** Monitors safety compliance, training calendars, and certificate renewal flags.
7. **Accounts (ACC):** Handles invoices, LPO tracking, and financial sign-offs.
8. **HR (HR):** Manages employee directory, attendance, and leave requests.
9. **Transportation (TRN):** Manages heavy transport trailers and route dispatch.
10. **Administrator / Super Admin (ADM):** Manages department configurations, integrations (Google Drive & SMTP), and audit logs.
11. **Client (CLIENT):** External user accessing the Client Response Portal via magic link or OTP.

---

## 3. The 8-Stage Booking Lifecycle

Bookings move strictly through the following 8 stages. Each stage is role-gated:
1. **Created by Salesperson:** Initial intake via the 6-step booking wizard. Generates dossier ID `BOB Booking-XXXXX`.
2. **Documentation Supervisor:** Doc Supervisor reviews project specs, assigns cranes, crew, lifting gear, and trailers, and flags training needs.
3. **Crew Assigned:** Crew department confirms operator and rigger availability and compliance.
4. **Gear Confirmed:** Lifting Gears department selects compliant accessories (hard-blocked if expired).
5. **Docs In Progress:** Parallel document uploads across all departments and client portal.
6. **All Docs Submitted:** Documentation department marks all verification complete and submits.
7. **Reviewed:** Sales reviews submitted document bundle, with ability to flag revisions (kicking status back).
8. **Dispatched:** Final approval triggers email dispatch to locked client email and Google Drive folder archival.

---

## 4. Key Workflows & Functional Specifications

### 6-Step Salesperson Booking Wizard
- **Step 1:** Client & Project Dossier (Client Name, PM, LPO Ref, Mobilization/Off-Hire Dates, Contact Person, Client Email, Client Phone, Priority Tier: Standard / High / Critical). Generates `BOB Booking-XXXXX`.
- **Step 2:** Crane Selection (Filter by capacity, operational status).
- **Step 3:** System Broadcast (Alerts all 8 departments instantly).
- **Step 4:** Crew Assignment (Operators, riggers, banksmen with live availability and certificate status).
- **Step 5:** Lifting Gear Selection (Shackles, slings, beams; expired gear hard-blocked).
- **Step 6:** Summary & Confirmation.

### Client Response Portal
- Accessible via `/client/:booking_token`.
- Clients can upload additional documents and live-chat with **Documentation, HSE, Sales, Accounts, and Operations Management**.

### Dispatch & Handoff
- Email dispatch includes the standardized crew table (Asset Code, Name, Designation) and PDF document bundle.
- Client email address is locked during Sales review.

---

## 5. Information Architecture & UI/UX Specifications

### Route Map
- `/` - Landing page (Internal)
- `/admin` - Super Admin Dashboard (KPIs, Departments, Integrations)
- `/dept/:dept_code` - Department-specific dashboards
- `/dept/doc/console` - Documentation Supervisor Console
- `/bookings` - Kanban Pipeline View
- `/bookings/:id` - Detailed Booking Dossier
- `/client/:token` - Client Response Portal (External)

### UI Foundations
- **Theme:** Deep Dark (#0D0D0D background, #161616 surfaces)
- **Accent:** BOB Red (#E31E24)
- **Components:** shadcn/ui for high-quality interactions, Framer Motion for snappy transitions.

---

## 6. Logic & Validation Rules

### Compliance Hard-Blocks
- **Lifting Gear:** Selection is physically disabled if `next_inspection_date` < `mobilization_date`.
- **Crew:** Warning flags appear if certificates expire within 20 days of job start.
- **Dispatch:** "Dispatched" status is unreachable unless `completion_percentage` == 100% across all departments.

### Lifecycle Transitions
- **Reversion:** If Sales flags a document for revision, status reverts to "Docs In Progress" and triggers an in-app alert to the specific department.
- **Auto-Dossier:** ID generation follows `BOB Booking-` + 5-digit sequence (e.g., `BOB Booking-59116`).

---

## 7. Integration Specifications

### Google Drive Auto-Integration
- **Trigger:** Booking creation.
- **Format:** `Bk {Client}-{Location}-{DD.MM.YYYY}`.
- **Permissions:** Shared with relevant department heads and the client (read-only).

### Email Dispatch System
- **Template:** Branded HTML with crew manifest table.
- **Attachment:** Consolidated PDF bundle of all approved documents.
- **Security:** Locked recipient email (from Sales intake) to prevent accidental misrouting.

---

## 8. Acceptance Criteria (End Results)
- **R1:** Any employee can see the real-time stage of any booking via the Kanban view.
- **R2:** Zero dispatches possible with missing or expired certificates.
- **R3:** Client portal live-chat routes messages to all 5 specified departments.
- **R4:** Google Drive folder is created and accessible within 60 seconds of booking.

---

## 9. References
- [1] [BOB Cranes Operations Portal PRD v1.0 (2026-08-07)](/home/ubuntu/upload/BOB_Cranes_PRD.txt)
- [2] [BOB Cranes Operations Portal PRD v2.0 (2026-08-11)](/home/ubuntu/upload/BOB-Cranes-Operations-Portal-PRD-v2.0.md)
- [3] [Consolidated Master PRD v3.0 Source (2026-08-11)](/home/ubuntu/upload/BOBCRANES-PORTALPRD.txt)

