import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";
import { findScheduleConflicts } from "@shared/scheduleRules";
import type { Booking } from "./shared";

/**
 * Crew pre-booking calendar (PRD v3.0 §12.2): reserve people for verbally
 * confirmed jobs before the formal booking exists. Overlapping dates warn
 * on both sides instead of blocking.
 */
export function CrewScheduleView({ bookings }: { bookings: Booking[] }) {
  const scheduleQuery = trpc.operations.listScheduledBookings.useQuery(undefined, {});
  const createMutation = trpc.operations.createScheduledBooking.useMutation();
  const deleteMutation = trpc.operations.deleteScheduledBooking.useMutation();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState("");
  const [durationDays, setDurationDays] = useState("1");
  const [requiredRoles, setRequiredRoles] = useState("");
  const [craneType, setCraneType] = useState("");
  const [notes, setNotes] = useState("");

  const entries = useMemo(() => scheduleQuery.data ?? [], [scheduleQuery.data]);
  const conflicts = useMemo(
    () =>
      findScheduleConflicts(
        entries.map(entry => ({
          id: entry.id,
          title: entry.title,
          date: entry.date,
          durationDays: entry.durationDays,
        })),
        bookings.map(booking => ({
          id: booking.id,
          mob: booking.mob,
          offHire: booking.offHire,
        }))
      ),
    [entries, bookings]
  );
  const conflictsFor = (id: string) =>
    conflicts.filter(item => item.entryId === id || item.bookingId === id);

  const create = () => {
    if (!title.trim() || !date) {
      toast.error("Title and date required", {
        description: "Name the scheduled job and pick its start date.",
      });
      return;
    }
    void createMutation
      .mutateAsync({
        title: title.trim(),
        clientName: clientName.trim() || null,
        date,
        durationDays: Math.max(1, Number(durationDays) || 1),
        requiredRoles: requiredRoles
          .split(",")
          .map(role => role.trim())
          .filter(Boolean),
        craneType: craneType.trim() || null,
        notes: notes.trim() || null,
      })
      .then(() => scheduleQuery.refetch())
      .then(() => {
        setTitle("");
        setClientName("");
        setDate("");
        setDurationDays("1");
        setRequiredRoles("");
        setCraneType("");
        setNotes("");
        toast.success("Scheduled booking added", {
          description: "Crew is pre-reserved ahead of the formal booking.",
        });
      })
      .catch((caught: unknown) => {
        toast.error("Schedule not saved", {
          description:
            caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  const remove = (id: string) => {
    void deleteMutation
      .mutateAsync({ id })
      .then(() => scheduleQuery.refetch())
      .catch((caught: unknown) => {
        toast.error("Delete failed", {
          description:
            caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  return (
    <div className="content">
      <PageHeading
        eyebrow="Crew planning"
        title="Scheduled bookings"
        copy="Pre-reserve crew for verbally confirmed jobs. Overlaps warn — formal bookings still win."
      />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div className="panel-title">
            <CalendarDays size={15} /> New scheduled entry
          </div>
        </div>
        <div className="detail-list">
          <div className="detail-cell">
            <label>Title</label>
            <input aria-label="Scheduled job title" value={title} onChange={event => setTitle(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Client (optional)</label>
            <input aria-label="Client name" value={clientName} onChange={event => setClientName(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Start date</label>
            <input aria-label="Start date" type="date" value={date} onChange={event => setDate(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Duration (days)</label>
            <input aria-label="Duration in days" type="number" min={1} max={90} value={durationDays} onChange={event => setDurationDays(event.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Required roles (comma separated)</label>
            <input aria-label="Required roles" value={requiredRoles} onChange={event => setRequiredRoles(event.target.value)} placeholder="Operator, Rigger" style={{ width: "100%" }} />
          </div>
          <div className="detail-cell">
            <label>Crane type</label>
            <input aria-label="Crane type" value={craneType} onChange={event => setCraneType(event.target.value)} style={{ width: "100%" }} />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <input aria-label="Schedule notes" placeholder="Notes (optional)" value={notes} onChange={event => setNotes(event.target.value)} style={{ width: "100%" }} />
        </div>
        <button type="button" className="primary-button" style={{ marginTop: 12 }} disabled={createMutation.isPending} onClick={create}>
          <Plus size={14} /> Add scheduled entry
        </button>
      </div>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Upcoming schedule</div>
          <div className="panel-meta">{entries.length} entries</div>
        </div>
        {scheduleQuery.isLoading ? (
          <div className="panel-meta" style={{ padding: 12 }}>Loading schedule…</div>
        ) : scheduleQuery.isError ? (
          <div className="panel-meta" style={{ padding: 12 }}>
            Schedule could not be loaded.{" "}
            <button type="button" className="secondary-button" onClick={() => void scheduleQuery.refetch()}>Retry</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="panel-meta" style={{ padding: 12 }}>No scheduled entries yet.</div>
        ) : (
          <div className="detail-list">
            {entries.map(entry => {
              const entryConflicts = conflictsFor(entry.id);
              return (
                <div className="detail-cell" key={entry.id}>
                  <label>
                    {entry.date} · {entry.durationDays}d{entry.clientName ? ` · ${entry.clientName}` : ""}
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <span>{entry.title}</span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {entryConflicts.length > 0 && <StatusBadge value="Conflict" />}
                      <button type="button" className="secondary-button" aria-label={`Delete ${entry.title}`} disabled={deleteMutation.isPending} onClick={() => remove(entry.id)}>
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>
                  {entryConflicts.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#e31e24" }}>
                      <AlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                      {entryConflicts.map(item => item.detail).join(" ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
