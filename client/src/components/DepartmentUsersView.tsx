import { DEPARTMENTS } from "@shared/departmentAccess";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useState } from "react";

const initialForm = { name: "", email: "", password: "", departmentCode: "sales" };

export default function DepartmentUsersView() {
  const usersQuery = trpc.auth.listUsers.useQuery();
  const registerUser = trpc.auth.registerUser.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const account = await registerUser.mutateAsync(form);
      setForm(initialForm);
      setMessage(`${account.name ?? account.email} can now sign in to the ${DEPARTMENTS.find((department) => department.code === account.departmentCode)?.label ?? "assigned"} workspace.`);
      await utils.auth.listUsers.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The department account could not be created.");
    }
  };

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Administrator workspace</div><h1 className="page-title">Department users</h1><p className="page-copy">Create the email and password accounts that give each department access to its own operations workspace.</p></div></div><div className="department-user-layout"><section className="panel"><div className="panel-header"><div><div className="panel-title">Register a department user</div><div className="panel-meta">The user receives access only to the selected department.</div></div><UserPlus size={17} /></div><form className="panel-body account-form" onSubmit={submit}><label><span>Full name</span><input className="form-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Team member name" required /></label><label><span>Work email</span><input className="form-input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@bobcranes.com" required /></label><label><span>Temporary password</span><input className="form-input" type="password" minLength={10} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="At least 10 characters" required /></label><label><span>Department</span><select className="form-select" value={form.departmentCode} onChange={(event) => setForm((current) => ({ ...current, departmentCode: event.target.value }))}>{DEPARTMENTS.filter((department) => department.code !== "administrator").map((department) => <option value={department.code} key={department.code}>{department.label}</option>)}</select></label>{message && <div className="account-success"><CheckCircle2 size={15} />{message}</div>}{error && <div className="account-error">{error}</div>}<button className="primary-button" type="submit" disabled={registerUser.isPending}>{registerUser.isPending ? "Creating account…" : "Create department account"}</button></form></section><section className="panel"><div className="panel-header"><div><div className="panel-title">Registered department users</div><div className="panel-meta">Accounts are created and managed by administrators only.</div></div><UsersRound size={17} /></div><div className="panel-body account-list">{usersQuery.isLoading ? <div className="empty-state">Loading accounts…</div> : usersQuery.data?.length ? usersQuery.data.map((account) => <div className="account-row" key={account.id}><div className="avatar">{(account.name ?? account.email ?? "U").split(" ").map((value) => value[0]).join("").slice(0, 2).toUpperCase()}</div><div><div className="compliance-name">{account.name ?? "Unnamed user"}</div><div className="compliance-sub">{account.email}</div></div><span className="status-badge blue"><ShieldCheck size={10} />{account.role === "admin" ? "Administrator" : DEPARTMENTS.find((department) => department.code === account.departmentCode)?.label ?? "Department"}</span></div>) : <div className="empty-state">No department users have been created yet.</div>}</div></section></div></div>;
}
