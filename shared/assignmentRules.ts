export type AssignmentBooking = { id: string };

export type AssignmentAllocation = {
  employeeName: string;
  bookingId: string;
};

export function focusAssignmentBooking<T extends AssignmentBooking>(bookings: T[], bookingId?: string | null) {
  if (!bookingId) return bookings;
  const focused = bookings.find((booking) => booking.id === bookingId);
  return focused ? [focused, ...bookings.filter((booking) => booking.id !== bookingId)] : bookings;
}

export function assignedEmployeeForBooking(
  allocations: AssignmentAllocation[],
  bookingId?: string | null,
) {
  if (!bookingId) return null;
  return allocations.find((allocation) => allocation.bookingId === bookingId)?.employeeName ?? null;
}
