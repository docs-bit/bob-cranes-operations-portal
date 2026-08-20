import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("booking render identity", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const bookingsSource = readFileSync(resolve(process.cwd(), "client/src/pages/views/BookingsView.tsx"), "utf8");
  const deptSource = readFileSync(resolve(process.cwd(), "client/src/pages/views/DepartmentView.tsx"), "utf8");

  it("does not use a booking ID alone as a React key", () => {
    expect(bookingsSource).not.toMatch(/key=\{booking\.id\}/);
    expect(bookingsSource).toContain("key={`booking-table-${booking.id}-${index}`}");
    expect(deptSource).toContain("key={`department-queue-${booking.id}-${index}`}");
    expect(deptSource).toContain("key={`handoff-${booking.id}-${index}`}");
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

  it("includes status color-coding, hover summaries, and a clear filters action", () => {
    expect(crewSource).toContain("status-${tone}");
    expect(crewSource).toContain("TooltipContent");
    expect(crewSource).toContain("Clear filters");
  });
});

describe("bookings list discovery controls", () => {
  const bookingsSource = readFileSync(resolve(process.cwd(), "client/src/pages/views/BookingsView.tsx"), "utf8");

  it("supports dossier search and all requested sort dimensions", () => {
    expect(bookingsSource).toContain("aria-label=\"Search booking dossiers by client, project, or booking ID\"");
    expect(bookingsSource).toContain("value=\"date-asc\">Mobilization date · earliest");
    expect(bookingsSource).toContain("value=\"status\">Workflow status");
    expect(bookingsSource).toContain("value=\"id-asc\">Booking ID · A–Z");
    expect(bookingsSource).toContain("stages.indexOf(left.stage) - stages.indexOf(right.stage)");
  });

  it("renders a table-shaped loading skeleton while bookings hydrate", () => {
    expect(bookingsSource).toContain("function BookingsListSkeleton()");
    expect(bookingsSource).toContain("isLoading ? (");
    expect(bookingsSource).toContain("bookings-list-skeleton");
    expect(bookingsSource).toContain("setBookingsLoading(false)");
  });

  it("provides an illustrated empty state, shareable URL controls, and filtered CSV export", () => {
    expect(bookingsSource).toContain("function BookingsEmptyState(");
    expect(bookingsSource).toContain("parseBookingListParams(locationSearch)");
    expect(bookingsSource).toContain("window.history.replaceState(window.history.state, \"\", nextLocation)");
    expect(bookingsSource).toContain("aria-label=\"Export filtered booking dossiers to CSV\"");
    expect(bookingsSource).toContain("bob-bookings-${filter}-${sortBy}-");
  });
});
