import { useMemo } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, CloudUpload, FileCheck2, FileText, FolderOpen, Lock, Users } from "lucide-react";
import { type Booking } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { MetricCard, StatusBadge } from "./primitives";

export function DocsView({
  bookings,
  setDetail,
}: {
  bookings: Booking[];
  setDetail: (booking: Booking) => void;
}) {
  const docRows = [
    {
      department: "Documentation",
      complete: 92,
      items: "11 / 12",
      blocker: "Signed method statement",
    },
    { department: "HSE / Safety", complete: 100, items: "8 / 8", blocker: "—" },
    {
      department: "Crew Assignment",
      complete: 75,
      items: "6 / 8",
      blocker: "Vijayakumar renewal",
    },
    {
      department: "Lifting Gears",
      complete: 100,
      items: "9 / 9",
      blocker: "—",
    },
    {
      department: "Accounts",
      complete: 60,
      items: "3 / 5",
      blocker: "LPO Rev. 2",
    },
    {
      department: "Transportation",
      complete: 80,
      items: "4 / 5",
      blocker: "Delivery note",
    },
  ];
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
          label="Documents in flight"
          value="46"
          foot="Across 9 active dossiers"
          icon={<FileText size={13} />}
        />
        <MetricCard
          label="100% complete"
          value="03"
          foot="Ready for review"
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Revision flags"
          value="04"
          foot="Kick-backs this week"
          icon={<AlertTriangle size={13} />}
        />
        <MetricCard
          label="Expiring soon"
          value="06"
          foot="HSE notified automatically"
          icon={<Clock3 size={13} />}
        />
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Department completion</div>
              <div className="panel-meta">
                BOB Booking-31511 · Gulf Contracting LLC
              </div>
            </div>
            <StatusBadge value="Docs In Progress" />
          </div>
          <div className="panel-body">
            <div className="compliance-list">
              {docRows.map(row => (
                <div key={row.department} className="compliance-row">
                  <div style={{ minWidth: 160 }}>
                    <div className="compliance-name">{row.department}</div>
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
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Ready for review</div>
            <FileCheck2 size={15} color="#69d495" />
          </div>
          <div className="panel-body">
            {bookings
              .filter(
                booking =>
                  booking.stage === "All Docs Submitted" ||
                  booking.stage === "Reviewed"
              )
              .map((booking, index) => (
                <div
                  className="activity-item"
                  key={`activity-${booking.id}-${index}`}
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
                      {booking.progress}% complete · Open review{" "}
                      <ArrowRight size={10} style={{ verticalAlign: "-1px" }} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

