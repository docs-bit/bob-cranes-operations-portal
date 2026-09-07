import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  MessageCircle,
  Send,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "./primitives";

const PORTAL_TEAMS = [
  "Sales",
  "Documentation",
  "HSE",
  "Accounts",
  "Operations Management",
] as const;

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 25 * 1024 * 1024;

type PortalTab = "documents" | "chat" | "summary";

/**
 * Logged-out client response portal (PRD v3.0 §10).
 * Authenticated exclusively by the booking-scoped magic-link token;
 * every read and mutation is token-validated server-side.
 */
export function TokenPortal({
  token,
  forceInvalid = false,
}: {
  token: string;
  forceInvalid?: boolean;
}) {
  const [tab, setTab] = useState<PortalTab>("documents");
  const [team, setTeam] = useState<(typeof PORTAL_TEAMS)[number]>("Documentation");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contextQuery = trpc.operations.getPortalContext.useQuery(
    { token },
    { retry: false, enabled: !forceInvalid }
  );
  const chatMutation = trpc.operations.postPortalChat.useMutation();
  const uploadMutation = trpc.operations.uploadPortalDocument.useMutation();
  const linkRequestMutation = trpc.operations.requestPortalLink.useMutation();

  const [requestEmail, setRequestEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  const context = contextQuery.data;
  const uploadedCount = useMemo(
    () =>
      (context?.documents ?? []).filter(
        doc => doc.state === "Uploaded" || doc.state === "Approved"
      ).length,
    [context]
  );

  const sendChat = () => {
    if (!message.trim() || !displayName.trim()) {
      toast.error("Name and message required", {
        description: "Tell us your name so the team knows who wrote.",
      });
      return;
    }
    const body = message.trim();
    const name = displayName.trim();
    setMessage("");
    void chatMutation
      .mutateAsync({ token, team, displayName: name, body })
      .then(() => contextQuery.refetch())
      .catch((caught: unknown) => {
        setMessage(body);
        toast.error("Message not delivered", {
          description:
            caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  const onFileChosen = (file: File | undefined) => {
    if (!file || !uploadTarget) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", {
        description: "Each upload must be 25 MB or smaller.",
      });
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type", {
        description: "Upload a PDF, JPEG, or PNG file.",
      });
      return;
    }
    const target = uploadTarget;
    setUploadTarget(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      void uploadMutation
        .mutateAsync({
          token,
          documentId: target,
          fileName: file.name,
          fileType: file.type as "application/pdf" | "image/jpeg" | "image/png",
          fileSize: file.size,
          contentBase64: base64,
        })
        .then(() => contextQuery.refetch())
        .then(() =>
          toast.success("Document received", {
            description: `${file.name} is now with the Documentation team.`,
          })
        )
        .catch((caught: unknown) => {
          toast.error("Upload failed", {
            description:
              caught instanceof Error ? caught.message : "Please try again.",
          });
        });
    };
    reader.onerror = () => {
      toast.error("Upload failed", {
        description: "The file could not be read. Please try again.",
      });
    };
    reader.readAsDataURL(file);
  };

  const requestLink = () => {
    if (!requestEmail.trim() || !requestMessage.trim()) {
      toast.error("Email and message required", {
        description: "The team needs a reply address and a short note.",
      });
      return;
    }
    void linkRequestMutation
      .mutateAsync({
        contactEmail: requestEmail.trim(),
        message: requestMessage.trim(),
      })
      .then(() => setRequestSent(true))
      .catch((caught: unknown) => {
        toast.error("Request failed", {
          description:
            caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  if (contextQuery.isLoading) {
    return (
      <div className="content" role="status" aria-live="polite">
        <div className="panel">
          <div className="panel-title">Loading your booking portal…</div>
          <div className="panel-meta">
            Fetching the live checklist for this booking.
          </div>
        </div>
      </div>
    );
  }

  if (forceInvalid || contextQuery.isError || !context) {
    return (
      <div className="content">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">This link is no longer valid</div>
            <StatusBadge value="Expired" />
          </div>
          <div className="panel-meta">
            Portal links expire after 24 hours or when closed by BOB Cranes.
            Ask your coordinator for a new one — or send a request below and
            the Documentation team will respond.
          </div>
          {requestSent ? (
            <div className="notification" style={{ marginTop: 12 }}>
              <div className="title">
                <CheckCircle2
                  size={14}
                  style={{ verticalAlign: "-2px", marginRight: 6 }}
                />
                Request received
              </div>
              <div className="body">
                The Documentation team has your request and will send a fresh
                link.
              </div>
            </div>
          ) : (
            <div className="detail-list" style={{ marginTop: 12 }}>
              <div className="detail-cell">
                <label>Your work email</label>
                <input
                  aria-label="Your work email"
                  type="email"
                  value={requestEmail}
                  onChange={event => setRequestEmail(event.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div className="detail-cell">
                <label>Which booking is this about?</label>
                <input
                  aria-label="Request message"
                  placeholder="Booking reference and what you need"
                  value={requestMessage}
                  onChange={event => setRequestMessage(event.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}
          {!requestSent && (
            <button
              type="button"
              className="primary-button"
              style={{ marginTop: 12 }}
              disabled={linkRequestMutation.isPending}
              onClick={requestLink}
            >
              <Send size={14} /> Request a new link
            </button>
          )}
        </div>
      </div>
    );
  }

  const pending = context.documents.filter(
    doc => doc.state !== "Uploaded" && doc.state !== "Approved"
  );

  return (
    <div className="content">
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">
              BOB CRANES — Booking {context.booking.id}
            </div>
            <div className="panel-meta">
              {context.booking.clientName} — {context.booking.projectName} ·
              link expires{" "}
              {new Date(context.expiresAt).toLocaleString()}
            </div>
          </div>
          <StatusBadge value={`${uploadedCount}/${context.documents.length} received`} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="tablist" aria-label="Portal sections">
          {(
            [
              { id: "documents", label: "Documents" },
              { id: "chat", label: "Chat" },
              { id: "summary", label: "Booking Summary" },
            ] as Array<{ id: PortalTab; label: string }>
          ).map(entry => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`filter-chip ${tab === entry.id ? "selected" : ""}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "documents" && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Required documents</div>
            <div className="panel-meta">
              Upload what BOB Cranes asked for. PDF, JPEG, or PNG up to 25 MB.
            </div>
          </div>
          {context.documents.length === 0 ? (
            <div className="panel-meta">
              Nothing requested yet — a coordinator will be assigned shortly.
            </div>
          ) : (
            <div className="detail-list">
              {context.documents.map(doc => {
                const meta = context.metadata.find(item => item.id === doc.id);
                const done =
                  doc.state === "Uploaded" || doc.state === "Approved";
                return (
                  <div className="detail-cell" key={doc.id}>
                    <label>{doc.departmentCode}</label>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        <FileText
                          size={13}
                          style={{ verticalAlign: "-2px", marginRight: 6 }}
                        />
                        {doc.name}
                        {meta?.fileName && (
                          <span className="panel-meta"> · {meta.fileName}</span>
                        )}
                        {meta?.storageKey && (
                          <>
                            {" · "}
                            <a
                              href={`/files/${meta.storageKey}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download
                            </a>
                          </>
                        )}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <StatusBadge
                          value={done ? "Received" : "Pending"}
                        />
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={uploadMutation.isPending}
                          onClick={() => {
                            setUploadTarget(doc.id);
                            fileInputRef.current?.click();
                          }}
                        >
                          {done ? "Replace" : "Upload"}
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            style={{ display: "none" }}
            aria-label="Choose a document to upload"
            onChange={event => {
              onFileChosen(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {tab === "chat" && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Team chat</div>
            <div className="panel-meta">
              Questions route to the right internal team.
            </div>
          </div>
          <div className="detail-list" style={{ marginBottom: 12 }}>
            <div className="detail-cell">
              <label>Your name</label>
              <input
                aria-label="Your name"
                placeholder="e.g. Rajeev, Gulf Contracting"
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div className="detail-cell">
              <label>Team</label>
              <select
                aria-label="Team to message"
                value={team}
                onChange={event =>
                  setTeam(event.target.value as typeof team)
                }
                style={{ width: "100%" }}
              >
                {PORTAL_TEAMS.map(entry => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {context.chat.length === 0 ? (
            <div className="panel-meta" style={{ marginBottom: 12 }}>
              No messages yet — start the conversation below.
            </div>
          ) : (
            <div className="detail-list" style={{ marginBottom: 12 }}>
              {context.chat.map(item => (
                <div className="detail-cell" key={item.id}>
                  <label>
                    {item.team} · {item.sender}
                  </label>
                  <div>{item.body}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              aria-label="Write a message to the BOB team"
              placeholder="Write a message to the BOB team…"
              value={message}
              onChange={event => setMessage(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") sendChat();
              }}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="primary-button"
              disabled={chatMutation.isPending}
              onClick={sendChat}
            >
              <Send size={14} /> Send
            </button>
          </div>
        </div>
      )}

      {tab === "summary" && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Booking summary</div>
          </div>
          <div className="detail-list">
            <div className="detail-cell">
              <label>Booking</label>
              <div>{context.booking.id}</div>
            </div>
            <div className="detail-cell">
              <label>Priority</label>
              <div>
                <StatusBadge value={context.booking.priority} />
              </div>
            </div>
            <div className="detail-cell">
              <label>Mobilization</label>
              <div>{context.booking.mobDate}</div>
            </div>
            <div className="detail-cell">
              <label>Off-hire</label>
              <div>{context.booking.offHireDate}</div>
            </div>
            <div className="detail-cell">
              <label>Documents received</label>
              <div>
                {uploadedCount} of {context.documents.length}
              </div>
            </div>
            <div className="detail-cell">
              <label>Messages exchanged</label>
              <div>{context.chat.length}</div>
            </div>
          </div>
          {pending.length > 0 && (
            <div className="notification" style={{ marginTop: 12 }}>
              <div className="title">
                <AlertTriangle
                  size={14}
                  style={{ verticalAlign: "-2px", marginRight: 6 }}
                />
                Still outstanding
              </div>
              <div className="body">
                {pending.map(doc => doc.name).join(" · ")}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setTab("documents")}
        >
          <ArrowLeft size={14} /> Back to documents
        </button>
      </div>
    </div>
  );
}
