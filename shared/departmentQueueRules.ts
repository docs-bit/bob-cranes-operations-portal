import type { DepartmentCode } from "./departmentAccess";

// Pure department-queue rules (PRD v3.0 §8 shared pattern).
// Maps each booking stage to the department that owns the next action.
// Side-effect free: safe for import by both client and server.

export type QueueStage =
  | "Created by Salesperson"
  | "Documentation Supervisor"
  | "Crew Assigned"
  | "Gear Confirmed"
  | "Docs In Progress"
  | "All Docs Submitted"
  | "Reviewed"
  | "Dispatched";

export const STAGE_OWNER: Record<QueueStage, DepartmentCode | null> = {
  "Created by Salesperson": "sales",
  "Documentation Supervisor": "documentation",
  "Crew Assigned": "crew",
  "Gear Confirmed": "lifting-gears",
  "Docs In Progress": null,
  "All Docs Submitted": "documentation",
  Reviewed: "sales",
  Dispatched: null,
};

export type QueueBooking = {
  id: string;
  client: string;
  project: string;
  stage: QueueStage;
  priority: "Standard" | "High" | "Critical";
  mob: string;
};

export type QueueItem = QueueBooking & {
  daysToMob: number | null;
  urgency: "overdue" | "due-soon" | "normal";
};

const DAY_MS = 86_400_000;

function parseMob(mob: string, nowMs: number): number | null {
  const direct = Date.parse(mob);
  if (!Number.isNaN(direct)) return Math.ceil((direct - nowMs) / DAY_MS);
  const match = mob.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (!match) return null;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Number(match[3]), month, Number(match[1]));
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - nowMs) / DAY_MS);
}

/**
 * Bookings whose next action belongs to `departmentCode`,
 * oldest mobilization first. Docs In Progress and Dispatched are
 * parallel/terminal states with no single owner and are excluded.
 */
export function pendingForDepartment<T extends QueueBooking>(
  bookings: T[],
  departmentCode: DepartmentCode,
  nowMs: number = Date.now()
): Array<T & { daysToMob: number | null; urgency: QueueItem["urgency"] }> {
  return bookings
    .filter(booking => STAGE_OWNER[booking.stage] === departmentCode)
    .map(booking => {
      const daysToMob = parseMob(booking.mob, nowMs);
      const urgency =
        daysToMob !== null && daysToMob < 0
          ? ("overdue" as const)
          : daysToMob !== null && daysToMob <= 7
            ? ("due-soon" as const)
            : ("normal" as const);
      return { ...booking, daysToMob, urgency };
    })
    .sort((a, b) => (a.daysToMob ?? Number.MAX_SAFE_INTEGER) - (b.daysToMob ?? Number.MAX_SAFE_INTEGER));
}
