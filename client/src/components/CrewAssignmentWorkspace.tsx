import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, CalendarDays, CheckSquare, Download, ExternalLink, Plus, Save, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CREW_ASSIGNMENT_ROSTER } from "@shared/crewAssignmentRoster";
import { toggleEmployeeBookingAllocation, type EmployeeAllocation } from "@shared/bookingConflictRules";
import { focusAssignmentBooking } from "@shared/assignmentRules";
import { allocationAwareAvailability, summarizeAllocationTiming, type AllocationTiming } from "@shared/crewAssignmentAvailability";
import { buildBulkConflictSummary } from "@shared/bulkCrewAssignmentRules";

type Booking = { id: string; client: string; project?: string; mob: string; offHire: string };
type Availability = "All" | "Present" | "On Leave" | "Assigned" | "Upcoming booking" | "Completed booking" | "Off-Site" | "Scheduled booking";
type CrewSearchPreset = { id: string; name: string; query: string; department: string; availability: Availability; date: string };

const PRESET_STORAGE_KEY = "bob-crew-assignment-search-presets-v1";
const toPersistedBookingId = (id: string): string | null => id === "BOB Booking-31511" ? "BOB-59116" : id === "BOB Booking-31421" ? "BOB-59117" : id === "BOB Booking-31390" ? "BOB-59118" : null;
const toUiBookingId = (id: string) => id === "BOB-59116" ? "BOB Booking-31511" : id === "BOB-59117" ? "BOB Booking-31421" : id === "BOB-59118" ? "BOB Booking-31390" : id;
const todayKey = () => new Date().toISOString().slice(0, 10);
const allocationMatches = (crew: { id: string; name: string }, allocation: EmployeeAllocation) => allocation.crewId ? allocation.crewId === crew.id : allocation.employeeName === crew.name;

function Badge({ value }: { value: string }) {
  const tone = value === "Present" || value === "Active booking" ? "green" : value === "Assigned" || value === "Upcoming booking" ? "blue" : value === "On Leave" || value === "Off-Site" || value === "Conflict" ? "red" : "gray";
  return <span className={`status-badge ${tone}`}>{value}</span>;
}

function dateAvailability(crew: (typeof CREW_ASSIGNMENT_ROSTER)[number], ids: string[], bookings: Booking[], date: string) {
  if (!ids.length) return allocationAwareAvailability(crew.availability, false);
  const timing = summarizeAllocationTiming(ids, bookings, new Date(`${date}T12:00:00`));
  return timing === "Active booking" ? "Assigned" : timing;
}

export function CrewView({ bookings, allocations, setAllocations, focusedBookingId, onAddWorkman, onAllocationSaved, onOpenDossier = () => undefined }: { bookings: Booking[]; allocations: EmployeeAllocation[]; setAllocations: React.Dispatch<React.SetStateAction<EmployeeAllocation[]>>; focusedBookingId?: string | null; onAddWorkman: () => void; onAllocationSaved: (details: { bookingId: string; employeeName: string; action: "saved" | "removed" }) => void; onOpenDossier?: (bookingId: string) => void }) {
  const saveAllocation = trpc.operations.saveCrewAllocations.useMutation();
  const focusedCrewId = allocations.find(allocation => allocation.bookingId === focusedBookingId)?.crewId;
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [availability, setAvailability] = useState<Availability>("All");
  const [availabilityDate, setAvailabilityDate] = useState(todayKey);
  const [selectedCrewId, setSelectedCrewId] = useState(focusedCrewId ?? CREW_ASSIGNMENT_ROSTER[0]?.id ?? "");
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState<CrewSearchPreset[]>([]);
  const focusedBooking = bookings.find(booking => booking.id === focusedBookingId) ?? null;
  const departments = useMemo(() => Array.from(new Set(CREW_ASSIGNMENT_ROSTER.map(crew => crew.department))).sort(), []);
  const bookingIdsByCrew = useMemo(() => new Map(CREW_ASSIGNMENT_ROSTER.map(crew => [crew.id, allocations.filter(allocation => allocationMatches(crew, allocation)).map(allocation => allocation.bookingId)])), [allocations]);
  const roster = useMemo(() => CREW_ASSIGNMENT_ROSTER.map(crew => {
    const bookingIds = bookingIdsByCrew.get(crew.id) ?? [];
    return { ...crew, bookingIds, availability: dateAvailability(crew, bookingIds, bookings, availabilityDate) };
  }), [availabilityDate, bookingIdsByCrew, bookings]);
  const visibleCrew = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roster.filter(crew => (availability === "All" || crew.availability === availability) && (department === "All" || crew.department === department) && (!needle || `${crew.name} ${crew.sourceId} ${crew.role} ${crew.department} ${crew.bookingIds.join(" ")}`.toLowerCase().includes(needle)));
  }, [availability, department, query, roster]);
  const selectedCrew = roster.find(crew => crew.id === selectedCrewId) ?? roster[0];
  const selectedBulkCrew = roster.filter(crew => bulkIds.includes(crew.id));
  const targetBooking = focusedBooking ?? focusAssignmentBooking(bookings, focusedBookingId)[0] ?? null;
  const conflictSummary = useMemo(() => targetBooking ? buildBulkConflictSummary(selectedBulkCrew, targetBooking, bookings, allocations) : [], [allocations, bookings, selectedBulkCrew, targetBooking]);
  const activeConflicts = conflictSummary.filter(item => item.conflicts.length);

  useEffect(() => { if (focusedCrewId) setSelectedCrewId(focusedCrewId); }, [focusedCrewId]);
  useEffect(() => { if (focusedBookingId) setBulkIds(allocations.filter(allocation => allocation.bookingId === focusedBookingId).map(allocation => allocation.crewId).filter((id): id is string => Boolean(id))); }, [allocations, focusedBookingId]);
  useEffect(() => { try { const saved = localStorage.getItem(PRESET_STORAGE_KEY); if (saved) setSavedPresets(JSON.parse(saved)); } catch {} }, []);
  const savePresets = (items: CrewSearchPreset[]) => { setSavedPresets(items); try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(items)); } catch {} };
  const savePreset = () => { const name = presetName.trim(); if (!name) return toast.info("Name this search before saving it."); savePresets([{ id: `${Date.now()}`, name, query, department, availability, date: availabilityDate }, ...savedPresets.filter(item => item.name !== name)].slice(0, 8)); setPresetName(""); };
  const toggleBulk = (id: string) => setBulkIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const selectVisible = () => setBulkIds(visibleCrew.map(crew => crew.id));
  const exportCalendar = () => { const rows = allocations.map(allocation => ({ Crew: allocation.employeeName, Booking: allocation.bookingId })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Crew Schedule"); XLSX.writeFile(wb, "BOB-Cranes-Crew-Assignment-Calendar.xlsx"); };
  const persistCrew = async (crew: typeof roster[number], bookingIds: string[]) => saveAllocation.mutateAsync({ crewId: crew.id, crewName: crew.name, bookingIds: bookingIds.map(toPersistedBookingId).filter((id): id is string => Boolean(id)) });
  const mergeCrewResult = (crewId: string, result: { allocations: { crewName: string; crewId: string; bookingId: string }[] }) => setAllocations(current => [...current.filter(allocation => allocation.crewId !== crewId), ...result.allocations.map(allocation => ({ employeeName: allocation.crewName, crewId: allocation.crewId, bookingId: toUiBookingId(allocation.bookingId) }))]);
  const toggleSingle = async (booking: Booking) => { if (!selectedCrew) return; const ids = selectedCrew.bookingIds; const next = ids.includes(booking.id) ? ids.filter(id => id !== booking.id) : [...ids, booking.id]; try { const result = await persistCrew(selectedCrew, next); mergeCrewResult(selectedCrew.id, result); onAllocationSaved({ bookingId: booking.id, employeeName: selectedCrew.name, action: ids.includes(booking.id) ? "removed" : "saved" }); } catch { toast.error("Allocation could not be saved."); } };
  const bulkAssign = async () => {
    if (!targetBooking || !selectedBulkCrew.length) return toast.info("Select one or more crew members first.");
    if (!toPersistedBookingId(targetBooking.id)) return toast.info("This preview dossier cannot receive durable assignments.");
    try {
      const results = await Promise.all(selectedBulkCrew.map(async crew => ({ crew, result: await persistCrew(crew, crew.bookingIds.includes(targetBooking.id) ? crew.bookingIds : [...crew.bookingIds, targetBooking.id]) })));
      results.forEach(({ crew, result }) => mergeCrewResult(crew.id, result));
      results.forEach(({ crew }) => onAllocationSaved({ bookingId: targetBooking.id, employeeName: crew.name, action: "saved" }));
      toast.success(`${results.length} crew member${results.length === 1 ? "" : "s"} assigned to ${targetBooking.id}.`);
    } catch { toast.error("Bulk assignment could not be saved. Existing assignments were left unchanged."); }
  };

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Resource readiness</div><h1>{focusedBooking ? `Edit assignment · ${focusedBooking.id}` : "Crew assignment"}</h1><p>{focusedBooking ? "Select multiple available or assigned employees, review conflicts, then assign the group in one action." : "Search, review, and allocate the attendance-backed crew roster."}</p></div><div style={{ display: "flex", gap: 8 }}><button className="secondary-button" onClick={exportCalendar}><Download size={14}/> Export schedule</button><button className="primary-button" onClick={onAddWorkman}><Plus size={14}/> Add workman</button></div></div>{focusedBooking && <div className="notification"><div className="title">Bulk Edit Assignment</div><div className="body">Available and already-assigned crew remain selectable. Conflicts are shown before the bulk save.</div></div>}<div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div className="filter-row">{(["All", "Present", "On Leave", "Assigned", "Upcoming booking", "Completed booking", "Off-Site"] as Availability[]).map(value => <button key={value} className={`filter-chip ${availability === value ? "selected" : ""}`} onClick={() => setAvailability(value)}>{value}</button>)}</div><span className="panel-meta">{visibleCrew.length} matching crew</span></div><div className="panel-body crew-search-controls"><label className="search-pill booking-search"><Search size={14}/><input aria-label="Search crew assignment roster" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, ID, role, booking, or department"/></label><select className="attendance-select compact" value={department} onChange={event => setDepartment(event.target.value)} aria-label="Filter crew by department"><option value="All">All departments</option>{departments.map(item => <option key={item}>{item}</option>)}</select><label className="crew-date-filter"><CalendarDays size={14}/><span>Availability on</span><input type="date" value={availabilityDate} onChange={event => setAvailabilityDate(event.target.value)} aria-label="Filter crew availability by date"/></label></div><div className="panel-body saved-search-controls"><input className="form-input" value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Name this workspace search" aria-label="Saved search name"/><button className="secondary-button" onClick={savePreset}><Save size={14}/> Save search</button>{savedPresets.map(preset => <button className="filter-chip" key={preset.id} onClick={() => { setQuery(preset.query); setDepartment(preset.department); setAvailability(preset.availability); setAvailabilityDate(preset.date); }}>{preset.name}</button>)}</div><div className="table-wrap"><table className="data-table" data-testid="crew-roster-table"><thead><tr>{focusedBooking && <th><button className="table-select-all" onClick={selectVisible} aria-label="Select all filtered crew"><CheckSquare size={14}/></button></th>}<th>Workman</th><th>Attendance ID</th><th>Role</th><th>Department</th><th>Availability</th><th>Booking allocation</th></tr></thead><tbody>{visibleCrew.map(crew => { const timing = crew.bookingIds.length ? summarizeAllocationTiming(crew.bookingIds, bookings, new Date(`${availabilityDate}T12:00:00`)) : null; return <tr key={crew.id} className={selectedCrew?.id === crew.id ? "selected-row" : ""} onClick={() => setSelectedCrewId(crew.id)}>{focusedBooking && <td><input type="checkbox" checked={bulkIds.includes(crew.id)} onChange={() => toggleBulk(crew.id)} onClick={event => event.stopPropagation()} aria-label={`Select ${crew.name} for bulk assignment`}/></td>}<td><strong>{crew.name}</strong><span className="allocation-count-badge">{crew.bookingIds.length} allocation{crew.bookingIds.length === 1 ? "" : "s"}</span></td><td>{crew.sourceId}</td><td>{crew.role}</td><td>{crew.department}</td><td><Badge value={crew.availability}/>{timing && <Badge value={timing}/>}</td><td>{crew.bookingIds.length ? <div className="crew-booking-ids">{crew.bookingIds.map(id => <button className="booking-id-chip" key={id} onClick={event => { event.stopPropagation(); onOpenDossier(id); }} aria-label={`Open ${id} dossier`}>{id}<ExternalLink size={11}/></button>)}</div> : "Available"}</td></tr>; })}</tbody></table>{!visibleCrew.length && <div className="empty-state">No crew match this page search and date filter.</div>}</div></div>{focusedBooking && <div className="bulk-assignment-layout"><section className="panel"><div className="panel-header"><div><div className="panel-title"><Users size={15}/> Bulk assignment · {targetBooking?.id}</div><div className="panel-meta">{selectedBulkCrew.length} selected crew member{selectedBulkCrew.length === 1 ? "" : "s"}</div></div><button className="primary-button" disabled={!selectedBulkCrew.length || saveAllocation.isPending} onClick={bulkAssign}>{saveAllocation.isPending ? "Saving…" : `Assign ${selectedBulkCrew.length || "selected"} crew`}</button></div><div className="panel-body">{selectedBulkCrew.length ? <div className="bulk-selected-list">{selectedBulkCrew.map(crew => <span className="booking-id-chip" key={crew.id}>{crew.name} · {crew.role}</span>)}</div> : <div className="empty-state">Select employees from the roster above to prepare a bulk assignment.</div>}</div></section><section className="panel"><div className="panel-header"><div><div className="panel-title"><AlertTriangle size={15}/> Conflict timeline before save</div><div className="panel-meta">Target booking dates are compared with every selected crew member’s saved allocations.</div></div><Badge value={activeConflicts.length ? `${activeConflicts.length} conflicts` : "Clear"}/></div><div className="panel-body conflict-timeline">{selectedBulkCrew.length ? conflictSummary.map(item => <div className="conflict-timeline-row" key={item.crew.id}><strong>{item.crew.name}</strong><div className="conflict-track"><span className="conflict-target-segment">Target · {targetBooking?.mob} → {targetBooking?.offHire}</span>{item.conflicts.map(conflict => <span className="conflict-overlap-segment" key={conflict.id}>Conflict · {conflict.id}</span>)}</div><small>{item.conflicts.length ? `${item.conflicts.length} overlapping booking${item.conflicts.length === 1 ? "" : "s"}` : "No date overlap"}</small></div>) : <div className="empty-state">Select crew to see their booking conflict timeline before saving.</div>}</div></section></div>}<div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div className="panel-title">Individual assignment</div><div className="panel-meta">Use this control for the selected roster row.</div></div></div><div className="panel-body booking-allocation-list">{focusAssignmentBooking(bookings, focusedBookingId).map(booking => <div className="booking-allocation-row" key={booking.id}><div><strong>{booking.id}</strong><span>{booking.client} · {booking.mob} → {booking.offHire}</span></div><button className="secondary-button" onClick={() => toggleSingle(booking)}>{selectedCrew?.bookingIds.includes(booking.id) ? "Remove selected crew" : "Assign selected crew"}</button></div>)}</div></div>;
}
