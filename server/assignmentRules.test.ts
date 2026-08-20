import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignedEmployeeForBooking, focusAssignmentBooking } from "@shared/assignmentRules";
import { toggleEmployeeBookingAllocation } from "@shared/bookingConflictRules";

describe("assignment editor focus rules", () => {
  const bookings = [{ id: "BOB Booking-31511", client: "Gulf Contracting" }, { id: "BOB Booking-31482", client: "Mak Force" }];

  it("moves the requested dossier to the front without mutating the source list", () => {
    const focused = focusAssignmentBooking(bookings, "BOB Booking-31482");
    expect(focused.map((booking) => booking.id)).toEqual(["BOB Booking-31482", "BOB Booking-31511"]);
    expect(bookings.map((booking) => booking.id)).toEqual(["BOB Booking-31511", "BOB Booking-31482"]);
  });

  it("resolves the first assigned employee for the requested dossier", () => {
    expect(assignedEmployeeForBooking([
      { employeeName: "Vineeth Vijayan", bookingId: "BOB Booking-31511" },
      { employeeName: "Amal Krishnan", bookingId: "BOB Booking-31482" },
    ], "BOB Booking-31511")).toBe("Vineeth Vijayan");
    expect(assignedEmployeeForBooking([], "BOB Booking-31511")).toBeNull();
  });

  it("keeps the Assignment UI handoff and dossier refresh wiring connected", () => {
    const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const detailSource = readFileSync(new URL("../client/src/pages/views/BookingDetail.tsx", import.meta.url), "utf8");
    expect(homeSource).toContain("onEditAssignment");
    expect(homeSource).toContain("focusedBookingId={focusedAssignmentBookingId}");
    expect(homeSource).toContain("onAllocationSaved");
    expect(homeSource).toContain("assignmentSavedMessage={assignmentSavedMessage}");
    expect(detailSource).toContain("const dossierCrew = assignedCrew.length");
    expect(detailSource).toContain("? assignedCrew");
    expect(detailSource).toContain(": legacyCrews.slice(0, 4)");
    expect(detailSource).toContain("allocation.crewId === crew.id");
    expect(detailSource).toContain("allocation.employeeName === crew.name");
  });

  it("supports the save handler's assign then remove cycle without mutating prior state", () => {
    const initial = [{ employeeName: "Vineeth Vijayan", bookingId: "BOB Booking-31511", crewId: "crew-1" }];
    const added = toggleEmployeeBookingAllocation(initial, "Vineeth Vijayan", "BOB Booking-31482", "crew-1");
    expect(added).toHaveLength(2);
    expect(initial).toHaveLength(1);
    const removed = toggleEmployeeBookingAllocation(added, "Vineeth Vijayan", "BOB Booking-31511", "crew-1");
    expect(removed).toEqual([{ employeeName: "Vineeth Vijayan", bookingId: "BOB Booking-31482", crewId: "crew-1" }]);
  });
});
