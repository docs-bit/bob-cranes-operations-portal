import { useMemo } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock3, CloudUpload, FileCheck2, FileText } from "lucide-react";
import { type Booking } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { MetricCard, StatusBadge } from "./primitives";
import { TrainingFlagsInbox } from "./TrainingFlagsInbox";
import {
  DEPARTMENTS,
  departmentCompletion,
  type DocumentItem,
} from "@shared/bookingRules";

export function DocsView({
  bookings,
  documents,
  setDetail,
  actorRole,
  actorDepartment,
}: {
  bookings: Booking[];
  documents: DocumentItem[];
  setDetail: (booking: Booking) => void;
  actorRole: string;
  actorDepartment: string | null;
}) {
  const required = useMemo(
    () => documents.filter(document => document.required),
    [documents]
  );
  const completeCount = useMemo(
    () =>
      required.filter(
        document =>
          document.state === "Uploaded" || document.state === "Approved"
      ).length,
    [required]
  );
  const revisionCount = useMemo(
    () =>
      documents.filter(document => document.state === "Revision Required")
        .length,
    [documents]
  );
  const overall = required.length
    ? Math.round((completeCount / required.length) * 100)
    : 100;

  const departmentRows = useMemo(
    () =>
      DEPARTMENTS.filter(
        department =>
          department.code !== "administrator" &&
          documents.some(item => item.departmentCode === department.code)
      ).map(department => {
        const items = documents.filter(
          item => item.departmentCode === department.code
        );
        const requiredItems = items.filter(item => item.required);
        const doneItems = requiredItems.filter(
          item => item.state === "Uploaded" || item.state === "Approved"
        );
        const blocker =
          items.find(
            item =>
              item.state === "Revision Required" || item.state === "Required"
          )?.name ?? "—";
        return {
          code: department.code,
          name: department.name,
          complete: departmentCompletion(documents, department.code),
          items: `${doneItems.length} / ${requiredItems.length}`,
          blocker,
        };
      }),
    [documents]
  );

  const reviewQueue = useMemo(
    () =>
      bookings.filter(
        booking =>
          booking.stage === "All Docs Submitted" ||
          booking.stage === "Reviewed"
      ),
    [bookings]
  );

  return (
    <div className="content">
      <PageHeading
        eyebrow="Compliance control"
        title="Documents & compliance"
        copy="Parallel completion tracking across every department. A dossier cannot be dispatched while a required item is missing, expired, or flagged."
        action={
          <button
            className="secondary-button"
            onClick={() =>
              bookings[0]
                ? setDetail(bookings[0])
                : toast.info("No dossier available", {
                    description:
                      "Create or import a booking before attaching documents.",
                  })
            }
          >
            <CloudUpload size={14} /> Upload document
          </button>
        }
      />
      <div className="metric-grid">
        <MetricCard
          label="Required documents"
          value={String(required.length)}
          foot={`${completeCount} uploaded or approved`}
          icon={<FileText size={13} />}
        />
        <MetricCard
          label="Overall completion"
          value={`${overall}%`}
          foot={
            overall === 100
              ? "Ready for review"
              : "Departments still uploading"
          }
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Revision flags"
          value={String(revisionCount).padStart(2, "0")}
          foot="Sent back to departments"
          icon={<AlertTriangle size={13} />}
        />
        <MetricCard
          label="Dossiers awaiting review"
          value={String(reviewQueue.length).padStart(2, "0")}
          foot="All docs submitted or reviewed"
          icon={<Clock3 size={13} />}
        />
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Department completion</div>
              <div className="panel-meta">
                Live checklist across {required.length} required documents
              </div>
            </div>
            <StatusBadge value={`${overall}% complete`} />
          </div>
          <div className="panel-body">
            {departmentRows.length === 0 ? (
              <div className="empty-state">
                No department documents are tracked yet.
              </div>
            ) : (
              <div className="compliance-list">
                {departmentRows.map(row => (
                  <div key={row.code} className="compliance-row">
                    <div style={{ minWidth: 160 }}>
                      <div className="compliance-name">{row.name}</div>
                      <div className="compliance-sub">
                        {row.items} documents · {row.blocker}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${row.complete === 100 ? "green" : row.complete < 70 ? "amber" : ""}`}
                          style={{ width: `${row.complete}%` }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        width: 42,
                        textAlign: "right",
                        fontSize: 11,
                        color: row.complete === 100 ? "#69d495" : "#ddd",
                      }}
                    >
                      {row.complete}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Ready for review</div>
            <FileCheck2 size={15} color="#69d495" />
          </div>
          <div className="panel-body">
            {reviewQueue.length === 0 ? (
              <div className="empty-state">
                No dossier is waiting for review. Dossiers appear here once
                all departments reach 100%.
              </div>
            ) : (
              reviewQueue.map(booking => (
                <div
                  className="activity-item"
                  key={`activity-${booking.id}`}
                  onClick={() => setDetail(booking)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="activity-dot"
                    style={{ background: "#31b56b" }}
                  />
                  <div>
                    <div className="activity-text">
                      <strong>{booking.id}</strong>
                      <br />
                      {booking.client}
                    </div>
                    <div className="activity-time">
                      {booking.progress}% complete · Open review
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <TrainingFlagsInbox
        actorRole={actorRole}
        actorDepartment={actorDepartment}
      />
    </div>
  );
}
