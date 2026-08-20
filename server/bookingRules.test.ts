import { describe, expect, it } from "vitest";
import { BOOKING_STAGES, canAdvanceStage, canDispatch, documentCompletion, isGearSelectionBlocked, transitionBooking } from "../shared/bookingRules";

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
    expect(canAdvanceStage("Reviewed", "Dispatched", "Salesperson")).toBe(true);
  });

  it("returns notifications when a role-gated transition succeeds", () => {
    const result = transitionBooking("Gear Confirmed", "Docs In Progress", "Department users");
    expect(result.stage).toBe("Docs In Progress");
    expect(result.notifications.some((notification) => notification.departmentCode === "sales")).toBe(true);
    expect(result.notifications.some((notification) => notification.departmentCode === "hse")).toBe(true);
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

  it("requires an explicit All Docs Submitted to Reviewed handoff before dispatch", () => {
    expect(transitionBooking("All Docs Submitted", "Reviewed", "Salesperson").stage).toBe("Reviewed");
    expect(canDispatch("All Docs Submitted", true, false)).toBe(false);
    expect(canDispatch("Reviewed", true, false)).toBe(true);
  });

  it("reaches All Docs Submitted only after the uploaded document set is complete", () => {
    const documents = [
      { id: "doc-1", departmentCode: "documentation" as const, name: "Method statement", state: "Uploaded" as const, required: true },
      { id: "doc-2", departmentCode: "hse" as const, name: "Lift plan", state: "Required" as const, required: true },
    ];
    expect(documentCompletion(documents)).toBe(50);
    const uploaded = documents.map((document) => ({ ...document, state: "Uploaded" as const }));
    expect(documentCompletion(uploaded)).toBe(100);
    expect(transitionBooking("Docs In Progress", "All Docs Submitted", "Documentation").stage).toBe("All Docs Submitted");
  });
});
