import { describe, expect, it } from "vitest";
import { attendanceCompletion, attendanceRosterKey, formatAttendanceDate, shiftDate, summarizeAttendance, updateAttendance } from "../shared/attendanceRules";

describe("attendance rules", () => {
  it("summarizes daily employee statuses", () => {
    const record = { A: "Present", B: "On Leave", C: "Assigned", D: "Off-Site" } as const;
    expect(summarizeAttendance(record)).toEqual({ Present: 1, "On Leave": 1, Assigned: 1, "Off-Site": 1 });
    expect(attendanceCompletion(record, 4)).toBe(100);
  });

  it("updates one employee without changing the rest of the record", () => {
    const record = { A: "Present", B: "On Leave" } as const;
    expect(updateAttendance(record, "A", "Assigned")).toEqual({ A: "Assigned", B: "On Leave" });
  });

  it("supports previous-day navigation and stable display formatting", () => {
    expect(shiftDate("2026-08-12", -1)).toBe("2026-08-11");
    expect(shiftDate("2026-08-12", 1)).toBe("2026-08-13");
    expect(formatAttendanceDate("2026-08-12")).toContain("12 Aug 2026");
  });

  it("creates unique roster keys for duplicate source names", () => {
    const first = attendanceRosterKey({ name: "GURPREET SINGH", department: "WORKSHOP AUG 2026" }, 12);
    const second = attendanceRosterKey({ name: "GURPREET SINGH", department: "WORKSHOP AUG 2026" }, 13);
    expect(first).not.toBe(second);
    expect(first).toBe("WORKSHOP AUG 2026-GURPREET SINGH-12");
  });
});
