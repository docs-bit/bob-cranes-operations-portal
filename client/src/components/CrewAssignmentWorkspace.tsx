import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckSquare, Download, ExternalLink, LoaderCircle, Plus, Save, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CREW_ASSIGNMENT_ROSTER } from "@shared/crewAssignmentRoster";
import { toggleEmployeeBookingAllocation, type EmployeeAllocation } from "@shared/bookingConflictRules";
import { focusAssignmentBooking } from "@shared/assignmentRules";
import { allocationAwareAvailability, summarizeAllocationTiming } from "@shared/crewAssignmentAvailability";
import { buildBulkConflictSummary } from "@shared/bulkCrewAssignmentRules";
import { TrainingFlagsInbox } from "@/pages/views/TrainingFlagsInbox";

type Booking = {
  id: string;
  client: string;
  project?: string;
  mob: string;
  offHire: string;
  stage?: string;
  priority?: string;
  crane?: string;
  site?: string;
  progress?: number;
};
type Availability = "All" | "Present" | "On Leave" | "Assigned" | "Upcoming booking" | "Completed booking" | "Off-Site" | "Scheduled booking";
type CrewSearchPreset = { id: string; name: string; query: string; department: string; role?: string; availability: Availability; date: string };
type RosterCrew = Omit<(typeof CREW_ASSIGNMENT_ROSTER)[number], "availability"> & { bookingIds: string[]; availability: string };
type CsvColumnKey = "employee" | "attendanceId" | "role" | "department" | "availability" | "date" | "bookingIds" | "bookingSummaries";

const PRESET_STORAGE_KEY = "bob-crew-assignment-search-presets-v1";
const EXPORT_COLUMNS: { key: CsvColumnKey; label: string }[] = [
  { key: "employee", label: "Employee" }, { key: "attendanceId", label: "Attendance ID" }, { key: "role", label: "Role" }, { key: "department", label: "Department" }, { key: "availability", label: "Availability" }, { key: "date", label: "Availability date" }, { key: "bookingIds", label: "Booking IDs" }, { key: "bookingSummaries", label: "Booking summaries" },
];
const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.map(column => column.key);
const toPersistedBookingId = (id: string): string | null => id === "BOB Booking-31511" ? "BOB-59116" : id === "BOB Booking-31421" ? "BOB-59117" : id === "BOB Booking-31390" ? "BOB-59118" : null;
const toUiBookingId = (id: string) => id === "BOB-59116" ? "BOB Booking-31511" : id === "BOB-59117" ? "BOB Booking-31421" : id === "BOB-59118" ? "BOB Booking-31390" : id;
const todayKey = () => new Date().toISOString().slice(0, 10);
const allocationMatches = (crew: { id: string; name: string }, allocation: EmployeeAllocation) => allocation.crewId ? allocation.crewId === crew.id : allocation.employeeName === crew.name;
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function Badge({ value }: { value: string }) { const tone = value === "Present" || value === "Active booking" || value === "Clear" ? "green" : value === "Assigned" || value === "Upcoming booking" ? "blue" : value === "On Leave" || value === "Off-Site" || value.includes("conflict") ? "red" : "gray"; return <span className={`status-badge ${tone}`}>{value}</span>; }
function UndoAssignmentToast({ durationMs = 8000 }: { durationMs?: number }) {
  const totalSeconds = Math.ceil(durationMs / 1000);
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const progress = `${Math.max(0, Math.min(100, (remaining / totalSeconds) * 100))}%`;
  return <span role="status" className="undo-toast-content"><strong>Assignment saved.</strong><span>Undo available for {remaining}s</span><span className="undo-toast-progress" aria-hidden="true"><span style={{ width: progress }} /></span></span>;
}
function dateAvailability(crew: (typeof CREW_ASSIGNMENT_ROSTER)[number], ids: string[], bookings: Booking[], date: string) { if (!ids.length) return allocationAwareAvailability(crew.availability, false); const timing = summarizeAllocationTiming(ids, bookings, new Date(`${date}T12:00:00`)); return timing === "Active booking" ? "Assigned" : timing; }
function BookingDetailsDialog({
  booking,
  open,
  onOpenChange,
  onOpenDossier,
  onBookingUpdated,
}: {
  booking?: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDossier: (id: string) => void;
  onBookingUpdated?: (updated: { id: string; priority: string; mob: string; offHire: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [priority, setPriority] = useState(booking?.priority ?? "Standard");
  const [mob, setMob] = useState(booking?.mob ?? "");
  const [offHire, setOffHire] = useState(booking?.offHire ?? "");

  useEffect(() => {
    if (booking) {
      setPriority(booking.priority ?? "Standard");
      setMob(booking.mob ?? "");
      setOffHire(booking.offHire ?? "");
      setEditing(false);
    }
  }, [booking]);

  if (!booking) return null;

  const handleSave = () => {
    if (onBookingUpdated) {
      onBookingUpdated({ id: booking.id, priority, mob, offHire });
    }
    toast.success(`Updated booking ${booking.id} details.`);
    setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{booking.id} · Dossier overview</DialogTitle>
          <DialogDescription>
            {booking.client} {booking.project ? `· ${booking.project}` : ""}
          </DialogDescription>
        </DialogHeader>
        {!editing ? (
          <div className="booking-details-modal-grid">
            <div>
              <span className="muted">Lifecycle stage</span>
              <strong>{booking.stage ?? "Active"}</strong>
            </div>
            <div>
              <span className="muted">Priority</span>
              <strong>{priority}</strong>
            </div>
            <div>
              <span className="muted">Crane / Equipment</span>
              <strong>{booking.crane ?? "Allocated crane"}</strong>
            </div>
            <div>
              <span className="muted">Site location</span>
              <strong>{booking.site ?? "Job site"}</strong>
            </div>
            <div>
              <span className="muted">Mobilization</span>
              <strong>{mob}</strong>
            </div>
            <div>
              <span className="muted">Off-hire</span>
              <strong>{offHire}</strong>
            </div>
          </div>
        ) : (
          <div className="booking-edit-form" style={{ display: "grid", gap: 12, padding: "12px 0" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span className="muted">Priority tier</span>
              <select
                className="attendance-select"
                value={priority}
                onChange={e => setPriority(e.target.value)}
              >
                <option value="Standard">Standard</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
                <option value="VIP">VIP</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span className="muted">Mobilization date</span>
              <input
                className="form-input"
                value={mob}
                onChange={e => setMob(e.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span className="muted">Off-hire date</span>
              <input
                className="form-input"
                value={offHire}
                onChange={e => setOffHire(e.target.value)}
              />
            </label>
          </div>
        )}
        <DialogFooter>
          {!editing ? (
            <>
              <button className="secondary-button" onClick={() => setEditing(true)}>
                Edit Booking
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenDossier(booking.id);
                }}
              >
                Open full dossier <ExternalLink size={14} />
              </button>
            </>
          ) : (
            <>
              <button className="secondary-button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleSave}>
                Save changes
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingIdChip({
  bookingId,
  booking,
  onOpen,
}: {
  bookingId: string;
  booking?: Booking;
  onOpen: (id: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const stage = booking?.stage;
  const tone =
    stage === "Dispatched"
      ? "green"
      : stage === "Reviewed" || stage === "All Docs Submitted"
        ? "blue"
        : stage === "Crew Assigned" || stage === "Gear Confirmed"
          ? "amber"
          : "gray";
  const summary = booking
    ? `${booking.client} · ${booking.project ?? "Project"} · ${booking.stage ?? "Active"} · Mob: ${booking.mob}`
    : "Booking details unavailable in this schedule view.";
  return (
    <>
      <BookingDetailsDialog
        booking={booking}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onOpenDossier={onOpen}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`booking-id-chip status-${tone}`}
            onClick={event => {
              event.stopPropagation();
              onOpen(bookingId);
            }}
            aria-label={`Open ${bookingId} dossier (${booking?.stage ?? "Active"})`}
          >
            <span>{bookingId}</span>
            <ExternalLink size={11} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="booking-chip-tooltip">
          <strong>{bookingId}</strong>
          <span>{summary}</span>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={event => {
                event.stopPropagation();
                setDetailsOpen(true);
              }}
              style={{ fontSize: 10, padding: "2px 8px" }}
            >
              View Details
            </button>
          </div>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

function CsvColumnDialog({ open, onOpenChange, selected, onSelectedChange, onExport, exporting }: { open: boolean; onOpenChange: (open: boolean) => void; selected: CsvColumnKey[]; onSelectedChange: (columns: CsvColumnKey[]) => void; onExport: () => void; exporting: boolean }) {
  const toggle = (key: CsvColumnKey) => onSelectedChange(selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Choose CSV columns</DialogTitle><DialogDescription>Select the data fields included in the current filtered Crew Assignment export.</DialogDescription></DialogHeader><div className="csv-column-grid">{EXPORT_COLUMNS.map(column => <label className="csv-column-option" key={column.key}><input type="checkbox" checked={selected.includes(column.key)} onChange={() => toggle(column.key)} disabled={exporting}/><span>{column.label}</span></label>)}</div><div className="csv-column-actions"><button className="filter-chip" onClick={() => onSelectedChange(DEFAULT_EXPORT_COLUMNS)} disabled={exporting}>Select all</button><button className="filter-chip" onClick={() => onSelectedChange([])} disabled={exporting}>Clear all</button></div><DialogFooter><button className="secondary-button" onClick={() => onOpenChange(false)} disabled={exporting}>Cancel</button><button className="primary-button" onClick={onExport} disabled={!selected.length || exporting}>{exporting ? <><LoaderCircle size={14} className="animate-spin"/> Generating CSV…</> : <><Download size={14}/> Download CSV</>}</button></DialogFooter></DialogContent></Dialog>;
}

export function CrewView({ bookings, setBookings, allocations, setAllocations, focusedBookingId, onAddWorkman, onAllocationSaved, onOpenDossier = () => undefined, actorRole = "user", actorDepartment = "crew" }: { bookings: Booking[]; setBookings?: React.Dispatch<React.SetStateAction<Booking[]>>; allocations: EmployeeAllocation[]; setAllocations: React.Dispatch<React.SetStateAction<EmployeeAllocation[]>>; focusedBookingId?: string | null; onAddWorkman: () => void; onAllocationSaved: (details: { bookingId: string; employeeName: string; action: "saved" | "removed" }) => void; onOpenDossier?: (bookingId: string) => void; actorRole?: string; actorDepartment?: string | null }) {
  const saveAllocation = trpc.operations.saveCrewAllocations.useMutation();
  const focusedCrewId = allocations.find(allocation => allocation.bookingId === focusedBookingId)?.crewId;
  const [query, setQuery] = useState(""); const [availableCrewQuery, setAvailableCrewQuery] = useState(""); const [department, setDepartment] = useState("All"); const [role, setRole] = useState("All"); const [availability, setAvailability] = useState<Availability>("All"); const [availabilityDate, setAvailabilityDate] = useState(todayKey);
  const [selectedCrewId, setSelectedCrewId] = useState(focusedCrewId ?? CREW_ASSIGNMENT_ROSTER[0]?.id ?? ""); const [bulkIds, setBulkIds] = useState<string[]>([]); const [presetName, setPresetName] = useState(""); const [savedPresets, setSavedPresets] = useState<CrewSearchPreset[]>([]);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false); const [csvColumns, setCsvColumns] = useState<CsvColumnKey[]>(DEFAULT_EXPORT_COLUMNS); const [exporting, setExporting] = useState(false);
  const [undoRequest, setUndoRequest] = useState<{ crew: RosterCrew; previousIds: string[]; bookingId: string } | null>(null);
  const focusedBooking = bookings.find(booking => booking.id === focusedBookingId) ?? null;
  const departments = useMemo(() => Array.from(new Set(CREW_ASSIGNMENT_ROSTER.map(crew => crew.department))).sort(), []);
  const roles = useMemo(() => Array.from(new Set(CREW_ASSIGNMENT_ROSTER.map(crew => crew.role))).sort(), []);
  const bookingIdsByCrew = useMemo(() => new Map(CREW_ASSIGNMENT_ROSTER.map(crew => [crew.id, allocations.filter(allocation => allocationMatches(crew, allocation)).map(allocation => allocation.bookingId)])), [allocations]);
  const roster = useMemo((): RosterCrew[] => CREW_ASSIGNMENT_ROSTER.map(crew => { const bookingIds = bookingIdsByCrew.get(crew.id) ?? []; return { ...crew, bookingIds, availability: dateAvailability(crew, bookingIds, bookings, availabilityDate) }; }), [availabilityDate, bookingIdsByCrew, bookings]);
  const [quickStatusFilter, setQuickStatusFilter] = useState<"all" | "dispatched" | "reviewed" | "assigned">("all");

  const statusCounts = useMemo(() => {
    let dispatched = 0;
    let reviewed = 0;
    let assigned = 0;
    bookings.forEach(booking => {
      const stage = (booking as Booking & { stage?: string }).stage;
      if (stage === "Dispatched") dispatched++;
      if (stage === "Reviewed" || stage === "All Docs Submitted") reviewed++;
      if (stage === "Crew Assigned" || stage === "Gear Confirmed") assigned++;
    });
    return { all: bookings.length, dispatched, reviewed, assigned };
  }, [bookings]);
  const filteredBookingsForExport = useMemo(() => bookings.filter(booking => {
    const stage = booking.stage;
    if (quickStatusFilter === "dispatched") return stage === "Dispatched";
    if (quickStatusFilter === "reviewed") return stage === "Reviewed" || stage === "All Docs Submitted";
    if (quickStatusFilter === "assigned") return stage === "Crew Assigned" || stage === "Gear Confirmed";
    return true;
  }), [bookings, quickStatusFilter]);

  const visibleCrew = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roster.filter(crew => {
      const matchesAvailability = availability === "All" || crew.availability === availability;
      const matchesDepartment = department === "All" || crew.department === department;
      const matchesRole = role === "All" || crew.role === role;
      const crewNeedle = availableCrewQuery.trim().toLowerCase();
      const matchesQuery = !needle || `${crew.name} ${crew.sourceId} ${crew.role} ${crew.department} ${crew.bookingIds.join(" ")}`.toLowerCase().includes(needle);
      const matchesAvailableCrewQuery = !crewNeedle || `${crew.name} ${crew.role}`.toLowerCase().includes(crewNeedle);
      if (!matchesAvailability || !matchesDepartment || !matchesRole || !matchesQuery || !matchesAvailableCrewQuery) return false;
      if (quickStatusFilter === "all") return true;
      const crewBookings = crew.bookingIds.map(id => bookings.find(item => item.id === id)).filter((item): item is Booking & { stage?: string } => Boolean(item));
      if (quickStatusFilter === "dispatched") {
        return crewBookings.some(b => b.stage === "Dispatched");
      }
      if (quickStatusFilter === "reviewed") {
        return crewBookings.some(b => b.stage === "Reviewed" || b.stage === "All Docs Submitted");
      }
      if (quickStatusFilter === "assigned") {
        return crewBookings.some(b => b.stage === "Crew Assigned" || b.stage === "Gear Confirmed");
      }
      return true;
    });
  }, [availability, availableCrewQuery, bookings, department, quickStatusFilter, query, role, roster]);

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (availableCrewQuery.trim() ? 1 : 0) +
    (department !== "All" ? 1 : 0) +
    (role !== "All" ? 1 : 0) +
    (availability !== "All" ? 1 : 0) +
    (availabilityDate !== todayKey() ? 1 : 0) +
    (quickStatusFilter !== "all" ? 1 : 0);
  const selectedCrew = roster.find(crew => crew.id === selectedCrewId) ?? roster[0]; const selectedBulkCrew = roster.filter(crew => bulkIds.includes(crew.id)); const targetBooking = focusedBooking ?? focusAssignmentBooking(bookings, focusedBookingId)[0] ?? null;
  const conflictSummary = useMemo(() => targetBooking ? buildBulkConflictSummary(selectedBulkCrew, targetBooking, bookings, allocations) : [], [allocations, bookings, selectedBulkCrew, targetBooking]); const activeConflicts = conflictSummary.filter(item => item.conflicts.length);
  useEffect(() => { if (focusedCrewId) setSelectedCrewId(focusedCrewId); }, [focusedCrewId]); useEffect(() => { if (focusedBookingId) setBulkIds(allocations.filter(allocation => allocation.bookingId === focusedBookingId).map(allocation => allocation.crewId).filter((id): id is string => Boolean(id))); }, [allocations, focusedBookingId]); useEffect(() => { try { const saved = localStorage.getItem(PRESET_STORAGE_KEY); if (saved) setSavedPresets(JSON.parse(saved)); } catch {} }, []);
  const persistPresets = (items: CrewSearchPreset[]) => { setSavedPresets(items); try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(items)); } catch {} };
  const savePreset = () => { const name = presetName.trim(); if (!name) return toast.info("Name this search before saving it."); persistPresets([{ id: `${Date.now()}`, name, query, department, role, availability, date: availabilityDate }, ...savedPresets.filter(item => item.name !== name)].slice(0, 8)); setPresetName(""); };
  const exportCurrentScheduleCsv = async () => { if (!csvColumns.length) return toast.info("Select at least one CSV column."); setExporting(true); await new Promise(resolve => window.setTimeout(resolve, 80)); const values: Record<CsvColumnKey, (crew: RosterCrew) => string> = { employee: crew => crew.name, attendanceId: crew => crew.sourceId, role: crew => crew.role, department: crew => crew.department, availability: crew => crew.availability, date: () => availabilityDate, bookingIds: crew => crew.bookingIds.join(" | ") || "Available", bookingSummaries: crew => crew.bookingIds.map(id => { const booking = bookings.find(item => item.id === id); return booking ? `${booking.client} / ${booking.project ?? "Project"} / ${booking.mob}–${booking.offHire}` : id; }).join(" | ") }; const header = csvColumns.map(key => EXPORT_COLUMNS.find(column => column.key === key)?.label ?? key); const rows = visibleCrew.map(crew => csvColumns.map(key => values[key](crew))); const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `BOB-Crew-Assignment-${availabilityDate}.csv`; link.click(); URL.revokeObjectURL(url); setExporting(false); setCsvDialogOpen(false); toast.success(`Exported ${rows.length} current crew rows as CSV.`); };
  const exportFilteredBookingsCsv = () => {
    const header = ["Booking ID", "Client", "Project", "Crane", "Site", "Status", "Priority", "Mobilization", "Off-hire"];
    const rows = filteredBookingsForExport.map(booking => [booking.id, booking.client, booking.project ?? "Project", booking.crane ?? "", booking.site ?? "", booking.stage ?? "", booking.priority ?? "", booking.mob, booking.offHire]);
    const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `BOB-Crew-Filtered-Bookings-${quickStatusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} filtered booking${rows.length === 1 ? "" : "s"} exported to CSV.`);
  };
  const toggleBulk = (id: string) => setBulkIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const persistCrew = async (crew: RosterCrew, ids: string[]) => saveAllocation.mutateAsync({ crewId: crew.id, crewName: crew.name, bookingIds: ids.map(toPersistedBookingId).filter((id): id is string => id !== null) });
  const mergeCrewResult = (crewId: string, result: { allocations: { crewName: string; crewId: string; bookingId: string }[] }) => setAllocations(current => [...current.filter(allocation => allocation.crewId !== crewId), ...result.allocations.map(allocation => ({ employeeName: allocation.crewName, crewId: allocation.crewId, bookingId: toUiBookingId(allocation.bookingId) }))]);
  const confirmUndo = async () => {
    if (!undoRequest) return;
    try {
      const result = await persistCrew(undoRequest.crew, undoRequest.previousIds);
      mergeCrewResult(undoRequest.crew.id, result);
      onAllocationSaved({ bookingId: undoRequest.bookingId, employeeName: undoRequest.crew.name, action: "removed" });
      setUndoRequest(null);
      toast.success(`Undid ${undoRequest.crew.name}'s assignment to ${undoRequest.bookingId}.`);
    } catch {
      toast.error("Undo could not be saved. Please review the assignment manually.");
    }
  };
  const toggleSingle = async (booking: Booking) => { if (!selectedCrew) return; const next = selectedCrew.bookingIds.includes(booking.id) ? selectedCrew.bookingIds.filter(id => id !== booking.id) : [...selectedCrew.bookingIds, booking.id]; try { const result = await persistCrew(selectedCrew, next); mergeCrewResult(selectedCrew.id, result); onAllocationSaved({ bookingId: booking.id, employeeName: selectedCrew.name, action: selectedCrew.bookingIds.includes(booking.id) ? "removed" : "saved" }); } catch { toast.error("Allocation could not be saved."); } };
  const bulkAssign = async () => { if (!targetBooking || !selectedBulkCrew.length) return toast.info("Select one or more crew members first."); if (!toPersistedBookingId(targetBooking.id)) return toast.info("This preview dossier cannot receive durable assignments."); try { const results = await Promise.all(selectedBulkCrew.map(async crew => ({ crew, result: await persistCrew(crew, crew.bookingIds.includes(targetBooking.id) ? crew.bookingIds : [...crew.bookingIds, targetBooking.id]) }))); results.forEach(({ crew, result }) => mergeCrewResult(crew.id, result)); results.forEach(({ crew }) => onAllocationSaved({ bookingId: targetBooking.id, employeeName: crew.name, action: "saved" })); toast.success(`${results.length} crew member${results.length === 1 ? "" : "s"} assigned to ${targetBooking.id}.`); } catch { toast.error("Bulk assignment could not be saved. Existing assignments were left unchanged."); } };
  return       <div className="content">
      <TrainingFlagsInbox
        actorRole={actorRole}
        actorDepartment={actorDepartment}
        onOpenBooking={onOpenDossier}
      />
        <Dialog open={Boolean(undoRequest)} onOpenChange={open => { if (!open) setUndoRequest(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm undo assignment</DialogTitle>
              <DialogDescription>
                Remove {undoRequest?.crew.name ?? "this crew member"} from {undoRequest?.bookingId ?? "the booking"}? This will save the previous allocation state.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button type="button" className="secondary-button" onClick={() => setUndoRequest(null)}>Keep assignment</button>
              <button type="button" className="primary-button" onClick={() => void confirmUndo()}>Confirm undo</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CsvColumnDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} selected={csvColumns} onSelectedChange={setCsvColumns} onExport={() => void exportCurrentScheduleCsv()} exporting={exporting}/><div className="page-heading"><div><div className="eyebrow">Resource readiness</div><h1>{focusedBooking ? `Edit assignment · ${focusedBooking.id}` : "Crew assignment"}</h1><p>{focusedBooking ? "Select multiple available or assigned employees, review conflicts, then assign the group in one action." : "Search, review, and allocate the attendance-backed crew roster."}</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="secondary-button" onClick={exportFilteredBookingsCsv} disabled={!filteredBookingsForExport.length}><Download size={14}/> Export bookings CSV</button><button className="secondary-button" onClick={() => setCsvDialogOpen(true)} disabled={exporting}>{exporting ? <><LoaderCircle size={14} className="animate-spin"/> Generating CSV…</> : <><Download size={14}/> Export CSV</>}</button><button className="primary-button" onClick={onAddWorkman}><Plus size={14}/> Add workman</button></div></div>{focusedBooking && <div className="notification"><div className="title">Bulk Edit Assignment</div><div className="body">Available and already-assigned crew remain selectable. Conflicts are shown before the bulk save.</div></div>}<div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div className="filter-row">{(["All", "Present", "On Leave", "Assigned", "Upcoming booking", "Completed booking", "Off-Site"] as Availability[]).map(value => <button key={value} className={`filter-chip ${availability === value ? "selected" : ""}`} onClick={() => setAvailability(value)}>{value}</button>)}</div><span className="panel-meta">{visibleCrew.length} matching crew</span></div><div className="panel-body crew-search-controls">
  <label className="search-pill booking-search">
    <Search size={14} />
    <input
      aria-label="Search crew assignment roster"
      value={query}
      onChange={event => setQuery(event.target.value)}
      placeholder="Search name, ID, role, booking, or department"
    />
  </label>
  <label className="search-pill booking-search">
    <Users size={14} />
    <input
      aria-label="Search available crew members by name or role"
      value={availableCrewQuery}
      onChange={event => setAvailableCrewQuery(event.target.value)}
      placeholder="Search available crew by name or role"
    />
  </label>
  <select
    className="attendance-select compact"
    value={availability}
    onChange={event => setAvailability(event.target.value as Availability)}
    aria-label="Filter available crew by current availability"
  >
    <option value="All">All availability</option>
    <option value="Present">Present</option>
    <option value="Assigned">Assigned</option>
    <option value="Upcoming booking">Upcoming booking</option>
    <option value="Completed booking">Completed booking</option>
    <option value="On Leave">On Leave</option>
    <option value="Off-Site">Off-Site</option>
  </select>
  <select
    className="attendance-select compact"
    value={role}
    onChange={event => setRole(event.target.value)}
    aria-label="Filter crew by role"
  >
    <option value="All">All roles</option>
    {roles.map(item => <option key={item} value={item}>{item}</option>)}
  </select>
  <select
    className="attendance-select compact"
    value={department}
    onChange={event => setDepartment(event.target.value)}
    aria-label="Filter crew by department"
  >
    <option value="All">All departments</option>
    {departments.map(item => (
      <option key={item}>{item}</option>
    ))}
  </select>
  <label className="crew-date-filter">
    <CalendarDays size={14} />
    <span>Availability on</span>
    <input
      type="date"
      value={availabilityDate}
      onChange={event => setAvailabilityDate(event.target.value)}
      aria-label="Filter crew availability by date"
    />
  </label>
  {activeFilterCount > 0 && (
    <button
      type="button"
      className="secondary-button compact-button"
      onClick={() => {
        setQuery("");
        setAvailableCrewQuery("");
        setDepartment("All");
        setRole("All");
        setAvailability("All");
        setAvailabilityDate(todayKey());
        setQuickStatusFilter("all");
        toast.success("Crew assignment filters reset");
      }}
      aria-label="Clear all active crew filters"
    >
      Clear filters ({activeFilterCount})
    </button>
  )}
</div>
<div className="panel-body crew-status-pills-row" style={{ display: "flex", gap: 8, paddingBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
  <span className="muted" style={{ fontSize: 11, marginRight: 4 }}>Status filter:</span>
  <button
    type="button"
    className={`filter-chip ${quickStatusFilter === "all" ? "selected" : ""}`}
    onClick={() => setQuickStatusFilter("all")}
  >
    All ({statusCounts.all})
  </button>
  <button
    type="button"
    className={`filter-chip ${quickStatusFilter === "dispatched" ? "selected" : ""}`}
    onClick={() => setQuickStatusFilter("dispatched")}
  >
    Dispatched ({statusCounts.dispatched})
  </button>
  <button
    type="button"
    className={`filter-chip ${quickStatusFilter === "reviewed" ? "selected" : ""}`}
    onClick={() => setQuickStatusFilter("reviewed")}
  >
    Reviewed / Submitted ({statusCounts.reviewed})
  </button>
  <button
    type="button"
    className={`filter-chip ${quickStatusFilter === "assigned" ? "selected" : ""}`}
    onClick={() => setQuickStatusFilter("assigned")}
  >
    Crew / Gear Assigned ({statusCounts.assigned})
  </button>
</div><div className="panel-body saved-search-controls"><input className="form-input" value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Name this workspace search" aria-label="Saved search name"/><button className="secondary-button" onClick={savePreset}><Save size={14}/> Save search</button>{savedPresets.map(preset => <button className="filter-chip" key={preset.id} onClick={() => { setQuery(preset.query); setDepartment(preset.department); setRole(preset.role ?? "All"); setAvailability(preset.availability); setAvailabilityDate(preset.date); }}>{preset.name}</button>)}</div><div className="table-wrap">
  <table className="data-table" data-testid="crew-roster-table">
    <thead>
      <tr>
        {focusedBooking && (
          <th>
            <button
              className="table-select-all"
              onClick={() => setBulkIds(visibleCrew.map(crew => crew.id))}
              aria-label="Select all filtered crew"
            >
              <CheckSquare size={14} />
            </button>
          </th>
        )}
        <th>Workman</th>
        <th>Attendance ID</th>
        <th>Role</th>
        <th>Department</th>
        <th>Availability</th>
        <th>Booking allocation (Drag to assign)</th>
      </tr>
    </thead>
    <tbody>
      {visibleCrew.map(crew => {
        const timing = crew.bookingIds.length
          ? summarizeAllocationTiming(crew.bookingIds, bookings, new Date(`${availabilityDate}T12:00:00`))
          : null;
        return (
          <tr
            key={crew.id}
            className={selectedCrew?.id === crew.id ? "selected-row" : ""}
            onClick={() => setSelectedCrewId(crew.id)}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData("text/plain", crew.id);
            }}
          >
            {focusedBooking && (
              <td>
                <input
                  type="checkbox"
                  checked={bulkIds.includes(crew.id)}
                  onChange={() => toggleBulk(crew.id)}
                  onClick={event => event.stopPropagation()}
                  aria-label={`Select ${crew.name} for bulk assignment`}
                />
              </td>
            )}
            <td>
              <strong>{crew.name}</strong>
              <span className="allocation-count-badge">
                {crew.bookingIds.length} allocation{crew.bookingIds.length === 1 ? "" : "s"}
              </span>
            </td>
            <td>{crew.sourceId}</td>
            <td>{crew.role}</td>
            <td>{crew.department}</td>
            <td>
              <Badge value={crew.availability} />
              {timing && <Badge value={timing} />}
            </td>
            <td>
              {crew.bookingIds.length ? (
                <div className="crew-booking-ids">
                  {crew.bookingIds.map((id, index) => (
                    <BookingIdChip
                      key={`booking-chip-${id}-${index}`}
                      bookingId={id}
                      booking={bookings.find(item => item.id === id)}
                      onOpen={onOpenDossier}
                    />
                  ))}
                </div>
              ) : (
                <span className="muted" style={{ fontSize: 11 }}>Available (Drag row to drop onto bookings)</span>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
  {!visibleCrew.length && <div className="empty-state">No crew match this page search and date filter.</div>}
</div>
</div>
{focusedBooking && (
  <div
    className="drop-target-zone panel"
    style={{ marginTop: 16, border: "2px dashed #9acfc1", background: "#f4fcf9", padding: 16, textAlign: "center" }}
    onDragOver={e => e.preventDefault()}
    onDrop={async e => {
      e.preventDefault();
      const crewId = e.dataTransfer.getData("text/plain");
      const crew = roster.find(item => item.id === crewId);
      if (!crew || !targetBooking) return;
      if (!toPersistedBookingId(targetBooking.id)) {
        return toast.info("This preview dossier cannot receive durable assignments.");
      }
      const previousIds = crew.bookingIds;
      const next = crew.bookingIds.includes(targetBooking.id)
        ? crew.bookingIds
        : [...crew.bookingIds, targetBooking.id];
      try {
        const result = await persistCrew(crew, next);
        mergeCrewResult(crew.id, result);
        onAllocationSaved({ bookingId: targetBooking.id, employeeName: crew.name, action: "saved" });
          const undoDeadline = Date.now() + 8000;
        toast.success(<UndoAssignmentToast durationMs={8000} />, {
          description: `Dropped ${crew.name} onto ${targetBooking.id}.`,
          duration: 8000,
          action: {
            label: "Undo",
            onClick: () => {
              if (Date.now() > undoDeadline) {
                toast.info("Undo window expired", { description: "The assignment remains saved." });
                return;
              }
              setUndoRequest({ crew, previousIds, bookingId: targetBooking.id });
            },
          },
        });
      } catch {
        toast.error("Drop assignment could not be saved.");
      }
    }}
  >
    <div className="panel-title" style={{ fontSize: 14, color: "#1d725f", marginBottom: 4 }}>
      Drop Zone · Assign Crew to {targetBooking?.id}
    </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
      Drag any crew member from the table above and drop them here to instantly assign them to {targetBooking?.id}.
    </p>
  </div>
)}{focusedBooking && <div className="bulk-assignment-layout"><section className="panel"><div className="panel-header"><div><div className="panel-title"><Users size={15}/> Bulk assignment · {targetBooking?.id}</div><div className="panel-meta">{selectedBulkCrew.length} selected crew member{selectedBulkCrew.length === 1 ? "" : "s"}</div></div><button className="primary-button" disabled={!selectedBulkCrew.length || saveAllocation.isPending} onClick={bulkAssign}>{saveAllocation.isPending ? "Saving…" : `Assign ${selectedBulkCrew.length || "selected"} crew`}</button></div><div className="panel-body">{selectedBulkCrew.length ? <div className="bulk-selected-list">{selectedBulkCrew.map(crew => <span className="booking-id-chip" key={crew.id}>{crew.name} · {crew.role}</span>)}</div> : <div className="empty-state">Select employees from the roster above to prepare a bulk assignment.</div>}</div></section><section className="panel"><div className="panel-header"><div><div className="panel-title"><AlertTriangle size={15}/> Conflict timeline before save</div><div className="panel-meta">Target booking dates are compared with every selected crew member’s saved allocations.</div></div><Badge value={activeConflicts.length ? `${activeConflicts.length} conflicts` : "Clear"}/></div><div className="panel-body conflict-timeline">{selectedBulkCrew.length ? conflictSummary.map(item => <div className="conflict-timeline-row" key={item.crew.id}><strong>{item.crew.name}</strong><div className="conflict-track"><span className="conflict-target-segment">Target · {targetBooking?.mob} → {targetBooking?.offHire}</span>{item.conflicts.map(conflict => <span className="conflict-overlap-segment" key={conflict.id}>Conflict · {conflict.id}</span>)}</div><small>{item.conflicts.length ? `${item.conflicts.length} overlapping booking${item.conflicts.length === 1 ? "" : "s"}` : "No date overlap"}</small></div>) : <div className="empty-state">Select crew to see their booking conflict timeline before saving.</div>}</div></section></div>}<div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div className="panel-title">Individual assignment</div><div className="panel-meta">Use this control for the selected roster row.</div></div></div><div className="panel-body booking-allocation-list">{focusAssignmentBooking(bookings, focusedBookingId).map((booking, index) => <div className="booking-allocation-row" key={`booking-allocation-${booking.id}-${index}`}><div><strong>{booking.id}</strong><span>{booking.client} · {booking.mob} → {booking.offHire}</span></div><button className="secondary-button" onClick={() => toggleSingle(booking)}>{selectedCrew?.bookingIds.includes(booking.id) ? "Remove selected crew" : "Assign selected crew"}</button></div>)}</div></div>;
}
