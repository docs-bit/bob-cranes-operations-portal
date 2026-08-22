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
