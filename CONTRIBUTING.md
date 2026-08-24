# Contributing to BOB Cranes Operations Portal

## Contribution principles

Keep each change focused, reviewable, and aligned with the portal’s operational boundaries. The public rental journey, authenticated departmental workspaces, database schema, and deployment configuration are connected; update the relevant code, tests, and documentation together.

## Before you start

1. Review the [architecture guide](docs/ARCHITECTURE.md) and the relevant domain router or page.
2. Create a local `.env` from [`.env.example`](.env.example) using a local or disposable database.
3. Do not use production credentials, customer data, or production databases for development or test work.
4. Keep secrets, database dumps, generated build output, and test artifacts out of commits.

## Change expectations

| Change type | Required companion work |
|---|---|
| UI or route change | Update the relevant page/component, add or adjust coverage where appropriate, and validate the affected browser flow. |
| API or authorization change | Update the appropriate router/procedure, preserve server-side access checks, and add focused tests. |
| Database schema change | Update `drizzle/schema.ts`, generate and review the migration, test it on a disposable database, and commit the schema plus migration together. |
| Configuration or deployment change | Update `.env.example`, the README, and the relevant development or operations guide. |
| Documentation change | Keep implementation links and commands accurate; retain historical records only when they provide durable context. |

## Required validation

Run the checks that match the change. The baseline release gate is:

```bash
pnpm run check
pnpm test
pnpm run build
```

Run browser smoke tests when the public rental flow, sign-in state, navigation, or route behavior changes:

```bash
pnpm exec playwright install chromium
pnpm run test:e2e
```

GitHub Actions performs the same baseline validation on pull requests to `main` and on pushes to `main`. A green local result does not replace a review of the resulting GitHub workflow and Vercel deployment.

## Database changes

Use `pnpm run db:push` only for a local or disposable development database. Production and shared-environment changes must apply already reviewed migrations with:

```bash
pnpm exec drizzle-kit migrate
```

Do not run the demonstration seeder against shared or production data. Refer to the [development guide](docs/DEVELOPMENT.md) and [operations guide](docs/OPERATIONS.md) for the complete database and release procedure.

## Pull requests

A pull request should explain the operational reason for the change, identify any routes or roles affected, describe migration implications, and state the validation performed. Update screenshots or user-facing documentation when a visible workflow changes.

For a security-sensitive issue, do not open a public pull request or issue containing the exploit details. Follow [SECURITY.md](SECURITY.md) instead.
