import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Flag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "./primitives";
import type { TrainingFlagStatus } from "@shared/docConsoleRules";

type FlagFilter = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "ALL";

/**
 * Training Flags inbox (PRD v3.0 §12.4). One shared component used by the
 * Crew workspace, the HSE/docs workspace, and the Doc Supervisor Console.
 * State transitions are enforced server-side; the UI only offers the
 * actions the current actor is likely allowed and reports rejections.
 */
export function TrainingFlagsInbox({
  actorRole,
  actorDepartment,
  onOpenBooking,
}: {
  actorRole: string;
  actorDepartment: string | null;
  onOpenBooking?: (bookingId: string) => void;
}) {
  const [filter, setFilter] = useState<FlagFilter>("OPEN");
  const flagsQuery = trpc.operations.listAllTrainingFlags.useQuery(
    { status: filter },
    {}
  );
  const updateMutation = trpc.operations.updateTrainingFlag.useMutation();

  const flags = useMemo(
    () =>
      (flagsQuery.data ?? []).map(row => ({
        ...row,
        status: row.status as TrainingFlagStatus,
        ageDays: Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(row.createdAt).getTime()) / 86_400_000
          )
        ),
      })),
    [flagsQuery.data]
  );
  const openCount = flags.filter(flag => flag.status === "OPEN").length;

  const act = async (id: string, action: "acknowledge" | "resolve") => {
    try {
      await updateMutation.mutateAsync({ id, action });
      await flagsQuery.refetch();
      toast.success(
        action === "acknowledge" ? "Flag acknowledged" : "Flag resolved"
      );
    } catch (caught) {
      toast.error(action === "acknowledge" ? "Acknowledge blocked" : "Resolve blocked", {
        description:
          caught instanceof Error ? caught.message : "Please try again.",
      });
    }
  };

  const canAct =
    actorRole === "admin" ||
    actorDepartment === "crew" ||
    actorDepartment === "hse" ||
    actorDepartment === "documentation";

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">
            <Flag size={15} /> Training flags inbox
          </div>
          <div className="panel-meta">
            {filter === "OPEN"
              ? `${openCount} open · oldest first`
              : `${flags.length} ${filter.toLowerCase()} flags`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }} role="tablist" aria-label="Flag status filter">
          {(["OPEN", "ACKNOWLEDGED", "RESOLVED", "ALL"] as FlagFilter[]).map(
            entry => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={filter === entry}
                className={`filter-chip ${filter === entry ? "selected" : ""}`}
                onClick={() => setFilter(entry)}
              >
                {entry === "ALL" ? "All" : entry}
              </button>
            )
          )}
        </div>
      </div>
      {flagsQuery.isLoading ? (
        <div className="panel-meta" style={{ padding: 12 }}>
          Loading training flags…
        </div>
      ) : flagsQuery.isError ? (
        <div className="detail-list">
          <div className="detail-cell">
            <label>Error</label>
            <div>Training flags could not be loaded.</div>
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void flagsQuery.refetch()}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : flags.length === 0 ? (
        <div className="panel-meta" style={{ padding: 12 }}>
          {filter === "OPEN"
            ? "No open training flags. Every raised flag has an owner."
            : `No ${filter.toLowerCase()} flags.`}
        </div>
      ) : (
        <div className="detail-list">
          {flags.map(flag => (
            <div className="detail-cell" key={flag.id}>
              <label>
                {flag.flagType} · {flag.ageDays}d old · raised by {flag.raisedBy}
              </label>
              <div>
                {flag.crewName} —{" "}
                {onOpenBooking ? (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ margin: "0 4px" }}
                    onClick={() => onOpenBooking(flag.bookingId)}
                  >
                    {flag.bookingId}
                  </button>
                ) : (
                  <strong>{flag.bookingId}</strong>
                )}{" "}
                — {flag.note}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <StatusBadge value={flag.status} />
                {canAct && flag.status === "OPEN" && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={updateMutation.isPending}
                    onClick={() => void act(flag.id, "acknowledge")}
                  >
                    Acknowledge
                  </button>
                )}
                {canAct && flag.status !== "RESOLVED" && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={updateMutation.isPending}
                    onClick={() => void act(flag.id, "resolve")}
                  >
                    <CheckCircle2 size={12} /> Resolve (HSE)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
