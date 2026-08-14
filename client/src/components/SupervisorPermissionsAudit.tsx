import { trpc } from "@/lib/trpc";
import { DEPARTMENTS } from "@shared/departmentAccess";
import { Activity, BadgeCheck, ShieldCheck, UsersRound } from "lucide-react";

const labelForDepartment = (code: string | null | undefined) =>
  DEPARTMENTS.find(department => department.code === code)?.label ??
  "Unassigned";
const dateTime = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No sign-in recorded";

export default function SupervisorPermissionsAudit() {
  const auditQuery = trpc.auth.getSupervisorPermissionAudit.useQuery();
  const feedbackQuery = trpc.clientFeedback.list.useQuery({ limit: 100 });
  const updateFeedbackStatus = trpc.clientFeedback.updateStatus.useMutation({
    onSuccess: () => feedbackQuery.refetch(),
  });
  const supervisors = auditQuery.data ?? [];
  const feedback = feedbackQuery.data ?? [];
  const activeSupervisors = supervisors.filter(
    supervisor => supervisor.isActive === 1
  ).length;
  const governedUsers = supervisors.reduce(
    (total, supervisor) => total + supervisor.managedUserCount,
    0
  );
  const openFeedback = feedback.filter(
    report => report.status !== "Resolved"
  ).length;

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Operations Cockpit · Governance</div>
          <h1 className="page-title">Supervisor permissions audit</h1>
          <p className="page-copy">
            Review department supervision, active scope, and the safeguards that
            prevent cross-department account administration.
          </p>
        </div>
        <div className="status-badge blue">
          <ShieldCheck size={12} /> Administrator only
        </div>
      </div>

      <div className="metric-grid account-metrics">
        <div className="metric-card">
          <div className="metric-label">Department supervisors</div>
          <div className="metric-value">{supervisors.length}</div>
          <div className="metric-foot">Configured department leads</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active supervisors</div>
          <div className="metric-value">{activeSupervisors}</div>
          <div className="metric-foot">Can manage their own department</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Governed users</div>
          <div className="metric-value">{governedUsers}</div>
          <div className="metric-foot">
            Active users under visible supervision
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open client feedback</div>
          <div className="metric-value">{openFeedback}</div>
          <div className="metric-foot">Bug reports awaiting resolution</div>
        </div>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <UsersRound size={16} /> Supervisor scope register
              </div>
              <div className="panel-meta">
                Live local-account evidence. A supervisor may manage only active
                user accounts in the assigned department.
              </div>
            </div>
            <BadgeCheck size={17} color="#138a43" />
          </div>
          <div className="panel-body">
            {auditQuery.isLoading ? (
              <div className="empty-state">Loading supervisor scope…</div>
            ) : auditQuery.error ? (
              <div className="account-error">
                Unable to load the supervisor permission audit.
              </div>
            ) : supervisors.length ? (
              <div className="account-list">
                {supervisors.map(supervisor => (
                  <div
                    className={`account-row ${supervisor.isActive !== 1 ? "account-row-inactive" : ""}`}
                    key={supervisor.id}
                  >
                    <div className="avatar">
                      {(supervisor.name ?? supervisor.email ?? "S")
                        .split(" ")
                        .map(part => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="account-main">
                      <div className="compliance-name">
                        {supervisor.name ?? "Unnamed supervisor"}
                      </div>
                      <div className="compliance-sub">
                        {supervisor.email ?? "No email on record"} · last
                        sign-in {dateTime(supervisor.lastSignedIn)}
                      </div>
                      <div className="account-tags">
                        <span
                          className={`status-badge ${supervisor.isActive === 1 ? "green" : "gray"}`}
                        >
                          {supervisor.isActive === 1 ? "Active" : "Deactivated"}
                        </span>
                        <span className="status-badge amber">
                          Supervisor ·{" "}
                          {labelForDepartment(supervisor.departmentCode)}
                        </span>
                      </div>
                    </div>
                    <div className="account-actions">
                      <span className="status-badge blue">
                        {supervisor.managedUserCount} active users
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No department supervisors are currently configured.
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                <ShieldCheck size={16} /> Effective permission model
              </div>
              <div className="panel-meta">
                Backend authorization is evaluated before any account change is
                written.
              </div>
            </div>
            <Activity size={16} color="#138a43" />
          </div>
          <div className="panel-body">
            <div className="department-checklist">
              <div className="department-checklist-row">
                <span>1</span>
                <div>
                  <strong>Department-limited visibility</strong>
                  <small>
                    Supervisors can list and view accounts only within their
                    assigned department.
                  </small>
                </div>
              </div>
              <div className="department-checklist-row">
                <span>2</span>
                <div>
                  <strong>User-only account administration</strong>
                  <small>
                    Supervisors may create, edit, reactivate, or deactivate
                    department users; supervisor and administrator roles remain
                    protected.
                  </small>
                </div>
              </div>
              <div className="department-checklist-row">
                <span>3</span>
                <div>
                  <strong>Pre-write authorization denial</strong>
                  <small>
                    Cross-department account updates are rejected before
                    database changes. The live QA record confirms this boundary
                    with an existing-account 403 response.
                  </small>
                </div>
              </div>
              <div className="department-checklist-row">
                <span>4</span>
                <div>
                  <strong>Administrator oversight</strong>
                  <small>
                    Administrators retain complete visibility, can assign
                    supervisors, and can inspect account activity exports.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">
              <Activity size={16} /> Client Portal feedback
            </div>
            <div className="panel-meta">
              Review client-reported issues linked to booking dossiers and
              update the investigation state.
            </div>
          </div>
          <span className="status-badge blue">Admin only</span>
        </div>
        <div className="panel-body">
          {feedbackQuery.isLoading ? (
            <div className="empty-state">Loading client feedback…</div>
          ) : feedbackQuery.error ? (
            <div className="account-error">Unable to load client feedback.</div>
          ) : feedback.length ? (
            <div className="compliance-list">
              {feedback.map(report => (
                <div className="compliance-row" key={report.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="compliance-name">
                      {report.category} · {report.bookingId}
                    </div>
                    <div
                      className="compliance-sub"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {report.message}
                    </div>
                    <div className="compliance-sub" style={{ marginTop: 5 }}>
                      {report.contactEmail
                        ? `Follow-up: ${report.contactEmail} · `
                        : "No follow-up email · "}
                      {dateTime(report.createdAt)}
                    </div>
                  </div>
                  <select
                    className="form-select"
                    value={report.status}
                    disabled={updateFeedbackStatus.isPending}
                    onChange={event =>
                      updateFeedbackStatus.mutate({
                        id: report.id,
                        status: event.target.value as
                          | "Open"
                          | "In review"
                          | "Resolved",
                      })
                    }
                    aria-label={`Feedback status for ${report.bookingId}`}
                  >
                    <option value="Open">Open</option>
                    <option value="In review">In review</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No Client Portal feedback has been submitted yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
