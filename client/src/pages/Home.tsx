import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast, toast as globalToast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import {
  canDispatch as canDispatchByRule,
  departmentCompletion,
  documentCompletion,
  revisionReversionStage,
  revertBooking,
  STAGE_ROLES,
  transitionBooking,
  type DocumentItem,
} from "@shared/bookingRules";
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
import { formatDashboardGreeting } from "@shared/dashboardGreeting";
import {
  findEmployeeBookingConflicts,
  toggleEmployeeBookingAllocation,
  type EmployeeAllocation,
} from "@shared/bookingConflictRules";
import { focusAssignmentBooking } from "@shared/assignmentRules";
import { ATTENDANCE_CREW_ROSTER } from "@shared/attendanceCrewRoster";
import { CREW_ASSIGNMENT_ROSTER } from "@shared/crewAssignmentRoster";
import {
  formatGearValidityDate,
  gearDocumentStatus,
  isValidGearDocumentPeriod,
} from "@shared/gearDocumentRules";
import { CrewView as CrewAssignmentWorkspace } from "@/components/CrewAssignmentWorkspace";

export const CrewView = CrewAssignmentWorkspace;
import {
  TRAINING_EMPLOYEES,
  TRAINING_SOURCE_FILE,
  type TrainingEmployee,
  type TrainingStatus,
  type TrainingWorkstream,
} from "@shared/trainingData";
import { AUGUST_ATTENDANCE_ROSTER } from "@shared/augustAttendanceData";
import {
  filterNotifications,
  getExpiringTrainingEmployees,
} from "@shared/notificationAndExpiryRules";
import { VEHICLE_FLEET } from "@shared/vehicleFleetData";
import {
  filterVehicleFleet,
  vehicleRegistrationStatus,
  type VehicleRegistrationStatus,
} from "@shared/vehicleFleetRules";
import DataUploadCenter, {
  type UploadMap,
} from "@/components/DataUploadCenter";
import SupervisorPermissionsAudit from "@/components/SupervisorPermissionsAudit";
import { generateDispatchBundlePdf } from "@/lib/dispatchBundlePdf";
import * as XLSX from "xlsx";
import DepartmentUsersView from "@/components/DepartmentUsersView";
import SalesEnquiryInbox from "@/components/SalesEnquiryInbox";
import WorkspaceLoadingSkeleton from "@/components/WorkspaceLoadingSkeleton";
import WebVitalsAnalyticsView from "@/components/WebVitalsAnalyticsView";
import "./DepartmentWorkspace.css";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  CircleDot,
  ClipboardCheck,
  Clock3,
  CloudUpload,
  FileCheck2,
  FileText,
  FolderOpen,
  Gauge,
  HardHat,
  Landmark,
  LayoutDashboard,
  Lock,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  Truck,
  Users,
  UserCog,
  Wrench,
  Upload,
  X,
} from "lucide-react";

type Stage =
  | "Created by Salesperson"
  | "Documentation Supervisor"
  | "Crew Assigned"
  | "Gear Confirmed"
  | "Docs In Progress"
  | "All Docs Submitted"
  | "Reviewed"
  | "Dispatched";

type View =
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
  | "department"
  | "provisioned-dashboard"
  | "sales-enquiries"
  | "users"
  | "supervisor-audit"
  | "web-vitals";

type Booking = {
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

const stages: Stage[] = [
  "Created by Salesperson",
  "Documentation Supervisor",
  "Crew Assigned",
  "Gear Confirmed",
  "Docs In Progress",
  "All Docs Submitted",
  "Reviewed",
  "Dispatched",
];

const stageShort: Record<Stage, string> = {
  "Created by Salesperson": "Created",
  "Documentation Supervisor": "Doc Supervisor",
  "Crew Assigned": "Crew",
  "Gear Confirmed": "Gear",
  "Docs In Progress": "Docs in progress",
  "All Docs Submitted": "All docs submitted",
  Reviewed: "Reviewed",
  Dispatched: "Dispatched",
};

const initialBookings: Booking[] = [
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

const persistedBookingIds: Record<string, string> = {
  "BOB Booking-31511": "BOB-59116",
  "BOB Booking-31421": "BOB-59117",
  "BOB Booking-31390": "BOB-59118",
};

function persistedBookingIdForUi(id: string) {
  return persistedBookingIds[id] ?? null;
}

function uiBookingIdForPersisted(id: string) {
  return (
    Object.entries(persistedBookingIds).find(
      ([, persistedId]) => persistedId === id
    )?.[0] ?? id
  );
}

const departments = [
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

type CrewRecord = {
  id: string;
  name: string;
  role: string;
  availability: "Present" | "On Leave" | "Assigned" | "Off-Site";
  cert: string;
  initials: string;
  flag: boolean;
  department?: string;
};

const legacyCrews: CrewRecord[] = [
  {
    id: "cr-1",
    name: "Vineeth Vijayan",
    role: "Crane Operator",
    availability: "Present",
    cert: "Valid · 12 Mar 2027",
    initials: "VV",
    flag: false,
  },
  {
    id: "cr-2",
    name: "Anoop Panikashery",
    role: "Crane Operator",
    availability: "Assigned",
    cert: "Valid · 09 Feb 2027",
    initials: "AP",
    flag: false,
  },
  {
    id: "cr-3",
    name: "Vijayakumar",
    role: "Rigger",
    availability: "Present",
    cert: "Renewal due in 16 days",
    initials: "VK",
    flag: true,
  },
  {
    id: "cr-4",
    name: "Amal Krishnan",
    role: "Rigger",
    availability: "Present",
    cert: "Valid · 28 Nov 2026",
    initials: "AK",
    flag: false,
  },
  {
    id: "cr-5",
    name: "Ramesh Babu",
    role: "Banksman",
    availability: "On Leave",
    cert: "Valid · 10 Jan 2027",
    initials: "RB",
    flag: false,
  },
  {
    id: "cr-6",
    name: "Shahid Khan",
    role: "Site Supervisor",
    availability: "Off-Site",
    cert: "Training required",
    initials: "SK",
    flag: true,
  },
];

const crews: CrewRecord[] = [
  ...legacyCrews,
  ...ATTENDANCE_CREW_ROSTER.filter(
    employee =>
      !legacyCrews.some(
        legacy => legacy.name.toLowerCase() === employee.name.toLowerCase()
      )
  ),
].sort((first, second) => first.name.localeCompare(second.name));

function allocationMatchesCrew(
  allocation: EmployeeAllocation,
  crew: Pick<CrewRecord, "id" | "name">
) {
  return allocation.crewId
    ? allocation.crewId === crew.id
    : allocation.employeeName === crew.name;
}

const attendanceRoster = AUGUST_ATTENDANCE_ROSTER.map((employee, index) => ({
  name: employee.name,
  role: employee.role,
  availability: employee.availability as AttendanceStatus,
  initials: employee.initials,
  department: employee.department,
  rosterKey: attendanceRosterKey(employee, index),
}));

type GearDocument = {
  name: string;
  url: string;
  key?: string;
  contentType?: string;
  size?: number;
};
type GearRecord = {
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

export const gears: GearRecord[] = [
  {
    name: "4-leg wire rope sling",
    type: "Slings · 25T SWL",
    cert: "INS-2026-218",
    expires: "28 Sep 2026",
    status: "Compliant",
    selected: true,
  },
  {
    name: "Bow shackle · 35T",
    type: "Shackles · Grade 8",
    cert: "INS-2026-411",
    expires: "19 Dec 2026",
    status: "Compliant",
    selected: true,
  },
  {
    name: "Spreader beam · 60T",
    type: "Spreader beam",
    cert: "INS-2025-022",
    expires: "04 Aug 2026",
    status: "Expired",
    selected: false,
  },
  {
    name: "Swivel hook · 40T",
    type: "Hooks · Self-locking",
    cert: "INS-2026-301",
    expires: "02 Oct 2026",
    status: "Compliant",
    selected: false,
  },
];

const initialUploadDocuments: DocumentItem[] = [
  {
    id: "doc-1",
    departmentCode: "DOC",
    name: "Method statement",
    state: "Approved",
    required: true,
  },
  {
    id: "doc-2",
    departmentCode: "HSE",
    name: "Lift plan approval",
    state: "Approved",
    required: true,
  },
  {
    id: "doc-3",
    departmentCode: "CRW",
    name: "Crew certificates",
    state: "Uploaded",
    required: true,
  },
  {
    id: "doc-4",
    departmentCode: "ACC",
    name: "Signed LPO · Rev. 2",
    state: "Uploaded",
    required: true,
  },
  {
    id: "doc-5",
    departmentCode: "DOC",
    name: "Site access pass",
    state: "Required",
    required: true,
  },
  {
    id: "doc-6",
    departmentCode: "ACC",
    name: "Trade license",
    state: "Uploaded",
    required: true,
  },
  {
    id: "doc-7",
    departmentCode: "TRN",
    name: "Delivery note",
    state: "Required",
    required: true,
  },
];

function initials(value: string) {
  return value
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusTone(value: string) {
  if (value === "Compliant" || value === "Present" || value === "Dispatched")
    return "green";
  if (
    value === "Expired" ||
    value === "Critical" ||
    value === "Training required"
  )
    return "red";
  if (
    value === "Assigned" ||
    value === "High" ||
    value === "Renewal due in 16 days"
  )
    return "amber";
  if (value === "Off-Site") return "blue";
  return "gray";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status-badge ${statusTone(value)}`}>
      <CircleDot size={9} />
      {value}
    </span>
  );
}

function MetricCard({
  label,
  value,
  foot,
  icon,
  tone = "red",
}: {
  label: string;
  value: string;
  foot: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        <span className={tone === "green" ? "delta-up" : ""}>{icon}</span>
        {foot}
      </div>
    </div>
  );
}

export function Shell({
  children,
  view,
  setView,
  onBack,
  onClient,
  onDepartment,
  provisionedDashboards = [],
  activeProvisionedDepartmentCode = null,
  onProvisionedDashboard = () => undefined,
  departmentLabel,
  bookings,
  onOpenDossier,
  user,
  onSignOut,
}: {
  children: React.ReactNode;
  view: View;
  setView: (view: View) => void;
  onBack: () => void;
  onClient: () => void;
  onDepartment: (department: string) => void;
  provisionedDashboards?: Array<{ code: string; name: string; accent: string }>;
  activeProvisionedDepartmentCode?: string | null;
  onProvisionedDashboard?: (departmentCode: string) => void;
  departmentLabel: string | null;
  bookings: Booking[];
  onOpenDossier: (booking: Booking) => void;
  user: {
    id: number;
    name: string | null;
    email: string | null;
    companyName?: string | null;
    phone?: string | null;
    role: "admin" | "supervisor" | "user";
    departmentCode: string | null;
    supervisorId?: number | null;
  };
  onSignOut: () => Promise<void>;
}) {
  const { theme, toggleTheme } = useTheme();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [dossierSearchOpen, setDossierSearchOpen] = useState(false);
  const [dossierSearchQuery, setDossierSearchQuery] = useState("");
  const canSearchDossiers = view === "overview" || view === "bookings" || view === "detail";
  const dossierSearchResults = useMemo(() => {
    const query = dossierSearchQuery.trim().toLowerCase();
    if (!query) return bookings.slice(0, 6);
    return bookings
      .filter(booking =>
        [
          booking.id,
          booking.client,
          booking.project,
          booking.crane,
          booking.site,
          booking.stage,
          booking.priority,
        ].some(value => value.toLowerCase().includes(query))
      )
      .slice(0, 6);
  }, [bookings, dossierSearchQuery]);
  const openDossierSearch = () => {
    setDossierSearchQuery("");
    setDossierSearchOpen(true);
  };
  const chooseDossierSearchResult = (booking: Booking) => {
    setDossierSearchOpen(false);
    setDossierSearchQuery("");
    onOpenDossier(booking);
  };
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (canSearchDossiers && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openDossierSearch();
      }
      if (event.key === "Escape") setDossierSearchOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canSearchDossiers]);
  useEffect(() => {
    if (!canSearchDossiers) setDossierSearchOpen(false);
  }, [canSearchDossiers]);
  const notificationInput = useMemo(
    () =>
      user.role === "admin"
        ? undefined
        : { departmentCode: user.departmentCode ?? undefined },
    [user.role, user.departmentCode]
  );
  const notificationsQuery =
    trpc.operations.getNotifications.useQuery(notificationInput);
  const clearNotificationsMutation =
    trpc.operations.clearNotifications.useMutation();
  const utils = trpc.useUtils();
  const updateMyContactDetails = trpc.auth.updateMyContactDetails.useMutation();
  const [profileContact, setProfileContact] = useState({
    companyName: user.companyName ?? "",
    phone: user.phone ?? "",
  });
  useEffect(() => {
    setProfileContact({ companyName: user.companyName ?? "", phone: user.phone ?? "" });
  }, [user.companyName, user.phone]);
  const saveProfileContactDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateMyContactDetails.mutateAsync(profileContact);
      await utils.auth.me.invalidate();
      toast.success("Profile contact details saved", { description: "Your company and phone can now pre-fill rental estimate emails." });
    } catch (caught) {
      toast.error("Profile update failed", { description: caught instanceof Error ? caught.message : "Please try again." });
    }
  };
  const notificationItems = notificationsQuery.data ?? [];
  const [urgencyFilter, setUrgencyFilter] = useState<
    "All" | "High" | "Warning" | "Standard"
  >("All");
  const [deptFilter, setDeptFilter] = useState<
    "All" | "Documentation" | "HSE" | "Crew" | "Accounts" | "Transportation"
  >("All");
  const filteredNotifications = useMemo(
    () => filterNotifications(notificationItems, urgencyFilter, deptFilter),
    [notificationItems, urgencyFilter, deptFilter]
  );
  const unreadNotifications = notificationItems.filter(
    item => item.read !== 1
  ).length;
  const handleClearNotifications = async () => {
    try {
      await clearNotificationsMutation.mutateAsync({
        departmentCode:
          user.role === "admin"
            ? undefined
            : (user.departmentCode ?? undefined),
      });
      await utils.operations.getNotifications.invalidate();
      toast.success("Notifications cleared", {
        description: "All unread items have been marked as read.",
      });
    } catch (caught) {
      toast.error("Could not clear notifications", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };
  const [avatarTone, setAvatarTone] = useState("blue");
  const avatarTones = [
    { id: "blue", color: "#0a66c2" },
    { id: "teal", color: "#0b8f87" },
    { id: "violet", color: "#7457c8" },
    { id: "amber", color: "#c68116" },
  ];
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bob-avatar-tone-${user.id}`);
      if (saved && avatarTones.some(tone => tone.id === saved))
        setAvatarTone(saved);
    } catch {}
  }, [user.id]);
  useEffect(() => {
    try {
      localStorage.setItem(`bob-avatar-tone-${user.id}`, avatarTone);
    } catch {}
  }, [avatarTone, user.id]);
  const avatarStyle = {
    background:
      avatarTones.find(tone => tone.id === avatarTone)?.color ?? "#0a66c2",
    color: "#fff",
  };
  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Operations Cockpit", icon: <LayoutDashboard /> },
    { id: "bookings", label: "Booking Dossiers", icon: <ClipboardCheck /> },
    { id: "docs", label: "Documents & Compliance", icon: <FileCheck2 /> },
    { id: "crew", label: "Crew Assignment", icon: <Users /> },
    { id: "gear", label: "Lifting Gears", icon: <Wrench /> },
    { id: "attendance", label: "Attendance", icon: <CalendarDays /> },
    { id: "training", label: "Training Register", icon: <FileCheck2 /> },
    { id: "uploads", label: "Excel Data Uploads", icon: <FolderOpen /> },
  ];
  const visibleNavItems = navItems.filter(item =>
    canAccessWorkspaceView(user, item.id)
  );
  const departmentItems = [
    {
      label: "Sales & Client Relations",
      code: "sales",
      icon: <ClipboardCheck />,
    },
    {
      label: "Documentation & Permits",
      code: "documentation",
      icon: <FileText />,
    },
    {
      label: "Lifting Gears / Engineering",
      code: "lifting-gears",
      icon: <Wrench />,
    },
    { label: "Maintenance", code: "maintenance", icon: <Gauge /> },
    { label: "Crew / Workmen Assignment", code: "crew", icon: <Users /> },
    { label: "HSE / Safety", code: "hse", icon: <ShieldCheck /> },
    { label: "Accounts", code: "accounts", icon: <Landmark /> },
    { label: "HR", code: "hr", icon: <CalendarDays /> },
    { label: "Transportation", code: "transportation", icon: <Truck /> },
    {
      label: "Administrator / Super Admin",
      code: "administrator",
      icon: <Settings />,
    },
  ] as const;
  const permittedDepartments =
    user.role === "admin"
      ? departmentItems
      : departmentItems.filter(
          department => department.code === user.departmentCode
        );
  const permittedProvisionedDashboards =
    user.role === "admin"
      ? provisionedDashboards
      : provisionedDashboards.filter(
          department => department.code === user.departmentCode
        );
  const userName = user.name?.trim() || "BOB Cranes user";
  const userDepartment =
    user.role === "admin"
      ? "Administrator"
      : (provisionedDashboards.find(department => department.code === user.departmentCode)
          ?.name ?? DEPARTMENTS.find(department => department.code === user.departmentCode)
          ?.label ?? "Department user");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-row">
            <div className="brand-mark brand-logo full-bob-logo-frame">
              <img
                className="brand-logo-image full-bob-logo"
                src="/manus-storage/bob-lifting-your-expectations_2beae224.webp"
                alt="BOB Cranes — Lifting Your Expectations"
              />
            </div>
            <div className="brand-copy">
              <div className="brand-title">BOB CRANES</div>
              <div className="brand-subtitle">Operations Control</div>
            </div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-section">Workspace</div>
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id || (view === "detail" && item.id === "bookings") ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <div className="nav-section" style={{ marginTop: 22 }}>
            Departments
          </div>
          {permittedDepartments.map(department => (
            <button
              className={`nav-item ${view === "department" && departmentLabel === department.label ? "active" : ""}`}
              key={department.code}
              onClick={() => onDepartment(department.label)}
            >
              {department.icon}
              <span>{department.label}</span>
            </button>
          ))}
          {permittedProvisionedDashboards.map(department => (
            <button
              className={`nav-item ${view === "provisioned-dashboard" && activeProvisionedDepartmentCode === department.code ? "active" : ""}`}
              key={department.code}
              onClick={() => onProvisionedDashboard(department.code)}
            >
              <LayoutDashboard />
              <span>{department.name}</span>
            </button>
          ))}
          {user.role === "admin" && (
            <>
              <div className="nav-section" style={{ marginTop: 22 }}>
                Administration
              </div>
              <button className="nav-item" onClick={() => setView("overview")}>
                <Gauge />
                <span>Fleet & Utilization</span>
              </button>
              <button
                className={`nav-item ${view === "supervisor-audit" ? "active" : ""}`}
                onClick={() => setView("supervisor-audit")}
              >
                <ShieldCheck />
                <span>Supervisor Audit</span>
              </button>
              <button
                className={`nav-item ${view === "web-vitals" ? "active" : ""}`}
                onClick={() => setView("web-vitals")}
              >
                <TrendingUp />
                <span>Web Vitals Analytics</span>
              </button>
              <button
                className="nav-item"
                onClick={() => {
                  setProfileOpen(false);
                  setView("users");
                  window.setTimeout(() => {
                    document.getElementById("dashboard-greeting-settings")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 0);
                }}
              >
                <Settings />
                <span>System Settings</span>
              </button>
            </>
          )}
          {user.role !== "user" && (
            <button
              className={`nav-item ${view === "users" ? "active" : ""}`}
              onClick={() => setView("users")}
            >
              <UserCog />
              <span>
                {user.role === "admin"
                  ? "Department Users"
                  : "My Department Users"}
              </span>
            </button>
          )}
          {(user.role === "admin" || user.departmentCode === "sales") && (
            <>
              <div className="nav-section" style={{ marginTop: 22 }}>
                Client tools
              </div>
              <button
                className={`nav-item ${view === "sales-enquiries" ? "active" : ""}`}
                onClick={() => setView("sales-enquiries")}
              >
                <BriefcaseBusiness />
                <span>Sales Enquiries</span>
              </button>
              <button className="nav-item" onClick={onClient}>
                <MessageCircle />
                <span>Client Portal Preview</span>
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="workspace-theme-toggle"
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            aria-label={`Switch departmental workspace to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            <span>{theme === "dark" ? "Light workspace" : "Dark workspace"}</span>
          </button>
          <div className="profile-menu-wrap">
            <button
              className="user-mini"
              onClick={() => setProfileOpen(open => !open)}
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
            >
              <div className="avatar" style={avatarStyle}>
                {initials(userName)}
              </div>
              <div className="user-copy">
                <div className="user-name">{userName}</div>
                <div className="user-role">{userDepartment}</div>
              </div>
              <ChevronDown size={14} />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-menu-heading">
                  <div className="profile-identity">
                    <div className="avatar" style={avatarStyle}>
                      {initials(userName)}
                    </div>
                    <div>
                      <strong>{userName}</strong>
                      <span>{user.email ?? "No email on record"}</span>
                    </div>
                  </div>
                  <div className="profile-details">
                    <span>
                      <strong>Department</strong>
                      {userDepartment}
                    </span>
                    <span>
                      <strong>Role</strong>
                      {roleLabel(user.role)}
                    </span>
                  </div>
                </div>
                <div className="avatar-customizer">
                  <div className="profile-detail-label">Customize avatar</div>
                  <div className="avatar-choice-row">
                    {avatarTones.map(tone => (
                      <button
                        type="button"
                        key={tone.id}
                        className={`avatar-choice ${avatarTone === tone.id ? "selected" : ""}`}
                        style={{ background: tone.color }}
                        onClick={() => setAvatarTone(tone.id)}
                        aria-label={`Use ${tone.id} avatar color`}
                        aria-pressed={avatarTone === tone.id}
                      />
                    ))}
                  </div>
                </div>
                <form className="profile-contact-settings" onSubmit={saveProfileContactDetails}>
                  <div className="profile-detail-label">Rental estimate contact</div>
                  <label><span>Company</span><input value={profileContact.companyName} onChange={event => setProfileContact(current => ({ ...current, companyName: event.target.value }))} maxLength={160} placeholder="Optional company name" /></label>
                  <label><span>Phone</span><input value={profileContact.phone} onChange={event => setProfileContact(current => ({ ...current, phone: event.target.value }))} maxLength={48} placeholder="Optional phone number" /></label>
                  <button type="submit" disabled={updateMyContactDetails.isPending}>{updateMyContactDetails.isPending ? "Saving contact…" : "Save contact details"}</button>
                </form>
                {user.role !== "user" && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setView("users");
                    }}
                  >
                    <UserCog size={15} />
                    Manage department users
                  </button>
                )}
                <button className="profile-signout" onClick={onSignOut}>
                  <LogOut size={15} />
                  <span>Sign out</span>
                  <small>Return to login</small>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-leading">
            {view !== "overview" && (
              <button
                className="back-button"
                onClick={onBack}
                aria-label="Go back"
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
            )}
            <div className="breadcrumb">
              BOB Cranes /{" "}
              <strong>
                {view === "overview"
                  ? "Operations Cockpit"
                  : view === "wizard"
                    ? "New Booking"
                    : view === "detail"
                      ? "Booking Dossier"
                  : view === "department"
                        ? departmentLabel
                        : view === "provisioned-dashboard"
                          ? provisionedDashboards.find(department => department.code === activeProvisionedDepartmentCode)?.name ?? "Department dashboard"
                        : view === "training"
                          ? "Training Register"
                          : view === "uploads"
                            ? "Excel Data Uploads"
                            : view === "supervisor-audit"
                              ? "Supervisor Permissions Audit"
                              : view[0].toUpperCase() + view.slice(1)}
              </strong>
            </div>
          </div>
          <div className="topbar-actions">
            {canSearchDossiers && <><button
              type="button"
              className="search-pill search-launcher"
              onClick={openDossierSearch}
              aria-label="Open booking dossier search"
              aria-expanded={dossierSearchOpen}
            >
              <Search size={14} /> Search dossiers{" "}
              <span style={{ marginLeft: "auto", color: "#555" }}>⌘ K</span>
            </button>
            {dossierSearchOpen && (
              <div
                className="header-dossier-search"
                role="dialog"
                aria-label="Search booking dossiers"
              >
                <div className="header-dossier-search-input">
                  <Search size={15} aria-hidden="true" />
                  <input
                    autoFocus
                    value={dossierSearchQuery}
                    onChange={event => setDossierSearchQuery(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter" && dossierSearchResults[0]) {
                        chooseDossierSearchResult(dossierSearchResults[0]);
                      }
                    }}
                    placeholder="Search ID, client, project, crane, site, or stage"
                    aria-label="Search booking dossiers"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setDossierSearchOpen(false)}
                    aria-label="Close booking dossier search"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="header-dossier-search-summary">
                  {dossierSearchQuery.trim()
                    ? `${dossierSearchResults.length} matching dossier${dossierSearchResults.length === 1 ? "" : "s"}`
                    : "Recent dossiers"}
                </div>
                <div className="header-dossier-search-results">
                  {dossierSearchResults.length ? (
                    dossierSearchResults.map((booking, index) => (
                      <button
                        type="button"
                        className="header-dossier-search-result"
                        key={`dossier-search-${booking.id}-${index}`}
                        onClick={() => chooseDossierSearchResult(booking)}
                      >
                        <span>
                          <strong>{booking.id}</strong>
                          <small>
                            {booking.client} · {booking.project}
                          </small>
                        </span>
                        <span className="status-badge gray">{booking.stage}</span>
                      </button>
                    ))
                  ) : (
                    <div className="header-dossier-search-empty">
                      No booking dossiers match this search.
                    </div>
                  )}
                </div>
              </div>
            )}</>}
            <div className="notification-wrap">
              <button
                className="icon-button notification-trigger"
                aria-label="Open notifications"
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen(value => !value)}
              >
                <Bell size={16} />
                {unreadNotifications > 0 && (
                  <span className="notification-count">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div
                  className="notification-dropdown"
                  role="dialog"
                  aria-label="Notifications"
                >
                  <div className="notification-dropdown-header">
                    <div>
                      <strong>Notifications</strong>
                      <span>
                        {unreadNotifications
                          ? `${unreadNotifications} new`
                          : "All caught up"}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <button
                        className="secondary-button"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          height: "auto",
                          background: "#1f2937",
                          color: "#fff",
                          borderColor: "#374151",
                        }}
                        onClick={handleClearNotifications}
                        disabled={clearNotificationsMutation.isPending}
                      >
                        {clearNotificationsMutation.isPending
                          ? "Clearing…"
                          : "Mark all read"}
                      </button>
                      {unreadNotifications > 0 && (
                        <button
                          className="secondary-button"
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            height: "auto",
                          }}
                          onClick={handleClearNotifications}
                          disabled={clearNotificationsMutation.isPending}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className="notification-filter-bar"
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #2a2a2a",
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      className="attendance-select compact"
                      value={urgencyFilter}
                      onChange={e => setUrgencyFilter(e.target.value as any)}
                      aria-label="Filter notifications by urgency"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      <option value="All">Urgency: All</option>
                      <option value="High">High</option>
                      <option value="Warning">Warning</option>
                      <option value="Standard">Standard</option>
                    </select>
                    <select
                      className="attendance-select compact"
                      value={deptFilter}
                      onChange={e => setDeptFilter(e.target.value as any)}
                      aria-label="Filter notifications by department"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      <option value="All">Dept: All</option>
                      <option value="Documentation">Documentation</option>
                      <option value="HSE">HSE</option>
                      <option value="Crew">Crew</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Transportation">Transportation</option>
                    </select>
                  </div>
                  {notificationsQuery.error ? (
                    <div className="notification-empty notification-error">
                      Unable to load notifications.
                    </div>
                  ) : filteredNotifications.length ? (
                    <div className="notification-stack">
                      {filteredNotifications.slice(0, 8).map(item => (
                        <div
                          className={`notification ${item.read === 1 ? "notification-read" : "notification-unread"}`}
                          key={item.id}
                        >
                          <div className="notification-title-row">
                            <div className="title">{item.title}</div>
                            {item.read !== 1 && (
                              <span className="notification-dot" />
                            )}
                          </div>
                          <div className="body">{item.body}</div>
                          <time>
                            {new Date(item.createdAt).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="notification-empty">
                      <Bell size={16} />
                      No notifications match this filter.
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="more-actions-wrap">
              <button
                className="icon-button"
                aria-label="Open more actions"
                aria-expanded={moreActionsOpen}
                onClick={() => setMoreActionsOpen(open => !open)}
              >
                <MoreHorizontal size={17} />
              </button>
              {moreActionsOpen && (
                <div className="more-actions-menu" role="menu">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setView("overview");
                    }}
                  >
                    <LayoutDashboard size={14} /> Open operations cockpit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      if (user.role === "admin") setView("bookings");
                      else
                        toast.info("Dossier queue restricted", {
                          description:
                            "Your department workspace opens dossiers through its assigned workflow.",
                        });
                    }}
                  >
                    <ClipboardCheck size={14} /> Open dossier queue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      onClient();
                    }}
                  >
                    <MessageCircle size={14} /> Open client portal
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-copy">{copy}</p>
      </div>
      {action}
    </div>
  );
}

function ReferenceUploadProgress({
  label,
  value,
  status = "active",
}: {
  label: string;
  value: number;
  status?: "active" | "failed" | "yellow";
}) {
  const completed = Math.min(7, Math.round((value / 100) * 7));
  const tone =
    status === "failed" ? "risk" : status === "yellow" ? "complete" : "";
  return (
    <div
      className="analytics-inline-progress"
      aria-label={`${label}: ${value}% complete`}
    >
      <div className="reference-progress-copy">
        <strong>{label}</strong>
        <span>{completed} of 7 steps completed</span>
      </div>
      <div className="analytics-inline-meter">
        <div
          className={`analytics-inline-fill ${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <strong className="analytics-inline-value">{value}%</strong>
    </div>
  );
}

function ProgressGraph({
  bookings,
  documents,
  scopeDepartment,
}: {
  bookings: Booking[];
  documents: DocumentItem[];
  scopeDepartment?: string | null;
}) {
  const focus =
    bookings.find(booking => booking.id === "BOB Booking-31511") ?? bookings[0];
  const departmentsForGraph = [
    {
      code: "DOC" as const,
      name: "Documentation",
      note: "Signed method statement",
      department: "documentation",
    },
    {
      code: "HSE" as const,
      name: "HSE / Safety",
      note: "Lift plan approval",
      department: "hse",
    },
    {
      code: "CRW" as const,
      name: "Crew Assignment",
      note: "Vijayakumar renewal",
      department: "crew",
    },
    {
      code: "LG" as const,
      name: "Lifting Gears",
      note: "Inspection certificates",
      department: "lifting-gears",
    },
    {
      code: "ACC" as const,
      name: "Accounts",
      note: "LPO Rev. 2",
      department: "accounts",
    },
    {
      code: "TRN" as const,
      name: "Transportation",
      note: "Delivery note",
      department: "transportation",
    },
  ];
  const graphRows = scopeDepartment
    ? departmentsForGraph.filter(row => row.department === scopeDepartment)
    : departmentsForGraph;
  const visibleRows = graphRows.length ? graphRows : departmentsForGraph;
  const rowValues = visibleRows.map(row => ({
    ...row,
    value: departmentCompletion(documents, row.code),
  }));
  const average = Math.round(
    rowValues.reduce((total, row) => total + row.value, 0) / rowValues.length
  );
  const activeStageIndex = Math.max(
    0,
    stages.indexOf(focus?.stage ?? "Created by Salesperson")
  );
  const openActions = rowValues.reduce(
    (total, row) =>
      total +
      documents.filter(
        document =>
          document.departmentCode === row.code &&
          document.state !== "Uploaded" &&
          document.state !== "Approved"
      ).length,
    0
  );
  return (
    <div className="analytics-progress-board">
      <div className="analytics-progress-header">
        <div>
          <div className="eyebrow">Portfolio analytics</div>
          <div className="panel-title">
            {focus?.id ?? "Booking dossier"} ·{" "}
            {focus?.client ?? "Active booking"}
          </div>
          <div className="panel-meta">
            Department completion and lifecycle progress at a glance
          </div>
        </div>
        <StatusBadge value={focus?.stage ?? "Docs In Progress"} />
      </div>
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi">
          <span>Average completion</span>
          <strong>{average}%</strong>
          <small>{visibleRows.length} active workstreams</small>
        </div>
        <div className="analytics-kpi">
          <span>Current stage</span>
          <strong>
            {activeStageIndex + 1}
            <em> / {stages.length}</em>
          </strong>
          <small>{stageShort[focus?.stage ?? "Created by Salesperson"]}</small>
        </div>
        <div className="analytics-kpi">
          <span>Open actions</span>
          <strong>{openActions.toString().padStart(2, "0")}</strong>
          <small>Items requiring attention</small>
        </div>
      </div>
      <div className="analytics-chart-panel">
        <div className="analytics-section-heading">
          <div>
            <strong>Department completion</strong>
            <span>Progress by document owner</span>
          </div>
          <div className="analytics-legend">
            <span>
              <i className="is-progress" />
              Progress
            </span>
            <span>
              <i className="is-remainder" />
              Remaining
            </span>
          </div>
        </div>
        <div
          className="analytics-chart"
          aria-label="Department completion bar chart"
        >
          {rowValues.map(({ code, name, value }) => (
            <div className="analytics-chart-column" key={code}>
              <strong>{value}%</strong>
              <div className="analytics-chart-track">
                <div
                  className={`analytics-chart-fill ${value === 100 ? "complete" : value < 50 ? "risk" : ""}`}
                  style={{ height: `${Math.max(8, value)}%` }}
                />
              </div>
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="analytics-stage-strip"
        aria-label="Eight-stage booking lifecycle"
      >
        {stages.map((stage, index) => (
          <div
            className={`analytics-stage ${index < activeStageIndex ? "complete" : ""} ${index === activeStageIndex ? "current" : ""}`}
            key={stage}
          >
            <span>
              {index < activeStageIndex ? <Check size={11} /> : index + 1}
            </span>
            <small>{stageShort[stage]}</small>
          </div>
        ))}
      </div>
      <div className="analytics-progress-footer">
        <span>
          <strong>{average}%</strong> average completion across{" "}
          {visibleRows.length} department workstream
          {visibleRows.length === 1 ? "" : "s"}
        </span>
        <span>
          {focus?.stage ?? "Awaiting intake"} · linked dossier workflow
        </span>
      </div>
      <div className="analytics-workstream-list">
        {rowValues.map(({ code, name, note, value }) => {
          const scoped = documents.filter(
            document => document.departmentCode === code
          );
          const complete = scoped.filter(
            document =>
              document.state === "Uploaded" || document.state === "Approved"
          ).length;
          return (
            <div className="analytics-workstream-row" key={code}>
              <div>
                <strong>{name}</strong>
                <small>
                  {scoped.length
                    ? `${complete} / ${scoped.length} documents · ${note}`
                    : `No outstanding documents · ${note}`}
                </small>
              </div>
              <div className="analytics-workstream-meter">
                <div>
                  <span style={{ width: `${value}%` }} />
                </div>
                <strong>{value}%</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClientProgressRail({
  booking,
  progress,
}: {
  booking: Booking;
  progress: number;
}) {
  const activeStageIndex = Math.max(0, stages.indexOf(booking.stage));
  return (
    <div className="client-progress-analytics">
      <div className="analytics-section-heading">
        <div>
          <strong>Booking progress</strong>
          <span>Live dossier readiness</span>
        </div>
        <StatusBadge value={booking.stage} />
      </div>
      <div className="client-progress-value">
        <strong>{progress}%</strong>
        <span>dossier completion</span>
      </div>
      <div className="client-progress-bar">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div
        className="analytics-stage-strip"
        aria-label="Client booking lifecycle"
      >
        {stages.map((stage, index) => (
          <div
            className={`analytics-stage ${index < activeStageIndex ? "complete" : ""} ${index === activeStageIndex ? "current" : ""}`}
            key={stage}
          >
            <span>
              {index < activeStageIndex ? <Check size={11} /> : index + 1}
            </span>
            <small>{stageShort[stage]}</small>
          </div>
        ))}
      </div>
      <div className="analytics-progress-footer">
        <span>
          <strong>{progress}%</strong> complete
        </span>
        <span>{booking.stage}</span>
      </div>
    </div>
  );
}

function Pipeline({
  bookings,
  documents,
  setDetail,
}: {
  bookings: Booking[];
  documents: DocumentItem[];
  setDetail: (booking: Booking) => void;
}) {
  const [filter, setFilter] = useState<"all" | "critical" | "due" | "large">(
    "all"
  );
  const [windowed, setWindowed] = useState(false);
  const filteredBookings = useMemo(
    () =>
      bookings.filter(booking => {
        if (filter === "critical") return booking.priority === "Critical";
        if (filter === "due") return booking.progress < 100;
        if (filter === "large")
          return Number.parseInt(booking.crane, 10) >= 200;
        return true;
      }),
    [bookings, filter]
  );
  const filterLabels: Array<[typeof filter, string]> = [
    ["all", "All active"],
    ["critical", "Critical"],
    ["due", "Due this week"],
    ["large", "200T +"],
  ];
  const visibleBookings = windowed
    ? filteredBookings.filter(booking => {
        const mobilization = Date.parse(booking.mob);
        const now = Date.now();
        return (
          !Number.isNaN(mobilization) &&
          mobilization >= now &&
          mobilization <= now + 30 * 24 * 60 * 60 * 1000
        );
      })
    : filteredBookings;
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Booking progress & pipeline</div>
          <div className="panel-meta">
            Department completion by document owner
          </div>
        </div>
        <button
          className={`secondary-button ${windowed ? "active-control" : ""}`}
          onClick={() => {
            setWindowed(current => !current);
            toast.info(
              windowed
                ? "Showing all active dossiers"
                : "Showing the next 30-day mobilization window"
            );
          }}
        >
          <CalendarDays size={14} /> {windowed ? "All active" : "Next 30 days"}
        </button>
      </div>
      <div className="panel-body">
        <ProgressGraph bookings={bookings} documents={documents} />
        <div className="pipeline-toolbar" style={{ marginTop: 24 }}>
          <div className="filter-row">
            {filterLabels.map(([value, label]) => (
              <button
                key={value}
                className={`filter-chip ${filter === value ? "selected" : ""}`}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="panel-meta">
            {visibleBookings.length} active dossiers
          </div>
        </div>
        <div
          className="kanban"
          style={{ gridTemplateColumns: "repeat(8, minmax(170px, 1fr))" }}
        >
          {stages.map(stage => {
            const columnBookings = visibleBookings.filter(
              booking => booking.stage === stage
            );
            return (
              <div className="kanban-column" key={stage}>
                <div className="column-head">
                  <div className="column-title">{stageShort[stage]}</div>
                  <div className="column-count">
                    {columnBookings.length.toString().padStart(2, "0")}
                  </div>
                </div>
                {columnBookings.length ? (
                  columnBookings.map((booking, index) => (
                    <div
                      className="booking-card"
                      key={`board-${booking.id}-${index}`}
                      onClick={() => setDetail(booking)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ")
                          setDetail(booking);
                      }}
                    >
                      <div className="booking-id">
                        {booking.id.replace("BOB Booking-", "BK-")}
                      </div>
                      <div className="booking-client">{booking.client}</div>
                      <div className="booking-detail">
                        <HardHat size={11} />
                        {booking.crane}
                      </div>
                      <div className="booking-detail">
                        <MapPin size={11} />
                        {booking.site}
                      </div>
                      <div className="booking-progress">
                        <span style={{ width: `${booking.progress}%` }} />
                      </div>
                      <div className="booking-progress-meta">
                        <span>{booking.progress}% docs</span>
                        <StatusBadge value={booking.priority} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className="empty-state"
                    style={{ padding: "24px 8px", fontSize: 11 }}
                  >
                    No dossiers
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AttendanceSummaryCard({
  records,
  setRecords,
  setView,
}: {
  records: Record<string, AttendanceRecord>;
  setRecords: React.Dispatch<
    React.SetStateAction<Record<string, AttendanceRecord>>
  >;
  setView: (view: View) => void;
}) {
  const today = dateKey(new Date());
  const record = records[today] ?? defaultAttendanceRecord(attendanceRoster);
  const summary = summarizeAttendance(record);
  const updateStatus = (employeeName: string, status: AttendanceStatus) =>
    setRecords(current => ({
      ...current,
      [today]: updateAttendance(record, employeeName, status),
    }));
  return (
    <div className="panel attendance-dashboard-card">
      <div className="panel-header">
        <div>
          <div className="panel-title">Today’s attendance</div>
          <div className="panel-meta">
            Daily employee status · {formatAttendanceDate(today)}
          </div>
        </div>
        <button
          className="secondary-button"
          onClick={() => setView("attendance")}
        >
          <ClipboardCheck size={14} /> View attendance
        </button>
      </div>
      <div className="panel-body">
        <div className="attendance-mini-summary">
          <span>
            <strong>{summary.Present}</strong> present
          </span>
          <span>
            <strong>{summary["On Leave"]}</strong> on leave
          </span>
          <span>
            <strong>{summary.Assigned + summary["Off-Site"]}</strong> away
          </span>
        </div>
        <div className="attendance-mini-list">
          {attendanceRoster.slice(0, 4).map((employee, index) => {
            const status = record[employee.name] ?? "Present";
            return (
              <div className="attendance-mini-row" key={employee.rosterKey}>
                <div className="attendance-person">
                  <div className="avatar">{employee.initials}</div>
                  <div>
                    <div className="compliance-name">{employee.name}</div>
                    <div className="compliance-sub">{employee.role}</div>
                  </div>
                </div>
                <select
                  className="attendance-select compact"
                  value={status}
                  onChange={event =>
                    updateStatus(
                      employee.name,
                      event.target.value as AttendanceStatus
                    )
                  }
                  aria-label={`Attendance for ${employee.name}`}
                >
                  {ATTENDANCE_STATUSES.map(option => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExpiringCertificatesWidget({
  onSelectEmployee,
}: {
  onSelectEmployee: (employeeId: string) => void;
}) {
  const expiring = useMemo(
    () => getExpiringTrainingEmployees(TRAINING_EMPLOYEES, 60),
    []
  );
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">Expiring training certificates</div>
          <div className="panel-meta">
            Certificates due within 60 days across the imported register
          </div>
        </div>
        <StatusBadge value={`${expiring.length} alerts`} />
      </div>
      <div className="panel-body">
        <div className="compliance-list">
          {expiring.slice(0, 5).map((item, index) => (
            <div
              className="compliance-row clickable-row"
              key={`${item.employeeId}-${item.trainingName}-${index}`}
              onClick={() => onSelectEmployee(item.employeeId)}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
            >
              <div>
                <div className="compliance-name">{item.employeeName}</div>
                <div className="compliance-sub">
                  {item.position} · {item.trainingName} (Due in{" "}
                  {item.daysRemaining} days)
                </div>
              </div>
              <StatusBadge value={`${item.daysRemaining} days`} />
            </div>
          ))}
          {expiring.length === 0 && (
            <div className="empty-state">
              No certificates expiring within 60 days.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Overview({
  bookings,
  documents,
  setView,
  setDetail,
  attendanceRecords,
  setAttendanceRecords,
  user,
  greetingTemplate,
  unassignedRentalEnquiries,
  unassignedOldestWaitHours,
  salesSlaConfig,
  canViewSalesEnquiries,
  onSelectEmployee,
}: {
  bookings: Booking[];
  documents: DocumentItem[];
  setView: (view: View) => void;
  setDetail: (booking: Booking) => void;
  attendanceRecords: Record<string, AttendanceRecord>;
  setAttendanceRecords: React.Dispatch<
    React.SetStateAction<Record<string, AttendanceRecord>>
  >;
  user: {
    role: "admin" | "supervisor" | "user";
    departmentCode: string | null;
    name?: string | null;
  };
  greetingTemplate?: string | null;
  unassignedRentalEnquiries: number;
  unassignedOldestWaitHours: number;
  salesSlaConfig: { warningHours: number; criticalHours: number };
  canViewSalesEnquiries: boolean;
  onSelectEmployee: (employeeId: string) => void;
}) {
  const canCreateBooking =
    user.role === "admin" || user.departmentCode === "sales";
  const unassignedSeverity = unassignedRentalEnquiries === 0
    ? "all-assigned"
    : unassignedOldestWaitHours >= salesSlaConfig.criticalHours
      ? "critical"
      : unassignedOldestWaitHours >= salesSlaConfig.warningHours
        ? "warning"
        : "needs-response";
  const visibleDepartments =
    user.role === "admin"
      ? departments
      : departments.filter(
          ([name]) => DEPARTMENT_LABEL_TO_CODE[name] === user.departmentCode
        );
  const activeDossiers = bookings.filter(booking => booking.stage !== "Dispatched");
  const dispatchReviewDossiers = bookings.filter(booking => booking.stage === "Reviewed");
  const complianceBlockers = documents.filter(
    document => document.required && !["Uploaded", "Approved"].includes(document.state)
  ).length;
  return (
    <div className="content">
      <PageHeading
        eyebrow="Operations control center"
        title={formatDashboardGreeting(greetingTemplate, user.name)}
        copy={
          user.role === "admin"
            ? "A live view of every crane booking, compliance blocker, and next action across BOB Cranes."
            : "A focused view of the dossiers and compliance actions assigned to your department."
        }
        action={
          canCreateBooking ? (
            <button
              className="primary-button"
              onClick={() => setView("wizard")}
            >
              <Plus size={15} /> New booking
            </button>
          ) : (
            <span className="status-badge blue">Department workspace</span>
          )
        }
      />
      <section className="daily-operations-summary" aria-label="Daily operations summary" data-testid="daily-operations-summary">
        <div className="daily-operations-heading"><span>Today’s operations</span><small>Live dossier and compliance pulse</small></div>
        <div className="daily-operations-items">
          <article><strong>{activeDossiers.length}</strong><span>active dossiers</span></article>
          <article><strong>{dispatchReviewDossiers.length}</strong><span>in Sales dispatch review</span></article>
          <article className={complianceBlockers ? "attention" : "ready"}><strong>{complianceBlockers}</strong><span>{complianceBlockers === 1 ? "compliance item needs action" : "compliance items need action"}</span></article>
        </div>
      </section>
      {canViewSalesEnquiries && (
        <button type="button" className={`unassigned-enquiry-status ${unassignedSeverity}`} onClick={() => setView("sales-enquiries")} data-testid="unassigned-enquiry-status">
          <span className={`status-badge ${unassignedSeverity === "critical" ? "red" : unassignedSeverity === "warning" ? "amber" : "green"}`}>{unassignedRentalEnquiries}</span>
          <span><strong>{unassignedRentalEnquiries === 1 ? "Unassigned public enquiry" : "Unassigned public enquiries"}</strong><small>{unassignedRentalEnquiries ? `${unassignedSeverity === "critical" ? "Critical" : unassignedSeverity === "warning" ? "Warning" : "Within SLA"} · oldest waiting ${Math.round(unassignedOldestWaitHours)}h · thresholds ${salesSlaConfig.warningHours}h / ${salesSlaConfig.criticalHours}h` : "Every open public enquiry has a Sales owner."}</small></span>
          <ArrowRight size={15} />
        </button>
      )}
      <div className="metric-grid">
        <MetricCard
          label="Active dossiers"
          value="24"
          foot="6 require action today"
          icon={<ArrowRight size={13} />}
        />
        <MetricCard
          label="Ready for dispatch"
          value="03"
          foot="Sales review queue"
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Crew availability"
          value="88%"
          foot="32 of 36 workmen"
          icon={<Users size={13} />}
          tone="green"
        />
        <MetricCard
          label="Compliance watch"
          value="06"
          foot="Certificates expiring ≤20 days"
          icon={<AlertTriangle size={13} />}
        />
      </div>
      {user.role === "admin" ? (
        <Pipeline
          bookings={bookings}
          documents={documents}
          setDetail={setDetail}
        />
      ) : (
        <>
          <div className="panel department-scope-banner">
            <div className="panel-body">
              <div className="panel-title">
                {DEPARTMENTS.find(
                  department => department.code === user.departmentCode
                )?.label ?? "Department"}{" "}
                workspace
              </div>
              <div className="panel-meta">
                This view is limited to your department. Use the dedicated
                workspace section in the sidebar to review and submit assigned
                work.
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Department progress</div>
                <div className="panel-meta">
                  Reference-style completion rail for your assigned workstream
                </div>
              </div>
              <StatusBadge value="Live" />
            </div>
            <div className="panel-body">
              <ProgressGraph
                bookings={bookings}
                documents={documents}
                scopeDepartment={user.departmentCode}
              />
            </div>
          </div>
        </>
      )}
      {(user.role === "admin" || user.departmentCode === "hr") && (
        <AttendanceSummaryCard
          records={attendanceRecords}
          setRecords={setAttendanceRecords}
          setView={setView}
        />
      )}
      <ExpiringCertificatesWidget onSelectEmployee={onSelectEmployee} />
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Department activity</div>
              <div className="panel-meta">Pending actions by team</div>
            </div>
            <button
              className="secondary-button"
              onClick={() =>
                toast.info("Team Comms", {
                  description:
                    "Live department activity is shown in the operations feed below.",
                })
              }
            >
              View comms <ArrowRight size={13} />
            </button>
          </div>
          <div className="panel-body">
            <div className="compliance-list">
              {visibleDepartments.map(([name, count, color]) => (
                <div className="compliance-row" key={name}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: color,
                      }}
                    />
                    <div>
                      <div className="compliance-name">{name}</div>
                      <div className="compliance-sub">
                        {count} pending action{count > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: 120 }}>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(96, count * 12 + 8)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Live operations feed</div>
              <div className="panel-meta">Updated just now</div>
            </div>
            <Bell size={15} color="#777" />
          </div>
          <div className="panel-body">
            <div className="activity-item">
              <div className="activity-dot" />
              <div>
                <div className="activity-text">
                  <strong>All departments notified</strong> for BOB
                  Booking-31511.
                </div>
                <div className="activity-time">
                  2 minutes ago · System broadcast
                </div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" style={{ background: "#f2b94b" }} />
              <div>
                <div className="activity-text">
                  <strong>Vijayakumar</strong> flagged for certificate renewal.
                </div>
                <div className="activity-time">18 minutes ago · HSE inbox</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" style={{ background: "#31b56b" }} />
              <div>
                <div className="activity-text">
                  <strong>Client uploaded LPO_Rev2.pdf</strong> to response
                  portal.
                </div>
                <div className="activity-time">
                  32 minutes ago · Gulf Contracting LLC
                </div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" style={{ background: "#4f9cf9" }} />
              <div>
                <div className="activity-text">
                  <strong>Google Drive folder synced</strong> for BOB
                  Booking-31390.
                </div>
                <div className="activity-time">1 hour ago · Drive archive</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingsView({
  bookings,
  setView,
  setDetail,
}: {
  bookings: Booking[];
  setView: (view: View) => void;
  setDetail: (booking: Booking) => void;
}) {
  const [filter, setFilter] = useState<"all" | "critical" | "mobilizing">(
    "all"
  );
  const [query, setQuery] = useState("");
  const visibleBookings = useMemo(
    () =>
      bookings.filter(booking => {
        const matchesFilter =
          filter === "all" ||
          (filter === "critical"
            ? booking.priority === "Critical"
            : booking.progress < 100);
        const normalized = query.trim().toLowerCase();
        const matchesQuery =
          !normalized ||
          [
            booking.id,
            booking.client,
            booking.project,
            booking.crane,
            booking.site,
            booking.stage,
            booking.priority,
          ].some(value => value.toLowerCase().includes(normalized));
        return matchesFilter && matchesQuery;
      }),
    [bookings, filter, query]
  );
  return (
    <div className="content">
      <PageHeading
        eyebrow="Dossier management"
        title="Booking dossiers"
        copy="Search, filter, and open the operating record for every active and dispatched job."
        action={
          <button className="primary-button" onClick={() => setView("wizard")}>
            <Plus size={15} /> New booking
          </button>
        }
      />
      <div className="panel">
        <div className="panel-header">
          <div className="filter-row">
            <button
              className={`filter-chip ${filter === "all" ? "selected" : ""}`}
              onClick={() => setFilter("all")}
              aria-pressed={filter === "all"}
            >
              All statuses
            </button>
            <button
              className={`filter-chip ${filter === "critical" ? "selected" : ""}`}
              onClick={() => setFilter("critical")}
              aria-pressed={filter === "critical"}
            >
              Critical priority
            </button>
            <button
              className={`filter-chip ${filter === "mobilizing" ? "selected" : ""}`}
              onClick={() => setFilter("mobilizing")}
              aria-pressed={filter === "mobilizing"}
            >
              Mobilizing this week
            </button>
          </div>
          <label className="search-pill booking-search" style={{ width: 230 }}>
            <Search size={14} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search client or ID"
              aria-label="Search booking dossiers"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Client / Project</th>
                <th>Crane & Site</th>
                <th>Lifecycle stage</th>
                <th>Docs</th>
                <th>Mobilization</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleBookings.map((booking, index) => (
                <tr
                  key={`booking-table-${booking.id}-${index}`}
                  onClick={() => setDetail(booking)}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ")
                      setDetail(booking);
                  }}
                >
                  <td>
                    <strong style={{ color: "#ef7377" }}>{booking.id}</strong>
                    <div className="muted">Created by Sales</div>
                  </td>
                  <td>
                    <strong>{booking.client}</strong>
                    <div className="muted">{booking.project}</div>
                  </td>
                  <td>
                    <strong>{booking.crane}</strong>
                    <div className="muted">{booking.site}</div>
                  </td>
                  <td>
                    <StatusBadge value={booking.stage} />
                  </td>
                  <td style={{ minWidth: 100 }}>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${booking.progress === 100 ? "green" : ""}`}
                        style={{ width: `${booking.progress}%` }}
                      />
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {booking.progress}% complete
                    </div>
                  </td>
                  <td>{booking.mob}</td>
                  <td>
                    <ArrowRight size={15} color="#777" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleBookings.length === 0 && (
            <div className="empty-state">No dossiers match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Wizard({
  onCreated,
  onCancel,
}: {
  onCreated: (booking: Booking) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [wizardToast, setWizardToast] = useState("");
  const [selectedCrane, setSelectedCrane] = useState(
    "200T Mobile Crane · B-205"
  );
  const [selectedCrew, setSelectedCrew] = useState([
    "Vineeth Vijayan",
    "Anoop Panikashery",
    "Vijayakumar",
    "Amal Krishnan",
  ]);
  const [selectedGear, setSelectedGear] = useState([
    "4-leg wire rope sling",
    "Bow shackle · 35T",
  ]);
  const [craneFilter, setCraneFilter] = useState<
    "capacity" | "available" | "fleet"
  >("capacity");
  const craneOptions = [
    {
      name: "200T Mobile Crane · B-205",
      type: "LTM 1200 · 200T capacity",
      status: "Available",
      cert: "Inspection valid · 15 Jan 2027",
    },
    {
      name: "250T Mobile Crane · B-213",
      type: "LTM 1250 · 250T capacity",
      status: "Assigned",
      cert: "Inspection valid · 06 Nov 2026",
    },
    {
      name: "350T Mobile Crane · B-217",
      type: "LTM 1350 · 350T capacity",
      status: "Available",
      cert: "Inspection valid · 23 Oct 2026",
    },
  ];
  const visibleCranes = craneOptions.filter(crane =>
    craneFilter === "capacity"
      ? Number.parseInt(crane.type, 10) >= 200
      : craneFilter === "available"
        ? crane.status === "Available"
        : crane.name.includes("B-")
  );
  const [form, setForm] = useState({
    client: "Gulf Contracting LLC",
    project: "Downtown Tower Lift",
    pm: "Rohan Mathew",
    lpo: "LPO-2026-0481",
    mob: "2026-08-11",
    offHire: "2026-08-18",
    contact: "Akhil Thomas",
    email: "operations@gulfcontracting.ae",
    phone: "+971 50 123 4418",
    priority: "Critical",
    docs: "Trade license, LPO, site access pass, method statement",
  });
  const update = (key: string, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const next = () => {
    if (
      step === 1 &&
      (!form.client || !form.email || !form.mob || !form.offHire)
    ) {
      setWizardToast(
        "Complete client, email, and mobilization dates before continuing."
      );
      setTimeout(() => setWizardToast(""), 2600);
      return;
    }
    setStep(current => Math.min(6, current + 1));
  };
  const finish = () => {
    const booking: Booking = {
      id: `BOB Booking-${Math.floor(10000 + Math.random() * 89999)}`,
      client: form.client,
      project: form.project,
      crane: selectedCrane.split(" · ")[0],
      site: "Dubai Downtown",
      stage: "Created by Salesperson",
      priority: form.priority as Booking["priority"],
      progress: 0,
      mob: "11 Aug 2026",
      offHire: "18 Aug 2026",
      pm: form.pm,
      crew: `${selectedCrew.length} assigned`,
    };
    onCreated(booking);
  };
  return (
    <div className="content">
      <div className="wizard-shell">
        <PageHeading
          eyebrow="Sales intake · 6 steps"
          title="Create a new booking dossier"
          copy="Capture the client brief, allocate compliant resources, and broadcast the handoff to all eight departments."
          action={
            <button className="secondary-button" onClick={onCancel}>
              <X size={14} /> Cancel
            </button>
          }
        />
        <div className="wizard-steps">
          {[
            "Client & project",
            "Crane selection",
            "Broadcast",
            "Crew assignment",
            "Lifting gears",
            "Review & create",
          ].map((label, index) => (
            <div
              key={label}
              className={`wizard-step ${step === index + 1 ? "active" : step > index + 1 ? "done" : ""}`}
            >
              <div className="wizard-index">
                {step > index + 1 ? <Check size={12} /> : `0${index + 1}`}
              </div>
              {label}
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                Step {step} ·{" "}
                {
                  [
                    "Client & project dossier",
                    "Crane selection",
                    "System broadcast",
                    "Crew assignment",
                    "Lifting gears",
                    "Review & create",
                  ][step - 1]
                }
              </div>
              <div className="panel-meta">
                {step === 1
                  ? "The notification email is locked once the booking is confirmed."
                  : "Only compliant resources can be attached to a confirmed dossier."}
              </div>
            </div>
            <StatusBadge value={form.priority} />
          </div>
          <div className="panel-body">
            {step === 1 && (
              <div className="form-grid">
                <div className="form-field">
                  <label>Client name *</label>
                  <input
                    className="form-input"
                    value={form.client}
                    onChange={event => update("client", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Project / scope *</label>
                  <input
                    className="form-input"
                    value={form.project}
                    onChange={event => update("project", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Project Manager</label>
                  <input
                    className="form-input"
                    value={form.pm}
                    onChange={event => update("pm", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>LPO reference</label>
                  <input
                    className="form-input"
                    value={form.lpo}
                    onChange={event => update("lpo", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Mobilization date *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.mob}
                    onChange={event => update("mob", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Off-hire date *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.offHire}
                    onChange={event => update("offHire", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Client contact person</label>
                  <input
                    className="form-input"
                    value={form.contact}
                    onChange={event => update("contact", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Client contact number</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={event => update("phone", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Client notification email *</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={event => update("email", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Priority tier</label>
                  <select
                    className="form-select"
                    value={form.priority}
                    onChange={event => update("priority", event.target.value)}
                  >
                    <option>Standard</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div className="form-field wide">
                  <label>Required documents checklist</label>
                  <textarea
                    className="form-textarea"
                    value={form.docs}
                    onChange={event => update("docs", event.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 2 && (
              <div>
                <div className="filter-row" style={{ marginBottom: 15 }}>
                  <button
                    className={`filter-chip ${craneFilter === "capacity" ? "selected" : ""}`}
                    onClick={() => setCraneFilter("capacity")}
                    aria-pressed={craneFilter === "capacity"}
                  >
                    200T + capacity
                  </button>
                  <button
                    className={`filter-chip ${craneFilter === "available" ? "selected" : ""}`}
                    onClick={() => setCraneFilter("available")}
                    aria-pressed={craneFilter === "available"}
                  >
                    Available now
                  </button>
                  <button
                    className={`filter-chip ${craneFilter === "fleet" ? "selected" : ""}`}
                    onClick={() => setCraneFilter("fleet")}
                    aria-pressed={craneFilter === "fleet"}
                  >
                    Dubai fleet
                  </button>
                </div>
                <div className="resource-grid">
                  {visibleCranes.map(crane => (
                    <div
                      className={`resource-card ${selectedCrane === crane.name ? "selected" : ""}`}
                      key={crane.name}
                      onClick={() =>
                        crane.status === "Available" &&
                        setSelectedCrane(crane.name)
                      }
                    >
                      <div className="resource-top">
                        <div>
                          <div className="resource-name">{crane.name}</div>
                          <div className="resource-sub">
                            {crane.type}
                            <br />
                            {crane.cert}
                          </div>
                        </div>
                        <StatusBadge value={crane.status} />
                      </div>
                      <div className="resource-action">
                        {selectedCrane === crane.name ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={crane.status !== "Available"}
                            onClick={event => {
                              event.stopPropagation();
                              if (crane.status === "Available")
                                setSelectedCrane(crane.name);
                            }}
                          >
                            Select crane
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="empty-state">
                <div className="brand-mark" style={{ margin: "0 auto 14px" }}>
                  <Send size={18} />
                </div>
                <h3 style={{ margin: 0, color: "#fff" }}>
                  Broadcast ready to send
                </h3>
                <p style={{ maxWidth: 520, margin: "8px auto 18px" }}>
                  On confirmation, the system posts a dashboard card and Team
                  Comms message to all eight departments at the same time.
                </p>
                <div
                  className="filter-row"
                  style={{ justifyContent: "center" }}
                >
                  {departments.map(([name]) => (
                    <span className="status-badge gray" key={name}>
                      <Check size={10} />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {step === 4 && (
              <div>
                <div className="panel-meta" style={{ marginBottom: 12 }}>
                  Required roster: 2 operators · 2 riggers · 1 supervisor · 1
                  banksman
                </div>
                <div className="resource-grid">
                  {crews.map((crew, crewIndex) => (
                    <div
                      key={`${crew.name}-${crew.role}-${crewIndex}`}
                      className={`resource-card ${selectedCrew.includes(crew.name) ? "selected" : ""} ${crew.availability !== "Present" && crew.availability !== "Assigned" ? "blocked" : ""}`}
                      onClick={() => {
                        if (
                          crew.availability === "Present" ||
                          crew.availability === "Assigned"
                        )
                          setSelectedCrew(current =>
                            current.includes(crew.name)
                              ? current.filter(name => name !== crew.name)
                              : [...current, crew.name]
                          );
                      }}
                    >
                      <div className="resource-top">
                        <div style={{ display: "flex", gap: 9 }}>
                          <div className="avatar">{crew.initials}</div>
                          <div>
                            <div className="resource-name">{crew.name}</div>
                            <div className="resource-sub">
                              {crew.role}
                              <br />
                              {crew.cert}
                            </div>
                          </div>
                        </div>
                        <StatusBadge value={crew.availability} />
                      </div>
                      <div className="resource-action">
                        {crew.flag ? (
                          <StatusBadge value="Training required" />
                        ) : selectedCrew.includes(crew.name) ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={event => {
                              event.stopPropagation();
                              setSelectedCrew(current =>
                                current.includes(crew.name)
                                  ? current.filter(name => name !== crew.name)
                                  : [...current, crew.name]
                              );
                            }}
                          >
                            Select
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 5 && (
              <div>
                <div className="panel-meta" style={{ marginBottom: 12 }}>
                  Inspection certificates are checked against the mobilization
                  date. Expired gear cannot be selected.
                </div>
                <div className="resource-grid">
                  {gears.map(gear => (
                    <div
                      key={gear.name}
                      className={`resource-card ${selectedGear.includes(gear.name) ? "selected" : ""} ${gear.status === "Expired" ? "blocked" : ""}`}
                      onClick={() =>
                        gear.status !== "Expired" &&
                        setSelectedGear(current =>
                          current.includes(gear.name)
                            ? current.filter(name => name !== gear.name)
                            : [...current, gear.name]
                        )
                      }
                    >
                      <div className="resource-top">
                        <div>
                          <div className="resource-name">{gear.name}</div>
                          <div className="resource-sub">
                            {gear.type}
                            <br />
                            Certificate {gear.cert}
                            <br />
                            Valid through {gear.expires}
                          </div>
                        </div>
                        {gear.status === "Expired" ? (
                          <Lock size={15} color="#e31e24" />
                        ) : (
                          <StatusBadge value={gear.status} />
                        )}
                      </div>
                      <div className="resource-action">
                        {gear.status === "Expired" ? (
                          <span className="status-badge red">
                            <Lock size={9} />
                            Selection blocked
                          </span>
                        ) : selectedGear.includes(gear.name) ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={event => {
                              event.stopPropagation();
                              setSelectedGear(current =>
                                current.includes(gear.name)
                                  ? current.filter(name => name !== gear.name)
                                  : [...current, gear.name]
                              );
                            }}
                          >
                            Select gear
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 6 && (
              <div>
                <div className="detail-list">
                  <div className="detail-cell">
                    <label>Generated dossier ID</label>
                    <div>BOB Booking-XXXXX</div>
                  </div>
                  <div className="detail-cell">
                    <label>Notification email</label>
                    <div>{form.email}</div>
                  </div>
                  <div className="detail-cell">
                    <label>Client / project</label>
                    <div>
                      {form.client} · {form.project}
                    </div>
                  </div>
                  <div className="detail-cell">
                    <label>Crane</label>
                    <div>{selectedCrane}</div>
                  </div>
                  <div className="detail-cell">
                    <label>Crew</label>
                    <div>{selectedCrew.length} selected</div>
                  </div>
                  <div className="detail-cell">
                    <label>Lifting gear</label>
                    <div>{selectedGear.length} compliant items</div>
                  </div>
                </div>
                <div className="notification" style={{ marginTop: 16 }}>
                  <div className="title">
                    <FolderOpen
                      size={14}
                      style={{ verticalAlign: "-2px", marginRight: 6 }}
                    />
                    Google Drive folder will be generated on confirmation
                  </div>
                  <div className="body">
                    Bk {form.client}-Dubai Downtown-11.08.2026
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="wizard-actions">
            <button
              className="secondary-button"
              onClick={() =>
                step === 1 ? onCancel() : setStep(current => current - 1)
              }
            >
              <ArrowLeft size={14} /> Back
            </button>
            {step < 6 ? (
              <button className="primary-button" onClick={next}>
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button className="primary-button" onClick={finish}>
                <CheckCircle2 size={15} /> Confirm booking
              </button>
            )}
          </div>
        </div>
        {wizardToast && (
          <div className="toast-note">
            <AlertTriangle
              size={14}
              style={{ verticalAlign: "-2px", marginRight: 7 }}
            />
            {wizardToast}
          </div>
        )}
      </div>
    </div>
  );
}

function DocsView({
  bookings,
  setDetail,
}: {
  bookings: Booking[];
  setDetail: (booking: Booking) => void;
}) {
  const docRows = [
    {
      department: "Documentation",
      complete: 92,
      items: "11 / 12",
      blocker: "Signed method statement",
    },
    { department: "HSE / Safety", complete: 100, items: "8 / 8", blocker: "—" },
    {
      department: "Crew Assignment",
      complete: 75,
      items: "6 / 8",
      blocker: "Vijayakumar renewal",
    },
    {
      department: "Lifting Gears",
      complete: 100,
      items: "9 / 9",
      blocker: "—",
    },
    {
      department: "Accounts",
      complete: 60,
      items: "3 / 5",
      blocker: "LPO Rev. 2",
    },
    {
      department: "Transportation",
      complete: 80,
      items: "4 / 5",
      blocker: "Delivery note",
    },
  ];
  return (
    <div className="content">
      <PageHeading
        eyebrow="Compliance control"
        title="Documents & compliance"
        copy="Parallel completion tracking across every department. A dossier cannot be dispatched while a required item is missing, expired, or flagged."
        action={
          <button
            className="secondary-button"
            onClick={() =>
              bookings[0]
                ? setDetail(bookings[0])
                : toast.info("No dossier available", {
                    description:
                      "Create or import a booking before attaching documents.",
                  })
            }
          >
            <CloudUpload size={14} /> Upload document
          </button>
        }
      />
      <div className="metric-grid">
        <MetricCard
          label="Documents in flight"
          value="46"
          foot="Across 9 active dossiers"
          icon={<FileText size={13} />}
        />
        <MetricCard
          label="100% complete"
          value="03"
          foot="Ready for review"
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Revision flags"
          value="04"
          foot="Kick-backs this week"
          icon={<AlertTriangle size={13} />}
        />
        <MetricCard
          label="Expiring soon"
          value="06"
          foot="HSE notified automatically"
          icon={<Clock3 size={13} />}
        />
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Department completion</div>
              <div className="panel-meta">
                BOB Booking-31511 · Gulf Contracting LLC
              </div>
            </div>
            <StatusBadge value="Docs In Progress" />
          </div>
          <div className="panel-body">
            <div className="compliance-list">
              {docRows.map(row => (
                <div key={row.department} className="compliance-row">
                  <div style={{ minWidth: 160 }}>
                    <div className="compliance-name">{row.department}</div>
                    <div className="compliance-sub">
                      {row.items} documents · {row.blocker}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${row.complete === 100 ? "green" : row.complete < 70 ? "amber" : ""}`}
                        style={{ width: `${row.complete}%` }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      width: 42,
                      textAlign: "right",
                      fontSize: 11,
                      color: row.complete === 100 ? "#69d495" : "#ddd",
                    }}
                  >
                    {row.complete}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Ready for review</div>
            <FileCheck2 size={15} color="#69d495" />
          </div>
          <div className="panel-body">
            {bookings
              .filter(
                booking =>
                  booking.stage === "All Docs Submitted" ||
                  booking.stage === "Reviewed"
              )
              .map((booking, index) => (
                <div
                  className="activity-item"
                  key={`activity-${booking.id}-${index}`}
                  onClick={() => setDetail(booking)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="activity-dot"
                    style={{ background: "#31b56b" }}
                  />
                  <div>
                    <div className="activity-text">
                      <strong>{booking.id}</strong>
                      <br />
                      {booking.client}
                    </div>
                    <div className="activity-time">
                      {booking.progress}% complete · Open review{" "}
                      <ArrowRight size={10} style={{ verticalAlign: "-1px" }} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CrewViewLegacy({
  bookings,
  allocations,
  setAllocations,
  focusedBookingId,
  onAddWorkman,
  onAllocationSaved,
}: {
  bookings: Booking[];
  allocations: EmployeeAllocation[];
  setAllocations: React.Dispatch<React.SetStateAction<EmployeeAllocation[]>>;
  focusedBookingId?: string | null;
  onAddWorkman: () => void;
  onAllocationSaved: (details: {
    bookingId: string;
    employeeName: string;
    action: "saved" | "removed";
  }) => void;
}) {
  const saveAllocationsMutation =
    trpc.operations.saveCrewAllocations.useMutation();
  const [filter, setFilter] = useState("All");
  const focusedCrewId = allocations.find(
    allocation => allocation.bookingId === focusedBookingId
  )?.crewId;
  const [selectedCrewId, setSelectedCrewId] = useState(
    focusedCrewId ?? crews[0]?.id ?? ""
  );
  const visible = crews.filter(
    crew => filter === "All" || crew.availability === filter
  );
  const selectedCrew =
    crews.find(crew => crew.id === selectedCrewId) ?? crews[0];
  const setSelectedEmployee = (employeeName: string) => {
    const match = crews.find(crew => crew.name === employeeName);
    if (match) setSelectedCrewId(match.id);
  };
  const visibleBookings = useMemo(
    () => focusAssignmentBooking(bookings, focusedBookingId),
    [bookings, focusedBookingId]
  );
  useEffect(() => {
    if (focusedCrewId) setSelectedCrewId(focusedCrewId);
  }, [focusedCrewId]);
  const employeeAllocations = allocations.filter(allocation =>
    selectedCrew ? allocationMatchesCrew(allocation, selectedCrew) : false
  );
  const exportCalendar = () => {
    const rows = allocations.map(item => {
      const crew = crews.find(candidate =>
        item.crewId
          ? candidate.id === item.crewId
          : candidate.name === item.employeeName
      );
      const booking = bookings.find(b => b.id === item.bookingId);
      return {
        Workman: item.employeeName,
        Designation: crew?.role ?? "Workman",
        BookingID: item.bookingId,
        Client: booking?.client ?? "BOB Cranes Project",
        Mobilization: booking?.mob ?? "August 2026",
        OffHire: booking?.offHire ?? "August 2026",
      };
    });
    if (rows.length === 0) {
      rows.push({
        Workman: "Vineeth Vijayan",
        Designation: "Crane Operator",
        BookingID: "BOB Booking-31511",
        Client: "Gulf Contracting LLC",
        Mobilization: "11 Aug 2026",
        OffHire: "18 Aug 2026",
      });
    }
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Crew Schedule");
    XLSX.writeFile(
      workbook,
      "BOB-Cranes-Crew-Assignment-Calendar-August-2026.xlsx"
    );
    toast.success("Crew calendar exported", {
      description: "Downloaded schedule and allocation spreadsheet.",
    });
  };
  const toggleAllocation = async (booking: Booking) => {
    if (!selectedCrew) return;
    const persistedBookingId = persistedBookingIdForUi(booking.id);
    if (!persistedBookingId) {
      toast.info("Preview dossier", {
        description:
          "This presentation-only dossier is not yet persisted and cannot receive a durable crew allocation.",
      });
      return;
    }
    const conflicts = findEmployeeBookingConflicts(
      selectedCrew.name,
      booking.id,
      bookings,
      allocations,
      selectedCrew.id
    );
    if (conflicts.length > 0)
      toast.warning("Booking overlap detected", {
        description: `${selectedCrew.name} is already allocated to ${conflicts.map(item => item.id).join(", ")} during the same mobilization window.`,
      });
    const wasAssigned = employeeAllocations.some(
      allocation => allocation.bookingId === booking.id
    );
    const nextAllocations = toggleEmployeeBookingAllocation(
      allocations,
      selectedCrew.name,
      booking.id,
      selectedCrew.id
    );
    setAllocations(nextAllocations);
    try {
      const result = await saveAllocationsMutation.mutateAsync({
        crewId: selectedCrew.id,
        crewName: selectedCrew.name,
        bookingIds: nextAllocations
          .filter(allocation => allocationMatchesCrew(allocation, selectedCrew))
          .map(allocation => persistedBookingIdForUi(allocation.bookingId))
          .filter((id): id is string => Boolean(id)),
      });
      setAllocations(
        result.allocations.map(allocation => ({
          employeeName: allocation.crewName,
          crewId: allocation.crewId,
          bookingId: uiBookingIdForPersisted(allocation.bookingId),
        }))
      );
      const action = wasAssigned ? "removed" : "saved";
      toast.success(
        action === "removed"
          ? "Booking allocation removed"
          : "Booking allocation saved",
        {
          description: `${selectedCrew.name} is now linked to the persisted crew schedule.`,
        }
      );
      onAllocationSaved({
        bookingId: booking.id,
        employeeName: selectedCrew.name,
        action,
      });
    } catch (caught) {
      setAllocations(allocations);
      toast.error("Allocation save blocked", {
        description:
          caught instanceof Error
            ? caught.message
            : "The persisted crew allocation could not be saved.",
      });
    }
  };
  return (
    <div className="content">
      <PageHeading
        eyebrow="Resource readiness"
        title="Crew assignment"
        copy="Live workmen availability, certificate validity, training flags, and multi-booking allocation for the documentation supervisor."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-button" onClick={exportCalendar}>
              <Download size={14} /> Export schedule (.xlsx)
            </button>
            <button className="primary-button" onClick={onAddWorkman}>
              <Plus size={15} /> Add workman
            </button>
          </div>
        }
      />
      <div className="panel">
        <div className="panel-header">
          <div className="filter-row">
            {["All", "Present", "On Leave", "Assigned", "Off-Site"].map(
              value => (
                <button
                  key={value}
                  className={`filter-chip ${filter === value ? "selected" : ""}`}
                  onClick={() => setFilter(value)}
                >
                  {value}
                </button>
              )
            )}
          </div>
          <div className="panel-meta">
            {crews.length} tracked workmen · {allocations.length} booking
            allocations
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Workman</th>
                <th>Designation</th>
                <th>Availability</th>
                <th>Certificate status</th>
                <th>Booking allocation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((crew, crewIndex) => {
                const crewAllocations = allocations.filter(
                  allocation => allocation.employeeName === crew.name
                );
                return (
                  <tr
                    key={`${crew.name}-${crew.role}-${crewIndex}`}
                    className={
                      selectedCrew?.name === crew.name ? "selected-row" : ""
                    }
                    onClick={() => setSelectedEmployee(crew.name)}
                  >
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <div className="avatar">{crew.initials}</div>
                        <strong>{crew.name}</strong>
                      </div>
                    </td>
                    <td>{crew.role}</td>
                    <td>
                      <StatusBadge value={crew.availability} />
                    </td>
                    <td>
                      <StatusBadge value={crew.cert} />
                    </td>
                    <td className="muted">
                      {crewAllocations.length
                        ? crewAllocations
                            .map(allocation => allocation.bookingId)
                            .join(", ")
                        : crew.flag
                          ? "Training flag raised"
                          : "Available for assignment"}
                    </td>
                    <td>
                      <MoreHorizontal size={15} color="#777" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="assignment-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                Arrange {selectedCrew?.name ?? "employee"} on bookings
              </div>
              <div className="panel-meta">
                Select multiple dossiers. Overlapping dates remain visible as
                warnings so supervisors can resolve the plan deliberately.
              </div>
            </div>
            <StatusBadge value={`${employeeAllocations.length} assigned`} />
          </div>
          <div className="panel-body">
            <div className="booking-allocation-list">
              {visibleBookings.map((booking, index) => {
                const persisted = Boolean(persistedBookingIdForUi(booking.id));
                const assigned = employeeAllocations.some(
                  allocation => allocation.bookingId === booking.id
                );
                const conflicts = assigned
                  ? findEmployeeBookingConflicts(
                      selectedCrew?.name ?? "",
                      booking.id,
                      bookings,
                      allocations
                    )
                  : [];
                return (
                  <div
                    className={`booking-allocation-row ${assigned ? "selected" : ""}`}
                    key={`allocation-${booking.id}-${index}`}
                  >
                    <div>
                      <strong>{booking.id}</strong>
                      <span>
                        {booking.client} · {booking.mob} → {booking.offHire}
                      </span>
                    </div>
                    <div className="allocation-actions">
                      {conflicts.length > 0 && (
                        <StatusBadge value="Date overlap" />
                      )}
                      {!persisted && <StatusBadge value="Preview only" />}
                      <button
                        disabled={
                          !persisted || saveAllocationsMutation.isPending
                        }
                        className={
                          assigned ? "secondary-button" : "primary-button"
                        }
                        onClick={() => toggleAllocation(booking)}
                      >
                        {!persisted
                          ? "Preview only"
                          : assigned
                            ? "Remove"
                            : saveAllocationsMutation.isPending
                              ? "Saving…"
                              : "Assign"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Allocation guidance</div>
              <div className="panel-meta">
                Multi-booking controls are linked to the dossier date window.
              </div>
            </div>
            <ShieldCheck size={15} color="#138a43" />
          </div>
          <div className="panel-body">
            <div className="department-checklist">
              <div className="department-checklist-row">
                <span>1</span>
                <div>
                  <strong>Check attendance</strong>
                  <small>
                    Present, assigned, leave, and off-site statuses remain
                    visible before allocation.
                  </small>
                </div>
              </div>
              <div className="department-checklist-row">
                <span>2</span>
                <div>
                  <strong>Review training register</strong>
                  <small>
                    Confirm the employee’s onshore/offshore certificates before
                    dispatch.
                  </small>
                </div>
              </div>
              <div className="department-checklist-row">
                <span>3</span>
                <div>
                  <strong>Resolve overlap warnings</strong>
                  <small>
                    Overlaps are surfaced at assignment time and remain visible
                    on the selected employee.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Visual crew assignment calendar</div>
            <div className="panel-meta">
              August 2026 mobilization schedule and crew overlap grid
            </div>
          </div>
          <StatusBadge value="August 2026" />
        </div>
        <div className="panel-body">
          <div className="calendar-grid-wrapper" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workman</th>
                  {[
                    "10 Aug",
                    "11 Aug",
                    "12 Aug",
                    "13 Aug",
                    "14 Aug",
                    "15 Aug",
                    "16 Aug",
                  ].map(day => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crews.map((crew, crewIndex) => {
                  const assignedBookings = allocations.filter(
                    a => a.employeeName === crew.name
                  );
                  return (
                    <tr key={`${crew.name}-${crew.role}-${crewIndex}`}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <div
                            className="avatar"
                            style={{ width: 22, height: 22, fontSize: 10 }}
                          >
                            {crew.initials}
                          </div>
                          <strong>{crew.name}</strong>
                        </div>
                      </td>
                      {[
                        "10 Aug",
                        "11 Aug",
                        "12 Aug",
                        "13 Aug",
                        "14 Aug",
                        "15 Aug",
                        "16 Aug",
                      ].map((day, idx) => {
                        const active =
                          assignedBookings.length > 0 && idx >= 1 && idx <= 4;
                        const taskDetails = active
                          ? `Assigned to ${assignedBookings.map(a => a.bookingId).join(", ")} (${crew.role})`
                          : `Available on ${day}`;
                        return (
                          <td
                            key={`${crew.name}-${day}`}
                            title={taskDetails}
                            style={{ cursor: "help" }}
                          >
                            {active ? (
                              <span
                                className="status-badge green"
                                style={{ fontSize: 10, padding: "2px 6px" }}
                                title={taskDetails}
                              >
                                Allocated
                              </span>
                            ) : (
                              <span style={{ color: "#555", fontSize: 11 }}>
                                Free
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Training flag inbox</div>
            <div className="panel-meta">
              Raised by Documentation Supervisor · visible to Crew and HSE
            </div>
          </div>
          <StatusBadge value="2 open" />
        </div>
        <div className="panel-body">
          <div className="notification-stack">
            <div className="notification">
              <div className="title">
                Vijayakumar · Rigger{" "}
                <StatusBadge value="Renewal due in 16 days" />
              </div>
              <div className="body">
                Rigging certificate renewal and refresher training required
                before next dispatch.
              </div>
            </div>
            <div className="notification">
              <div className="title">
                Shahid Khan · Site Supervisor{" "}
                <StatusBadge value="Training required" />
              </div>
              <div className="body">
                Site-specific lifting plan training required for the Gulf
                Contracting project.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainingView({
  selectedEmployeeId,
}: {
  selectedEmployeeId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [workstream, setWorkstream] = useState<"All" | TrainingWorkstream>(
    "All"
  );
  const [status, setStatus] = useState<"All" | TrainingStatus>("All");
  const [selectedId, setSelectedId] = useState(
    selectedEmployeeId ?? TRAINING_EMPLOYEES[0]?.employeeId ?? ""
  );
  useEffect(() => {
    if (selectedEmployeeId) setSelectedId(selectedEmployeeId);
  }, [selectedEmployeeId]);
  const filtered = useMemo(
    () =>
      TRAINING_EMPLOYEES.filter(employee => {
        const matchesQuery =
          !query.trim() ||
          `${employee.employeeName} ${employee.employeeId} ${employee.position} ${JSON.stringify(employee.certifications)}`
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        const certifications = employee.certifications;
        const matchesWorkstream =
          workstream === "All" ||
          certifications.some(item => item.workstream === workstream);
        const matchesStatus =
          status === "All" ||
          certifications.some(item => item.status === status);
        return matchesQuery && matchesWorkstream && matchesStatus;
      }),
    [query, status, workstream]
  );
  const selected =
    filtered.find(employee => employee.employeeId === selectedId) ??
    filtered[0] ??
    null;
  const totals = useMemo(
    () =>
      TRAINING_EMPLOYEES.reduce(
        (summary, employee) =>
          employee.certifications.reduce(
            (current, item) => ({
              ...current,
              total: current.total + 1,
              recorded: current.recorded + (item.status === "Recorded" ? 1 : 0),
              missing: current.missing + (item.status === "Missing" ? 1 : 0),
              processing:
                current.processing + (item.status === "Processing" ? 1 : 0),
            }),
            summary
          ),
        { total: 0, recorded: 0, missing: 0, processing: 0 }
      ),
    []
  );
  return (
    <div className="content">
      <PageHeading
        eyebrow="People operations · imported register"
        title="Training register"
        copy={`Current onshore and offshore training details imported from ${TRAINING_SOURCE_FILE}. Search employees, filter readiness, and inspect each certificate value.`}
        action={
          <button
            className="secondary-button"
            onClick={() =>
              toast.info("Training source", {
                description: `${TRAINING_EMPLOYEES.length} employees and ${totals.total} certificate entries imported from ${TRAINING_SOURCE_FILE}.`,
              })
            }
          >
            <FileText size={14} /> Source details
          </button>
        }
      />
      <div className="metric-grid">
        <MetricCard
          label="Employees tracked"
          value={`${TRAINING_EMPLOYEES.length}`}
          foot="From source workbook"
          icon={<Users size={13} />}
          tone="green"
        />
        <MetricCard
          label="Recorded"
          value={`${totals.recorded}`}
          foot="Certificate values present"
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Missing"
          value={`${totals.missing}`}
          foot="Requires follow-up"
          icon={<AlertTriangle size={13} />}
        />
        <MetricCard
          label="Processing"
          value={`${totals.processing}`}
          foot="Pending confirmation"
          icon={<Clock3 size={13} />}
        />
      </div>
      <div className="training-toolbar panel">
        <div className="search-pill training-search">
          <Search size={14} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search employee, ID, or position"
            aria-label="Search training employees"
          />
        </div>
        <div className="filter-row">
          <button
            className={`filter-chip ${workstream === "All" ? "selected" : ""}`}
            onClick={() => setWorkstream("All")}
          >
            All workstreams
          </button>
          <button
            className={`filter-chip ${workstream === "Onshore" ? "selected" : ""}`}
            onClick={() => setWorkstream("Onshore")}
          >
            Onshore
          </button>
          <button
            className={`filter-chip ${workstream === "Offshore" ? "selected" : ""}`}
            onClick={() => setWorkstream("Offshore")}
          >
            Offshore
          </button>
        </div>
        <div className="filter-row">
          <button
            className={`filter-chip ${status === "All" ? "selected" : ""}`}
            onClick={() => setStatus("All")}
          >
            All statuses
          </button>
          <button
            className={`filter-chip ${status === "Missing" ? "selected" : ""}`}
            onClick={() => setStatus("Missing")}
          >
            Missing
          </button>
          <button
            className={`filter-chip ${status === "Processing" ? "selected" : ""}`}
            onClick={() => setStatus("Processing")}
          >
            Processing
          </button>
        </div>
      </div>
      <div className="training-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Employees</div>
              <div className="panel-meta">
                {filtered.length} matching source records
              </div>
            </div>
            <StatusBadge
              value={workstream === "All" ? "Onshore + Offshore" : workstream}
            />
          </div>
          <div className="panel-body training-employee-list">
            {filtered.slice(0, 80).map(employee => {
              const missing = employee.certifications.filter(
                item => item.status === "Missing"
              ).length;
              const recorded = employee.certifications.filter(
                item => item.status === "Recorded"
              ).length;
              return (
                <button
                  className={`training-employee-row ${selected?.employeeId === employee.employeeId ? "selected" : ""}`}
                  key={employee.employeeId}
                  onClick={() => setSelectedId(employee.employeeId)}
                >
                  <div className="avatar">
                    {initials(employee.employeeName)}
                  </div>
                  <div className="training-employee-copy">
                    <strong>{employee.employeeName}</strong>
                    <span>
                      {employee.employeeId} · {employee.position}
                    </span>
                    <small>
                      {recorded} recorded · {missing} missing
                    </small>
                  </div>
                  <ArrowRight size={14} />
                </button>
              );
            })}
            {filtered.length > 80 && (
              <div className="empty-state">
                Showing the first 80 matches. Refine the search to inspect more
                employees.
              </div>
            )}
            {filtered.length === 0 && (
              <div className="empty-state">
                No training records match these filters.
              </div>
            )}
          </div>
        </div>
        <div className="panel training-detail-panel">
          {selected ? (
            <>
              <div className="panel-header">
                <div>
                  <div className="panel-title">{selected.employeeName}</div>
                  <div className="panel-meta">
                    {selected.employeeId} · {selected.position}
                  </div>
                </div>
                <StatusBadge
                  value={`${selected.certifications.filter(item => item.status === "Recorded").length}/${selected.certifications.length} recorded`}
                />
              </div>
              <div className="panel-body">
                <div className="training-source-line">
                  <FileText size={14} />
                  <span>Source sheets: {selected.sourceSheets.join(", ")}</span>
                </div>
                <div className="training-cert-list">
                  {selected.certifications.map((item, index) => (
                    <div
                      className="training-cert-row"
                      key={`${selected.employeeId}-${item.training}-${index}`}
                    >
                      <div>
                        <strong>{item.training}</strong>
                        <span>
                          {item.workstream} · {item.value}
                        </span>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Select an employee to inspect training details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GearView() {
  const [filter, setFilter] = useState<
    "all" | "available" | "watch" | "blocked"
  >("all");
  const [addGearOpen, setAddGearOpen] = useState(false);
  const [certificateGear, setCertificateGear] = useState<GearRecord | null>(
    null
  );
  const [allGears, setAllGears] = useState(() =>
    gears.concat([
      {
        name: "Chain sling · 12T",
        type: "Slings · Grade 80",
        cert: "INS-2026-118",
        expires: "26 Aug 2026",
        status: "Compliant" as const,
        selected: false,
      },
    ])
  );
  const visibleGears = allGears.filter(
    gear =>
      filter === "all" ||
      (filter === "available"
        ? gear.status === "Compliant"
        : filter === "blocked"
          ? gear.status === "Expired"
          : gear.expires.includes("2026") && gear.status === "Compliant")
  );
  const filterLabels: Array<[typeof filter, string]> = [
    ["all", "All equipment"],
    ["available", "Available"],
    ["watch", "Inspection watch"],
    ["blocked", "Blocked"],
  ];
  return (
    <>
      <div className="content">
        <PageHeading
          eyebrow="Engineering compliance"
          title="Lifting gear inventory"
          copy="Upload the inspection record and validity period with every new asset. Expired documents stay visible for traceability but hard-block the gear from booking selection."
          action={
            <button
              className="primary-button"
              onClick={() => setAddGearOpen(true)}
            >
              <Plus size={15} /> Add gear
            </button>
          }
        />
        <div className="metric-grid">
          <MetricCard
            label="Gear assets"
            value="124"
            foot="92 currently available"
            icon={<Wrench size={13} />}
          />
          <MetricCard
            label="On-hire"
            value="32"
            foot="Across 14 bookings"
            icon={<Truck size={13} />}
          />
          <MetricCard
            label="Inspection watch"
            value="08"
            foot="Due within 20 days"
            icon={<AlertTriangle size={13} />}
          />
          <MetricCard
            label="Expired"
            value="02"
            foot="Hard-blocked from selection"
            icon={<Lock size={13} />}
          />
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="filter-row">
              {filterLabels.map(([value, label]) => (
                <button
                  key={value}
                  className={`filter-chip ${filter === value ? "selected" : ""}`}
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="panel-meta">
              {visibleGears.length} assets shown · certificate documents and
              validity dates tracked
            </div>
          </div>
          <div className="panel-body">
            <div className="resource-grid">
              {visibleGears.map(gear => {
                const documentCount = gear.documents?.length ?? 0;
                return (
                  <div
                    className={`resource-card ${gear.status === "Expired" ? "blocked" : ""}`}
                    key={gear.name}
                  >
                    <div className="resource-top">
                      <div>
                        <div className="resource-name">{gear.name}</div>
                        <div className="resource-sub">
                          {gear.type}
                          <br />
                          Certificate {gear.cert}
                          <br />
                          Valid through {gear.expires}
                          {gear.validFrom && gear.validUntil ? (
                            <>
                              <br />
                              Validity {formatGearValidityDate(
                                gear.validFrom
                              )}{" "}
                              – {formatGearValidityDate(gear.validUntil)}
                            </>
                          ) : null}
                          <br />
                          {documentCount
                            ? `${documentCount} uploaded inspection document${documentCount === 1 ? "" : "s"}`
                            : "Legacy inspection record"}
                        </div>
                      </div>
                      {gear.status === "Expired" ? (
                        <Lock size={16} color="#e31e24" />
                      ) : (
                        <StatusBadge value={gear.status} />
                      )}
                    </div>
                    <div
                      className="resource-action"
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="secondary-button"
                        onClick={() => setCertificateGear(gear)}
                      >
                        <FileText size={13} />{" "}
                        {documentCount ? "View documents" : "View certificate"}
                      </button>
                      {gear.status === "Expired" && (
                        <span className="status-badge red">
                          <Lock size={9} />
                          Selection blocked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {visibleGears.length === 0 && (
              <div className="empty-state">No gear matches this filter.</div>
            )}
          </div>
        </div>
      </div>
      <GearCreateDialog
        open={addGearOpen}
        onClose={() => setAddGearOpen(false)}
        onSave={gear => {
          setAllGears(current => [...current, gear]);
          setAddGearOpen(false);
          toast.success(
            gear.status === "Expired" ? "Gear added and blocked" : "Gear added",
            {
              description:
                gear.status === "Expired"
                  ? `${gear.name} has expired documentation and cannot be selected for a booking.`
                  : `${gear.name} is available for certificate review.`,
            }
          );
        }}
      />
      <GearCertificateDialog
        gear={certificateGear}
        onClose={() => setCertificateGear(null)}
      />
    </>
  );
}

function GearCertificateDialog({
  gear,
  onClose,
}: {
  gear: GearRecord | null;
  onClose: () => void;
}) {
  if (!gear) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="confirmation-modal gear-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-preview-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="panel-header">
          <div>
            <div id="certificate-preview-title" className="panel-title">
              Inspection documents
            </div>
            <div className="panel-meta">Certificate record · {gear.cert}</div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close certificate preview"
          >
            <X size={16} />
          </button>
        </div>
        <div className="detail-list">
          <div className="detail-cell">
            <label>Asset</label>
            <div>{gear.name}</div>
          </div>
          <div className="detail-cell">
            <label>Type / safe working load</label>
            <div>{gear.type}</div>
          </div>
          <div className="detail-cell">
            <label>Certificate number</label>
            <div>{gear.cert}</div>
          </div>
          <div className="detail-cell">
            <label>Validity period</label>
            <div>
              {gear.validFrom && gear.validUntil
                ? `${formatGearValidityDate(gear.validFrom)} – ${formatGearValidityDate(gear.validUntil)}`
                : `Valid through ${gear.expires}`}
            </div>
          </div>
          <div className="detail-cell">
            <label>Selection state</label>
            <div>
              <StatusBadge
                value={
                  gear.status === "Expired" ? "Selection blocked" : "Compliant"
                }
              />
            </div>
          </div>
        </div>
        <div className="compliance-list" style={{ marginTop: 14 }}>
          {gear.documents?.length ? (
            gear.documents.map((document, index) => (
              <a
                key={`${document.name}-${index}`}
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="compliance-row clickable-row"
              >
                <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                  <FileText size={15} />
                  <div>
                    <div className="compliance-name">{document.name}</div>
                    <div className="compliance-sub">
                      {document.contentType ?? "Inspection document"}
                      {document.size
                        ? ` · ${(document.size / 1024).toFixed(0)} KB`
                        : ""}
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} />
              </a>
            ))
          ) : (
            <div className="empty-state">
              This established asset has a legacy inspection reference but no
              uploaded source file.
            </div>
          )}
        </div>
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type GearCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (gear: GearRecord) => void;
};

function GearCreateDialog({ open, onClose, onSave }: GearCreateDialogProps) {
  const uploadGearDocument = trpc.operations.uploadGearDocument.useMutation();
  const [form, setForm] = useState({
    name: "",
    type: "",
    cert: "",
    validFrom: "",
    validUntil: "",
  });
  const [documents, setDocuments] = useState<File[]>([]);
  useEffect(() => {
    if (open) {
      setForm({ name: "", type: "", cert: "", validFrom: "", validUntil: "" });
      setDocuments([]);
    }
  }, [open]);
  if (!open) return null;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.type.trim() ||
      !form.cert.trim() ||
      !form.validFrom ||
      !form.validUntil ||
      !documents.length
    ) {
      toast.error("Complete the compliant gear record", {
        description:
          "Add the asset details, an inspection document, and the document validity period.",
      });
      return;
    }
    if (!isValidGearDocumentPeriod(form.validFrom, form.validUntil)) {
      toast.error("Check the validity period", {
        description:
          "The validity end date must be on or after the validity start date.",
      });
      return;
    }
    if (documents.some(file => file.size > 7_500_000)) {
      toast.error("Document too large", {
        description: "Each gear inspection document must be 7.5 MB or smaller.",
      });
      return;
    }
    try {
      const uploadedDocuments = await Promise.all(
        documents.map(async file => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(String(reader.result).split(",")[1] ?? "");
            reader.onerror = () =>
              reject(new Error(`Unable to read ${file.name}.`));
            reader.readAsDataURL(file);
          });
          return await uploadGearDocument.mutateAsync({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            base64,
          });
        })
      );
      const status = gearDocumentStatus(form.validUntil);
      const record: GearRecord = {
        name: form.name.trim(),
        type: form.type.trim(),
        cert: form.cert.trim(),
        expires: formatGearValidityDate(form.validUntil),
        validFrom: form.validFrom,
        validUntil: form.validUntil,
        status,
        selected: false,
        documents: uploadedDocuments,
      };
      if (
        !gears.some(
          gear => gear.name === record.name && gear.cert === record.cert
        )
      )
        gears.push(record);
      onSave(record);
    } catch (error) {
      toast.error("Document upload failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="confirmation-modal gear-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-gear-title"
        onClick={event => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="panel-header">
          <div>
            <div id="add-gear-title" className="panel-title">
              Add lifting gear
            </div>
            <div className="panel-meta">
              Upload inspection evidence and enter its validity period before
              the asset enters inventory.
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close add gear dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>Gear name *</span>
            <input
              className="form-input"
              value={form.name}
              onChange={event =>
                setForm(current => ({ ...current, name: event.target.value }))
              }
              placeholder="e.g. Bow shackle · 35T"
            />
          </label>
          <label className="form-field">
            <span>Type / SWL *</span>
            <input
              className="form-input"
              value={form.type}
              onChange={event =>
                setForm(current => ({ ...current, type: event.target.value }))
              }
              placeholder="e.g. Shackles · Grade 8"
            />
          </label>
          <label className="form-field">
            <span>Inspection certificate *</span>
            <input
              className="form-input"
              value={form.cert}
              onChange={event =>
                setForm(current => ({ ...current, cert: event.target.value }))
              }
              placeholder="INS-2026-000"
            />
          </label>
          <label className="form-field">
            <span>Inspection document(s) *</span>
            <input
              className="form-input"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,.docx"
              onChange={event =>
                setDocuments(Array.from(event.target.files ?? []))
              }
              aria-label="Upload lifting gear inspection documents"
            />
            <small>
              {documents.length
                ? `${documents.length} document${documents.length === 1 ? "" : "s"} ready to upload`
                : "PDF, image, or DOCX · up to 7.5 MB each"}
            </small>
          </label>
          <label className="form-field">
            <span>Document valid from *</span>
            <input
              className="form-input"
              type="date"
              value={form.validFrom}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  validFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className="form-field">
            <span>Document valid until *</span>
            <input
              className="form-input"
              type="date"
              value={form.validUntil}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  validUntil: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="notification" style={{ marginTop: 14 }}>
          <div className="title">
            <Upload
              size={14}
              style={{ verticalAlign: "-2px", marginRight: 6 }}
            />
            Compliance gate
          </div>
          <div className="body">
            Documents are stored with the gear record. A past validity end date
            keeps the asset visible but blocks it from booking selection.
          </div>
        </div>
        <div className="confirmation-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={uploadGearDocument.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={uploadGearDocument.isPending}
          >
            {uploadGearDocument.isPending
              ? "Uploading documents…"
              : "Upload documents & add gear"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BookingDetail({
  booking,
  documents,
  allocations,
  assignmentSavedMessage,
  generatedBy,
  onBack,
  onUpdate,
  onEditAssignment,
  onOpenClientPortal,
}: {
  booking: Booking;
  documents: DocumentItem[];
  allocations: EmployeeAllocation[];
  assignmentSavedMessage?: string | null;
  generatedBy: string;
  onBack: () => void;
  onUpdate: (booking: Booking) => void;
  onEditAssignment: () => void;
  onOpenClientPortal: () => void;
}) {
  const [toast, setToast] = useState("");
  const assignedCrew = useMemo(
    () =>
      CREW_ASSIGNMENT_ROSTER.filter(crew =>
        allocations.some(
          allocation =>
            allocation.bookingId === booking.id &&
            (allocation.crewId
              ? allocation.crewId === crew.id
              : allocation.employeeName === crew.name)
        )
      ),
    [allocations, booking.id]
  );
  const crews = legacyCrews;
  const dossierCrew = assignedCrew.length
    ? assignedCrew
    : legacyCrews.slice(0, 4);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dispatchPreview, setDispatchPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<string | null>(null);
  const [bundlePreview, setBundlePreview] = useState(false);
  const [bundleProgress, setBundleProgress] = useState(0);
  const [bundleProgressLabel, setBundleProgressLabel] = useState("");
  const [bundleStatus, setBundleStatus] = useState<
    "idle" | "generating" | "ready" | "error"
  >("idle");
  const [revisionFlag, setRevisionFlag] = useState(false);
  const [targetedNotifications, setTargetedNotifications] = useState<
    { departmentCode: string; title: string; body: string }[]
  >([]);
  const dispatchBundleMutation =
    trpc.operations.requestDispatchBundle.useMutation();
  const dossierDocuments = useMemo(
    () =>
      documents.map(doc =>
        revisionFlag && doc.id === "doc-3"
          ? { ...doc, state: "Revision Required" as const }
          : doc
      ),
    [documents, revisionFlag]
  );
  const completion = documentCompletion(dossierDocuments);
  const departmentRows = useMemo(
    () =>
      [
        {
          code: "DOC" as const,
          name: "Documentation",
          total: dossierDocuments.filter(doc => doc.departmentCode === "DOC")
            .length,
        },
        {
          code: "HSE" as const,
          name: "HSE / Safety",
          total: dossierDocuments.filter(doc => doc.departmentCode === "HSE")
            .length,
        },
        {
          code: "CRW" as const,
          name: "Crew Assignment",
          total: dossierDocuments.filter(doc => doc.departmentCode === "CRW")
            .length,
        },
        {
          code: "ACC" as const,
          name: "Accounts",
          total: dossierDocuments.filter(doc => doc.departmentCode === "ACC")
            .length,
        },
        {
          code: "TRN" as const,
          name: "Transportation",
          total: dossierDocuments.filter(doc => doc.departmentCode === "TRN")
            .length,
        },
      ].map(row => ({
        ...row,
        completion: departmentCompletion(dossierDocuments, row.code),
      })),
    [dossierDocuments]
  );
  const canDispatch = canDispatchByRule(
    booking.stage,
    completion === 100,
    revisionFlag
  );
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };
  const flagForRevision = () => {
    const rollback = revertBooking(
      "All Docs Submitted",
      "Docs In Progress",
      "CRW"
    );
    const nextBooking = {
      ...booking,
      stage: rollback.stage as Stage,
      progress: Math.max(72, completion - 8),
    };
    setRevisionFlag(true);
    setTargetedNotifications(rollback.notifications);
    onUpdate(nextBooking);
    setReviewOpen(false);
    notify(
      `Revision sent back to ${revisionReversionStage("Documentation")}; Crew Assignment and Documentation were notified.`
    );
  };
  const downloadDispatchBundle = async () => {
    if (!canDispatch) return;
    setBundleStatus("generating");
    setBundleProgress(8);
    setBundleProgressLabel("Checking dispatch authorization");
    try {
      const persistedId = persistedBookingIdForUi(booking.id) ?? booking.id;
      await dispatchBundleMutation.mutateAsync({ bookingId: persistedId });
      setBundleProgress(24);
      setBundleProgressLabel("Preparing approved dossier documents");
      const fileName = await generateDispatchBundlePdf({
        booking,
        documents: dossierDocuments,
        crew: dossierCrew.map(crew => ({
          name: crew.name,
          role: crew.role,
          cert: crew.flag ? "Training renewal flagged" : "Compliant",
        })),
        generatedBy,
        onProgress: (progress, label) => {
          setBundleProgress(progress);
          setBundleProgressLabel(label);
        },
      });
      setBundleStatus("ready");
      notify(
        `${fileName} downloaded and the generation was recorded in account activity.`
      );
    } catch (caught) {
      setBundleStatus("error");
      setBundleProgressLabel("PDF generation could not be completed");
      globalToast.error("PDF bundle could not be generated", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };
  useEffect(() => {
    if (bundlePreview) void downloadDispatchBundle();
  }, [bundlePreview]);
  return (
    <div className="content">
      <button
        className="secondary-button"
        onClick={onBack}
        style={{ marginBottom: 20 }}
      >
        <ArrowLeft size={14} /> Back to pipeline
      </button>
      <PageHeading
        eyebrow="Booking dossier"
        title={booking.id}
        copy={`${booking.client} · ${booking.project} · ${booking.site}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-button" onClick={onOpenClientPortal}>
              <MessageCircle size={14} /> Client portal
            </button>
            <button
              className="secondary-button"
              onClick={() => setReviewOpen(true)}
            >
              <FileCheck2 size={14} /> Review docs
            </button>
            <button
              className={`primary-button ${!canDispatch ? "secondary-button" : ""}`}
              disabled={!canDispatch}
              onClick={() => setDispatchPreview(true)}
            >
              <Send size={14} /> Dispatch package
            </button>
          </div>
        }
      />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">8-stage lifecycle</div>
            <div className="panel-meta">
              Role-gated workflow · revisions kick the dossier back to the
              responsible department
            </div>
          </div>
          <StatusBadge value={booking.stage} />
        </div>
        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(100px, 1fr))",
              gap: 6,
              overflowX: "auto",
            }}
          >
            {stages.map((stage, index) => {
              const active = stages.indexOf(booking.stage) >= index;
              return (
                <div
                  key={stage}
                  style={{ minWidth: 100, opacity: active ? 1 : 0.78 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: active ? "#000000" : "#27313d",
                      fontSize: 10,
                      lineHeight: 1.3,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: active ? "var(--equipment-orange)" : "#edf0f4",
                        color: active ? "#000000" : "#27313d",
                        flex: "none",
                      }}
                    >
                      {active ? <Check size={12} /> : index + 1}
                    </div>
                    {stage}
                  </div>
                  {index < stages.length - 1 && (
                    <div
                      style={{
                        height: 2,
                        background: active ? "var(--equipment-orange)" : "#dfe4e9",
                        margin: "10px 0 0 22px",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Dossier details</div>
              <StatusBadge value={booking.priority} />
            </div>
            <div className="panel-body">
              <div className="detail-list">
                <div className="detail-cell">
                  <label>Client</label>
                  <div>{booking.client}</div>
                </div>
                <div className="detail-cell">
                  <label>Project Manager</label>
                  <div>{booking.pm}</div>
                </div>
                <div className="detail-cell">
                  <label>Mobilization</label>
                  <div>{booking.mob}</div>
                </div>
                <div className="detail-cell">
                  <label>Off-hire</label>
                  <div>{booking.offHire}</div>
                </div>
                <div className="detail-cell">
                  <label>Crane</label>
                  <div>{booking.crane}</div>
                </div>
                <div className="detail-cell">
                  <label>Site location</label>
                  <div>{booking.site}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Assigned crew</div>
                <div className="panel-meta">
                  Live availability and certificate status
                </div>
              </div>
              <button className="secondary-button" onClick={onEditAssignment}>
                Edit assignment
              </button>
            </div>
            <div className="panel-body">
              {assignmentSavedMessage && (
                <div className="notification" style={{ marginBottom: 12 }}>
                  <div className="title">
                    <CheckCircle2
                      size={14}
                      style={{ verticalAlign: "-2px", marginRight: 6 }}
                    />
                    Assignment updated
                  </div>
                  <div className="body">{assignmentSavedMessage}</div>
                </div>
              )}
              <div className="resource-grid">
                {dossierCrew.map((crew, index) => (
                  <div
                    className="resource-card selected"
                    key={`${crew.name}-${crew.role}-${index}`}
                  >
                    <div
                      style={{ display: "flex", gap: 9, alignItems: "center" }}
                    >
                      <div className="avatar">{crew.initials}</div>
                      <div>
                        <div className="resource-name">{crew.name}</div>
                        <div className="resource-sub">{crew.role}</div>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 9,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <StatusBadge value={crew.availability} />
                      {crew.flag && <StatusBadge value="Training required" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Document completion</div>
                <div className="panel-meta">
                  All department uploads in parallel
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 750 }}>{completion}%</div>
            </div>
            <div className="panel-body">
              <div className="progress-track" style={{ height: 10 }}>
                <div
                  className={`progress-fill ${completion === 100 ? "green" : ""}`}
                  style={{ width: `${completion}%` }}
                />
              </div>
              <div className="compliance-list" style={{ marginTop: 13 }}>
                {departmentRows.map(row => (
                  <div className="compliance-row" key={row.code}>
                    <div>
                      <div className="compliance-name">{row.name}</div>
                      <div className="compliance-sub">
                        {row.completion}% complete · {row.total} required item
                        {row.total === 1 ? "" : "s"}
                      </div>
                    </div>
                    <StatusBadge
                      value={
                        row.completion === 100
                          ? "Complete"
                          : row.completion === 0
                            ? "Pending"
                            : "In progress"
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Drive archive</div>
              <FolderOpen size={15} color="#69d495" />
            </div>
            <div className="panel-body">
              <div className="locked-input">
                <span>Bk {booking.client}-Dubai Downtown-11.08.2026</span>
                <StatusBadge value="Synced" />
              </div>
              <div className="compliance-sub" style={{ marginTop: 9 }}>
                All uploaded documents are mirrored to the booking folder.
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Dispatch recipient</div>
              <Lock size={15} color="#f2b94b" />
            </div>
            <div className="panel-body">
              <div className="locked-input">
                <span>operations@gulfcontracting.ae</span>
                <span style={{ color: "#777" }}>Locked</span>
              </div>
              <div className="compliance-sub" style={{ marginTop: 9 }}>
                The client email is immutable after Sales confirmation.
              </div>
            </div>
          </div>
        </div>
      </div>
      {targetedNotifications.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Targeted notifications</div>
              <div className="panel-meta">Lifecycle event delivery log</div>
            </div>
            <StatusBadge value={`${targetedNotifications.length} queued`} />
          </div>
          <div className="panel-body">
            <div className="notification-stack">
              {targetedNotifications.map((notification, index) => (
                <div
                  className="notification"
                  key={`${notification.departmentCode}-${index}`}
                >
                  <div className="title">
                    {notification.departmentCode} · {notification.title}
                  </div>
                  <div className="body">
                    {notification.body} · in-app + email
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {previewDocument && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,.78)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div className="panel" style={{ width: "min(680px, 100%)" }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Document preview</div>
                <div className="panel-meta">
                  {previewDocument} · approved submission
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setPreviewDocument(null)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              <div
                style={{
                  minHeight: 280,
                  border: "1px solid #303030",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #242424, #151515)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  padding: 30,
                }}
              >
                <div>
                  <FileText
                    size={40}
                    color="#e31e24"
                    style={{ marginBottom: 12 }}
                  />
                  <div style={{ fontSize: 16, fontWeight: 750, color: "#fff" }}>
                    {previewDocument}
                  </div>
                  <div className="page-copy" style={{ margin: "8px auto 0" }}>
                    Secure preview surface · file integrity verified · mirrored
                    to the booking Drive folder.
                  </div>
                  <div className="status-badge green" style={{ marginTop: 16 }}>
                    <CheckCircle2 size={10} /> Approved document
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {reviewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(720px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  Document review · {booking.id}
                </div>
                <div className="panel-meta">
                  Preview submitted files before moving the dossier to Reviewed.
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setReviewOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              <div className="compliance-list">
                {dossierDocuments.map(doc => (
                  <div className="compliance-row" key={doc.id}>
                    <div
                      style={{ display: "flex", gap: 9, alignItems: "center" }}
                    >
                      <FileText size={15} color="#888" />
                      <div>
                        <div className="compliance-name">{doc.name}</div>
                        <div className="compliance-sub">
                          {doc.departmentCode} · Required · preview available
                        </div>
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 7, alignItems: "center" }}
                    >
                      <StatusBadge
                        value={
                          doc.state === "Revision Required"
                            ? "Revision"
                            : doc.state
                        }
                      />
                      <button
                        className="secondary-button"
                        onClick={() => setPreviewDocument(doc.name)}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="wizard-actions">
                <button className="secondary-button" onClick={flagForRevision}>
                  <AlertTriangle size={14} /> Flag for revision
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    const approval = transitionBooking(
                      "All Docs Submitted",
                      "Reviewed",
                      "Salesperson"
                    );
                    const nextBooking = {
                      ...booking,
                      stage: approval.stage as Stage,
                      progress: 100,
                    };
                    setTargetedNotifications(approval.notifications);
                    onUpdate(nextBooking);
                    setReviewOpen(false);
                    notify(
                      "All submitted documents approved. Dossier is now Reviewed."
                    );
                  }}
                >
                  <CheckCircle2 size={14} /> Approve dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {dispatchPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(760px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div className="panel-header">
              <div>
                <div className="panel-title">Dispatch package preview</div>
                <div className="panel-meta">
                  Locked recipient · operations@gulfcontracting.ae
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setDispatchPreview(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              <div className="notification">
                <div className="title">
                  <Mail
                    size={14}
                    style={{ verticalAlign: "-2px", marginRight: 6 }}
                  />
                  BOB Cranes · Final document package
                </div>
                <div className="body">
                  The email will include the approved PDF bundle, crew manifest,
                  and Drive archive link.
                </div>
              </div>
              <div className="detail-list" style={{ marginTop: 14 }}>
                <div className="detail-cell">
                  <label>Recipient</label>
                  <div>operations@gulfcontracting.ae</div>
                </div>
                <div className="detail-cell">
                  <label>Subject</label>
                  <div>BOB Booking-31511 · Dispatch package</div>
                </div>
                <div className="detail-cell">
                  <label>Bundle</label>
                  <div>6 approved documents · PDF</div>
                </div>
                <div className="detail-cell">
                  <label>Drive archive</label>
                  <div>Bk Gulf Contracting LLC-Dubai Downtown-11.08.2026</div>
                </div>
              </div>
              <div
                className="panel"
                style={{ marginTop: 14, background: "#101010" }}
              >
                <div className="panel-header">
                  <div className="panel-title">Crew manifest</div>
                  <span className="panel-meta">200T Mobile Crane</span>
                </div>
                <div className="panel-body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Designation</th>
                        <th>Compliance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crews.slice(0, 4).map((crew, index) => (
                        <tr key={`${crew.name}-${crew.role}-${index}`}>
                          <td>
                            <strong>{crew.name}</strong>
                          </td>
                          <td>{crew.role}</td>
                          <td>
                            <StatusBadge value="Approved" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="wizard-actions">
                <button
                  className="secondary-button"
                  onClick={() => setBundlePreview(true)}
                >
                  <FileText size={14} /> Preview PDF bundle
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    setDispatchPreview(false);
                    notify(
                      "Final package emailed to the locked notification email."
                    );
                  }}
                >
                  <Send size={14} /> Send final package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {bundlePreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,.78)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(820px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  {bundleStatus === "generating"
                    ? "Generating dispatch PDF"
                    : bundleStatus === "ready"
                      ? "Dispatch PDF ready"
                      : "PDF bundle preview"}
                </div>
                <div className="panel-meta">
                  BOB Booking-31511 · 6 approved files
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setBundlePreview(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              {bundleStatus === "generating" && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ textAlign: "center", padding: "20px 10px 25px" }}
                >
                  <LoaderCircle
                    className="animate-spin"
                    size={34}
                    color="#69d495"
                    style={{ margin: "0 auto 13px" }}
                  />
                  <div style={{ fontSize: 16, fontWeight: 750 }}>
                    {bundleProgressLabel || "Preparing dispatch bundle"}
                  </div>
                  <div
                    className="page-copy"
                    style={{ margin: "7px auto 17px" }}
                  >
                    Your verified dossier is being compiled for download.
                  </div>
                  <div
                    className="progress-track"
                    aria-label={`Dispatch bundle generation ${bundleProgress}% complete`}
                    style={{ height: 10, maxWidth: 460, margin: "0 auto" }}
                  >
                    <div
                      className="progress-fill green"
                      style={{ width: `${bundleProgress}%` }}
                    />
                  </div>
                  <div className="compliance-sub" style={{ marginTop: 9 }}>
                    {bundleProgress}% complete
                  </div>
                </div>
              )}
              {bundleStatus === "error" && (
                <div className="notification" style={{ marginBottom: 14 }}>
                  <div className="title">PDF bundle needs attention</div>
                  <div className="body">{bundleProgressLabel}</div>
                </div>
              )}
              <div className="detail-list">
                <div className="detail-cell">
                  <label>Cover page</label>
                  <div>BOB Cranes dispatch dossier</div>
                </div>
                <div className="detail-cell">
                  <label>Crew manifest</label>
                  <div>4 compliant crew members</div>
                </div>
                <div className="detail-cell">
                  <label>Attachments</label>
                  <div>Method statement · lift plan · LPO · certificates</div>
                </div>
                <div className="detail-cell">
                  <label>Archive</label>
                  <div>Google Drive folder synced</div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  minHeight: 130,
                  border: "1px solid #303030",
                  borderRadius: 8,
                  background: "#111",
                  padding: 18,
                }}
              >
                <div className="eyebrow">
                  BOB CRANES · FINAL DISPATCH PACKAGE
                </div>
                <div style={{ fontSize: 18, fontWeight: 750 }}>
                  Gulf Contracting LLC
                </div>
                <div className="page-copy">
                  200T Mobile Crane · Dubai Downtown · 11 Aug 2026
                </div>
                <div className="compliance-sub" style={{ marginTop: 18 }}>
                  This preview represents the PDF bundle that will be emailed to
                  the locked notification address.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast-note">
          <CheckCircle2
            size={14}
            style={{ verticalAlign: "-2px", marginRight: 7 }}
          />
          {toast}
        </div>
      )}
    </div>
  );
}

type ClientPortalProps = {
  booking: Booking;
  documents: DocumentItem[];
  onUpdate: (booking: Booking) => void;
  onUploadAll: () => void;
  onBackToInternal: () => void;
};

export function ClientPortal({
  booking,
  documents,
  onUpdate,
  onUploadAll,
  onBackToInternal,
}: ClientPortalProps) {
  const crews = legacyCrews;
  const [tab, setTab] = useState<"summary" | "documents" | "chat" | "feedback">(
    "summary"
  );
  const [message, setMessage] = useState("");
  const [uploadToast, setUploadToast] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<
    "Bug report" | "Improvement" | "Other"
  >("Bug report");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentSort, setDocumentSort] = useState<
    "required" | "name" | "department"
  >("required");
  const [messages, setMessages] = useState([
    {
      from: "Documentation",
      text: "Welcome to your BOB Cranes response portal. Please upload the signed site access pass when ready.",
      time: "09:42",
    },
    {
      from: "You",
      text: "Thanks. We will share the updated LPO before close of business.",
      time: "09:47",
    },
  ]);
  const feedbackMutation = trpc.clientFeedback.submit.useMutation();
  const pendingDocs = documents.filter(doc => doc.state === "Required");
  const uploadedDocs = documents.length - pendingDocs.length;
  const progress =
    pendingDocs.length === 0
      ? 100
      : Math.max(
          booking.progress,
          Math.round((uploadedDocs / documents.length) * 100)
        );
  const visibleClientDocuments = useMemo(() => {
    const query = documentSearch.trim().toLocaleLowerCase();
    const stateRank = (state: DocumentItem["state"]) =>
      state === "Required" ? 0 : state === "Revision Required" ? 1 : 2;
    return documents
      .filter(
        document =>
          !query ||
          `${document.name} ${document.departmentCode} ${document.state}`
            .toLocaleLowerCase()
            .includes(query)
      )
      .toSorted((left, right) => {
        if (documentSort === "name") return left.name.localeCompare(right.name);
        if (documentSort === "department")
          return (
            left.departmentCode.localeCompare(right.departmentCode) ||
            left.name.localeCompare(right.name)
          );
        return (
          stateRank(left.state) - stateRank(right.state) ||
          left.name.localeCompare(right.name)
        );
      });
  }, [documentSearch, documentSort, documents]);
  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages(current => [
      ...current,
      { from: "You", text: message, time: "Now" },
    ]);
    setMessage("");
  };
  const notify = (text: string) => {
    setUploadToast(text);
    setTimeout(() => setUploadToast(""), 2800);
  };
  const uploadBatch = () => {
    onUploadAll();
    notify(
      "Batch upload accepted across Documentation, HSE, Accounts, and Transportation."
    );
  };
  const submitDocuments = () => {
    if (pendingDocs.length > 0) return;
    onUpdate({ ...booking, stage: "All Docs Submitted", progress: 100 });
    setTab("summary");
    notify(
      "All documents submitted. Sales review is now required before dispatch."
    );
  };
  const submitFeedback = async () => {
    if (feedbackMessage.trim().length < 10) {
      notify(
        "Please include at least 10 characters so the team can investigate."
      );
      return;
    }
    try {
      await feedbackMutation.mutateAsync({
        bookingId: persistedBookingIdForUi(booking.id) ?? booking.id,
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        contactEmail: feedbackEmail.trim(),
      });
      setFeedbackMessage("");
      setFeedbackEmail("");
      notify(
        "Thank you. Your feedback has been shared with the BOB Cranes team."
      );
    } catch (caught) {
      globalToast.error("Feedback could not be submitted", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };
  const reviewReady =
    booking.stage === "All Docs Submitted" ||
    booking.stage === "Reviewed" ||
    booking.stage === "Dispatched";
  return (
    <div className="client-shell">
      <header className="client-topbar">
        <div className="brand-row">
          <div className="brand-mark brand-logo full-bob-logo-frame">
            <img
              className="brand-logo-image full-bob-logo"
              src="/manus-storage/bob-lifting-your-expectations_2beae224.webp"
              alt="BOB Cranes — Lifting Your Expectations"
            />
          </div>
          <div>
            <div className="brand-title">BOB CRANES</div>
            <div className="brand-subtitle">Client response portal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button
            className="secondary-button client-return-button"
            type="button"
            onClick={onBackToInternal}
            aria-label="Return to Operations Cockpit"
          >
            <ArrowLeft size={14} /> Back to Operations
          </button>
          <span className="status-badge green">
            <ShieldCheck size={10} /> Secure portal
          </span>
          <div className="avatar">GC</div>
        </div>
      </header>
      <main className="client-content">
        <div className="client-hero">
          <div>
            <div className="eyebrow">BOB Booking-31511</div>
            <h1 className="client-title">Gulf Contracting LLC</h1>
            <p className="page-copy">
              Downtown Tower Lift · 200T Mobile Crane · Dubai Downtown
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <StatusBadge value={booking.stage} />
            <div className="compliance-sub" style={{ marginTop: 8 }}>
              Mobilization · 11 Aug 2026
            </div>
          </div>
        </div>
        <div className="client-tabs">
          <button
            className={`client-tab ${tab === "summary" ? "active" : ""}`}
            onClick={() => setTab("summary")}
          >
            Booking summary
          </button>
          <button
            className={`client-tab ${tab === "documents" ? "active" : ""}`}
            onClick={() => setTab("documents")}
          >
            Required documents{" "}
            <span
              className="status-badge amber"
              style={{ marginLeft: 5, padding: "2px 6px" }}
            >
              {pendingDocs.length}
            </span>
          </button>
          <button
            className={`client-tab ${tab === "chat" ? "active" : ""}`}
            onClick={() => setTab("chat")}
          >
            Team chat
          </button>
          <button
            className={`client-tab ${tab === "feedback" ? "active" : ""}`}
            onClick={() => setTab("feedback")}
          >
            Report an issue
          </button>
        </div>
        {tab === "summary" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Your booking progress</div>
                  <div className="panel-meta">
                    BOB Cranes team is coordinating your submission
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 750 }}>{progress}%</div>
              </div>
              <div className="panel-body">
                <ClientProgressRail booking={booking} progress={progress} />
                <div className="compliance-list" style={{ marginTop: 13 }}>
                  {[
                    "Booking confirmed",
                    "Crane and crew assigned",
                    "Lifting gear confirmed",
                    "Documents in progress",
                    "Final review & dispatch",
                  ].map((item, index) => {
                    const complete =
                      index < 3 || (index === 3 && progress === 100);
                    const inProgress = index === 3 && progress < 100;
                    const reviewed =
                      booking.stage === "Reviewed" ||
                      booking.stage === "Dispatched";
                    return (
                      <div className="compliance-row" key={item}>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div
                            className="avatar"
                            style={{
                              width: 24,
                              height: 24,
                              background: complete ? "#214f34" : "#292929",
                            }}
                          >
                            {complete ? (
                              <Check size={12} />
                            ) : inProgress ? (
                              <Clock3 size={12} />
                            ) : (
                              <Lock size={11} />
                            )}
                          </div>
                          <div className="compliance-name">{item}</div>
                        </div>
                        <div className="compliance-sub">
                          {complete
                            ? "Complete"
                            : reviewed && index === 4
                              ? "Ready"
                              : inProgress
                                ? "In progress"
                                : reviewReady && index === 4
                                  ? "Sales review"
                                  : "Upcoming"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {reviewReady && (
                  <div className="notification" style={{ marginTop: 14 }}>
                    <div className="title">100% documents submitted</div>
                    <div className="body">
                      The dossier is in the Sales review queue. Dispatch remains
                      role-gated until Sales approves the final bundle.
                    </div>
                  </div>
                )}
                {reviewReady && (
                  <button
                    className="secondary-button"
                    style={{ marginTop: 12 }}
                    onClick={onBackToInternal}
                  >
                    <ArrowLeft size={14} /> Return to internal review
                  </button>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Assigned crew</div>
                <Users size={15} color="#888" />
              </div>
              <div className="panel-body">
                {crews.slice(0, 4).map(crew => (
                  <div className="activity-item" key={crew.name}>
                    <div className="avatar">{crew.initials}</div>
                    <div>
                      <div className="activity-text">
                        <strong>{crew.name}</strong>
                      </div>
                      <div className="activity-time">{crew.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === "documents" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Required from your team</div>
                  <div className="panel-meta">
                    Accepted formats: PDF, JPG, PNG · max 25MB
                  </div>
                </div>
                <button
                  className="primary-button"
                  onClick={uploadBatch}
                  disabled={pendingDocs.length === 0}
                >
                  {pendingDocs.length === 0 ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <CloudUpload size={14} />
                  )}
                  {pendingDocs.length === 0
                    ? "All uploaded"
                    : "Upload remaining"}
                </button>
              </div>
              <div className="panel-body">
                <div className="notification" style={{ marginBottom: 14 }}>
                  <div className="title">
                    {uploadedDocs}/{documents.length} requirements uploaded ·{" "}
                    {progress}% tracked
                  </div>
                  <div className="body">
                    This demo batch maps uploads to their owning departments and
                    mirrors the Drive archive.
                  </div>
                </div>
                <div className="account-toolbar" style={{ marginBottom: 14 }}>
                  <label className="form-field" style={{ flex: 1 }}>
                    <span>Find a document</span>
                    <div className="input-icon-wrap">
                      <Search size={15} />
                      <input
                        className="form-input"
                        value={documentSearch}
                        onChange={event =>
                          setDocumentSearch(event.target.value)
                        }
                        placeholder="Search name, department, or status"
                        aria-label="Search required documents"
                      />
                    </div>
                  </label>
                  <label className="form-field">
                    <span>Sort by</span>
                    <select
                      className="form-select"
                      value={documentSort}
                      onChange={event =>
                        setDocumentSort(
                          event.target.value as
                            | "required"
                            | "name"
                            | "department"
                        )
                      }
                      aria-label="Sort required documents"
                    >
                      <option value="required">Action needed first</option>
                      <option value="name">Document name A–Z</option>
                      <option value="department">Department</option>
                    </select>
                  </label>
                </div>
                <div className="compliance-list">
                  {visibleClientDocuments.map(doc => (
                    <div className="compliance-row" key={doc.name}>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <FileText size={16} color="#888" />
                        <div>
                          <div className="compliance-name">{doc.name}</div>
                          <div className="compliance-sub">
                            {doc.departmentCode} · client upload · synced to
                            Drive
                          </div>
                        </div>
                      </div>
                      <StatusBadge value={doc.state} />
                    </div>
                  ))}
                  {visibleClientDocuments.length === 0 && (
                    <div className="empty-state">
                      No documents match your current search.
                    </div>
                  )}
                </div>
                {pendingDocs.length === 0 &&
                  booking.stage === "Docs In Progress" && (
                    <button
                      className="primary-button"
                      style={{ marginTop: 16 }}
                      onClick={submitDocuments}
                    >
                      <CheckCircle2 size={14} /> Submit all documents
                    </button>
                  )}
                {booking.stage === "All Docs Submitted" && (
                  <div className="notification" style={{ marginTop: 16 }}>
                    <div className="title">All Docs Submitted</div>
                    <div className="body">
                      Sales has been notified. Open internal review to approve
                      and unlock the dispatch package.
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Need help?</div>
                <MessageCircle size={15} color="#888" />
              </div>
              <div className="panel-body">
                <p className="page-copy" style={{ marginTop: 0 }}>
                  Chat with a BOB Cranes team member about your booking.
                  Messages are routed to the right department.
                </p>
                <div className="filter-row" style={{ marginTop: 14 }}>
                  {[
                    "Documentation",
                    "HSE",
                    "Sales",
                    "Accounts",
                    "Operations",
                  ].map(team => (
                    <span className="status-badge gray" key={team}>
                      {team}
                    </span>
                  ))}
                </div>
                <button
                  className="secondary-button"
                  style={{ marginTop: 18 }}
                  onClick={() => setTab("chat")}
                >
                  <MessageCircle size={14} /> Open team chat
                </button>
              </div>
            </div>
          </div>
        )}
        {tab === "chat" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Your BOB Cranes team</div>
                  <div className="panel-meta">
                    Responses are visible to assigned internal teams
                  </div>
                </div>
                <StatusBadge value="5 teams connected" />
              </div>
              <div className="panel-body">
                <div className="chat-window">
                  {messages.map((item, index) => (
                    <div
                      className={`chat-message ${item.from === "You" ? "outgoing" : ""}`}
                      key={`${item.time}-${index}`}
                    >
                      <div className="avatar">
                        {item.from === "You" ? "GC" : "BOB"}
                      </div>
                      <div>
                        <div className="chat-from">
                          {item.from} · {item.time}
                        </div>
                        <div className="chat-bubble">{item.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="chat-input-row">
                  <input
                    className="form-input"
                    placeholder="Write a message to the BOB team..."
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    onKeyDown={event => event.key === "Enter" && sendMessage()}
                  />
                  <button className="primary-button" onClick={sendMessage}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Routing directory</div>
                <Users size={15} color="#888" />
              </div>
              <div className="panel-body">
                <div className="compliance-list">
                  {[
                    "Documentation",
                    "HSE",
                    "Sales",
                    "Accounts",
                    "Operations Management",
                  ].map((team, index) => (
                    <div className="compliance-row" key={team}>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div
                          className="avatar"
                          style={{
                            background: [
                              "#462225",
                              "#22384d",
                              "#493a1b",
                              "#2d234b",
                              "#214b35",
                            ][index],
                          }}
                        >
                          {team[0]}
                        </div>
                        <div>
                          <div className="compliance-name">{team}</div>
                          <div className="compliance-sub">
                            {index === 0
                              ? "Primary coordinator"
                              : "Available for questions"}
                          </div>
                        </div>
                      </div>
                      <StatusBadge value="Online" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "feedback" && (
          <div className="client-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Help us improve the portal</div>
                  <div className="panel-meta">
                    Share a bug, improvement, or issue with this booking
                    workspace.
                  </div>
                </div>
                <AlertTriangle size={15} color="#d69a28" />
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <label className="form-field">
                    <span>Feedback type</span>
                    <select
                      className="form-select"
                      value={feedbackCategory}
                      onChange={event =>
                        setFeedbackCategory(
                          event.target.value as
                            | "Bug report"
                            | "Improvement"
                            | "Other"
                        )
                      }
                    >
                      <option value="Bug report">Bug report</option>
                      <option value="Improvement">Improvement</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>
                      Email for follow-up <em>(optional)</em>
                    </span>
                    <input
                      className="form-input"
                      type="email"
                      value={feedbackEmail}
                      onChange={event => setFeedbackEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="form-field wide">
                    <span>What happened?</span>
                    <textarea
                      className="form-textarea"
                      value={feedbackMessage}
                      onChange={event => setFeedbackMessage(event.target.value)}
                      placeholder="Please include the affected page, what you expected, and what you saw instead."
                      aria-label="Feedback details"
                      maxLength={2000}
                    />
                    <span className="field-hint">
                      {feedbackMessage.trim().length}/2000 characters · minimum
                      10
                    </span>
                  </label>
                </div>
                <div className="wizard-actions">
                  <button
                    className="primary-button"
                    onClick={submitFeedback}
                    disabled={
                      feedbackMutation.isPending ||
                      feedbackMessage.trim().length < 10
                    }
                  >
                    {feedbackMutation.isPending ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <Send size={14} />
                    )}
                    {feedbackMutation.isPending
                      ? "Sending feedback…"
                      : "Send feedback"}
                  </button>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">What happens next</div>
                <ShieldCheck size={15} color="#69d495" />
              </div>
              <div className="panel-body">
                <div className="compliance-list">
                  <div className="compliance-row">
                    <div>
                      <div className="compliance-name">Recorded securely</div>
                      <div className="compliance-sub">
                        Your report is linked to this booking for the BOB Cranes
                        administrator.
                      </div>
                    </div>
                    <StatusBadge value="Private" />
                  </div>
                  <div className="compliance-row">
                    <div>
                      <div className="compliance-name">
                        Reviewed by the operations team
                      </div>
                      <div className="compliance-sub">
                        Reports are triaged as Open, In review, or Resolved.
                      </div>
                    </div>
                    <StatusBadge value="Tracked" />
                  </div>
                  <div className="compliance-row">
                    <div>
                      <div className="compliance-name">
                        Follow-up when needed
                      </div>
                      <div className="compliance-sub">
                        Leave an email only if you would like a direct response.
                      </div>
                    </div>
                    <StatusBadge value="Optional" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {uploadToast && (
          <div className="toast-note">
            <CheckCircle2
              size={14}
              style={{ verticalAlign: "-2px", marginRight: 7 }}
            />
            {uploadToast}
          </div>
        )}
      </main>
    </div>
  );
}
function AttendanceView({
  records,
  setRecords,
  selectedDate,
  setSelectedDate,
}: {
  records: Record<string, AttendanceRecord>;
  setRecords: React.Dispatch<
    React.SetStateAction<Record<string, AttendanceRecord>>
  >;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"daily" | "summary">("daily");
  const today = dateKey(new Date());
  const baseRecord = defaultAttendanceRecord(attendanceRoster);
  const record =
    records[selectedDate] ??
    (selectedDate === today
      ? baseRecord
      : historicalAttendanceRecord(baseRecord));
  const summary = summarizeAttendance(record);
  const marked = attendanceCompletion(record, attendanceRoster.length);
  const updateStatus = (employeeName: string, status: AttendanceStatus) =>
    setRecords(current => ({
      ...current,
      [selectedDate]: updateAttendance(record, employeeName, status),
    }));
  const markAllPresent = () =>
    setRecords(current => ({
      ...current,
      [selectedDate]: Object.fromEntries(
        attendanceRoster.map(employee => [employee.name, "Present"])
      ) as AttendanceRecord,
    }));
  const goPrevious = () => setSelectedDate(current => shiftDate(current, -1));
  const goNext = () =>
    setSelectedDate(current =>
      current < today ? shiftDate(current, 1) : current
    );

  const departmentsList = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(attendanceRoster.map(e => e.department).filter(Boolean))
      ),
    ],
    []
  );
  const filteredRoster = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return attendanceRoster.filter(employee => {
      const matchesDept =
        deptFilter === "All" || employee.department === deptFilter;
      const matchesQuery =
        !normalized ||
        [employee.name, employee.role, employee.department, record[employee.name]].some(v =>
          (v ?? "").toLowerCase().includes(normalized)
        );
      return matchesDept && matchesQuery;
    });
  }, [query, deptFilter]);

  const monthlyDays = useMemo(
    () => [
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ],
    []
  );
  const monthlySummaryRows = useMemo(
    () =>
      computeMonthlyAttendanceSummary(attendanceRoster, records, monthlyDays),
    [records, monthlyDays]
  );

  return (
    <div className="content">
      <PageHeading
        eyebrow="People operations"
        title="Attendance & August Summary"
        copy="Mark daily attendance, search imported roster records, filter by department, and review monthly days worked and absence reports."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`secondary-button ${viewMode === "daily" ? "selected" : ""}`}
              onClick={() => setViewMode("daily")}
            >
              Daily attendance
            </button>
            <button
              className={`secondary-button ${viewMode === "summary" ? "selected" : ""}`}
              onClick={() => setViewMode("summary")}
            >
              Monthly summary report
            </button>
            {viewMode === "daily" && (
              <button className="primary-button" onClick={markAllPresent}>
                <CheckCircle2 size={14} /> Mark all present
              </button>
            )}
          </div>
        }
      />
      {viewMode === "daily" ? (
        <>
          <div className="attendance-toolbar panel">
            <div className="attendance-date-controls">
              <button
                className="icon-button attendance-nav"
                onClick={goPrevious}
                aria-label="Previous day"
              >
                <ArrowLeft size={15} />
              </button>
              <div>
                <div className="panel-title">
                  {formatAttendanceDate(selectedDate)}
                </div>
                <div className="panel-meta">
                  {selectedDate === today
                    ? "Today · editable attendance"
                    : "Historical record · editable review"}
                </div>
              </div>
              <button
                className="icon-button attendance-nav"
                onClick={goNext}
                disabled={selectedDate >= today}
                aria-label="Next day"
              >
                <ArrowRight size={15} />
              </button>
              {selectedDate !== today && (
                <button
                  className="secondary-button attendance-today"
                  onClick={() => setSelectedDate(today)}
                >
                  Today
                </button>
              )}
            </div>
            <StatusBadge
              value={selectedDate === today ? "Current day" : "History"}
            />
          </div>
          <div className="attendance-summary-grid">
            <MetricCard
              label="Marked"
              value={`${marked}%`}
              foot={`${attendanceRoster.length} employees`}
              icon={<ClipboardCheck size={13} />}
              tone="green"
            />
            <MetricCard
              label="Present"
              value={`${summary.Present}`}
              foot="On duty today"
              icon={<CheckCircle2 size={13} />}
              tone="green"
            />
            <MetricCard
              label="On leave"
              value={`${summary["On Leave"]}`}
              foot="Approved leave"
              icon={<CalendarDays size={13} />}
            />
            <MetricCard
              label="Assigned / off-site"
              value={`${summary.Assigned + summary["Off-Site"]}`}
              foot="Away from base"
              icon={<Users size={13} />}
            />
          </div>
          <div className="panel attendance-panel" style={{ marginTop: 16 }}>
            <div className="panel-header" style={{ flexWrap: "wrap", gap: 12 }}>
              <div>
                <div className="panel-title">Employee attendance roster</div>
                <div className="panel-meta">
                  Showing {filteredRoster.length} of {attendanceRoster.length}{" "}
                  employees for {formatAttendanceDate(selectedDate)}.
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  className="search-pill"
                  style={{
                    width: 220,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: 6,
                  }}
                >
                  <Search size={14} color="#888" />
                  <input
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "inherit",
                      outline: "none",
                      width: "100%",
                      fontSize: 13,
                    }}
                    placeholder="Search name, role, dept..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="mapping-select"
                  style={{ width: 160 }}
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  aria-label="Filter roster by department"
                >
                  {departmentsList.map(dept => (
                    <option value={dept} key={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="panel-body">
              <div className="attendance-list">
                {filteredRoster.map((employee, employeeIndex) => {
                  const status = record[employee.name] ?? "Present";
                  return (
                    <div
                      className="attendance-row"
                      key={`${employee.department}-${employee.name}-${employeeIndex}`}
                    >
                      <div className="attendance-person">
                        <div className="avatar">{employee.initials}</div>
                        <div>
                          <div className="compliance-name">{employee.name}</div>
                          <div className="compliance-sub">
                            {employee.role} ·{" "}
                            <span style={{ color: "#4f9cf9" }}>
                              {employee.department}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="attendance-action">
                        <StatusBadge value={status} />
                        <select
                          className="attendance-select"
                          value={status}
                          onChange={event =>
                            updateStatus(
                              employee.name,
                              event.target.value as AttendanceStatus
                            )
                          }
                          aria-label={`Attendance for ${employee.name}`}
                        >
                          {ATTENDANCE_STATUSES.map(option => (
                            <option value={option} key={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
                {filteredRoster.length === 0 && (
                  <div className="empty-state">
                    No attendance records match this search or department
                    filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">
                August 2026 Attendance Summary Report
              </div>
              <div className="panel-meta">
                Aggregated days worked, absences, leave, and field duty for all
                imported employees.
              </div>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                const sheet = XLSX.utils.json_to_sheet(monthlySummaryRows);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, sheet, "August Summary");
                XLSX.writeFile(
                  workbook,
                  "BOB-Cranes-August-2026-Attendance-Summary.xlsx"
                );
                toast.success("Monthly report exported", {
                  description: "Downloaded attendance summary spreadsheet.",
                });
              }}
            >
              <Download size={14} /> Export summary (.xlsx)
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Days Worked</th>
                  <th>Absences</th>
                  <th>On Leave</th>
                  <th>Assigned / Off-Site</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaryRows.map((row, rowIndex) => {
                  const pct = Math.round(
                    (row.daysWorked / row.totalRecorded) * 100
                  );
                  return (
                    <tr key={`${row.department}-${row.name}-${rowIndex}`}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>
                        <span className="status-badge gray">
                          {row.department}
                        </span>
                      </td>
                      <td className="muted">{row.role}</td>
                      <td>
                        <span style={{ color: "#31b56b", fontWeight: 600 }}>
                          {row.daysWorked} days
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            color: row.absences > 0 ? "#e31e24" : "inherit",
                          }}
                        >
                          {row.absences} days
                        </span>
                      </td>
                      <td>{row.daysOnLeave} days</td>
                      <td>{row.daysAssigned + row.daysOffSite} days</td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div className="progress-track" style={{ width: 80 }}>
                            <div
                              className="progress-fill green"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 11 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="attendance-note">
        <ShieldCheck size={15} />
        <span>
          Attendance changes are kept in this dashboard session and can be
          reviewed by moving back through the date controls or exported as a
          monthly summary.
        </span>
      </div>
    </div>
  );
}

type DepartmentPortalConfig = {
  label: string;
  focus: string;
  checklist: string[];
  entryStage: Stage;
  nextStage?: Stage;
  actionLabel: string;
  owner: string;
  parallelCode?: "MNT" | "HSE" | "ACC" | "HR" | "TRN";
  secondaryStage?: Stage;
  secondaryNextStage?: Stage;
  secondaryActionLabel?: string;
  readOnly?: boolean;
};

const PARALLEL_WORKSTREAMS = ["MNT", "HSE", "ACC", "HR", "TRN"] as const;

const departmentPortalConfigs: Record<string, DepartmentPortalConfig> = {
  sales: {
    label: "Sales & Client Relations",
    focus:
      "Client intake, LPO verification, response portal setup, and dispatch review.",
    checklist: [
      "Confirm client and project details",
      "Verify LPO and locked notification email",
      "Generate BOB Booking dossier and notify departments",
    ],
    entryStage: "Created by Salesperson",
    nextStage: "Documentation Supervisor",
    actionLabel: "Confirm booking",
    owner: "Salesperson",
    secondaryStage: "Reviewed",
    secondaryNextStage: "Dispatched",
    secondaryActionLabel: "Dispatch approved dossier",
  },
  documentation: {
    label: "Documentation & Permits",
    focus:
      "Dossier control, permit packs, additional requirements, and revision queues.",
    checklist: [
      "Review client requirements",
      "Assign crane, crew, and lifting gear evidence",
      "Submit completed documentation pack",
    ],
    entryStage: "Documentation Supervisor",
    nextStage: "Crew Assigned",
    actionLabel: "Assign resources",
    owner: "Documentation Supervisor",
    secondaryStage: "Docs In Progress",
    secondaryNextStage: "All Docs Submitted",
    secondaryActionLabel: "Submit all documents",
  },
  "lifting-gears": {
    label: "Lifting Gears / Engineering",
    focus:
      "Inspection certificates, expiry hard-blocks, and gear confirmation.",
    checklist: [
      "Check shackles, slings, beams, and hooks",
      "Reject expired inspection certificates",
      "Confirm compliant gear for the dossier",
    ],
    entryStage: "Gear Confirmed",
    nextStage: "Docs In Progress",
    actionLabel: "Confirm gear readiness",
    owner: "Lifting Gears Supervisor",
  },
  maintenance: {
    label: "Maintenance",
    focus:
      "Crane readiness, maintenance holds, and equipment release controls.",
    checklist: [
      "Review crane maintenance status",
      "Resolve service or defect holds",
      "Release equipment to operations",
    ],
    entryStage: "Crew Assigned",
    actionLabel: "Mark equipment ready",
    owner: "Maintenance Supervisor",
    parallelCode: "MNT",
  },
  crew: {
    label: "Crew / Workmen Assignment",
    focus:
      "Availability, certificates, role fit, and site-specific training validation.",
    checklist: [
      "Check Present / On Leave / Assigned / Off-Site status",
      "Validate operator, rigger, supervisor, and banksman certificates",
      "Assign compliant crew to the dossier",
    ],
    entryStage: "Crew Assigned",
    nextStage: "Gear Confirmed",
    actionLabel: "Confirm crew",
    owner: "Crew Supervisor",
  },
  hse: {
    label: "HSE / Safety",
    focus: "Lift plans, risk controls, training flags, and safety approvals.",
    checklist: [
      "Review method statement and lift plan",
      "Check site-required certifications and training",
      "Approve safety workstream",
    ],
    entryStage: "Docs In Progress",
    actionLabel: "Approve HSE workstream",
    owner: "HSE Supervisor",
    parallelCode: "HSE",
  },
  accounts: {
    label: "Accounts",
    focus:
      "Commercial documents, LPO evidence, invoice controls, and release checks.",
    checklist: [
      "Validate LPO and commercial documents",
      "Match locked client notification email",
      "Clear accounts workstream",
    ],
    entryStage: "Docs In Progress",
    actionLabel: "Clear accounts",
    owner: "Accounts Supervisor",
    parallelCode: "ACC",
  },
  hr: {
    label: "HR",
    focus:
      "Attendance, roster integrity, training renewals, and workforce readiness.",
    checklist: [
      "Review attendance for the mobilization date",
      "Track training and certification renewals",
      "Confirm workforce readiness",
    ],
    entryStage: "Crew Assigned",
    actionLabel: "Confirm workforce",
    owner: "HR Supervisor",
    parallelCode: "HR",
  },
  transportation: {
    label: "Transportation",
    focus: "Trailers, delivery notes, route readiness, and site movement.",
    checklist: [
      "Assign trailers and delivery resources",
      "Validate delivery note requirements",
      "Confirm transport readiness",
    ],
    entryStage: "Docs In Progress",
    actionLabel: "Confirm transport",
    owner: "Transportation Supervisor",
    parallelCode: "TRN",
  },
  administrator: {
    label: "Administrator / Super Admin",
    focus:
      "Cross-department oversight, account governance, audit evidence, and workflow control.",
    checklist: [
      "Review lifecycle health across all departments",
      "Assign supervisors and unique credentials",
      "Monitor audit log and access status",
    ],
    entryStage: "Created by Salesperson",
    actionLabel: "Review control center",
    owner: "Administrator",
    readOnly: true,
  },
};

function TransportationFleetPanel() {
  const [search, setSearch] = useState("");
  const [fleetType, setFleetType] = useState("All");
  const [registrationFilter, setRegistrationFilter] = useState<
    VehicleRegistrationStatus | "All"
  >("All");
  const [page, setPage] = useState(1);
  const pageSize = 40;
  const vehicleTypes = useMemo(
    () =>
      Array.from(
        new Set(VEHICLE_FLEET.map(vehicle => vehicle.fleetName))
      ).sort(),
    []
  );
  const filteredVehicles = useMemo(
    () =>
      filterVehicleFleet(VEHICLE_FLEET, search, fleetType, registrationFilter),
    [search, fleetType, registrationFilter]
  );
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleVehicles = filteredVehicles.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const resetPage = (update: () => void) => {
    update();
    setPage(1);
  };
  const exportFleet = () => {
    const rows = filteredVehicles.map(vehicle => ({
      "Fleet code": vehicle.fleetCode,
      "Registration number": vehicle.registrationNumber,
      "Fleet name": vehicle.fleetName,
      "Vehicle model": vehicle.vehicleModel,
      "Chassis number": vehicle.chassisNumber,
      "Plate type": vehicle.plateType,
      Colour: vehicle.colour,
      "Year of manufacture": vehicle.yearOfManufacture,
      "Mulkiya expiry": vehicle.mulkiyaExpiry,
      "Registration status": vehicleRegistrationStatus(vehicle.mulkiyaExpiry),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transportation Fleet");
    XLSX.writeFile(workbook, "BOB-Transportation-Fleet.xlsx");
    toast.success("Transportation fleet export prepared", {
      description: `${rows.length} vehicle records included.`,
    });
  };
  return (
    <div className="panel" data-testid="transportation-fleet">
      <div className="panel-header">
        <div>
          <div className="panel-title">Vehicle fleet register</div>
          <div className="panel-meta">
            {VEHICLE_FLEET.length} workbook records · Mulkiya validity is
            monitored for every listed vehicle.
          </div>
        </div>
        <button className="secondary-button" onClick={exportFleet}>
          <Download size={14} /> Export fleet (.xlsx)
        </button>
      </div>
      <div className="panel-body">
        <div className="filter-row" style={{ marginBottom: 14 }}>
          <input
            aria-label="Search transportation vehicles"
            className="form-input"
            style={{ minWidth: 230 }}
            placeholder="Search fleet code, plate, model, or chassis"
            value={search}
            onChange={event => resetPage(() => setSearch(event.target.value))}
          />
          <select
            aria-label="Filter fleet by vehicle type"
            className="form-select"
            value={fleetType}
            onChange={event =>
              resetPage(() => setFleetType(event.target.value))
            }
          >
            <option value="All">All vehicle types</option>
            {vehicleTypes.map(type => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter fleet by registration status"
            className="form-select"
            value={registrationFilter}
            onChange={event =>
              resetPage(() =>
                setRegistrationFilter(
                  event.target.value as VehicleRegistrationStatus | "All"
                )
              )
            }
          >
            <option value="All">All registration states</option>
            <option value="Valid">Valid</option>
            <option value="Expiring soon">Expiring soon</option>
            <option value="Expired">Expired</option>
            <option value="Unknown">Unknown</option>
          </select>
          <span className="status-badge blue">
            {filteredVehicles.length} matching
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fleet code</th>
                <th>Registration</th>
                <th>Vehicle</th>
                <th>Model</th>
                <th>Year</th>
                <th>Mulkiya expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleVehicles.map(vehicle => (
                <tr key={vehicle.id}>
                  <td>
                    <strong>{vehicle.fleetCode}</strong>
                  </td>
                  <td>{vehicle.registrationNumber}</td>
                  <td>{vehicle.fleetName}</td>
                  <td title={vehicle.chassisNumber}>{vehicle.vehicleModel}</td>
                  <td>{vehicle.yearOfManufacture || "—"}</td>
                  <td>{vehicle.mulkiyaExpiry || "Not recorded"}</td>
                  <td>
                    <StatusBadge
                      value={vehicleRegistrationStatus(vehicle.mulkiyaExpiry)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>
            Showing{" "}
            {(currentPage - 1) * pageSize + (visibleVehicles.length ? 1 : 0)}–
            {(currentPage - 1) * pageSize + visibleVehicles.length} of{" "}
            {filteredVehicles.length} vehicles
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="secondary-button compact-button"
              disabled={currentPage === 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <button
              className="secondary-button compact-button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(value => Math.min(totalPages, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DepartmentView({
  department,
  bookings,
  setDetail,
  onAdvance,
  onCompleteWorkstream,
  completedWorkstreams,
}: {
  department: string;
  bookings: Booking[];
  setDetail: (booking: Booking) => void;
  onAdvance: (booking: Booking, config: DepartmentPortalConfig) => void;
  onCompleteWorkstream: (
    booking: Booking,
    config: DepartmentPortalConfig
  ) => void;
  completedWorkstreams: Record<string, string[]>;
}) {
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem("bob-department-recent-searches") ?? "[]");
      return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string").slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [priorityFilter, setPriorityFilter] = useState<"all" | Booking["priority"]>("all");
  const [readinessFilter, setReadinessFilter] = useState<"all" | "ready" | "action">("all");
  const departmentCode =
    DEPARTMENT_LABEL_TO_CODE[department] ?? "administrator";
  const config =
    departmentPortalConfigs[departmentCode] ??
    departmentPortalConfigs.administrator;
  const stageNames = [config.entryStage, config.secondaryStage].filter(
    Boolean
  ) as Stage[];
  const stageQueue = bookings.filter(booking =>
    stageNames.includes(booking.stage)
  );
  const queue = (
    stageQueue.length
      ? stageQueue
      : bookings.filter(booking => booking.progress < 100)
  ).slice(0, 4);
  const readyCount = queue.filter(booking =>
    config.parallelCode
      ? completedWorkstreams[booking.id]?.includes(config.parallelCode)
      : Boolean(
          booking.stage === config.secondaryStage
            ? config.secondaryNextStage
            : config.nextStage
        )
  ).length;
  const nextStageFor = (booking: Booking) =>
    booking.stage === config.secondaryStage
      ? config.secondaryNextStage
      : config.nextStage;
  const [searchSuggestions, setSearchSuggestions] = useState<Booking[]>([]);
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false);
  useEffect(() => {
    const query = workspaceQuery.trim().toLowerCase();
    if (!query) {
      setSearchSuggestions([]);
      setSearchSuggestionsLoading(false);
      return;
    }
    let cancelled = false;
    setSearchSuggestionsLoading(true);
    const timer = window.setTimeout(() => {
      const matches = queue
        .filter(booking => `${booking.id} ${booking.client} ${booking.project} ${booking.site} ${booking.crane}`.toLowerCase().includes(query))
        .slice(0, 5);
      if (!cancelled) {
        setSearchSuggestions(matches);
        setSearchSuggestionsLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [queue, workspaceQuery]);
  const rememberSearch = (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;
    setRecentSearches(previous => {
      const next = [normalized, ...previous.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 6);
      window.localStorage.setItem("bob-department-recent-searches", JSON.stringify(next));
      return next;
    });
  };
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      event.preventDefault();
      searchInputRef.current?.focus();
      setSearchSuggestionsOpen(true);
      setActiveSuggestionIndex(searchSuggestions.length ? 0 : -1);
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [searchSuggestions.length]);
  const selectSuggestion = (booking: Booking) => {
    setWorkspaceQuery(booking.id);
    rememberSearch(booking.id);
    setSearchSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  };
  const highlightQuery = (value: string) => {
    const query = workspaceQuery.trim();
    if (!query) return value;
    const start = value.toLowerCase().indexOf(query.toLowerCase());
    if (start < 0) return value;
    return <>{value.slice(0, start)}<mark>{value.slice(start, start + query.length)}</mark>{value.slice(start + query.length)}</>;
  };
  const visibleQueue = queue.filter(booking => {
    const searchText = `${booking.id} ${booking.client} ${booking.project} ${booking.site} ${booking.crane}`.toLowerCase();
    const matchesQuery = searchText.includes(workspaceQuery.trim().toLowerCase());
    const matchesPriority = priorityFilter === "all" || booking.priority === priorityFilter;
    const isReady = config.parallelCode
      ? Boolean(completedWorkstreams[booking.id]?.includes(config.parallelCode))
      : Boolean(nextStageFor(booking));
    const matchesReadiness = readinessFilter === "all" || (readinessFilter === "ready" ? isReady : !isReady);
    return matchesQuery && matchesPriority && matchesReadiness;
  });
  return (
    <div className="content">
      <PageHeading
        eyebrow="Individual department portal"
        title={config.label}
        copy={config.focus}
        action={
          queue[0] ? (
            <button
              className="primary-button"
              onClick={() => setDetail(queue[0])}
            >
              <ClipboardCheck size={14} /> Open priority dossier
            </button>
          ) : (
            <span className="status-badge green">
              <CheckCircle2 size={12} /> Queue clear
            </span>
          )
        }
      />
      <div className="department-portal-banner">
        <div>
          <div className="eyebrow">{config.owner}</div>
          <div className="panel-title">Dedicated {config.label} dashboard</div>
          <div className="panel-meta">
            This portal is linked to the BOB Cranes eight-stage lifecycle. Work
            is released only from the current stage gate.
          </div>
        </div>
        <div className="department-portal-stage">
          <span>{config.readOnly ? "Access mode" : "Stage gate"}</span>
          <strong>
            {config.readOnly ? "Read-only oversight" : config.entryStage}
          </strong>
          {!config.readOnly &&
            nextStageFor(
              queue[0] ?? ({ stage: config.entryStage } as Booking)
            ) && (
              <>
                <ArrowRight size={15} />
                <strong>
                  {nextStageFor(
                    queue[0] ?? ({ stage: config.entryStage } as Booking)
                  )}
                </strong>
              </>
            )}
        </div>
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Stage queue"
          value={`${queue.length}`}
          foot={`${config.entryStage} dossiers`}
          icon={<Clock3 size={13} />}
        />
        <MetricCard
          label="Ready to hand off"
          value={`${readyCount}`}
          foot={
            config.parallelCode
              ? "Workstream evidence complete"
              : "Checklist complete"
          }
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Compliance watch"
          value="06"
          foot="Certificates due soon"
          icon={<AlertTriangle size={13} />}
        />
        <MetricCard
          label="Notifications"
          value="08"
          foot="In-app + email delivered"
          icon={<Bell size={13} />}
        />
      </div>
      <div className="detail-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">{config.label} action queue</div>
              <div className="panel-meta">
                {config.readOnly
                  ? "Oversight view; operational actions remain with department supervisors."
                  : "Dossiers at this department’s stage gate are actionable."}
              </div>
            </div>
            <StatusBadge
              value={config.readOnly ? "Read-only" : config.entryStage}
            />
          </div>
          <div className="panel-body">
            <div className="department-workspace-toolbar" role="search" aria-label={`${config.label} operations search and filters`}>
              <div className="department-search-field">
                <label className="department-workspace-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    value={workspaceQuery}
                    onChange={event => {
                      setWorkspaceQuery(event.target.value);
                      setSearchSuggestions([]);
                      setSearchSuggestionsLoading(Boolean(event.target.value.trim()));
                      setActiveSuggestionIndex(0);
                      setSearchSuggestionsOpen(true);
                    }}
                    onFocus={() => {
                      setActiveSuggestionIndex(searchSuggestions.length ? 0 : -1);
                      setSearchSuggestionsOpen(true);
                    }}
                    onBlur={() => window.setTimeout(() => setSearchSuggestionsOpen(false), 120)}
                    onKeyDown={event => {
                      if (event.key === "Escape") {
                        setSearchSuggestionsOpen(false);
                        setActiveSuggestionIndex(-1);
                        return;
                      }
                      if (event.key === "Enter" && activeSuggestionIndex < 0 && workspaceQuery.trim()) {
                        rememberSearch(workspaceQuery);
                        setSearchSuggestionsOpen(false);
                        return;
                      }
                      if (!searchSuggestionsOpen || !searchSuggestions.length) return;
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActiveSuggestionIndex(index => (index + 1) % searchSuggestions.length);
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveSuggestionIndex(index => (index - 1 + searchSuggestions.length) % searchSuggestions.length);
                      } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
                        event.preventDefault();
                        selectSuggestion(searchSuggestions[activeSuggestionIndex]);
                      }
                    }}
                    placeholder="Search dossier, client, site or crane"
                    aria-label="Search operational queue"
                    aria-autocomplete="list"
                    aria-controls="department-search-suggestions"
                    aria-activedescendant={activeSuggestionIndex >= 0 ? `department-search-suggestion-${activeSuggestionIndex}` : undefined}
                  />
                </label>
                {workspaceQuery && <button type="button" className="department-search-clear" aria-label="Clear operational queue search" onMouseDown={event => event.preventDefault()} onClick={() => { setWorkspaceQuery(""); setSearchSuggestions([]); setSearchSuggestionsOpen(false); setActiveSuggestionIndex(-1); searchInputRef.current?.focus(); }}><X size={13} aria-hidden="true" /></button>}
                {searchSuggestionsOpen && (searchSuggestionsLoading || searchSuggestions.length > 0 || (!workspaceQuery.trim() && recentSearches.length > 0)) && (
                  <div id="department-search-suggestions" className="department-search-suggestions" role="listbox" aria-label={workspaceQuery.trim() ? "Matching operations" : "Recent searches"} aria-busy={searchSuggestionsLoading}>
                    {!searchSuggestionsLoading && !workspaceQuery.trim() && recentSearches.length > 0 && <>
                      <div className="department-search-recent-title">Recent searches</div>
                      {recentSearches.map(term => <button type="button" role="option" className="department-search-suggestion" key={`recent-${term}`} onMouseDown={event => event.preventDefault()} onClick={() => { setWorkspaceQuery(term); setSearchSuggestionsOpen(false); rememberSearch(term); }}><strong>{term}</strong><span>Recent search</span></button>)}
                    </>}
                    {searchSuggestionsLoading ? <div className="department-search-loading" role="status"><LoaderCircle size={14} aria-hidden="true" /> Finding matching operations…</div> : searchSuggestions.map((booking, index) => (
                      <button
                        key={`suggestion-${booking.id}-${index}`}
                        id={`department-search-suggestion-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeSuggestionIndex}
                        className={`department-search-suggestion${index === activeSuggestionIndex ? " active" : ""}`}
                        onMouseDown={event => event.preventDefault()}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        onClick={() => selectSuggestion(booking)}
                      >
                        <strong>{highlightQuery(booking.id)}</strong>
                        <span>{highlightQuery(`${booking.client} · ${booking.project}`)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as "all" | Booking["priority"])} aria-label="Filter by priority">
                <option value="all">All priorities</option>
                <option value="High">High priority</option>
                <option value="Standard">Standard priority</option>
              </select>
              <select value={readinessFilter} onChange={event => setReadinessFilter(event.target.value as "all" | "ready" | "action")} aria-label="Filter by readiness">
                <option value="all">All readiness</option>
                <option value="ready">Ready to act</option>
                <option value="action">Needs action</option>
              </select>
              <span className="department-filter-result" aria-live="polite">{visibleQueue.length} of {queue.length} dossiers</span>
            </div>
            <div className="compliance-list">
              {visibleQueue.length ? (
                visibleQueue.map((booking, index) => {
                  const parallelDone = config.parallelCode
                    ? completedWorkstreams[booking.id]?.includes(
                        config.parallelCode
                      )
                    : false;
                  const nextStage = nextStageFor(booking);
                  const allParallelDone = PARALLEL_WORKSTREAMS.every(code =>
                    completedWorkstreams[booking.id]?.includes(code)
                  );
                  const canSubmitDocs =
                    config.secondaryNextStage === "All Docs Submitted" &&
                    allParallelDone;
                  return (
                    <div className="department-queue-row" key={`department-queue-${booking.id}-${index}`}>
                      <button
                        className="compliance-row"
                        onClick={() => setDetail(booking)}
                        style={{
                          flex: 1,
                          textAlign: "left",
                          background: "transparent",
                          border: 0,
                          color: "inherit",
                        }}
                      >
                        <div>
                          <div className="compliance-name">
                            {booking.id} · {booking.client}
                          </div>
                          <div className="compliance-sub">
                            {booking.crane} · {booking.site} ·{" "}
                            {booking.priority}
                            {config.parallelCode
                              ? ` · ${parallelDone ? "Workstream complete" : "Evidence required"}`
                              : ""}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <span className="status-badge gray">
                            {booking.progress}%
                          </span>
                          <ArrowRight size={14} color="#777" />
                        </div>
                      </button>
                      {config.readOnly ? (
                        <span className="status-badge blue">
                          Review checklist
                        </span>
                      ) : config.parallelCode ? (
                        <button
                          className="secondary-button compact-button"
                          disabled={parallelDone}
                          onClick={() => onCompleteWorkstream(booking, config)}
                        >
                          {parallelDone
                            ? "Workstream complete"
                            : config.actionLabel}
                        </button>
                      ) : nextStage ? (
                        <button
                          className="secondary-button compact-button"
                          disabled={
                            config.secondaryNextStage ===
                              "All Docs Submitted" && !canSubmitDocs
                          }
                          onClick={() => onAdvance(booking, config)}
                        >
                          {config.secondaryNextStage === "All Docs Submitted" &&
                          !canSubmitDocs
                            ? "Awaiting all departments"
                            : booking.stage === config.secondaryStage
                              ? config.secondaryActionLabel
                              : config.actionLabel}
                        </button>
                      ) : (
                        <span className="status-badge blue">
                          Review checklist
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">
                  {queue.length ? "No dossiers match the selected search and filters." : "No dossiers are waiting at this stage gate."}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Working procedure</div>
            <ShieldCheck size={15} color="#138a43" />
          </div>
          <div className="panel-body">
            <div className="department-checklist">
              {config.checklist.map((item, index) => (
                <div className="department-checklist-row" key={item}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item}</strong>
                    <small>
                      Evidence remains attached to the booking dossier.
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="notification" style={{ marginTop: 14 }}>
              <div className="title">
                {config.readOnly ? "Oversight rule" : "Flawless handoff rule"}
              </div>
              <div className="body">
                {config.readOnly
                  ? "Administrators monitor the workflow and manage supervisors; stage actions remain with the owning department."
                  : config.parallelCode
                    ? `When this workstream is complete, Documentation receives a persisted notification. All ${PARALLEL_WORKSTREAMS.length} parallel workstreams must be complete before All Docs Submitted.`
                    : `When the checklist is complete, the dossier advances to ${config.nextStage ?? config.secondaryNextStage ?? "the supervisor review queue"}; the next department receives a persisted notification.`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DepartmentWorkspaceControls({
  dashboard,
  config,
  canManage,
  canArchiveWorkflows,
  showWorkflow,
}: {
  dashboard: { code: string; name: string };
  config: DepartmentDashboardConfig;
  canManage: boolean;
  canArchiveWorkflows: boolean;
  showWorkflow: boolean;
}) {
  const utils = trpc.useUtils();
  const workflowInput = useMemo(() => ({ departmentCode: dashboard.code }), [dashboard.code]);
  const templatesQuery = trpc.departments.listWorkflowTemplates.useQuery(workflowInput);
  const updateConfig = trpc.departments.updateDashboardConfig.useMutation();
  const createWorkflow = trpc.departments.createWorkflowTemplate.useMutation();
  const setWorkflowActive = trpc.departments.setWorkflowTemplateActive.useMutation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [overviewLabel, setOverviewLabel] = useState(config.overviewLabel);
  const [objective, setObjective] = useState(config.objective);
  const [widgets, setWidgets] = useState<DepartmentDashboardWidget[]>(config.widgets);
  const [metrics, setMetrics] = useState<[DepartmentDashboardMetric, DepartmentDashboardMetric]>(config.metrics);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [checklist, setChecklist] = useState<WorkflowChecklistItem[]>(() => defaultWorkflowChecklist(config.workstream));

  useEffect(() => {
    setOverviewLabel(config.overviewLabel);
    setObjective(config.objective);
    setWidgets(config.widgets);
    setMetrics(config.metrics);
    setChecklist(defaultWorkflowChecklist(config.workstream));
  }, [config]);

  const toggleWidget = (widget: DepartmentDashboardWidget) => {
    setWidgets(current => current.includes(widget) ? current.filter(item => item !== widget) : [...current, widget]);
  };
  const saveConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateConfig.mutateAsync({ code: dashboard.code, overviewLabel, objective, widgets, metrics });
      await utils.departments.listProvisioned.invalidate();
      toast.success("Dashboard widgets saved", { description: `${dashboard.name} now uses the selected metric and widget layout.` });
      setSettingsOpen(false);
    } catch (error) {
      toast.error("Dashboard configuration could not be saved", { description: error instanceof Error ? error.message : "Review the workspace settings and try again." });
    }
  };
  const createTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createWorkflow.mutateAsync({ departmentCode: dashboard.code, name: templateName, description: templateDescription, checklist });
      await utils.departments.listWorkflowTemplates.invalidate(workflowInput);
      setTemplateName("");
      setTemplateDescription("");
      setChecklist(defaultWorkflowChecklist(config.workstream));
      setTemplateOpen(false);
      toast.success("Workflow template created", { description: "The required document checklist is now available to this department." });
    } catch (error) {
      toast.error("Workflow template could not be created", { description: error instanceof Error ? error.message : "Review the checklist and try again." });
    }
  };
  const setTemplateStatus = async (id: string, active: boolean) => {
    try {
      await setWorkflowActive.mutateAsync({ id, departmentCode: dashboard.code, active });
      await utils.departments.listWorkflowTemplates.invalidate(workflowInput);
      toast.success(active ? "Workflow restored" : "Workflow archived", { description: "Workflow history has been retained." });
    } catch (error) {
      toast.error("Workflow status could not be updated", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };
  const metricOptions: Array<{ value: DepartmentDashboardMetric; label: string }> = [
    { value: "active_dossiers", label: "Active dossiers" }, { value: "priority_dossiers", label: "Priority dossiers" }, { value: "assigned_team", label: "Assigned team" }, { value: "total_dossiers", label: "Total dossiers" },
  ];

  return <>
    <section className="panel department-workspace-controls" style={{ marginTop: 16 }}>
      <div className="panel-header"><div><div className="panel-title"><Settings size={16} /> Workspace configuration</div><div className="panel-meta">{canManage ? "Select the dashboard widgets and metric emphasis most useful for this department." : "This workspace’s widgets are configured by its supervisor or an administrator."}</div></div>{canManage && <button className="secondary-button compact-button" type="button" onClick={() => setSettingsOpen(open => !open)}>{settingsOpen ? "Close settings" : "Edit widgets"}</button>}</div>
      {settingsOpen && canManage && <form className="panel-body department-config-form" onSubmit={saveConfig}>
        <label className="wide"><span>Workspace title</span><input className="form-input" value={overviewLabel} onChange={event => setOverviewLabel(event.target.value)} minLength={3} maxLength={160} required /></label>
        <label className="wide"><span>Operational objective</span><textarea className="form-textarea" value={objective} onChange={event => setObjective(event.target.value)} minLength={12} maxLength={600} required /></label>
        <div className="wide"><span className="department-control-label">Visible widgets</span><div className="department-widget-options">{DEPARTMENT_DASHBOARD_WIDGETS.map(widget => <label key={widget}><input type="checkbox" checked={widgets.includes(widget)} onChange={() => toggleWidget(widget)} /><span>{widget.replaceAll("_", " ")}</span></label>)}</div></div>
        <label><span>Primary metric</span><select className="form-select" value={metrics[0]} onChange={event => setMetrics([event.target.value as DepartmentDashboardMetric, metrics[1]])}>{metricOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Secondary metric</span><select className="form-select" value={metrics[1]} onChange={event => setMetrics([metrics[0], event.target.value as DepartmentDashboardMetric])}>{metricOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button className="primary-button" type="submit" disabled={updateConfig.isPending || !widgets.length}>{updateConfig.isPending ? "Saving widgets…" : "Save workspace layout"}</button>
      </form>}
    </section>
    {showWorkflow && <section className="panel department-workflow-library" style={{ marginTop: 16 }}><div className="panel-header"><div><div className="panel-title"><FileText size={16} /> Workflow templates & document checklists</div><div className="panel-meta">Standardise required evidence and assigned-user guidance before work begins.</div></div>{canManage && <button className="secondary-button compact-button" type="button" onClick={() => setTemplateOpen(open => !open)}><Plus size={13} /> {templateOpen ? "Close editor" : "New template"}</button>}</div>
      {templateOpen && canManage && <form className="panel-body department-config-form" onSubmit={createTemplate}><label><span>Template name</span><input className="form-input" value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="e.g. Standard mobilisation pack" minLength={3} maxLength={160} required /></label><label><span>Purpose</span><input className="form-input" value={templateDescription} onChange={event => setTemplateDescription(event.target.value)} placeholder="When should this checklist be used?" minLength={12} maxLength={800} required /></label><div className="wide"><span className="department-control-label">Required document checklist</span><div className="workflow-checklist-editor">{checklist.map((item, index) => <div key={item.id} className="workflow-checklist-row"><input className="form-input" value={item.label} onChange={event => setChecklist(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry))} aria-label={`Checklist item ${index + 1}`} /><label className="workflow-required"><input type="checkbox" checked={item.required} onChange={event => setChecklist(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, required: event.target.checked } : entry))} /> Required</label><button className="icon-action-button danger" type="button" onClick={() => setChecklist(current => current.length > 1 ? current.filter((_, entryIndex) => entryIndex !== index) : current)} aria-label={`Remove ${item.label}`}><X size={14} /></button></div>)}<button className="secondary-button compact-button" type="button" onClick={() => setChecklist(current => [...current, { id: `custom-${Date.now()}`, label: "New required document", category: "Department", required: true, guidance: "Confirm and attach this document before handoff." }])}><Plus size={13} /> Add checklist item</button></div></div><button className="primary-button" type="submit" disabled={createWorkflow.isPending || !checklist.length}>{createWorkflow.isPending ? "Creating workflow…" : "Create workflow template"}</button></form>}
      <div className="panel-body workflow-template-list">{templatesQuery.isLoading ? <div className="empty-state">Loading workflow templates…</div> : templatesQuery.data?.length ? templatesQuery.data.map(template => { const items = Array.isArray(template.checklist) ? template.checklist as WorkflowChecklistItem[] : []; return <article className={`workflow-template-card ${template.active !== 1 ? "archived" : ""}`} key={template.id}><div className="workflow-template-heading"><div><strong>{template.name}</strong><p>{template.description}</p></div><span className={`status-badge ${template.active === 1 ? "green" : "gray"}`}>{template.active === 1 ? "Active" : "Archived"}</span></div><ul>{items.map(item => <li key={item.id}><Check size={13} />{item.label}{item.required && <span>Required</span>}</li>)}</ul>{canManage && <div className="workflow-template-actions"><button className="secondary-button compact-button" type="button" onClick={() => setChecklist(items.length ? items : defaultWorkflowChecklist(config.workstream))}>Use checklist as a starting point</button>{canArchiveWorkflows && <button className="secondary-button compact-button" type="button" onClick={() => void setTemplateStatus(template.id, template.active !== 1)} disabled={setWorkflowActive.isPending}>{template.active === 1 ? "Archive" : "Restore"}</button>}</div>}</article>; }) : <div className="empty-state">No department workflow templates yet. {canManage ? "Create one to standardise document checks and handoffs." : "Your supervisor can add a template when the department is ready."}</div>}</div>
    </section>}
  </>;
}

function ProvisionedDepartmentDashboard({
  dashboard,
  bookings,
  canManageTeam,
  canArchiveWorkflows,
  onOpenDossier,
  onManageTeam,
}: {
  dashboard: {
    code: string;
    name: string;
    description: string;
    accent: string;
    dashboardConfig: unknown;
  };
  bookings: Booking[];
  canManageTeam: boolean;
  canArchiveWorkflows: boolean;
  onOpenDossier: (booking: Booking) => void;
  onManageTeam: () => void;
}) {
  const membersQuery = trpc.auth.listUsers.useQuery();
  const config = normalizeDepartmentDashboardConfig(dashboard.dashboardConfig, { name: dashboard.name });
  const activeBookings = bookings.filter((booking) => booking.stage !== "Dispatched");
  const priorityBookings = activeBookings.filter((booking) => booking.priority === "Critical" || booking.priority === "High");
  const departmentMembers = (membersQuery.data ?? []).filter((member) => member.departmentCode === dashboard.code && member.isActive === 1);
  const accentMap: Record<string, string> = { orange: "#d94c12", blue: "#0a66c2", green: "#137a4b", violet: "#6d4ac6" };
  const accent = accentMap[dashboard.accent] ?? accentMap.orange;
  const firstDossier = activeBookings[0] ?? bookings[0];
  const metricValue: Record<DepartmentDashboardMetric, { value: string; foot: string }> = {
    active_dossiers: { value: String(activeBookings.length), foot: "Across active BOB dossiers" },
    priority_dossiers: { value: String(priorityBookings.length), foot: "Priority actions need attention" },
    assigned_team: { value: String(departmentMembers.length), foot: "Named accounts assigned here" },
    total_dossiers: { value: String(bookings.length), foot: "All visible BOB dossiers" },
  };
  const metricLabels: Record<DepartmentDashboardMetric, string> = { active_dossiers: config.primaryMetricLabel, priority_dossiers: config.secondaryMetricLabel, assigned_team: "Active department team", total_dossiers: "Total dossiers" };
  const primaryMetric = config.metrics[0];
  const secondaryMetric = config.metrics[1];
  const visibleWidgets = new Set(config.widgets);
  return <div className="content" data-testid="provisioned-department-dashboard">
    <div className="page-heading" style={{ borderLeft: `4px solid ${accent}`, paddingLeft: 16 }}><div><div className="eyebrow">Provisioned department workspace</div><h1 className="page-title">{dashboard.name}</h1><p className="page-copy">{dashboard.description}</p></div><div className="status-badge blue"><LayoutDashboard size={12} /> Dedicated dashboard</div></div>
    <div className="metric-grid"><MetricCard label={metricLabels[primaryMetric]} value={metricValue[primaryMetric].value} foot={metricValue[primaryMetric].foot} icon={<ClipboardCheck size={13} />} tone="green" /><MetricCard label={metricLabels[secondaryMetric]} value={metricValue[secondaryMetric].value} foot={metricValue[secondaryMetric].foot} icon={<AlertTriangle size={13} />} tone="red" /><MetricCard label="Active department team" value={String(departmentMembers.length)} foot="Named accounts assigned here" icon={<Users size={13} />} tone="green" /><MetricCard label="Workspace status" value="Ready" foot="Dashboard provisioned and isolated" icon={<CheckCircle2 size={13} />} tone="green" /></div>
    <div className="detail-grid">{visibleWidgets.has("team_readiness") && <section className="panel"><div className="panel-header"><div><div className="panel-title">{config.overviewLabel}</div><div className="panel-meta">{config.objective}</div></div><span className="status-badge amber">{config.workstream}</span></div><div className="panel-body"><div className="notification"><div className="title">Controlled department access</div><div className="body">This dashboard is linked to the <strong>{dashboard.code}</strong> department code. Only its assigned users, supervisor, and administrators can open this workspace.</div></div><div className="workflow-actions" style={{ marginTop: 16 }}><button className="primary-button" type="button" onClick={() => firstDossier && onOpenDossier(firstDossier)} disabled={!firstDossier}><ClipboardCheck size={14} /> {config.quickActions[0]}</button><button className="secondary-button" type="button" onClick={onManageTeam} disabled={!canManageTeam}><Users size={14} /> {canManageTeam ? config.quickActions[1] : "Supervisor access required"}</button></div></div></section>}{visibleWidgets.has("handoff_queue") && <section className="panel"><div className="panel-header"><div><div className="panel-title">Department handoff queue</div><div className="panel-meta">Dossiers are shared with the department’s configured operational focus.</div></div><span className="status-badge blue">{activeBookings.length} active</span></div><div className="panel-body activity-list">{activeBookings.slice(0, 4).map((booking, index) => <button className="activity-row" type="button" key={`handoff-${booking.id}-${index}`} onClick={() => onOpenDossier(booking)}><div className="activity-icon" style={{ color: accent }}><ClipboardCheck size={14} /></div><div className="activity-copy"><div><strong>{booking.id}</strong><span className="activity-action">{booking.client}</span></div><p>{booking.project} · {booking.stage}</p></div><span className="status-badge gray">{booking.priority}</span></button>)}{!activeBookings.length && <div className="empty-state">No active dossiers are currently awaiting this department’s attention.</div>}</div></section>}</div>
    <DepartmentWorkspaceControls dashboard={dashboard} config={config} canManage={canManageTeam} canArchiveWorkflows={canArchiveWorkflows} showWorkflow={visibleWidgets.has("workflow_library")} />
  </div>;
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const advanceBookingStageMutation =
    trpc.operations.advanceBookingStage.useMutation();
  const completeWorkstreamMutation =
    trpc.operations.completeBookingWorkstream.useMutation();
  const crewAllocationsQuery = trpc.operations.getCrewAllocations.useQuery();
  const provisionedDashboardsQuery = trpc.departments.listProvisioned.useQuery(undefined, { enabled: Boolean(user) });
  const dashboardGreetingQuery = trpc.auth.getDashboardGreeting.useQuery(undefined, { enabled: Boolean(user) });
  const canViewSalesEnquiries = Boolean(user && (user.role === "admin" || user.departmentCode === "sales"));
  const salesEnquiriesQuery = trpc.salesEnquiries.list.useQuery(
    { status: "all" },
    { enabled: canViewSalesEnquiries }
  );
  const salesSlaQuery = trpc.salesEnquiries.getSlaConfig.useQuery(undefined, { enabled: canViewSalesEnquiries });
  const salesSlaConfig = salesSlaQuery.data ?? { warningHours: 4, criticalHours: 24 };
  const unassignedSalesEnquiries = (salesEnquiriesQuery.data ?? []).filter(
    enquiry => !enquiry.assignedToUserId && enquiry.status !== "Converted" && enquiry.status !== "Closed"
  );
  const unassignedRentalEnquiries = unassignedSalesEnquiries.length;
  const unassignedOldestWaitHours = unassignedSalesEnquiries.length
    ? Math.max(0, (Date.now() - Math.min(...unassignedSalesEnquiries.map(enquiry => new Date(enquiry.createdAt).getTime()))) / 3_600_000)
    : 0;
  const [view, setView] = useState<View>(() =>
    location === "/uploads"
      ? "uploads"
      : location === "/attendance"
        ? "attendance"
        : location === "/training"
          ? "training"
          : location === "/crew"
            ? "crew"
            : location === "/gear"
              ? "gear"
              : "overview"
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(() => Array.from(new Map(initialBookings.map(booking => [booking.id, booking])).values()));
  const [uploadDocuments, setUploadDocuments] = useState<DocumentItem[]>(
    initialUploadDocuments
  );
  const [attendanceRecords, setAttendanceRecords] = useState<
    Record<string, AttendanceRecord>
  >({});
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(() =>
    dateKey(new Date())
  );
  const [allocations, setAllocations] = useState<EmployeeAllocation[]>([
    {
      employeeName: "Vineeth Vijayan",
      crewId: "cr-1",
      bookingId: "BOB Booking-31511",
    },
    {
      employeeName: "Anoop Panikashery",
      crewId: "cr-2",
      bookingId: "BOB Booking-31511",
    },
    {
      employeeName: "Vijayakumar",
      crewId: "cr-3",
      bookingId: "BOB Booking-31511",
    },
    {
      employeeName: "Amal Krishnan",
      crewId: "cr-4",
      bookingId: "BOB Booking-31511",
    },
  ]);
  useEffect(() => {
    if (crewAllocationsQuery.data) {
      setAllocations(
        crewAllocationsQuery.data.map(allocation => ({
          employeeName: allocation.crewName,
          crewId: allocation.crewId,
          bookingId: uiBookingIdForPersisted(allocation.bookingId),
        }))
      );
    }
  }, [crewAllocationsQuery.data]);
  const [uploadRecords, setUploadRecords] = useState<UploadMap>({});
  const [selectedTrainingEmployeeId, setSelectedTrainingEmployeeId] = useState<
    string | null
  >(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<string | null>(null);
  const [activeProvisionedDepartmentCode, setActiveProvisionedDepartmentCode] = useState<string | null>(null);
  const [focusedAssignmentBookingId, setFocusedAssignmentBookingId] = useState<
    string | null
  >(null);
  const [assignmentSavedMessage, setAssignmentSavedMessage] = useState<
    string | null
  >(null);
  const [completedWorkstreams, setCompletedWorkstreams] = useState<
    Record<string, string[]>
  >({});
  useEffect(() => {
    if (view !== "department" && view !== "provisioned-dashboard") {
      setWorkspaceLoading(false);
      return;
    }
    setWorkspaceLoading(true);
    const timer = window.setTimeout(() => setWorkspaceLoading(false), 160);
    return () => window.clearTimeout(timer);
  }, [activeDepartment, activeProvisionedDepartmentCode, view]);
  const updateBooking = (nextBooking: Booking) => {
    setBookings(current => [nextBooking, ...current.filter(item => item.id !== nextBooking.id)]);
    setActiveBooking(nextBooking);
  };
  const isClient = location.startsWith("/client");
  const groupedCount = useMemo(() => bookings.length, [bookings.length]);
  const clientBooking =
    bookings.find(booking => booking.id === "BOB Booking-31511") ?? bookings[0];
  if (isClient && clientBooking)
    return (
      <ClientPortal
        booking={clientBooking}
        documents={uploadDocuments}
        onUpdate={updateBooking}
        onUploadAll={() =>
          setUploadDocuments(current =>
            current.map(doc =>
              doc.state === "Required" ? { ...doc, state: "Uploaded" } : doc
            )
          )
        }
        onBackToInternal={() => setLocation("/")}
      />
    );
  const openDetail = (booking: Booking) => {
    setActiveBooking(booking);
    setView("detail");
  };
  const createBooking = (booking: Booking) => {
    setBookings(current => [booking, ...current.filter(item => item.id !== booking.id)]);
    setActiveBooking(booking);
    setView("detail");
  };
  const advanceDepartmentBooking = async (
    booking: Booking,
    config: DepartmentPortalConfig
  ) => {
    const nextStage =
      booking.stage === config.secondaryStage
        ? config.secondaryNextStage
        : config.nextStage;
    if (!nextStage) return;
    try {
      const result = await advanceBookingStageMutation.mutateAsync({
        id: booking.id,
        currentStage: booking.stage,
        nextStage,
      });
      const nextBooking = {
        ...booking,
        stage: result.stage,
        progress: Math.min(
          100,
          Math.max(booking.progress + 12, booking.progress)
        ),
      };
      setBookings(current => [nextBooking, ...current.filter(item => item.id !== booking.id)]);
      setActiveBooking(nextBooking);
      setView("detail");
      toast.success(`Dossier moved to ${result.stage}`, {
        description: `${result.notifications.length} department notifications persisted.`,
      });
    } catch (caught) {
      toast.error("Workflow handoff blocked", {
        description:
          caught instanceof Error
            ? caught.message
            : "The dossier could not be advanced.",
      });
    }
  };
  const completeDepartmentWorkstream = async (
    booking: Booking,
    config: DepartmentPortalConfig
  ) => {
    if (!config.parallelCode) return;
    try {
      await completeWorkstreamMutation.mutateAsync({
        id: booking.id,
        workstream: config.parallelCode,
        stage: booking.stage,
      });
      setCompletedWorkstreams(current => ({
        ...current,
        [booking.id]: Array.from(
          new Set([...(current[booking.id] ?? []), config.parallelCode!])
        ),
      }));
      toast.success("Workstream completed", {
        description: "Documentation has been notified to review the evidence.",
      });
    } catch (caught) {
      toast.error("Workstream completion blocked", {
        description:
          caught instanceof Error
            ? caught.message
            : "The workstream could not be completed.",
      });
    }
  };
  const openDepartment = (department: string) => {
    const departmentCode = DEPARTMENT_LABEL_TO_CODE[department];
    if (
      !user ||
      (user.role !== "admin" && user.departmentCode !== departmentCode)
    )
      return;
    setActiveDepartment(department);
    setActiveBooking(null);
    setView("department");
  };
  const openProvisionedDashboard = (departmentCode: string) => {
    if (!user || !canAccessProvisionedDepartmentDashboard(user, departmentCode)) return;
    const exists = (provisionedDashboardsQuery.data ?? []).some((dashboard) => dashboard.code === departmentCode);
    if (!exists) return;
    setActiveBooking(null);
    setActiveDepartment(null);
    setActiveProvisionedDepartmentCode(departmentCode);
    setView("provisioned-dashboard");
  };
  const signOut = async () => {
    await logout();
    setLocation("/login");
  };
  const canView = (nextView: View) => {
    if (nextView === "sales-enquiries") {
      return Boolean(user && (user.role === "admin" || user.departmentCode === "sales"));
    }
    if (nextView === "web-vitals") return Boolean(user?.role === "admin");
    if (nextView === "provisioned-dashboard") {
      return Boolean(user && activeProvisionedDepartmentCode && canAccessProvisionedDepartmentDashboard(user, activeProvisionedDepartmentCode));
    }
    return canAccessWorkspaceView(
      user ?? { role: "user", departmentCode: null },
      nextView
    );
  };
  useEffect(() => {
    if (user && !canView(view)) setView("overview");
  }, [user, view]);
  useEffect(() => {
    if (!user || user.role === "admin" || view !== "overview") return;
    const dashboard = (provisionedDashboardsQuery.data ?? []).find((item) => item.code === user.departmentCode);
    if (!dashboard) return;
    setActiveProvisionedDepartmentCode(dashboard.code);
    setView("provisioned-dashboard");
  }, [provisionedDashboardsQuery.data, user, view]);
  if (!user) return null;
  const guardedSetView = (nextView: View) => {
    if (nextView !== "crew") setFocusedAssignmentBookingId(null);
    setActiveBooking(null);
    setActiveDepartment(null);
    if (nextView !== "provisioned-dashboard") setActiveProvisionedDepartmentCode(null);
    setView(canView(nextView) ? nextView : "overview");
  };
  const activeProvisionedDashboard = (provisionedDashboardsQuery.data ?? []).find((dashboard) => dashboard.code === activeProvisionedDepartmentCode) ?? null;
  return (
    <Shell
      view={view}
      setView={guardedSetView}
      onBack={() => {
        if (view === "crew" && focusedAssignmentBookingId) {
          setActiveBooking(
            bookings.find(
              booking => booking.id === focusedAssignmentBookingId
            ) ?? null
          );
          setFocusedAssignmentBookingId(null);
          setActiveDepartment(null);
          setView("detail");
          return;
        }
        setActiveBooking(null);
        setActiveDepartment(null);
        setActiveProvisionedDepartmentCode(null);
        setView(view === "detail" ? "bookings" : "overview");
      }}
      onClient={() => setLocation("/client/portal-bob-31511")}
      onDepartment={openDepartment}
      provisionedDashboards={provisionedDashboardsQuery.data ?? []}
      activeProvisionedDepartmentCode={activeProvisionedDepartmentCode}
      onProvisionedDashboard={openProvisionedDashboard}
      departmentLabel={activeDepartment}
      bookings={bookings}
      onOpenDossier={openDetail}
      user={user}
      onSignOut={signOut}
    >
      {view === "overview" && (
        <Overview
          bookings={bookings}
          documents={uploadDocuments}
          setView={guardedSetView}
          setDetail={openDetail}
          attendanceRecords={attendanceRecords}
          setAttendanceRecords={setAttendanceRecords}
          user={user}
          greetingTemplate={dashboardGreetingQuery.data?.template}
          unassignedRentalEnquiries={unassignedRentalEnquiries}
          unassignedOldestWaitHours={unassignedOldestWaitHours}
          salesSlaConfig={salesSlaConfig}
          canViewSalesEnquiries={canViewSalesEnquiries}
          onSelectEmployee={employeeId => {
            setSelectedTrainingEmployeeId(employeeId);
            setView("training");
          }}
        />
      )}
      {view === "bookings" && user.role === "admin" && (
        <BookingsView
          bookings={bookings}
          setView={guardedSetView}
          setDetail={openDetail}
        />
      )}
      {view === "wizard" &&
        (user.role === "admin" || user.departmentCode === "sales") && (
          <Wizard
            onCreated={createBooking}
            onCancel={() => guardedSetView("overview")}
          />
        )}
      {view === "docs" &&
        (user.role === "admin" ||
          user.departmentCode === "documentation" ||
          user.departmentCode === "hse") && (
          <DocsView bookings={bookings} setDetail={openDetail} />
        )}
      {view === "crew" &&
        (user.role === "admin" || user.departmentCode === "crew") && (
          <CrewView
            bookings={bookings}
            allocations={allocations}
            setAllocations={setAllocations}
            focusedBookingId={focusedAssignmentBookingId}
            onOpenDossier={(bookingId) => {
              const booking = bookings.find((candidate) => candidate.id === bookingId);
              if (!booking) return;
              setFocusedAssignmentBookingId(null);
              setActiveBooking(booking);
              setView("detail");
            }}
            onAddWorkman={() => {
              if (canView("users")) {
                setView("users");
              } else {
                toast.info("Supervisor access required", {
                  description:
                    "Only a Crew supervisor or administrator can add workmen accounts.",
                });
              }
            }}
            onAllocationSaved={({ bookingId, employeeName, action }) => {
              setAssignmentSavedMessage(
                `${employeeName} was ${action === "saved" ? "assigned to" : "removed from"} ${bookingId}.`
              );
            }}
          />
        )}
      {view === "gear" &&
        (user.role === "admin" || user.departmentCode === "lifting-gears") && (
          <GearView />
        )}
      {view === "attendance" &&
        (user.role === "admin" || user.departmentCode === "hr") && (
          <AttendanceView
            records={attendanceRecords}
            setRecords={setAttendanceRecords}
            selectedDate={selectedAttendanceDate}
            setSelectedDate={setSelectedAttendanceDate}
          />
        )}
      {view === "training" && (
        <TrainingView selectedEmployeeId={selectedTrainingEmployeeId} />
      )}
      {view === "uploads" &&
        (user.role === "admin" || user.departmentCode === "accounts") && (
          <DataUploadCenter
            uploads={uploadRecords}
            setUploads={setUploadRecords}
          />
        )}
      {view === "users" && user.role !== "user" && (
        <DepartmentUsersView actor={user} onOpenDashboard={openProvisionedDashboard} />
      )}
      {view === "supervisor-audit" && user.role === "admin" && (
        <SupervisorPermissionsAudit />
      )}
      {view === "web-vitals" && user.role === "admin" && (
        <WebVitalsAnalyticsView />
      )}
      {view === "department" && activeDepartment && (
        workspaceLoading ? <WorkspaceLoadingSkeleton title={`Loading ${activeDepartment} workspace…`} /> : <>
          {activeDepartment === "Transportation" && (
            <TransportationFleetPanel />
          )}
          <DepartmentView
            department={activeDepartment}
            bookings={bookings}
            setDetail={openDetail}
            onAdvance={advanceDepartmentBooking}
            onCompleteWorkstream={completeDepartmentWorkstream}
            completedWorkstreams={completedWorkstreams}
          />
        </>
      )}
      {view === "provisioned-dashboard" && activeProvisionedDashboard && (
        workspaceLoading ? <WorkspaceLoadingSkeleton title={`Loading ${activeProvisionedDashboard.name} workspace…`} /> : <ProvisionedDepartmentDashboard
          dashboard={activeProvisionedDashboard}
          bookings={bookings}
          canManageTeam={user.role === "admin" || user.role === "supervisor"}
          canArchiveWorkflows={user.role === "admin"}
          onOpenDossier={openDetail}
          onManageTeam={() => guardedSetView("users")}
        />
      )}
      {view === "sales-enquiries" && (user.role === "admin" || user.departmentCode === "sales") && (
        <SalesEnquiryInbox
          actor={user}
          onOpenBooking={booking => {
            const convertedBooking: Booking = {
              id: booking.id,
              client: booking.clientName ?? "Rental enquiry client",
              project: booking.projectName ?? "Rental enquiry conversion",
              crane: "To be confirmed",
              site: "To be confirmed",
              stage: (booking.stage as Stage | undefined) ?? "Created by Salesperson",
              priority: (booking.priority as Booking["priority"] | undefined) ?? "Standard",
              progress: 0,
              mob: booking.mobilizationDate ?? "To be confirmed",
              offHire: booking.offHireDate ?? "To be confirmed",
              pm: booking.projectManager ?? "Sales follow-up",
              crew: booking.clientContactName ?? "",
            };
            setBookings(current => [convertedBooking, ...current.filter(item => item.id !== convertedBooking.id)]);
            openDetail(convertedBooking);
          }}
        />
      )}
      {view === "detail" && activeBooking && (
        <BookingDetail
          booking={activeBooking}
          documents={uploadDocuments}
          allocations={allocations}
          assignmentSavedMessage={assignmentSavedMessage}
          generatedBy={user.name ?? user.email ?? "BOB Cranes Operations"}
          onUpdate={updateBooking}
          onOpenClientPortal={() => setLocation("/client/portal-bob-31511")}
          onEditAssignment={() => {
            if (!canView("crew")) {
              toast.error("Crew assignment access required", {
                description:
                  "Open this action from an administrator or Crew department account.",
              });
              return;
            }
            setAssignmentSavedMessage(null);
            setFocusedAssignmentBookingId(activeBooking.id);
            setActiveBooking(null);
            setActiveDepartment(null);
            setView("crew");
          }}
          onBack={() => {
            setAssignmentSavedMessage(null);
            setFocusedAssignmentBookingId(null);
            setActiveBooking(null);
            setView("overview");
          }}
        />
      )}
      <div
        style={{
          color: "#555",
          fontSize: 10,
          textAlign: "right",
          padding: "10px 0 0",
        }}
      >
        System status: operational · {groupedCount} dossiers in view · v3.0
      </div>
    </Shell>
  );
}
