import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBulkConflictSummary, dateRangesOverlap } from "../shared/bulkCrewAssignmentRules";

const workspace = readFileSync(new URL("../client/src/components/CrewAssignmentWorkspace.tsx", import.meta.url), "utf8");

describe("bulk Crew Assignment", () => {
  const target = { id: "target", mob: "10 Aug 2026", offHire: "16 Aug 2026" };
  const bookings = [target, { id: "overlap", mob: "14 Aug 2026", offHire: "19 Aug 2026" }, { id: "clear", mob: "20 Aug 2026", offHire: "22 Aug 2026" }];

  it("identifies overlapping and clear assignments before a save", () => {
    expect(dateRangesOverlap(target, bookings[1])).toBe(true);
    expect(dateRangesOverlap(target, bookings[2])).toBe(false);
    const summary = buildBulkConflictSummary(
      [{ id: "crew-1", name: "Overlap crew" }, { id: "crew-2", name: "Clear crew" }],
      target,
      bookings,
      [
        { crewId: "crew-1", employeeName: "Overlap crew", bookingId: "overlap" },
        { crewId: "crew-2", employeeName: "Clear crew", bookingId: "clear" },
      ]
    );
    expect(summary[0].conflicts.map(item => item.id)).toEqual(["overlap"]);
    expect(summary[1].conflicts).toHaveLength(0);
  });

  it("wires bulk selection, group save, and a visual conflict timeline into edit assignment", () => {
    expect(workspace).toContain("const [bulkIds, setBulkIds] = useState<string[]>([])");
    expect(workspace).toContain("const bulkAssign = async () =>");
    expect(workspace).toContain("Promise.all(selectedBulkCrew.map");
    expect(workspace).toContain("Conflict timeline before save");
    expect(workspace).toContain("conflict-timeline-row");
    expect(workspace).toContain("Select all filtered crew");
  });
});
