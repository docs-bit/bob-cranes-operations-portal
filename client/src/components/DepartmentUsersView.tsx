import { trpc } from "@/lib/trpc";
import { DEPARTMENTS, roleLabel, type PortalRole } from "@shared/departmentAccess";
import { nextAccountActiveState, requiresDeactivationConfirmation } from "@shared/accountManagementRules";
import { activityToCsv } from "@shared/activityExport";
import { activityFilterInput, isValidActivityDate } from "@shared/activityFilterRules";
import { filterAccounts } from "@shared/userManagementRules";
import {
  DEPARTMENT_DASHBOARD_ACCENTS,
  DEPARTMENT_DASHBOARD_ICONS,
  DEPARTMENT_WORKSTREAMS,
  normalizeDepartmentCode,
  type DepartmentDashboardAccent,
  type DepartmentDashboardIcon,
  type DepartmentWorkstream,
} from "@shared/departmentDashboardRules";
import { CheckCircle2, Download, Edit3, KeyRound, Power, Search, ShieldCheck, UserPlus, UsersRound, X, Activity, AlertTriangle, CalendarRange, Crown, RotateCcw, Settings2, Trash2, Building2, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

type AccountForm = {
  name: string;
  email: string;
  password: string;
  departmentCode: string;
  role: "user" | "supervisor";
};

type AccountEditorForm = {
  name: string;
  email: string;
  password: string;
  departmentCode: string;
  role: PortalRole;
};

type DepartmentForm = {
  name: string;
  code: string;
  description: string;
  accent: DepartmentDashboardAccent;
  icon: DepartmentDashboardIcon;
  workstream: DepartmentWorkstream;
};

type DepartmentUsersViewProps = {
  actor: { id: number; role: PortalRole; departmentCode: string | null };
  onOpenDashboard?: (departmentCode: string) => void;
};

const initials = (value: string) => value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
const displayDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Never";
const displayDateTime = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Unknown";
const activityLabel = (action: string) => ({ sign_in: "Signed in", profile_update: "Profile updated", account_deactivated: "Account deactivated", account_activated: "Account reactivated" }[action] ?? action.replaceAll("_", " "));

export default function DepartmentUsersView({ actor, onOpenDashboard }: DepartmentUsersViewProps) {
  const isAdmin = actor.role === "admin";
  const isSupervisor = actor.role === "supervisor";
  const scopedDepartmentCode = isSupervisor ? actor.departmentCode ?? "sales" : "sales";
  const provisionedDepartmentsQuery = trpc.departments.listProvisioned.useQuery();
  const provisionedDepartments = provisionedDepartmentsQuery.data ?? [];
  const allDepartments = useMemo(() => [
    ...DEPARTMENTS.map((department) => ({ code: department.code, label: department.label })),
    ...provisionedDepartments.filter((department) => department.active === 1).map((department) => ({ code: department.code, label: department.name })),
  ], [provisionedDepartments]);
  const departmentLabel = (code: string | null | undefined) => allDepartments.find((department) => department.code === code)?.label ?? "Unassigned";
  const manageableDepartments = useMemo(() => allDepartments.filter((department) => department.code !== "administrator" && (!isSupervisor || department.code === actor.departmentCode)), [actor.departmentCode, allDepartments, isSupervisor]);
  const [activityFrom, setActivityFrom] = useState("");
  const [activityTo, setActivityTo] = useState("");
  const hasInvalidActivityDate = Boolean((activityFrom && !isValidActivityDate(activityFrom)) || (activityTo && !isValidActivityDate(activityTo)));
  const activityInput = useMemo(() => activityFilterInput(activityFrom, activityTo), [activityFrom, activityTo]);
  const usersQuery = trpc.auth.listUsers.useQuery();
  const registerUser = trpc.auth.registerUser.useMutation();
  const updateUser = trpc.auth.updateUser.useMutation();
  const setUserActive = trpc.auth.setUserActive.useMutation();
  const activityQuery = trpc.auth.listActivity.useQuery(activityInput);
  const retentionQuery = trpc.auth.getActivityRetention.useQuery(undefined, { enabled: isAdmin });
  const updateRetention = trpc.auth.updateActivityRetention.useMutation();
  const purgeExpiredActivity = trpc.auth.purgeExpiredActivity.useMutation();
  const createDepartment = trpc.departments.createProvisioned.useMutation();
  const setDepartmentActive = trpc.departments.setProvisionedActive.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<AccountForm>({ name: "", email: "", password: "", departmentCode: scopedDepartmentCode, role: "user" });
  const [editForm, setEditForm] = useState<AccountEditorForm>({ name: "", email: "", password: "", departmentCode: scopedDepartmentCode, role: "user" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deactivationTarget, setDeactivationTarget] = useState<(typeof accounts)[number] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [departmentFilter, setDepartmentFilter] = useState(isSupervisor ? scopedDepartmentCode : "all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>({ name: "", code: "", description: "", accent: "orange", icon: "LayoutDashboard", workstream: "operations" });

  const accounts = usersQuery.data ?? [];
  const filteredAccounts = useMemo(() => filterAccounts(accounts, search, departmentFilter, statusFilter, departmentLabel), [accounts, search, statusFilter, departmentFilter, allDepartments]);
  const notify = (nextMessage: string, nextError = "") => { setMessage(nextMessage); setError(nextError); };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    notify("");
    try {
      const account = await registerUser.mutateAsync(form);
      setForm({ name: "", email: "", password: "", departmentCode: scopedDepartmentCode, role: "user" });
      notify(`${account.name ?? account.email} can now sign in to the ${departmentLabel(account.departmentCode)} workspace as a ${roleLabel(account.role).toLowerCase()}.`);
      await Promise.all([utils.auth.listUsers.invalidate(), utils.auth.listActivity.invalidate()]);
    } catch (caught) {
      notify("", caught instanceof Error ? caught.message : "The department account could not be created.");
    }
  };

  const submitDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    notify("");
    try {
      const created = await createDepartment.mutateAsync({
        ...departmentForm,
        code: normalizeDepartmentCode(departmentForm.code),
      });
      setDepartmentForm({ name: "", code: "", description: "", accent: "orange", icon: "LayoutDashboard", workstream: "operations" });
      notify(`${created.name} now has its own access-controlled operational workspace and is ready for supervisor assignment.`);
      toast.success("Department dashboard provisioned", { description: `${created.name} is available as a dedicated workspace.` });
      await Promise.all([utils.departments.listProvisioned.invalidate(), utils.auth.listActivity.invalidate()]);
    } catch (caught) {
      notify("", caught instanceof Error ? caught.message : "The department dashboard could not be provisioned.");
    }
  };

  const updateDepartmentLifecycle = async (department: (typeof provisionedDepartments)[number], active: boolean) => {
    if (!active && !window.confirm(`Archive ${department.name}? Its dashboard, users, workflow templates, and operational history will remain stored, but department sign-in and new user assignment will pause until restoration.`)) return;
    try {
      await setDepartmentActive.mutateAsync({ code: department.code, active });
      await Promise.all([utils.departments.listProvisioned.invalidate(), utils.auth.listActivity.invalidate()]);
      const messageText = active
        ? `${department.name} was restored and is available for new account assignment.`
        : `${department.name} was archived safely. Its history remains available to administrators.`;
      notify(messageText);
      toast.success(active ? "Department restored" : "Department archived", { description: messageText });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "The department lifecycle update could not be completed.";
      notify("", detail);
      toast.error("Department status update failed", { description: detail });
    }
  };

  const beginEdit = (account: (typeof accounts)[number]) => {
    setEditingId(account.id);
    setEditForm({ name: account.name ?? "", email: account.email ?? "", password: "", departmentCode: account.role === "admin" ? "administrator" : account.departmentCode ?? scopedDepartmentCode, role: account.role });
    notify("");
  };

  const submitEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingId === null) return;
    notify("");
    try {
      const account = await updateUser.mutateAsync({ id: editingId, ...editForm });
      setEditingId(null);
      notify(`${account.name ?? account.email} was updated successfully.`);
      await Promise.all([utils.auth.listUsers.invalidate(), utils.auth.listActivity.invalidate()]);
    } catch (caught) {
      notify("", caught instanceof Error ? caught.message : "The account could not be updated.");
    }
  };

  const commitActiveChange = async (account: (typeof accounts)[number], nextState: boolean) => {
    notify("");
    try {
      await setUserActive.mutateAsync({ id: account.id, isActive: nextState });
      const statusLabel = nextState ? "active" : "deactivated";
      notify(`${account.name ?? account.email} is now ${statusLabel}.`);
      toast.success(`Account ${nextState ? "reactivated" : "deactivated"}`, { description: `${account.name ?? account.email} is now ${statusLabel}.` });
      setDeactivationTarget(null);
      await Promise.all([utils.auth.listUsers.invalidate(), utils.auth.listActivity.invalidate()]);
    } catch (caught) {
      notify("", caught instanceof Error ? caught.message : "The account status could not be changed.");
      toast.error("Account status update failed", { description: caught instanceof Error ? caught.message : "Try again." });
    }
  };

  const requestActiveChange = (account: (typeof accounts)[number]) => {
    const nextState = nextAccountActiveState(account, actor.id);
    if (nextState === null) return;
    if (requiresDeactivationConfirmation(account, actor.id)) setDeactivationTarget(account);
    else void commitActiveChange(account, nextState);
  };

  const activeCount = accounts.filter((account) => account.isActive === 1).length;
  const inactiveCount = accounts.length - activeCount;
  const activity = activityQuery.data ?? [];
  const exportActivity = () => {
    if (!activity.length) { toast.info("No activity to export yet."); return; }
    const csv = activityToCsv(activity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bob-cranes-${isSupervisor ? `${scopedDepartmentCode}-` : ""}account-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Activity CSV downloaded", { description: `${activity.length} audit events exported.` });
  };
  const resetActivityRange = () => { setActivityFrom(""); setActivityTo(""); };
  const saveRetention = async (retentionDays: number) => {
    try {
      await updateRetention.mutateAsync({ retentionDays: retentionDays as 30 | 90 | 180 | 365 | 730 });
      await Promise.all([utils.auth.getActivityRetention.invalidate(), utils.auth.listActivity.invalidate()]);
      toast.success("Activity retention updated", { description: `Events will be retained for ${retentionDays} days before an administrator-led purge.` });
    } catch (caught) {
      toast.error("Retention update failed", { description: caught instanceof Error ? caught.message : "Please try again." });
    }
  };
  const purgeExpired = async () => {
    const retentionDays = retentionQuery.data?.retentionDays ?? 365;
    if (!window.confirm(`Permanently purge activity events older than ${retentionDays} days? This cannot be undone.`)) return;
    try {
      const result = await purgeExpiredActivity.mutateAsync({ confirm: true });
      await utils.auth.listActivity.invalidate();
      toast.success("Expired activity purged", { description: `${result.purgedCount} event${result.purgedCount === 1 ? "" : "s"} older than ${result.retentionDays} days removed.` });
    } catch (caught) {
      toast.error("Activity purge failed", { description: caught instanceof Error ? caught.message : "Please try again." });
    }
  };

  const title = isAdmin ? "User & supervisor management" : `${departmentLabel(scopedDepartmentCode)} user management`;
  const copy = isAdmin ? "Assign one supervisor per department, create unique credentials, and control access without deleting account history." : "Create and manage unique login credentials for users in your department. Supervisors cannot access other departments.";

  return <div className="content">
    <div className="page-heading"><div><div className="eyebrow">{isAdmin ? "Administrator workspace" : "Supervisor workspace"}</div><h1 className="page-title">{title}</h1><p className="page-copy">{copy}</p></div><div className="status-badge blue"><ShieldCheck size={12} /> {isAdmin ? "Admin only" : "Supervisor only"}</div></div>
    <div className="metric-grid account-metrics"><div className="metric-card"><div className="metric-label">Visible accounts</div><div className="metric-value">{accounts.length}</div><div className="metric-foot">{isAdmin ? "All local identities" : `${departmentLabel(scopedDepartmentCode)} identities`}</div></div><div className="metric-card"><div className="metric-label">Active</div><div className="metric-value">{activeCount}</div><div className="metric-foot">Can sign in now</div></div><div className="metric-card"><div className="metric-label">Deactivated</div><div className="metric-value">{inactiveCount}</div><div className="metric-foot">Access paused</div></div><div className="metric-card"><div className="metric-label">Supervisors</div><div className="metric-value">{accounts.filter((account) => account.role === "supervisor").length}</div><div className="metric-foot">Department leads</div></div></div>
    {message && <div className="account-success" role="status"><CheckCircle2 size={15} />{message}</div>}
    {error && <div className="account-error" role="alert">{error}</div>}
    {isAdmin && <section className="panel" style={{ marginBottom: 16 }}><div className="panel-header"><div><div className="panel-title"><Building2 size={16} /> Create a department dashboard</div><div className="panel-meta">Every new department is provisioned with a distinct, access-controlled operational workspace.</div></div><span className="status-badge amber">Admin only</span></div><form className="panel-body account-form" onSubmit={submitDepartment}><label><span>Department name</span><input className="form-input" value={departmentForm.name} onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Quality Assurance" required /></label><label><span>Department code</span><input className="form-input" value={departmentForm.code} onChange={(event) => setDepartmentForm((current) => ({ ...current, code: normalizeDepartmentCode(event.target.value) }))} placeholder="e.g. quality-team" pattern="[a-z][a-z0-9-]{2,15}" title="3–16 lowercase letters, numbers, or hyphens" required /></label><label><span>Dashboard focus</span><select className="form-select" value={departmentForm.workstream} onChange={(event) => setDepartmentForm((current) => ({ ...current, workstream: event.target.value as DepartmentWorkstream }))}>{DEPARTMENT_WORKSTREAMS.map((workstream) => <option key={workstream} value={workstream}>{workstream[0].toUpperCase() + workstream.slice(1)}</option>)}</select></label><label><span>Accent</span><select className="form-select" value={departmentForm.accent} onChange={(event) => setDepartmentForm((current) => ({ ...current, accent: event.target.value as DepartmentDashboardAccent }))}>{DEPARTMENT_DASHBOARD_ACCENTS.map((accent) => <option key={accent} value={accent}>{accent[0].toUpperCase() + accent.slice(1)}</option>)}</select></label><label><span>Workspace icon</span><select className="form-select" value={departmentForm.icon} onChange={(event) => setDepartmentForm((current) => ({ ...current, icon: event.target.value as DepartmentDashboardIcon }))}>{DEPARTMENT_DASHBOARD_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label><label><span>Operational objective</span><textarea className="form-input" rows={2} value={departmentForm.description} onChange={(event) => setDepartmentForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the department’s primary responsibility and handoff scope." minLength={12} maxLength={600} required /></label><button className="primary-button" type="submit" disabled={createDepartment.isPending}><LayoutDashboard size={14} />{createDepartment.isPending ? "Provisioning dashboard…" : "Create department dashboard"}</button></form></section>}
    {isAdmin && <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header"><div><div className="panel-title"><LayoutDashboard size={16} /> Provisioned department workspaces</div><div className="panel-meta">Archiving pauses department sign-in and new assignment without deleting dashboards, templates, users, or history.</div></div><span className="status-badge blue">{provisionedDepartments.filter((department) => department.active === 1).length} active</span></div>
      <div className="panel-body">{provisionedDepartmentsQuery.isLoading ? <div className="empty-state">Loading department workspaces…</div> : provisionedDepartments.length ? <div className="account-list">{provisionedDepartments.map((department) => <div className={`account-row ${department.active !== 1 ? "account-row-inactive" : ""}`} key={department.code}><div className="avatar">{initials(department.name)}</div><div className="account-main"><div className="compliance-name">{department.name}</div><div className="compliance-sub">{department.description}</div><div className="account-tags"><span className={`status-badge ${department.accent === "orange" ? "amber" : "blue"}`}>{department.code}</span><span className={`status-badge ${department.active === 1 ? "green" : "gray"}`}>{department.active === 1 ? "Active workspace" : "Archived workspace"}</span></div></div><div className="account-actions">{department.active === 1 && <button className="secondary-button compact-button" type="button" onClick={() => onOpenDashboard?.(department.code)}><LayoutDashboard size={13} /> Open dashboard</button>}<button className={`secondary-button compact-button ${department.active === 1 ? "danger-button" : ""}`} type="button" onClick={() => void updateDepartmentLifecycle(department, department.active !== 1)} disabled={setDepartmentActive.isPending}><Power size={13} />{department.active === 1 ? "Archive" : "Restore"}</button></div></div>)}</div> : <div className="empty-state">No additional department dashboards have been provisioned. Create one above to begin.</div>}</div>
    </section>}
    <div className="detail-grid" style={{ marginBottom: 16 }}>
      <section className="panel"><div className="panel-header"><div><div className="panel-title"><CalendarRange size={16} /> Activity period</div><div className="panel-meta">Filter before reviewing or exporting account activity.</div></div><button className="secondary-button compact-button" type="button" onClick={resetActivityRange} disabled={!activityFrom && !activityTo}><RotateCcw size={13} /> Clear dates</button></div><div className="panel-body account-toolbar"><label className="form-field"><span>From date</span><input className="form-input" type="date" value={activityFrom} onChange={(event) => setActivityFrom(event.target.value)} aria-label="Activity start date" /></label><label className="form-field"><span>To date</span><input className="form-input" type="date" value={activityTo} onChange={(event) => setActivityTo(event.target.value)} aria-label="Activity end date" /></label><span className={`status-badge ${hasInvalidActivityDate ? "amber" : "blue"}`}>{hasInvalidActivityDate ? "Enter a valid date" : activityQuery.isFetching ? "Filtering…" : `${activity.length} matching events`}</span></div></section>
      {isAdmin && <section className="panel"><div className="panel-header"><div><div className="panel-title"><Settings2 size={16} /> Activity retention</div><div className="panel-meta">Retention does not delete history automatically; a separate, confirmed purge is required.</div></div><span className="status-badge amber">Admin only</span></div><div className="panel-body account-toolbar"><label className="form-field"><span>Retain events</span><select className="form-select" value={retentionQuery.data?.retentionDays ?? 365} onChange={(event) => void saveRetention(Number(event.target.value))} disabled={retentionQuery.isLoading || updateRetention.isPending} aria-label="Activity log retention period">{[30, 90, 180, 365, 730].map((days) => <option value={days} key={days}>{days} days</option>)}</select></label><button className="danger-button" type="button" onClick={() => void purgeExpired()} disabled={purgeExpiredActivity.isPending || retentionQuery.isLoading}><Trash2 size={13} />{purgeExpiredActivity.isPending ? "Purging…" : "Purge expired events"}</button></div></section>}
    </div>
    <section className="panel user-activity-panel"><div className="panel-header"><div><div className="panel-title"><Activity size={16} /> Recent account activity</div><div className="panel-meta">{isAdmin ? "All departments" : `${departmentLabel(scopedDepartmentCode)} only`} · sign-ins, profile changes, and access status changes.</div></div><div className="activity-header-actions"><span className="status-badge blue">{activity.length} events</span><button className="secondary-button compact-button" type="button" onClick={exportActivity} disabled={!activity.length}><Download size={13} /> Export CSV</button></div></div><div className="panel-body activity-list">{activityQuery.isLoading ? <div className="empty-state">Loading activity…</div> : activityQuery.error ? <div className="account-error">Unable to load account activity.</div> : activity.length ? activity.slice(0, 8).map((event) => <div className="activity-row" key={event.id}><div className="activity-icon"><Activity size={14} /></div><div className="activity-copy"><div><strong>{event.userName ?? event.userEmail ?? "Unknown user"}</strong><span className="activity-action">{activityLabel(event.action)}</span></div><p>{event.detail}</p></div><time>{displayDateTime(event.createdAt)}</time></div>) : <div className="empty-state">No account activity has been recorded yet.</div>}</div></section>
    <div className="department-user-layout">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">{isAdmin ? "Add a supervisor or department user" : "Add a department user"}</div><div className="panel-meta">Each account receives a unique email/password login and access only to its department portal.</div></div>{isAdmin ? <Crown size={17} /> : <UserPlus size={17} />}</div><form className="panel-body account-form" onSubmit={submit}><label><span>Full name</span><input className="form-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Team member name" required /></label><label><span>Work email</span><input className="form-input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@bobcranes.com" required /></label><label><span>Unique password</span><input className="form-input" type="password" minLength={10} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="At least 10 characters" required /></label><label><span>Department</span><select className="form-select" value={form.departmentCode} onChange={(event) => setForm((current) => ({ ...current, departmentCode: event.target.value }))} disabled={isSupervisor}>{manageableDepartments.map((department) => <option value={department.code} key={department.code}>{department.label}</option>)}</select></label>{isAdmin && <label><span>Account level</span><select className="form-select" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AccountForm["role"] }))}><option value="user">Department user</option><option value="supervisor">Department supervisor</option></select></label>}<button className="primary-button" type="submit" disabled={registerUser.isPending}><UserPlus size={14} />{registerUser.isPending ? "Creating account…" : `Create ${form.role === "supervisor" ? "supervisor" : "department user"}`}</button></form></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Registered accounts</div><div className="panel-meta">{isAdmin ? "Assign or review supervisors across all departments." : "Manage only users assigned to your department."}</div></div><UsersRound size={17} /></div><div className="panel-body"><div className="account-toolbar"><div className="search-pill account-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or department" aria-label="Search user accounts" /></div><select className="form-select account-filter" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter users by department"><option value="all">All departments</option>{manageableDepartments.map((department) => <option value={department.code} key={department.code}>{department.label}</option>)}</select><select className="form-select account-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter account status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Deactivated</option></select></div>{usersQuery.isLoading ? <div className="empty-state">Loading accounts…</div> : usersQuery.error ? <div className="account-error">Unable to load accounts. Refresh and try again.</div> : filteredAccounts.length ? <div className="account-list">{filteredAccounts.map((account) => <div className={`account-row ${account.isActive !== 1 ? "account-row-inactive" : ""}`} key={account.id}><div className="avatar">{initials(account.name ?? account.email ?? "User")}</div><div className="account-main"><div className="compliance-name">{account.name ?? "Unnamed user"}</div><div className="compliance-sub">{account.email} · Last sign-in {displayDate(account.lastSignedIn)}</div><div className="account-tags"><span className={`status-badge ${account.isActive === 1 ? "green" : "gray"}`}>{account.isActive === 1 ? "Active" : "Deactivated"}</span><span className={`status-badge ${account.role === "supervisor" ? "amber" : "blue"}`}>{roleLabel(account.role)}{account.role !== "admin" && ` · ${departmentLabel(account.departmentCode)}`}</span></div></div><div className="account-actions">{account.id === actor.id ? <span className="status-badge gray">Current account</span> : <><button className="icon-action-button" onClick={() => beginEdit(account)} title={`Edit ${account.name ?? "account"}`} aria-label={`Edit ${account.name ?? "account"}`}><Edit3 size={14} /></button>{account.role === "admin" ? <span className="status-badge gray"><ShieldCheck size={10} />Protected</span> : <button className={`icon-action-button ${account.isActive === 1 ? "danger" : "success"}`} onClick={() => requestActiveChange(account)} disabled={setUserActive.isPending} title={account.isActive === 1 ? "Deactivate account" : "Reactivate account"} aria-label={account.isActive === 1 ? "Deactivate account" : "Reactivate account"}><Power size={14} /></button>}</>}</div></div>)}</div> : <div className="empty-state">No accounts match the current filters.</div>}</div></section>
    </div>
    {editingId !== null && <section className="panel account-edit-panel"><div className="panel-header"><div><div className="panel-title"><KeyRound size={15} /> Edit department account</div><div className="panel-meta">Leave the password blank to keep the existing password.</div></div><button className="icon-button" onClick={() => setEditingId(null)} aria-label="Close account editor"><X size={16} /></button></div><form className="panel-body account-edit-form" onSubmit={submitEdit}><label><span>Full name</span><input className="form-input" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} required /></label><label><span>Work email</span><input className="form-input" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} required /></label><label><span>Reset password <em>optional</em></span><input className="form-input" type="password" minLength={10} value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to keep current" /></label><label><span>Role</span><select className="form-select" value={editForm.role} disabled={isSupervisor} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value as PortalRole, departmentCode: event.target.value === "admin" ? "administrator" : current.departmentCode === "administrator" ? scopedDepartmentCode : current.departmentCode }))}><option value="user">Department user</option>{isAdmin && <><option value="supervisor">Department supervisor</option><option value="admin">Administrator</option></>}</select></label><label><span>Department</span><select className="form-select" value={editForm.departmentCode} disabled={editForm.role === "admin" || isSupervisor} onChange={(event) => setEditForm((current) => ({ ...current, departmentCode: event.target.value }))}>{(isAdmin ? DEPARTMENTS : manageableDepartments).map((department) => <option value={department.code} key={department.code}>{department.label}</option>)}</select></label><div className="account-edit-actions"><button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Cancel</button><button type="submit" className="primary-button" disabled={updateUser.isPending}>{updateUser.isPending ? "Saving changes…" : "Save changes"}</button></div></form></section>}
    {deactivationTarget && <div className="modal-backdrop" role="presentation" onClick={() => setDeactivationTarget(null)}><div className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="deactivate-title" onClick={(event) => event.stopPropagation()}><div className="confirmation-icon"><AlertTriangle size={20} /></div><h2 id="deactivate-title">Deactivate this account?</h2><p><strong>{deactivationTarget.name ?? deactivationTarget.email}</strong> will no longer be able to sign in to the {departmentLabel(deactivationTarget.departmentCode)} workspace. Their history will remain available and the account can be reactivated later.</p><div className="confirmation-actions"><button className="secondary-button" onClick={() => setDeactivationTarget(null)}>Cancel</button><button className="danger-button" onClick={() => void commitActiveChange(deactivationTarget, false)} disabled={setUserActive.isPending}>{setUserActive.isPending ? "Deactivating…" : "Deactivate account"}</button></div></div></div>}
  </div>;
}
