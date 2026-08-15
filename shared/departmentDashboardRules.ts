import type { PortalRole } from "./departmentAccess";

export const DEPARTMENT_DASHBOARD_ACCENTS = ["orange", "blue", "green", "violet"] as const;
export const DEPARTMENT_DASHBOARD_ICONS = ["LayoutDashboard", "HardHat", "ShieldCheck", "Truck", "Users", "ClipboardCheck"] as const;
export const DEPARTMENT_WORKSTREAMS = ["operations", "compliance", "commercial", "support"] as const;
export const DEPARTMENT_DASHBOARD_WIDGETS = ["handoff_queue", "team_readiness", "workflow_library"] as const;
export const DEPARTMENT_DASHBOARD_METRICS = ["active_dossiers", "priority_dossiers", "assigned_team", "total_dossiers"] as const;

export type DepartmentDashboardAccent = (typeof DEPARTMENT_DASHBOARD_ACCENTS)[number];
export type DepartmentDashboardIcon = (typeof DEPARTMENT_DASHBOARD_ICONS)[number];
export type DepartmentWorkstream = (typeof DEPARTMENT_WORKSTREAMS)[number];
export type DepartmentDashboardWidget = (typeof DEPARTMENT_DASHBOARD_WIDGETS)[number];
export type DepartmentDashboardMetric = (typeof DEPARTMENT_DASHBOARD_METRICS)[number];

export type DepartmentDashboardConfig = {
  version: 2;
  workstream: DepartmentWorkstream;
  overviewLabel: string;
  objective: string;
  primaryMetricLabel: string;
  secondaryMetricLabel: string;
  quickActions: [string, string];
  widgets: DepartmentDashboardWidget[];
  metrics: [DepartmentDashboardMetric, DepartmentDashboardMetric];
};

const WORKSTREAM_DETAILS: Record<DepartmentWorkstream, Omit<DepartmentDashboardConfig, "version" | "workstream" | "overviewLabel" | "widgets" | "metrics">> = {
  operations: {
    objective: "Coordinate field readiness, equipment and crew handoffs for active dossiers.",
    primaryMetricLabel: "Active dossiers",
    secondaryMetricLabel: "Readiness checks",
    quickActions: ["Review work queue", "Coordinate team"],
  },
  compliance: {
    objective: "Control evidence, verification and compliance handoffs before dispatch.",
    primaryMetricLabel: "Evidence checks",
    secondaryMetricLabel: "Items awaiting review",
    quickActions: ["Review evidence", "Escalate a gap"],
  },
  commercial: {
    objective: "Prioritise client commitments, approvals and commercial follow-through.",
    primaryMetricLabel: "Client commitments",
    secondaryMetricLabel: "Priority dossiers",
    quickActions: ["Review commitments", "Open client portal"],
  },
  support: {
    objective: "Keep shared service requests, records and team readiness on track.",
    primaryMetricLabel: "Open requests",
    secondaryMetricLabel: "Team updates",
    quickActions: ["Review requests", "Manage team"],
  },
};

export function createDepartmentDashboardConfig(input: {
  name: string;
  workstream: DepartmentWorkstream;
}): DepartmentDashboardConfig {
  const detail = WORKSTREAM_DETAILS[input.workstream];
  return {
    version: 2,
    workstream: input.workstream,
    overviewLabel: `${input.name} workspace`,
    widgets: ["handoff_queue", "team_readiness", "workflow_library"],
    metrics: ["active_dossiers", "priority_dossiers"],
    ...detail,
  };
}

export function normalizeDepartmentDashboardConfig(
  value: unknown,
  fallback: { name: string; workstream?: DepartmentWorkstream }
): DepartmentDashboardConfig {
  const base = createDepartmentDashboardConfig({
    name: fallback.name,
    workstream: fallback.workstream ?? "operations",
  });
  if (!value || typeof value !== "object") return base;
  const candidate = value as Partial<DepartmentDashboardConfig>;
  const widgetSet = new Set(DEPARTMENT_DASHBOARD_WIDGETS);
  const metricSet = new Set(DEPARTMENT_DASHBOARD_METRICS);
  const widgets = Array.isArray(candidate.widgets)
    ? candidate.widgets.filter((widget): widget is DepartmentDashboardWidget => typeof widget === "string" && widgetSet.has(widget as DepartmentDashboardWidget))
    : base.widgets;
  const metrics = Array.isArray(candidate.metrics)
    ? candidate.metrics.filter((metric): metric is DepartmentDashboardMetric => typeof metric === "string" && metricSet.has(metric as DepartmentDashboardMetric))
    : base.metrics;
  const workstream = DEPARTMENT_WORKSTREAMS.includes(candidate.workstream as DepartmentWorkstream)
    ? candidate.workstream as DepartmentWorkstream
    : base.workstream;
  return {
    version: 2,
    workstream,
    overviewLabel: typeof candidate.overviewLabel === "string" ? candidate.overviewLabel : base.overviewLabel,
    objective: typeof candidate.objective === "string" ? candidate.objective : base.objective,
    primaryMetricLabel: typeof candidate.primaryMetricLabel === "string" ? candidate.primaryMetricLabel : base.primaryMetricLabel,
    secondaryMetricLabel: typeof candidate.secondaryMetricLabel === "string" ? candidate.secondaryMetricLabel : base.secondaryMetricLabel,
    quickActions: Array.isArray(candidate.quickActions) && candidate.quickActions.length === 2 && candidate.quickActions.every(action => typeof action === "string")
      ? [candidate.quickActions[0]!, candidate.quickActions[1]!]
      : base.quickActions,
    widgets: widgets.length ? widgets : base.widgets,
    metrics: metrics.length >= 2
      ? [metrics[0]!, metrics[1]!]
      : base.metrics,
  };
}

export function canAccessProvisionedDepartmentDashboard(
  actor: { role: PortalRole; departmentCode?: string | null },
  departmentCode: string
) {
  return actor.role === "admin" || actor.departmentCode === departmentCode;
}

export function canManageProvisionedDepartmentDashboard(
  actor: { role: PortalRole; departmentCode?: string | null },
  departmentCode: string
) {
  return actor.role === "admin" || (actor.role === "supervisor" && actor.departmentCode === departmentCode);
}

export type WorkflowChecklistItem = {
  id: string;
  label: string;
  category: string;
  required: boolean;
  guidance: string;
};

export function defaultWorkflowChecklist(workstream: DepartmentWorkstream): WorkflowChecklistItem[] {
  const shared: WorkflowChecklistItem[] = [
    { id: "scope-review", label: "Scope and dossier review", category: "Planning", required: true, guidance: "Confirm the client brief, project location, dates, and assigned handoff owner." },
    { id: "handoff-note", label: "Department handoff note", category: "Coordination", required: true, guidance: "Record the decision, open items, and named next owner before handoff." },
  ];
  const workstreamItem: Record<DepartmentWorkstream, WorkflowChecklistItem> = {
    operations: { id: "field-readiness", label: "Field readiness confirmation", category: "Operations", required: true, guidance: "Confirm equipment, crew, access, and site readiness before mobilization." },
    compliance: { id: "evidence-check", label: "Required evidence check", category: "Compliance", required: true, guidance: "Verify that each required certificate and document is current, legible, and assigned to the dossier." },
    commercial: { id: "client-approval", label: "Client approval record", category: "Commercial", required: true, guidance: "Confirm scope, commercial reference, and approved client contact details." },
    support: { id: "service-request", label: "Service request record", category: "Support", required: true, guidance: "Capture the request, priority, owner, and expected response time." },
  };
  return [...shared, workstreamItem[workstream]];
}

export function normalizeDepartmentCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function isValidProvisionedDepartmentCode(value: string) {
  return /^[a-z][a-z0-9-]{2,15}$/.test(value);
}
