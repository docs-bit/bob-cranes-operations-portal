import { describe, expect, it } from "vitest";
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
});
