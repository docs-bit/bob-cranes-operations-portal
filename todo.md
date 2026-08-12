# Project TODO - PRD v3.0 Alignment & Handoff

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
- [ ] Save the verified data import-export checkpoint.
