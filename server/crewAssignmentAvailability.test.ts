import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allocationAwareAvailability, summarizeAllocationTiming } from "../shared/crewAssignmentAvailability";

const workspaceSource = readFileSync(
  new URL("../client/src/components/CrewAssignmentWorkspace.tsx", import.meta.url),
  "utf8"
);

describe("allocation-aware Crew Assignment availability", () => {
  it("shows Assigned only when a persisted booking allocation exists", () => {
    expect(allocationAwareAvailability("Present", true)).toBe("Assigned");
    expect(allocationAwareAvailability("Assigned", true)).toBe("Assigned");
  });

  it("preserves attendance statuses but normalizes unallocated legacy Assigned rows", () => {
    expect(allocationAwareAvailability("Present", false)).toBe("Present");
    expect(allocationAwareAvailability("On Leave", false)).toBe("On Leave");
    expect(allocationAwareAvailability("Off-Site", false)).toBe("Off-Site");
    expect(allocationAwareAvailability("Assigned", false)).toBe("Present");
  });

  it("wires allocation-aware availability into the Crew Assignment filter and row data", () => {
    expect(workspaceSource).toContain("const bookingIdsByCrew = useMemo");
    expect(workspaceSource).toContain("allocationAwareAvailability(");
    expect(workspaceSource).toContain("availability === \"All\" || crew.availability === availability");
    expect(workspaceSource).toContain("dateAvailability(crew, bookingIds, bookings, availabilityDate)");
  });

  it("distinguishes active and upcoming allocated bookings from their booking dates", () => {
    const bookings = [
      { id: "active", mob: "10 Aug 2026", offHire: "16 Aug 2026" },
      { id: "upcoming", mob: "20 Aug 2026", offHire: "24 Aug 2026" },
      { id: "complete", mob: "01 Aug 2026", offHire: "05 Aug 2026" },
    ];
    const reference = new Date("2026-08-14T12:00:00");

    expect(summarizeAllocationTiming(["active"], bookings, reference)).toBe("Active booking");
    expect(summarizeAllocationTiming(["upcoming"], bookings, reference)).toBe("Upcoming booking");
    expect(summarizeAllocationTiming(["complete"], bookings, reference)).toBe("Completed booking");
    expect(summarizeAllocationTiming(["active", "upcoming"], bookings, reference)).toBe("Active booking");
  });

  it("renders allocation count, booking ID, and date-aware timing details in Crew Assignment", () => {
    expect(workspaceSource).toContain("allocation-count-badge");
    expect(workspaceSource).toContain("booking-id-chip");
    expect(workspaceSource).toContain("summarizeAllocationTiming(crew.bookingIds, bookings");
    expect(workspaceSource).toContain("Active booking");
    expect(workspaceSource).toContain("Upcoming booking");
  });
});
