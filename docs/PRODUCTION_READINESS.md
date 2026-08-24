# Production readiness runbook

This runbook defines the release controls for the BOB Cranes Operations Portal. The active production delivery path is GitHub `main` to Vercel. The retained Railway application services are intentionally disconnected from GitHub auto-deploys and are not part of the release-status signal.

| Related guide | Use it for |
|---|---|
| [Architecture guide](ARCHITECTURE.md) | Application boundaries, API domains, and deployment topology. |
| [Development guide](DEVELOPMENT.md) | Local setup, migration generation, seed data, and test execution. |
| [Operations guide](OPERATIONS.md) | Active Vercel deployment, release ownership, verification, and rollback. |
| [Historical records](HISTORY.md) | Retained QA, design, and release records that are not current operating procedure. |

This runbook is the detailed release-control companion to the broader operations guide.

## Release gate

A change is ready to release only after the source, lockfile, and generated migration artifacts are reviewed together. The GitHub Actions **Quality gates** workflow runs TypeScript validation, Vitest, a production build, and Chromium browser smoke tests. A successful Vercel production deployment must then be visible against the commit on `main`.

| Gate | Required evidence | Owner action when it fails |
|---|---|---|
| Dependencies | `pnpm install --frozen-lockfile` completes | Resolve lockfile drift; do not use a mutable install for a release. |
| Type safety | `pnpm run check` completes with no errors | Correct the type failure before merge. |
| Application tests | `pnpm test` passes | Fix the failing behavior or update an intentionally changed test with review. |
| Browser smoke | `pnpm run test:e2e` passes with Chromium installed | Fix broken landing-page or sign-in flow before release. |
| Build | `pnpm run build` completes | Correct build or configuration failures before push. |
| Deployment | Vercel deployment state is `READY` | Inspect build/runtime logs and roll back if production is affected. |

## Database changes

Database migrations are release artifacts, not runtime side effects. When a schema change is required, update `drizzle/schema.ts`, generate and review the migration locally, commit the schema and migration together, and test the migration on a disposable copy. Before production, take a verified backup and apply the committed migration history using:

```bash
pnpm exec drizzle-kit migrate
```

Do not run `pnpm run db:push` or `pnpm run db:seed:sample` against a shared production database. The Vercel serverless deployment does not run migrations automatically. The Docker and Railway start commands also start the application only; they do not mutate schema state.

## Production verification

After a Vercel deployment reaches `READY`, verify the public page, portal access prompt, and database-backed API from the production domain. The following calls are read-only and do not disclose credentials:

```bash
curl -fsS 'https://bob-cranes-portal.vercel.app/' > /dev/null
curl -fsS 'https://bob-cranes-portal.vercel.app/api/trpc/auth.setupStatus?input=%7B%22json%22%3Anull%7D'
curl -fsS 'https://bob-cranes-portal.vercel.app/api/trpc/auth.me?input=%7B%22json%22%3Anull%7D'
```

`auth.me` returns `null` for a visitor without a session. `auth.setupStatus` reports only whether a first local administrator still needs setup; it does not create or modify data.

## Security and access review

The portal uses local password authentication with scrypt password hashes, 12-hour signed sessions, API-enforced role checks, and database-backed activity records. Vercel response headers prevent MIME sniffing and framing, reduce referrer leakage, disable unused browser capabilities, isolate the browsing context, and keep API responses out of shared caches.

Public sign-in, initial setup, quote enquiry, feedback, and telemetry capture routes use in-memory, client-aware token buckets. This limits ordinary burst abuse per running instance. It does not replace provider-level firewall, bot mitigation, incident alerting, or a distributed rate-limit store; assess those controls before opening high-volume public traffic.

Review direct and transitive dependency advisories on a routine cadence. Dependabot is configured for weekly npm updates. Spreadsheet import is client-side, accepts only `.xlsx` and `.xls` files, and enforces a 20 MB limit. Treat uploaded workbooks as untrusted and use endpoint security tooling on operator devices.

## Performance and delivery

The public landing page, sign-in page, portal workspace, and not-found page are loaded by route. The authenticated workspace—including document, chart, and operations tooling—is therefore not part of the public landing route’s initial JavaScript module. Preserve this boundary when adding new operational features, and run `pnpm run lighthouse:ci` or an equivalent production performance check after material UI or asset changes.

## Monitoring and incident response

Use Vercel deployment status, build logs, and grouped runtime-error reports as the primary production signals. The portal also records sanitized client runtime events and web-vital telemetry for administrators. When a release causes customer impact:

1. Confirm the affected route and deployment commit.
2. Review Vercel runtime errors and the portal’s runtime-monitoring workspace.
3. Roll back to the last known-good Vercel deployment or revert the problematic Git commit.
4. Verify the public page and read-only API checks after rollback.
5. Record the cause, impact, remediation, and follow-up test in the repository or internal incident process.

## Credential hygiene

Store `DATABASE_URL`, `JWT_SECRET`, and service credentials only in protected provider environment settings. Never commit a real `.env` file, copy production secrets into browser code, or include secrets in issue comments, screenshots, build logs, or exported records. Rotate the JWT secret if it is exposed; doing so invalidates all local-auth sessions.

For vulnerability disclosure, follow [SECURITY.md](../SECURITY.md) and use an approved private reporting channel.
