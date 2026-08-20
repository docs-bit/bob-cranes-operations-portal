export type CrewAvailability = "Present" | "On Leave" | "Assigned" | "Off-Site";

/**
 * Booking allocations are the source of truth for the Assigned label. Legacy
 * attendance data can contain Assigned without a corresponding allocation;
 * those records are treated as Present until a real allocation is persisted.
 */
export function allocationAwareAvailability(
  attendanceAvailability: CrewAvailability,
  hasPersistedAllocation: boolean
): CrewAvailability {
  if (hasPersistedAllocation) return "Assigned";
  return attendanceAvailability === "Assigned" ? "Present" : attendanceAvailability;
}

export type AllocationTiming =
  | "Active booking"
  | "Upcoming booking"
  | "Completed booking"
  | "Scheduled booking";

type DatedBooking = { id: string; mob: string; offHire: string };

/**
 * Classifies the latest relevant assignment by its real booking dates. Active
 * takes precedence over upcoming, so employees on-site are never obscured by
 * a later planned allocation.
 */
export function summarizeAllocationTiming(
  bookingIds: string[],
  bookings: DatedBooking[],
  referenceDate = new Date()
): AllocationTiming {
  const allocationBookings = bookingIds
    .map(id => bookings.find(booking => booking.id === id))
    .filter((booking): booking is DatedBooking => Boolean(booking));

  if (!allocationBookings.length) return "Scheduled booking";

  const hasActive = allocationBookings.some(booking => {
    const start = new Date(booking.mob).getTime();
    const end = new Date(booking.offHire).getTime();
    const now = referenceDate.getTime();
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
  });
  if (hasActive) return "Active booking";

  const hasUpcoming = allocationBookings.some(booking => {
    const start = new Date(booking.mob).getTime();
    return Number.isFinite(start) && start > referenceDate.getTime();
  });
  if (hasUpcoming) return "Upcoming booking";

  const allCompleted = allocationBookings.every(booking => {
    const end = new Date(booking.offHire).getTime();
    return Number.isFinite(end) && end < referenceDate.getTime();
  });
  return allCompleted ? "Completed booking" : "Scheduled booking";
}
