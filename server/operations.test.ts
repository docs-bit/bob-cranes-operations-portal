import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      email: "admin@bobcranes.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("operations router", () => {
  it("fetches bookings and equipment successfully", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const bookings = await caller.operations.getBookings();
    expect(Array.isArray(bookings)).toBe(true);

    const equipment = await caller.operations.getEquipment();
    expect(Array.isArray(equipment)).toBe(true);
    expect(equipment.length).toBeGreaterThan(0);
  }, 15000);
});
