# BOB Cranes Operations Portal

A production-grade, full-stack role-based operations portal built for **BOB Cranes**, streamlining heavy equipment rentals, 8-stage booking lifecycles, attendance-backed crew rosters, lifting gear inspection compliance, and real-time performance telemetry.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Recharts, Wouter routing, Lucide icons, Sonner toasts.
- **Backend**: Node.js, Express 4, tRPC 11 end-to-end typed contracts.
- **Database & Persistence**: Drizzle ORM with MySQL/TiDB schema management and S3 storage proxies.
- **Quality Assurance**: Comprehensive Vitest unit/integration test suite (158 specs) and Playwright E2E testing workflows.

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
   npm install --legacy-peer-deps
   ```
2. **Run Development Server**:
   ```bash
   npm run dev
   ```
3. **Execute Test Suite**:
   ```bash
   npm test
   ```
