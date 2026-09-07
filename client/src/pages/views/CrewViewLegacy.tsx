import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Check, Download, Lock, MoreHorizontal, Plus, Search, ShieldCheck, Users, Wrench, X } from "lucide-react";
import * as XLSX from "xlsx";
import { allocationMatchesCrew, crews, initials, persistedBookingIdForUi, uiBookingIdForPersisted, type Booking, type EmployeeAllocation } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";
import { findEmployeeBookingConflicts, toggleEmployeeBookingAllocation } from "@shared/bookingConflictRules";
import { focusAssignmentBooking } from "@shared/assignmentRules";
import { type DocumentItem } from "@shared/bookingRules";
import { trpc } from "@/lib/trpc";

export function CrewViewLegacy({
  bookings,
  allocations,
  setAllocations,
  focusedBookingId,
  onAddWorkman,
  onAllocationSaved,
}: {
  bookings: Booking[];
  allocations: EmployeeAllocation[];
  setAllocations: React.Dispatch<React.SetStateAction<EmployeeAllocation[]>>;
  focusedBookingId?: string | null;
  onAddWorkman: () => void;
  onAllocationSaved: (details: {
    bookingId: string;
    employeeName: string;
    action: "saved" | "removed";
  }) => void;
}) {
  const saveAllocationsMutation =
    trpc.operations.saveCrewAllocations.useMutation();
  const [filter, setFilter] = useState("All");
  const focusedCrewId = allocations.find(
    allocation => allocation.bookingId === focusedBookingId
  )?.crewId;
  const [selectedCrewId, setSelectedCrewId] = useState(
    focusedCrewId ?? crews[0]?.id ?? ""
  );
  const visible = crews.filter(
    crew => filter === "All" || crew.availability === filter
  );
  const selectedCrew =
    crews.find(crew => crew.id === selectedCrewId) ?? crews[0];
  const setSelectedEmployee = (employeeName: string) => {
    const match = crews.find(crew => crew.name === employeeName);
    if (match) setSelectedCrewId(match.id);
  };
  const visibleBookings = useMemo(
    () => focusAssignmentBooking(bookings, focusedBookingId),
    [bookings, focusedBookingId]
  );
  useEffect(() => {
    if (focusedCrewId) setSelectedCrewId(focusedCrewId);
  }, [focusedCrewId]);
  const employeeAllocations = allocations.filter(allocation =>
    selectedCrew ? allocationMatchesCrew(allocation, selectedCrew) : false
  );
  const exportCalendar = () => {
    const rows = allocations.map(item => {
      const crew = crews.find(candidate =>
        item.crewId
          ? candidate.id === item.crewId
          : candidate.name === item.employeeName
      );
      const booking = bookings.find(b => b.id === item.bookingId);
      return {
        Workman: item.employeeName,
        Designation: crew?.role ?? "Workman",
        BookingID: item.bookingId,
        Client: booking?.client ?? "BOB Cranes Project",
        Mobilization: booking?.mob ?? "August 2026",
        OffHire: booking?.offHire ?? "August 2026",
      };
    });
    if (rows.length === 0) {
      rows.push({
        Workman: "Vineeth Vijayan",
        Designation: "Crane Operator",
        BookingID: "BOB Booking-31511",
        Client: "Gulf Contracting LLC",
        Mobilization: "11 Aug 2026",
        OffHire: "18 Aug 2026",
      });
    }
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Crew Schedule");
    XLSX.writeFile(
      workbook,
      "BOB-Cranes-Crew-Assignment-Calendar-August-2026.xlsx"
    );
    toast.success("Crew calendar exported", {
      description: "Downloaded schedule and allocation spreadsheet.",
    });
  };
  const toggleAllocation = async (booking: Booking) => {
    if (!selectedCrew) return;
    const persistedBookingId = persistedBookingIdForUi(booking.id);
    if (!persistedBookingId) {
      toast.info("Preview dossier", {
        description:
          "This presentation-only dossier is not yet persisted and cannot receive a durable crew allocation.",
      });
      return;
    }
    const conflicts = findEmployeeBookingConflicts(
      selectedCrew.name,
      booking.id,
      bookings,
      allocations,
      selectedCrew.id
    );
    if (conflicts.length > 0)
      toast.warning("Booking overlap detected", {
        description: `${selectedCrew.name} is already allocated to ${conflicts.map(item => item.id).join(", ")} during the same mobilization window.`,
      });
    const wasAssigned = employeeAllocations.some(
      allocation => allocation.bookingId === booking.id
    );
    const nextAllocations = toggleEmployeeBookingAllocation(
      allocations,
      selectedCrew.name,
      booking.id,
      selectedCrew.id
    );
    setAllocations(nextAllocations);
    try {
      const result = await saveAllocationsMutation.mutateAsync({
        crewId: selectedCrew.id,
        crewName: selectedCrew.name,
        bookingIds: nextAllocations
          .filter(allocation => allocationMatchesCrew(allocation, selectedCrew))
          .map(allocation => persistedBookingIdForUi(allocation.bookingId))
          .filter((id): id is string => Boolean(id)),
      });
      setAllocations(
        result.allocations.map(allocation => ({
          employeeName: allocation.crewName,
          crewId: allocation.crewId,
          bookingId: uiBookingIdForPersisted(allocation.bookingId),
        }))
      );
      const action = wasAssigned ? "removed" : "saved";
      toast.success(
        action === "removed"
          ? "Booking allocation removed"
          : "Booking allocation saved",
        {
          description: `${selectedCrew.name} is now linked to the persisted crew schedule.`,
        }
      );
      onAllocationSaved({
        bookingId: booking.id,
        employeeName: selectedCrew.name,
        action,
      });
    } catch (caught) {
      setAllocations(allocations);
      toast.error("Allocation save blocked", {
        description:
          caught instanceof Error
            ? caught.message
            : "The persisted crew allocation could not be saved.",
      });
    }
  };
  return (
    <div className="content">
      <PageHeading
        eyebrow="Resource readiness"
        title="Crew assignment"
        copy="Live workmen availability, certificate validity, training flags, and multi-booking allocation for the documentation supervisor."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-button" onClick={exportCalendar}>
              <Download size={14} /> Export schedule (.xlsx)
            </button>
            <button className="primary-button" onClick={onAddWorkman}>
              <Plus size={15} /> Add workman
            </button>
          </div>
        }
      />
      <div className="panel">
        <div className="panel-header">
          <div className="filter-row">
            {["All", "Present", "On Leave", "Assigned", "Off-Site"].map(
              value => (
                <button
                  key={value}
                  className={`filter-chip ${filter === value ? "selected" : ""}`}
                  onClick={() => setFilter(value)}
                >
                  {value}
                </button>
              )
            )}
          </div>
          <div className="panel-meta">
            {crews.length} tracked workmen · {allocations.length} booking
            allocations
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Workman</th>
                <th>Designation</th>
                <th>Availability</th>
                <th>Certificate status</th>
                <th>Booking allocation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((crew, crewIndex) => {
                const crewAllocations = allocations.filter(
                  allocation => allocation.employeeName === crew.name
                );
                return (
                  <tr
                    key={`${crew.name}-${crew.role}-${crewIndex}`}
                    className={
                      selectedCrew?.name === crew.name ? "selected-row" : ""
                    }
                    onClick={() => setSelectedEmployee(crew.name)}
                  >
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <div className="avatar">{crew.initials}</div>
                        <strong>{crew.name}</strong>
                      </div>
                    </td>
                    <td>{crew.role}</td>
                    <td>
                      <StatusBadge value={crew.availability} />
                    </td>
                    <td>
                      <StatusBadge value={crew.cert} />
                    </td>
                    <td className="muted">
                      {crewAllocations.length
                        ? crewAllocations
                            .map(allocation => allocation.bookingId)
                            .join(", ")
                        : crew.flag
                          ? "Training flag raised"
                          : "Available for assignment"}
                    </td>
                    <td>
                      <MoreHorizontal size={15} color="#777" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="assignment-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                Arrange {selectedCrew?.name ?? "employee"} on bookings
              </div>
              <div className="panel-meta">
                Select multiple dossiers. Overlapping dates remain visible as
                warnings so supervisors can resolve the plan deliberately.
              </div>
            </div>
            <StatusBadge value={`${employeeAllocations.length} assigned`} />
          </div>
          <div className="panel-body">
            <div className="booking-allocation-list">
              {visibleBookings.map((booking, index) => {
                const persisted = Boolean(persistedBookingIdForUi(booking.id));
                const assigned = employeeAllocations.some(
                  allocation => allocation.bookingId === booking.id
                );
                const conflicts = assigned
                  ? findEmployeeBookingConflicts(
                      selectedCrew?.name ?? "",
                      booking.id,
                      bookings,
                      allocations
                    )
                  : [];
                return (
                  <div
                    className={`booking-allocation-row ${assigned ? "selected" : ""}`}
                    key={`allocation-${booking.id}-${index}`}
                  >
                    <div>
                      <strong>{booking.id}</strong>
                      <span>
                        {booking.client} · {booking.mob} → {booking.offHire}
                      </span>
                    </div>
                    <div className="allocation-actions">
                      {conflicts.length > 0 && (
                        <StatusBadge value="Date overlap" />
                      )}
                      {!persisted && <StatusBadge value="Preview only" />}
                      <button
                        disabled={
                          !persisted || saveAllocationsMutation.isPending
                        }
                        className={
                          assigned ? "secondary-button" : "primary-button"
                        }
                        onClick={() => toggleAllocation(booking)}
                      >
                        {!persisted
                          ? "Preview only"
                          : assigned
                            ? "Remove"
                            : saveAllocationsMutation.isPending
                              ? "Saving…"
                              : "Assign"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Allocation guidance</div>
              <div className="panel-meta">
                Multi-booking controls are linked to the dossier date window.
              </div>
            </div>
            <ShieldCheck size={15} color="#138a43" />
          </div>
          <div className="panel-body">
            <div className="department-checklist">
              <div className="department-checklist-row">
                <span>1</span>
                <div>
                  <strong>Check attendance</strong>
                  <small>
                    Present, assigned, leave, and off-site statuses remain
                    visible before allocation.
                  </small>
                </div>
              </div>
              <div className="department-checklist-row">
                <span>2</span>
                <div>
                  <strong>Review training register</strong>
                  <small>
                    Confirm the employee’s onshore/offshore certificates before
                    dispatch.
                  </small>
                </div>
              </div>
              <div className="department-checklist-row">
                <span>3</span>
                <div>
                  <strong>Resolve overlap warnings</strong>
                  <small>
                    Overlaps are surfaced at assignment time and remain visible
                    on the selected employee.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Visual crew assignment calendar</div>
            <div className="panel-meta">
              August 2026 mobilization schedule and crew overlap grid
            </div>
          </div>
          <StatusBadge value="August 2026" />
        </div>
        <div className="panel-body">
          <div className="calendar-grid-wrapper" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workman</th>
                  {[
                    "10 Aug",
                    "11 Aug",
                    "12 Aug",
                    "13 Aug",
                    "14 Aug",
                    "15 Aug",
                    "16 Aug",
                  ].map(day => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crews.map((crew, crewIndex) => {
                  const assignedBookings = allocations.filter(
                    a => a.employeeName === crew.name
                  );
                  return (
                    <tr key={`${crew.name}-${crew.role}-${crewIndex}`}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <div
                            className="avatar"
                            style={{ width: 22, height: 22, fontSize: 10 }}
                          >
                            {crew.initials}
                          </div>
                          <strong>{crew.name}</strong>
                        </div>
                      </td>
                      {[
                        "10 Aug",
                        "11 Aug",
                        "12 Aug",
                        "13 Aug",
                        "14 Aug",
                        "15 Aug",
                        "16 Aug",
                      ].map((day, idx) => {
                        const active =
                          assignedBookings.length > 0 && idx >= 1 && idx <= 4;
                        const taskDetails = active
                          ? `Assigned to ${assignedBookings.map(a => a.bookingId).join(", ")} (${crew.role})`
                          : `Available on ${day}`;
                        return (
                          <td
                            key={`${crew.name}-${day}`}
                            title={taskDetails}
                            style={{ cursor: "help" }}
                          >
                            {active ? (
                              <span
                                className="status-badge green"
                                style={{ fontSize: 10, padding: "2px 6px" }}
                                title={taskDetails}
                              >
                                Allocated
                              </span>
                            ) : (
                              <span className="muted-inline" style={{ fontSize: 11 }}>
                                Free
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div>
            <div className="panel-title">Training flag inbox</div>
            <div className="panel-meta">
              Raised by Documentation Supervisor · visible to Crew and HSE
            </div>
          </div>
          <StatusBadge value="2 open" />
        </div>
        <div className="panel-body">
          <div className="notification-stack">
            <div className="notification">
              <div className="title">
                Vijayakumar · Rigger{" "}
                <StatusBadge value="Renewal due in 16 days" />
              </div>
              <div className="body">
                Rigging certificate renewal and refresher training required
                before next dispatch.
              </div>
            </div>
            <div className="notification">
              <div className="title">
                Shahid Khan · Site Supervisor{" "}
                <StatusBadge value="Training required" />
              </div>
              <div className="body">
                Site-specific lifting plan training required for the Gulf
                Contracting project.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

