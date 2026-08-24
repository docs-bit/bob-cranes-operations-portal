# Development guide

## Local prerequisites

Use the package-manager version pinned in [`package.json`](../package.json). Development and CI are validated with Node.js 22; a MySQL-compatible database is required for persistence, migrations, and full local-auth behavior.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

Do not commit `.env`, database exports, access tokens, or production credentials.

## Environment configuration

The safe template in [`.env.example`](../.env.example) is the maintained reference. Configure a local or disposable database before running database commands.

| Variable | Required locally | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes for persisted workflows | MySQL connection string for Drizzle migrations and application persistence. |
| `JWT_SECRET` | Yes for local sign-in | Secret used to sign and verify local-auth sessions. |
| `NODE_ENV` | Recommended | Set to `development` for local work; production hosting sets `production`. |
| `PORT` | No | Persistent server port; the default is `3000`. |
| `SAMPLE_DB_PASSWORD` | No | Local-only password for the optional demonstration seeder. |
| `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID` | No, but paired | Optional analytics configuration; set both values or neither. |

Optional platform/OAuth variables are listed in `.env.example`. Do not configure an integration unless it is intentionally enabled and its credentials are available through a protected local or hosting environment.

## Start the application

```bash
pnpm run dev
```

The development command starts the Express application with Vite middleware. Open [http://localhost:3000](http://localhost:3000) for the public landing page, or [http://localhost:3000/portal](http://localhost:3000/portal) for portal access.

For an empty local database, the portal provides the first-administrator setup flow. Do not use that bootstrap path to create accounts on a database that already contains users.

## Database workflow

The schema lives in [`drizzle/schema.ts`](../drizzle/schema.ts), Drizzle configuration is in [`drizzle.config.ts`](../drizzle.config.ts), and committed migration artifacts live in [`drizzle/`](../drizzle/).

### Development migration flow

```bash
# 1. Change drizzle/schema.ts.
# 2. Confirm DATABASE_URL targets a local or disposable database.
pnpm run db:push

# 3. Review generated artifacts before committing them.
git status --short drizzle/
git diff -- drizzle/
```

`pnpm run db:push` runs `drizzle-kit generate` followed by `drizzle-kit migrate`. It is appropriate only when the target database is safe for development change.

### Apply-only migration flow

To apply migrations that are already committed, without generating new migration files:

```bash
pnpm exec drizzle-kit migrate
```

This is the command used for reviewed production migrations. See the [operations guide](OPERATIONS.md) before running it against a shared environment.

### Local demonstration data

```bash
SAMPLE_DB_PASSWORD='local-only-password' pnpm run db:seed:sample
```

The seeder creates a coherent demonstration dataset across departments, users, fleet, crew, lifting gear, trailers, bookings, documents, enquiries, notifications, dashboard data, and governance records. It is only for an empty or disposable database.

> Never run `db:seed:sample` against a production, shared, or customer-data environment. Never rely on its default password behavior outside an isolated local database.

## Quality checks

| Command | Use it when |
|---|---|
| `pnpm run check` | Before every code or type-sensitive documentation change. |
| `pnpm test` | After changes to rules, routers, components, or persistence behavior. |
| `pnpm run test:e2e` | After public-rental, sign-in, route, or user-flow changes. |
| `pnpm run build` | Before release; validates the Vite build and Node server bundle. |
| `pnpm run lighthouse:ci` | When assessing the local Lighthouse helper. |

On a new machine, install the Playwright browser before the first E2E run:

```bash
pnpm exec playwright install chromium
pnpm run test:e2e
```

The browser smoke suite starts a local server and does not alter production data. A missing optional OAuth integration may log a development warning during this suite; that warning does not replace the required sign-in and public-rental assertions.

## Development conventions

1. **Maintain contract boundaries.** Add or extend typed procedures in the relevant router; use the existing tRPC client instead of introducing a parallel REST client.
2. **Keep persistence deliberate.** Update schema, generated migrations, database helpers, tests, and documentation together.
3. **Preserve access control.** Use protected or role-aware procedures for internal data. Do not rely on hidden client controls as authorization.
4. **Protect credentials.** Use safe placeholder values in examples. Never print or commit real secrets.
5. **Keep documentation current.** Update the relevant guide whenever a command, environment variable, route, deployment behavior, or access boundary changes.
6. **Keep local artifacts out of commits.** Do not commit build output, test result folders, local logs, `.env` files, or database dumps.

## Useful source locations

| Area | Location |
|---|---|
| Client routes | [`client/src/App.tsx`](../client/src/App.tsx) |
| Public landing page | [`client/src/pages/RentalLanding.tsx`](../client/src/pages/RentalLanding.tsx) |
| API composition | [`server/routers.ts`](../server/routers.ts) |
| API domain routers | [`server/routers/`](../server/routers/) |
| Database helpers | [`server/db.ts`](../server/db.ts) |
| Schema and migrations | [`drizzle/`](../drizzle/) |
| Browser flows | [`e2e/`](../e2e/) |
| Test suite | [`server/`](../server/) files ending in `.test.ts` or `.test.tsx` |
