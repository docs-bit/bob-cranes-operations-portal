import { describe, expect, it } from "vitest";
import { BOOKING_STAGES, canAdvanceStage, canDispatch, isGearSelectionBlocked, transitionBooking } from "../shared/bookingRules";

describe("BOB Cranes booking rules", () => {
  it("keeps the lifecycle in the exact eight-stage order", () => {
    expect(BOOKING_STAGES).toEqual([
      "Created by Salesperson",
      "Documentation Supervisor",
      "Crew Assigned",
      "Gear Confirmed",
      "Docs In Progress",
      "All Docs Submitted",
      "Reviewed",
      "Dispatched",
    ]);
    expect(canAdvanceStage("Created by Salesperson", "Documentation Supervisor", "Documentation Supervisor")).toBe(true);
    expect(canAdvanceStage("Created by Salesperson", "Crew Assigned", "Crew Assignment")).toBe(false);
    expect(canAdvanceStage("Reviewed", "Dispatched", "Documentation")).toBe(true);
  });

  it("returns notifications when a role-gated transition succeeds", () => {
    const result = transitionBooking("Gear Confirmed", "Docs In Progress", "Department users");
    expect(result.stage).toBe("Docs In Progress");
    expect(result.notifications.some((notification) => notification.departmentCode === "SAL")).toBe(true);
    expect(result.notifications.some((notification) => notification.departmentCode === "HSE")).toBe(true);
    expect(() => transitionBooking("Created by Salesperson", "Crew Assigned", "Salesperson")).toThrow();
  });

  it("hard-blocks lifting gear whose inspection expires before mobilization", () => {
    expect(isGearSelectionBlocked(new Date("2026-08-04"), new Date("2026-08-11"))).toBe(true);
    expect(isGearSelectionBlocked(new Date("2026-12-04"), new Date("2026-08-11"))).toBe(false);
  });

  it("allows dispatch only after review, complete documents, and no revision flags", () => {
    expect(canDispatch("All Docs Submitted", true, false)).toBe(false);
    expect(canDispatch("Reviewed", false, false)).toBe(false);
    expect(canDispatch("Reviewed", true, true)).toBe(false);
    expect(canDispatch("Reviewed", true, false)).toBe(true);
  });
});
