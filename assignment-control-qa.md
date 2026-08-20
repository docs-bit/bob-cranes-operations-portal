# Assignment and Control Responsiveness QA

## Scope

This pass repaired the Booking Dossier `Edit assignment` flow, audited visible controls, and added feedback for persisted assignment changes.

## Implemented checks

- `BookingDetail` now hands the selected dossier ID to `CrewView` through `focusedBookingId`.
- `CrewView` moves the requested dossier to the top of the allocation list and preselects the first persisted employee assigned to that dossier.
- Persisted allocation saves and removals report success or failure and notify the parent shell.
- The dossier Assigned crew panel reads from persisted `allocations` and shows an Assignment updated confirmation when returning from the editor.
- The universal Back action returns from a focused Crew editor to the originating dossier.
- The global search pill opens the Booking Dossiers workspace.
- The More actions control opens a role-aware action menu.
- Add gear opens a validated asset-entry dialog; View certificate opens a certificate preview dialog.
- Wizard crane filters change the visible crane list and nested Select controls have direct handlers.
- Add workman routes authorized supervisors/admins to Department Users and explains access restrictions otherwise.
- Documents Upload opens an actionable dossier when one exists.

## Automated verification

- 13 Vitest files passed.
- 50 tests passed.
- Production build passed with Vite and server bundle generation.
- TypeScript watch reported zero errors after the final edits.
- Assignment tests cover focus ordering, employee preselection, source-level UI wiring, and assign/remove allocation transitions.
- A real jsdom React integration test clicks Assign and Remove in `CrewView`, verifies the persisted payload (`BOB-59116`), and confirms parent feedback updates after each action.

## Browser smoke verification

- Root sign-in surface rendered.
- Client response portal rendered with booking progress and assigned crew.
- `/crew` correctly resolved to the secure sign-in surface when unauthenticated.
- `/gear` is not a registered direct route; Gear is accessed through the authenticated sidebar state. This is not a runtime crash.
- Fresh browser logs showed Vite connection and React DevTools informational messages; no new application exception was observed after the final edits.

## Remaining validation

A real authenticated browser click-through of the complete shell, supervisor management, and authenticated mobile dashboard still requires an administrator session in the persistent browser. The core Assignment interaction itself is now covered by the jsdom React integration test, and the open sign-in screen remains available for takeover.
