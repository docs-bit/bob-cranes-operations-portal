import * as db from "./db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  canManageProvisionedDepartmentDashboard,
  normalizeDepartmentDashboardConfig,
} from "../shared/departmentDashboardRules";

const dashboard = {
  code: "quality-team",
  name: "Quality Assurance",
  active: 1,
  description: "Control QA evidence and issue-resolution handoffs.",
  accent: "green",
  icon: "ShieldCheck",
  dashboardConfig: { version: 1, workstream: "compliance", overviewLabel: "Quality workspace", objective: "Review evidence before dispatch.", primaryMetricLabel: "Evidence checks", secondaryMetricLabel: "Items awaiting review", quickActions: ["Review evidence", "Escalate a gap"] },
  createdBy: 44,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function contextFor(user: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  return {
    user: {
      id: 44,
      openId: "department-workspace-test",
      email: "tester@bobcranes.com",
      name: "Portal Tester",
      loginMethod: "password",
      role: "admin",
      departmentCode: "administrator",
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...user,
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("department workspace lifecycle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("upgrades legacy dashboard configuration to a usable widget and metric layout", () => {
    const config = normalizeDepartmentDashboardConfig(dashboard.dashboardConfig, { name: dashboard.name });
    expect(config.version).toBe(2);
    expect(config.widgets).toEqual(["handoff_queue", "team_readiness", "workflow_library"]);
    expect(config.metrics).toEqual(["active_dossiers", "priority_dossiers"]);
    expect(canManageProvisionedDepartmentDashboard({ role: "supervisor", departmentCode: "quality-team" }, "quality-team")).toBe(true);
    expect(canManageProvisionedDepartmentDashboard({ role: "supervisor", departmentCode: "quality-team" }, "ops-planning")).toBe(false);
  });

  it("allows a supervisor to save dashboard widgets only for the assigned department", async () => {
    vi.spyOn(db, "getProvisionedDepartmentDashboard").mockResolvedValue(dashboard as any);
    const update = vi.spyOn(db, "updateProvisionedDepartmentDashboardConfig").mockResolvedValue(dashboard as any);
    vi.spyOn(db, "addUserActivity").mockResolvedValue({} as any);
    const caller = appRouter.createCaller(contextFor({ role: "supervisor", departmentCode: "quality-team" }));

    await caller.departments.updateDashboardConfig({
      code: "quality-team",
      overviewLabel: "Quality readiness workspace",
      objective: "Review required evidence before dispatch.",
      widgets: ["workflow_library", "handoff_queue"],
      metrics: ["priority_dossiers", "assigned_team"],
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      code: "quality-team",
      dashboardConfig: expect.objectContaining({
        widgets: ["workflow_library", "handoff_queue"],
        metrics: ["priority_dossiers", "assigned_team"],
      }),
    }));
  });

  it("archives a department without deleting its dashboard data", async () => {
    vi.spyOn(db, "getProvisionedDepartmentDashboard").mockResolvedValue(dashboard as any);
    const setActive = vi.spyOn(db, "setProvisionedDepartmentActive").mockResolvedValue({ ...dashboard, active: 0 } as any);
    vi.spyOn(db, "addUserActivity").mockResolvedValue({} as any);
    const caller = appRouter.createCaller(contextFor({ role: "admin", departmentCode: "administrator" }));

    const result = await caller.departments.setProvisionedActive({ code: "quality-team", active: false });

    expect(result.active).toBe(0);
    expect(setActive).toHaveBeenCalledWith({ code: "quality-team", active: false });
  });

  it("allows a department supervisor to create a required-document workflow template only for the assigned department", async () => {
    vi.spyOn(db, "getProvisionedDepartmentDashboard").mockResolvedValue(dashboard as any);
    const create = vi.spyOn(db, "createDepartmentWorkflowTemplate").mockResolvedValue({ id: "workflow-qa", departmentCode: "quality-team", name: "QA pack", description: "Review required QA evidence before dispatch.", checklist: [], active: 1, createdBy: 44, createdAt: new Date(), updatedAt: new Date() } as any);
    vi.spyOn(db, "addUserActivity").mockResolvedValue({} as any);
    const caller = appRouter.createCaller(contextFor({ role: "supervisor", departmentCode: "quality-team" }));

    const result = await caller.departments.createWorkflowTemplate({
      departmentCode: "quality-team",
      name: "QA pack",
      description: "Review required QA evidence before dispatch.",
      checklist: [{ id: "scope-review", label: "Scope review", category: "Planning", required: true, guidance: "Confirm scope before the handoff." }],
    });

    expect(result.id).toBe("workflow-qa");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ departmentCode: "quality-team", createdBy: 44 }));
  });
});
