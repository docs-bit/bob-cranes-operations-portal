import { describe, expect, it } from "vitest";
import { ATTENDANCE_CREW_ROSTER } from "@shared/attendanceCrewRoster";
import { CREW_ASSIGNMENT_ROSTER, isKnownCrewAssignmentMember } from "@shared/crewAssignmentRoster";
import { findEmployeeBookingConflicts, toggleEmployeeBookingAllocation } from "@shared/bookingConflictRules";

describe("attendance-backed Crew Assignment roster", () => {
  it("includes every deduplicated employee from the four August attendance tabs", () => {
    expect(ATTENDANCE_CREW_ROSTER).toHaveLength(807);
    expect(CREW_ASSIGNMENT_ROSTER.length).toBeGreaterThanOrEqual(813);
    expect(ATTENDANCE_CREW_ROSTER.every((employee) => employee.id.startsWith("att-") && employee.sourceId.length > 0 && employee.department.includes("AUG 2026"))).toBe(true);
  });

  it("accepts attendance-backed employee IDs and keeps duplicate names isolated by crew ID", () => {
    const first = ATTENDANCE_CREW_ROSTER[0];
    expect(isKnownCrewAssignmentMember(first.id, first.name)).toBe(true);
    const duplicateName = "GURPREET SINGH";
    const duplicateMembers = ATTENDANCE_CREW_ROSTER.filter((employee) => employee.name === duplicateName);
    if (duplicateMembers.length >= 2) {
      const [firstDuplicate, secondDuplicate] = duplicateMembers;
      const allocations = toggleEmployeeBookingAllocation([], firstDuplicate.name, "BOB Booking-31511", firstDuplicate.id);
      const next = toggleEmployeeBookingAllocation(allocations, secondDuplicate.name, "BOB Booking-31421", secondDuplicate.id);
      expect(next).toHaveLength(2);
      expect(findEmployeeBookingConflicts(secondDuplicate.name, "BOB Booking-31421", [
        { id: "BOB Booking-31511", mob: "11 Aug 2026", offHire: "18 Aug 2026" },
        { id: "BOB Booking-31421", mob: "13 Aug 2026", offHire: "30 Aug 2026" },
      ], next, secondDuplicate.id)).toEqual([]);
    }
  });
});
