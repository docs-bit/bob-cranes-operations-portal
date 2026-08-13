# Project TODO - PRD v3.0 & Crane App Archive Alignment

## Phase 2 & 3: Verification & Validation
- [x] Verify PRD v3.0 requirements against checkpoint bb8c0c51
- [x] Run test suite and production build verification
- [x] Confirm all 8 lifecycle stages, 6-step wizard, 10 department workspaces, client response portal, and lifting-gear hard blocks are fully operational

## Minimalist completion graph redesign
- [x] Replace the current stage graph presentation with a minimalist department-completion card inspired by the supplied reference.
- [x] Preserve computed department completion, dossier context, and status colors.
- [x] Validate the redesign at mobile and desktop widths without changing workflow behavior.
- [x] Save and deliver the updated UI checkpoint.

## Attendance workspace
- [x] Add dashboard attendance section with employee roster and daily status marking.
- [x] Support attendance statuses Present, On Leave, Assigned, and Off-Site with editable daily records.
- [x] Add previous-day date navigation and historical attendance review.
- [x] Add attendance summary counts and persist the selected date/state within the dashboard session.
- [x] Validate responsive attendance UI and save the updated checkpoint.

## Attendance persistence fix
- [x] Persist the selected attendance date in Home state so it survives navigation within the dashboard session.
- [x] Save a new checkpoint after the date-persistence fix.

## Department Excel upload center
- [x] Add a dedicated Data Upload Center entry to the dashboard navigation.
- [x] Add one Excel upload card for each operating department with accepted .xlsx/.xls file types.
- [x] Show upload status, file name, size, row count, last updated time, replace, and remove controls.
- [x] Add a department-wide upload summary and responsive layout.
- [x] Validate upload behavior, tests, and build; save a new checkpoint after final verification.

## Data import mapping and department exports
- [x] Add a visual source-column to required-system-field mapping step after workbook selection.
- [x] Validate required mappings and confirm the import only when the mapping is complete.
- [x] Add a downloadable Excel export action for every department dataset.
- [x] Validate desktop/mobile interactions, tests, production build, import confirmation, and downloaded department export.
- [x] Save the verified data import-export checkpoint.

## Saved column-mapping preferences
- [x] Save approved source-column mappings by department and source-header signature.
- [x] Reuse compatible saved mappings automatically for future department uploads.
- [x] Preserve the mapping review and block confirmation when source headers are missing or changed.
- [x] Add tests and verify the UI flow; save the mapping-preferences checkpoint.
- [x] Save the verified mapping-preferences checkpoint.

## Department account access and LinkedIn-inspired UI
- [x] Review the existing authentication, dashboard layout, and database schema for department-scoped email/password accounts.
- [x] Add admin-only registration and department-role assignment for new users.
- [x] Add email/password sign-in, session handling, and profile sign-out to return users to the login screen.
- [x] Restrict department navigation and workspace access according to the assigned department role.
- [x] Restyle the portal with a LinkedIn-inspired blue, white, and neutral visual system.
- [x] Ensure every sidebar navigation item has an understandable, accessible icon.
- [x] Add unit coverage and validate admin, department-user, sign-out, desktop, and mobile flows.
- [x] Save the verified authentication and theme checkpoint.
- [x] Restrict non-admin sidebar and workspace navigation to department-permitted sections, not only the Departments list.
- [x] Add view guards and tests proving department users cannot open unauthorized workspace or administration sections.
- [x] Re-verify the HSE account with the narrowed navigation and save the final checkpoint.

## User management, profile customization, and login feedback
- [x] Add admin user-management dashboard for viewing, editing, and deactivating department users.
- [x] Enhance the profile section with department details, role badge, and customizable avatar options next to sign-out.
- [x] Add login loading animations and clear error messaging for incorrect credentials.
- [x] Validate updated user management, profile customization, and login feedback with unit tests and browser tests.
- [x] Save and deliver the final user-management checkpoint.
- [x] Remove deprecated `expires` options from local/OAuth sign-out cookie clearing and rerun final checks.

## Admin safety, activity log, and role-based sidebar visibility
- [x] Add deactivation confirmation modal and success toast notification.
- [x] Implement account activity logging for sign-ins and profile updates with an admin activity viewer.
- [x] Tighten role-based sidebar and direct-view visibility so department users see only relevant tools.
- [x] Validate new modal safety, activity logs, and role permissions with unit tests and browser tests.
- [x] Save and deliver the final admin safety and activity-log checkpoint.
- [x] Add unit assertions for activity event creation during sign-in, profile update, and status changes.
- [x] Add focused unit-level assertions for deactivation confirmation safety and rerun the full validation suite.
- [x] Deliver the final admin safety and activity-log checkpoint attachment to the user.

## Search, CSV export, and header notifications
- [x] Add department filter dropdown and enhanced search inputs to the user-management dashboard.
- [x] Implement CSV export for the administrator activity log with audit headers.
- [x] Create an in-app header notification dropdown for profile updates and role changes.
- [x] Validate new search, export, and notification features with unit tests and browser checks.
- [x] Save and deliver the final search and notification checkpoint.

## Universal back button, supervisor accounts, department dashboards, and reference progress UI
- [x] Add universal back button/navigation across all departmental and administrative screens.
- [x] Update user model and roles to support department supervisors (admin can assign supervisors; supervisors can register and manage users solely within their own department).
- [x] Build individual dedicated dashboards for all operating departments linked to the flawless 8-stage booking workflow.
- [x] Restyle progress bars and step indicators exactly matching the supplied dark/green reference visual style.
- [x] Add unit tests and verify end-to-end authorization, supervisor management, and workflow integration.
- [x] Save checkpoint and deliver the fully updated portal.

## Follow-up gaps discovered during final validation
- [x] Wire every department portal to a real lifecycle action or explicitly document why a department is read-only; persist transition notifications on handoff.
- [x] Add tests and/or browser verification for the full supervisor workflow: admin creates supervisor, supervisor login, supervisor-only same-department user creation/edit/deactivation, cross-department denial.
- [x] Add workflow integration coverage for department dashboard handoff actions and notification generation.
- [x] Save and deliver a new checkpoint for the supervisor and department-portal release.

## Final end-to-end supervisor release verification
- [ ] Run a real browser flow in which an administrator creates or assigns a supervisor, the supervisor signs in, and the supervisor creates, edits, deactivates, and is denied access to another department’s user.
- [ ] Save and deliver the final checkpoint after the supervisor and workflow fixes.

## Progress UI and button interaction repair
- [x] Reproduce and diagnose why the reference-style progress bar and related UI are not visibly changed in the rendered portal.
- [x] Identify and fix shared button handlers, stale DOM targets, disabled states, and runtime errors affecting navigation and workflow controls.
- [x] Re-verify progress visuals and interactive controls at desktop and mobile widths, then run unit tests, type check, and production build.
- [x] Save and deliver the repaired portal checkpoint.

## Final repair release gaps
- [x] Re-verify the repaired progress UI and key interactive controls at a true mobile viewport after the latest fixes, and record the result.
- [x] Save a new checkpoint after the progress/button repair changes and deliver that updated checkpoint to the user.

## Attendance, multi-booking assignment, and onshore/offshore training register
- [x] Profile the supplied ONSHORE&OFFSHORE.xlsx workbook and extract certificate/training records.
- [x] Build a database-backed or structured training register reflecting the Excel dataset.
- [x] Add employee attendance marking with daily records and history navigation.
- [x] Implement multi-booking employee assignment with overlap / conflict detection and clear warnings.
- [x] Add unit tests, type checks, responsive visual QA, and save checkpoint.

## Attendance and allocation release hardening
- [x] Persist multi-booking employee allocations through the backend using real crew and booking records, with overlap warnings derived from persisted data.
- [x] Run mobile visual QA for Attendance, Crew multi-booking, and Training Register screens and record the results.
- [x] Save a new checkpoint covering the attendance, allocation, and workbook-backed training release.
- [x] Add direct deep links for the Training Register and Crew allocation workspace so preview capture and browser refreshes do not fall through to 404.
- [x] Add a visual calendar view for crew assignments so I can easily see overlaps and schedules.
- [x] Add filtering options to the notification dropdown so users can sort alerts by urgency or department.
- [x] Create a dashboard widget that highlights employees with expiring training certificates based on the onboarded dataset.
- [x] Add employees data from attached Excel sheet (from August 2026 only).
- [x] Add all employees from OP AUG 2026, HELP AUG 2026, WORKSHOP AUG 2026, and OFFICE AUG 2026 tabs to the attendance roster.
- [x] Add a 'Clear All' or 'Mark as Read' control inside the notification dropdown.
- [x] Make employees in the expiring certificates widget clickable to view their full profile and training details.
- [x] Add an option to export the visual crew assignment calendar to PDF or Excel.
- [x] Fix duplicate React keys in training and calendar views (`EMP ID-B-368 & 300 TON`).
- [x] Implement hover tooltips on the visual crew assignment calendar to show quick details about assigned tasks and crew members.
- [x] Create a monthly summary report feature for attendance showing total days worked and absences for each employee.
- [x] Add a search bar and department filter to the attendance roster to easily find specific employees.
- [x] Eliminate duplicate key warnings for roster entries like GURPREET SINGH by using index-inclusive stable keys.
- [x] Eliminate duplicate key warnings for roster entries like GURPREET SINGH by using index-inclusive stable keys.
- [x] Restyle all progress graphs and dashboard surfaces into a light, clinical analytics system inspired by the reference references (airy cards, pale mint/green progress bars, clean KPI modules, and bar-chart progress indicators).
- [x] Audit and convert all remaining legacy progress visuals, including ReferenceUploadProgress, upload-center progress, booking-card meters, and department/client progress rails, to the new light analytics system.
- [ ] Run authenticated desktop and mobile browser QA on the dashboard and key department/client views and record consistent rendering evidence.
- [x] Diagnose and repair the black-screen rendering regression, ensure zero runtime errors in console/server logs, and verify the UI.
- [x] Convert remaining legacy progress UI in DataUploadCenter and any booking-card/department meters, then rerun a code audit for old progress classes.
- [ ] Run authenticated desktop and mobile QA on the actual dashboard and key department/client views.
- [ ] Reproduce the black-screen scenario on an authenticated route, identify the actual rendering cause, and verify fresh logs have no current runtime errors.
- [ ] Perform authenticated browser verification after the black-screen fix.
