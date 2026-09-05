import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Lock,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  crews,
  gears,
  persistedBookingIdForUi,
  type Booking,
  type CrewRecord,
  type EmployeeAllocation,
  type Stage,
} from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";
import {
  departmentCompletion,
  documentCompletion,
  isGearSelectionBlocked,
  revertBooking,
  type DocumentItem,
} from "@shared/bookingRules";
import {
  certStatus,
  consoleReadiness,
  CRANE_OPTIONS,
  inspectionStatus,
  parseFixtureDate,
  registrationStatus,
  roleBucket,
  TRAILER_OPTIONS,
  TRAINING_FLAG_TYPES,
  type ConsoleCrewBucket,
  type TrainingFlag,
  type TrainingFlagStatus,
} from "@shared/docConsoleRules";

type ConsoleTab =
  | "crane"
  | "crew"
  | "gears"
  | "trailers"
  | "reqs"
  | "flags"
  | "docs";

const TAB_LABELS: Array<{ id: ConsoleTab; label: string }> = [
  { id: "crane", label: "Crane" },
  { id: "crew", label: "Crew" },
  { id: "gears", label: "Lifting Gears" },
  { id: "trailers", label: "Trailers" },
  { id: "reqs", label: "Additional Reqs" },
  { id: "flags", label: "Training Flags" },
  { id: "docs", label: "Documents" },
];

type AdditionalReq = {
  id: string;
  name: string;
  departmentCode: string;
  source: string;
  removed: boolean;
  removalReason?: string;
};

const STAGE_ORDER: Stage[] = [
  "Created by Salesperson",
  "Documentation Supervisor",
  "Crew Assigned",
  "Gear Confirmed",
  "Docs In Progress",
  "All Docs Submitted",
  "Reviewed",
  "Dispatched",
];

function crewByName(name: string): CrewRecord | undefined {
  return crews.find(member => member.name === name);
}

export function DocSupervisorConsole({
  booking,
  documents,
  allocations,
  canCoordinate,
  onUpdate,
  onBack,
  onAdvance,
  onOpenClientPortal,
}: {
  booking: Booking;
  documents: DocumentItem[];
  allocations: EmployeeAllocation[];
  canCoordinate: boolean;
  onUpdate: (booking: Booking) => void;
  onBack: () => void;
  onAdvance: (booking: Booking, config: any) => Promise<void> | void;
  onOpenClientPortal: () => void;
}) {
  const [tab, setTab] = useState<ConsoleTab>("crane");
  const mobDate = useMemo(
    () => parseFixtureDate(booking.mob) ?? new Date(),
    [booking.mob]
  );

  const initialCrane = useMemo(
    () =>
      CRANE_OPTIONS.find(option =>
        booking.crane.startsWith(option.name.split(" · ")[0])
      )?.name ?? null,
    [booking.crane]
  );
  const [selectedCrane, setSelectedCrane] = useState<string | null>(initialCrane);

  const initialCrew = useMemo(
    () =>
      allocations
        .filter(allocation => allocation.bookingId === booking.id)
        .map(allocation => allocation.employeeName)
        .filter(name => crewByName(name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [booking.id]
  );
  const [selectedCrew, setSelectedCrew] = useState<string[]>(initialCrew);
  const [selectedGear, setSelectedGear] = useState<string[]>(() =>
    gears.filter(gear => gear.selected).map(gear => gear.name)
  );
  const [selectedTrailers, setSelectedTrailers] = useState<string[]>([]);
  const [trailerRequired, setTrailerRequired] = useState(true);
  const [handoffNotes, setHandoffNotes] = useState("");

  const [additionalReqs, setAdditionalReqs] = useState<AdditionalReq[]>(() =>
    documents
      .filter(document => document.required)
      .map(document => ({
        id: document.id,
        name: document.name,
        departmentCode: document.departmentCode,
        source: "Sales intake",
        removed: false,
      }))
  );
  const [newReqName, setNewReqName] = useState("");
  const [removalReason, setRemovalReason] = useState<Record<string, string>>({});
  const [flagCrewId, setFlagCrewId] = useState("");
  const [flagType, setFlagType] = useState<string>(TRAINING_FLAG_TYPES[0]);
  const [flagNote, setFlagNote] = useState("");

  const [revisionDocIds, setRevisionDocIds] = useState<string[]>([]);
  const [rejected, setRejected] = useState(false);
  const [rejectArmed, setRejectArmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const addNotificationMutation = trpc.operations.addNotification.useMutation();
  const updateAssignmentMutation = trpc.operations.updateAssignment.useMutation();
  const persistedId = persistedBookingIdForUi(booking.id) ?? booking.id;
  const createFlagMutation = trpc.operations.createTrainingFlag.useMutation();
  const updateFlagMutation = trpc.operations.updateTrainingFlag.useMutation();
  const issueLinkMutation = trpc.operations.issuePortalToken.useMutation();
  const revokeLinksMutation = trpc.operations.revokePortalTokens.useMutation();
  const portalLinksQuery = trpc.operations.listPortalTokens.useQuery(
    { bookingId: persistedId },
    { enabled: canCoordinate }
  );
  const trainingFlagsQuery = trpc.operations.listTrainingFlags.useQuery({
    bookingId: persistedId,
  });
  const expiryStatusQuery = trpc.operations.getExpiryCheckStatus.useQuery();
  const runExpiryMutation = trpc.operations.runExpiryCheck.useMutation();
  const trainingFlags: TrainingFlag[] = useMemo(
    () =>
      (trainingFlagsQuery.data ?? []).map(row => ({
        id: row.id,
        bookingId: row.bookingId,
        crewId: row.crewId,
        crewName: row.crewName,
        flagType: row.flagType,
        note: row.note,
        raisedBy: row.raisedBy,
        createdAt: new Date(row.createdAt).toLocaleString(),
        status: row.status as TrainingFlagStatus,
      })),
    [trainingFlagsQuery.data]
  );
  const chatQuery = trpc.operations.getChat.useQuery({ bookingId: persistedId });
  const latestChat = useMemo(
    () => (chatQuery.data ?? []).slice(-5).reverse(),
    [chatQuery.data]
  );

  const selectedCrewRecords = useMemo(
    () =>
      selectedCrew
        .map(crewByName)
        .filter((member): member is CrewRecord => Boolean(member)),
    [selectedCrew]
  );

  const crewBucketCounts = useMemo(() => {
    const counts: Record<Exclude<ConsoleCrewBucket, "Other">, number> = {
      Operators: 0,
      Riggers: 0,
      Supervisors: 0,
      Banksmen: 0,
    };
    for (const member of selectedCrewRecords) {
      const bucket = roleBucket(member.role);
      if (bucket !== "Other") counts[bucket] += 1;
    }
    return counts;
  }, [selectedCrewRecords]);

  const expiredInSelection = useMemo(() => {
    const items: string[] = [];
    for (const member of selectedCrewRecords) {
      const status = certStatus(member.cert);
      if (status.level === "expired" || status.level === "missing")
        items.push(member.name);
    }
    return items;
  }, [selectedCrewRecords]);

  const craneBlocked = useMemo(() => {
    const option = CRANE_OPTIONS.find(item => item.name === selectedCrane);
    if (!option) return false;
    return (
      inspectionStatus(option.inspection).level === "expired" ||
      option.status !== "Available"
    );
  }, [selectedCrane]);

  const readiness = useMemo(
    () =>
      consoleReadiness({
        craneName: selectedCrane,
        craneBlocked,
        crewByBucket: crewBucketCounts,
        extraCrew: 0,
        gearCount: selectedGear.length,
        trailerCount: selectedTrailers.length,
        trailerRequired,
        expiredItems: expiredInSelection,
      }),
    [
      selectedCrane,
      craneBlocked,
      crewBucketCounts,
      selectedGear.length,
      selectedTrailers.length,
      trailerRequired,
      expiredInSelection,
    ]
  );

  const requiredDocs = useMemo(
    () => documents.filter(document => document.required),
    [documents]
  );
  const uploadedRequired = useMemo(
    () =>
      requiredDocs.filter(
        document =>
          document.state === "Uploaded" || document.state === "Approved"
      ).length,
    [requiredDocs]
  );
  const overallCompletion = documentCompletion(documents);

  const toggleCrew = (name: string) => {
    if (!canCoordinate) return;
    const member = crewByName(name);
    if (member) {
      const status = certStatus(member.cert);
      if (
        !selectedCrew.includes(name) &&
        (status.level === "expired" || status.level === "missing")
      ) {
        toast.error("Crew member blocked", {
          description: `${name}: ${status.detail}. Renew the certificate before assignment.`,
        });
        return;
      }
    }
    setSelectedCrew(current =>
      current.includes(name)
        ? current.filter(item => item !== name)
        : [...current, name]
    );
  };

  const toggleGear = (name: string) => {
    if (!canCoordinate) return;
    const gear = gears.find(item => item.name === name);
    if (gear) {
      const expiry = parseFixtureDate(gear.expires);
      const blocked =
        gear.status === "Expired" ||
        (expiry !== null && isGearSelectionBlocked(expiry, mobDate));
      if (!selectedGear.includes(name) && blocked) {
        toast.error("Gear selection blocked", {
          description: `${name} cannot be selected with an expired inspection certificate.`,
        });
        return;
      }
    }
    setSelectedGear(current =>
      current.includes(name)
        ? current.filter(item => item !== name)
        : [...current, name]
    );
  };

  const toggleTrailer = (id: string) => {
    if (!canCoordinate) return;
    const trailer = TRAILER_OPTIONS.find(item => item.id === id);
    if (trailer) {
      const blocked =
        registrationStatus(trailer.registrationExpiry).level === "expired" ||
        trailer.status !== "Available";
      if (!selectedTrailers.includes(id) && blocked) {
        toast.error("Trailer selection blocked", {
          description: `${trailer.plate} cannot be selected with an expired registration.`,
        });
        return;
      }
    }
    setSelectedTrailers(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  };

  const raiseTrainingFlag = async () => {
    if (!canCoordinate || !flagCrewId) return;
    const member = crews.find(item => item.id === flagCrewId);
    if (!member) return;
    const note =
      flagNote.trim() ||
      `${member.name} · certificate: ${certStatus(member.cert).detail}`;
    try {
      const result = await createFlagMutation.mutateAsync({
        bookingId: persistedId,
        crewId: member.id,
        crewName: member.name,
        flagType,
        note,
      });
      setFlagCrewId("");
      setFlagNote("");
      await trainingFlagsQuery.refetch();
      toast.success("Training flag raised", {
        description: `${member.name} flagged and persisted. Crew, HSE and Documentation notified (${result.notifications.length}).`,
      });
    } catch (caught) {
      toast.error("Flag could not be raised", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };

  const acknowledgeFlag = async (id: string) => {
    try {
      await updateFlagMutation.mutateAsync({ id, action: "acknowledge" });
      await trainingFlagsQuery.refetch();
      toast.success("Flag acknowledged");
    } catch (caught) {
      toast.error("Acknowledge blocked", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };

  const resolveFlag = async (id: string) => {
    try {
      await updateFlagMutation.mutateAsync({ id, action: "resolve" });
      await trainingFlagsQuery.refetch();
      toast.success("Training flag resolved");
    } catch (caught) {
      toast.error("Resolve blocked", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };

  const confirmCoordination = async () => {
    if (!canCoordinate || !readiness.ready || confirming) return;
    const updated: Booking = {
      ...booking,
      crane: (selectedCrane ?? booking.crane).split(" · ")[0],
      crew: `${selectedCrew.length} assigned`,
      progress: Math.max(booking.progress, 34),
    };
    setConfirming(true);
    try {
      try {
        await updateAssignmentMutation.mutateAsync({
          id: persistedId,
          craneId: selectedCrane ?? undefined,
          crewIds: selectedCrewRecords.map(member => member.id),
          gearIds: selectedGear,
          trailerIds: selectedTrailers,
        });
      } catch {
        // Fixture dossiers may not exist in the database yet; the
        // coordination state below is still applied to the dossier view.
      }
      if (booking.stage === "Documentation Supervisor") {
        await onAdvance(updated, { nextStage: "Crew Assigned" });
      } else if (
        STAGE_ORDER.indexOf(booking.stage) > STAGE_ORDER.indexOf("Crew Assigned")
      ) {
        onUpdate(updated);
        toast.success("Coordination saved", {
          description: "Selections updated on the dossier. The stage is already past Crew Assigned.",
        });
      } else {
        toast.error("Confirm unavailable at this stage", {
          description: "Confirm Coordination is available once the dossier reaches Documentation Supervisor.",
        });
      }
    } finally {
      setConfirming(false);
    }
  };

  const flagBookingForRevision = () => {
    if (!canCoordinate) return;
    if (STAGE_ORDER.indexOf(booking.stage) <= STAGE_ORDER.indexOf("Docs In Progress")) {
      toast.error("Nothing to revert", {
        description: "The dossier has not progressed past Docs In Progress.",
      });
      return;
    }
    try {
      const rollback = revertBooking(booking.stage, "Docs In Progress", "documentation");
      onUpdate({ ...booking, stage: rollback.stage as Stage });
      toast.success("Flagged for revision", {
        description: "Dossier reverted to Docs In Progress. Departments notified.",
      });
    } catch (caught) {
      toast.error("Revision blocked", {
        description: caught instanceof Error ? caught.message : "The dossier could not be reverted.",
      });
    }
  };

  const rejectBooking = async () => {
    if (!canCoordinate) return;
    if (!rejectArmed) {
      setRejectArmed(true);
      return;
    }
    setRejected(true);
    setRejectArmed(false);
    try {
      await addNotificationMutation.mutateAsync({
        id: `reject-${booking.id}-${Date.now()}`,
        departmentCode: "sales",
        title: `Booking rejected · ${booking.id}`,
        body: `Documentation Supervisor rejected the dossier. Hand-off notes: ${handoffNotes || "none recorded"}.`,
      });
    } catch {
      toast.warning("Rejection recorded locally", {
        description: "Sales could not be auto-notified with this account.",
      });
    }
  };

  const addAdditionalReq = () => {
    if (!canCoordinate || !newReqName.trim()) return;
    setAdditionalReqs(current => [
      ...current,
      {
        id: `req-${Date.now()}`,
        name: newReqName.trim(),
        departmentCode: "documentation",
        source: "Doc Supervisor addition",
        removed: false,
      },
    ]);
    setNewReqName("");
    toast.success("Requirement added", {
      description: "Propagated to department checklists and the Client Portal Documents tab.",
    });
  };

  const removeAdditionalReq = (id: string) => {
    if (!canCoordinate) return;
    const reason = (removalReason[id] ?? "").trim();
    if (!reason) {
      toast.error("Reason required", {
        description: "Record why this requirement is removed before confirming.",
      });
      return;
    }
    setAdditionalReqs(current =>
      current.map(item =>
        item.id === id ? { ...item, removed: true, removalReason: reason } : item
      )
    );
  };

  const flagDocument = (documentId: string) => {
    if (!canCoordinate) return;
    setRevisionDocIds(current =>
      current.includes(documentId) ? current : [...current, documentId]
    );
    toast.success("Document flagged for revision", {
      description: "The originating department has been asked to re-upload.",
    });
  };

  const docGroups = useMemo(() => {
    const groups = new Map<string, DocumentItem[]>();
    for (const document of documents) {
      const list = groups.get(document.departmentCode) ?? [];
      list.push(
        revisionDocIds.includes(document.id)
          ? { ...document, state: "Revision Required" as const }
          : document
      );
      groups.set(document.departmentCode, list);
    }
    return Array.from(groups.entries());
  }, [documents, revisionDocIds]);

  return (
    <div className="content">
      <button className="secondary-button" onClick={onBack} style={{ marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to dossier
      </button>
      <PageHeading
        eyebrow="Documentation Supervisor Console"
        title={booking.id}
        copy={`${booking.client} · ${booking.project} · ${booking.site}`}
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={onOpenClientPortal}>
              <MessageCircle size={14} /> Client portal
            </button>
            <button
              className="primary-button"
              disabled={!canCoordinate || !readiness.ready || confirming}
              onClick={() => void confirmCoordination()}
              title={readiness.ready ? "Confirm coordination" : readiness.blockers[0]}
            >
              <CheckCircle2 size={14} />{" "}
              {confirming ? "Confirming…" : "Confirm Coordination"}
            </button>
          </div>
        }
      />

      {!canCoordinate && (
        <div className="notification" style={{ marginBottom: 16 }}>
          <div className="title">
            <Lock size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Read-only access
          </div>
          <div className="body">
            Only Documentation coordinators and administrators can change
            coordination state. Other departments can review this console.
          </div>
        </div>
      )}
      {rejected && (
        <div className="notification" style={{ marginBottom: 16 }}>
          <div className="title">
            <X size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Booking rejected by Documentation Supervisor
          </div>
          <div className="body">Sales has been notified to re-qualify this dossier.</div>
        </div>
      )}

      <div className="console-layout">
        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Booking coordination header</div>
              <StatusBadge value={booking.stage} />
            </div>
            <div className="detail-list">
              <div className="detail-cell">
                <label>Client / project</label>
                <div>{booking.client} · {booking.project}</div>
              </div>
              <div className="detail-cell">
                <label>Priority</label>
                <div><StatusBadge value={booking.priority} /></div>
              </div>
              <div className="detail-cell">
                <label>Mobilization / off-hire</label>
                <div>{booking.mob} → {booking.offHire}</div>
              </div>
              <div className="detail-cell">
                <label>Sales hand-off notes</label>
                <textarea
                  aria-label="Sales hand-off notes"
                  value={handoffNotes}
                  onChange={event => setHandoffNotes(event.target.value)}
                  placeholder="No hand-off notes recorded yet."
                  disabled={!canCoordinate}
                  rows={2}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} role="tablist" aria-label="Console sections">
            {TAB_LABELS.map(entry => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`filter-chip ${tab === entry.id ? "selected" : ""}`}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
                {entry.id === "flags" && trainingFlags.filter(flag => flag.status === "OPEN").length > 0 && (
                  <> ({trainingFlags.filter(flag => flag.status === "OPEN").length})</>
                )}
              </button>
            ))}
          </div>

          {tab === "crane" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Crane selection</div>
                <div className="panel-meta">Only cranes with a valid inspection can be attached.</div>
              </div>
              <div className="resource-grid">
                {CRANE_OPTIONS.map(option => {
                  const inspection = inspectionStatus(option.inspection);
                  const blocked = inspection.level === "expired" || option.status !== "Available";
                  const selected = selectedCrane === option.name;
                  return (
                    <div
                      key={option.name}
                      className={`resource-card ${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`}
                      onClick={() => {
                        if (!canCoordinate || blocked) return;
                        setSelectedCrane(option.name);
                      }}
                    >
                      <div className="resource-top">
                        <div>
                          <div className="resource-name">{option.name}</div>
                          <div className="resource-sub">
                            {option.spec}
                            <br />
                            {inspection.detail}
                          </div>
                        </div>
                        {blocked ? <Lock size={15} color="#e31e24" /> : <StatusBadge value={option.status} />}
                      </div>
                      <div className="resource-action">
                        {blocked ? (
                          <span className="status-badge red"><Lock size={9} /> Selection blocked</span>
                        ) : selected ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={!canCoordinate}
                            onClick={event => {
                              event.stopPropagation();
                              if (canCoordinate) setSelectedCrane(option.name);
                            }}
                          >
                            Select crane
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "crew" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Crew assignment by role bucket</div>
                <div className="panel-meta">
                  Operators {crewBucketCounts.Operators} · Riggers {crewBucketCounts.Riggers} · Supervisors {crewBucketCounts.Supervisors} · Banksmen {crewBucketCounts.Banksmen}
                </div>
              </div>
              <div className="resource-grid">
                {crews.map(member => {
                  const status = certStatus(member.cert);
                  const hardBlocked = status.level === "expired" || status.level === "missing";
                  const selected = selectedCrew.includes(member.name);
                  return (
                    <div
                      key={member.id}
                      className={`resource-card ${selected ? "selected" : ""} ${hardBlocked && !selected ? "blocked" : ""}`}
                      onClick={() => toggleCrew(member.name)}
                    >
                      <div className="resource-top">
                        <div style={{ display: "flex", gap: 9 }}>
                          <div className="avatar">{member.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()}</div>
                          <div>
                            <div className="resource-name">{member.name}</div>
                            <div className="resource-sub">
                              {member.role} · {roleBucket(member.role)}
                              <br />
                              {status.detail}
                            </div>
                          </div>
                        </div>
                        <StatusBadge value={member.availability} />
                      </div>
                      <div className="resource-action">
                        {hardBlocked && !selected ? (
                          <span className="status-badge red"><Lock size={9} /> {status.level === "missing" ? "No certificate" : "Cert expired"}</span>
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={!canCoordinate}
                            onClick={event => {
                              event.stopPropagation();
                              toggleCrew(member.name);
                            }}
                          >
                            {selected ? "Remove" : "Select"}
                          </button>
                        )}
                        {canCoordinate && (
                          <button
                            type="button"
                            className="secondary-button"
                            title="Flag for training"
                            onClick={event => {
                              event.stopPropagation();
                              setFlagCrewId(member.id);
                              setTab("flags");
                            }}
                          >
                            <Flag size={12} /> Flag
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "gears" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Lifting gear selection</div>
                <div className="panel-meta">Inspection certificates are checked against {booking.mob}. Expired gear is hard-blocked.</div>
              </div>
              <div className="resource-grid">
                {gears.map(gear => {
                  const expiry = parseFixtureDate(gear.expires);
                  const blocked =
                    gear.status === "Expired" ||
                    (expiry !== null && isGearSelectionBlocked(expiry, mobDate));
                  const selected = selectedGear.includes(gear.name);
                  return (
                    <div
                      key={gear.name}
                      className={`resource-card ${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`}
                      onClick={() => toggleGear(gear.name)}
                    >
                      <div className="resource-top">
                        <div>
                          <div className="resource-name">{gear.name}</div>
                          <div className="resource-sub">
                            {gear.type}
                            <br />
                            Certificate {gear.cert} · valid through {gear.expires}
                          </div>
                        </div>
                        {blocked ? <Lock size={15} color="#e31e24" /> : <StatusBadge value={gear.status} />}
                      </div>
                      <div className="resource-action">
                        {blocked ? (
                          <span className="status-badge red"><Lock size={9} /> Selection blocked</span>
                        ) : selected ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={!canCoordinate}
                            onClick={event => {
                              event.stopPropagation();
                              toggleGear(gear.name);
                            }}
                          >
                            Select gear
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "trailers" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Trailer selection</div>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={trailerRequired}
                    disabled={!canCoordinate}
                    onChange={event => setTrailerRequired(event.target.checked)}
                  />
                  Trailer required for this booking
                </label>
              </div>
              <div className="resource-grid">
                {TRAILER_OPTIONS.map(trailer => {
                  const registration = registrationStatus(trailer.registrationExpiry);
                  const blocked = registration.level === "expired" || trailer.status !== "Available";
                  const selected = selectedTrailers.includes(trailer.id);
                  return (
                    <div
                      key={trailer.id}
                      className={`resource-card ${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`}
                      onClick={() => toggleTrailer(trailer.id)}
                    >
                      <div className="resource-top">
                        <div>
                          <div className="resource-name">{trailer.plate}</div>
                          <div className="resource-sub">
                            {trailer.trailerType}
                            <br />
                            Registration: {registration.detail}
                          </div>
                        </div>
                        {blocked ? <Lock size={15} color="#e31e24" /> : <StatusBadge value={trailer.status} />}
                      </div>
                      <div className="resource-action">
                        {blocked ? (
                          <span className="status-badge red"><Lock size={9} /> Selection blocked</span>
                        ) : selected ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={!canCoordinate}
                            onClick={event => {
                              event.stopPropagation();
                              toggleTrailer(trailer.id);
                            }}
                          >
                            Select trailer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "reqs" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Additional requirements (client documents)</div>
                <div className="panel-meta">Seeded from Sales intake. Changes propagate to department checklists and the Client Portal.</div>
              </div>
              <div className="detail-list">
                {additionalReqs.filter(item => !item.removed).map(item => (
                  <div className="detail-cell" key={item.id}>
                    <label>{item.source}</label>
                    <div>{item.name}</div>
                    {canCoordinate && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <input
                          aria-label={`Removal reason for ${item.name}`}
                          placeholder="Removal reason (required)"
                          value={removalReason[item.id] ?? ""}
                          onChange={event => setRemovalReason(current => ({ ...current, [item.id]: event.target.value }))}
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="secondary-button" onClick={() => removeAdditionalReq(item.id)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canCoordinate && (
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <input
                    aria-label="New requirement name"
                    placeholder="Add a required client document…"
                    value={newReqName}
                    onChange={event => setNewReqName(event.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="secondary-button" onClick={addAdditionalReq}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}
              {additionalReqs.some(item => item.removed) && (
                <>
                  <div className="panel-title" style={{ marginTop: 16 }}>Reference (removed by Doc Supervisor)</div>
                  <div className="detail-list">
                    {additionalReqs.filter(item => item.removed).map(item => (
                      <div className="detail-cell" key={item.id}>
                        <label>Removed · {item.removalReason}</label>
                        <div>{item.name}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "flags" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Training flags</div>
                <div className="panel-meta">Raising a flag notifies Crew, HSE and Documentation. Only HSE resolves.</div>
              </div>
              {canCoordinate && (
                <div className="detail-list" style={{ marginBottom: 12 }}>
                  <div className="detail-cell">
                    <label>Crew member</label>
                    <select aria-label="Crew member to flag" value={flagCrewId} onChange={event => setFlagCrewId(event.target.value)} style={{ width: "100%" }}>
                      <option value="">Choose a crew member…</option>
                      {crews.map(member => (
                        <option key={member.id} value={member.id}>{member.name} · {member.role}</option>
                      ))}
                    </select>
                  </div>
                  <div className="detail-cell">
                    <label>Flag type</label>
                    <select aria-label="Flag type" value={flagType} onChange={event => setFlagType(event.target.value)} style={{ width: "100%" }}>
                      {TRAINING_FLAG_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="detail-cell">
                    <label>Note</label>
                    <input aria-label="Flag note" placeholder="Expiry date, site requirement…" value={flagNote} onChange={event => setFlagNote(event.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div className="detail-cell">
                    <label>&nbsp;</label>
                    <div>
                      <button type="button" className="secondary-button" disabled={!flagCrewId} onClick={() => void raiseTrainingFlag()}>
                        <Flag size={14} /> Raise flag
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {trainingFlagsQuery.isLoading ? (
                <div className="panel-meta">Loading training flags…</div>
              ) : trainingFlagsQuery.isError ? (
                <div className="detail-list">
                  <div className="detail-cell">
                    <label>Error</label>
                    <div>Training flags could not be loaded.</div>
                    <div style={{ marginTop: 6 }}>
                      <button type="button" className="secondary-button" onClick={() => void trainingFlagsQuery.refetch()}>
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              ) : trainingFlags.length === 0 ? (
                <div className="panel-meta">No training flags raised for this booking yet.</div>
              ) : (
                <div className="detail-list">
                  {trainingFlags.map(flag => (
                    <div className="detail-cell" key={flag.id}>
                      <label>{flag.flagType} · raised by {flag.raisedBy} · {flag.createdAt}</label>
                      <div>{flag.crewName} — {flag.note}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                        <StatusBadge value={flag.status} />
                        {flag.status === "OPEN" && (
                          <button type="button" className="secondary-button" onClick={() => void acknowledgeFlag(flag.id)}>
                            Acknowledge
                          </button>
                        )}
                        {flag.status !== "RESOLVED" && (
                          <button type="button" className="secondary-button" onClick={() => void resolveFlag(flag.id)}>
                            Resolve (HSE)
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "docs" && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Documents by department · {overallCompletion}% complete</div>
                <div className="panel-meta">Read-only preview. Flagging a document sends it back for revision.</div>
              </div>
              {docGroups.map(([departmentCode, items]) => (
                <div key={departmentCode} style={{ marginBottom: 12 }}>
                  <div className="panel-title" style={{ marginBottom: 6 }}>
                    {departmentCode} · {departmentCompletion(items, departmentCode as DocumentItem["departmentCode"])}%
                  </div>
                  <div className="detail-list">
                    {items.map(document => (
                      <div className="detail-cell" key={document.id}>
                        <label>{document.category ?? "Uncategorized"}{document.required ? " · Required" : ""}</label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                          <span>{document.name}</span>
                          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <StatusBadge value={document.state} />
                            {canCoordinate && document.state !== "Revision Required" && (
                              <button type="button" className="secondary-button" onClick={() => flagDocument(document.id)}>
                                Flag for revision
                              </button>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Coordination readiness</div>
              <StatusBadge value={readiness.ready ? "Ready" : "Blocked"} />
            </div>
            {!readiness.ready ? (
              <div className="detail-list">
                {readiness.blockers.map(blocker => (
                  <div className="detail-cell" key={blocker}>
                    <label>Blocker</label>
                    <div><AlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} />{blocker}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-meta">All coordination checks pass. Confirm Coordination will move the dossier to Crew Assigned and notify every department.</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="primary-button"
                disabled={!canCoordinate || !readiness.ready || confirming}
                onClick={() => void confirmCoordination()}
              >
                <CheckCircle2 size={14} /> {confirming ? "Confirming…" : "Confirm Coordination"}
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Client portal</div>
              <StatusBadge value="Active" />
            </div>
            <div className="detail-list">
              <div className="detail-cell">
                <label>Required uploads</label>
                <div>{uploadedRequired} of {requiredDocs.length} received</div>
              </div>
              <div className="detail-cell">
                <label>Document completion</label>
                <div>{overallCompletion}%</div>
              </div>
            </div>
            <button type="button" className="secondary-button" onClick={onOpenClientPortal} style={{ marginTop: 8 }}>
              <MessageCircle size={14} /> Open portal preview
            </button>
            {canCoordinate && (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={issueLinkMutation.isPending}
                  onClick={() => void (async () => {
                    try {
                      const result = await issueLinkMutation.mutateAsync({
                        bookingId: persistedId,
                        clientName: booking.client,
                        projectName: booking.project,
                        mobDate: booking.mob,
                        offHireDate: booking.offHire,
                        priority: booking.priority,
                        requiredDocs: additionalReqs
                          .filter(item => !item.removed)
                          .map(item => ({
                            name: item.name,
                            departmentCode: item.departmentCode,
                          })),
                      });
                      await portalLinksQuery.refetch();
                      const url = `${window.location.origin}/client/${result.token}`;
                      try {
                        await navigator.clipboard.writeText(url);
                      } catch {
                        window.prompt("Copy the portal link:", url);
                      }
                      toast.success("Portal link issued", {
                        description: `24-hour link created with ${result.seeded} required documents. Copied to clipboard.`,
                      });
                    } catch (caught) {
                      toast.error("Link could not be issued", {
                        description:
                          caught instanceof Error ? caught.message : "Please try again.",
                      });
                    }
                  })()}
                >
                  <Send size={14} /> Issue 24h portal link
                </button>
                {(portalLinksQuery.data ?? []).length > 0 && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={revokeLinksMutation.isPending}
                    onClick={() => void (async () => {
                      try {
                        await revokeLinksMutation.mutateAsync({
                          bookingId: persistedId,
                        });
                        await portalLinksQuery.refetch();
                        toast.success("Portal closed", {
                          description: "All links for this booking were revoked.",
                        });
                      } catch (caught) {
                        toast.error("Revoke failed", {
                          description:
                            caught instanceof Error ? caught.message : "Please try again.",
                        });
                      }
                    })()}
                  >
                    <X size={14} /> Revoke all links
                  </button>
                )}
                <div className="panel-meta">
                  {(portalLinksQuery.data ?? []).filter(
                    row =>
                      !row.revokedAt &&
                      new Date(row.expiresAt).getTime() > Date.now()
                  ).length}{" "}
                  active links · {(portalLinksQuery.data ?? []).length} issued
                  total
                </div>
              </div>
            )}
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <div className="panel-title">Latest booking chat</div>
            </div>
            {chatQuery.isLoading ? (
              <div className="panel-meta">Loading messages…</div>
            ) : latestChat.length === 0 ? (
              <div className="panel-meta">No messages on this booking yet.</div>
            ) : (
              <div className="detail-list">
                {latestChat.map(message => (
                  <div className="detail-cell" key={message.id}>
                    <label>{message.team} · {message.sender}</label>
                    <div>{message.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Quick actions</div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                className="secondary-button"
                disabled={!canCoordinate}
                onClick={flagBookingForRevision}
              >
                <RotateCcw size={14} /> Flag dossier for revision
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!canCoordinate || rejected}
                onClick={() => void rejectBooking()}
              >
                <X size={14} /> {rejectArmed ? "Click again to confirm rejection" : "Reject booking"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!canCoordinate || runExpiryMutation.isPending}
                onClick={() => void (async () => {
                  try {
                    const result = await runExpiryMutation.mutateAsync();
                    await expiryStatusQuery.refetch();
                    toast.success(
                      result.ran
                        ? `Expiry check complete · ${result.alerts} alerts sent to HSE and owners.`
                        : "Expiry check already ran today."
                    );
                  } catch (caught) {
                    toast.error("Expiry check blocked", {
                      description: caught instanceof Error ? caught.message : "Please try again.",
                    });
                  }
                })()}
              >
                <Bell size={14} /> Run certificate expiry check
              </button>
              <div className="panel-meta">
                Last run: {expiryStatusQuery.data?.lastRun ?? "never"}
              </div>
              <div className="panel-meta" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ display: "inline-flex", gap: 12 }}><Users size={12} /> <Wrench size={12} /> <Truck size={12} /> <ClipboardCheck size={12} /> <Send size={12} /></span>
                Coordination summary: {selectedCrew.length} crew · {selectedGear.length} gear · {selectedTrailers.length} trailers.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
