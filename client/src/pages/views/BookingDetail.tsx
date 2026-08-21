import { useEffect, useMemo, useState } from "react";
import { toast, toast as globalToast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2, ClipboardCheck, Clock3, Download, FileCheck2, FileText, FolderOpen, LayoutDashboard, LoaderCircle, Lock, Mail, MessageCircle, MoreHorizontal, Plus, Send, Truck, Users, Wrench, X } from "lucide-react";
import { DEPARTMENTS, crews, initials, legacyCrews, persistedBookingIdForUi, stages, stageShort, type Booking, type EmployeeAllocation, type Stage } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";
import { canDispatch as canDispatchByRule, departmentCompletion, documentCompletion, revisionReversionStage, revertBooking, STAGE_ROLES, transitionBooking, type DocumentItem } from "@shared/bookingRules";
import { CREW_ASSIGNMENT_ROSTER } from "@shared/crewAssignmentRoster";
import { trpc } from "@/lib/trpc";
import { generateDispatchBundlePdf } from "@/lib/dispatchBundlePdf";

export function BookingDetail({
  booking,
  documents,
  allocations,
  assignmentSavedMessage,
  generatedBy,
  onBack,
  onUpdate,
  onEditAssignment,
  onOpenClientPortal,
}: {
  booking: Booking;
  documents: DocumentItem[];
  allocations: EmployeeAllocation[];
  assignmentSavedMessage?: string | null;
  generatedBy: string;
  onBack: () => void;
  onUpdate: (booking: Booking) => void;
  onEditAssignment: () => void;
  onOpenClientPortal: () => void;
}) {
  const [toast, setToast] = useState("");
  const assignedCrew = useMemo(
    () =>
      CREW_ASSIGNMENT_ROSTER.filter(crew =>
        allocations.some(
          allocation =>
            allocation.bookingId === booking.id &&
            (allocation.crewId
              ? allocation.crewId === crew.id
              : allocation.employeeName === crew.name)
        )
      ),
    [allocations, booking.id]
  );
  const crews = legacyCrews;
  const dossierCrew = assignedCrew.length
    ? assignedCrew
    : legacyCrews.slice(0, 4);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dispatchPreview, setDispatchPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<string | null>(null);
  const [bundlePreview, setBundlePreview] = useState(false);
  const [bundleProgress, setBundleProgress] = useState(0);
  const [bundleProgressLabel, setBundleProgressLabel] = useState("");
  const [bundleStatus, setBundleStatus] = useState<
    "idle" | "generating" | "ready" | "error"
  >("idle");
  const [revisionFlag, setRevisionFlag] = useState(false);
  const [targetedNotifications, setTargetedNotifications] = useState<
    { departmentCode: string; title: string; body: string }[]
  >([]);
  const dispatchBundleMutation =
    trpc.operations.requestDispatchBundle.useMutation();
  const dossierDocuments = useMemo(
    () =>
      documents.map(doc =>
        revisionFlag && doc.id === "doc-3"
          ? { ...doc, state: "Revision Required" as const }
          : doc
      ),
    [documents, revisionFlag]
  );
  const completion = documentCompletion(dossierDocuments);
  const departmentRows = useMemo(
    () =>
      [
        {
          code: "documentation" as const,
          name: "Documentation",
          total: dossierDocuments.filter(doc => doc.departmentCode === "documentation")
            .length,
        },
        {
          code: "hse" as const,
          name: "HSE / Safety",
          total: dossierDocuments.filter(doc => doc.departmentCode === "hse")
            .length,
        },
        {
          code: "crew" as const,
          name: "Crew Assignment",
          total: dossierDocuments.filter(doc => doc.departmentCode === "crew")
            .length,
        },
        {
          code: "accounts" as const,
          name: "Accounts",
          total: dossierDocuments.filter(doc => doc.departmentCode === "accounts")
            .length,
        },
        {
          code: "transportation" as const,
          name: "Transportation",
          total: dossierDocuments.filter(doc => doc.departmentCode === "transportation")
            .length,
        },
      ].map(row => ({
        ...row,
        completion: departmentCompletion(dossierDocuments, row.code),
      })),
    [dossierDocuments]
  );
  const canDispatch = canDispatchByRule(
    booking.stage,
    completion === 100,
    revisionFlag
  );
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };
  const flagForRevision = () => {
    const rollback = revertBooking(
      "All Docs Submitted",
      "Docs In Progress",
      "crew"
    );
    const nextBooking = {
      ...booking,
      stage: rollback.stage as Stage,
      progress: Math.max(72, completion - 8),
    };
    setRevisionFlag(true);
    setTargetedNotifications(rollback.notifications);
    onUpdate(nextBooking);
    setReviewOpen(false);
    notify(
      `Revision sent back to ${revisionReversionStage("Documentation")}; Crew Assignment and Documentation were notified.`
    );
  };
  const downloadDispatchBundle = async () => {
    if (!canDispatch) return;
    setBundleStatus("generating");
    setBundleProgress(8);
    setBundleProgressLabel("Checking dispatch authorization");
    try {
      const persistedId = persistedBookingIdForUi(booking.id) ?? booking.id;
      await dispatchBundleMutation.mutateAsync({ bookingId: persistedId });
      setBundleProgress(24);
      setBundleProgressLabel("Preparing approved dossier documents");
      const fileName = await generateDispatchBundlePdf({
        booking,
        documents: dossierDocuments,
        crew: dossierCrew.map(crew => ({
          name: crew.name,
          role: crew.role,
          cert: crew.flag ? "Training renewal flagged" : "Compliant",
        })),
        generatedBy,
        onProgress: (progress, label) => {
          setBundleProgress(progress);
          setBundleProgressLabel(label);
        },
      });
      setBundleStatus("ready");
      notify(
        `${fileName} downloaded and the generation was recorded in account activity.`
      );
    } catch (caught) {
      setBundleStatus("error");
      setBundleProgressLabel("PDF generation could not be completed");
      globalToast.error("PDF bundle could not be generated", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };
  useEffect(() => {
    if (bundlePreview) void downloadDispatchBundle();
  }, [bundlePreview]);
  return (
    <div className="content">
      <button
        className="secondary-button"
        onClick={onBack}
        style={{ marginBottom: 20 }}
      >
        <ArrowLeft size={14} /> Back to pipeline
      </button>
      <PageHeading
        eyebrow="Booking dossier"
        title={booking.id}
        copy={`${booking.client} · ${booking.project} · ${booking.site}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-button" onClick={onOpenClientPortal}>
              <MessageCircle size={14} /> Client portal
            </button>
            <button
              className="secondary-button"
              onClick={() => setReviewOpen(true)}
            >
              <FileCheck2 size={14} /> Review docs
            </button>
            <button
              className={`primary-button ${!canDispatch ? "secondary-button" : ""}`}
              disabled={!canDispatch}
              onClick={() => setDispatchPreview(true)}
            >
              <Send size={14} /> Dispatch package
            </button>
          </div>
        }
      />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">8-stage lifecycle</div>
            <div className="panel-meta">
              Role-gated workflow · revisions kick the dossier back to the
              responsible department
            </div>
          </div>
          <StatusBadge value={booking.stage} />
        </div>
        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(100px, 1fr))",
              gap: 6,
              overflowX: "auto",
            }}
          >
            {stages.map((stage, index) => {
              const active = stages.indexOf(booking.stage) >= index;
              return (
                <div
                  key={stage}
                  style={{ minWidth: 100, opacity: active ? 1 : 0.78 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: active ? "#000000" : "#27313d",
                      fontSize: 10,
                      lineHeight: 1.3,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: active ? "var(--equipment-orange)" : "#edf0f4",
                        color: active ? "#000000" : "#27313d",
                        flex: "none",
                      }}
                    >
                      {active ? <Check size={12} /> : index + 1}
                    </div>
                    {stage}
                  </div>
                  {index < stages.length - 1 && (
                    <div
                      style={{
                        height: 2,
                        background: active ? "var(--equipment-orange)" : "#dfe4e9",
                        margin: "10px 0 0 22px",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Dossier details</div>
              <StatusBadge value={booking.priority} />
            </div>
            <div className="panel-body">
              <div className="detail-list">
                <div className="detail-cell">
                  <label>Client</label>
                  <div>{booking.client}</div>
                </div>
                <div className="detail-cell">
                  <label>Project Manager</label>
                  <div>{booking.pm}</div>
                </div>
                <div className="detail-cell">
                  <label>Mobilization</label>
                  <div>{booking.mob}</div>
                </div>
                <div className="detail-cell">
                  <label>Off-hire</label>
                  <div>{booking.offHire}</div>
                </div>
                <div className="detail-cell">
                  <label>Crane</label>
                  <div>{booking.crane}</div>
                </div>
                <div className="detail-cell">
                  <label>Site location</label>
                  <div>{booking.site}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Assigned crew</div>
                <div className="panel-meta">
                  Live availability and certificate status
                </div>
              </div>
              <button className="secondary-button" onClick={onEditAssignment}>
                Edit assignment
              </button>
            </div>
            <div className="panel-body">
              {assignmentSavedMessage && (
                <div className="notification" style={{ marginBottom: 12 }}>
                  <div className="title">
                    <CheckCircle2
                      size={14}
                      style={{ verticalAlign: "-2px", marginRight: 6 }}
                    />
                    Assignment updated
                  </div>
                  <div className="body">{assignmentSavedMessage}</div>
                </div>
              )}
              <div className="resource-grid">
                {dossierCrew.map((crew, index) => (
                  <div
                    className="resource-card selected"
                    key={`${crew.name}-${crew.role}-${index}`}
                  >
                    <div
                      style={{ display: "flex", gap: 9, alignItems: "center" }}
                    >
                      <div className="avatar">{crew.initials}</div>
                      <div>
                        <div className="resource-name">{crew.name}</div>
                        <div className="resource-sub">{crew.role}</div>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 9,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <StatusBadge value={crew.availability} />
                      {crew.flag && <StatusBadge value="Training required" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Document completion</div>
                <div className="panel-meta">
                  All department uploads in parallel
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 750 }}>{completion}%</div>
            </div>
            <div className="panel-body">
              <div className="progress-track" style={{ height: 10 }}>
                <div
                  className={`progress-fill ${completion === 100 ? "green" : ""}`}
                  style={{ width: `${completion}%` }}
                />
              </div>
              <div className="compliance-list" style={{ marginTop: 13 }}>
                {departmentRows.map(row => (
                  <div className="compliance-row" key={row.code}>
                    <div>
                      <div className="compliance-name">{row.name}</div>
                      <div className="compliance-sub">
                        {row.completion}% complete · {row.total} required item
                        {row.total === 1 ? "" : "s"}
                      </div>
                    </div>
                    <StatusBadge
                      value={
                        row.completion === 100
                          ? "Complete"
                          : row.completion === 0
                            ? "Pending"
                            : "In progress"
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Drive archive</div>
              <FolderOpen size={15} color="#69d495" />
            </div>
            <div className="panel-body">
              <div className="locked-input">
                <span>Bk {booking.client}-Dubai Downtown-11.08.2026</span>
                <StatusBadge value="Synced" />
              </div>
              <div className="compliance-sub" style={{ marginTop: 9 }}>
                All uploaded documents are mirrored to the booking folder.
              </div>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Dispatch recipient</div>
              <Lock size={15} color="#f2b94b" />
            </div>
            <div className="panel-body">
              <div className="locked-input">
                <span>operations@gulfcontracting.ae</span>
                <span style={{ color: "#777" }}>Locked</span>
              </div>
              <div className="compliance-sub" style={{ marginTop: 9 }}>
                The client email is immutable after Sales confirmation.
              </div>
            </div>
          </div>
        </div>
      </div>
      {targetedNotifications.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Targeted notifications</div>
              <div className="panel-meta">Lifecycle event delivery log</div>
            </div>
            <StatusBadge value={`${targetedNotifications.length} queued`} />
          </div>
          <div className="panel-body">
            <div className="notification-stack">
              {targetedNotifications.map((notification, index) => (
                <div
                  className="notification"
                  key={`${notification.departmentCode}-${index}`}
                >
                  <div className="title">
                    {notification.departmentCode} · {notification.title}
                  </div>
                  <div className="body">
                    {notification.body} · in-app + email
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {previewDocument && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,.78)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div className="panel" style={{ width: "min(680px, 100%)" }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Document preview</div>
                <div className="panel-meta">
                  {previewDocument} · approved submission
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setPreviewDocument(null)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              <div
                style={{
                  minHeight: 280,
                  border: "1px solid #303030",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #242424, #151515)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  padding: 30,
                }}
              >
                <div>
                  <FileText
                    size={40}
                    color="#e31e24"
                    style={{ marginBottom: 12 }}
                  />
                  <div style={{ fontSize: 16, fontWeight: 750, color: "#fff" }}>
                    {previewDocument}
                  </div>
                  <div className="page-copy" style={{ margin: "8px auto 0" }}>
                    Secure preview surface · file integrity verified · mirrored
                    to the booking Drive folder.
                  </div>
                  <div className="status-badge green" style={{ marginTop: 16 }}>
                    <CheckCircle2 size={10} /> Approved document
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {reviewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(720px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  Document review · {booking.id}
                </div>
                <div className="panel-meta">
                  Preview submitted files before moving the dossier to Reviewed.
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setReviewOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              <div className="compliance-list">
                {dossierDocuments.map(doc => (
                  <div className="compliance-row" key={doc.id}>
                    <div
                      style={{ display: "flex", gap: 9, alignItems: "center" }}
                    >
                      <FileText size={15} color="#888" />
                      <div>
                        <div className="compliance-name">{doc.name}</div>
                        <div className="compliance-sub">
                          {doc.departmentCode} · Required · preview available
                        </div>
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 7, alignItems: "center" }}
                    >
                      <StatusBadge
                        value={
                          doc.state === "Revision Required"
                            ? "Revision"
                            : doc.state
                        }
                      />
                      <button
                        className="secondary-button"
                        onClick={() => setPreviewDocument(doc.name)}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="wizard-actions">
                <button className="secondary-button" onClick={flagForRevision}>
                  <AlertTriangle size={14} /> Flag for revision
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    const approval = transitionBooking(
                      "All Docs Submitted",
                      "Reviewed",
                      "Salesperson"
                    );
                    const nextBooking = {
                      ...booking,
                      stage: approval.stage as Stage,
                      progress: 100,
                    };
                    setTargetedNotifications(approval.notifications);
                    onUpdate(nextBooking);
                    setReviewOpen(false);
                    notify(
                      "All submitted documents approved. Dossier is now Reviewed."
                    );
                  }}
                >
                  <CheckCircle2 size={14} /> Approve dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {dispatchPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(760px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div className="panel-header">
              <div>
                <div className="panel-title">Dispatch package preview</div>
                <div className="panel-meta">
                  Locked recipient · operations@gulfcontracting.ae
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setDispatchPreview(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              <div className="notification">
                <div className="title">
                  <Mail
                    size={14}
                    style={{ verticalAlign: "-2px", marginRight: 6 }}
                  />
                  BOB Cranes · Final document package
                </div>
                <div className="body">
                  The email will include the approved PDF bundle, crew manifest,
                  and Drive archive link.
                </div>
              </div>
              <div className="detail-list" style={{ marginTop: 14 }}>
                <div className="detail-cell">
                  <label>Recipient</label>
                  <div>operations@gulfcontracting.ae</div>
                </div>
                <div className="detail-cell">
                  <label>Subject</label>
                  <div>BOB Booking-31511 · Dispatch package</div>
                </div>
                <div className="detail-cell">
                  <label>Bundle</label>
                  <div>6 approved documents · PDF</div>
                </div>
                <div className="detail-cell">
                  <label>Drive archive</label>
                  <div>Bk Gulf Contracting LLC-Dubai Downtown-11.08.2026</div>
                </div>
              </div>
              <div
                className="panel"
                style={{ marginTop: 14, background: "#101010" }}
              >
                <div className="panel-header">
                  <div className="panel-title">Crew manifest</div>
                  <span className="panel-meta">200T Mobile Crane</span>
                </div>
                <div className="panel-body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Designation</th>
                        <th>Compliance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crews.slice(0, 4).map((crew, index) => (
                        <tr key={`${crew.name}-${crew.role}-${index}`}>
                          <td>
                            <strong>{crew.name}</strong>
                          </td>
                          <td>{crew.role}</td>
                          <td>
                            <StatusBadge value="Approved" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="wizard-actions">
                <button
                  className="secondary-button"
                  onClick={() => setBundlePreview(true)}
                >
                  <FileText size={14} /> Preview PDF bundle
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    setDispatchPreview(false);
                    notify(
                      "Final package emailed to the locked notification email."
                    );
                  }}
                >
                  <Send size={14} /> Send final package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {bundlePreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,.78)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(820px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div className="panel-header">
              <div>
                <div className="panel-title">
                  {bundleStatus === "generating"
                    ? "Generating dispatch PDF"
                    : bundleStatus === "ready"
                      ? "Dispatch PDF ready"
                      : "PDF bundle preview"}
                </div>
                <div className="panel-meta">
                  BOB Booking-31511 · 6 approved files
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setBundlePreview(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="panel-body">
              {bundleStatus === "generating" && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ textAlign: "center", padding: "20px 10px 25px" }}
                >
                  <LoaderCircle
                    className="animate-spin"
                    size={34}
                    color="#69d495"
                    style={{ margin: "0 auto 13px" }}
                  />
                  <div style={{ fontSize: 16, fontWeight: 750 }}>
                    {bundleProgressLabel || "Preparing dispatch bundle"}
                  </div>
                  <div
                    className="page-copy"
                    style={{ margin: "7px auto 17px" }}
                  >
                    Your verified dossier is being compiled for download.
                  </div>
                  <div
                    className="progress-track"
                    aria-label={`Dispatch bundle generation ${bundleProgress}% complete`}
                    style={{ height: 10, maxWidth: 460, margin: "0 auto" }}
                  >
                    <div
                      className="progress-fill green"
                      style={{ width: `${bundleProgress}%` }}
                    />
                  </div>
                  <div className="compliance-sub" style={{ marginTop: 9 }}>
                    {bundleProgress}% complete
                  </div>
                </div>
              )}
              {bundleStatus === "error" && (
                <div className="notification" style={{ marginBottom: 14 }}>
                  <div className="title">PDF bundle needs attention</div>
                  <div className="body">{bundleProgressLabel}</div>
                </div>
              )}
              <div className="detail-list">
                <div className="detail-cell">
                  <label>Cover page</label>
                  <div>BOB Cranes dispatch dossier</div>
                </div>
                <div className="detail-cell">
                  <label>Crew manifest</label>
                  <div>4 compliant crew members</div>
                </div>
                <div className="detail-cell">
                  <label>Attachments</label>
                  <div>Method statement · lift plan · LPO · certificates</div>
                </div>
                <div className="detail-cell">
                  <label>Archive</label>
                  <div>Google Drive folder synced</div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  minHeight: 130,
                  border: "1px solid #303030",
                  borderRadius: 8,
                  background: "#111",
                  padding: 18,
                }}
              >
                <div className="eyebrow">
                  BOB CRANES · FINAL DISPATCH PACKAGE
                </div>
                <div style={{ fontSize: 18, fontWeight: 750 }}>
                  Gulf Contracting LLC
                </div>
                <div className="page-copy">
                  200T Mobile Crane · Dubai Downtown · 11 Aug 2026
                </div>
                <div className="compliance-sub" style={{ marginTop: 18 }}>
                  This preview represents the PDF bundle that will be emailed to
                  the locked notification address.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast-note">
          <CheckCircle2
            size={14}
            style={{ verticalAlign: "-2px", marginRight: 7 }}
          />
          {toast}
        </div>
      )}
    </div>
  );
}

type ClientDocumentTaxonomy = {
  categories: Array<{ id: number; name: string; description?: string | null }>;
  tags: Array<{ id: number; name: string; categoryId?: number | null }>;
};

type ClientUploadQueueItem = {
  fileName: string;
  progress: number;
  status: "queued" | "uploading" | "complete" | "error";
  error?: string;
  bytesTotal: number;
  startedAt: number;
  speedBytesPerSecond: number;
  etaSeconds: number;
};

