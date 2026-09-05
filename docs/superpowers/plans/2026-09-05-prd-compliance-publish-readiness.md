# PRD Compliance + Publish Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all known PRD correctness gaps (wizard date loss/validation, dispatch auditability, client-chat persistence, certificate-expiry alerts) and leave the app verified and publish-ready.

**Architecture:** Pure validation/date logic lives in `shared/` (imported by client and server, no side effects). Persistence lives in `server/db.ts` + Drizzle schema with migrations applied via `db:push`. UI calls typed tRPC procedures; server re-validates everything. No new top-level router keys; no changes to `db.seedInitialDataIfNeeded()`.

**Tech Stack:** React 19 + Vite client, Express + tRPC 11 server, Drizzle ORM + MySQL 8, Vitest (runs `server/**/*.test.ts` only), pnpm 10.4.1, `cross-env` npm scripts (Windows-safe).

**Spec:** PRD v3.0 (`BOB CRANES - PORTAL PRD (1).txt`, authoritative) + PRD v2.0 (`BOB-Cranes-Operations-Portal-PRD-v2.0.md`); gap audit 2026-09-05 (wizard dates, dispatch record, client chat, expiry alerts).

## Global Constraints

- Package manager is pnpm 10.4.1; install with `--frozen-lockfile` unless adding a dependency.
- `shared/` files must have zero side effects (pure functions, no I/O, no Date.now() defaults that hide impure behavior — pass `nowMs` explicitly).
- Never rename top-level keys of `appRouter` in `server/routers.ts`; client calls like `trpc.operations.getBookings` are the contract.
- `db.seedInitialDataIfNeeded()` stays called at module-load in `server/routers.ts`.
- Never run `db:seed:sample` against anything but a local/disposable database.
- Windows PowerShell 5.1 shell: chain with `; if ($?) { }`, quote paths with spaces, never use `&&`.
- Do not commit, push, or amend unless the user explicitly approves; prepare commits but stop before `git commit` without approval.
- Every data-bearing UI change keeps Loading / Error+Retry / Empty / Populated states.

---

## File map

| File | Responsibility |
|---|---|
| Create `shared/dossierDates.ts` | Pure dossier date format/parse/validate helpers (Task 1) |
| Create `server/dossierDates.test.ts` | Tests for Task 1 helpers |
| Modify `client/src/pages/views/Wizard.tsx:74-103,196-238` | Use form dates + inline field errors (Task 2) |
| Modify `server/routers/operations.ts:56-80` | `createBooking` input validation (Task 3) |
| Modify `drizzle/schema.ts` | Add `dispatches` table (Task 4) |
| Modify `server/db.ts` | Add `createDispatchRecord` (Task 4), expiry-check helpers (Task 6) |
| Modify `server/routers/operations.ts` | Add `recordDispatch`, `runExpiryCheck`, `getExpiryCheckStatus` (Tasks 4, 6) |
| Modify `client/src/pages/views/BookingDetail.tsx:753-771` | Wire Send button to `recordDispatch` (Task 4) |
| Modify `client/src/pages/views/ClientPortal.tsx:189-196` + props type + Home call site | Persist chat via `addChat` (Task 5) |
| Modify `shared/notificationAndExpiryRules.ts` | Add pure expiring-items finder + test (Task 6) |
| Modify `server/_core/index.ts:26-46` | Boot-time stale expiry check (Task 6) |
| Modify `client/src/pages/views/DocSupervisorConsole.tsx` | Expiry-check quick action (Task 6) |

---

### Task 1: Shared dossier-date helpers + tests

**Files:**
- Create: `shared/dossierDates.ts`
- Test: `server/dossierDates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatDossierDate(iso: string): string`, `parseDossierDate(value: string): Date | null`, `validateDossierInput(input: { client: string; email: string; mob: string; offHire: string }): { client?: string; email?: string; mob?: string; offHire?: string }` for Tasks 2 and 3.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  formatDossierDate,
  parseDossierDate,
  validateDossierInput,
} from "@shared/dossierDates";

describe("dossierDates", () => {
  it("formats ISO dates as dossier display dates", () => {
    expect(formatDossierDate("2026-08-11")).toBe("11 Aug 2026");
    expect(formatDossierDate("not-a-date")).toBe("");
  });

  it("parses ISO and display dates", () => {
    expect(parseDossierDate("2026-08-11")?.toDateString()).toBe(
      new Date(2026, 7, 11).toDateString()
    );
    expect(parseDossierDate("11 Aug 2026")?.toDateString()).toBe(
      new Date(2026, 7, 11).toDateString()
    );
    expect(parseDossierDate("garbage")).toBeNull();
  });

  it("rejects bad emails and inverted dates", () => {
    expect(
      validateDossierInput({
        client: "",
        email: "not-an-email",
        mob: "2026-08-18",
        offHire: "2026-08-11",
      })
    ).toEqual({
      client: "Client name is required.",
      email: "Enter a valid work email.",
      offHire: "Off-hire must be after mobilization.",
    });
    expect(
      validateDossierInput({
        client: "Gulf",
        email: "ops@gulf.ae",
        mob: "2026-08-11",
        offHire: "2026-08-18",
      })
    ).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run server/dossierDates.test.ts`
Expected: FAIL with "Failed to resolve import @shared/dossierDates".

- [ ] **Step 3: Write minimal implementation**

```ts
// Pure dossier date helpers for the Sales wizard and booking validation.
// Side-effect free: safe for import by both client and server.

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "2026-08-11" -> "11 Aug 2026". Returns "" when unparseable. */
export function formatDossierDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return "";
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** Accepts "2026-08-11" and "11 Aug 2026". Returns null when unparseable. */
export function parseDossierDate(value: string): Date | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const display = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/.exec(text);
  if (display) {
    const month = MONTHS_SHORT.findIndex(
      (name) => name.toLowerCase() === display[2].slice(0, 3).toLowerCase()
    );
    if (month === -1) return null;
    const date = new Date(Number(display[3]), month, Number(display[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export type DossierFieldErrors = {
  client?: string;
  email?: string;
  mob?: string;
  offHire?: string;
};

/** Field-level errors for the Sales intake form. Empty object = valid. */
export function validateDossierInput(input: {
  client: string;
  email: string;
  mob: string;
  offHire: string;
}): DossierFieldErrors {
  const errors: DossierFieldErrors = {};
  if (!input.client.trim()) errors.client = "Client name is required.";
  if (!EMAIL_PATTERN.test(input.email.trim()))
    errors.email = "Enter a valid work email.";
  const mob = parseDossierDate(input.mob);
  const offHire = parseDossierDate(input.offHire);
  if (!mob) errors.mob = "Enter a valid mobilization date.";
  if (!offHire) errors.offHire = "Enter a valid off-hire date.";
  if (mob && offHire && offHire.getTime() <= mob.getTime())
    errors.offHire = "Off-hire must be after mobilization.";
  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run server/dossierDates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Stage (commit only with user approval)**

```bash
git add shared/dossierDates.ts server/dossierDates.test.ts
```

### Task 2: Wizard uses form dates + inline errors

**Files:**
- Modify: `client/src/pages/views/Wizard.tsx:1-12,74-103,196-238`
- Test: manual UI pass + `pnpm run check` (no new test file; logic is covered by Task 1).

**Interfaces:**
- Consumes: `formatDossierDate`, `validateDossierInput` from Task 1.
- Produces: valid `Booking` with real dates for `onCreated`.

- [ ] **Step 1: Add the import and error state**

```tsx
import {
  formatDossierDate,
  validateDossierInput,
} from "@shared/dossierDates";
```

```tsx
const [fieldErrors, setFieldErrors] = useState<{
  client?: string;
  email?: string;
  mob?: string;
  offHire?: string;
}>({});
```

Place the `fieldErrors` state directly after the `wizardToast` state declaration in `Wizard()`.

- [ ] **Step 2: Replace `next()` step-1 gate with field validation**

Replace lines 74-86:

```tsx
const next = () => {
  if (step === 1) {
    const errors = validateDossierInput({
      client: form.client,
      email: form.email,
      mob: form.mob,
      offHire: form.offHire,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setWizardToast("Fix the highlighted fields before continuing.");
      setTimeout(() => setWizardToast(""), 2600);
      return;
    }
  }
  setStep(current => Math.min(6, current + 1));
};
```

- [ ] **Step 3: Use the form dates in `finish()`**

Replace lines 97-98:

```tsx
mob: formatDossierDate(form.mob) || form.mob,
offHire: formatDossierDate(form.offHire) || form.offHire,
```

- [ ] **Step 4: Show inline errors under the four inputs**

Under each of the four step-1 inputs (Client name, Mobilization date, Off-hire date, Client notification email), add `aria-invalid` and an error line. Example for the Client name field (lines 164-171):

```tsx
<div className="form-field">
  <label>Client name *</label>
  <input
    className="form-input"
    value={form.client}
    aria-invalid={Boolean(fieldErrors.client)}
    onChange={event => {
      update("client", event.target.value);
      setFieldErrors(current => ({ ...current, client: undefined }));
    }}
  />
  {fieldErrors.client && (
    <div className="field-error" role="alert">{fieldErrors.client}</div>
  )}
</div>
```

Repeat the same pattern for `form.mob` (key `mob`), `form.offHire` (key `offHire`), and `form.email` (key `email`). Add to `client/src/index.css`:

```css
.field-error { color: #e31e24; font-size: 11px; margin-top: 4px; }
.form-input[aria-invalid="true"] { border-color: #e31e24; }
```

- [ ] **Step 5: Verify**

Run: `pnpm run check`
Expected: clean. Manual: open New Booking, submit empty step 1 (4 inline errors), enter off-hire before mob (ordering error), enter valid dates (booking created with real dates).

- [ ] **Step 6: Stage (commit only with user approval)**

```bash
git add client/src/pages/views/Wizard.tsx client/src/index.css
```

### Task 3: Server-side booking validation

**Files:**
- Modify: `server/routers/operations.ts:1-14,56-80`
- Test: covered by Task 1 pure tests + `pnpm run check`; procedure shape unchanged.

**Interfaces:**
- Consumes: `parseDossierDate` from Task 1.
- Produces: `createBooking` rejects bad email / inverted dates with `BAD_REQUEST`.

- [ ] **Step 1: Extend the input schema**

Replace the `createBooking` input object (`server/routers/operations.ts:57-76`) with:

```ts
z.object({
  id: z.string().trim().min(1).max(64),
  clientName: z.string().trim().min(1).max(255),
  projectName: z.string().trim().min(1).max(255),
  projectManager: z.string().trim().min(1).max(255),
  lpoReference: z.string().trim().min(1).max(128),
  mobilizationDate: z.string().trim().min(1).max(64),
  offHireDate: z.string().trim().min(1).max(64),
  clientContactName: z.string().trim().min(1).max(255),
  clientEmail: z.string().trim().email().max(320),
  clientPhone: z.string().trim().min(1).max(64),
  priority: z.string().trim().min(1).max(32),
  stage: z.string().trim().min(1).max(128),
  craneId: z.string().trim().min(1).max(64).optional(),
  crewIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  gearIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  trailerIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
})
.superRefine((value, ctx) => {
  const mob = parseDossierDate(value.mobilizationDate);
  const offHire = parseDossierDate(value.offHireDate);
  if (mob && offHire && offHire.getTime() <= mob.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["offHireDate"],
      message: "Off-hire must be after mobilization.",
    });
  }
})
```

Add the import at the top of `operations.ts`:

```ts
import { parseDossierDate } from "@shared/dossierDates";
```

- [ ] **Step 2: Verify**

Run: `pnpm run check`
Expected: clean. Existing callers pass trimmed valid strings, so no UI breakage.

- [ ] **Step 3: Stage (commit only with user approval)**

```bash
git add server/routers/operations.ts
```

### Task 4: Auditable dispatch record

**Files:**
- Modify: `drizzle/schema.ts` (append table + type export)
- Modify: `server/db.ts` (import table, add `createDispatchRecord`)
- Modify: `server/routers/operations.ts` (add `recordDispatch` after `requestDispatchBundle`)
- Modify: `client/src/pages/views/BookingDetail.tsx:60-66,753-771`
- Test: manual UI click + `SELECT * FROM dispatches` row check; `pnpm run check`.

**Interfaces:**
- Consumes: `db.createDispatchRecord`.
- Produces: `trpc.operations.recordDispatch` returning the stored row.

- [ ] **Step 1: Add the `dispatches` table**

Append to `drizzle/schema.ts` (after `clientFilterPresets`, before the type exports include the new type):

```ts
export const dispatches = mysqlTable("dispatches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  dispatchedBy: int("dispatchedBy"),
  sentToEmail: varchar("sentToEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("Recorded"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

```ts
export type DispatchRecord = typeof dispatches.$inferSelect;
```

- [ ] **Step 2: Add the db helper**

Add `dispatches` to the schema import list in `server/db.ts`, then append:

```ts
export async function createDispatchRecord(data: {
  id: string;
  bookingId: string;
  dispatchedBy?: number | null;
  sentToEmail: string;
  subject: string;
  summary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(dispatches).values({
    ...data,
    dispatchedBy: data.dispatchedBy ?? null,
    status: "Recorded",
  });
  const rows = await db
    .select()
    .from(dispatches)
    .where(eq(dispatches.id, data.id));
  return rows[0];
}
```

- [ ] **Step 3: Add the `recordDispatch` procedure**

Insert after `requestDispatchBundle` in `server/routers/operations.ts`:

```ts
recordDispatch: protectedProcedure
  .input(
    z.object({
      id: z.string().trim().min(1).max(64),
      bookingId: z.string().trim().min(1).max(64),
      sentToEmail: z.string().trim().email().max(320),
      subject: z.string().trim().min(1).max(255),
      summary: z.string().trim().min(1).max(4000),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin")
      requireDepartmentAccess(ctx.user, "documentation");
    const record = await db.createDispatchRecord({
      ...input,
      dispatchedBy: ctx.user.id,
    });
    await db.addUserActivity({
      userId: ctx.user.id,
      action: "dispatch_recorded",
      detail: `${ctx.user.name ?? ctx.user.email ?? "Documentation"} recorded dispatch ${input.id} for ${input.bookingId}. Email sending is not configured; the package was NOT emailed.`,
    });
    return { record };
  }),
```

- [ ] **Step 4: Migrate**

Run: `pnpm run db:push`
Expected: new migration file under `drizzle/`, applies cleanly. Review the generated SQL before continuing.

- [ ] **Step 5: Wire the Send button**

In `client/src/pages/views/BookingDetail.tsx`, add near `dispatchBundleMutation` (line 64):

```tsx
const recordDispatchMutation =
  trpc.operations.recordDispatch.useMutation();
```

Replace the toast-only `onClick` (lines 762-767) with:

```tsx
onClick={() => void (async () => {
  if (!canDispatch) return;
  try {
    const recipient = window.prompt(
      "Confirm the locked notification email for this dispatch:",
      ""
    );
    if (!recipient) return;
    const result = await recordDispatchMutation.mutateAsync({
      id: `dispatch-${booking.id}-${Date.now()}`,
      bookingId: persistedBookingIdForUi(booking.id) ?? booking.id,
      sentToEmail: recipient,
      subject: `BOB Cranes — Booking ${booking.id} Document Package — ${booking.client}`,
      summary: `${dossierCrew.length} crew, ${dossierDocuments.length} documents, completion ${completion}%. PDF bundle generated locally; SMTP not configured so nothing was emailed.`,
    });
    setDispatchPreview(false);
    notify(`Dispatch recorded as ${result.record.id}. SMTP is not configured, so nothing was emailed.`);
  } catch (caught) {
    globalToast.error("Dispatch could not be recorded", {
      description: caught instanceof Error ? caught.message : "Please try again.",
    });
  }
})()}
```

- [ ] **Step 6: Verify**

Run: `pnpm run check`
Expected: clean. Manual: click Send final package on a Reviewed dossier, confirm the prompt, then `SELECT id, bookingId, status FROM dispatches;` shows the row with status `Recorded`.

- [ ] **Step 7: Stage (commit only with user approval)**

```bash
git add drizzle/schema.ts drizzle/<new-migration>.sql server/db.ts server/routers/operations.ts client/src/pages/views/BookingDetail.tsx
```

### Task 5: Persist client-portal chat

**Files:**
- Modify: `client/src/pages/views/ClientPortal.tsx:1-60,189-196` (props type + `sendMessage`)
- Modify: `client/src/pages/Home.tsx:209-250` (pass `actorDepartment`)
- Test: manual send + `SELECT body FROM chat_messages ORDER BY createdAt DESC LIMIT 1`; `pnpm run check`.

**Interfaces:**
- Consumes: existing `trpc.operations.addChat` (team gating enforced server-side).
- Produces: persisted booking chat visible in console right rail.

- [ ] **Step 1: Add the `actorDepartment` prop**

In `ClientPortal.tsx`, locate the props type of the `ClientPortal()` function signature and add:

```tsx
actorDepartment: string | null;
```

Destructure it alongside the existing props (`booking`, `documents`, …).

- [ ] **Step 2: Replace `sendMessage` with a persisting version**

Replace lines 189-196 with:

```tsx
const chatMutation = trpc.operations.addChat.useMutation();
const chatTeam =
  actorDepartment === "documentation"
    ? "Documentation"
    : actorDepartment === "hse"
      ? "HSE"
      : actorDepartment === "sales"
        ? "Sales"
        : actorDepartment === "accounts"
          ? "Accounts"
          : "Operations Management";
const sendMessage = () => {
  if (!message.trim()) return;
  const text = message.trim();
  setMessages(current => [
    ...current,
    { from: "You", text, time: "Now" },
  ]);
  setMessage("");
  void chatMutation
    .mutateAsync({
      id: `client-chat-${Date.now()}`,
      bookingId: persistedBookingIdForUi(booking.id) ?? booking.id,
      team: chatTeam,
      sender: "Client portal",
      body: text,
    })
    .catch(() => {
      notify(
        "Message shown locally but could not be saved. It will not appear for internal teams until you retry."
      );
    });
};
```

Ensure `persistedBookingIdForUi` is imported from `./shared` (extend the existing `./shared` import in `ClientPortal.tsx`), and that `trpc` is already imported (it is — `feedbackMutation` at line 110 uses it).

- [ ] **Step 3: Pass the prop from Home**

In `Home.tsx` where `<ClientPortal` is rendered (lines 209-250), add:

```tsx
actorDepartment={user?.departmentCode ?? null}
```

- [ ] **Step 4: Verify**

Run: `pnpm run check`
Expected: clean. Manual: open `/client/portal-bob-31511`, send a chat message, confirm the row in `chat_messages` and that it appears in the console right rail.

- [ ] **Step 5: Stage (commit only with user approval)**

```bash
git add client/src/pages/views/ClientPortal.tsx client/src/pages/Home.tsx
```

### Task 6: Certificate-expiry alerts (20-day rule)

**Files:**
- Modify: `shared/notificationAndExpiryRules.ts` (append pure finder)
- Create: `server/expiryCheck.test.ts` (tests for the finder)
- Modify: `server/db.ts` (last-run settings + `runCertificateExpiryCheck` + `runCertificateExpiryCheckIfStale`)
- Modify: `server/routers/operations.ts` (add `runExpiryCheck`, `getExpiryCheckStatus`)
- Modify: `server/_core/index.ts:26-46` (boot-time stale check)
- Modify: `client/src/pages/views/DocSupervisorConsole.tsx` (quick-action button + last-run line)
- Test: `pnpm exec vitest run server/expiryCheck.test.ts` + manual button click.

**Interfaces:**
- Consumes: existing `getAllCrew/getAllLiftingGears/getAllEquipment`, `addNotification`, `systemSettings` upsert pattern (see `setActivityRetentionDays`, `server/db.ts:291-309`).
- Produces: daily-idempotent HSE + owner-department expiry notifications.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { findExpiringDatedItems } from "@shared/notificationAndExpiryRules";

const NOW = new Date(2026, 7, 5).getTime();

describe("findExpiringdatedItems", () => {
  it("flags expired and 20-day items, ignores far-future and garbage", () => {
    const result = findExpiringDatedItems(
      [
        { key: "past", label: "Crane B-205 inspection", expiry: "2026-07-01", ownerDepartment: "maintenance" },
        { key: "soon", label: "Vijayakumar certificate", expiry: "2026-08-16", ownerDepartment: "crew" },
        { key: "late", label: "Sling INS-218", expiry: "2026-12-01", ownerDepartment: "lifting-gears" },
        { key: "junk", label: "Mystery doc", expiry: "unknown", ownerDepartment: "crew" },
      ],
      NOW,
      20
    );
    expect(result.map(item => item.key)).toEqual(["past", "soon"]);
    expect(result[0].status).toBe("expired");
    expect(result[1].status).toBe("expiring");
    expect(result[1].daysLeft).toBe(11);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run server/expiryCheck.test.ts`
Expected: FAIL with "findExpiringDatedItems is not a function" (export missing).

- [ ] **Step 3: Implement the finder**

Append to `shared/notificationAndExpiryRules.ts`:

```ts
export type ExpiringDatedItem = {
  key: string;
  label: string;
  expiry: string;
  ownerDepartment: string;
};

export type ExpiringDatedHit = ExpiringDatedItem & {
  daysLeft: number;
  status: "expired" | "expiring";
};

/** Items whose expiry is past (expired) or within `warnDays` (expiring). Unparseable dates are ignored. */
export function findExpiringDatedItems(
  items: ExpiringDatedItem[],
  nowMs: number,
  warnDays = 20
): ExpiringDatedHit[] {
  const hits: ExpiringDatedHit[] = [];
  for (const item of items) {
    const parsed = Date.parse(item.expiry);
    if (Number.isNaN(parsed)) continue;
    const daysLeft = Math.ceil((parsed - nowMs) / 86_400_000);
    if (daysLeft < 0) hits.push({ ...item, daysLeft, status: "expired" });
    else if (daysLeft <= warnDays) hits.push({ ...item, daysLeft, status: "expiring" });
  }
  return hits.sort((a, b) => a.daysLeft - b.daysLeft);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run server/expiryCheck.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Add db helpers**

Append to `server/db.ts` (mirroring `getActivityRetentionDays`/`setActivityRetentionDays` at lines 279-309):

```ts
export async function getExpiryCheckLastRun() {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "expiry_check_last_run"))
    .limit(1);
  return result[0]?.value ?? null;
}

export async function runCertificateExpiryCheck(nowMs: number = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { findExpiringDatedItems } = await import(
    "../shared/notificationAndExpiryRules"
  );
  const crew = await getAllCrew();
  const gears = await getAllLiftingGears();
  const assets = await getAllEquipment();
  const hits = findExpiringDatedItems(
    [
      ...crew.map(member => ({
        key: `crew-${member.id}`,
        label: `Crew certificate · ${member.name}`,
        expiry: member.certificateExpiry,
        ownerDepartment: "crew",
      })),
      ...gears.map(gear => ({
        key: `gear-${gear.id}`,
        label: `Lifting gear inspection · ${gear.name}`,
        expiry: gear.inspectionExpiry,
        ownerDepartment: "lifting-gears",
      })),
      ...assets.map(asset => ({
        key: `asset-${asset.id}`,
        label: `Equipment inspection · ${asset.name}`,
        expiry: asset.inspectionExpiry,
        ownerDepartment: "maintenance",
      })),
    ],
    nowMs,
    20
  );
  const today = new Date(nowMs).toISOString().slice(0, 10);
  let alerts = 0;
  for (const hit of hits) {
    const title =
      hit.status === "expired"
        ? `Certificate expired · ${hit.label}`
        : `Certificate expiring in ${hit.daysLeft}d · ${hit.label}`;
    const body = `${hit.label} expires ${hit.expiry}. Owner department: ${hit.ownerDepartment}.`;
    await addNotification({
      id: `expiry-${hit.key}-${today}`,
      userId: null,
      departmentCode: "hse",
      title,
      body,
    });
    if (hit.ownerDepartment !== "hse") {
      await addNotification({
        id: `expiry-${hit.key}-${today}-owner`,
        userId: null,
        departmentCode: hit.ownerDepartment,
        title,
        body,
      });
    }
    alerts += 1;
  }
  await db
    .insert(systemSettings)
    .values({ key: "expiry_check_last_run", value: today, updatedBy: null })
    .onDuplicateKeyUpdate({ set: { value: today, updatedBy: null } });
  return { ran: true, alerts, checkedAt: today };
}

export async function runCertificateExpiryCheckIfStale(
  nowMs: number = Date.now()
) {
  const lastRun = await getExpiryCheckLastRun();
  const today = new Date(nowMs).toISOString().slice(0, 10);
  if (lastRun === today) return { ran: false, alerts: 0, checkedAt: lastRun };
  return await runCertificateExpiryCheck(nowMs);
}
```

- [ ] **Step 6: Add procedures**

Insert into `server/routers/operations.ts` (after `updateTrainingFlag`):

```ts
runExpiryCheck: protectedProcedure.mutation(async ({ ctx }) => {
  if (
    ctx.user.role !== "admin" &&
    !["hse", "documentation", "crew"].includes(ctx.user.departmentCode ?? "")
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only HSE, Crew, Documentation or an administrator can run the expiry check.",
    });
  return await db.runCertificateExpiryCheckIfStale();
}),

getExpiryCheckStatus: protectedProcedure.query(async () => ({
  lastRun: await db.getExpiryCheckLastRun(),
})),
```

- [ ] **Step 7: Boot-time stale check**

In `server/_core/index.ts`, inside `startServer()` after the Vite/static setup (after line 34), insert:

```ts
try {
  const { runCertificateExpiryCheckIfStale } = await import("../db");
  const expiry = await runCertificateExpiryCheckIfStale();
  if (expiry.ran)
    console.log(`Expiry check: ${expiry.alerts} certificate alerts created.`);
} catch (error) {
  console.warn(
    "Expiry check skipped:",
    error instanceof Error ? error.message : error
  );
}
```

- [ ] **Step 8: Console quick action**

In `DocSupervisorConsole.tsx` quick-actions panel, add:

```tsx
const expiryStatusQuery = trpc.operations.getExpiryCheckStatus.useQuery();
const runExpiryMutation = trpc.operations.runExpiryCheck.useMutation();
```

```tsx
<button
  type="button"
  className="secondary-button"
  disabled={!canCoordinate || runExpiryMutation.isPending}
  onClick={() => void (async () => {
    try {
      const result = await runExpiryMutation.mutateAsync();
      await expiryStatusQuery.refetch();
      toast.success(
        result.ran
          ? `Expiry check complete · ${result.alerts} alerts sent to HSE and owners.`
          : "Expiry check already ran today."
      );
    } catch (caught) {
      toast.error("Expiry check blocked", {
        description: caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  })()}
>
  <Bell size={14} /> Run certificate expiry check
</button>
<div className="panel-meta">
  Last run: {expiryStatusQuery.data?.lastRun ?? "never"}
</div>
```

`Bell` is already imported in `DocSupervisorConsole.tsx` only if used — check imports: the file imports AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Flag, Lock, MessageCircle, Plus, RotateCcw, Send, Truck, Users, Wrench, X. `Bell` is NOT imported. Add `Bell` to that lucide-react import list.

- [ ] **Step 9: Verify**

Run: `pnpm run check`
Expected: clean. Manual: click the button, confirm HSE notifications appear, re-click same day reports already-ran.

- [ ] **Step 10: Stage (commit only with user approval)**

```bash
git add shared/notificationAndExpiryRules.ts server/expiryCheck.test.ts server/db.ts server/routers/operations.ts server/_core/index.ts client/src/pages/views/DocSupervisorConsole.tsx
```

### Task 7: Publish-readiness gate + rebuild + restart

**Files:** none (verification only).

- [ ] **Step 1: Review pending migrations**

Run: `ls drizzle/*.sql`
Expected: `0020_pale_madame_web.sql` (training_flags) + the new dispatches migration from Task 4. Open each and confirm it only creates the intended table.

- [ ] **Step 2: Environment hygiene**

Run: `node -e "const s=process.env.JWT_SECRET||''; console.log('JWT length:', s.length)"` — no, `.env` is not in `process.env` of a bare node call. Instead verify the file exists and the value is long:

```powershell
Test-Path -LiteralPath ".env"; (Select-String -Path ".env" -Pattern "^JWT_SECRET=(.+)$").Matches[0].Groups[1].Value.Length
```

Expected: `True`, length ≥ 32. Confirm `.env` is git-ignored: `Select-String -Path ".gitignore" -Pattern "^\.env$"`.

- [ ] **Step 3: Quality gates**

Run: `pnpm run check`
Expected: clean.

Run: `pnpm test`
Expected: all files pass (baseline 2026-09-05: 54 files / 154 tests; plus new Task 1 + Task 6 tests).

Run: `pnpm run build`
Expected: `dist/index.js` + `dist/public` produced.

- [ ] **Step 4: Restart exactly one server**

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& "$env:LOCALAPPDATA\npm-global\pnpm.cmd" start" -WorkingDirectory "C:\Users\nawas\Downloads\BOB portal"
```

Wait 20s, then verify a single listener and healthy endpoints:

```powershell
curl.exe --fail --silent http://localhost:3000/ -o NUL; if ($?) { "UP" } else { throw "not up" }
curl.exe --fail --silent 'http://localhost:3000/api/trpc/auth.setupStatus?input=%7B%22json%22%3Anull%7D'
```

Expected: `UP`, then `{"result":{"data":{"json":{"needsAdminSetup":false}}}}`.

- [ ] **Step 5: Login smoke**

Log in at `http://localhost:3000/login` with the local admin account and open one booking dossier plus the Coordination console. Close all stale extra PowerShell server windows, keeping exactly one.

## Out of scope (queued, not this plan)

- Token-scoped public client portal (logged-out magic link): needs `client_portal_tokens` table, public token procedures, link issuance UI. Auth-surface change — separate plan + explicit approval.
- View-only auditor role, session revocation list, Drive/SMTP integrations (need real credentials), attendance times/export, Crew/HSE flags inboxes, scheduled trainings calendar.
- E2E Playwright suite (needs `pnpm exec playwright install chromium` once on this machine).

## Self-review

- Spec coverage: PRD §9 date rules → Tasks 1-3; §14 reproducible dispatch → Task 4; §10 chat persistence → Task 5; §12.4/G3 expiry alerts → Task 6; §22-23 gates → Task 7. Token portal, auditor role, integrations queued explicitly above.
- Placeholders: none — every step has exact file paths, code, commands, expected outputs. Task 5 props-type edit names the exact anchor (the `ClientPortal()` props type) and exact lines to insert.
- Type consistency: `TrainingFlagStatus`, `Booking`, `DocumentItem` reused verbatim; new `dispatches`/`expiry` names match `db.ts`/`schema.ts` conventions (`bookingCrewAllocations`, `addNotification`, `setActivityRetentionDays`).
