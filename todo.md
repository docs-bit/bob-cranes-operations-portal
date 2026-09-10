
- [x] Reconcile missing production schema fields for `equipment`, `lifting_gears`, `trailers`, and `bookings`, then rerun production validation.
- [x] Reconcile missing authentication schema fields for `users` (`mustChangePassword` and `credentialsRevokedAt`) and verify `auth.setupStatus` returns successfully.
- [x] Revalidate the current build with tests, TypeScript checks, production build, HTTP smoke checks, and route screenshots.
- [x] Save a fresh checkpoint for the current ship-ready build.

### Release notes
- Unit tests: 170 passed across 60 files.
- TypeScript: clean.
- Production build: successful.
- HTTP smoke checks: `/`, `/portal`, and `/api/trpc/auth.me` returned 200.
- Authentication setup status: `needsAdminSetup: false`.
- Startup expiry check: 0 certificate alerts created.
