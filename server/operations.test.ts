import { describe, expect, it, vi } from "vitest";
import * as db from "./db";
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

function createSalesContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "test-sales",
      email: "sales@bobcranes.com",
      localEmail: "sales@bobcranes.com",
      name: "Sales User",
      loginMethod: "password",
      departmentCode: "sales",
      role: "user",
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("operations router", () => {
  it("persists a valid Sales handoff and fans out lifecycle notifications", async () => {
    const getBooking = vi.spyOn(db, "getBookingById").mockResolvedValue({ id: "BOB Booking-test", stage: "Created by Salesperson" } as any);
    const updateStage = vi.spyOn(db, "updateBookingStage").mockResolvedValue({ id: "BOB Booking-test", stage: "Documentation Supervisor" } as any);
    const addNotification = vi.spyOn(db, "addNotification").mockResolvedValue({} as any);
    const caller = appRouter.createCaller(createSalesContext());

    const result = await caller.operations.advanceBookingStage({ id: "BOB Booking-test", currentStage: "Created by Salesperson", nextStage: "Documentation Supervisor" });

    expect(result.stage).toBe("Documentation Supervisor");
    expect(getBooking).toHaveBeenCalledWith("BOB Booking-test");
    expect(updateStage).toHaveBeenCalledWith("BOB Booking-test", "Documentation Supervisor");
    expect(addNotification).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("allows Sales to complete the final Reviewed-to-Dispatched handoff", async () => {
    const getBooking = vi.spyOn(db, "getBookingById").mockResolvedValue({ id: "BOB-59116", stage: "Reviewed" } as any);
    const updateStage = vi.spyOn(db, "updateBookingStage").mockResolvedValue({ id: "BOB-59116", stage: "Dispatched" } as any);
    const addNotification = vi.spyOn(db, "addNotification").mockResolvedValue({} as any);
    const caller = appRouter.createCaller(createSalesContext());
    const result = await caller.operations.advanceBookingStage({ id: "BOB-59116", currentStage: "Reviewed", nextStage: "Dispatched" });
    expect(result.stage).toBe("Dispatched");
    expect(updateStage).toHaveBeenCalledWith("BOB-59116", "Dispatched");
    expect(addNotification).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("persists notifications for a workstream even when a legacy demo dossier is not in the database", async () => {
    const getBooking = vi.spyOn(db, "getBookingById").mockResolvedValue(undefined);
    const addNotification = vi.spyOn(db, "addNotification").mockResolvedValue({} as any);
    const caller = appRouter.createCaller({ ...createSalesContext(), user: { ...createSalesContext().user, departmentCode: "hse" } } as any);
    const result = await caller.operations.completeBookingWorkstream({ id: "BOB Booking-31511", workstream: "HSE", stage: "Docs In Progress" });
    expect(result.workstream).toBe("HSE");
    expect(getBooking).toHaveBeenCalledWith("BOB Booking-31511");
    expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ departmentCode: "documentation", title: "HSE workstream complete" }));
    vi.restoreAllMocks();
  });

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
