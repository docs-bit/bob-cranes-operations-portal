import { describe, expect, it } from "vitest";
import { pendingForDepartment } from "@shared/departmentQueueRules";

const NOW = Date.parse("2026-09-05T00:00:00Z");

describe("departmentQueueRules", () => {
  it("returns only the department's owned stages, oldest mob first", () => {
    const result = pendingForDepartment(
      [
        { id: "b1", client: "A", project: "P1", stage: "Documentation Supervisor", priority: "Standard", mob: "20 Aug 2026" },
        { id: "b2", client: "B", project: "P2", stage: "Documentation Supervisor", priority: "High", mob: "10 Aug 2026" },
        { id: "b3", client: "C", project: "P3", stage: "Crew Assigned", priority: "Standard", mob: "09 Aug 2026" },
        { id: "b4", client: "D", project: "P4", stage: "Dispatched", priority: "Standard", mob: "01 Aug 2026" },
      ] as never,
      "documentation",
      NOW
    );
    expect(result.map(item => item.id)).toEqual(["b2", "b1"]);
  });

  it("marks overdue and due-soon urgency in text", () => {
    const result = pendingForDepartment(
      [
        { id: "late", client: "A", project: "P", stage: "Created by Salesperson", priority: "Critical", mob: "01 Aug 2026" },
        { id: "soon", client: "B", project: "Q", stage: "Created by Salesperson", priority: "Standard", mob: "10 Sep 2026" },
      ] as never,
      "sales",
      NOW
    );
    expect(result[0].urgency).toBe("overdue");
    expect(result[1].urgency).toBe("due-soon");
  });
});
