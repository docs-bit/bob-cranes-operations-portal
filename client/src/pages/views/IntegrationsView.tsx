import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, PlugZap, Send, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";

/**
 * Admin → Integrations (PRD v3.0 §7.5).
 * Non-secret configuration persists to system settings; secrets stay
 * environment-managed and are never stored, displayed, or transmitted
 * by this screen. Email sending is not implemented: dispatch is
 * recorded, and the SMTP test is a TCP reachability check only.
 */
export function IntegrationsView() {
  const statusQuery = trpc.operations.getIntegrations.useQuery(undefined, {});
  const saveMutation = trpc.operations.saveIntegrations.useMutation();
  const driveTestMutation = trpc.operations.testDriveConfig.useMutation();
  const smtpTestMutation = trpc.operations.testSmtpConnection.useMutation();

  const [driveJson, setDriveJson] = useState("");
  const [driveRoot, setDriveRoot] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpFromName, setSmtpFromName] = useState("BOB Cranes");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");

  useEffect(() => {
    const settings = statusQuery.data?.settings;
    if (!settings) return;
    setDriveRoot(current => current || settings.driveRootFolder);
    setSmtpHost(current => current || settings.smtpHost);
    setSmtpPort(current =>
      current !== "587" ? current : settings.smtpPort || "587"
    );
    setSmtpFromName(current =>
      current !== "BOB Cranes" ? current : settings.smtpFromName || "BOB Cranes"
    );
    setSmtpFromEmail(current => current || settings.smtpFromEmail);
  }, [statusQuery.data]);

  const save = () => {
    void saveMutation
      .mutateAsync({
        driveRootFolder: driveRoot.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: smtpPort.trim(),
        smtpFromName: smtpFromName.trim(),
        smtpFromEmail: smtpFromEmail.trim(),
      })
      .then(() => statusQuery.refetch())
      .then(() =>
        toast.success("Integration settings saved", {
          description: "Secrets remain environment-managed and were not touched.",
        })
      )
      .catch((caught: unknown) => {
        toast.error("Save failed", {
          description:
            caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  const status = statusQuery.data;

  return (
    <div className="content">
      <PageHeading
        eyebrow="Administration"
        title="Integrations"
        copy="Google Drive archiving and SMTP dispatch configuration. Only non-secret settings are stored here."
        action={
          <button
            type="button"
            className="primary-button"
            disabled={saveMutation.isPending}
            onClick={save}
          >
            {saveMutation.isPending ? "Saving…" : "Save settings"}
          </button>
        }
      />
      {statusQuery.isLoading ? (
        <div className="panel">
          <div className="panel-meta">Loading integration status…</div>
        </div>
      ) : statusQuery.isError ? (
        <div className="panel">
          <div className="panel-meta">Integration status could not be loaded.</div>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 8 }}
            onClick={() => void statusQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <div className="panel-title">
                <PlugZap size={15} /> Google Drive auto-archive
              </div>
              <StatusBadge
                value={
                  status?.drive.serviceAccountConfigured
                    ? "Service account configured"
                    : "Not configured"
                }
              />
            </div>
            <div className="panel-meta" style={{ marginBottom: 12 }}>
              The service-account key is read from the server environment
              (`GOOGLE_DRIVE_SA_JSON`) and never stored in the database.
              Until it is configured, booking creation succeeds but Drive
              archiving stays pending.
            </div>
            <div className="detail-list">
              <div className="detail-cell">
                <label>Service account JSON (validate only — never stored)</label>
                <textarea
                  aria-label="Service account JSON to validate"
                  placeholder='Paste {"type": "service_account", …} here to validate'
                  value={driveJson}
                  onChange={event => setDriveJson(event.target.value)}
                  rows={4}
                  style={{ width: "100%", fontFamily: "monospace" }}
                />
              </div>
              <div className="detail-cell">
                <label>Root folder ID</label>
                <input
                  aria-label="Drive root folder ID"
                  value={driveRoot}
                  onChange={event => setDriveRoot(event.target.value)}
                  placeholder="Drive folder ID for booking folders"
                  style={{ width: "100%" }}
                />
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={driveTestMutation.isPending || !driveJson.trim()}
                    onClick={() => void driveTestMutation.mutateAsync({
                      serviceJson: driveJson,
                      rootFolderId: driveRoot.trim() || "pending",
                    })}
                  >
                    Test connection
                  </button>
                </div>
              </div>
            </div>
            {driveTestMutation.data && (
              <div className="detail-list" style={{ marginTop: 12 }}>
                {driveTestMutation.data.checks.map(check => (
                  <div className="detail-cell" key={check.name}>
                    <label>{check.name}</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {check.ok ? (
                        <CheckCircle2 size={14} color="#16A34A" />
                      ) : (
                        <XCircle size={14} color="#e31e24" />
                      )}
                      <span>{check.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Send size={15} /> SMTP email dispatch
              </div>
              <StatusBadge
                value={
                  status?.smtp.credentialsConfigured
                    ? "Credentials configured"
                    : "Not configured"
                }
              />
            </div>
            <div className="panel-meta" style={{ marginBottom: 12 }}>
              SMTP username and password come from the server environment
              (`SMTP_USER` / `SMTP_PASSWORD`). Email sending is not
              implemented in this build: dispatches are recorded with full
              audit detail and marked as not emailed.
            </div>
            <div className="detail-list">
              <div className="detail-cell">
                <label>SMTP host</label>
                <input
                  aria-label="SMTP host"
                  value={smtpHost}
                  onChange={event => setSmtpHost(event.target.value)}
                  placeholder="mail.example.com"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="detail-cell">
                <label>SMTP port</label>
                <input
                  aria-label="SMTP port"
                  value={smtpPort}
                  onChange={event => setSmtpPort(event.target.value)}
                  placeholder="587"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="detail-cell">
                <label>From name</label>
                <input
                  aria-label="From name"
                  value={smtpFromName}
                  onChange={event => setSmtpFromName(event.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="detail-cell">
                <label>From email</label>
                <input
                  aria-label="From email"
                  type="email"
                  value={smtpFromEmail}
                  onChange={event => setSmtpFromEmail(event.target.value)}
                  style={{ width: "100%" }}
                />
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      smtpTestMutation.isPending ||
                      !smtpHost.trim() ||
                      !smtpPort.trim()
                    }
                    onClick={() => void smtpTestMutation
                      .mutateAsync({
                        host: smtpHost.trim(),
                        port: Number(smtpPort) || 587,
                      })
                      .then(result => {
                        if (result.reachable)
                          toast.success("SMTP host reachable", {
                            description: result.detail,
                          });
                        else
                          toast.error("SMTP host unreachable", {
                            description: result.detail,
                          });
                      })
                      .catch((caught: unknown) => {
                        toast.error("Test failed", {
                          description:
                            caught instanceof Error
                              ? caught.message
                              : "Please try again.",
                        });
                      })}
                  >
                    Test send (reachability only)
                  </button>
                </div>
              </div>
            </div>
            {smtpTestMutation.data && (
              <div className="panel-meta" style={{ marginTop: 12 }}>
                {smtpTestMutation.data.detail}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
