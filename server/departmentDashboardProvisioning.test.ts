import * as db from "./db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  canAccessProvisionedDepartmentDashboard,
  createDepartmentDashboardConfig,
  isValidProvisionedDepartmentCode,
  normalizeDepartmentCode,
} from "../shared/departmentDashboardRules";

function contextFor(user: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  return {
    user: {
      id: 44,
      openId: "department-dashboard-test",
      email: "tester@bobcranes.com",
      name: "Portal Tester",
      loginMethod: "password",
      role: "admin",
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

describe("department dashboard provisioning", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes unique department codes and produces distinct workflow dashboard settings", () => {
    expect(normalizeDepartmentCode(" Quality Team ")).toBe("quality-team");
    expect(isValidProvisionedDepartmentCode("quality-team")).toBe(true);
    expect(isValidProvisionedDepartmentCode("Sales")).toBe(false);
    expect(createDepartmentDashboardConfig({ name: "Quality Assurance", workstream: "compliance" })).toMatchObject({
      overviewLabel: "Quality Assurance workspace",
      workstream: "compliance",
      primaryMetricLabel: "Evidence checks",
      quickActions: ["Review evidence", "Escalate a gap"],
    });
  });

  it("provisions a department and dashboard as one administrator-only operation", async () => {
    const create = vi.spyOn(db, "createProvisionedDepartmentDashboard").mockResolvedValue({
      code: "quality-team",
      name: "Quality Assurance",
      active: 1,
      description: "Control QA evidence and issue-resolution handoffs.",
      accent: "green",
      icon: "ShieldCheck",
      dashboardConfig: {},
      createdBy: 44,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(db, "addUserActivity").mockResolvedValue({} as any);
    vi.spyOn(db, "addNotification").mockResolvedValue({} as any);
    const caller = appRouter.createCaller(contextFor({ role: "admin", departmentCode: "administrator" }));

    const created = await caller.departments.createProvisioned({
      name: "Quality Assurance",
      code: "Quality Team",
      description: "Control QA evidence and issue-resolution handoffs.",
      accent: "green",
      icon: "ShieldCheck",
      workstream: "compliance",
    });

    expect(created.code).toBe("quality-team");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      code: "quality-team",
      createdBy: 44,
      dashboardConfig: expect.objectContaining({ workstream: "compliance" }),
    }));
  });

  it("prevents users from opening another department's provisioned dashboard", async () => {
    const user = contextFor({ role: "user", departmentCode: "quality-team" });
    expect(canAccessProvisionedDepartmentDashboard(user.user!, "ops-planning")).toBe(false);
    expect(canAccessProvisionedDepartmentDashboard(user.user!, "quality-team")).toBe(true);

    const caller = appRouter.createCaller(user);
    await expect(caller.departments.getProvisioned({ code: "ops-planning" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
