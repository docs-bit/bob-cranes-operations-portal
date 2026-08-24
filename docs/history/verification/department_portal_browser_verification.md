# Department portal browser verification

- Existing authenticated HSE staging session opened the portal successfully.
- Sidebar scope showed Operations Cockpit, Documents & Compliance, HSE / Safety, and profile; no cross-department navigation was exposed.
- HSE / Safety opened as an individual department portal with the HSE Supervisor stage gate, Docs In Progress queue, dossier rows, checklist, and review controls.
- The universal Back control returned from the HSE portal to the authenticated Operations Cockpit without losing the session.
- Browser console reported no runtime errors during the portal and back-navigation checks.
- The reference progress graph was implemented in the code path used by the administrator Operations Cockpit and will be validated by build and tests; the current HSE-only session did not expose the admin graph.

The staged HSE account was promoted to supervisor and the refreshed session exposed “My Department Users” alongside the HSE department portal. The supervisor workspace displayed HSE-only filters, a disabled department selector fixed to HSE / Safety, unique-credential fields, and the universal Back control; no other department user-management option was exposed.

The HSE supervisor created `HSE Workflow User` with a unique email/password through the live form. The success message confirmed department-user access, the HSE-only account list showed both the supervisor and new department user, and edit/deactivate controls appeared only for the other account while the current supervisor remained protected.

The supervisor editor opened for the same-department account with the role fixed to Department user and department fixed to HSE / Safety, preventing supervisor escalation or cross-department reassignment. The name field accepted an edit; the save control requires a lower-page interaction in the compact preview and remains to be retried.

The supervisor successfully updated the HSE workflow user’s display name. The activity feed recorded “Profile updated” with the supervisor as actor, and the account list showed the updated name while retaining Department user · HSE / Safety access.

The supervisor deactivation flow displayed the confirmation modal before mutation. After confirmation, the HSE user showed Deactivated, the summary changed to Active 1 / Deactivated 1, the success message appeared, and the activity feed recorded Account deactivated by HSE Staging User. Reactivate remained available for the same department user.
