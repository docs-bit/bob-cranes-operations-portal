import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useLocation, useParams } from "wouter";
import "./Login.css";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const resetPassword = trpc.auth.resetPassword.useMutation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 10) {
      setError("The new password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, newPassword });
      setDone(true);
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
          <h2>Choose a new password</h2>
          {!token ? (
            <div className="auth-error" role="alert">
              <ShieldCheck size={15} /> <span>This reset link is incomplete. Request a new one from the sign-in page.</span>
            </div>
          ) : done ? (
            <>
              <div className="auth-pending-note" role="status">
                <CheckCircle2 size={15} /> Password updated. Earlier sessions were signed out.
              </div>
              <button className="auth-submit" type="button" onClick={() => setLocation("/login")}>
                Continue to sign in
              </button>
            </>
          ) : (
            <>
              <p>Use at least 10 characters. The link works once.</p>
              <form onSubmit={submit} className="auth-form">
                <label><span>New password</span><input type="password" value={newPassword} onChange={(event) => { setError(""); setNewPassword(event.target.value); }} autoComplete="new-password" placeholder="At least 10 characters" minLength={10} required /></label>
                <label><span>Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => { setError(""); setConfirmPassword(event.target.value); }} autoComplete="new-password" placeholder="Repeat the new password" minLength={10} required /></label>
                {error && <div className="auth-error" role="alert"><ShieldCheck size={15} /> <span>{error}</span></div>}
                <button className="auth-submit" type="submit" disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? "Please wait…" : "Set new password"}
                </button>
              </form>
            </>
          )}
          <div className="auth-note"><ShieldCheck size={14} />Resetting signs out all other sessions on this account.</div>
        </div>
      </section>
    </main>
  );
}
