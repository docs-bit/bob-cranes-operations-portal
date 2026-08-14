import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allocationAwareAvailability } from "../shared/crewAssignmentAvailability";

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
    expect(workspaceSource).toContain("const availabilityByEmployeeId = useMemo");
    expect(workspaceSource).toContain("allocationAwareAvailability(");
    expect(workspaceSource).toContain("const matchesAvailability = availability === \"All\" || resolvedAvailability === availability");
    expect(workspaceSource).toContain("availability: availabilityByEmployeeId.get(employee.id) ?? employee.availability");
  });
});
