import { describe, expect, it } from "vitest";
import { bookingWindowsOverlap, findEmployeeBookingConflicts, toggleEmployeeBookingAllocation } from "@shared/bookingConflictRules";

describe("booking conflict rules", () => {
  const first = { id: "BK-1", mob: "11 Aug 2026", offHire: "18 Aug 2026" };
  const overlapping = { id: "BK-2", mob: "16 Aug 2026", offHire: "20 Aug 2026" };
  const separate = { id: "BK-3", mob: "21 Aug 2026", offHire: "28 Aug 2026" };

  it("detects overlapping booking windows", () => {
    expect(bookingWindowsOverlap(first, overlapping)).toBe(true);
    expect(bookingWindowsOverlap(first, separate)).toBe(false);
  });

  it("returns only same-employee overlapping allocations", () => {
    const allocations = [
      { employeeName: "Vineeth Vijayan", bookingId: "BK-1" },
      { employeeName: "Vineeth Vijayan", bookingId: "BK-3" },
      { employeeName: "Another employee", bookingId: "BK-2" },
    ];
    expect(findEmployeeBookingConflicts("Vineeth Vijayan", "BK-2", [first, overlapping, separate], allocations)).toEqual([first]);
    expect(findEmployeeBookingConflicts("Vineeth Vijayan", "BK-1", [first, overlapping, separate], [
      { employeeName: "Vineeth Vijayan", bookingId: "BK-2" },
    ])).toEqual([overlapping]);
  });

  it("toggles one employee-booking allocation without touching others", () => {
    const current = [{ employeeName: "Vineeth Vijayan", bookingId: "BK-1" }, { employeeName: "Amal Krishnan", bookingId: "BK-2" }];
    expect(toggleEmployeeBookingAllocation(current, "Vineeth Vijayan", "BK-2")).toEqual([
      ...current,
      { employeeName: "Vineeth Vijayan", bookingId: "BK-2" },
    ]);
    expect(toggleEmployeeBookingAllocation(current, "Vineeth Vijayan", "BK-1")).toEqual([{ employeeName: "Amal Krishnan", bookingId: "BK-2" }]);
  });
});
