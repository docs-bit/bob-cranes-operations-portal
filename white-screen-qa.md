# White-screen repair verification

## Root cause and repair

The reported white presentation was reproduced as a **transient authentication-loading state**, not as an active client or server exception. The previous application shell rendered only the text `Loading secure workspace…` against a largely white surface while the session query completed. The repaired shell now presents a branded loading card, progress spinner, access-check explanation, and a retry action after 3.2 seconds.

## Fresh isolated signed-out evidence

An isolated preview capture of `/login` completed after the repair and displayed the complete **Sign in to BOB Cranes** form with work-email and password fields. This preview capture uses the unauthenticated preview context, distinct from the persistent browser's active administrator session.

## Authenticated and client evidence

The persistent browser reloaded the authenticated dashboard successfully after the branded loading card, then loaded the public client portal successfully. The current browser-console capture contained only Vite connection and React DevTools informational messages; no runtime exceptions were recorded. The development server was running normally after the repair.

## Automated validation

The dedicated `appLoading.test.ts` asserts the branded card and retry control. The complete regression suite passed with 54 tests, and the production build completed successfully.
