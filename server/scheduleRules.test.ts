import { describe, expect, it } from "vitest";
import { findScheduleConflicts } from "@shared/scheduleRules";

describe("scheduleRules", () => {
  it("warns on overlapping booking windows", () => {
    const conflicts = findScheduleConflicts(
      [
        { id: "s1", title: "Tower pre-book", date: "2026-08-12", durationDays: 3 },
        { id: "s2", title: "Yard standby", date: "2026-09-01", durationDays: 1 },
      ],
      [{ id: "BOB-1", mob: "11 Aug 2026", offHire: "18 Aug 2026" }]
    );
    expect(conflicts.map(item => item.entryId)).toEqual(["s1"]);
    expect(conflicts[0].bookingId).toBe("BOB-1");
  });

  it("warns on overlapping scheduled entries", () => {
    const conflicts = findScheduleConflicts(
      [
        { id: "a", title: "First", date: "2026-08-12", durationDays: 2 },
        { id: "b", title: "Second", date: "2026-08-13", durationDays: 2 },
      ],
      []
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].detail).toContain("Second");
  });

  it("ignores unparseable dates", () => {
    expect(
      findScheduleConflicts(
        [{ id: "x", title: "Vague", date: "sometime", durationDays: 1 }],
        [{ id: "BOB-1", mob: "garbage", offHire: null }]
      )
    ).toEqual([]);
  });
});
