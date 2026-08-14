import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Building2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

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
  const [form, setForm] = useState<LoginForm>(emptyForm);
  const [error, setError] = useState("");

  const setupMode = setupStatus.data?.needsAdminSetup === true;
  const pending = login.isPending || bootstrapAdmin.isPending;
  const readableError = (caught: unknown) => {
    const message = caught instanceof Error ? caught.message : "We could not complete that sign-in request.";
    return /invalid email|invalid password|unauthorized/i.test(message) ? "The email or password is incorrect. Check your credentials or contact your administrator." : message;
  };

  useEffect(() => {
    if (user) setLocation("/");
  }, [setLocation, user]);

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
      setLocation("/");
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
        <div className="auth-brand"><div className="auth-brand-mark auth-brand-logo"><img src="/manus-storage/bob-cranes-mark_c80bfee2.png" alt="BOB Cranes" /></div><span>BOB CRANES</span></div>
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
          <div className="auth-card-icon">{setupMode ? <UserRound size={22} /> : <LockKeyhole size={22} />}</div>
          <h2>{setupMode ? "Set up the administrator account" : "Sign in to BOB Cranes"}</h2>
          <p>{setupMode ? "Create the first administrator account. Only administrators can register department users after setup." : "Use the email address and password provided by your administrator."}</p>
          <form onSubmit={submit} className="auth-form">
            {setupMode && <label><span>Administrator name</span><input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" placeholder="e.g. Nishanth Shetty" required /></label>}
            <label><span>Work email</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" placeholder="name@bobcranes.com" required /></label>
            <label><span>Password</span><input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={setupMode ? "new-password" : "current-password"} placeholder={setupMode ? "At least 10 characters" : "Enter your password"} minLength={setupMode ? 10 : undefined} required /></label>
            {error && <div className="auth-error" role="alert"><ShieldCheck size={15} /> <span>{error}</span></div>}
            {pending && <div className="auth-pending-note" role="status"><span className="button-spinner" aria-hidden="true" /> Securely verifying your account…</div>}
            <button className="auth-submit" type="submit" disabled={pending}><span className={pending ? "button-spinner" : ""} aria-hidden="true" />{pending ? "Please wait…" : setupMode ? "Create administrator account" : "Sign in"}</button>
          </form>
          <div className="auth-note"><ShieldCheck size={14} />Your administrator controls new accounts and department access.</div>
        </div>
      </section>
    </main>
  );
}
