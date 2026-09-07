import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Building2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import "./Login.css";

type LoginForm = {
  name: string;
  email: string;
  password: string;
};

const emptyForm: LoginForm = { name: "", email: "", password: "" };

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const setupStatus = trpc.auth.setupStatus.useQuery(undefined, { retry: false });
  const login = trpc.auth.login.useMutation();
  const bootstrapAdmin = trpc.auth.bootstrapAdmin.useMutation();
  const changePassword = trpc.auth.changePassword.useMutation();
  const [form, setForm] = useState<LoginForm>(emptyForm);
  const [error, setError] = useState("");
  const [forceChange, setForceChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const setupMode = setupStatus.data?.needsAdminSetup === true;
  const needsChange =
    forceChange || (user?.mustChangePassword ?? 0) === 1;
  const pending = login.isPending || bootstrapAdmin.isPending || changePassword.isPending;
  const readableError = (caught: unknown) => {
    const message = caught instanceof Error ? caught.message : "We could not complete that sign-in request.";
    return /invalid email|invalid password|unauthorized/i.test(message) ? "The email or password is incorrect. Check your credentials or contact your administrator." : message;
  };

  useEffect(() => {
    if (user && !needsChange) setLocation("/portal");
  }, [setLocation, user, needsChange]);

  const update = (field: keyof LoginForm, value: string) => {
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      const account = setupMode
        ? await bootstrapAdmin.mutateAsync({
            name: form.name,
            email: form.email,
            password: form.password,
            departmentCode: "administrator",
          })
        : await login.mutateAsync({ email: form.email, password: form.password });
      utils.auth.me.setData(undefined, account);
      await utils.auth.me.invalidate();
      if ((account.mustChangePassword ?? 0) === 1) {
        setForceChange(true);
        setForm(current => ({ ...current, password: "" }));
        return;
      }
      setLocation("/portal");
    } catch (caught) {
      setError(readableError(caught));
    }
  };

  const submitPasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 10) {
      setError("The new password must be at least 10 characters.");
      return;
    }
    try {
      const account = await changePassword.mutateAsync({
        currentPassword,
        newPassword,
      });
      utils.auth.me.setData(undefined, account);
      await utils.auth.me.invalidate();
      setForceChange(false);
      setCurrentPassword("");
      setNewPassword("");
      setLocation("/portal");
    } catch (caught) {
      setError(readableError(caught));
    }
  };

  if (loading || setupStatus.isLoading) {
    return <div className="auth-loading"><div className="auth-loading-card"><span className="auth-spinner" aria-hidden="true" /><strong>Loading secure workspace…</strong><span>Checking your department access.</span></div></div>;
  }

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="BOB Cranes Operations Control">
        <div className="auth-brand auth-brand-full"><div className="auth-brand-mark auth-brand-logo"><img src="/assets/bob-logo.webp" alt="BOB Cranes — Lifting Your Expectations" /></div></div>
        <div className="auth-visual-copy">
          <span className="auth-kicker">Operations Control</span>
          <h1>Keep every lift, dossier, and department connected.</h1>
          <p>One focused workspace for secure booking control, compliance review, crew readiness, and live handoffs.</p>
        </div>
        <div className="auth-visual-points">
          <div><ShieldCheck size={18} /><span>Department-scoped access</span></div>
          <div><Building2 size={18} /><span>Built for multi-team operations</span></div>
        </div>
      </section>

      <section className="auth-card-wrap">
        <div className="auth-card">
          <button className="auth-landing-back" type="button" onClick={() => setLocation("/")}><ArrowLeft size={14} /> Back to Heavy Equipment Rental</button>
          <div className="auth-card-icon">{setupMode ? <UserRound size={22} /> : <LockKeyhole size={22} />}</div>
          <h2>{needsChange ? "Choose a new password" : setupMode ? "Set up the administrator account" : "Sign in to BOB Cranes"}</h2>
          <p>{needsChange ? "Your account requires a password change before you can continue. Use at least 10 characters." : setupMode ? "Create the first administrator account. Only administrators can register department users after setup." : "Use the email address and password provided by your administrator."}</p>
          {needsChange ? (
          <form onSubmit={submitPasswordChange} className="auth-form">
            <label><span>Current password</span><input type="password" value={currentPassword} onChange={(event) => { setError(""); setCurrentPassword(event.target.value); }} autoComplete="current-password" placeholder="Enter your current password" required /></label>
            <label><span>New password</span><input type="password" value={newPassword} onChange={(event) => { setError(""); setNewPassword(event.target.value); }} autoComplete="new-password" placeholder="At least 10 characters" minLength={10} required /></label>
            {error && <div className="auth-error" role="alert"><ShieldCheck size={15} /> <span>{error}</span></div>}
            {pending && <div className="auth-pending-note" role="status"><span className="button-spinner" aria-hidden="true" /> Updating your password…</div>}
            <button className="auth-submit" type="submit" disabled={pending}><span className={pending ? "button-spinner" : ""} aria-hidden="true" />{pending ? "Please wait…" : "Set new password"}</button>
          </form>
          ) : (
          <form onSubmit={submit} className="auth-form">
            {setupMode && <label><span>Administrator name</span><input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" placeholder="e.g. Nishanth Shetty" required /></label>}
            <label><span>Work email</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" placeholder="name@bobcranes.com" required /></label>
            <label><span>Password</span><input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={setupMode ? "new-password" : "current-password"} placeholder={setupMode ? "At least 10 characters" : "Enter your password"} minLength={setupMode ? 10 : undefined} required /></label>
            {error && <div className="auth-error" role="alert"><ShieldCheck size={15} /> <span>{error}</span></div>}
            {pending && <div className="auth-pending-note" role="status"><span className="button-spinner" aria-hidden="true" /> Securely verifying your account…</div>}
            <button className="auth-submit" type="submit" disabled={pending}><span className={pending ? "button-spinner" : ""} aria-hidden="true" />{pending ? "Please wait…" : setupMode ? "Create administrator account" : "Sign in"}</button>
          </form>
          )}
          <div className="auth-note"><ShieldCheck size={14} />Your administrator controls new accounts and department access.</div>
        </div>
      </section>
    </main>
  );
}
