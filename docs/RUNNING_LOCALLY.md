# Running BOB Cranes Operations Portal locally

This guide starts a local development copy of the BOB Cranes Operations Portal. It is intended for development, evaluation, and automated testing. It does **not** describe how to modify the live production database or create production credentials.

## What you need

| Requirement | Why it is needed | Check it with |
|---|---|---|
| Node.js 22 or a compatible current runtime | Runs Vite, Express, TypeScript tooling, and the application. | `node --version` |
| Corepack and pnpm 10 | Uses the repository’s pinned package-manager workflow. | `corepack --version` and `pnpm --version` |
| MySQL-compatible database | Stores users, enquiries, bookings, assets, documents, and operational records. | A reachable database connection string. |
| Git | Clones the repository and keeps the local copy current. | `git --version` |
| Chromium, optional | Required only for the Playwright browser smoke suite. | Installed by the Playwright command below. |

The repository’s GitHub Actions workflow and Docker configuration use Node.js 22. Keeping local development on that major version reduces environment drift.

## 1. Clone the repository

```bash
git clone https://github.com/docs-bit/bob-cranes-operations-portal.git
cd bob-cranes-operations-portal
```

If the project has already been cloned, update it before installing or running:

```bash
git switch main
git pull --ff-only origin main
```

## 2. Install dependencies from the lockfile

```bash
corepack enable
pnpm install --frozen-lockfile
```

`--frozen-lockfile` ensures that the installed dependency graph matches the committed `pnpm-lock.yaml`. If it fails, do not delete or manually edit the lockfile; first confirm that the local checkout is on the intended branch and has no uncommitted dependency changes.

## 3. Create the local environment file

```bash
cp .env.example .env
```

Edit `.env` and set the required values. Use a local or disposable database, never a production connection string.

```dotenv
DATABASE_URL=mysql://local_user:local_password@127.0.0.1:3306/bob_cranes_local
JWT_SECRET=replace-with-a-long-random-local-secret
NODE_ENV=development
PORT=3000
```

You can generate a local JWT secret with:

```bash
openssl rand -base64 48
```

| Variable | Required | Notes |
|---|---:|---|
| `DATABASE_URL` | Yes for the persistent portal | Must point to a MySQL-compatible local or disposable database that the application can reach. |
| `JWT_SECRET` | Yes for local sign-in | Use a long random value. Do not reuse a production value. |
| `NODE_ENV` | Recommended | Keep `development` for the local server. |
| `PORT` | Optional | Defaults to `3000` when omitted. |
| `SAMPLE_DB_PASSWORD` | Optional | Local-only password for the demonstration-data seeder. |
| `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID` | Optional | Set both values only when intentionally using analytics locally. |

The project can start without optional OAuth integration values. A local terminal may log that `OAUTH_SERVER_URL` is not configured; this is expected when the optional OAuth integration is not enabled and does not prevent the public landing page or local-auth flow from starting.

## 4. Create the schema in a local database

After confirming that `DATABASE_URL` targets the local database, run:

```bash
pnpm run db:push
```

This command generates Drizzle migration artifacts when required and applies migrations to the database selected by `DATABASE_URL`. Review any new files under `drizzle/` before committing them.

> Do not run `pnpm run db:push` against a production or shared database. For reviewed production migrations, the correct apply-only command is `pnpm exec drizzle-kit migrate`; see the [operations guide](OPERATIONS.md).

## 5. Start the local application

```bash
pnpm run dev
```

The expected terminal message is similar to:

```text
Server running on http://localhost:3000
```

Open these routes in a browser:

| URL | Expected result |
|---|---|
| `http://localhost:3000/` | Public BOB Cranes rental landing page. |
| `http://localhost:3000/portal` | Portal entry. An empty database presents the first-administrator setup state. |
| `http://localhost:3000/login` | Local sign-in route. |
| `http://localhost:3000/api/trpc/auth.setupStatus?input=%7B%22json%22%3Anull%7D` | Read-only JSON response describing whether first-admin setup is still required. |

## 6. Create the first local administrator

For a database with no users, open [http://localhost:3000/portal](http://localhost:3000/portal). Complete the first-administrator setup with a local work email and a secure local password. This bootstrap route is available only while no local accounts exist.

After an administrator exists, use the portal’s authorised account-management flow for subsequent users. Do not reset or delete user data merely to re-expose the first-administrator form on a database that contains operational records.

## Optional: load demonstration data

A coherent demo dataset is available only for empty or disposable local environments:

```bash
SAMPLE_DB_PASSWORD='local-demo-password' pnpm run db:seed:sample
```

The seeder adds sample users, departments, fleet, crew, lifting gear, trailers, bookings, documents, notifications, enquiries, dashboards, and governance records. It must never be run against production, staging with real data, or any shared environment.

## Verify the local application

Use these non-destructive checks while `pnpm run dev` is running:

```bash
curl --fail --silent --show-error http://localhost:3000/ > /dev/null

curl --fail --silent --show-error \
  'http://localhost:3000/api/trpc/auth.setupStatus?input=%7B%22json%22%3Anull%7D'
```

Both commands should complete successfully. Then check the public landing page and the portal entry state in a browser.

## Run quality checks

```bash
# TypeScript
pnpm run check

# Unit and integration tests
pnpm test

# Production client and server bundle
pnpm run build

# Browser smoke tests; install Chromium once on a new machine
pnpm exec playwright install chromium
pnpm run test:e2e
```

The browser smoke suite starts its own local test server and does not create or modify production data.

## Troubleshooting

| Symptom | Likely cause | Safe next step |
|---|---|---|
| `pnpm` is not found | Corepack is disabled or pnpm is missing. | Run `corepack enable`, then repeat the install command. |
| Database connection or migration error | `DATABASE_URL` is invalid, unreachable, or points to a database the user cannot access. | Verify host, port, database name, and credentials; use a local/disposable database. |
| Port `3000` is already in use | Another local process is running on the default port. | Stop that local process or set an unused `PORT` value in `.env`. |
| OAuth configuration warning | Optional OAuth variables are intentionally absent. | Continue with the local landing and local-auth flow, or configure OAuth only when required. |
| Playwright cannot launch Chromium | The browser binary has not been installed. | Run `pnpm exec playwright install chromium`, then rerun the test. |
| First-admin form is not shown | The database already has at least one local user. | Sign in with an existing account or use an intentionally empty disposable database. |

## Stop the server

Press `Ctrl+C` in the terminal that is running `pnpm run dev`.

## Production boundary

Running locally does not automatically change the production portal. The live release path, production migration policy, smoke checks, and rollback procedure are documented separately in the [operations guide](OPERATIONS.md) and [production-readiness runbook](PRODUCTION_READINESS.md).
