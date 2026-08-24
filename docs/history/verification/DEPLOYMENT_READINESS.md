# Deployment Readiness — BOB Cranes Operations Portal

**Release status:** Ready for managed production publication after the release checkpoint is created.

## Verified production contract

| Area | Verified condition |
| --- | --- |
| Production build | `pnpm build` produces the browser bundle and server bundle successfully. |
| Runtime entrypoint | `pnpm start` runs `dist/index.js` with the platform-provided production environment. |
| Database schema | The `system_settings` table required by activity-retention governance exists in the connected database. |
| Authentication and access | Email/password local access, administrator controls, department scopes, and Client Portal return navigation have authenticated browser coverage. |
| Static assets | No deploy-blocking media files are stored under `client/public` or `client/src`. |
| Container configuration | No custom Dockerfile is required; the managed Node runtime can use the standard build and start contract. |

## Managed publication checklist

1. Create or select the latest verified checkpoint.
2. Use the project **Publish** control in the management interface.
3. Confirm the production URL loads the sign-in screen, authenticate as an administrator, and check the Operations Cockpit, Client Response Portal, and Department Users.
4. Configure the custom domain in **Settings → Domains** if required, then repeat the sign-in and Client Portal smoke checks on that domain.

## Environment and data note

>The managed project injects the database, authentication, storage, and platform runtime configuration. Do not commit local `.env` files or expose credentials in application code. Existing migrations should remain in version control so future environments can reproduce the schema.
