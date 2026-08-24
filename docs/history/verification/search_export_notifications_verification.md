# Search, CSV export, and notification verification

## Administrator checks

The administrator Department Users view exposed account search, department and status filters, and the `Export CSV` action. Selecting `HSE / Safety` narrowed the account list to the HSE staging user. Exporting the activity log produced the success toast `Activity CSV downloaded — 4 audit events exported.` The administrator notification dropdown also rendered the empty state `All caught up` / `No new notifications.`

## Role editor and staged-user notification check

The administrator editor exposed both `Department user` and `Administrator` role choices. Saving the staged HSE user as `Administrator` completed successfully, showed `HSE Staging User was updated successfully.`, and rendered the account as `Administrator`. The account was then restored to `Department user` in `HSE / Safety` with a temporary verification password so the test did not leave the staging user elevated.

After signing out, the staged HSE account signed in successfully with its department-scoped sidebar. Opening the header notification dropdown showed `2 new` alerts. Both targeted `Your profile or role was updated` notifications were visible: one for the temporary `Administrator` change and one for the restored `Department user` / `HSE / Safety` state. This confirms the new role-aware notification path is working in the browser.

## Automated validation

`pnpm check` passed, `pnpm test` passed with 26 tests across 8 files, and `pnpm build` completed successfully. The only build note is the existing Vite chunk-size warning.
