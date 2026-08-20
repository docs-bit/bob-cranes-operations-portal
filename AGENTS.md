# AGENTS.md — BOB Cranes Operations Portal

## Project Structure

- **Three-tier**: `client/src/` (React 19), `server/` (Express + tRPC 11), `shared/` (pure functions, no side effects). `shared/` is imported by both client and server — the canonical source for RBAC rules, booking stages, and business logic.
- **tRPC API paths are the contract**: Client calls like `trpc.operations.getBookings` are resolved from the type exported by `server/routers.ts`. When splitting/reorganizing routers, the top-level keys in `appRouter` must stay identical. The composer in `routers.ts` maps domain modules to these exact paths.
- **`db.seedInitialDataIfNeeded()`** is called at module-load time in `routers.ts` (and must be preserved in any composer rewrite). Seed data is lazy — first query triggers it.

## Test Patterns & Pitfalls

- **Text-scanning tests**: `server/gearDocumentUi.test.ts`, `server/salesResponseExpansion.test.ts`, and similar files `readFileSync` source files as raw strings to assert procedure names exist. After any router split/move, update the scanned file path — these tests don't import the code, they grep it.
- **Pre-existing failures (as of 2026-08-20)**: 5 `.tsx` test files fail due to missing `@testing-library/dom` when installed via `npm` (project uses `pnpm`). `server/operations.test.ts` has a flaky seed-dependent assertion (`equipment.length > 0`). Do not treat these as regressions.
- **Package manager**: Project has `pnpm-lock.yaml` but `npm install --legacy-peer-deps` works as fallback. Pure `npm install` may miss peer deps needed by `.tsx` tests.

## Department Code Unification

- **Two code systems existed**: `shared/bookingRules.ts` exported `DepartmentCode` as short codes (`SAL`, `DOC`, `LG`...) while `shared/departmentAccess.ts` exported the same type name as slug codes (`sales`, `documentation`, `lifting-gears`...). A manual bridge map `lifecycleNotificationDepartment` in routers translated between them.
- **Resolution**: All code now uses slug codes from `shared/departmentAccess.ts`. `bookingRules.ts` imports `DepartmentCode` from `departmentAccess.ts` — it no longer defines its own. The bridge map was deleted.
- **Display labels are separate from codes**: References like `"HSE"` in JSX display text or filter labels are *not* codes — they're human-readable labels. Only `DepartmentCode` type values and `.departmentCode` DB fields use slug codes.

## Architecture Decisions

- **`shared/` directory is the architectural gem**: Pure functions with no side effects, imported by both client and server. This ensures RBAC, booking stage transitions, conflict detection, and compliance rules are identical on both sides. Never put side effects here.
- **Zero import cycles**: The dependency graph is acyclic. Preserve this — tree-shaking and build reliability depend on it.
- **`Home.tsx` is a mega-component (~8600 lines)**: 44+ extracted sub-components but still the single highest-traffic file. Future decomposition target, but requires care due to heavy shared state.
- **`server/db.ts` is monolithic**: All database queries in one file (~3000+ lines). Domain-based splitting would mirror the router structure but hasn't been done yet.
- **Router file → top-level path mapping is not always 1:1**: `server/routers/monitoring.ts` exports a nested router (`runtimeErrors` + `telemetry`) but the composer flattens it to two separate top-level keys (`runtimeMonitoring` and `telemetry`). Similarly `sales.ts` exports two routers (`rentalRouter` + `salesEnquiriesRouter`). Check the composer, not the file name, for API path mapping.
- **`shared/bookingRules.ts` relies on `DepartmentCode` from `shared/departmentAccess.ts`**: After the department code unification, `bookingRules.ts` imports the type rather than defining its own. The `lifecycleStageDepartment` map (booking stage → owning department) lives in `server/routers/operations.ts` as a module-local constant.
- **`requireDocumentTaxonomyManager`**: Lives in `server/_core/helpers.ts`, not in the documents router. Used by `documents.ts` and would be needed by any future router touching taxonomy.

## Graphify

- Knowledge graph outputs live in `graphify-out/`. The `graph.json` can be queried with `graphify query "<question>"` after verifying `.graphify_python` exists (re-resolve if missing).
- `cn()` has 275 edges (CSS class merger) and `getDb()` has 78 edges — both are "god nodes" in the dependency graph. This is expected and not a problem.
