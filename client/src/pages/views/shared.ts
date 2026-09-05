import { type DocumentItem } from "@shared/bookingRules";
export type { DocumentItem };
import {
  ATTENDANCE_STATUSES,
  attendanceCompletion,
  attendanceRosterKey,
  computeMonthlyAttendanceSummary,
  dateKey,
  defaultAttendanceRecord,
  formatAttendanceDate,
  historicalAttendanceRecord,
  shiftDate,
  summarizeAttendance,
  updateAttendance,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@shared/attendanceRules";
import {
  canAccessWorkspaceView,
  DEPARTMENTS,
  DEPARTMENT_LABEL_TO_CODE,
  roleLabel,
} from "@shared/departmentAccess";
import {
  canAccessProvisionedDepartmentDashboard,
  DEPARTMENT_DASHBOARD_METRICS,
  DEPARTMENT_DASHBOARD_WIDGETS,
  defaultWorkflowChecklist,
  normalizeDepartmentDashboardConfig,
  type DepartmentDashboardConfig,
  type DepartmentDashboardMetric,
  type DepartmentDashboardWidget,
  type WorkflowChecklistItem,
} from "@shared/departmentDashboardRules";
import {
  findEmployeeBookingConflicts,
  toggleEmployeeBookingAllocation,
  type EmployeeAllocation,
} from "@shared/bookingConflictRules";
import { focusAssignmentBooking } from "@shared/assignmentRules";
import { ATTENDANCE_CREW_ROSTER } from "@shared/attendanceCrewRoster";
import { CREW_ASSIGNMENT_ROSTER } from "@shared/crewAssignmentRoster";
import { AUGUST_ATTENDANCE_ROSTER } from "@shared/augustAttendanceData";
import {
  TRAINING_EMPLOYEES,
  TRAINING_SOURCE_FILE,
  type TrainingEmployee,
  type TrainingStatus,
  type TrainingWorkstream,
} from "@shared/trainingData";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Stage =
  | "Created by Salesperson"
  | "Documentation Supervisor"
  | "Crew Assigned"
  | "Gear Confirmed"
  | "Docs In Progress"
  | "All Docs Submitted"
  | "Reviewed"
  | "Dispatched";

export type View =
  | "overview"
  | "bookings"
  | "wizard"
  | "docs"
  | "crew"
  | "gear"
  | "attendance"
  | "training"
  | "uploads"
  | "detail"
  | "console"
  | "department"
  | "provisioned-dashboard"
  | "sales-enquiries"
  | "users"
  | "supervisor-audit"
  | "web-vitals";

export type Booking = {
  id: string;
  client: string;
  project: string;
  crane: string;
  site: string;
  stage: Stage;
  priority: "Standard" | "High" | "Critical";
  progress: number;
  mob: string;
  offHire: string;
  pm: string;
  crew: string;
};

export type BookingSort = "date-asc" | "date-desc" | "status" | "id-asc" | "id-desc";
export type BookingFilter = "all" | "critical" | "mobilizing";

export type CrewRecord = {
  id: string;
  name: string;
  role: string;
  availability: "Present" | "On Leave" | "Assigned" | "Off-Site";
  cert: string;
  initials: string;
  flag: boolean;
  department?: string;
};

export type GearDocument = {
  name: string;
  url: string;
  key?: string;
  contentType?: string;
  size?: number;
};

export type GearRecord = {
  name: string;
  type: string;
  cert: string;
  expires: string;
  validFrom?: string;
  validUntil?: string;
  status: "Compliant" | "Expired";
  selected: boolean;
  documents?: GearDocument[];
};

export type ClientDocumentTaxonomy = {
  categories: Array<{ name: string }>;
  tags: Array<{ name: string }>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const stages: Stage[] = [
  "Created by Salesperson",
  "Documentation Supervisor",
  "Crew Assigned",
  "Gear Confirmed",
  "Docs In Progress",
  "All Docs Submitted",
  "Reviewed",
  "Dispatched",
];

export const stageShort: Record<Stage, string> = {
  "Created by Salesperson": "Created",
  "Documentation Supervisor": "Doc Supervisor",
  "Crew Assigned": "Crew",
  "Gear Confirmed": "Gear",
  "Docs In Progress": "Docs in progress",
  "All Docs Submitted": "All docs submitted",
  Reviewed: "Reviewed",
  Dispatched: "Dispatched",
};

export const initialBookings: Booking[] = [
  {
    id: "BOB Booking-31511",
    client: "Gulf Contracting LLC",
    project: "Downtown Tower Lift",
    crane: "200T Mobile Crane",
    site: "Dubai Downtown",
    stage: "Docs In Progress",
    priority: "Critical",
    progress: 72,
    mob: "11 Aug 2026",
    offHire: "18 Aug 2026",
    pm: "Rohan Mathew",
    crew: "4 assigned",
  },
  {
    id: "BOB Booking-31482",
    client: "Mak Force Electro Mechanical",
    project: "ETC Building Package",
    crane: "350T Mobile Crane",
    site: "Garhoud",
    stage: "Documentation Supervisor",
    priority: "High",
    progress: 18,
    mob: "14 Aug 2026",
    offHire: "20 Aug 2026",
    pm: "Nishanth Kumar",
    crew: "Awaiting",
  },
  {
    id: "BOB Booking-31421",
    client: "Laing O'Rourke Middle East",
    project: "Airport Expansion",
    crane: "100T Lattice Crane",
    site: "Ajman",
    stage: "Gear Confirmed",
    priority: "High",
    progress: 55,
    mob: "13 Aug 2026",
    offHire: "30 Aug 2026",
    pm: "Sarath Babu",
    crew: "5 assigned",
  },
  {
    id: "BOB Booking-31390",
    client: "Al Hamad Industrial Co.",
    project: "Business Bay Structure",
    crane: "500T Mobile Crane",
    site: "Business Bay",
    stage: "All Docs Submitted",
    priority: "Standard",
    progress: 94,
    mob: "16 Aug 2026",
    offHire: "24 Aug 2026",
    pm: "Nishanth Kumar",
    crew: "6 assigned",
  },
  {
    id: "BOB Booking-31364",
    client: "Hansa Energy",
    project: "Maktoum Airport Works",
    crane: "50T Mobile Crane",
    site: "Dubai South",
    stage: "Crew Assigned",
    priority: "Standard",
    progress: 40,
    mob: "15 Aug 2026",
    offHire: "22 Aug 2026",
    pm: "Sarath Babu",
    crew: "3 assigned",
  },
  {
    id: "BOB Booking-31310",
    client: "NPCC-NMDC Energy",
    project: "Heavy Transport Support",
    crane: "Trailer 1",
    site: "Musaffah",
    stage: "Dispatched",
    priority: "Standard",
    progress: 100,
    mob: "08 Aug 2026",
    offHire: "08 Sep 2026",
    pm: "Manoj P.",
    crew: "2 assigned",
  },
  {
    id: "BOB Booking-31294",
    client: "Al Nasr Contracting",
    project: "Dubai Hills C-149",
    crane: "50T Mobile Crane",
    site: "Dubai Hills",
    stage: "Reviewed",
    priority: "High",
    progress: 100,
    mob: "12 Aug 2026",
    offHire: "19 Aug 2026",
    pm: "Sarath Babu",
    crew: "4 assigned",
  },
  {
    id: "BOB Booking-31266",
    client: "Al Wathba Cement",
    project: "Plant Maintenance Lift",
    crane: "Manlift",
    site: "Mussafah, Abu Dhabi",
    stage: "Created by Salesperson",
    priority: "Standard",
    progress: 0,
    mob: "19 Aug 2026",
    offHire: "24 Aug 2026",
    pm: "Mohammed A.",
    crew: "Awaiting",
  },
  {
    id: "BOB Booking-31218",
    client: "Cool Mechs Technical",
    project: "DIC HVAC Works",
    crane: "130T Mobile Crane",
    site: "Dubai Internet City",
    stage: "Docs In Progress",
    priority: "High",
    progress: 67,
    mob: "18 Aug 2026",
    offHire: "27 Aug 2026",
    pm: "Arun S.",
    crew: "4 assigned",
  },
];

export const persistedBookingIds: Record<string, string> = {
  "BOB Booking-31511": "BOB-59116",
  "BOB Booking-31421": "BOB-59117",
  "BOB Booking-31390": "BOB-59118",
};

export const departmentList = [
  ["Sales & Client", 8, "#e31e24"],
  ["Documentation", 6, "#e31e24"],
  ["Crew Assignment", 5, "#4f9cf9"],
  ["Lifting Gears", 4, "#f2b94b"],
  ["HSE / Safety", 3, "#31b56b"],
  ["Accounts", 2, "#9b7aea"],
  ["Operations Mgmt", 4, "#4f9cf9"],
  ["Transportation", 3, "#f2b94b"],
  ["HR", 2, "#9b7aea"],
  ["Administrator", 1, "#858585"],
] as const;

export const legacyCrews: CrewRecord[] = [
  { id: "cr-1", name: "Vineeth Vijayan", role: "Crane Operator", availability: "Present", cert: "Valid · 12 Mar 2027", initials: "VV", flag: false },
  { id: "cr-2", name: "Anoop Panikashery", role: "Crane Operator", availability: "Assigned", cert: "Valid · 09 Feb 2027", initials: "AP", flag: false },
  { id: "cr-3", name: "Vijayakumar", role: "Rigger", availability: "Present", cert: "Renewal due in 16 days", initials: "VK", flag: true },
  { id: "cr-4", name: "Amal Krishnan", role: "Rigger", availability: "Present", cert: "Valid · 28 Nov 2026", initials: "AK", flag: false },
  { id: "cr-5", name: "Ramesh Babu", role: "Banksman", availability: "On Leave", cert: "Valid · 10 Jan 2027", initials: "RB", flag: false },
  { id: "cr-6", name: "Shahid Khan", role: "Site Supervisor", availability: "Off-Site", cert: "Training required", initials: "SK", flag: true },
];

export const crews: CrewRecord[] = [
  ...legacyCrews,
  ...ATTENDANCE_CREW_ROSTER.filter(
    employee => !legacyCrews.some(legacy => legacy.name.toLowerCase() === employee.name.toLowerCase())
  ),
].sort((first, second) => first.name.localeCompare(second.name));

export const attendanceRoster = AUGUST_ATTENDANCE_ROSTER.map((employee, index) => ({
  name: employee.name,
  role: employee.role,
  availability: employee.availability as AttendanceStatus,
  initials: employee.initials,
  department: employee.department,
  rosterKey: attendanceRosterKey(employee, index),
}));

export const gears: GearRecord[] = [
  { name: "4-leg wire rope sling", type: "Slings · 25T SWL", cert: "INS-2026-218", expires: "28 Sep 2026", status: "Compliant", selected: true },
  { name: "Bow shackle · 35T", type: "Shackles · Grade 8", cert: "INS-2026-411", expires: "19 Dec 2026", status: "Compliant", selected: true },
  { name: "Spreader beam · 60T", type: "Spreader beam", cert: "INS-2025-022", expires: "04 Aug 2026", status: "Expired", selected: false },
  { name: "Swivel hook · 40T", type: "Hooks · Self-locking", cert: "INS-2026-301", expires: "02 Oct 2026", status: "Compliant", selected: false },
];

export const CLIENT_DOCUMENT_CATEGORIES = [
  "Safety & HSE", "Commercial", "Crew & Competency",
  "Access & Permits", "Transport & Delivery", "Other",
] as const;

export const initialUploadDocuments: DocumentItem[] = [
  { id: "doc-1", departmentCode: "documentation", name: "Method statement", state: "Approved", required: true, category: "Safety & HSE", tags: ["method statement", "lift plan"] },
  { id: "doc-2", departmentCode: "hse", name: "Lift plan approval", state: "Approved", required: true, category: "Safety & HSE", tags: ["approval", "lift plan"] },
  { id: "doc-3", departmentCode: "crew", name: "Crew certificates", state: "Uploaded", required: true, category: "Crew & Competency", tags: ["crew", "certificates"] },
  { id: "doc-4", departmentCode: "accounts", name: "Signed LPO · Rev. 2", state: "Uploaded", required: true, category: "Commercial", tags: ["lpo", "commercial"] },
  { id: "doc-5", departmentCode: "documentation", name: "Site access pass", state: "Required", required: true, category: "Access & Permits", tags: ["site access", "permit"] },
  { id: "doc-6", departmentCode: "accounts", name: "Trade license", state: "Uploaded", required: true, category: "Commercial", tags: ["trade license", "company"] },
  { id: "doc-7", departmentCode: "transportation", name: "Delivery note", state: "Required", required: true, category: "Transport & Delivery", tags: ["delivery note", "transport"] },
];

export const PARALLEL_WORKSTREAMS = ["maintenance", "hse", "accounts", "hr", "transportation"] as const;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function persistedBookingIdForUi(id: string) {
  return persistedBookingIds[id] ?? null;
}

export function uiBookingIdForPersisted(id: string) {
  return Object.entries(persistedBookingIds).find(([, persistedId]) => persistedId === id)?.[0] ?? id;
}

export function allocationMatchesCrew(allocation: EmployeeAllocation, crew: Pick<CrewRecord, "id" | "name">) {
  return allocation.crewId ? allocation.crewId === crew.id : allocation.employeeName === crew.name;
}

export function initials(value: string) {
  return value.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

export function statusTone(value: string) {
  if (value === "Compliant" || value === "Present" || value === "Dispatched") return "green";
  if (value === "Expired" || value === "Critical" || value === "Training required") return "red";
  if (value === "Assigned" || value === "High" || value === "Renewal due in 16 days") return "amber";
  if (value === "Off-Site") return "blue";
  return "gray";
}

export function formatUploadSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "Calculating speed…";
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
}

export function formatUploadEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s remaining";
  const rounded = Math.ceil(seconds);
  if (rounded >= 3600) return `${Math.floor(rounded / 3600)}h ${Math.floor((rounded % 3600) / 60)}m remaining`;
  if (rounded >= 60) return `${Math.floor(rounded / 60)}m ${rounded % 60}s remaining`;
  return `${rounded}s remaining`;
}

// Re-export shared dependencies
export {
  canAccessWorkspaceView, DEPARTMENTS, DEPARTMENT_LABEL_TO_CODE, roleLabel,
  canAccessProvisionedDepartmentDashboard, DEPARTMENT_DASHBOARD_METRICS, DEPARTMENT_DASHBOARD_WIDGETS,
  defaultWorkflowChecklist, normalizeDepartmentDashboardConfig,
  findEmployeeBookingConflicts, toggleEmployeeBookingAllocation,
  focusAssignmentBooking, ATTENDANCE_CREW_ROSTER, CREW_ASSIGNMENT_ROSTER,
  ATTENDANCE_STATUSES, attendanceCompletion, attendanceRosterKey,
  computeMonthlyAttendanceSummary, dateKey, defaultAttendanceRecord,
  formatAttendanceDate, historicalAttendanceRecord, shiftDate,
  summarizeAttendance, updateAttendance,
  TRAINING_EMPLOYEES, TRAINING_SOURCE_FILE,
  type AttendanceRecord, type AttendanceStatus, type EmployeeAllocation,
  type DepartmentDashboardConfig, type DepartmentDashboardMetric,
  type DepartmentDashboardWidget, type WorkflowChecklistItem,
  type TrainingEmployee, type TrainingStatus, type TrainingWorkstream,
};
