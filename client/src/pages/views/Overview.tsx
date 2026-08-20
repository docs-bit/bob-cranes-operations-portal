import { useMemo } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, ClipboardCheck, Clock3, FileCheck2, FolderOpen, Plus, ShieldCheck, Users } from "lucide-react";
import { DEPARTMENTS, DEPARTMENT_LABEL_TO_CODE, departmentList, dateKey, defaultAttendanceRecord, type AttendanceRecord, type Booking, type DocumentItem, type View } from "./shared";
import { AttendanceSummaryCard, ExpiringCertificatesWidget, PageHeading, Pipeline, ProgressGraph } from "./OverviewHelpers";
import { MetricCard, StatusBadge } from "./primitives";
import { ATTENDANCE_CREW_ROSTER } from "@shared/attendanceCrewRoster";
import { formatDashboardGreeting } from "@shared/dashboardGreeting";

export function Overview({
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
      ? departmentList
      : departmentList.filter(
          ([name]) => DEPARTMENT_LABEL_TO_CODE[name] === user.departmentCode
        );
  const activeDossiers = bookings.filter(booking => booking.stage !== "Dispatched");
  const todayAttendance = attendanceRecords[dateKey(new Date())] ?? defaultAttendanceRecord(ATTENDANCE_CREW_ROSTER);
  const availableCrew = ATTENDANCE_CREW_ROSTER.filter(employee => (todayAttendance[employee.name] ?? employee.availability) === "Present");
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
      <section className="dashboard-summary-widget" aria-label="Operations quick summary" data-testid="operations-quick-summary">
        <div className="dashboard-summary-widget-heading"><div><span className="eyebrow">Quick pulse</span><h2>Today’s capacity at a glance</h2></div><span className="status-badge green">Live</span></div>
        <div className="dashboard-summary-widget-grid">
          <button type="button" className="dashboard-summary-card" onClick={() => setView("bookings")} aria-label="Open Booking Dossiers filtered to active bookings" data-tooltip="Open Booking Dossiers · active bookings">
            <span className="dashboard-summary-card-icon"><ClipboardCheck size={17} /></span>
            <span><strong>{activeDossiers.length}</strong><small>active bookings</small></span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
          <button type="button" className="dashboard-summary-card" onClick={() => setView("crew")} aria-label="Open Crew Assignment filtered to crew available today" data-tooltip="Open Crew Assignment · available today">
            <span className="dashboard-summary-card-icon"><Users size={17} /></span>
            <span><strong>{availableCrew.length}<small> / {ATTENDANCE_CREW_ROSTER.length}</small></strong><small>crew available today</small></span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
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
                  <strong>All DEPARTMENTS notified</strong> for BOB
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

