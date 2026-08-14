import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, MoreHorizontal, Plus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CREW_ASSIGNMENT_ROSTER } from "@shared/crewAssignmentRoster";
import { findEmployeeBookingConflicts, toggleEmployeeBookingAllocation, type EmployeeAllocation } from "@shared/bookingConflictRules";
import { focusAssignmentBooking } from "@shared/assignmentRules";
import { allocationAwareAvailability, summarizeAllocationTiming } from "@shared/crewAssignmentAvailability";

type Booking = { id: string; client: string; mob: string; offHire: string };
type Availability = "All" | "Present" | "On Leave" | "Assigned" | "Off-Site";
const toPersistedBookingId = (bookingId: string): string | null => bookingId === "BOB Booking-31511" ? "BOB-59116" : bookingId === "BOB Booking-31421" ? "BOB-59117" : bookingId === "BOB Booking-31390" ? "BOB-59118" : null;
const toUiBookingId = (bookingId: string): string => bookingId === "BOB-59116" ? "BOB Booking-31511" : bookingId === "BOB-59117" ? "BOB Booking-31421" : bookingId === "BOB-59118" ? "BOB Booking-31390" : bookingId;

function StatusBadge({ value }: { value: string }) {
  const tone = value === "Present" || value === "Compliant" ? "green" : value === "On Leave" || value === "Off-Site" || value === "Training required" ? "red" : value === "Assigned" ? "blue" : "gray";
  return <span className={`status-badge ${tone}`}>{value}</span>;
}

function allocationMatches(employee: (typeof CREW_ASSIGNMENT_ROSTER)[number], allocation: EmployeeAllocation) {
  return allocation.crewId ? allocation.crewId === employee.id : allocation.employeeName === employee.name;
}

function allocationTimingTone(value: ReturnType<typeof summarizeAllocationTiming>) {
  if (value === "Active booking") return "green";
  if (value === "Upcoming booking") return "amber";
  return "gray";
}

export function CrewView({ bookings, allocations, setAllocations, focusedBookingId, onAddWorkman, onAllocationSaved }: { bookings: Booking[]; allocations: EmployeeAllocation[]; setAllocations: React.Dispatch<React.SetStateAction<EmployeeAllocation[]>>; focusedBookingId?: string | null; onAddWorkman: () => void; onAllocationSaved: (details: { bookingId: string; employeeName: string; action: "saved" | "removed" }) => void }) {
  const saveAllocationsMutation = trpc.operations.saveCrewAllocations.useMutation();
  const focusedCrewId = allocations.find((allocation) => allocation.bookingId === focusedBookingId)?.crewId;
  const [selectedCrewId, setSelectedCrewId] = useState(focusedCrewId ?? CREW_ASSIGNMENT_ROSTER[0]?.id ?? "");
  const [availability, setAvailability] = useState<Availability>("All");
  const [department, setDepartment] = useState("All");
  const [query, setQuery] = useState("");
  const departments = useMemo(() => Array.from(new Set(CREW_ASSIGNMENT_ROSTER.map((employee) => employee.department))).sort(), []);
  const selectedCrew = CREW_ASSIGNMENT_ROSTER.find((employee) => employee.id === selectedCrewId) ?? CREW_ASSIGNMENT_ROSTER[0];
  const visibleBookings = useMemo(() => focusAssignmentBooking(bookings, focusedBookingId), [bookings, focusedBookingId]);
  const availabilityByEmployeeId = useMemo(() => new Map(CREW_ASSIGNMENT_ROSTER.map((employee) => [
    employee.id,
    allocationAwareAvailability(
      employee.availability,
      allocations.some((allocation) => allocationMatches(employee, allocation))
    ),
  ])), [allocations]);
  const bookingIdsByEmployeeId = useMemo(() => new Map(CREW_ASSIGNMENT_ROSTER.map((employee) => [
    employee.id,
    allocations.filter((allocation) => allocationMatches(employee, allocation)).map((allocation) => allocation.bookingId),
  ])), [allocations]);
  const visibleCrew = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return CREW_ASSIGNMENT_ROSTER.filter((employee) => {
      const resolvedAvailability = availabilityByEmployeeId.get(employee.id) ?? employee.availability;
      const matchesAvailability = availability === "All" || resolvedAvailability === availability;
      const matchesDepartment = department === "All" || employee.department === department;
      const bookingIds = bookingIdsByEmployeeId.get(employee.id) ?? [];
      const matchesQuery = !normalized || `${employee.name} ${employee.sourceId} ${employee.role} ${employee.department} ${bookingIds.join(" ")}`.toLowerCase().includes(normalized);
      return matchesAvailability && matchesDepartment && matchesQuery;
    }).map((employee) => ({
      ...employee,
      availability: availabilityByEmployeeId.get(employee.id) ?? employee.availability,
    }));
  }, [availability, availabilityByEmployeeId, bookingIdsByEmployeeId, department, query]);
  const employeeAllocations = allocations.filter((allocation) => selectedCrew ? allocationMatches(selectedCrew, allocation) : false);

  useEffect(() => {
    if (focusedCrewId && CREW_ASSIGNMENT_ROSTER.some((employee) => employee.id === focusedCrewId)) setSelectedCrewId(focusedCrewId);
  }, [focusedCrewId]);

  const exportCalendar = () => {
    const rows = allocations.map((allocation) => {
      const employee = CREW_ASSIGNMENT_ROSTER.find((candidate) => allocationMatches(candidate, allocation));
      const booking = bookings.find((candidate) => candidate.id === allocation.bookingId);
      return { Workman: allocation.employeeName, EmployeeID: employee?.sourceId ?? allocation.crewId ?? "", Designation: employee?.role ?? "Workman", Department: employee?.department ?? "", BookingID: allocation.bookingId, Client: booking?.client ?? "BOB Cranes Project", Mobilization: booking?.mob ?? "August 2026", OffHire: booking?.offHire ?? "August 2026" };
    });
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Workman: "No persisted allocation", EmployeeID: "", Designation: "", Department: "", BookingID: "", Client: "", Mobilization: "", OffHire: "" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Crew Schedule");
    XLSX.writeFile(workbook, "BOB-Cranes-Crew-Assignment-Calendar-August-2026.xlsx");
    toast.success("Crew calendar exported", { description: "Downloaded the persisted crew allocation schedule." });
  };

  const toggleAllocation = async (booking: Booking) => {
    if (!selectedCrew) return;
    const persistedBookingId = toPersistedBookingId(booking.id);
    if (!persistedBookingId) {
      toast.info("Preview dossier", { description: "This presentation-only dossier is not yet persisted and cannot receive a durable crew allocation." });
      return;
    }
    const conflicts = findEmployeeBookingConflicts(selectedCrew.name, booking.id, bookings, allocations, selectedCrew.id);
    if (conflicts.length) toast.warning("Booking overlap detected", { description: `${selectedCrew.name} is already allocated to ${conflicts.map((item) => item.id).join(", ")} during the same window.` });
    const wasAssigned = employeeAllocations.some((allocation) => allocation.bookingId === booking.id);
    const nextAllocations = toggleEmployeeBookingAllocation(allocations, selectedCrew.name, booking.id, selectedCrew.id);
    setAllocations(nextAllocations);
    try {
      const result = await saveAllocationsMutation.mutateAsync({
        crewId: selectedCrew.id,
        crewName: selectedCrew.name,
        bookingIds: nextAllocations.filter((allocation) => allocationMatches(selectedCrew, allocation)).map((allocation) => toPersistedBookingId(allocation.bookingId)).filter((id): id is string => id !== null),
      });
      const fromPersisted = result.allocations.map((allocation) => ({ employeeName: allocation.crewName, crewId: allocation.crewId, bookingId: toUiBookingId(allocation.bookingId) }));
      setAllocations(fromPersisted);
      const action = wasAssigned ? "removed" : "saved";
      toast.success(action === "saved" ? "Booking allocation saved" : "Booking allocation removed", { description: `${selectedCrew.name} is linked to the persisted crew schedule.` });
      onAllocationSaved({ bookingId: booking.id, employeeName: selectedCrew.name, action });
    } catch (error) {
      setAllocations(allocations);
      toast.error("Allocation save blocked", { description: error instanceof Error ? error.message : "The persisted crew allocation could not be saved." });
    }
  };

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Resource readiness</div><h1>Crew assignment</h1><p>All {CREW_ASSIGNMENT_ROSTER.length} employees from the August attendance workbook are available for search, review, and allocation.</p></div><div style={{ display: "flex", gap: 8 }}><button className="secondary-button" onClick={exportCalendar}><Download size={14} /> Export schedule (.xlsx)</button><button className="primary-button" onClick={onAddWorkman}><Plus size={15} /> Add workman</button></div></div><div className="panel"><div className="panel-header"><div className="filter-row">{(["All", "Present", "On Leave", "Assigned", "Off-Site"] as Availability[]).map((value) => <button key={value} className={`filter-chip ${availability === value ? "selected" : ""}`} onClick={() => setAvailability(value)} aria-pressed={availability === value}>{value}</button>)}</div><div className="panel-meta">{CREW_ASSIGNMENT_ROSTER.length} employee records · {allocations.length} saved booking allocations</div></div><div className="panel-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><label className="search-pill booking-search" style={{ width: 290 }}><Search size={14} /><input aria-label="Search crew assignment roster" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID, role, or department" /></label><select className="attendance-select compact" aria-label="Filter crew by attendance department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="All">All attendance departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select><span className="panel-meta">Showing {visibleCrew.length} employees</span></div><div className="table-wrap"><table className="data-table" data-testid="crew-roster-table"><thead><tr><th>Workman</th><th>Attendance ID</th><th>Designation</th><th>Department</th><th>Availability</th><th>Certificate status</th><th>Booking allocation</th><th /></tr></thead><tbody>{visibleCrew.map((employee) => { const crewAllocations = allocations.filter((allocation) => allocationMatches(employee, allocation)); const bookingIds = crewAllocations.map((allocation) => allocation.bookingId); const timing = summarizeAllocationTiming(bookingIds, bookings); return <tr key={employee.id} className={selectedCrew?.id === employee.id ? "selected-row" : ""} onClick={() => setSelectedCrewId(employee.id)}><td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div className="avatar">{employee.initials}</div><div><strong>{employee.name}</strong>{crewAllocations.length > 0 && <span className="allocation-count-badge">{crewAllocations.length} {crewAllocations.length === 1 ? "allocation" : "allocations"}</span>}</div></div></td><td>{employee.sourceId}</td><td>{employee.role}</td><td>{employee.department}</td><td>{crewAllocations.length ? <div className="crew-allocation-status"><StatusBadge value="Assigned" /><span className={`status-badge ${allocationTimingTone(timing)}`}>{timing}</span></div> : <StatusBadge value={employee.availability} />}</td><td><StatusBadge value={employee.cert} /></td><td className="muted">{crewAllocations.length ? <div className="crew-booking-ids">{bookingIds.map((bookingId) => <span className="booking-id-chip" key={`${employee.id}-${bookingId}`}>{bookingId}</span>)}</div> : employee.flag ? "Training flag raised" : "Available for assignment"}</td><td><MoreHorizontal size={15} color="#777" /></td></tr>; })}</tbody></table>{visibleCrew.length === 0 && <div className="empty-state">No crew records on this page match the current search or filters.</div>}</div></div><div className="assignment-layout"><div className="panel"><div className="panel-header"><div><div className="panel-title">Arrange {selectedCrew?.name ?? "employee"} on bookings</div><div className="panel-meta">Select multiple dossiers. Overlap warnings remain visible for supervisor review.</div></div><StatusBadge value={`${employeeAllocations.length} assigned`}/></div><div className="panel-body"><div className="booking-allocation-list">{visibleBookings.map((booking) => { const persisted = ["BOB Booking-31511", "BOB Booking-31421", "BOB Booking-31390"].includes(booking.id); const assigned = employeeAllocations.some((allocation) => allocation.bookingId === booking.id); const conflicts = assigned && selectedCrew ? findEmployeeBookingConflicts(selectedCrew.name, booking.id, bookings, allocations, selectedCrew.id) : []; const timing = summarizeAllocationTiming([booking.id], bookings); return <div className={`booking-allocation-row ${assigned ? "selected" : ""}`} key={booking.id}><div><strong>{booking.id}</strong><span>{booking.client} · {booking.mob} → {booking.offHire}</span></div><div className="allocation-actions">{assigned && <span className={`status-badge ${allocationTimingTone(timing)}`}>{timing}</span>}{conflicts.length > 0 && <StatusBadge value="Date overlap" />}{!persisted && <StatusBadge value="Preview only" />}<button disabled={!persisted || saveAllocationsMutation.isPending} className={assigned ? "secondary-button" : "primary-button"} onClick={() => toggleAllocation(booking)}>{!persisted ? "Preview only" : assigned ? "Remove" : saveAllocationsMutation.isPending ? "Saving…" : "Assign"}</button></div></div>; })}</div></div></div><div className="panel"><div className="panel-header"><div><div className="panel-title">Attendance roster notes</div><div className="panel-meta">Each selection is identified by source attendance ID, so duplicate names remain separate employees.</div></div><ShieldCheck size={15} color="#138a43" /></div><div className="panel-body"><div className="department-checklist"><div className="department-checklist-row"><span>1</span><div><strong>Search this roster</strong><small>Use employee name, attendance ID, designation, availability, or department.</small></div></div><div className="department-checklist-row"><span>2</span><div><strong>Review live allocation status</strong><small>Assigned indicates a saved booking allocation, with active and upcoming timing shown next to it.</small></div></div><div className="department-checklist-row"><span>3</span><div><strong>Save a persisted allocation</strong><small>Assignments are scoped to the specific employee ID and booking dossier.</small></div></div></div></div></div></div><div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div><div className="panel-title">Visual crew assignment calendar</div><div className="panel-meta">Showing the first 80 matching employees; refine this roster search or filters to inspect others.</div></div><StatusBadge value="August 2026" /></div><div className="panel-body"><div className="calendar-grid-wrapper" style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Workman</th>{["10 Aug", "11 Aug", "12 Aug", "13 Aug", "14 Aug", "15 Aug", "16 Aug"].map((day) => <th key={day}>{day}</th>)}</tr></thead><tbody>{visibleCrew.slice(0, 80).map((employee) => { const assigned = allocations.filter((allocation) => allocationMatches(employee, allocation)); return <tr key={employee.id}><td><div style={{ display: "flex", alignItems: "center", gap: 7 }}><div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{employee.initials}</div><strong>{employee.name}</strong></div></td>{["10 Aug", "11 Aug", "12 Aug", "13 Aug", "14 Aug", "15 Aug", "16 Aug"].map((day, index) => { const active = assigned.length > 0 && index >= 1 && index <= 4; const detail = active ? `Assigned to ${assigned.map((allocation) => allocation.bookingId).join(", ")} (${employee.role})` : `Available on ${day}`; return <td key={`${employee.id}-${day}`} title={detail} style={{ cursor: "help" }}>{active ? <span className="status-badge green">Allocated</span> : <span style={{ color: "#555", fontSize: 11 }}>Free</span>}</td>; })}</tr>; })}</tbody></table></div></div></div></div>;
}
