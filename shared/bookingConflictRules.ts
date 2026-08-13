export type BookingWindow = {
  id: string;
  mob: string;
  offHire: string;
};

export type EmployeeAllocation = {
  employeeName: string;
  bookingId: string;
  crewId?: string;
};

function parseDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function bookingWindowsOverlap(first: BookingWindow, second: BookingWindow) {
  const firstStart = parseDate(first.mob);
  const firstEnd = parseDate(first.offHire);
  const secondStart = parseDate(second.mob);
  const secondEnd = parseDate(second.offHire);
  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) return false;
  return firstStart! <= secondEnd! && secondStart! <= firstEnd!;
}

export function findEmployeeBookingConflicts(
  employeeName: string,
  targetBookingId: string,
  bookings: BookingWindow[],
  allocations: EmployeeAllocation[],
) {
  const target = bookings.find((booking) => booking.id === targetBookingId);
  if (!target) return [];
  const allocatedBookingIds = allocations
    .filter((allocation) => allocation.employeeName === employeeName && allocation.bookingId !== targetBookingId)
    .map((allocation) => allocation.bookingId);
  return bookings.filter((booking) => allocatedBookingIds.includes(booking.id) && bookingWindowsOverlap(target, booking));
}

export function toggleEmployeeBookingAllocation(
  allocations: EmployeeAllocation[],
  employeeName: string,
  bookingId: string,
  crewId?: string,
) {
  const exists = allocations.some((allocation) => allocation.employeeName === employeeName && allocation.bookingId === bookingId);
  return exists
    ? allocations.filter((allocation) => !(allocation.employeeName === employeeName && allocation.bookingId === bookingId))
    : [...allocations, { employeeName, bookingId, ...(crewId ? { crewId } : {}) }];
}
