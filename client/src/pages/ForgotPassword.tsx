import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import "./Login.css";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const requestReset = trpc.auth.requestPasswordReset.useMutation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await requestReset.mutateAsync({ email });
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Please try again later."
      );
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card-wrap">
        <div className="auth-card">
          <button className="auth-landing-back" type="button" onClick={() => setLocation("/login")}>
            <ArrowLeft size={14} /> Back to sign in
          </button>
          <div className="auth-card-icon"><LockKeyhole size={22} /></div>
          <h2>Reset your password</h2>
          {sent ? (
            <>
              <div className="auth-pending-note" role="status">
                <MailCheck size={15} /> If an active account uses that email, a
                reset link is on its way.
              </div>
              <p>
                Links expire after 30 minutes and work once. Email delivery is
                not configured on this server, so the link is printed to the
                server terminal for the operator to pass on — ask your
                administrator, or check the terminal if that is you.
              </p>
            </>
          ) : (
            <>
              <p>Enter your work email. If an active account uses it, a reset link will be issued.</p>
              <form onSubmit={submit} className="auth-form">
                <label><span>Work email</span><input type="email" value={email} onChange={(event) => { setError(""); setEmail(event.target.value); }} autoComplete="email" placeholder="name@bobcranes.com" required /></label>
                {error && <div className="auth-error" role="alert"><ShieldCheck size={15} /> <span>{error}</span></div>}
                <button className="auth-submit" type="submit" disabled={requestReset.isPending}>
                  {requestReset.isPending ? "Please wait…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
          <div className="auth-note"><ShieldCheck size={14} />Reset links expire after 30 minutes and can be used once.</div>
        </div>
      </section>
    </main>
  );
}
