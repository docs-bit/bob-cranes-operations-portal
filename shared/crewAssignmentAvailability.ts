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
