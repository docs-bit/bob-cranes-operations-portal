import { useMemo, useState } from "react";
import type { FC, ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardCheck, Clock3, CloudUpload, FileText, HardHat, LayoutDashboard, LoaderCircle, MapPin, TrendingUp, Truck, Users, Wrench } from "lucide-react";
import { attendanceRoster, gears, initials, stageShort, stages, dateKey, defaultAttendanceRecord, formatAttendanceDate, summarizeAttendance, updateAttendance, ATTENDANCE_STATUSES, TRAINING_EMPLOYEES, type AttendanceRecord, type AttendanceStatus, type Booking, type View } from "./shared";
import { StatusBadge, MetricCard } from "./primitives";
import { canDispatch as canDispatchByRule, departmentCompletion, documentCompletion, type DocumentItem } from "@shared/bookingRules";
import { formatDashboardGreeting } from "@shared/dashboardGreeting";
import { getExpiringTrainingEmployees } from "@shared/notificationAndExpiryRules";

export function PageHeading({
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

export function ReferenceUploadProgress({
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

export function ProgressGraph({
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
      code: "documentation" as const,
      name: "Documentation",
      note: "Signed method statement",
      department: "documentation",
    },
    {
      code: "hse" as const,
      name: "HSE / Safety",
      note: "Lift plan approval",
      department: "hse",
    },
    {
      code: "crew" as const,
      name: "Crew Assignment",
      note: "Vijayakumar renewal",
      department: "crew",
    },
    {
      code: "lifting-gears" as const,
      name: "Lifting Gears",
      note: "Inspection certificates",
      department: "lifting-gears",
    },
    {
      code: "accounts" as const,
      name: "Accounts",
      note: "LPO Rev. 2",
      department: "accounts",
    },
    {
      code: "transportation" as const,
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

export function ClientProgressRail({
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

export function Pipeline({
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

export function AttendanceSummaryCard({
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

export function ExpiringCertificatesWidget({
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

