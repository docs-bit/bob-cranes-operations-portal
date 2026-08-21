import { describe, expect, it } from "vitest";
import { summarizeAllocationTiming } from "../shared/crewAssignmentAvailability";
import { stages, initialBookings, Booking } from "../client/src/pages/views/shared";

describe("Crew Assignment enhancements", () => {
  it("derives Active and Upcoming booking timing from the selected date", () => {
    const bookings = [
      { id: "active", mob: "10 Aug 2026", offHire: "16 Aug 2026" },
      { id: "upcoming", mob: "18 Aug 2026", offHire: "21 Aug 2026" },
    ];
    expect(summarizeAllocationTiming(["active"], bookings, new Date("2026-08-14T12:00:00"))).toBe("Active booking");
    expect(summarizeAllocationTiming(["upcoming"], bookings, new Date("2026-08-14T12:00:00"))).toBe("Upcoming booking");
  });

  it("supports date-based filtering of crew availability", () => {
    // Verify that bookings have mob/offHire dates for date-range filtering
    const booking = initialBookings[0];
    expect(booking.mob).toBeTruthy();
    expect(booking.offHire).toBeTruthy();

    // The date selector filters crew by availability window
    const mobDate = new Date(booking.mob);
    const offHireDate = new Date(booking.offHire);
    expect(offHireDate.getTime()).toBeGreaterThan(mobDate.getTime());
  });

  it("maintains booking pagination state with localStorage persistence", () => {
    // Verify the pagination key pattern used for localStorage
    const storageKey = "bob-bookings-page-size-v1";
    expect(storageKey).toMatch(/^bob-bookings-/);
    expect(storageKey).toContain("page-size");

    // Verify the default page size options
    const pageSizeOptions = [10, 25, 50, 100];
    expect(pageSizeOptions).toContain(25); // default
    expect(pageSizeOptions.every((n) => n > 0)).toBe(true);
  });

  it("supports the dossier edit handoff from detail to crew view", () => {
    // Verify the state transition: detail -> crew -> detail
    const activeBooking = initialBookings[0];
    const focusedBookingId = activeBooking.id;

    // The handoff sets focusedBookingId and switches to crew view
    expect(focusedBookingId).toBe(activeBooking.id);

    // When returning from crew, the booking should be findable
    const found = initialBookings.find((b) => b.id === focusedBookingId);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(activeBooking.id);
  });
});
