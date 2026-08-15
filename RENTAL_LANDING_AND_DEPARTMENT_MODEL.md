# BOB Heavy Equipment Rental — Implementation Model

## Public landing-page experience

The public route will be **`/`**. The authenticated operations portal will move to **`/portal`**, while existing deep links remain protected. The landing page will use the supplied reference’s editorial pacing and construction-orange-on-near-black visual language while maintaining BOB-specific copy and equipment-rental content.

The content hierarchy is: navigation; image-led hero; fleet capability bands; equipment categories; readiness metrics; rental-service comparison; four-step lift process; safety and documentation reassurance; quote enquiry; closing CTA; and operational footer. The quotation form will store a real rental enquiry rather than show a non-functional placeholder.

## Editable department dashboard configuration

`department_dashboards.dashboardConfig` will be evolved to version 2. It will retain its workstream metadata and add a controlled widget set, widget ordering, and two supervisor-selectable metric keys. Each provisioned dashboard will expose a configuration panel to its supervisor and administrators only.

Available metrics are **active dossiers**, **priority dossiers**, **assigned team**, and **total dossiers**. Available widgets are **handoff queue**, **team readiness**, and **workflow library**. Each must retain at least one visible widget to avoid an empty operational workspace.

## Department lifecycle safety

Archiving will set the dynamic department’s `active` state to `0` and preserve its dashboard configuration, users, workflow templates, audit records, and booking history. Administrators can restore it later. Archived departments will be excluded from standard navigation and assignment selectors, local accounts assigned to them will be blocked from sign-in until restoration, and no hard-delete operation will be implemented.

## Workflow templates

`department_workflow_templates` will hold a department-scoped template name, purpose, active state, audit metadata, and a JSON checklist. A checklist item contains an identifier, document title, category, required flag, and guidance. Administrators and the assigned supervisor can create and revise templates for their department; only administrators can archive or restore a template. Templates will appear within the provisioned department workspace to guide assigned users.

## Data integrity and access model

All mutations will be implemented through protected procedures. An administrator may manage any provisioned department; a supervisor may update configuration and templates only for their own active department. Department users may read their active department’s configuration and templates but cannot change them. The public enquiry endpoint will validate data server-side and persist a bounded enquiry record.
