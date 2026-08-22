# BOB Cranes Operations Portal

A production-grade, full-stack role-based operations portal built for **BOB Cranes**, streamlining heavy equipment rentals, 8-stage booking lifecycles, attendance-backed crew rosters, lifting gear inspection compliance, and real-time performance telemetry.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Recharts, Wouter routing, Lucide icons, Sonner toasts.
- **Backend**: Node.js, Express 4, tRPC 11 end-to-end typed contracts.
- **Database & Persistence**: Drizzle ORM with MySQL/TiDB schema management and S3 storage proxies.
- **Quality Assurance**: Comprehensive Vitest unit/integration test suite (138+ specs) and Playwright E2E testing workflows.

---

## 🚀 Key Features & Workflows

### 1. 8-Stage Booking Lifecycle & Wizard
- **Sales Intake**: 6-step wizard collecting client details, PM contacts, LPO references, priority tiers, and mobilization/off-hire dates.
- **Client Response Portal**: Secure client interface allowing real-time requirement submissions, document uploads, and direct multi-department chat.
- **Parallel Document Tracking**: Tracks required document completion percentages across Sales, Documentation, HSE, Lifting Gears, Trailers, Accounts, and Operations.
- **Dispatch & PDF Bundle Generation**: One-click preview and PDF dispatch bundle export emailing locked confirmation bundles.

### 2. Crew & Gear Management
- **Live Roster**: Attendance-backed personnel roster featuring presence tracking, role filters (Crane Operators, Riggers, Banksmen, Site Supervisors), and certificate expiration checks.
- **Interactive Drag-and-Drop Assignment**: Drag personnel directly onto filtered booking cards and drop zones with undoable success toast notifications and time-remaining countdown progress bars.
- **Lifting Gear Compliance**: Hard-blocks gear selection for any asset with an expired inspection certificate.
- **Visual Assignment Calendar**: Monthly and daily allocation views preventing schedule overlaps with date-aware availability badges.

### 3. Shareable Booking Lists & Search
- **URL-Synchronized Views**: Search queries (`q`), status filters (`filter`), and sorting options (`sort`) sync with URL query parameters for instant sharing and bookmarking.
- **Configurable Pagination**: Rows-per-page selector (10, 20, or 50 items) with local storage persistence across sessions.
- **Filtered CSV Export**: Instantly download currently filtered booking datasets or crew schedules as formatted CSV reports.

### 4. Web Vitals & Runtime Telemetry
- **Performance Dashboard**: Administrative analytics tracking Core Web Vitals (LCP, FID, CLS) over time with color-coded threshold overlays (good, needs improvement, poor) and custom date-range filters.
- **Exportable Reports**: Generate multi-page formatted PDF analytics reports and CSV telemetry exports.

---

## Portal Walkthrough

The following screenshots document the main public and authenticated experiences provided by the portal. They are stored in the repository under [`client/public/assets/portal-screenshots/`](client/public/assets/portal-screenshots/) so they can also be reused in product documentation and release notes.

| Experience | Screenshot asset | What it demonstrates |
|---|---|---|
| Public landing page | `landing-hero.png` | The core value proposition, public navigation, quote request, and capability entry points. |
| Services and planning | `rental-services.png` | Rental service categories and the path from enquiry to lift planning. |
| Capability overview | `capability-and-cta.png` | Equipment support context, mobilisation capability, and the sales handoff call to action. |
| Working process | `working-process.png` | The coordinated operating workflow from brief intake through controlled mobilisation. |
| Enquiry and contact | `rental-enquiry-and-footer.png` | The structured rental enquiry form, contact capture, and footer navigation. |
| Secure sign-in | `portal-sign-in.png` | The role-based portal entry point for authorised operational users. |
| Operations cockpit | `operations-dashboard.png` | The authenticated administrator dashboard for booking, crew, compliance, and departmental work. |

### Public Landing and Rental Planning

The public experience explains the company’s lifting-rental capability and gives prospective clients direct routes to request a quotation, explore services, and begin a structured rental enquiry.

![BOB Cranes public landing page showing the controlled-lifting hero message, navigation, rental quote action, and capability action](client/public/assets/portal-screenshots/landing-hero.png)

*Public landing page: positioning, navigation, and an operations-ready rental quote pathway.*

The services section connects the initial enquiry to practical service lines, including mobile crane rental, complex lift planning, lifting gear support, qualified crew, document control, and dispatch coordination.

![BOB Cranes rental services and lift planning section showing six service cards and a crane-planning panel](client/public/assets/portal-screenshots/rental-services.png)

*Rental services and planning: the operational support available before a crane arrives on site.*

The capability section presents equipment support in operational context and clarifies how a public enquiry becomes a coordinated handoff into the sales and operations workflow.

![BOB Cranes capability section showing site-lift support, branded fleet, managed mobilisation, and the rental quote call to action](client/public/assets/portal-screenshots/capability-and-cta.png)

*Capability overview: site-lift support, BOB fleet visibility, managed mobilisation, and a clear next action.*

### Coordinated Delivery and Enquiry Capture

The operating-process view shows the three controlled steps used to turn a project requirement into an actionable booking route: share the brief, coordinate readiness, and mobilise with a controlled handoff.

![BOB Cranes working-process section showing the brief, readiness, and mobilisation workflow steps](client/public/assets/portal-screenshots/working-process.png)

*Working process: a concise workflow that keeps sales, documentation, crew, gear, and operations aligned.*

The enquiry area collects the essentials that the sales team needs to start an informed response: contact details, project location, equipment type, rental duration, and lift or project context.

![BOB Cranes rental enquiry form and footer showing the project requirements form, rental estimate action, and site navigation](client/public/assets/portal-screenshots/rental-enquiry-and-footer.png)

*Rental enquiry: structured client inputs become an actionable sales and operations handoff.*

### Secure Operations Workspace

Authorised users enter through a dedicated sign-in experience, supporting controlled access to the role-based operational workspace.

![BOB Cranes portal sign-in screen showing the secure work-email and password form](client/public/assets/portal-screenshots/portal-sign-in.png)

*Secure portal access: a focused entry point for authenticated BOB Cranes operational users.*

After authentication, the Operations Cockpit provides an administrator-facing view of capacity, booking pipeline, compliance signals, department navigation, and priority actions.

![BOB Cranes Operations Cockpit dashboard showing booking statistics, crew availability, compliance watch, and department navigation](client/public/assets/portal-screenshots/operations-dashboard.png)

*Operations Cockpit: a consolidated dashboard for active dossiers, crew availability, compliance, and coordinated departmental execution.*

---

## 📦 Getting Started

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```
2. **Run Development Server**:
   ```bash
   pnpm run dev
   ```
3. **Execute Test Suite**:
   ```bash
   pnpm exec vitest run
   ```

---

## Production Deployment

The permanent production site is available at **https://bob-cranes-portal.vercel.app**. The React client and Express/tRPC API are deployed together on Vercel as a Git-linked production project. Pushes to the `main` branch trigger automatic production deployments.

The production database is a Railway MySQL service. Its connection string is stored only in Vercel as a **sensitive** environment variable and must never be committed to the repository or copied into client-side code.

| Variable | Required in Production | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Server-side Railway MySQL connection string. |
| `JWT_SECRET` | Yes | Server-side signing key for authenticated portal sessions. |
| `NODE_ENV` | Recommended | Set to `production` for production deployments. |

> The production database is initialized without an administrator account. Open **Portal Sign In** on the production site and complete the initial administrator setup before inviting operational users.

### Deployment Verification

The production deployment is considered healthy when the public landing page returns HTTP 200 and the read-only `auth.setupStatus` tRPC procedure returns successfully through `/api/trpc`. This confirms that the Vercel serverless API can connect to the Railway MySQL database without exposing database credentials to visitors.

### Security Notes

Keep `DATABASE_URL` and `JWT_SECRET` in the hosting provider's protected environment-variable settings only. If either value is ever exposed, rotate it immediately and redeploy the production application.

Repository: https://github.com/docs-bit/bob-cranes-operations-portal

---
