import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { summarizeAllocationTiming } from "../shared/crewAssignmentAvailability";

const workspace = readFileSync(
  new URL("../client/src/components/CrewAssignmentWorkspace.tsx", import.meta.url),
  "utf8"
);
const home = readFileSync(
  new URL("../client/src/pages/Home.tsx", import.meta.url),
  "utf8"
);
const bookingsView = readFileSync(
  new URL("../client/src/pages/views/BookingsView.tsx", import.meta.url),
  "utf8"
);
const overviewView = readFileSync(
  new URL("../client/src/pages/views/Overview.tsx", import.meta.url),
  "utf8"
);

describe("Crew Assignment enhancements", () => {
  it("derives Active and Upcoming booking timing from the selected date", () => {
    const bookings = [
      { id: "active", mob: "10 Aug 2026", offHire: "16 Aug 2026" },
      { id: "upcoming", mob: "18 Aug 2026", offHire: "21 Aug 2026" },
    ];
    expect(summarizeAllocationTiming(["active"], bookings, new Date("2026-08-14T12:00:00"))).toBe("Active booking");
    expect(summarizeAllocationTiming(["upcoming"], bookings, new Date("2026-08-14T12:00:00"))).toBe("Upcoming booking");
  });

  it("exposes the requested date selector, saved search controls, and clickable booking chips", () => {
    expect(workspace).toContain('aria-label="Filter crew availability by date"');
    expect(workspace).toContain('aria-label="Saved search name"');
    expect(workspace).toContain("localStorage.setItem(PRESET_STORAGE_KEY");
    expect(workspace).toContain('aria-label={`Open ${bookingId} dossier');
    expect(workspace).toContain("BookingIdChip");
    expect(workspace).toContain("onOpen={onOpenDossier}");
    expect(workspace).toContain("BookingDetailsDialog");
    expect(workspace).toContain("View Details");
    expect(workspace).toContain("Clear filters (");
    expect(workspace).toContain("quickStatusFilter");
    expect(workspace).toContain("draggable");
    expect(workspace).toContain("statusCounts");
    expect(workspace).toContain("Edit Booking");
    expect(workspace).toContain('aria-label="Search available crew members by name or role"');
    expect(workspace).toContain('label: "Undo"');
    expect(workspace).toContain('aria-label="Filter available crew by current availability"');
    expect(workspace).toContain('aria-label="Filter crew by role"');
    expect(workspace).toContain("matchesRole");
    expect(workspace).toContain("Confirm undo assignment");
    expect(workspace).toContain("Confirm undo");
    expect(bookingsView).toContain("booking-pagination");
    expect(bookingsView).toContain("paginatedBookings");
    expect(bookingsView).toContain("Bookings per page");
    expect(bookingsView).toContain('<option value={50}>50</option>');
    expect(bookingsView).toContain("bob-bookings-page-size-v1");
    expect(workspace).toContain("UndoAssignmentToast");
    expect(workspace).toContain("Undo available for");
    expect(workspace).toContain("exportFilteredBookingsCsv");
    expect(workspace).toContain("Export bookings CSV");
    expect(workspace).toContain("undo-toast-progress");
    expect(overviewView).toContain('data-testid="operations-quick-summary"');
    expect(overviewView).toContain("active bookings");
    expect(overviewView).toContain("crew available today");
    expect(bookingsView).toContain("embedBobFullLogo");
    expect(bookingsView).toContain("Generated: ${generatedAt}");
    expect(overviewView).toContain('data-tooltip="Open Booking Dossiers · active bookings"');
    expect(overviewView).toContain('data-tooltip="Open Crew Assignment · available today"');
  });

  it("preserves flexible assignment editing for both available and already-assigned employees", () => {
    expect(workspace).toContain("Select multiple available or assigned employees");
    expect(workspace).toContain('const [availability, setAvailability] = useState<Availability>("All")');
    expect(home).toContain("setFocusedAssignmentBookingId(activeBooking.id)");
    expect(home).toContain("onOpenDossier={(bookingId) => {");
  });
});
