import type { EmployeeAllocation } from "./bookingConflictRules";

export type TimelineBooking = { id: string; mob: string; offHire: string };
export type CrewIdentity = { id: string; name: string };

function isCrewAllocation(crew: CrewIdentity, allocation: EmployeeAllocation) {
  return allocation.crewId ? allocation.crewId === crew.id : allocation.employeeName === crew.name;
}

function toDate(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function dateRangesOverlap(left: TimelineBooking, right: TimelineBooking) {
  return toDate(left.mob) <= toDate(right.offHire) && toDate(right.mob) <= toDate(left.offHire);
}

export function crewConflictBookings(
  crew: CrewIdentity,
  target: TimelineBooking,
  bookings: TimelineBooking[],
  allocations: EmployeeAllocation[]
) {
  return allocations
    .filter(allocation => isCrewAllocation(crew, allocation) && allocation.bookingId !== target.id)
    .map(allocation => bookings.find(booking => booking.id === allocation.bookingId))
    .filter((booking): booking is TimelineBooking => Boolean(booking))
    .filter(booking => dateRangesOverlap(booking, target));
}

export function buildBulkConflictSummary(
  crew: CrewIdentity[],
  target: TimelineBooking,
  bookings: TimelineBooking[],
  allocations: EmployeeAllocation[]
) {
  return crew.map(member => ({
    crew: member,
    conflicts: crewConflictBookings(member, target, bookings, allocations),
  }));
}
