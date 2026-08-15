import type { PortalRole } from "./departmentAccess";

export const DEPARTMENT_DASHBOARD_ACCENTS = ["orange", "blue", "green", "violet"] as const;
export const DEPARTMENT_DASHBOARD_ICONS = ["LayoutDashboard", "HardHat", "ShieldCheck", "Truck", "Users", "ClipboardCheck"] as const;
export const DEPARTMENT_WORKSTREAMS = ["operations", "compliance", "commercial", "support"] as const;

export type DepartmentDashboardAccent = (typeof DEPARTMENT_DASHBOARD_ACCENTS)[number];
export type DepartmentDashboardIcon = (typeof DEPARTMENT_DASHBOARD_ICONS)[number];
export type DepartmentWorkstream = (typeof DEPARTMENT_WORKSTREAMS)[number];

export type DepartmentDashboardConfig = {
  version: 1;
  workstream: DepartmentWorkstream;
  overviewLabel: string;
  objective: string;
  primaryMetricLabel: string;
  secondaryMetricLabel: string;
  quickActions: [string, string];
};

const WORKSTREAM_DETAILS: Record<DepartmentWorkstream, Omit<DepartmentDashboardConfig, "version" | "workstream" | "overviewLabel">> = {
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
    version: 1,
    workstream: input.workstream,
    overviewLabel: `${input.name} workspace`,
    ...detail,
  };
}

export function canAccessProvisionedDepartmentDashboard(
  actor: { role: PortalRole; departmentCode?: string | null },
  departmentCode: string
) {
  return actor.role === "admin" || actor.departmentCode === departmentCode;
}

export function normalizeDepartmentCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function isValidProvisionedDepartmentCode(value: string) {
  return /^[a-z][a-z0-9-]{2,15}$/.test(value);
}
