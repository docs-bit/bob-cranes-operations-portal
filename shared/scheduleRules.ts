import { parseDossierDate } from "./dossierDates";

// Pure pre-booking conflict rules (PRD v3.0 §12.2).
// Side-effect free: safe for import by both client and server.

export type DatedEntry = {
  id: string;
  title: string;
  date: string;
  durationDays?: number | null;
};

export type BookingWindow = {
  id: string;
  mob: string;
  offHire?: string | null;
};

export type ScheduleConflict = {
  entryId: string;
  bookingId: string;
  detail: string;
};

function toDayRange(
  start: string,
  durationDays: number | null | undefined,
  offHire?: string | null
): { from: number; to: number } | null {
  const from = parseDossierDate(start)?.getTime();
  if (from === undefined || from === null || Number.isNaN(from)) return null;
  let to = from + Math.max(1, durationDays ?? 1) * 86_400_000;
  if (offHire) {
    const off = parseDossierDate(offHire)?.getTime();
    if (off !== undefined && off !== null && !Number.isNaN(off) && off > from)
      to = off;
  }
  return { from, to };
}

/**
 * Warn (never block here — the caller decides) when a scheduled entry
 * overlaps a real booking window or another scheduled entry.
 */
export function findScheduleConflicts(
  entries: DatedEntry[],
  bookings: BookingWindow[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const entryRanges = new Map(
    entries.map(entry => [
      entry.id,
      toDayRange(entry.date, entry.durationDays ?? 1),
    ])
  );
  for (const entry of entries) {
    const range = entryRanges.get(entry.id);
    if (!range) continue;
    for (const booking of bookings) {
      const window = toDayRange(booking.mob, null, booking.offHire);
      if (!window) continue;
      if (range.from < window.to && window.from < range.to) {
        conflicts.push({
          entryId: entry.id,
          bookingId: booking.id,
          detail: `"${entry.title}" overlaps booking ${booking.id}.`,
        });
      }
    }
    for (const other of entries) {
      if (other.id >= entry.id) continue;
      const otherRange = entryRanges.get(other.id);
      if (!otherRange) continue;
      if (range.from < otherRange.to && otherRange.from < range.to) {
        conflicts.push({
          entryId: entry.id,
          bookingId: other.id,
          detail: `"${entry.title}" overlaps scheduled "${other.title}".`,
        });
      }
    }
  }
  return conflicts;
}
