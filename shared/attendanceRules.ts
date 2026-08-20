export const ATTENDANCE_STATUSES = ["Present", "On Leave", "Assigned", "Off-Site"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type AttendanceRecord = Record<string, AttendanceStatus>;

export function summarizeAttendance(record: AttendanceRecord) {
  return ATTENDANCE_STATUSES.reduce(
    (summary, status) => {
      summary[status] = Object.values(record).filter((value) => value === status).length;
      return summary;
    },
    {} as Record<AttendanceStatus, number>,
  );
}

export function updateAttendance(record: AttendanceRecord, employeeName: string, status: AttendanceStatus): AttendanceRecord {
  return { ...record, [employeeName]: status };
}

export function attendanceCompletion(record: AttendanceRecord, rosterSize: number) {
  if (rosterSize <= 0) return 0;
  return Math.round((Object.keys(record).length / rosterSize) * 100);
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(date: string, offset: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + offset);
  return dateKey(next);
}

export function formatAttendanceDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function attendanceRosterKey(employee: { name: string; department?: string }, index: number) {
  return `${employee.department ?? "August Roster"}-${employee.name}-${index}`;
}

export function defaultAttendanceRecord(roster: Array<{ name: string; availability: string }>): AttendanceRecord {
  return Object.fromEntries(
    roster.map((employee) => [employee.name, ATTENDANCE_STATUSES.includes(employee.availability as AttendanceStatus) ? employee.availability : "Present"]),
  ) as AttendanceRecord;
}

export function historicalAttendanceRecord(record: AttendanceRecord): AttendanceRecord {
  return {
    ...record,
    "Anoop Panikashery": "Present",
    "Ramesh Babu": "On Leave",
  };
}

export function computeMonthlyAttendanceSummary(
  roster: Array<{ name: string; department?: string; role: string }>,
  records: Record<string, AttendanceRecord>,
  days: string[]
) {
  return roster.map((employee) => {
    let daysWorked = 0;
    let daysOnLeave = 0;
    let daysOffSite = 0;
    let daysAssigned = 0;
    let unrecorded = 0;

    for (const day of days) {
      const record = records[day];
      const status = record?.[employee.name];
      if (!status) {
        unrecorded++;
      } else if (status === "Present") {
        daysWorked++;
      } else if (status === "On Leave") {
        daysOnLeave++;
      } else if (status === "Off-Site") {
        daysOffSite++;
      } else if (status === "Assigned") {
        daysAssigned++;
      }
    }

    const recordedDays = days.length - unrecorded;
    const absences = Math.max(0, recordedDays - (daysWorked + daysOnLeave + daysOffSite + daysAssigned));

    return {
      name: employee.name,
      department: employee.department ?? "August Roster",
      role: employee.role,
      daysWorked,
      daysOnLeave,
      daysOffSite,
      daysAssigned,
      absences,
      unrecorded,
      totalRecorded: days.length,
    };
  });
}

export type AttendanceSummary = ReturnType<typeof summarizeAttendance>;
