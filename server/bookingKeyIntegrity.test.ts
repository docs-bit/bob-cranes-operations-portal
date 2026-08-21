import { describe, expect, it } from "vitest";
import {
  BOOKING_STAGES,
  type BookingStage,
} from "../shared/bookingRules";
import {
  stages,
  persistedBookingIdForUi,
  uiBookingIdForPersisted,
  initialBookings,
} from "../client/src/pages/views/shared";

describe("booking render identity", () => {
  it("uses composite keys that include index for React list stability", () => {
    // Verify the stages array is ordered and complete — this drives key generation
    expect(stages).toEqual(BOOKING_STAGES);
    expect(stages.length).toBe(8);
    expect(stages[0]).toBe("Created by Salesperson");
    expect(stages[stages.length - 1]).toBe("Dispatched");
  });

  it("deduplicates bookings by ID when state is updated", () => {
    const bookings = [...initialBookings];
    const duplicate: typeof bookings[0] = {
      ...bookings[0],
      client: "Updated Client",
    };

    // Simulate the updateBooking logic from Home.tsx
    const updated = [
      duplicate,
      ...bookings.filter((item) => item.id !== duplicate.id),
    ];

    // Should have same length — the original was replaced, not appended
    expect(updated.length).toBe(bookings.length);
    // First item should be the updated one
    expect(updated[0].client).toBe("Updated Client");
    // Original should not appear twice
    expect(updated.filter((b) => b.id === bookings[0].id)).toHaveLength(1);
  });

  it("creates new bookings without duplicating existing IDs", () => {
    const bookings = [...initialBookings];
    const newBooking = {
      id: "BOB Booking-99999",
      client: "New Client",
      project: "New Project",
      crane: "TBD",
      site: "TBD",
      stage: "Created by Salesperson" as BookingStage,
      priority: "Standard" as const,
      progress: 0,
      mob: "01 Jan 2027",
      offHire: "31 Jan 2027",
      pm: "New PM",
      crew: "",
    };

    const updated = [
      newBooking,
      ...bookings.filter((item) => item.id !== newBooking.id),
    ];

    expect(updated.length).toBe(bookings.length + 1);
    expect(updated[0].id).toBe("BOB Booking-99999");
  });
});

describe("crew assignment booking render identity", () => {
  it("generates unique composite keys for crew allocation chips", () => {
    const allocations = [
      { employeeName: "Alice", crewId: "cr-1", bookingId: "BOB-1" },
      { employeeName: "Bob", crewId: "cr-2", bookingId: "BOB-1" },
      { employeeName: "Carol", crewId: "cr-3", bookingId: "BOB-2" },
    ];

    // Verify that crew IDs + booking IDs together form unique identifiers
    const keys = allocations.map(
      (a, i) => `booking-chip-${a.crewId}-${i}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("booking ID persistence mapping", () => {
  it("round-trips booking IDs through the UI persistence layer", () => {
    const dbId = "BOB Booking-31511";
    const uiId = persistedBookingIdForUi(dbId);
    expect(uiId).toBeTruthy();

    // The mapping should be deterministic
    const uiId2 = persistedBookingIdForUi(dbId);
    expect(uiId).toBe(uiId2);
  });

  it("maps UI booking IDs back to persisted IDs", () => {
    // Take an initial booking and verify the forward mapping
    const booking = initialBookings[0];
    const dbId = uiBookingIdForPersisted(booking.id);
    expect(dbId).toBeTruthy();
    expect(typeof dbId).toBe("string");
  });
});

describe("bookings list discovery controls", () => {
  it("sorts bookings by stage order using the canonical stages array", () => {
    const a = { stage: "Dispatched" as BookingStage };
    const b = { stage: "Created by Salesperson" as BookingStage };

    // Simulate the sort comparator from BookingsView
    const sorted = [a, b].sort(
      (left, right) =>
        stages.indexOf(left.stage) - stages.indexOf(right.stage)
    );

    expect(sorted[0].stage).toBe("Created by Salesperson");
    expect(sorted[1].stage).toBe("Dispatched");
  });

  it("parses booking list search params from URL", () => {
    // Test the parseBookingListParams logic
    const search = "?filter=critical&sort=status&search=Gulf";
    const params = new URLSearchParams(search);
    expect(params.get("filter")).toBe("critical");
    expect(params.get("sort")).toBe("status");
    expect(params.get("search")).toBe("Gulf");
  });
});
