import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "supervisor" | "user", departmentCode: string): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 60001 : 70001,
      openId: `local-${role}`,
      email: `${role}@bobcranes.com`,
      localEmail: `${role}@bobcranes.com`,
      passwordHash: "test",
      departmentCode,
      supervisorId: null,
      isActive: 1,
      name: role,
      loginMethod: "password",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as TrpcContext["res"],
  };
}

describe("governance and dispatch bundle contracts", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns only supervisor accounts with their same-department active-user count to administrators", async () => {
    vi.spyOn(db, "listLocalUsers").mockResolvedValue([
      { id: 11, name: "HSE Lead", localEmail: "lead@bobcranes.com", email: "lead@bobcranes.com", departmentCode: "hse", role: "supervisor", isActive: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      { id: 12, name: "HSE Tech", localEmail: "tech@bobcranes.com", email: "tech@bobcranes.com", departmentCode: "hse", role: "user", isActive: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      { id: 13, name: "HSE Pause", localEmail: "pause@bobcranes.com", email: "pause@bobcranes.com", departmentCode: "hse", role: "user", isActive: 0, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    ] as any);
    const caller = appRouter.createCaller(context("admin", "administrator"));
    await expect(caller.auth.getSupervisorPermissionAudit()).resolves.toEqual([expect.objectContaining({ id: 11, managedUserCount: 1 })]);
    await expect(appRouter.createCaller(context("supervisor", "hse")).auth.getSupervisorPermissionAudit()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes normalized date bounds into filtered activity queries", async () => {
    const activitySpy = vi.spyOn(db, "listRecentUserActivity").mockResolvedValue([]);
    const caller = appRouter.createCaller(context("admin", "administrator"));
    await caller.auth.listActivity({ from: "2026-08-01", to: "2026-08-14", limit: 100 });
    expect(activitySpy).toHaveBeenCalledWith(expect.objectContaining({
      limit: 100,
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-14T23:59:59.999Z"),
    }));
  });

  it("limits retention settings and purge operations to administrators", async () => {
    vi.spyOn(db, "setActivityRetentionDays").mockResolvedValue(180);
    vi.spyOn(db, "getActivityRetentionDays").mockResolvedValue(180);
    vi.spyOn(db, "purgeUserActivityBefore").mockResolvedValue(2);
    vi.spyOn(db, "addUserActivity").mockResolvedValue();
    const admin = appRouter.createCaller(context("admin", "administrator"));
    await expect(admin.auth.updateActivityRetention({ retentionDays: 180 })).resolves.toEqual({ retentionDays: 180 });
    await expect(admin.auth.purgeExpiredActivity({ confirm: true })).resolves.toMatchObject({ retentionDays: 180, purgedCount: 2 });
    await expect(appRouter.createCaller(context("supervisor", "hse")).auth.updateActivityRetention({ retentionDays: 180 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires the Sales department before recording an eligible dispatch bundle request", async () => {
    vi.spyOn(db, "getBookingById").mockResolvedValue({ id: "BOB-59116", stage: "Reviewed" } as any);
    vi.spyOn(db, "getDocumentsForBooking").mockResolvedValue([{ id: "doc-1", required: 1, state: "Approved" }] as any);
    const auditSpy = vi.spyOn(db, "addUserActivity").mockResolvedValue();
    const sales = appRouter.createCaller(context("user", "sales"));
    await expect(sales.operations.requestDispatchBundle({ bookingId: "BOB-59116" })).resolves.toMatchObject({ booking: { id: "BOB-59116" } });
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: "dispatch_bundle_generated" }));
    await expect(appRouter.createCaller(context("user", "hse")).operations.requestDispatchBundle({ bookingId: "BOB-59116" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
