import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function departmentUserContext(): TrpcContext {
  return {
    user: {
      id: 44,
      openId: "local-test-user",
      email: "hse@bobcranes.com",
      localEmail: "hse@bobcranes.com",
      passwordHash: "not-used-in-this-test",
      departmentCode: "hse",
      isActive: 1,
      name: "HSE User",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as TrpcContext["res"],
  };
}

function adminContext(): TrpcContext {
  return {
    user: {
      id: 60001,
      openId: "local-test-admin",
      email: "admin@bobcranes.com",
      localEmail: "admin@bobcranes.com",
      passwordHash: "not-used-in-this-test",
      departmentCode: "administrator",
      isActive: 1,
      name: "Administrator",
      loginMethod: "password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as TrpcContext["res"],
  };
}

describe("account registration access", () => {
  it("rejects department users before an account can be registered", async () => {
    const caller = appRouter.createCaller(departmentUserContext());

    await expect(caller.auth.registerUser({
      name: "Accounts User",
      email: "accounts@bobcranes.com",
      password: "A secure password 2026",
      departmentCode: "accounts",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects notifications targeted at another department", async () => {
    const caller = appRouter.createCaller(departmentUserContext());

    await expect(caller.operations.addNotification({
      id: "notification-test",
      departmentCode: "sales",
      title: "Spoofed notification",
      body: "This should not be accepted.",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects chat messages that spoof another team", async () => {
    const caller = appRouter.createCaller(departmentUserContext());

    await expect(caller.operations.addChat({
      id: "chat-test",
      bookingId: "BOB Booking-31511",
      team: "Sales",
      sender: "Spoofed sender",
      body: "This should not be accepted.",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents an administrator from editing or deactivating their own account", async () => {
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.auth.updateUser({ id: 60001, name: "Admin", email: "admin@bobcranes.com", departmentCode: "administrator", role: "admin", password: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.auth.setUserActive({ id: 60001, isActive: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

function supervisorContext(): TrpcContext {
  return {
    user: {
      id: 70001,
      openId: "local-test-supervisor",
      email: "hse.supervisor@bobcranes.com",
      localEmail: "hse.supervisor@bobcranes.com",
      passwordHash: "not-used-in-this-test",
      departmentCode: "hse",
      supervisorId: null,
      isActive: 1,
      name: "HSE Supervisor",
      loginMethod: "password",
      role: "supervisor",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as TrpcContext["res"],
  };
}

describe("supervisor department boundaries", () => {
  it("allows an administrator to create a department supervisor", async () => {
    const getUser = vi.spyOn(db, "getUserByLocalEmail").mockResolvedValue(undefined);
    const createUser = vi.spyOn(db, "createLocalUser").mockResolvedValue({ id: 70002, name: "Sales Supervisor", localEmail: "sales.supervisor@bobcranes.com", email: "sales.supervisor@bobcranes.com", role: "supervisor", departmentCode: "sales", supervisorId: null, isActive: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: null, passwordHash: "hash", openId: null, loginMethod: "password" } as any);
    const caller = appRouter.createCaller(adminContext());
    const result = await caller.auth.registerUser({ name: "Sales Supervisor", email: "sales.supervisor@bobcranes.com", password: "A secure password 2026", departmentCode: "sales", role: "supervisor" });
    expect(result.role).toBe("supervisor");
    expect(result.departmentCode).toBe("sales");
    expect(getUser).toHaveBeenCalledWith("sales.supervisor@bobcranes.com");
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ role: "supervisor", departmentCode: "sales", supervisorId: null }));
    vi.restoreAllMocks();
  });
  it("rejects supervisor account creation for another department", async () => {
    const caller = appRouter.createCaller(supervisorContext());
    await expect(caller.auth.registerUser({
      name: "Sales User",
      email: "sales-user@bobcranes.com",
      password: "A secure password 2026",
      departmentCode: "sales",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects supervisor escalation to another role", async () => {
    const caller = appRouter.createCaller(supervisorContext());
    await expect(caller.auth.registerUser({
      name: "HSE Lead",
      email: "hse-lead@bobcranes.com",
      password: "A secure password 2026",
      departmentCode: "hse",
      role: "supervisor",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
