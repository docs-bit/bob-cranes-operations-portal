import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("booking render identity", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("does not use a booking ID alone as a React key", () => {
    expect(homeSource).not.toMatch(/key=\{booking\.id\}/);
    expect(homeSource).toContain("key={`booking-table-${booking.id}-${index}`}");
    expect(homeSource).toContain("key={`department-queue-${booking.id}-${index}`}");
    expect(homeSource).toContain("key={`handoff-${booking.id}-${index}`}");
  });

  it("replaces an existing dossier when booking state is updated or created", () => {
    expect(homeSource).toContain("current.filter(item => item.id !== nextBooking.id)");
    expect(homeSource).toContain("current.filter(item => item.id !== booking.id)");
    expect(homeSource).toContain("new Map(initialBookings.map(booking => [booking.id, booking]))");
  });
});

describe("crew assignment booking render identity", () => {
  const crewSource = readFileSync(resolve(process.cwd(), "client/src/components/CrewAssignmentWorkspace.tsx"), "utf8");

  it("does not use repeated booking IDs as standalone React keys", () => {
    expect(crewSource).not.toContain("<BookingIdChip key={id}");
    expect(crewSource).not.toContain("key={booking.id}");
    expect(crewSource).toContain("key={`booking-chip-${id}-${index}`}");
    expect(crewSource).toContain("key={`booking-allocation-${booking.id}-${index}`}");
  });
});

describe("bookings list discovery controls", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("supports dossier search and all requested sort dimensions", () => {
    expect(homeSource).toContain("aria-label=\"Search booking dossiers by client, project, or booking ID\"");
    expect(homeSource).toContain("value=\"date-asc\">Mobilization date · earliest");
    expect(homeSource).toContain("value=\"status\">Workflow status");
    expect(homeSource).toContain("value=\"id-asc\">Booking ID · A–Z");
    expect(homeSource).toContain("stages.indexOf(left.stage) - stages.indexOf(right.stage)");
  });

  it("renders a table-shaped loading skeleton while bookings hydrate", () => {
    expect(homeSource).toContain("function BookingsListSkeleton()");
    expect(homeSource).toContain("isLoading ? (");
    expect(homeSource).toContain("bookings-list-skeleton");
    expect(homeSource).toContain("setBookingsLoading(false)");
  });

  it("provides an illustrated empty state, shareable URL controls, and filtered CSV export", () => {
    expect(homeSource).toContain("function BookingsEmptyState(");
    expect(homeSource).toContain("parseBookingListParams(locationSearch)");
    expect(homeSource).toContain("window.history.replaceState(window.history.state, \"\", nextLocation)");
    expect(homeSource).toContain("aria-label=\"Export filtered booking dossiers to CSV\"");
    expect(homeSource).toContain("bob-bookings-${filter}-${sortBy}-");
  });
});
