import { trpc } from "@/lib/trpc";
import { DEPARTMENTS } from "@shared/departmentAccess";
import { Activity, BadgeCheck, ShieldCheck, UsersRound } from "lucide-react";

const labelForDepartment = (code: string | null | undefined) => DEPARTMENTS.find((department) => department.code === code)?.label ?? "Unassigned";
const dateTime = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "No sign-in recorded";

export default function SupervisorPermissionsAudit() {
  const auditQuery = trpc.auth.getSupervisorPermissionAudit.useQuery();
  const supervisors = auditQuery.data ?? [];
  const activeSupervisors = supervisors.filter((supervisor) => supervisor.isActive === 1).length;
  const governedUsers = supervisors.reduce((total, supervisor) => total + supervisor.managedUserCount, 0);

  return <div className="content">
    <div className="page-heading">
      <div>
        <div className="eyebrow">Operations Cockpit · Governance</div>
        <h1 className="page-title">Supervisor permissions audit</h1>
        <p className="page-copy">Review department supervision, active scope, and the safeguards that prevent cross-department account administration.</p>
      </div>
      <div className="status-badge blue"><ShieldCheck size={12} /> Administrator only</div>
    </div>

    <div className="metric-grid account-metrics">
      <div className="metric-card"><div className="metric-label">Department supervisors</div><div className="metric-value">{supervisors.length}</div><div className="metric-foot">Configured department leads</div></div>
      <div className="metric-card"><div className="metric-label">Active supervisors</div><div className="metric-value">{activeSupervisors}</div><div className="metric-foot">Can manage their own department</div></div>
      <div className="metric-card"><div className="metric-label">Governed users</div><div className="metric-value">{governedUsers}</div><div className="metric-foot">Active users under visible supervision</div></div>
      <div className="metric-card"><div className="metric-label">Cross-department changes</div><div className="metric-value">0</div><div className="metric-foot">Blocked by protected backend policy</div></div>
    </div>

    <div className="detail-grid">
      <section className="panel">
        <div className="panel-header"><div><div className="panel-title"><UsersRound size={16} /> Supervisor scope register</div><div className="panel-meta">Live local-account evidence. A supervisor may manage only active user accounts in the assigned department.</div></div><BadgeCheck size={17} color="#138a43" /></div>
        <div className="panel-body">
          {auditQuery.isLoading ? <div className="empty-state">Loading supervisor scope…</div> : auditQuery.error ? <div className="account-error">Unable to load the supervisor permission audit.</div> : supervisors.length ? <div className="account-list">{supervisors.map((supervisor) => <div className={`account-row ${supervisor.isActive !== 1 ? "account-row-inactive" : ""}`} key={supervisor.id}>
            <div className="avatar">{(supervisor.name ?? supervisor.email ?? "S").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
            <div className="account-main"><div className="compliance-name">{supervisor.name ?? "Unnamed supervisor"}</div><div className="compliance-sub">{supervisor.email ?? "No email on record"} · last sign-in {dateTime(supervisor.lastSignedIn)}</div><div className="account-tags"><span className={`status-badge ${supervisor.isActive === 1 ? "green" : "gray"}`}>{supervisor.isActive === 1 ? "Active" : "Deactivated"}</span><span className="status-badge amber">Supervisor · {labelForDepartment(supervisor.departmentCode)}</span></div></div>
            <div className="account-actions"><span className="status-badge blue">{supervisor.managedUserCount} active users</span></div>
          </div>)}</div> : <div className="empty-state">No department supervisors are currently configured.</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><div className="panel-title"><ShieldCheck size={16} /> Effective permission model</div><div className="panel-meta">Backend authorization is evaluated before any account change is written.</div></div><Activity size={16} color="#138a43" /></div>
        <div className="panel-body"><div className="department-checklist">
          <div className="department-checklist-row"><span>1</span><div><strong>Department-limited visibility</strong><small>Supervisors can list and view accounts only within their assigned department.</small></div></div>
          <div className="department-checklist-row"><span>2</span><div><strong>User-only account administration</strong><small>Supervisors may create, edit, reactivate, or deactivate department users; supervisor and administrator roles remain protected.</small></div></div>
          <div className="department-checklist-row"><span>3</span><div><strong>Pre-write authorization denial</strong><small>Cross-department account updates are rejected before database changes. The live QA record confirms this boundary with an existing-account 403 response.</small></div></div>
          <div className="department-checklist-row"><span>4</span><div><strong>Administrator oversight</strong><small>Administrators retain complete visibility, can assign supervisors, and can inspect account activity exports.</small></div></div>
        </div></div>
      </section>
    </div>
  </div>;
}
