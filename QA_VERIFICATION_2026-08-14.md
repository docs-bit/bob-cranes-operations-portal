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

The in-browser authenticated desktop sweep was successful. The standalone responsive capture service is intentionally unauthenticated and therefore displayed the sign-in page for the requested mobile dashboard and Attendance routes; it did, however, render the public Client Response Portal at 375 × 812 without layout failure. To close the protected-route evidence gap, the active authenticated browser session was captured at **375 × 812**. Both the Operations Cockpit and HSE / Safety workspace rendered with a compact icon navigation rail, readable headings and KPI cards, visible back/notification/more controls, and no blank-screen, clipped primary action, or horizontal-overflow issue in the captured viewport.

## Supervisor authorization verification

The authorized end-to-end supervisor test was completed with a temporary HSE supervisor and a temporary HSE department user. Both accounts were deactivated after the test and remain only as audit-history records.

| Scenario | Observed outcome | Result |
| --- | --- | --- |
| Supervisor sign-in and scope | The temporary HSE supervisor signed in successfully. The sidebar narrowed to the HSE workspace, documents, training, and **My Department Users**; other departmental tools and administration areas were absent. | Pass |
| Same-department user creation | The supervisor created a temporary HSE department-user account. The department selector was fixed to HSE / Safety. | Pass |
| Same-department user edit | The supervisor opened the user editor, changed the temporary user name, and saved the change. The updated profile and activity entry were visible. | Pass |
| Same-department user deactivation | The supervisor opened the confirmation dialog and deactivated the temporary user. The account changed to Deactivated and the audit log recorded the supervisor as actor. | Pass |
| Cross-department denial | While signed in as the HSE supervisor, a live `auth.updateUser` request attempted to update the existing administrator account. The backend returned **403 FORBIDDEN** before any write, confirming a supervisor cannot manage an existing account outside HSE. | Pass |
| Cleanup and administrator restoration | The temporary user and supervisor were deactivated after the final test. The administrator session was restored and its activity history showed the full creation, sign-in, update, deactivation, reactivation-for-test, and cleanup trail. | Pass |

The supervisor user-management interface does not render non-HSE accounts or expose a cross-department account selector; its account list and department field are both intentionally locked to HSE. Consequently, a supervisor cannot perform a visible UI click against another department’s existing record without bypassing the application’s correct scoped view. The live, same-session backend request against the existing administrator account was therefore used to prove that the server applies the same boundary before any account write.

No lifecycle, client-document, or production operating data was changed during the verification. The temporary QA accounts were the only records created and are now deactivated.

## Conclusion

>The authenticated administrator control sweep confirms that the dashboard, navigation shortcuts, notification controls, dossier queue, documents/compliance, lifting-gear register, all department workspaces, Transportation fleet, User Management, Training Register, Attendance, Excel Data Uploads, and Client Response Portal are responsive and route to their intended live interfaces. The supervisor lifecycle and cross-department backend denial are now proven in a live session. The only outstanding evidence is authenticated-mobile workspace capture, which is blocked by the current capture service’s isolated sign-in session.
