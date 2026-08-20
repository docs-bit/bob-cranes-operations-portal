import { ATTENDANCE_CREW_ROSTER } from "./attendanceCrewRoster";

export type CrewAssignmentMember = (typeof ATTENDANCE_CREW_ROSTER)[number];

export const LEGACY_CREW_ASSIGNMENT_ROSTER: CrewAssignmentMember[] = [
  { id: "cr-1", sourceId: "legacy-cr-1", name: "Vineeth Vijayan", role: "Crane Operator", availability: "Present", cert: "Valid · 12 Mar 2027", initials: "VV", flag: false, department: "Operational Crew" },
  { id: "cr-2", sourceId: "legacy-cr-2", name: "Anoop Panikashery", role: "Crane Operator", availability: "Assigned", cert: "Valid · 09 Feb 2027", initials: "AP", flag: false, department: "Operational Crew" },
  { id: "cr-3", sourceId: "legacy-cr-3", name: "Vijayakumar", role: "Rigger", availability: "Present", cert: "Renewal due in 16 days", initials: "VK", flag: true, department: "Operational Crew" },
  { id: "cr-4", sourceId: "legacy-cr-4", name: "Amal Krishnan", role: "Rigger", availability: "Present", cert: "Valid · 28 Nov 2026", initials: "AK", flag: false, department: "Operational Crew" },
  { id: "cr-5", sourceId: "legacy-cr-5", name: "Ramesh Babu", role: "Banksman", availability: "On Leave", cert: "Valid · 10 Jan 2027", initials: "RB", flag: false, department: "Operational Crew" },
  { id: "cr-6", sourceId: "legacy-cr-6", name: "Shahid Khan", role: "Site Supervisor", availability: "Off-Site", cert: "Training required", initials: "SK", flag: true, department: "Operational Crew" },
];

export const CREW_ASSIGNMENT_ROSTER: CrewAssignmentMember[] = [
  ...LEGACY_CREW_ASSIGNMENT_ROSTER,
  ...ATTENDANCE_CREW_ROSTER,
];

export function isKnownCrewAssignmentMember(id: string, name: string) {
  return CREW_ASSIGNMENT_ROSTER.some((employee) => employee.id === id && employee.name === name);
}
