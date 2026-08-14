import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CalendarDays, Download, ExternalLink, MoreHorizontal, Plus, Save, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CREW_ASSIGNMENT_ROSTER } from "@shared/crewAssignmentRoster";
import { findEmployeeBookingConflicts, toggleEmployeeBookingAllocation, type EmployeeAllocation } from "@shared/bookingConflictRules";
import { focusAssignmentBooking } from "@shared/assignmentRules";
import { allocationAwareAvailability, summarizeAllocationTiming, type AllocationTiming } from "@shared/crewAssignmentAvailability";

type Booking = { id: string; client: string; project?: string; mob: string; offHire: string };
type Availability = "All" | "Present" | "On Leave" | "Assigned" | "Upcoming booking" | "Completed booking" | "Off-Site" | "Scheduled booking";
type CrewSearchPreset = { id: string; name: string; query: string; department: string; availability: Availability; date: string };

const PRESET_STORAGE_KEY = "bob-crew-assignment-search-presets-v1";
const toPersistedBookingId = (bookingId: string): string | null => bookingId === "BOB Booking-31511" ? "BOB-59116" : bookingId === "BOB Booking-31421" ? "BOB-59117" : bookingId === "BOB Booking-31390" ? "BOB-59118" : null;
const toUiBookingId = (bookingId: string): string => bookingId === "BOB-59116" ? "BOB Booking-31511" : bookingId === "BOB-59117" ? "BOB Booking-31421" : bookingId === "BOB-59118" ? "BOB Booking-31390" : bookingId;
const todayKey = () => new Date().toISOString().slice(0, 10);

function StatusBadge({ value }: { value: string }) {
  const tone = value === "Present" || value === "Compliant" || value === "Active booking" ? "green" : value === "On Leave" || value === "Off-Site" || value === "Training required" ? "red" : value === "Assigned" || value === "Upcoming booking" ? "blue" : value === "Completed booking" ? "gray" : "gray";
  return <span className={`status-badge ${tone}`}>{value}</span>;
}

function allocationMatches(employee: { id: string; name: string }, allocation: EmployeeAllocation) {
  return allocation.crewId ? allocation.crewId === employee.id : allocation.employeeName === employee.name;
}

function availabilityForDate(
  attendanceAvailability: (typeof CREW_ASSIGNMENT_ROSTER)[number]["availability"],
  bookingIds: string[],
  bookings: Booking[],
  availabilityDate: string
) {
  if (!bookingIds.length) return allocationAwareAvailability(attendanceAvailability, false);
  const timing = summarizeAllocationTiming(bookingIds, bookings, new Date(`${availabilityDate}T12:00:00`));
  if (timing === "Active booking") return "Assigned" as const;
  return timing;
}

function timingForDate(bookingIds: string[], bookings: Booking[], availabilityDate: string): AllocationTiming {
  return summarizeAllocationTiming(bookingIds, bookings, new Date(`${availabilityDate}T12:00:00`));
}

export function CrewView({ bookings, allocations, setAllocations, focusedBookingId, onAddWorkman, onAllocationSaved, onOpenDossier = () => undefined }: { bookings: Booking[]; allocations: EmployeeAllocation[]; setAllocations: React.Dispatch<React.SetStateAction<EmployeeAllocation[]>>; focusedBookingId?: string | null; onAddWorkman: () => void; onAllocationSaved: (details: { bookingId: string; employeeName: string; action: "saved" | "removed" }) => void; onOpenDossier?: (bookingId: string) => void }) {
  const saveAllocationsMutation = trpc.operations.saveCrewAllocations.useMutation();
  const focusedCrewId = allocations.find((allocation) => allocation.bookingId === focusedBookingId)?.crewId;
  const [selectedCrewId, setSelectedCrewId] = useState(focusedCrewId ?? CREW_ASSIGNMENT_ROSTER[0]?.id ?? "");
  const [availability, setAvailability] = useState<Availability>("All");
  const [department, setDepartment] = useState("All");
  const [query, setQuery] = useState("");
  const [availabilityDate, setAvailabilityDate] = useState(todayKey);
  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState<CrewSearchPreset[]>([]);
  const departments = useMemo(() => Array.from(new Set(CREW_ASSIGNMENT_ROSTER.map((employee) => employee.department))).sort(), []);
  const selectedCrew = CREW_ASSIGNMENT_ROSTER.find((employee) => employee.id === selectedCrewId) ?? CREW_ASSIGNMENT_ROSTER[0];
  const focusedBooking = bookings.find((booking) => booking.id === focusedBookingId) ?? null;
  const visibleBookings = useMemo(() => focusAssignmentBooking(bookings, focusedBookingId), [bookings, focusedBookingId]);
  const bookingIdsByEmployeeId = useMemo(() => new Map(CREW_ASSIGNMENT_ROSTER.map((employee) => [employee.id, allocations.filter((allocation) => allocationMatches(employee, allocation)).map((allocation) => allocation.bookingId)])), [allocations]);
  const availabilityByEmployeeId = useMemo(() => new Map(CREW_ASSIGNMENT_ROSTER.map((employee) => {
    const bookingIds = bookingIdsByEmployeeId.get(employee.id) ?? [];
    return [employee.id, availabilityForDate(employee.availability, bookingIds, bookings, availabilityDate)];
  })), [availabilityDate, bookingIdsByEmployeeId, bookings]);
  const visibleCrew = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return CREW_ASSIGNMENT_ROSTER.filter((employee) => {
      const resolvedAvailability = availabilityByEmployeeId.get(employee.id) ?? employee.availability;
      const bookingIds = bookingIdsByEmployeeId.get(employee.id) ?? [];
      const matchesAvailability = availability === "All" || resolvedAvailability === availability;
      const matchesDepartment = department === "All" || employee.department === department;
      const matchesQuery = !normalized || `${employee.name} ${employee.sourceId} ${employee.role} ${employee.department} ${bookingIds.join(" ")}`.toLowerCase().includes(normalized);
      return matchesAvailability && matchesDepartment && matchesQuery;
    }).map((employee) => ({ ...employee, availability: availabilityByEmployeeId.get(employee.id) ?? employee.availability }));
  }, [availability, availabilityByEmployeeId, bookingIdsByEmployeeId, department, query]);
  const employeeAllocations = allocations.filter((allocation) => selectedCrew ? allocationMatches(selectedCrew, allocation) : false);

  useEffect(() => {
    if (focusedCrewId && CREW_ASSIGNMENT_ROSTER.some((employee) => employee.id === focusedCrewId)) setSelectedCrewId(focusedCrewId);
  }, [focusedCrewId]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRESET_STORAGE_KEY);
      if (saved) setSavedPresets(JSON.parse(saved));
    } catch { setSavedPresets([]); }
  }, []);
  const persistPresets = (presets: CrewSearchPreset[]) => {
    setSavedPresets(presets);
    try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets)); } catch {}
  };
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { toast.info("Name this search before saving it."); return; }
    const preset: CrewSearchPreset = { id: `${Date.now()}`, name, query, department, availability, date: availabilityDate };
    persistPresets([preset, ...savedPresets.filter((item) => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 8));
    setPresetName("");
    toast.success(`Saved “${name}” for Crew Assignment.`);
  };
  const applyPreset = (preset: CrewSearchPreset) => {
    setQuery(preset.query); setDepartment(preset.department); setAvailability(preset.availability); setAvailabilityDate(preset.date);
    toast.success(`Applied “${preset.name}”.`);
  };
  const exportCalendar = () => {
    const rows = allocations.map((allocation) => {
      const employee = CREW_ASSIGNMENT_ROSTER.find((candidate) => allocationMatches(candidate, allocation));
      const booking = bookings.find((candidate) => candidate.id === allocation.bookingId);
      return { Workman: allocation.employeeName, EmployeeID: employee?.sourceId ?? allocation.crewId ?? "", Designation: employee?.role ?? "Workman", Department: employee?.department ?? "", BookingID: allocation.bookingId, Client: booking?.client ?? "BOB Cranes Project", Mobilization: booking?.mob ?? "", OffHire: booking?.offHire ?? "", AvailabilityOnSelectedDate: employee ? availabilityByEmployeeId.get(employee.id) : "" };
    });
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Workman: "No persisted allocation", EmployeeID: "", Designation: "", Department: "", BookingID: "", Client: "", Mobilization: "", OffHire: "", AvailabilityOnSelectedDate: "" }]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Crew Schedule"); XLSX.writeFile(workbook, "BOB-Cranes-Crew-Assignment-Calendar.xlsx");
    toast.success("Crew calendar exported.");
  };
  const toggleAllocation = async (booking: Booking) => {
    if (!selectedCrew) return;
    const persistedBookingId = toPersistedBookingId(booking.id);
    if (!persistedBookingId) { toast.info("Preview dossier", { description: "This presentation-only dossier cannot receive a durable crew allocation." }); return; }
    const conflicts = findEmployeeBookingConflicts(selectedCrew.name, booking.id, bookings, allocations, selectedCrew.id);
    if (conflicts.length) toast.warning("Booking overlap detected", { description: `${selectedCrew.name} is already allocated to ${conflicts.map((item) => item.id).join(", ")}.` });
    const wasAssigned = employeeAllocations.some((allocation) => allocation.bookingId === booking.id);
    const nextAllocations = toggleEmployeeBookingAllocation(allocations, selectedCrew.name, booking.id, selectedCrew.id);
    setAllocations(nextAllocations);
    try {
      const result = await saveAllocationsMutation.mutateAsync({ crewId: selectedCrew.id, crewName: selectedCrew.name, bookingIds: nextAllocations.filter((allocation) => allocationMatches(selectedCrew, allocation)).map((allocation) => toPersistedBookingId(allocation.bookingId)).filter((id): id is string => id !== null) });
      setAllocations(result.allocations.map((allocation) => ({ employeeName: allocation.crewName, crewId: allocation.crewId, bookingId: toUiBookingId(allocation.bookingId) })));
      const action = wasAssigned ? "removed" : "saved";
      toast.success(action === "saved" ? "Crew member assigned" : "Crew member removed", { description: `${selectedCrew.name} ${action === "saved" ? "is assigned to" : "was removed from"} ${booking.id}.` });
      onAllocationSaved({ bookingId: booking.id, employeeName: selectedCrew.name, action });
    } catch (error) {
      setAllocations(allocations);
      toast.error("Allocation save blocked", { description: error instanceof Error ? error.message : "The saved crew schedule could not be updated." });
    }
  };

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Resource readiness</div><h1>{focusedBooking ? `Edit assignment · ${focusedBooking.id}` : "Crew assignment"}</h1><p>{focusedBooking ? "Select any available or already-assigned employee below, then assign or remove them from this booking." : `Search, review, and allocate all ${CREW_ASSIGNMENT_ROSTER.length} employees from the August attendance workbook.`}</p></div><div style={{ display: "flex", gap: 8 }}><button className="secondary-button" onClick={exportCalendar}><Download size={14} /> Export schedule (.xlsx)</button><button className="primary-button" onClick={onAddWorkman}><Plus size={15} /> Add workman</button></div></div>{focusedBooking && <div className="notification" style={{ marginBottom: 16 }}><div className="title">Edit assignment mode</div><div className="body">Available, assigned, upcoming, and completed crew are all selectable. Use the target booking card below to save the employee selection.</div></div>}<div className="panel"><div className="panel-header"><div className="filter-row">{(["All", "Present", "On Leave", "Assigned", "Upcoming booking", "Completed booking", "Off-Site"] as Availability[]).map((value) => <button key={value} className={`filter-chip ${availability === value ? "selected" : ""}`} onClick={() => setAvailability(value)} aria-pressed={availability === value}>{value}</button>)}</div><div className="panel-meta">{visibleCrew.length} of {CREW_ASSIGNMENT_ROSTER.length} employees · {allocations.length} saved allocations</div></div><div className="panel-body crew-search-controls"><label className="search-pill booking-search"><Search size={14} /><input aria-label="Search crew assignment roster" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID, role, booking, or department" /></label><select className="attendance-select compact" aria-label="Filter crew by attendance department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="All">All attendance departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select><label className="crew-date-filter"><CalendarDays size={14} /><span>Availability on</span><input type="date" value={availabilityDate} onChange={(event) => setAvailabilityDate(event.target.value)} aria-label="Filter crew availability by date" /></label></div><div className="panel-body saved-search-controls"><input className="form-input" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Name this workspace search" aria-label="Saved search name" /><button className="secondary-button" onClick={savePreset}><Save size={14} /> Save search</button>{savedPresets.length > 0 && <div className="saved-search-preset-list">{savedPresets.map((preset) => <button className="filter-chip" key={preset.id} onClick={() => applyPreset(preset)} title={`Apply ${preset.name}`}>{preset.name}</button>)}</div>}</div><div className="table-wrap"><table className="data-table" data-testid="crew-roster-table"><thead><tr><th>Workman</th><th>Attendance ID</th><th>Designation</th><th>Department</th><th>Availability on {availabilityDate}</th><th>Certificate status</th><th>Booking allocation</th><th /></tr></thead><tbody>{visibleCrew.map((employee) => { const crewAllocations = allocations.filter((allocation) => allocationMatches(employee, allocation)); const bookingIds = crewAllocations.map((allocation) => allocation.bookingId); const timing = timingForDate(bookingIds, bookings, availabilityDate); const assignedToFocused = Boolean(focusedBookingId && bookingIds.includes(focusedBookingId)); return <tr key={employee.id} className={selectedCrew?.id === employee.id ? "selected-row" : ""} onClick={() => setSelectedCrewId(employee.id)}><td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div className="avatar">{employee.initials}</div><div><strong>{employee.name}</strong>{crewAllocations.length > 0 && <span className="allocation-count-badge">{crewAllocations.length} {crewAllocations.length === 1 ? "allocation" : "allocations"}</span>}{assignedToFocused && <span className="assignment-target-badge">Selected for this booking</span>}</div></div></td><td>{employee.sourceId}</td><td>{employee.role}</td><td>{employee.department}</td><td>{crewAllocations.length ? <div className="crew-allocation-status"><StatusBadge value={employee.availability} />{employee.availability === "Assigned" && <StatusBadge value={timing}/>}</div> : <StatusBadge value={employee.availability} />}</td><td><StatusBadge value={employee.cert} /></td><td className="muted">{bookingIds.length ? <div className="crew-booking-ids">{bookingIds.map((bookingId) => <button className="booking-id-chip" key={`${employee.id}-${bookingId}`} onClick={(event) => { event.stopPropagation(); onOpenDossier(bookingId); }} aria-label={`Open ${bookingId} dossier`}>{bookingId}<ExternalLink size={11}/></button>)}</div> : employee.flag ? "Training flag raised" : "Available for assignment"}</td><td><MoreHorizontal size={15} color="#777" /></td></tr>; })}</tbody></table>{visibleCrew.length === 0 && <div className="empty-state">No crew records on this page match the current search, date, or filters.</div>}</div></div><div className="assignment-layout"><div className="panel"><div className="panel-header"><div><div className="panel-title">Arrange {selectedCrew?.name ?? "employee"} on bookings</div><div className="panel-meta">Select a crew row, then assign or remove that employee. Existing assignments remain selectable during edit mode.</div></div><StatusBadge value={`${employeeAllocations.length} assigned`}/></div><div className="panel-body"><div className="booking-allocation-list">{visibleBookings.map((booking) => { const persisted = Boolean(toPersistedBookingId(booking.id)); const assigned = employeeAllocations.some((allocation) => allocation.bookingId === booking.id); const conflicts = assigned && selectedCrew ? findEmployeeBookingConflicts(selectedCrew.name, booking.id, bookings, allocations, selectedCrew.id) : []; const timing = timingForDate([booking.id], bookings, availabilityDate); return <div className={`booking-allocation-row ${assigned ? "selected" : ""}`} key={booking.id}><div><strong>{booking.id}</strong><span>{booking.client} · {booking.mob} → {booking.offHire}</span></div><div className="allocation-actions">{assigned && <StatusBadge value={timing}/>} {conflicts.length > 0 && <StatusBadge value="Date overlap" />}{!persisted && <StatusBadge value="Preview only" />}<button disabled={!persisted || saveAllocationsMutation.isPending} className={assigned ? "secondary-button" : "primary-button"} onClick={() => toggleAllocation(booking)}>{!persisted ? "Preview only" : assigned ? "Remove" : saveAllocationsMutation.isPending ? "Saving…" : "Assign"}</button></div></div>; })}</div></div></div><div className="panel"><div className="panel-header"><div><div className="panel-title">Availability logic</div><div className="panel-meta">Availability is calculated using the selected date and saved booking dates.</div></div><ShieldCheck size={15} color="#138a43" /></div><div className="panel-body"><div className="department-checklist"><div className="department-checklist-row"><span>1</span><div><strong>Active booking</strong><small>The selected date is within the booking mobilization and off-hire period.</small></div></div><div className="department-checklist-row"><span>2</span><div><strong>Upcoming booking</strong><small>The selected date precedes a saved booking allocation.</small></div></div><div className="department-checklist-row"><span>3</span><div><strong>Choose any employee in edit mode</strong><small>Available and already-assigned employees remain selectable; overlap warnings are retained.</small></div></div></div></div></div></div></div>;
}
