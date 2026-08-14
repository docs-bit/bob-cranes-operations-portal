# BOB Cranes Operations Portal — Authenticated QA Record

**Verification date:** 14 August 2026  
**Verified role:** Administrator  
**Environment:** Managed development preview

## Scope and outcome

This record captures the final authenticated browser sweep performed after the transportation-fleet release. The administrator session resolved from the branded secure-workspace loader into the Operations Cockpit without a blank screen or current client-side error. The dashboard displayed the active dossier queue, lifecycle analytics, attendance widget, training-alert widget, and operational activity feed.

| Area | Verification performed | Result |
| --- | --- | --- |
| Operations Cockpit | Opened the authenticated dashboard and inspected lifecycle KPIs, progress chart, dossier cards, attendance controls, certificate alerts, and departmental activity. | Pass |
| More actions | Opened the action menu and used **Open dossier queue**. | Pass — routed to the live Booking Dossiers queue. |
| Booking Dossiers | Confirmed nine dossier rows render with client, crane/site, lifecycle stage, document completion, and mobilisation date. | Pass |
| Notifications | Opened the header notification drawer and confirmed the **Mark all read** action and urgency/department filter controls render. | Pass |
| Training Register | Opened the imported register and confirmed employee search, workstream/status filters, employee profile selection, and certificate rows render. | Pass |
| Attendance | Opened the August attendance workspace and confirmed historical navigation, search, department filter, status selectors, and monthly-summary entry point render for the complete 174-person roster. | Pass |
| Excel Data Uploads | Opened the department upload centre and confirmed all ten department cards, workbook inputs, and export-template controls render. | Pass |
| Documents & Compliance | Opened the live compliance page and verified the cross-department completion view, ready-for-review items, revision-watch metrics, and upload entry control. | Pass |
| Lifting Gear Inventory | Opened the live gear register and verified Add gear, filter controls, certificate previews, expiry dates, and the visible blocked-selection state for an expired inspection record. | Pass |
| Department portals | Opened Sales, Documentation, Lifting Gears/Engineering, Maintenance, Crew/Workmen Assignment, HSE, Accounts, HR, Transportation, and Administrator portals. Each displayed its assigned stage gate, department queue, working procedure, and handoff rule. | Pass |
| Transportation fleet | Confirmed the Transportation portal renders the full 533-record register, search and status/type filters, pagination, export control, and transport workstream queue. | Pass |
| User management | Opened the admin User & Supervisor Management workspace and confirmed CSV export, account-creation form, department/role selectors, search, status filtering, activity log, and account listing render. | Pass |
| Client response portal | Opened the secure client portal, then verified booking summary, required-document status/upload surface, and the team chat with Documentation, HSE, Sales, Accounts, and Operations routing. | Pass |

## Rendering and access observations

The in-browser authenticated desktop sweep was successful. The standalone responsive capture service is intentionally unauthenticated and therefore displayed the sign-in page for the requested mobile routes; it cannot be used as evidence of an authenticated mobile workspace without an authenticated mobile session. This is an **access-evidence limitation**, not a rendering failure.

The supervisor end-to-end browser scenario remains separately outstanding because it requires logging out of the active administrator session and signing in with a dedicated department-supervisor account. It must cover supervisor creation or assignment, same-department user creation/edit/deactivation, and a denied cross-department management attempt. No mutating lifecycle, user, or client-document action was intentionally triggered during this data-preserving sweep; each associated interface, precondition, and route was verified instead.

## Conclusion

>The authenticated administrator control sweep confirms that the dashboard, navigation shortcuts, notification controls, dossier queue, documents/compliance, lifting-gear register, all department workspaces, Transportation fleet, User Management, Training Register, Attendance, Excel Data Uploads, and Client Response Portal are responsive and route to their intended live interfaces. The remaining QA work is limited to authenticated-mobile evidence and the deliberately role-specific supervisor sign-in scenario.
