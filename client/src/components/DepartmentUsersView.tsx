import { trpc } from "@/lib/trpc";
import { DEPARTMENTS } from "@shared/departmentAccess";
import { nextAccountActiveState, requiresDeactivationConfirmation } from "@shared/accountManagementRules";
import { activityToCsv } from "@shared/activityExport";
import { filterAccounts } from "@shared/userManagementRules";
import { CheckCircle2, Download, Edit3, KeyRound, Power, Search, ShieldCheck, UserPlus, UsersRound, X, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

type AccountForm = {
  name: string;
  email: string;
  password: string;
  departmentCode: string;
};

const initialForm: AccountForm = { name: "", email: "", password: "", departmentCode: "sales" };
const departmentLabel = (code: string | null | undefined) => DEPARTMENTS.find((department) => department.code === code)?.label ?? "Unassigned";
const initials = (value: string) => value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
const displayDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Never";
const displayDateTime = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Unknown";
const activityLabel = (action: string) => ({ sign_in: "Signed in", profile_update: "Profile updated", account_deactivated: "Account deactivated", account_activated: "Account reactivated" }[action] ?? action.replaceAll("_", " "));

export default function DepartmentUsersView() {
  const usersQuery = trpc.auth.listUsers.useQuery();
  const registerUser = trpc.auth.registerUser.useMutation();
  const updateUser = trpc.auth.updateUser.useMutation();
  const setUserActive = trpc.auth.setUserActive.useMutation();
  const activityQuery = trpc.auth.listActivity.useQuery();
  const utils = trpc.useUtils();
  const [form, setForm] = useState(initialForm);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", departmentCode: "sales", role: "user" as "user" | "admin" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deactivationTarget, setDeactivationTarget] = useState<(typeof accounts)[number] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const accounts = usersQuery.data ?? [];
  const filteredAccounts = useMemo(() => filterAccounts(accounts, search, departmentFilter, statusFilter, departmentLabel), [accounts, search, statusFilter, departmentFilter]);

  const notify = (nextMessage: string, nextError = "") => {
    setMessage(nextMessage);
    setError(nextError);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    notify("");
    try {
      const account = await registerUser.mutateAsync(form);
      setForm(initialForm);
      notify(`${account.name ?? account.email} can now sign in to the ${departmentLabel(account.departmentCode)} workspace.`);
      await utils.auth.listUsers.invalidate();
    } catch (caught) {
      notify("", caught instanceof Error ? caught.message : "The department account could not be created.");
    }
  };

  const beginEdit = (account: (typeof accounts)[number]) => {
    setEditingId(account.id);
    setEditForm({ name: account.name ?? "", email: account.email ?? "", password: "", departmentCode: account.role === "admin" ? "administrator" : account.departmentCode ?? "sales", role: account.role });
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
      await utils.auth.listUsers.invalidate();
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
    const nextState = nextAccountActiveState(account, -1);
    if (nextState === null) return;
    if (requiresDeactivationConfirmation(account, -1)) setDeactivationTarget(account);
    else void commitActiveChange(account, nextState);
  };

  const activeCount = accounts.filter((account) => account.isActive === 1).length;
  const inactiveCount = accounts.length - activeCount;
  const activity = activityQuery.data ?? [];
  const exportActivity = () => {
    if (!activity.length) {
      toast.info("No activity to export yet.");
      return;
    }
    const csv = activityToCsv(activity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bob-cranes-account-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Activity CSV downloaded", { description: `${activity.length} audit events exported.` });
  };

  return <div className="content">
    <div className="page-heading"><div><div className="eyebrow">Administrator workspace</div><h1 className="page-title">User management</h1><p className="page-copy">View department accounts, update assignments, reset temporary passwords, and control sign-in access from one place.</p></div><div className="status-badge blue"><ShieldCheck size={12} /> Admin only</div></div>
    <div className="metric-grid account-metrics"><div className="metric-card"><div className="metric-label">Total accounts</div><div className="metric-value">{accounts.length}</div><div className="metric-foot">Local department identities</div></div><div className="metric-card"><div className="metric-label">Active</div><div className="metric-value">{activeCount}</div><div className="metric-foot">Can sign in now</div></div><div className="metric-card"><div className="metric-label">Deactivated</div><div className="metric-value">{inactiveCount}</div><div className="metric-foot">Access paused</div></div></div>
    {message && <div className="account-success" role="status"><CheckCircle2 size={15} />{message}</div>}
    {error && <div className="account-error" role="alert">{error}</div>}
    <section className="panel user-activity-panel"><div className="panel-header"><div><div className="panel-title"><Activity size={16} /> Recent account activity</div><div className="panel-meta">Sign-ins, profile changes, and access status changes for local department accounts.</div></div><div className="activity-header-actions"><span className="status-badge blue">{activity.length} events</span><button className="secondary-button compact-button" type="button" onClick={exportActivity} disabled={!activity.length}><Download size={13} /> Export CSV</button></div></div><div className="panel-body activity-list">{activityQuery.isLoading ? <div className="empty-state">Loading activity…</div> : activityQuery.error ? <div className="account-error">Unable to load account activity.</div> : activity.length ? activity.slice(0, 8).map((event) => <div className="activity-row" key={event.id}><div className="activity-icon"><Activity size={14} /></div><div className="activity-copy"><div><strong>{event.userName ?? event.userEmail ?? "Unknown user"}</strong><span className="activity-action">{activityLabel(event.action)}</span></div><p>{event.detail}</p></div><time>{displayDateTime(event.createdAt)}</time></div>) : <div className="empty-state">No account activity has been recorded yet.</div>}</div></section>
    <div className="department-user-layout">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Register a department user</div><div className="panel-meta">The user receives access only to the selected department.</div></div><UserPlus size={17} /></div><form className="panel-body account-form" onSubmit={submit}><label><span>Full name</span><input className="form-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Team member name" required /></label><label><span>Work email</span><input className="form-input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@bobcranes.com" required /></label><label><span>Temporary password</span><input className="form-input" type="password" minLength={10} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="At least 10 characters" required /></label><label><span>Department</span><select className="form-select" value={form.departmentCode} onChange={(event) => setForm((current) => ({ ...current, departmentCode: event.target.value }))}>{DEPARTMENTS.filter((department) => department.code !== "administrator").map((department) => <option value={department.code} key={department.code}>{department.label}</option>)}</select></label><button className="primary-button" type="submit" disabled={registerUser.isPending}><UserPlus size={14} />{registerUser.isPending ? "Creating account…" : "Create department account"}</button></form></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Registered accounts</div><div className="panel-meta">Edit department details or pause access without deleting account history.</div></div><UsersRound size={17} /></div><div className="panel-body"><div className="account-toolbar"><div className="search-pill account-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or department" aria-label="Search user accounts" /></div><select className="form-select account-filter" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter users by department"><option value="all">All departments</option>{DEPARTMENTS.filter((department) => department.code !== "administrator").map((department) => <option value={department.code} key={department.code}>{department.label}</option>)}</select><select className="form-select account-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter account status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Deactivated</option></select></div>{usersQuery.isLoading ? <div className="empty-state">Loading accounts…</div> : usersQuery.error ? <div className="account-error">Unable to load accounts. Refresh and try again.</div> : filteredAccounts.length ? <div className="account-list">{filteredAccounts.map((account) => <div className={`account-row ${account.isActive !== 1 ? "account-row-inactive" : ""}`} key={account.id}><div className="avatar">{initials(account.name ?? account.email ?? "User")}</div><div className="account-main"><div className="compliance-name">{account.name ?? "Unnamed user"}</div><div className="compliance-sub">{account.email} · Last sign-in {displayDate(account.lastSignedIn)}</div><div className="account-tags"><span className={`status-badge ${account.isActive === 1 ? "green" : "gray"}`}>{account.isActive === 1 ? "Active" : "Deactivated"}</span><span className="status-badge blue">{account.role === "admin" ? "Administrator" : departmentLabel(account.departmentCode)}</span></div></div><div className="account-actions"><button className="icon-action-button" onClick={() => beginEdit(account)} title={`Edit ${account.name ?? "account"}`} aria-label={`Edit ${account.name ?? "account"}`}><Edit3 size={14} /></button>{account.role === "admin" ? <span className="status-badge gray"><ShieldCheck size={10} />Protected</span> : <button className={`icon-action-button ${account.isActive === 1 ? "danger" : "success"}`} onClick={() => requestActiveChange(account)} disabled={setUserActive.isPending} title={account.isActive === 1 ? "Deactivate account" : "Reactivate account"} aria-label={account.isActive === 1 ? "Deactivate account" : "Reactivate account"}><Power size={14} /></button>}</div></div>)}</div> : <div className="empty-state">No accounts match the current filters.</div>}</div></section>
    </div>
    {editingId !== null && <section className="panel account-edit-panel"><div className="panel-header"><div><div className="panel-title"><KeyRound size={15} /> Edit department account</div><div className="panel-meta">Leave the password blank to keep the existing password.</div></div><button className="icon-button" onClick={() => setEditingId(null)} aria-label="Close account editor"><X size={16} /></button></div><form className="panel-body account-edit-form" onSubmit={submitEdit}><label><span>Full name</span><input className="form-input" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} required /></label><label><span>Work email</span><input className="form-input" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} required /></label><label><span>Reset password <em>optional</em></span><input className="form-input" type="password" minLength={10} value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to keep current" /></label><label><span>Role</span><select className="form-select" value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value as "user" | "admin", departmentCode: event.target.value === "admin" ? "administrator" : current.departmentCode === "administrator" ? "sales" : current.departmentCode }))}><option value="user">Department user</option><option value="admin">Administrator</option></select></label><label><span>Department</span><select className="form-select" value={editForm.departmentCode} disabled={editForm.role === "admin"} onChange={(event) => setEditForm((current) => ({ ...current, departmentCode: event.target.value }))}>{DEPARTMENTS.map((department) => <option value={department.code} key={department.code}>{department.label}</option>)}</select></label><div className="account-edit-actions"><button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Cancel</button><button type="submit" className="primary-button" disabled={updateUser.isPending}>{updateUser.isPending ? "Saving changes…" : "Save changes"}</button></div></form></section>}
    {deactivationTarget && <div className="modal-backdrop" role="presentation" onClick={() => setDeactivationTarget(null)}><div className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="deactivate-title" onClick={(event) => event.stopPropagation()}><div className="confirmation-icon"><AlertTriangle size={20} /></div><h2 id="deactivate-title">Deactivate this account?</h2><p><strong>{deactivationTarget.name ?? deactivationTarget.email}</strong> will no longer be able to sign in to the {departmentLabel(deactivationTarget.departmentCode)} workspace. Their history will remain available and the account can be reactivated later.</p><div className="confirmation-actions"><button className="secondary-button" onClick={() => setDeactivationTarget(null)}>Cancel</button><button className="danger-button" onClick={() => void commitActiveChange(deactivationTarget, false)} disabled={setUserActive.isPending}>{setUserActive.isPending ? "Deactivating…" : "Deactivate account"}</button></div></div></div>}
  </div>;
}
