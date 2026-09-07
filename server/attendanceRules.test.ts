import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_STATUSES,
  computeMonthlyAttendanceSummary,
  timeOrderWarning,
  updateAttendance,
} from "@shared/attendanceRules";

describe("attendanceRules", () => {
  it("offers half-day and late statuses", () => {
    expect(ATTENDANCE_STATUSES).toContain("Half-day");
    expect(ATTENDANCE_STATUSES).toContain("Late");
    expect(
      updateAttendance({}, "Asha", "Half-day")
    ).toEqual({ Asha: "Half-day" });
  });

  it("warns when check-out precedes check-in without blocking", () => {
    expect(timeOrderWarning("08:00", "07:30")).toContain("earlier");
    expect(timeOrderWarning("08:00", "18:00")).toBeNull();
    expect(timeOrderWarning(undefined, "18:00")).toBeNull();
    expect(timeOrderWarning("8am", "6pm")).toBeNull();
  });

  it("counts half-day as partial work and late as worked", () => {
    const rows = computeMonthlyAttendanceSummary(
      [{ name: "Asha", role: "Rigger" }],
      {
        "2026-08-01": { Asha: "Half-day" },
        "2026-08-02": { Asha: "Late" },
        "2026-08-03": { Asha: "On Leave" },
      },
      ["2026-08-01", "2026-08-02", "2026-08-03"]
    );
    expect(rows[0].daysWorked).toBe(1.5);
    expect(rows[0].daysOnLeave).toBe(1);
    expect(rows[0].absences).toBe(0);
  });
});
