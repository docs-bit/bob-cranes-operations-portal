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
- [x] Run a real browser flow in which an administrator creates or assigns a supervisor, the supervisor signs in, and the supervisor creates, edits, deactivates, and is denied access to another department’s user.
- [x] Save and deliver the final checkpoint after the supervisor and workflow fixes.
- [x] Save and report a checkpoint containing the completed supervisor denial verification, authenticated mobile captures, QA record, and final validation results.
- [x] Create auditable temporary supervisor and department-user accounts for the authorized end-to-end browser QA scenario.
- [x] Capture authenticated mobile-route evidence or document the browser-session limitation with reproducible findings.
- [x] Attempt and record a live supervisor-session update or status change against an existing non-HSE account, confirming the forbidden response.

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
- [x] Run authenticated desktop and mobile browser QA on the dashboard and key department/client views and record consistent rendering evidence.
- [x] Diagnose and repair the black-screen rendering regression, ensure zero runtime errors in console/server logs, and verify the UI.
- [x] Convert remaining legacy progress UI in DataUploadCenter and any booking-card/department meters, then rerun a code audit for old progress classes.
- [x] Run authenticated desktop and mobile QA on the actual dashboard and key department/client views.
- [x] Reproduce the black-screen scenario on an authenticated route, identify the actual rendering cause, and verify fresh logs have no current runtime errors.
- [x] Perform authenticated browser verification after the black-screen fix.

## Assignment edit and complete control responsiveness audit
- [x] Repair the Assignment edit control so it opens the edit state, saves changes, and refreshes assigned crew data with visible feedback.
- [x] Audit all visible portal controls for missing handlers, dead navigation, silent errors, incorrect disabled states, and missing loading/success/error feedback; repair each verified issue.
- [x] Add automated coverage for the Assignment edit interaction and repaired control feedback paths.
- [x] Run authenticated Assignment and full-control browser QA, then save a checkpoint after tests and build pass.
- [x] Run and document a comprehensive authenticated browser QA sweep of major controls and flows, then save a verified checkpoint.
- [x] Verify and record authenticated behavior for Documents & Compliance, Lifting Gears, each remaining department portal, Department Users, and Client Portal Preview.
- [x] Confirm the QA verification record is saved and save a verified checkpoint after the full control sweep.

## Assignment repair follow-up gaps
- [x] Bind BookingDetail assigned-crew rendering to persisted allocations and show saved-assignment feedback when returning from CrewView.
- [x] Replace or remove remaining misleading toast-only visible controls, including More actions, admin utility entries, and certificate viewing.
- [x] Add UI/integration coverage for Edit assignment -> focused CrewView -> save allocation -> updated dossier crew state.

## Full attendance roster in Crew Assignment
- [x] Replace the demonstration crew list with all employees from the August attendance roster while retaining identity and allocation compatibility.
- [x] Make employee search, department filters, availability, and allocation scheduling work across the full imported roster.
- [x] Add coverage proving all attendance employees are available in Crew Assignment and existing persisted allocations still resolve correctly.
- [x] Validate the roster-integrated assignment workspace, tests, build, and checkpoint the release.

## Full roster follow-up validation gaps
- [x] Bind attendance-backed Crew Assignment availability to real attendance-derived status data instead of defaulting imported employees to Present.
- [x] Add a real UI/integration test proving the full attendance roster is surfaced and persisted allocations hydrate correctly in Crew Assignment.
- [x] Revalidate the roster workspace and save a new post-integration checkpoint.
- [x] Save the verified post-integration Crew Assignment roster checkpoint.

## White-screen regression repair
- [x] Reproduce the current white-screen route and capture the client/server runtime failure.
- [x] Repair the rendering failure without regressing the attendance-backed Crew Assignment workspace.
- [x] Verify clean sign-in, client portal, and authenticated app-shell renders; run tests/build and save a checkpoint.

## White-screen repair validation gaps
- [x] Document fresh browser and server evidence that distinguishes the transient loading state from a runtime exception.
- [x] Verify the signed-out sign-in route after the loading-state repair alongside authenticated and client views.
- [x] Capture a fresh isolated signed-out /login render and save the dedicated loading-state repair checkpoint.
- [x] Save a dedicated checkpoint for the verified white-screen/loading-state repair.
- [x] Record fresh isolated signed-out /login render evidence and revalidate the loading-state repair checklist.

## Lifting gear document and validity tracking
- [x] Add document selection and upload handling to the new lifting-gear entry workflow.
- [x] Capture each uploaded gear document’s validity end date and show its status in the inventory.
- [x] Preserve hard-blocking of expired gear documents during booking selection and add automated validation coverage.
- [x] Verify the new gear-document form flow, run tests/build, and save a checkpoint.
- [x] Register and verify the authenticated `/gear` route so the lifting-gear document workflow is reachable by direct link.

## Lifting gear document workflow follow-up gaps
- [x] Wire newly added gear records into booking-wizard selection and block expired document records from selection there.
- [x] Add UI/integration coverage proving an expired uploaded gear cannot be selected for a booking.
- [x] Complete final gear-document browser verification and save a post-release checkpoint.

## Transportation fleet workbook integration
- [x] Inspect and normalize all vehicle records from the supplied vehicle workbook.
- [x] Replace the Transportation demonstration fleet list with the complete imported vehicle inventory and searchable operational fields.
- [x] Add regression coverage for vehicle count, unique identity handling, filters, and Transportation workspace rendering.
- [x] Verify the imported fleet in the Transportation UI, run tests/build, and save a checkpoint.

## Supervisor audit, dispatch bundles, and activity-log governance
- [x] Add a dedicated supervisor-permissions audit screen to the Operations Cockpit with department scope, account status, permission summary, and audit evidence.
- [x] Add on-demand PDF dispatch-bundle generation from eligible booking dossiers with role-safe access and a user download flow.
- [x] Add configurable activity-log retention settings with safe purge controls and clear audit feedback.
- [x] Add date-range filters to activity-log viewing and CSV export.
- [x] Harden the activity date-range controls so incomplete or malformed typed date values do not issue a failed audit query.
- [x] Add automated coverage, responsive browser verification, and a checkpoint for the governance and dispatch-bundle release.

## Client response portal navigation repair
- [x] Add a visible back control to return from the Client Response Portal to the Operations Cockpit.
- [x] Verify the return path in the authenticated client portal, run focused regression validation, and save a checkpoint.

## Deployment-ready release
- [x] Audit deployment configuration, production dependencies, schema migration state, and protected runtime paths.
- [x] Resolve any release-readiness gap and document deployment-specific configuration or operational requirements.
- [x] Run final TypeScript, focused regression, production-build, and authenticated smoke validation.
- [x] Save a deployment-ready checkpoint and provide the in-product publication handoff steps.

## Dispatch progress and Client Portal feedback
- [x] Add a visible loading spinner and staged progress indicator during on-demand PDF dispatch-bundle generation.
- [x] Add document search and sorting controls to the Client Response Portal.
- [x] Add a lightweight Client Portal feedback form for bug reports with secure persistence and administrator review support.
- [x] Add automated coverage, authenticated browser verification, and a checkpoint for the client-experience release.

## Dashboard greeting correction
- [x] Replace Nishanth with Admin in the Operations Cockpit greeting and verify the authenticated view.

## Industrial equipment portal theme
- [x] Translate the supplied high-contrast industrial equipment reference into accessible portal color, type, surface, and motion tokens.
- [x] Restyle shared authenticated navigation, dashboard modules, controls, tables, dialogs, and progress states without changing workflows.
- [x] Restyle the sign-in and secure-loading surfaces to match the industrial visual system.
- [x] Add targeted theme regression coverage and validate the restyle on authenticated desktop and mobile views.
- [x] Save a verified checkpoint for the industrial theme release.

## Operations Cockpit header refinement
- [x] Remove the Back control from the Operations Cockpit overview header only while preserving it on all other views.

## Light equipment-operations theme replacement
- [x] Translate the supplied light equipment-dashboard reference into accessible color, typography, surface, and control tokens.
- [x] Replace the current industrial dark command theme across navigation, dashboard modules, data workspaces, controls, and progress states.
- [x] Restyle sign-in and loading surfaces to match the light equipment-operations system.
- [x] Add focused regression coverage and validate authenticated desktop plus responsive mobile views.
- [x] Save a verified checkpoint for the completed theme replacement.

## Light theme foreground contrast
- [x] Change primary and currently faint dossier text to black across the light portal theme while retaining a readable secondary hierarchy.

## Supplied BOB Cranes logo
- [x] Host the supplied BOB Cranes logo as a deployment-safe static asset and replace existing generated brand marks.
- [x] Apply the supplied logo consistently in the portal navigation and sign-in experience with responsive sizing and accessible alternative text.
- [x] Add focused coverage, validate browser rendering, and save the verified logo update checkpoint.

## Header dossier search repair
- [x] Reproduce and repair the Operations Cockpit header dossier search so matching bookings can be found and opened reliably.

## Coordinated Crew Assignment availability
- [x] Derive Crew Assignment availability and Assigned filtering from persisted booking allocations so only allocated employees show Assigned.

## Crew allocation visibility and page-local search
- [x] Show each assigned employee’s booking IDs next to their assigned status and add allocation-count badges in Crew Assignment.
- [x] Derive and display active versus upcoming booking assignment availability using booking mobilization and off-hire dates.
- [x] Audit every portal search control and ensure it filters only the data rendered by its current page, with useful matching details.
- [x] Add coverage, validate the integrated interactions, and save a verified checkpoint.

## Reusable portal-refinement skill and crew enhancements
- [x] Create and validate a reusable skill for safe, tested portal refinements using the workflow established in this project.
- [x] Add a calendar-date selector that filters Crew Assignment availability by a selected date.
- [x] Make Crew Assignment booking-ID chips open their corresponding booking dossier.
- [x] Add saved local search presets for the Crew Assignment workspace.
- [x] Make Edit Assignment support selecting available and already-assigned employees for the active booking.
- [x] Add regression coverage, verify integrated behavior, and save the completed release checkpoint.

## Bulk Crew Assignment and conflict timeline
- [x] Enable selecting multiple crew members and assigning them to the focused booking in one saved action.
- [x] Display a visual conflict timeline for selected crew before bulk assignment is saved.
- [x] Extend and validate the portal-refinement-release skill with bulk assignment and conflict-timeline guidance.
- [x] Add focused coverage, verify the integrated workflow, and save the completed release checkpoint.

## Final ship-readiness verification
- [x] Run current focused operational regression tests, TypeScript validation, production build, and runtime log review.
- [x] Resolve any release-blocking issue and save a verified ship-ready checkpoint.

## Crew CSV export, booking tooltips, and production monitoring
- [x] Add a CSV export for the current Crew Assignment schedule and its active page filters.
- [x] Add accessible booking-detail hover tooltips to Crew Assignment booking-ID chips.
- [x] Add safe production runtime error monitoring and validate the capture path without exposing sensitive data.
- [x] Extend and validate the portal-refinement-release skill for exports, tooltips, and runtime monitoring.
- [x] Add focused coverage, complete release validation, and save a verified checkpoint.

## Configurable Crew CSV export
- [x] Add a modal that lets users select which current Crew Assignment fields to include in a CSV export.
- [x] Add an export-button loading spinner and disabled state during CSV generation.
- [x] Extend and validate the portal-refinement-release skill for configurable export selection and feedback.
- [x] Add focused coverage, verify the export flow, and save a verified checkpoint.

## Administrator-provisioned department dashboards
- [x] Provision a distinct department dashboard configuration whenever an administrator creates a department.
- [x] Link department navigation and authorized users to the appropriate department-specific operational dashboard.
- [x] Add automated coverage for dashboard provisioning and access isolation, then save a verified checkpoint.

## BOB Heavy Equipment Rental landing page and department lifecycle controls
- [x] Analyze the supplied landing-page reference and establish an accessible responsive visual system for BOB Heavy Equipment Rental.
- [x] Create a polished public BOB Heavy Equipment Rental landing page with equipment categories, fleet capabilities, safety/service proof points, enquiry actions, and portal sign-in access.
- [x] Add supervisor-editable department dashboard widgets with permission-safe metric and layout controls.
- [x] Add a safe department archive and reactivation workflow that preserves assigned users, dashboards, and operational history.
- [x] Add department-level workflow templates with required-document checklists and assigned-user guidance.
- [x] Add focused tests, responsive visual verification, database migration validation, and a production checkpoint.

## User-supplied BOB Cranes landing photographs
- [x] Host the supplied BOB Cranes project images as deployment-safe landing-page assets.
- [x] Replace the external stock landing photography with the supplied BOB project photographs in responsive hero and capability compositions.
- [x] Verify desktop/mobile presentation, run production validation, and publish the visual update.

## Rental quote follow-up and visual refinement
- [x] Create a Sales follow-up notification whenever a public rental quote is submitted, with the submitted enquiry summary visible to authorised Sales users.
- [x] Remove the overlapping landing-page header/brand treatment and use the newly supplied BOB visual assets in the appropriate landing placements.
- [x] Add focused notification coverage, verify desktop/mobile layout, validate the production build, and publish the release.

## Sales enquiry inbox and quote-conversion workflow
- [x] Add an access-controlled Sales enquiry inbox with request status filtering, supervisor assignment, and a detailed enquiry view.
- [x] Add a one-click, traceable enquiry-to-booking conversion flow that carries verified quote details into a new sales booking.
- [x] Add real-time field validation and an explicit submitted-success state to the public quote form.
- [x] Replace the specified Transport & Support landing visual treatment with the supplied BOB bridge-lift imagery and add a landing-page return control to login.
- [x] Add focused permission/workflow coverage, responsive visual verification, production validation, and a published checkpoint.

## Reference-inspired BOB rental landing redesign
- [x] Analyze the supplied long-form excavation-services reference and adapt its conversion hierarchy for BOB Heavy Equipment Rental.
- [x] Rebuild the public landing-page layout with compact navigation, operational proof, services, project showcase, process, coverage, estimate CTA, and an industrial footer.
- [x] Preserve working quote submission, Sales notifications, responsive layout, and portal access throughout the redesign.
- [x] Complete desktop/mobile visual verification, functional validation, production build, and a published checkpoint.

## Supplied full BOB logo replacement
- [x] Host the supplied “BOB Lifting Your Expectations” logo as a durable deployed asset.
- [x] Replace existing BOB logo marks with the supplied full logo across public, portal, and sign-in branding surfaces.
- [x] Verify responsive logo sizing and publish the visual-branding update.

## Branded dispatch and quote documents
- [x] Add the supplied full BOB logo to generated dispatch-bundle PDFs and quote documents without altering operational document content.
- [x] Verify document generation and branded header rendering with focused coverage and production validation.
- [x] Create and validate a reusable skill for safe full-logo updates across web and generated-document surfaces.

## Dashboard greeting refinement
- [x] Replace “Good morning” with “Hello” in the Operations Portal dashboard greeting and publish the verified text update.

## Personalized dashboard greeting and daily summary
- [x] Display the signed-in user’s preferred name in the Operations Cockpit greeting.
- [x] Add a concise daily operations summary directly below the dashboard greeting using live booking and compliance data.
- [x] Add an administrator-managed, persistent dashboard greeting-text setting with clear save and reset behavior.
- [x] Add focused validation, run the full release checks, and publish the dashboard personalization update.

## Rental estimate email action
- [x] Make the public “Get a rental estimate” call-to-action open a pre-addressed email to admin@bobcranes.ae and publish the verified update.

## Rental estimate email template
- [x] Pre-fill the rental-estimate email body with a standard request template including equipment type and rental duration fields, then publish the verified update.

## Rental estimate and enquiry enhancement
- [x] Show a toast when the rental-estimate action opens the visitor’s email client.
- [x] Pre-fill the rental-estimate email with authenticated contact details and selected equipment when the visitor has an active portal session.
- [x] Add selectable rental duration and equipment type controls to the public enquiry form and persist the selections in the Sales workflow.
- [x] Create and validate a reusable skill for safe rental-enquiry and mailto call-to-action enhancements.
- [x] Add focused coverage, run release validation, and publish the completed enhancement.

## Sales response visibility and profile contact details
- [x] Add optional company and phone fields to user profiles for authenticated rental-estimate email prefill.
- [x] Display rental duration in the Sales enquiry table and selected-enquiry detail modal.
- [x] Add a visual dashboard badge for public rental enquiries that are not yet assigned to a Sales owner.
- [x] Add focused coverage, complete release checks, and publish the response-visibility update.

## Final ship-readiness verification
- [x] Re-validate the latest published portal build, inspect current runtime signals, and publish a final ship-readiness checkpoint.
